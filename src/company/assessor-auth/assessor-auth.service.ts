import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { passwordGeneration } from '../../helpers/password.helper';
import { MailService } from '../../mail/mail.service';
import { ChangePasswordDto } from '../company-auth/dto/change-password.dto';
import { ForgotPasswordDto } from '../company-auth/dto/forgot-password.dto';
import { Assessor, AssessorDocument } from '../schemas/assessor.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import {
  CompanyAssessor,
  CompanyAssessorDocument,
} from '../schemas/company-assessor.schema';
import { CompanyProject, CompanyProjectDocument } from '../schemas/company-project.schema';
import { AssessorLoginDto } from './dto/assessor-login.dto';
import { AssessorProjectsQueryDto } from './dto/assessor-projects-query.dto';

@Injectable()
export class AssessorAuthService {
  constructor(
    @InjectModel(Assessor.name) private assessorModel: Model<AssessorDocument>,
    @InjectModel(CompanyAssessor.name)
    private companyAssessorModel: Model<CompanyAssessorDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyProject.name) private companyProjectModel: Model<CompanyProjectDocument>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async login(loginDto: AssessorLoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const password = loginDto.password.trim();

    const assessor = await this.assessorModel
      .findOne({ email })
      .select('+password');

    if (!assessor) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'No Account Found! Please enter a valid Email.',
      });
    }

    if (!assessor.password) {
      throw new BadRequestException({
        status: 'error',
        message:
          'No password is set for this account. Ask an administrator to enable credentials or reset access.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, assessor.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        status: 'error',
        message:
          'Your credentials are not valid! Please enter a valid Email and Password.',
      });
    }

    if (String(assessor.status || '') !== '1') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account In-Active! Please Contact Greenco Team.',
      });
    }

    const payload = {
      sub: assessor._id.toString(),
      email: assessor.email,
      role: 'ASSESSOR',
    };

    const token = this.jwtService.sign(payload);

    const assignments = await this.companyAssessorModel
      .find({ assessor_id: assessor._id })
      .select('project_id company_id')
      .lean();

    return {
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: assessor._id.toString(),
          name: assessor.name,
          email: assessor.email,
          mobile: assessor.mobile,
          status: assessor.status,
          approval_status: assessor.approval_status || 'Pending',
          profile_status: assessor.profile_status || 'Incomplete',
        },
        assignments: assignments.map((a) => ({
          project_id: String(a.project_id),
          company_id: String(a.company_id),
        })),
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const email = forgotPasswordDto.email.trim().toLowerCase();
    const assessor = await this.assessorModel.findOne({ email });

    if (!assessor) {
      throw new BadRequestException({
        status: 'errors',
        errors: {
          email: ["Account doesn't exist. Please contact your administrator."],
        },
      });
    }

    if (String(assessor.status || '') !== '1') {
      throw new BadRequestException({
        status: 'errors',
        errors: {
          email: ['Account In-Active! Please Contact Greenco Team.'],
        },
      });
    }

    const newPassword = passwordGeneration(12);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    assessor.password = hashedPassword;
    await assessor.save();

    try {
      await this.mailService.sendAssessorPasswordResetEmail(
        assessor.email,
        assessor.name,
        newPassword,
      );
    } catch (error) {
      console.error('Error sending assessor forgot password email:', error);
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

  async changePassword(assessorId: string, changePasswordDto: ChangePasswordDto) {
    const assessor = await this.assessorModel.findById(assessorId).select('+password');

    if (!assessor) {
      throw new NotFoundException({
        status: 'error',
        message: 'Assessor not found',
      });
    }

    if (!assessor.password) {
      throw new BadRequestException({
        status: 'error',
        message:
          'No password is set for this account. Ask an administrator to enable credentials.',
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.current_password,
      assessor.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException({
        status: 'error',
        message:
          'Your current password does not matches with the password you provided. Please try again.',
      });
    }

    const isSamePassword = await bcrypt.compare(
      changePasswordDto.new_password,
      assessor.password,
    );

    if (isSamePassword) {
      throw new BadRequestException({
        status: 'error',
        message:
          'New Password cannot be same as your current password. Please choose a different password.',
      });
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.new_password, 10);
    assessor.password = hashedPassword;
    await assessor.save();

    this.mailService
      .sendPasswordUpdateEmail(assessor.email, assessor.name)
      .catch((error) => {
        console.error('Error sending assessor password update email:', error);
      });

    return {
      status: 'success',
      message: 'Success! Your new Password has been updated successfully.',
    };
  }

  async listAssignedProjects(
    assessorId: string,
    query?: AssessorProjectsQueryDto,
    rawQuery?: Record<string, unknown>,
  ) {
    const draw = Number.parseInt(String(query?.draw ?? '0'), 10) || 0;
    const dtStart = Number.parseInt(String(query?.start ?? '0'), 10);
    const dtLength = Number.parseInt(String(query?.length ?? '10'), 10);
    const isDataTable = Number.isFinite(dtStart) || Number.isFinite(dtLength) || draw > 0;

    const parsedPage = Number.parseInt(String(query?.page ?? '1'), 10);
    const parsedLimit = Number.parseInt(String(query?.limit ?? (isDataTable ? dtLength : '10')), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limitBase =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : Number.isFinite(dtLength) && dtLength > 0
          ? dtLength
          : 10;
    const limit = Math.min(limitBase, 100);
    const skip = isDataTable
      ? Number.isFinite(dtStart) && dtStart >= 0
        ? dtStart
        : 0
      : (page - 1) * limit;

    const assignments = await this.companyAssessorModel
      .find({ assessor_id: assessorId })
      .sort({ createdAt: -1, _id: -1 })
      .select('project_id company_id createdAt')
      .lean();

    const projectIds = [
      ...new Set(assignments.map((a: any) => String(a.project_id || '')).filter(Boolean)),
    ];

    if (!projectIds.length) {
      if (isDataTable) {
        return {
          draw,
          recordsTotal: 0,
          recordsFiltered: 0,
          data: [],
        };
      }
      return {
        status: 'success',
        message: 'Projects fetched successfully',
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          total_pages: 1,
          has_next_page: false,
          has_prev_page: false,
        },
      };
    }

    const projects = await this.companyProjectModel
      .find({ _id: { $in: projectIds }, project_status: { $ne: 4 } } as any)
      .select('_id company_id project_id next_activities_id registration_info createdAt')
      .lean();

    const projectMap = new Map(projects.map((p: any) => [String(p._id), p]));
    const companyIds = [
      ...new Set(
        projects
          .map((p: any) => String(p.company_id || ''))
          .filter(Boolean),
      ),
    ];
    const companies = await this.companyModel
      .find({ _id: { $in: companyIds } })
      .select('_id reg_id name email mobile account_status verified_status mst_sector_id turnover')
      .lean();
    const companyMap = new Map(companies.map((c: any) => [String(c._id), c]));

    const rows = assignments
      .map((assignment: any) => {
        const project = projectMap.get(String(assignment.project_id || ''));
        if (!project) return null;
        const company = companyMap.get(String(project.company_id || ''));
        if (!company) return null;

        const reg = (project as any).registration_info || {};
        const turnoverRaw = String(company.turnover || reg.turnover || '').trim();
        const turnoverNum = Number.parseFloat(turnoverRaw.replace(/[^0-9.]/g, ''));

        return {
          id: String(project._id),
          assignment_created_at: assignment.createdAt || null,
          project_object_id: String(project._id),
          project_id: String((project as any).project_id || ''),
          company_id: String((company as any).reg_id || ''),
          reg_id: String((company as any).reg_id || ''),
          company_object_id: String(company._id),
          name: String((company as any).name || ''),
          email: String((company as any).email || ''),
          mobile: String((company as any).mobile || ''),
          account_status: String((company as any).account_status || '0'),
          verified_status: String((company as any).verified_status || '0'),
          account_status_label:
            String((company as any).account_status || '0') === '1'
              ? 'Active'
              : 'In Active',
          state: String(reg.state || reg.state_name || reg.state_id || ''),
          industry: String(reg.industry || reg.industry_name || reg.industry_id || ''),
          sector: String(reg.sector || reg.sector_name || (company as any).mst_sector_id || ''),
          entity: String(reg.entity || reg.entity_name || reg.entity_id || ''),
          turnover: turnoverRaw,
          turnover_numeric: Number.isFinite(turnoverNum) ? turnoverNum : null,
          next_activities_id: Number((project as any).next_activities_id || 0),
          quickview_project_id: String(project._id),
        };
      })
      .filter(Boolean) as Array<Record<string, any>>;

    const strContains = (value: unknown, needle: string): boolean =>
      String(value ?? '').toLowerCase().includes(needle.toLowerCase());

    const searchValue = String(
      (query as any)?.search ??
        (rawQuery as any)?.['search[value]'] ??
        (rawQuery as any)?.search?.value ??
        '',
    ).trim();

    const filtered = rows.filter((r) => {
      const companyIdFilter = String(query?.company_id || query?.reg_id || '').trim();
      if (companyIdFilter && !strContains(r.company_id, companyIdFilter))
        return false;
      if (query?.project_id?.trim() && !strContains(r.project_id, query.project_id.trim()))
        return false;
      if (query?.name?.trim() && !strContains(r.name, query.name.trim())) return false;
      if (query?.mobile?.trim() && !strContains(r.mobile, query.mobile.trim())) return false;
      if (query?.email?.trim() && !strContains(r.email, query.email.trim())) return false;

      const statusInput = String(query?.account_status || query?.status || '').trim();
      if (statusInput && statusInput !== 'All') {
        const statusFilter = statusInput.toLowerCase();
        if (
          ![
            r.account_status.toLowerCase(),
            r.account_status_label.toLowerCase(),
            r.account_status === '1' ? 'active' : 'in active',
            r.account_status === '1' ? '1' : '0',
          ].includes(statusFilter)
        ) {
          return false;
        }
      }

      if (query?.state?.trim() && query.state !== 'All' && !strContains(r.state, query.state.trim()))
        return false;
      if (
        query?.industry?.trim() &&
        query.industry !== 'All' &&
        !strContains(r.industry, query.industry.trim())
      )
        return false;
      if (query?.sector?.trim() && query.sector !== 'All' && !strContains(r.sector, query.sector.trim()))
        return false;
      if (query?.entity?.trim() && query.entity !== 'All' && !strContains(r.entity, query.entity.trim()))
        return false;

      const minTurn = Number.parseFloat(
        String(query?.turnover_min || query?.fromturnover || '').trim(),
      );
      if (Number.isFinite(minTurn)) {
        if (!Number.isFinite(r.turnover_numeric) || Number(r.turnover_numeric) < minTurn) return false;
      }
      const maxTurn = Number.parseFloat(
        String(query?.turnover_max || query?.toturnover || '').trim(),
      );
      if (Number.isFinite(maxTurn)) {
        if (!Number.isFinite(r.turnover_numeric) || Number(r.turnover_numeric) > maxTurn) return false;
      }

      if (searchValue) {
        const combined = [
          r.company_id,
          r.project_id,
          r.name,
          r.email,
          r.mobile,
          r.account_status_label,
          r.state,
          r.industry,
          r.sector,
          r.entity,
          r.turnover,
        ]
          .join(' ')
          .toLowerCase();
        if (!combined.includes(searchValue.toLowerCase())) return false;
      }

      return true;
    });

    const total = rows.length;
    const filteredTotal = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    if (isDataTable) {
      return {
        draw,
        recordsTotal: total,
        recordsFiltered: filteredTotal,
        data: paginated,
      };
    }

    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit));
    return {
      status: 'success',
      message: 'Projects fetched successfully',
      data: paginated,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_prev_page: page > 1,
      },
    };
  }
}
