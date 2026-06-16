import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Company, CompanyDocument } from '../schemas/company.schema';
import {
  CompanyProject,
  CompanyProjectDocument,
} from '../schemas/company-project.schema';
import {
  CompanyFacilitator,
  CompanyFacilitatorDocument,
} from '../schemas/company-facilitator.schema';
import {
  CompanyActivity,
  CompanyActivityDocument,
} from '../schemas/company-activity.schema';
import { Facilitator, FacilitatorDocument } from '../schemas/facilitator.schema';
import { MailService } from '../../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MILESTONE_STEPS } from '../notifications/workflow-milestone.constants';
import { passwordGeneration } from '../../helpers/password.helper';
import { RegisterDto } from './dto/register.dto';
import { RegisterThroughFacilitatorDto } from './dto/register-through-facilitator.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegistrationMastersService } from '../registration-masters/registration-masters.service';

function trimCompanyEmail(email: string): string {
  return String(email || '').trim();
}

@Injectable()
export class CompanyAuthService {
  private async resolveFacilitatorForRegistration(input: {
    facilitator_id?: string;
    consultant_id?: string;
    facilitator_code?: string;
  }): Promise<FacilitatorDocument> {
    const facilitatorId = String(input.facilitator_id || '').trim();
    const facilitatorCode = String(input.consultant_id || input.facilitator_code || '')
      .trim()
      .toUpperCase();
    let facilitator: FacilitatorDocument | null = null;
    if (facilitatorId && Types.ObjectId.isValid(facilitatorId)) {
      facilitator = await this.facilitatorModel.findById(facilitatorId);
    }
    if (!facilitator && facilitatorCode) {
      facilitator = await this.facilitatorModel.findOne({
        consultant_id: facilitatorCode,
      });
    }
    if (!facilitator || facilitator.status !== '1') {
      throw new BadRequestException({
        status: 'error',
        message: 'Validation failed',
        errors: {
          facilitator: ['Valid active facilitator is required. Send facilitator_id or facilitator_code.'],
        },
      });
    }
    return facilitator;
  }

  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyProject.name)
    private companyProjectModel: Model<CompanyProjectDocument>,
    @InjectModel(CompanyFacilitator.name)
    private companyFacilitatorModel: Model<CompanyFacilitatorDocument>,
    @InjectModel(CompanyActivity.name)
    private companyActivityModel: Model<CompanyActivityDocument>,
    @InjectModel(Facilitator.name)
    private facilitatorModel: Model<FacilitatorDocument>,
    private jwtService: JwtService,
    private mailService: MailService,
    private notificationsService: NotificationsService,
    private registrationMastersService: RegistrationMastersService,
  ) {}

  /** Exact email match (case-sensitive); only trims surrounding whitespace. */
  private async findCompanyByEmail(
    email: string,
    selectPassword = false,
  ): Promise<CompanyDocument | null> {
    const exact = trimCompanyEmail(email);
    if (!exact) return null;

    const query = this.companyModel.findOne({ email: exact });
    if (selectPassword) query.select('+password');
    return query.exec();
  }

  async register(registerDto: RegisterDto) {
    const assessmentInput = String(registerDto.assessment || '').trim().toLowerCase();
    const normalizedAssessment =
      assessmentInput === 'facilitator' || assessmentInput === 'f' ? 'facilitator' : 'cii';

    // Check if email already exists (exact case match)
    const existingEmail = await this.findCompanyByEmail(registerDto.email);
    if (existingEmail) {
      throw new ConflictException({
        status: 'error',
        message: 'Email already exists',
      });
    }

    // Check if mobile already exists
    const existingMobile = await this.companyModel.findOne({
      mobile: registerDto.mobileno,
    });
    if (existingMobile) {
      throw new ConflictException({
        status: 'error',
        message: 'Mobile number already exists',
      });
    }

    // Validate mobile number format
    if (!/^[6-9]\d{9}$/.test(registerDto.mobileno)) {
      throw new BadRequestException({
        status: 'error',
        message: 'Validation failed',
        errors: {
          mobileno: ['The mobile number must start with 6, 7, 8, or 9'],
        },
      });
    }

    // Validate facilitator if facilitator type is selected
    if (normalizedAssessment === 'facilitator' && registerDto.selectfacilitator) {
      const facilitator = await this.facilitatorModel.findById(
        registerDto.selectfacilitator,
      );
      if (!facilitator || facilitator.status !== '1') {
        throw new BadRequestException({
          status: 'error',
          message: 'Validation failed',
          errors: {
            selectfacilitator: ['The selected facilitator is invalid or inactive'],
          },
        });
      }
    }

    // Generate password
    const generatedPassword = passwordGeneration(12);

    // Hash password
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Create company
    const company = new this.companyModel({
      email: trimCompanyEmail(registerDto.email),
      password: hashedPassword,
      mobile: registerDto.mobileno,
      name: registerDto.company_name,
      account_status: '1',
      verified_status: '0',
    });

    const savedCompany = await company.save();

    // Create project
    const project = new this.companyProjectModel({
      company_id: savedCompany._id,
      process_type: normalizedAssessment === 'facilitator' ? 'f' : 'c',
      next_activities_id: 1,
    });

    const savedProject = await project.save();

    // Log initial CII activity: Milestone 1 completed (registration)
    await this.companyActivityModel.create({
      company_id: savedCompany._id,
      project_id: savedProject._id,
      description: 'Plant registers for GreenCo Rating Online',
      activity_type: 'cii',
      milestone_flow: 1,
      milestone_completed: true,
    });

    // Set next milestone to step 2 (GreenCo Launch & Handholding)
    savedProject.next_activities_id = 2;
    await savedProject.save();

    // Create facilitator assignment if assessment is facilitator
    let facilitatorIdForNotify: string | null = null;
    if (normalizedAssessment === 'facilitator' && registerDto.selectfacilitator) {
      const facilitator = new this.companyFacilitatorModel({
        company_id: savedCompany._id,
        project_id: savedProject._id,
        facilitator_id: new Types.ObjectId(registerDto.selectfacilitator),
      });
      await facilitator.save();
      facilitatorIdForNotify = registerDto.selectfacilitator;
    }

    await this.notificationsService.logWorkflowStepForProject(
      {
        project_id: savedProject._id.toString(),
        company_id: savedCompany._id.toString(),
        company_name: savedCompany.name,
        project_code: savedProject._id.toString(),
        activity: MILESTONE_STEPS[1].name,
        responsibility: MILESTONE_STEPS[1].responsibility,
      },
      'step_completed',
      {
        admin: true,
        company: true,
        facilitatorId: facilitatorIdForNotify,
      },
    );

    // Send registration email in background (non-blocking)
    this.mailService
      .sendCompanyRegistrationEmail(
        savedCompany.email,
        savedCompany.name,
        generatedPassword,
      )
      .catch((error) => {
        console.error('Error sending registration email:', error);
        // Don't fail registration if email fails
      });

    return {
      status: 'success',
      message: 'Company Registered Successfully.',
    };
  }

  async registerThroughFacilitator(registerDto: RegisterThroughFacilitatorDto) {
    const facilitator = await this.resolveFacilitatorForRegistration({
      facilitator_id: registerDto.facilitator_id,
      consultant_id: registerDto.consultant_id,
      facilitator_code: registerDto.facilitator_code,
    });

    const registerPayload: RegisterDto = {
      email: registerDto.email,
      company_name: registerDto.company_name,
      mobileno: registerDto.mobileno,
      assessment: 'facilitator',
      selectfacilitator: String(facilitator._id),
    };

    await this.register(registerPayload);
    return {
      status: 'success',
      message: 'Company Registered Successfully through facilitator.',
      data: {
        facilitator: {
          id: String(facilitator._id),
          name: String((facilitator as any).name || ''),
          consultant_id: String((facilitator as any).consultant_id || ''),
          consultant_code: String((facilitator as any).consultant_id || ''),
          facilitator_code: String((facilitator as any).consultant_id || ''),
          email: String((facilitator as any).email || ''),
          mobile: String((facilitator as any).mobile || ''),
        },
      },
    };
  }

  async login(loginDto: LoginDto) {
    const email = trimCompanyEmail(loginDto.email);
    const password = loginDto.password.trim();

    const company = await this.findCompanyByEmail(email, true);

    if (!company) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'No Account Found! Please enter a valid Email.',
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, company.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException({
        status: 'error',
        message:
          'Your credentials are not valid! Please enter a valid Email and Password.',
      });
    }

    // Check account status
    if (company.account_status !== '1') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account In-Active! Please Contact Greenco Team.',
      });
    }

    // Get project
    const project = await this.companyProjectModel.findOne({
      company_id: company._id,
    });

    // Generate JWT token
    const payload = {
      sub: company._id.toString(),
      email: company.email,
    };

    const token = this.jwtService.sign(payload);

    return {
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: company._id.toString(),
          name: company.name,
          email: company.email,
          mobile: company.mobile,
          account_status: company.account_status,
          verified_status: company.verified_status,
        },
        project: project
          ? {
              id: project._id.toString(),
              name: company.name,
              next_activities_id: project.next_activities_id,
            }
          : null,
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const company = await this.findCompanyByEmail(forgotPasswordDto.email);

    if (!company) {
      throw new BadRequestException({
        status: 'errors',
        errors: {
          email: ["Account doesn't exist. Please Signup to register."],
        },
      });
    }

    if (company.account_status !== '1') {
      throw new BadRequestException({
        status: 'errors',
        errors: {
          email: ['Account In-Active! Please Contact Greenco Team.'],
        },
      });
    }

    // Generate new password
    const newPassword = passwordGeneration(12);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    company.password = hashedPassword;
    await company.save();

    // Send email (must succeed, otherwise return error to frontend)
    try {
      await this.mailService.sendForgotPasswordEmail(
        company.email,
        newPassword,
      );
    } catch (error) {
      console.error('Error sending forgot password email:', error);
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to send email. Please try again later.',
      });
    }

    return {
      status: 'success',
      message: 'Password sent to your email!',
    };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ) {
    const company = await this.companyModel.findById(userId).select('+password');

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.current_password,
      company.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException({
        status: 'error',
        message:
          'Your current password does not matches with the password you provided. Please try again.',
      });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(
      changePasswordDto.new_password,
      company.password,
    );

    if (isSamePassword) {
      throw new BadRequestException({
        status: 'error',
        message:
          'New Password cannot be same as your current password. Please choose a different password.',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(changePasswordDto.new_password, 10);

    // Update password
    company.password = hashedPassword;
    await company.save();

    // Send email notification in background (non-blocking)
    this.mailService
      .sendPasswordUpdateEmail(company.email, company.name)
      .catch((error) => {
        console.error('Error sending password update email:', error);
        // Don't fail if email fails
      });

    return {
      status: 'success',
      message: 'Success! Your new Password has been updated successfully.',
    };
  }

  async getCurrentUser(userId: string) {
    const company = await this.companyModel.findById(userId);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const project = await this.companyProjectModel.findOne({
      company_id: company._id,
    });

    return {
      status: 'success',
      data: {
        id: company._id.toString(),
        name: company.name,
        email: company.email,
        mobile: company.mobile,
        account_status: company.account_status,
        verified_status: company.verified_status,
        project: project
          ? {
              id: project._id.toString(),
              next_activities_id: project.next_activities_id,
              process_type: project.process_type,
            }
          : null,
      },
    };
  }

  async getCompanyListFilters() {
    const [masters, sectors, allStates] = await Promise.all([
      this.registrationMastersService.getRegistrationMasters(),
      this.registrationMastersService.getGroupsAndSectors(),
      this.registrationMastersService.getAllStatesMaster(),
    ]);

    const accountStatuses = [
      { id: '1', value: '1', label: 'Active' },
      { id: '0', value: '0', label: 'In Active' },
    ];
    const verificationStatuses = [
      { id: '1', value: '1', label: 'Verified' },
      { id: '0', value: '0', label: 'Not Verified' },
    ];

    return {
      status: 'success',
      message: 'Company filters fetched successfully',
      data: {
        industries: masters?.data?.industries ?? [],
        entities: masters?.data?.entities ?? [],
        sectors: sectors?.data?.sectors ?? [],
        states: allStates?.data?.states ?? [],
        account_statuses: accountStatuses,
        verification_statuses: verificationStatuses,
      },
    };
  }

  async getCompaniesList(
    searchTermOrQuery?: string | Record<string, any>,
    page?: string,
    limit?: string,
  ) {
    const queryInput =
      typeof searchTermOrQuery === 'string'
        ? { name: searchTermOrQuery, page, limit }
        : (searchTermOrQuery ?? {});

    const name = String(queryInput?.name ?? '').trim();
    const parsedPage = Number.parseInt(
      String(
        queryInput?.page ??
          queryInput?.current_page ??
          queryInput?.currentPage ??
          queryInput?.page_no ??
          queryInput?.pageno ??
          '1',
      ),
      10,
    );
    const parsedLimit = Number.parseInt(
      String(
        queryInput?.limit ??
          queryInput?.per_page ??
          queryInput?.perPage ??
          queryInput?.page_size ??
          queryInput?.pageSize ??
          queryInput?.rowsPerPage ??
          '10',
      ),
      10,
    );
    const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const cappedLimit = Math.min(safeLimit, 100);
    const skip = (safePage - 1) * cappedLimit;

    const hasAdvancedFilters = [
      'company_id',
      'reg_id',
      'project_id',
      'email',
      'mobile',
      'phone',
      'state',
      'industry',
      'sector',
      'entity',
      'turnover_min',
      'turnover_max',
      'fromturnover',
      'toturnover',
      'from_date',
      'to_date',
      'fromDate',
      'toDate',
      'date_from',
      'date_to',
      'account_status',
      'verified_status',
    ].some((k) => String((queryInput as any)?.[k] ?? '').trim() !== '');

    // Backward-compatible autocomplete response (existing behavior).
    const hasAnyPaginationInput =
      queryInput?.page != null ||
      queryInput?.limit != null ||
      queryInput?.current_page != null ||
      queryInput?.currentPage != null ||
      queryInput?.page_no != null ||
      queryInput?.pageno != null ||
      queryInput?.per_page != null ||
      queryInput?.perPage != null ||
      queryInput?.page_size != null ||
      queryInput?.pageSize != null ||
      queryInput?.rowsPerPage != null;

    if (!hasAdvancedFilters && !hasAnyPaginationInput) {
      const query: any = {};
      if (name) {
        query.name = { $regex: name, $options: 'i' };
      }
      const companies = await this.companyModel.find(query).select('name').limit(20);
      return companies.map((company) => ({
        value: company.name,
      }));
    }

    const companyFilter: Record<string, any> = {};
    const phone = String(queryInput?.mobile ?? queryInput?.phone ?? '').trim();
    const email = String(queryInput?.email ?? '').trim();
    const companyObjectIdFilter = String(queryInput?.company_id ?? '').trim();
    const regIdFilter = String(queryInput?.reg_id ?? '').trim();
    const accountStatus = String(queryInput?.account_status ?? '').trim();
    const verifiedStatus = String(queryInput?.verified_status ?? '').trim();

    if (name) companyFilter.name = { $regex: name, $options: 'i' };
    if (phone) companyFilter.mobile = { $regex: phone, $options: 'i' };
    if (email) companyFilter.email = { $regex: email, $options: 'i' };
    if (companyObjectIdFilter) {
      if (Types.ObjectId.isValid(companyObjectIdFilter)) {
        companyFilter._id = new Types.ObjectId(companyObjectIdFilter);
      } else {
        companyFilter._id = new Types.ObjectId();
      }
    }
    if (regIdFilter) companyFilter.reg_id = { $regex: regIdFilter, $options: 'i' };
    if (accountStatus && accountStatus !== 'All') companyFilter.account_status = accountStatus;
    if (verifiedStatus && verifiedStatus !== 'All') companyFilter.verified_status = verifiedStatus;

    const companies = await this.companyModel
      .find(companyFilter)
      .select('_id reg_id name email mobile account_status verified_status createdAt turnover mst_sector_id')
      .sort({ createdAt: -1 })
      .lean();

    if (!companies.length) {
      const emptyPagination = {
        page: safePage,
        limit: cappedLimit,
        total: 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      };
      return {
        status: 'success',
        data: [],
        companies: [],
        rows: [],
        items: [],
        payload: {
          q: '',
          page: safePage,
          limit: cappedLimit,
        },
        summary: {
          total: 0,
          active: 0,
          inactive: 0,
          verified: 0,
          unverified: 0,
        },
        data_table: {
          payload: {
            q: '',
            page: safePage,
            limit: cappedLimit,
          },
          summary: {
            total: 0,
            active: 0,
            inactive: 0,
            verified: 0,
            unverified: 0,
          },
          pagination: emptyPagination,
          items: [],
        },
        pagination: emptyPagination,
        meta: emptyPagination,
        total: 0,
        page: safePage,
        limit: cappedLimit,
      };
    }

    const companyById = new Map(companies.map((c: any) => [String(c._id), c]));
    const companyIds = companies.map((c: any) => c._id);
    const projectIdInput = String(queryInput?.project_id ?? '').trim();
    const projectFilter: Record<string, any> = { company_id: { $in: companyIds } };
    if (projectIdInput) {
      const escaped = projectIdInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      projectFilter.project_id = { $regex: `^${escaped}$`, $options: 'i' };
    }

    const projects = await this.companyProjectModel
      .find(projectFilter)
      .select('_id company_id project_id registration_info createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const rowsUnfiltered = projects.map((project: any) => {
      const company = companyById.get(String(project.company_id));
      const reg = project.registration_info || {};
      const turnoverRaw = String(company?.turnover || reg.turnover || '').trim();
      const turnoverNumeric = Number.parseFloat(turnoverRaw.replace(/[^0-9.]/g, ''));
      return {
        id: String(project._id),
        project_object_id: String(project._id),
        project_id: String(project.project_id || ''),
        project_code: String(project.project_id || ''),
        company_object_id: String(company?._id || ''),
        company_id: String(company?.reg_id || ''),
        reg_id: String(company?.reg_id || ''),
        name: String(company?.name || ''),
        company_name: String(company?.name || ''),
        email: String(company?.email || ''),
        mobile: String(company?.mobile || ''),
        phone: String(company?.mobile || ''),
        state: String(reg.state || reg.state_name || reg.state_id || ''),
        industry: String(reg.industry || reg.industry_name || reg.industry_id || ''),
        sector: String(reg.sector || reg.sector_name || reg.sector_id || company?.mst_sector_id || ''),
        entity: String(reg.entity || reg.entity_name || reg.entity_id || ''),
        turnover: turnoverRaw,
        turnover_numeric: Number.isFinite(turnoverNumeric) ? turnoverNumeric : null,
        account_status: String(company?.account_status || '0'),
        account_status_label: String(company?.account_status || '0') === '1' ? 'Active' : 'In Active',
        verified_status: String(company?.verified_status || '0'),
        verified_status_label: String(company?.verified_status || '0') === '1' ? 'Verified' : 'Not Verified',
        created_at: company?.createdAt || project?.createdAt || null,
      };
    });

    const strContains = (value: unknown, needle: string): boolean =>
      String(value ?? '').toLowerCase().includes(needle.toLowerCase());

    const fromDateInput = String(
      queryInput?.from_date ?? queryInput?.fromDate ?? queryInput?.date_from ?? '',
    ).trim();
    const toDateInput = String(
      queryInput?.to_date ?? queryInput?.toDate ?? queryInput?.date_to ?? '',
    ).trim();
    const fromDate = fromDateInput ? new Date(fromDateInput) : null;
    const toDate = toDateInput ? new Date(toDateInput) : null;
    const hasValidFromDate = !!(fromDate && !Number.isNaN(fromDate.getTime()));
    const hasValidToDate = !!(toDate && !Number.isNaN(toDate.getTime()));
    if (hasValidToDate && toDate) {
      toDate.setHours(23, 59, 59, 999);
    }

    const filteredRows = rowsUnfiltered.filter((r) => {
      if (
        companyObjectIdFilter &&
        String(r.company_object_id || '').trim() !== companyObjectIdFilter
      ) {
        return false;
      }
      if (regIdFilter && !strContains(r.reg_id, regIdFilter)) return false;
      if (
        projectIdInput &&
        String(r.project_id || '').trim().toLowerCase() !== projectIdInput.toLowerCase()
      ) {
        return false;
      }
      if (name && !strContains(r.name, name)) return false;
      if (phone && !strContains(r.mobile, phone)) return false;
      if (email && !strContains(r.email, email)) return false;

      const state = String(queryInput?.state ?? '').trim();
      const industry = String(queryInput?.industry ?? queryInput?.type_of_industry ?? '').trim();
      const sector = String(queryInput?.sector ?? queryInput?.type_of_sector ?? '').trim();
      const entity = String(queryInput?.entity ?? queryInput?.type_of_entity ?? '').trim();
      if (state && state !== 'All' && !strContains(r.state, state)) return false;
      if (industry && industry !== 'All' && !strContains(r.industry, industry)) return false;
      if (sector && sector !== 'All' && !strContains(r.sector, sector)) return false;
      if (entity && entity !== 'All' && !strContains(r.entity, entity)) return false;

      if (accountStatus && accountStatus !== 'All' && r.account_status !== accountStatus) return false;
      if (verifiedStatus && verifiedStatus !== 'All' && r.verified_status !== verifiedStatus) return false;

      const minTurn = Number.parseFloat(
        String(queryInput?.turnover_min ?? queryInput?.fromturnover ?? '').trim(),
      );
      if (Number.isFinite(minTurn)) {
        if (!Number.isFinite(Number(r.turnover_numeric)) || Number(r.turnover_numeric) < minTurn) return false;
      }
      const maxTurn = Number.parseFloat(
        String(queryInput?.turnover_max ?? queryInput?.toturnover ?? '').trim(),
      );
      if (Number.isFinite(maxTurn)) {
        if (!Number.isFinite(Number(r.turnover_numeric)) || Number(r.turnover_numeric) > maxTurn) return false;
      }

      if (hasValidFromDate || hasValidToDate) {
        const rowDate = r.created_at ? new Date(r.created_at) : null;
        if (!rowDate || Number.isNaN(rowDate.getTime())) return false;
        if (hasValidFromDate && fromDate && rowDate < fromDate) return false;
        if (hasValidToDate && toDate && rowDate > toDate) return false;
      }

      return true;
    });

    const pagedRows = filteredRows.slice(skip, skip + cappedLimit);
    const total = filteredRows.length;
    const pagination = {
      page: safePage,
      limit: cappedLimit,
      total,
      total_pages: total > 0 ? Math.ceil(total / cappedLimit) : 1,
      has_next: safePage < (total > 0 ? Math.ceil(total / cappedLimit) : 1),
      has_prev: safePage > 1,
    };

    const summary = {
      total: filteredRows.length,
      active: filteredRows.filter((r) => String(r.account_status || '0') === '1').length,
      inactive: filteredRows.filter((r) => String(r.account_status || '0') !== '1').length,
      verified: filteredRows.filter((r) => String(r.verified_status || '0') === '1').length,
      unverified: filteredRows.filter((r) => String(r.verified_status || '0') !== '1').length,
    };
    const payload = {
      q: '',
      page: safePage,
      limit: cappedLimit,
    };
    const items = pagedRows.map((row: any, index: number) => ({
      sno: skip + index + 1,
      id: row.company_object_id || row.company_id || row.id,
      project_id: row.project_id || '',
      project_code: row.project_code || row.project_id || '',
      name: row.name || '',
      email: row.email || '',
      mobile: row.mobile || '',
      account_status: row.account_status || '0',
      verified_status: row.verified_status || '0',
      created_at: row.created_at || null,
    }));

    return {
      status: 'success',
      data: pagedRows,
      companies: pagedRows,
      rows: pagedRows,
      items,
      payload,
      summary,
      data_table: {
        payload,
        summary,
        pagination,
        items,
      },
      pagination,
      meta: pagination,
      total,
      page: safePage,
      limit: cappedLimit,
    };
  }

  async updateCompanyStatus(
    payload?: Record<string, any>,
  ): Promise<{
    status: 'success';
    message: string;
    data: { id: string; account_status: string };
  }> {
    const input = payload || {};
    const companyIdRaw = String(
      input.company_id ?? input.companyId ?? input.id ?? '',
    ).trim();
    const regIdRaw = String(input.reg_id ?? input.regId ?? '').trim();
    const statusRaw = String(
      input.account_status ?? input.status ?? input.value ?? input.is_active ?? '',
    )
      .trim()
      .toLowerCase();

    if (!statusRaw) {
      throw new BadRequestException({
        status: 'error',
        message: 'Status is required',
      });
    }

    const normalizedStatus =
      ['1', 'active', 'approved', 'true', 'yes'].includes(statusRaw) ? '1' : '0';

    let company: CompanyDocument | null = null;
    if (companyIdRaw && Types.ObjectId.isValid(companyIdRaw)) {
      company = await this.companyModel.findById(companyIdRaw);
    }
    if (!company && regIdRaw) {
      company = await this.companyModel.findOne({ reg_id: regIdRaw });
    }

    if (!company) {
      throw new NotFoundException({
        status: 'error',
        message: 'Company not found',
      });
    }

    company.account_status = normalizedStatus;
    await company.save();

    return {
      status: 'success',
      message: 'Company status updated successfully',
      data: {
        id: String(company._id),
        account_status: String(company.account_status || '0'),
      },
    };
  }
}

