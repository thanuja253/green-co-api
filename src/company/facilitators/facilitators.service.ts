import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { Facilitator, FacilitatorDocument } from '../schemas/facilitator.schema';
import { CreateFacilitatorProfileDto } from './dto/create-facilitator-profile.dto';
import { ListFacilitatorsQueryDto } from './dto/list-facilitators-query.dto';
import { lookupIfscDetails } from '../../common/ifsc-lookup.util';
import { passwordGeneration } from '../../helpers/password.helper';
import { MailService } from '../../mail/mail.service';
import {
  FACILITATOR_PROFILE_DOCUMENT_KEYS,
  FACILITATOR_REVIEW_REQUIRED_DOCUMENT_KEYS,
  isFacilitatorProfileDocumentKey,
} from '../facilitator-auth/facilitator-profile-document-keys';

@Injectable()
export class FacilitatorsService {
  constructor(
    @InjectModel(Facilitator.name)
    private readonly facilitatorModel: Model<FacilitatorDocument>,
    private readonly mailService: MailService,
  ) {}

  private toBool(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y';
  }

  private toPublicFilePath(path?: string): string {
    const raw = String(path || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `/${raw.replace(/^\/+/, '')}`;
  }

  private toAbsoluteFileUrl(path?: string): string {
    const normalized = this.toPublicFilePath(path);
    if (!normalized) return '';
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
    const baseUrl = (process.env.API_BASE_URL || 'https://green-co-api-admin.onrender.com').replace(/\/+$/, '');
    return `${baseUrl}${normalized}`;
  }

  private mapFacilitatorResponse(a: any) {
    const reviewApprovals = this.buildReviewRequiredApprovalsMap(a);
    const reviewValues = Object.values(reviewApprovals);
    const derivedApprovalStatus =
      reviewValues.length === 0
        ? String(a.approval_status || 'Pending')
        : reviewValues.some((v) => v.status === 'Rejected')
          ? 'Rejected'
          : reviewValues.some((v) => v.status === 'Pending')
            ? 'Pending'
            : 'Approved';
    const derivedProfileStatus =
      reviewValues.length > 0 && reviewValues.every((v) => v.status === 'Approved')
        ? 'Complete'
        : 'Incomplete';

    return {
      id: a._id?.toString?.() || a._id,
      consultant_id: a.consultant_id || '',
      name: a.name || '',
      email: a.email || '',
      mobile: a.mobile || '',
      status: a.status ?? '1',
      account_status: a.status ?? '1',
      industry_category: a.industry_category || '',
      alternate_mobile: a.alternate_mobile || '',
      address_line_1: a.address_line_1 || '',
      address_line_2: a.address_line_2 || '',
      pincode: a.pincode || '',
      city: a.city || '',
      state: a.state || '',
      pan_number: a.pan_number || '',
      enrollment_date: a.enrollment_date || '',
      gst_registered: !!a.gst_registered,
      gst_number: a.gst_number || '',
      lead_assessor: !!a.lead_assessor,
      assessor_grade: a.assessor_grade || '',
      emergency_contact_name: a.emergency_contact_name || '',
      emergency_mobile: a.emergency_mobile || '',
      emergency_address_line_1: a.emergency_address_line_1 || '',
      emergency_address_line_2: a.emergency_address_line_2 || '',
      emergency_city: a.emergency_city || '',
      emergency_state: a.emergency_state || '',
      emergency_pincode: a.emergency_pincode || '',
      bank_name: a.bank_name || '',
      account_number: a.account_number || '',
      branch_name: a.branch_name || '',
      ifsc_code: a.ifsc_code || '',
      biodata: this.toPublicFilePath(a.biodata),
      vendor_registration_form: this.toPublicFilePath(a.vendor_registration_form),
      non_disclosure_agreement: this.toPublicFilePath(a.non_disclosure_agreement),
      health_declaration: this.toPublicFilePath(a.health_declaration),
      gst_declaration: this.toPublicFilePath(a.gst_declaration),
      pan_card: this.toPublicFilePath(a.pan_card),
      cancelled_cheque: this.toPublicFilePath(a.cancelled_cheque),
      profile_image: this.toPublicFilePath(a.profile_image),
      biodata_url: this.toAbsoluteFileUrl(a.biodata),
      vendor_registration_form_url: this.toAbsoluteFileUrl(a.vendor_registration_form),
      non_disclosure_agreement_url: this.toAbsoluteFileUrl(a.non_disclosure_agreement),
      health_declaration_url: this.toAbsoluteFileUrl(a.health_declaration),
      gst_declaration_url: this.toAbsoluteFileUrl(a.gst_declaration),
      pan_card_url: this.toAbsoluteFileUrl(a.pan_card),
      cancelled_cheque_url: this.toAbsoluteFileUrl(a.cancelled_cheque),
      profile_image_url: this.toAbsoluteFileUrl(a.profile_image),
      approval_status: derivedApprovalStatus,
      approval_remarks: a.approval_remarks || '',
      profile_status: derivedProfileStatus,
      document_approvals: this.buildDocumentApprovalsMap(a),
    };
  }

  private getFacilitatorDocumentPath(source: any, key: string): string {
    if (key === 'brief_profile_individual') {
      return String(source?.brief_profile_individual || source?.biodata || '').trim();
    }
    return String(source?.[key] || '').trim();
  }

  private buildReviewRequiredApprovalsMap(source: any): Record<string, { status: string; remarks: string }> {
    const stored = (source?.document_approvals || {}) as Record<string, { status?: string; remarks?: string }>;
    const result: Record<string, { status: string; remarks: string }> = {};
    for (const key of FACILITATOR_REVIEW_REQUIRED_DOCUMENT_KEYS) {
      const pathVal = this.getFacilitatorDocumentPath(source, key);
      if (!pathVal) continue;
      const existing = stored[key] || {};
      result[key] = {
        status: String(existing.status || 'Pending'),
        remarks: String(existing.remarks ?? '').trim(),
      };
    }
    return result;
  }

  private buildDocumentApprovalsMap(source: any): Record<string, { status: string; remarks: string }> {
    const stored = (source?.document_approvals || {}) as Record<string, { status?: string; remarks?: string }>;
    const result: Record<string, { status: string; remarks: string }> = {};
    for (const key of FACILITATOR_PROFILE_DOCUMENT_KEYS) {
      const pathVal = this.getFacilitatorDocumentPath(source, key);
      if (!pathVal) continue;
      const existing = stored[key] || {};
      result[key] = {
        status: String(existing.status || 'Pending'),
        remarks: String(existing.remarks ?? '').trim(),
      };
    }
    return result;
  }

  private async getNextConsultantId(): Promise<string> {
    const maxRows = await this.facilitatorModel.aggregate([
      { $match: { consultant_id: { $regex: '^F\\d+$', $options: 'i' } } },
      {
        $project: {
          numeric: {
            $toInt: {
              $substrCP: [{ $toUpper: '$consultant_id' }, 1, 10],
            },
          },
        },
      },
      { $sort: { numeric: -1 } },
      { $limit: 1 },
    ]);
    const currentNum = Number((maxRows?.[0] as any)?.numeric ?? 0);
    const next = Number.isFinite(currentNum) && currentNum > 0 ? currentNum + 1 : 1;
    return `F${String(next).padStart(5, '0')}`;
  }

  private async deriveBankDetails(
    ifscCodeRaw: unknown,
    fallbackBankName = '',
    fallbackBranchName = '',
  ): Promise<{ ifsc_code: string; bank_name: string; branch_name: string }> {
    const ifscCode = String(ifscCodeRaw || '').trim().toUpperCase();
    if (!ifscCode) {
      return {
        ifsc_code: '',
        bank_name: String(fallbackBankName || '').trim(),
        branch_name: String(fallbackBranchName || '').trim(),
      };
    }

    const lookedUp = await lookupIfscDetails(ifscCode);
    return {
      ifsc_code: lookedUp.ifsc_code,
      bank_name: lookedUp.bank_name || String(fallbackBankName || '').trim(),
      branch_name: lookedUp.branch_name || String(fallbackBranchName || '').trim(),
    };
  }

  async getFacilitators(): Promise<{
    status: 'success';
    message: string;
    data: Array<{ id: string; name: string }>;
  }> {
    try {
      const facilitators = await this.facilitatorModel.find({ status: '1' }).select('_id name').sort({ name: 1 });
      const data = facilitators.map((facilitator) => ({
        id: facilitator._id.toString(),
        name: facilitator.name,
      }));
      return {
        status: 'success',
        message: 'Facilitators loaded successfully',
        data,
      };
    } catch (error) {
      console.error('Error fetching facilitators:', error);
      throw new InternalServerErrorException({
        status: 'error',
        message: 'Failed to load facilitators',
      });
    }
  }

  async createFacilitatorAdminFlow(name: string, email: string, mobile: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!mobile || !mobile.trim()) {
      throw new BadRequestException({ status: 'validations', errors: { mobile: ['mobile is required.'] } });
    }
    const existing = await this.facilitatorModel.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      throw new BadRequestException({
        status: 'validations',
        errors: { email: ['Facilitator with this email already exists.'] },
      });
    }
    const tempPassword = passwordGeneration(12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const facilitator = await this.facilitatorModel.create({
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      consultant_id: await this.getNextConsultantId(),
      status: '1',
      approval_status: 'Pending',
      profile_status: 'Incomplete',
      password: passwordHash,
    });

    let credentialsEmailSent = false;
    let emailErrorMessage: string | null = null;
    try {
      await this.mailService.sendFacilitatorCredentialsEmail(
        normalizedEmail,
        name.trim(),
        tempPassword,
      );
      credentialsEmailSent = true;
    } catch (error) {
      const rawMessage =
        String((error as any)?.message || '').trim() ||
        'Failed to send credentials email. Please retry later.';
      const lower = rawMessage.toLowerCase();
      const looksLikeResendSandbox =
        (lower.includes('resend api error 403') || lower.includes('validation_error')) &&
        (lower.includes('testing emails') || lower.includes('own email address'));
      emailErrorMessage = looksLikeResendSandbox
        ? 'Credentials email blocked by Resend sandbox mode. Verify a sending domain and use a verified from-address to send to external recipients.'
        : rawMessage;
    }

    return {
      status: 'success',
      message: credentialsEmailSent
        ? 'Facilitator created. Credentials sent to email.'
        : 'Facilitator created, but credentials email could not be sent.',
      data: {
        id: facilitator._id.toString(),
        consultant_id: (facilitator as any).consultant_id || '',
        name: facilitator.name,
        email: facilitator.email,
        mobile: (facilitator as any).mobile,
        status: facilitator.status,
        credentials_email_sent: credentialsEmailSent,
        ...(emailErrorMessage ? { credentials_email_error: emailErrorMessage } : {}),
      },
    };
  }

