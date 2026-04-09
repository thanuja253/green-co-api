import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Facilitator, FacilitatorDocument } from '../schemas/facilitator.schema';
import { CreateFacilitatorProfileDto } from './dto/create-facilitator-profile.dto';
import { ListFacilitatorsQueryDto } from './dto/list-facilitators-query.dto';

@Injectable()
export class FacilitatorsService {
  constructor(
    @InjectModel(Facilitator.name)
    private readonly facilitatorModel: Model<FacilitatorDocument>,
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
    return {
      id: a._id?.toString?.() || a._id,
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
      approval_status: a.approval_status || 'Pending',
      approval_remarks: a.approval_remarks || '',
      profile_status: a.profile_status || 'Incomplete',
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
    const facilitator = await this.facilitatorModel.create({
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      status: '1',
      approval_status: 'Pending',
      profile_status: 'Incomplete',
    });
    return {
      status: 'success',
      message: 'Facilitator added successfully',
      data: {
        id: facilitator._id.toString(),
        name: facilitator.name,
        email: facilitator.email,
        mobile: (facilitator as any).mobile,
        status: facilitator.status,
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
    const row = await this.facilitatorModel.create({
      name: dto.name.trim(),
      email: normalizedEmail,
      mobile: (dto.mobile || '').trim(),
      industry_category: dto.industry_category || '',
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
      bank_name: dto.bank_name || '',
      account_number: dto.account_number || '',
      branch_name: dto.branch_name || '',
      ifsc_code: dto.ifsc_code || '',
      biodata: filePath(files?.biodata),
      vendor_registration_form: filePath(files?.vendor_registration_form),
      non_disclosure_agreement: filePath(files?.non_disclosure_agreement),
      health_declaration: filePath(files?.health_declaration),
      gst_declaration: filePath(files?.gst_declaration),
      pan_card: filePath(files?.pan_card),
      cancelled_cheque: filePath(files?.cancelled_cheque),
      profile_image: filePath(files?.profile_image),
      status: (dto.status || '1').toString(),
      approval_status: 'Pending',
      profile_status: 'Complete',
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
    row.name = (dto.name || row.name || '').trim();
    row.email = (dto.email || row.email || '').trim().toLowerCase();
    row.mobile = (dto.mobile || row.mobile || '').trim();
    row.industry_category = dto.industry_category ?? row.industry_category;
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
    row.bank_name = dto.bank_name ?? row.bank_name;
    row.account_number = dto.account_number ?? row.account_number;
    row.branch_name = dto.branch_name ?? row.branch_name;
    row.ifsc_code = dto.ifsc_code ?? row.ifsc_code;
    row.status = (dto.status || row.status || '1').toString();
    row.profile_image = filePath(files?.profile_image) ?? row.profile_image;
    row.biodata = filePath(files?.biodata) ?? row.biodata;
    row.vendor_registration_form = filePath(files?.vendor_registration_form) ?? row.vendor_registration_form;
    row.non_disclosure_agreement = filePath(files?.non_disclosure_agreement) ?? row.non_disclosure_agreement;
    row.health_declaration = filePath(files?.health_declaration) ?? row.health_declaration;
    row.gst_declaration = filePath(files?.gst_declaration) ?? row.gst_declaration;
    row.pan_card = filePath(files?.pan_card) ?? row.pan_card;
    row.cancelled_cheque = filePath(files?.cancelled_cheque) ?? row.cancelled_cheque;
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

    row.approval_status = approvalStatus;
    row.approval_remarks = (remarks || '').trim();
    await row.save();

    return {
      status: 'success',
      message: `Facilitator ${approvalStatus.toLowerCase()} successfully`,
      data: this.mapFacilitatorResponse(row.toObject()),
    };
  }
}