  async listFacilitatorsAdminFlow(query?: ListFacilitatorsQueryDto) {
    const parsedPage = Number.parseInt(String(query?.page ?? '1'), 10);
    const parsedLimit = Number.parseInt(String(query?.limit ?? '10'), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;
    const filter: Record<string, any> = {};
    if (query?.name?.trim()) filter.name = { $regex: query.name.trim(), $options: 'i' };
    const phone = query?.phone?.trim() || query?.mobile?.trim();
    if (phone) filter.mobile = { $regex: phone, $options: 'i' };
    if (query?.email?.trim()) filter.email = { $regex: query.email.trim(), $options: 'i' };
    if (query?.industry_category?.trim() && query.industry_category !== 'All') filter.industry_category = query.industry_category.trim();
    if (query?.state?.trim() && query.state !== 'All') filter.state = query.state.trim();
    if (query?.account_status?.trim() && query.account_status !== 'All') filter.status = query.account_status.trim();
    if (query?.approval_status?.trim() && query.approval_status !== 'All') filter.approval_status = query.approval_status.trim();
    if (query?.profile_status?.trim() && query.profile_status !== 'All') filter.profile_status = query.profile_status.trim();

    const [rows, total] = await Promise.all([
      this.facilitatorModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cappedLimit).lean(),
      this.facilitatorModel.countDocuments(filter),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / cappedLimit));
    return {
      status: 'success',
      message: 'Facilitators fetched successfully',
      data: rows.map((r: any) => this.mapFacilitatorResponse(r)),
      pagination: {
        page,
        limit: cappedLimit,
        total,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_prev_page: page > 1,
      },
      applied_filters: {
        name: query?.name ?? '',
        phone: query?.phone ?? query?.mobile ?? '',
        email: query?.email ?? '',
        industry_category: query?.industry_category ?? '',
        state: query?.state ?? '',
        account_status: query?.account_status ?? '',
        approval_status: query?.approval_status ?? '',
        profile_status: query?.profile_status ?? '',
      },
    };
  }

  async getFacilitatorAdminFlow(facilitatorId: string) {
    const row = await this.facilitatorModel.findById(facilitatorId).lean();
    if (!row) throw new NotFoundException({ status: 'error', message: 'Facilitator not found' });
    return {
      status: 'success',
      message: 'Facilitator fetched successfully',
      data: this.mapFacilitatorResponse(row),
    };
  }

  async createFacilitatorProfileAdminFlow(
    dto: CreateFacilitatorProfileDto,
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.facilitatorModel.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      throw new BadRequestException({ status: 'validations', errors: { email: ['Facilitator with this email already exists.'] } });
    }
    const filePath = (f?: Express.Multer.File[]) => (f?.[0] ? `uploads/facilitators/${f[0].filename}` : '');
    const bankInfo = await this.deriveBankDetails(dto.ifsc_code, dto.bank_name, dto.branch_name);
    const row = await this.facilitatorModel.create({
      name: dto.name.trim(),
      email: normalizedEmail,
      mobile: (dto.mobile || '').trim(),
      consultant_id: String(dto.consultant_id || '').trim() || await this.getNextConsultantId(),
      industry_category: dto.organization || dto.industry_category || '',
      alternate_mobile: dto.alternate_mobile || '',
      address_line_1: dto.address_line_1 || '',
      address_line_2: dto.address_line_2 || '',
      pincode: dto.pincode || '',
      city: dto.city || '',
      state: dto.state || '',
      pan_number: dto.pan_number || '',
      enrollment_date: dto.enrollment_date || '',
      gst_registered: this.toBool(dto.gst_registered),
      gst_number: dto.gst_number || '',
      lead_assessor: this.toBool(dto.lead_assessor),
      assessor_grade: dto.assessor_grade || '',
      emergency_contact_name: dto.emergency_contact_name || '',
      emergency_mobile: dto.emergency_mobile || '',
      emergency_address_line_1: dto.emergency_address_line_1 || '',
      emergency_address_line_2: dto.emergency_address_line_2 || '',
      emergency_city: dto.emergency_city || '',
      emergency_state: dto.emergency_state || '',
      emergency_pincode: dto.emergency_pincode || '',
      bank_name: bankInfo.bank_name || '',
      account_number: dto.account_number || '',
      branch_name: bankInfo.branch_name || '',
      ifsc_code: bankInfo.ifsc_code || '',
      educational_qualification: dto.educational_qualification || '',
      additional_professional_qualification: dto.additional_professional_qualification || '',
      total_years_professional_experience: dto.total_years_professional_experience || '',
      years_env_sustainability: dto.years_env_sustainability || '',
      areas_of_specialization: dto.areas_of_specialization || '',
      company_website: dto.company_website_details || dto.company_website || '',
      linkedin_profile: dto.linkedin_profile || '',
      biodata: filePath(files?.biodata),
      vendor_registration_form: filePath(files?.vendor_registration_form),
      non_disclosure_agreement: filePath(files?.non_disclosure_agreement),
      health_declaration: filePath(files?.health_declaration),
      gst_declaration: filePath(files?.gst_declaration),
      pan_card: filePath(files?.pan_card),
      cancelled_cheque: filePath(files?.cancelled_cheque),
      profile_image: filePath(files?.profile_image),
      status: (dto.status || '1').toString(),
      approval_status: 'Approved',
      approval_remarks: '',
      profile_status: 'Complete',
      document_approvals: {
        ...(filePath(files?.profile_image) ? { profile_image: { status: 'Approved', remarks: '' } } : {}),
        ...(filePath(files?.biodata) ? { biodata: { status: 'Approved', remarks: '' } } : {}),
        ...(filePath(files?.vendor_registration_form)
          ? { vendor_registration_form: { status: 'Approved', remarks: '' } }
          : {}),
        ...(filePath(files?.non_disclosure_agreement)
          ? { non_disclosure_agreement: { status: 'Approved', remarks: '' } }
          : {}),
        ...(filePath(files?.health_declaration)
          ? { health_declaration: { status: 'Approved', remarks: '' } }
          : {}),
        ...(filePath(files?.gst_declaration)
          ? { gst_declaration: { status: 'Approved', remarks: '' } }
          : {}),
        ...(filePath(files?.pan_card) ? { pan_card: { status: 'Approved', remarks: '' } } : {}),
        ...(filePath(files?.cancelled_cheque)
          ? { cancelled_cheque: { status: 'Approved', remarks: '' } }
          : {}),
      },
    });
    return {
      status: 'success',
      message: 'Facilitator profile created successfully',
      data: this.mapFacilitatorResponse(row.toObject()),
    };
  }

  async updateFacilitatorProfileAdminFlow(
    facilitatorId: string,
    dto: CreateFacilitatorProfileDto,
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ) {
    const row = await this.facilitatorModel.findById(facilitatorId);
    if (!row) throw new NotFoundException({ status: 'error', message: 'Facilitator not found' });

    const filePath = (f?: Express.Multer.File[]) => (f?.[0] ? `uploads/facilitators/${f[0].filename}` : undefined);
    const bankInfo = await this.deriveBankDetails(
      dto.ifsc_code ?? row.ifsc_code,
      dto.bank_name ?? row.bank_name,
      dto.branch_name ?? row.branch_name,
    );
    row.name = (dto.name || row.name || '').trim();
    row.email = (dto.email || row.email || '').trim().toLowerCase();
    row.mobile = (dto.mobile || row.mobile || '').trim();
    row.consultant_id = (dto.consultant_id || row.consultant_id || '').trim();
    row.industry_category = dto.organization ?? dto.industry_category ?? row.industry_category;
    row.alternate_mobile = dto.alternate_mobile ?? row.alternate_mobile;
    row.address_line_1 = dto.address_line_1 ?? row.address_line_1;
    row.address_line_2 = dto.address_line_2 ?? row.address_line_2;
    row.pincode = dto.pincode ?? row.pincode;
    row.city = dto.city ?? row.city;
    row.state = dto.state ?? row.state;
    row.pan_number = dto.pan_number ?? row.pan_number;
    row.enrollment_date = dto.enrollment_date ?? row.enrollment_date;
    row.gst_registered = dto.gst_registered !== undefined ? this.toBool(dto.gst_registered) : row.gst_registered;
    row.gst_number = dto.gst_number ?? row.gst_number;
    row.lead_assessor = dto.lead_assessor !== undefined ? this.toBool(dto.lead_assessor) : row.lead_assessor;
    row.assessor_grade = dto.assessor_grade ?? row.assessor_grade;
    row.emergency_contact_name = dto.emergency_contact_name ?? row.emergency_contact_name;
    row.emergency_mobile = dto.emergency_mobile ?? row.emergency_mobile;
    row.emergency_address_line_1 = dto.emergency_address_line_1 ?? row.emergency_address_line_1;
    row.emergency_address_line_2 = dto.emergency_address_line_2 ?? row.emergency_address_line_2;
    row.emergency_city = dto.emergency_city ?? row.emergency_city;
    row.emergency_state = dto.emergency_state ?? row.emergency_state;
    row.emergency_pincode = dto.emergency_pincode ?? row.emergency_pincode;
    row.bank_name = bankInfo.bank_name;
    row.account_number = dto.account_number ?? row.account_number;
    row.branch_name = bankInfo.branch_name;
    row.ifsc_code = bankInfo.ifsc_code;
    (row as any).educational_qualification =
      dto.educational_qualification ?? (row as any).educational_qualification;
    (row as any).additional_professional_qualification =
      dto.additional_professional_qualification ?? (row as any).additional_professional_qualification;
    (row as any).total_years_professional_experience =
      dto.total_years_professional_experience ?? (row as any).total_years_professional_experience;
    (row as any).years_env_sustainability =
      dto.years_env_sustainability ?? (row as any).years_env_sustainability;
    (row as any).areas_of_specialization =
      dto.areas_of_specialization ?? (row as any).areas_of_specialization;
    (row as any).company_website =
      dto.company_website_details ?? dto.company_website ?? (row as any).company_website;
    (row as any).linkedin_profile = dto.linkedin_profile ?? (row as any).linkedin_profile;
    row.status = (dto.status || row.status || '1').toString();
    row.approval_status = 'Approved';
    row.approval_remarks = '';
    row.profile_image = filePath(files?.profile_image) ?? row.profile_image;
    row.biodata = filePath(files?.biodata) ?? row.biodata;
    row.vendor_registration_form = filePath(files?.vendor_registration_form) ?? row.vendor_registration_form;
    row.non_disclosure_agreement = filePath(files?.non_disclosure_agreement) ?? row.non_disclosure_agreement;
    row.health_declaration = filePath(files?.health_declaration) ?? row.health_declaration;
    row.gst_declaration = filePath(files?.gst_declaration) ?? row.gst_declaration;
    row.pan_card = filePath(files?.pan_card) ?? row.pan_card;
    row.cancelled_cheque = filePath(files?.cancelled_cheque) ?? row.cancelled_cheque;
    const prev = ((row as any).document_approvals || {}) as Record<
      string,
      { status?: string; remarks?: string }
    >;
    const docApprovals: Record<string, { status: string; remarks: string }> = {};
    for (const k of Object.keys(prev)) {
      const e = prev[k];
      docApprovals[k] = {
        status: String(e?.status || 'Pending'),
        remarks: String(e?.remarks ?? '').trim(),
      };
    }
    if (files?.profile_image?.[0]) docApprovals.profile_image = { status: 'Approved', remarks: '' };
    if (files?.biodata?.[0]) docApprovals.biodata = { status: 'Approved', remarks: '' };
    if (files?.vendor_registration_form?.[0]) docApprovals.vendor_registration_form = { status: 'Approved', remarks: '' };
    if (files?.non_disclosure_agreement?.[0]) docApprovals.non_disclosure_agreement = { status: 'Approved', remarks: '' };
    if (files?.health_declaration?.[0]) docApprovals.health_declaration = { status: 'Approved', remarks: '' };
    if (files?.gst_declaration?.[0]) docApprovals.gst_declaration = { status: 'Approved', remarks: '' };
    if (files?.pan_card?.[0]) docApprovals.pan_card = { status: 'Approved', remarks: '' };
    if (files?.cancelled_cheque?.[0]) docApprovals.cancelled_cheque = { status: 'Approved', remarks: '' };
    (row as any).document_approvals = docApprovals;
    row.profile_status = 'Complete';
    await row.save();

    return {
      status: 'success',
      message: 'Facilitator profile updated successfully',
      data: this.mapFacilitatorResponse(row.toObject()),
    };
  }

  async updateFacilitatorApprovalStatusAdminFlow(
    facilitatorId: string,
    statusInput?: string,
    remarks?: string,
  ) {
    const row = await this.facilitatorModel.findById(facilitatorId);
    if (!row) {
      throw new NotFoundException({ status: 'error', message: 'Facilitator not found' });
    }

    const normalized = String(statusInput || '')
      .trim()
      .toLowerCase();

    let approvalStatus = 'Pending';
    if (['1', 'approved', 'approve', 'yes'].includes(normalized)) {
      approvalStatus = 'Approved';
    } else if (['2', 'rejected', 'reject', 'disapproved', 'no'].includes(normalized)) {
      approvalStatus = 'Rejected';
    } else if (normalized) {
      approvalStatus = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    const remarksTrim = String(remarks || '').trim();

    row.approval_status = approvalStatus;
    row.approval_remarks = remarksTrim;
    if (approvalStatus === 'Approved' || approvalStatus === 'Rejected') {
      const prev = ((row as any).document_approvals || {}) as Record<
        string,
        { status?: string; remarks?: string }
      >;
      const docApprovals: Record<string, { status: string; remarks: string }> = {};
      for (const k of Object.keys(prev)) {
        const e = prev[k];
        docApprovals[k] = {
          status: String(e?.status || 'Pending'),
          remarks: String(e?.remarks ?? '').trim(),
        };
      }
      for (const key of FACILITATOR_PROFILE_DOCUMENT_KEYS) {
        const pathVal = this.getFacilitatorDocumentPath(row.toObject(), key);
        if (!pathVal) continue;
        docApprovals[key] = {
          status: approvalStatus,
          remarks: approvalStatus === 'Rejected' ? remarksTrim : '',
        };
      }
      (row as any).document_approvals = docApprovals;
    }
    if (approvalStatus === 'Approved') {
      row.profile_status = 'Complete';
    } else if (approvalStatus === 'Rejected' || approvalStatus === 'Pending') {
      row.profile_status = 'Incomplete';
    }
    await row.save();

    return {
      status: 'success',
      message: `Facilitator ${approvalStatus.toLowerCase()} successfully`,
      data: this.mapFacilitatorResponse(row.toObject()),
    };
  }

  async updateFacilitatorDocumentApprovalAdminFlow(
    facilitatorId: string,
    documentKey: string,
    status: 'Approved' | 'Rejected' | 'Pending',
    remarks?: string,
  ) {
    const remarksTrim = String(remarks ?? '').trim();
    if (status === 'Rejected' && !remarksTrim) {
      throw new BadRequestException({
        status: 'validations',
        errors: { remarks: ['remarks is required when rejecting a document.'] },
      });
    }

    if (!isFacilitatorProfileDocumentKey(documentKey)) {
      throw new BadRequestException({
        status: 'error',
        message: `Invalid document key. Allowed: ${FACILITATOR_PROFILE_DOCUMENT_KEYS.join(', ')}`,
      });
    }
    const row = await this.facilitatorModel.findById(facilitatorId);
    if (!row) throw new NotFoundException({ status: 'error', message: 'Facilitator not found' });
    const pathVal = this.getFacilitatorDocumentPath(row.toObject(), documentKey);
    if (!pathVal) {
      throw new BadRequestException({
        status: 'error',
        message: `No file uploaded for document "${documentKey}"`,
      });
    }
    const prev = ((row as any).document_approvals || {}) as Record<
      string,
      { status?: string; remarks?: string }
    >;
    const docApprovals: Record<string, { status: string; remarks: string }> = {};
    for (const k of Object.keys(prev)) {
      const e = prev[k];
      docApprovals[k] = {
        status: String(e?.status || 'Pending'),
        remarks: String(e?.remarks ?? '').trim(),
      };
    }
    docApprovals[documentKey] = {
      status,
      remarks: remarksTrim,
    };
    (row as any).document_approvals = docApprovals;

    const required = this.buildReviewRequiredApprovalsMap({
      ...row.toObject(),
      document_approvals: docApprovals,
    });
    const values = Object.values(required);
    const anyRejected = values.some((v) => v.status === 'Rejected');
    const anyPending = values.some((v) => v.status === 'Pending');
    const allApproved = values.length > 0 && values.every((v) => v.status === 'Approved');
    if (anyRejected) {
      row.approval_status = 'Rejected';
      row.profile_status = 'Incomplete';
    } else if (anyPending) {
      row.approval_status = 'Pending';
      row.approval_remarks = '';
      row.profile_status = 'Incomplete';
    } else if (allApproved) {
      row.approval_status = 'Approved';
      row.approval_remarks = '';
      row.profile_status = 'Complete';
    }

    await row.save();
    return {
      status: 'success',
      message: `Document ${documentKey} marked as ${status}`,
      data: this.mapFacilitatorResponse(row.toObject()),
    };
  }
}

