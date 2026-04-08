/// <reference path="../../exceljs.d.ts" />
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CompanyProject,
  CompanyProjectDocument,
} from '../schemas/company-project.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CompanyFacilitator, CompanyFacilitatorDocument } from '../schemas/company-facilitator.schema';
import { CompanyCoordinator, CompanyCoordinatorDocument } from '../schemas/company-coordinator.schema';
import { CompanyAssessor, CompanyAssessorDocument } from '../schemas/company-assessor.schema';
import { CompanyActivity, CompanyActivityDocument } from '../schemas/company-activity.schema';
import { CompanyWorkOrder, CompanyWorkOrderDocument } from '../schemas/company-workorder.schema';
import { CompanyResourceDocument, CompanyResourceDocumentDocument } from '../schemas/company-resource-document.schema';
import { CompanyInvoice, CompanyInvoiceDocument, PAYMENT_FOR_PROFORMA, PAYMENT_FOR_TAX } from '../schemas/company-invoice.schema';
import { Sector, SectorDocument } from '../schemas/sector.schema';
import { Facilitator, FacilitatorDocument } from '../schemas/facilitator.schema';
import { Coordinator, CoordinatorDocument } from '../schemas/coordinator.schema';
import { Assessor, AssessorDocument } from '../schemas/assessor.schema';
import {
  PrimaryDataForm,
  PrimaryDataFormDocument,
  PRIMARY_DATA_DOC_STATUS,
} from '../schemas/primary-data-form.schema';
import {
  MasterPrimaryDataChecklist,
  MasterPrimaryDataChecklistDocument,
} from '../schemas/master-primary-data-checklist.schema';
import { RegistrationInfoDto } from './dto/registration-info.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { UpdateInvoiceApprovalDto } from './dto/update-invoice-approval.dto';
import { CreateAssessorProfileDto } from './dto/create-assessor-profile.dto';
import { ListAssessorsQueryDto } from './dto/list-assessors-query.dto';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { join } from 'path';
import * as fs from 'fs';
import { getCertificationType } from '../../helpers/certification.helper';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../../mail/mail.service';

/** View Certificate score band: 9 rows × 20 numbers (points bands 1–10 … 191–200). Normalize so frontend always gets number[][]. */
function normalizeScoreBandRows(rows: any[]): number[][] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const BANDS = 20;
  return rows.slice(0, 9).map((row) => {
    if (Array.isArray(row)) {
      const nums = row.slice(0, BANDS).map((x: any) => (typeof x === 'number' ? x : 0));
      while (nums.length < BANDS) nums.push(0);
      return nums;
    }
    if (row && typeof row === 'object' && Array.isArray(row.scores)) {
      const nums = row.scores.slice(0, BANDS).map((x: any) => (typeof x === 'number' ? x : 0));
      while (nums.length < BANDS) nums.push(0);
      return nums;
    }
    const score = typeof (row as any)?.score === 'number' ? (row as any).score : 0;
    const arr = Array(BANDS).fill(0);
    for (let i = 0; i < Math.min(score, BANDS); i++) arr[i] = 1;
    return arr;
  });
}

/** Approval status labels and colours for invoice UI (COMPANY_APPROVAL_STATUS / APPROVAL_STATUS_COLORS) */
export const INVOICE_APPROVAL_STATUS = ['Pending', 'Approved', 'Rejected', 'Under Review'];
export const INVOICE_APPROVAL_STATUS_COLORS = ['warning', 'success', 'danger', 'info'];

@Injectable()
export class CompanyProjectsService {
  constructor(
    @InjectModel(CompanyProject.name)
    private readonly projectModel: Model<CompanyProjectDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyFacilitator.name)
    private readonly companyFacilitatorModel: Model<CompanyFacilitatorDocument>,
    @InjectModel(CompanyCoordinator.name)
    private readonly companyCoordinatorModel: Model<CompanyCoordinatorDocument>,
    @InjectModel(CompanyAssessor.name)
    private readonly companyAssessorModel: Model<CompanyAssessorDocument>,
    @InjectModel(CompanyActivity.name)
    private readonly companyActivityModel: Model<CompanyActivityDocument>,
    @InjectModel(CompanyWorkOrder.name)
    private readonly companyWorkOrderModel: Model<CompanyWorkOrderDocument>,
    @InjectModel(CompanyResourceDocument.name)
    private readonly companyResourceDocumentModel: Model<CompanyResourceDocumentDocument>,
    @InjectModel(CompanyInvoice.name)
    private readonly companyInvoiceModel: Model<CompanyInvoiceDocument>,
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
    @InjectModel(Facilitator.name)
    private readonly facilitatorModel: Model<FacilitatorDocument>,
    @InjectModel(Coordinator.name)
    private readonly coordinatorModel: Model<CoordinatorDocument>,
    @InjectModel(Assessor.name)
    private readonly assessorModel: Model<AssessorDocument>,
    @InjectModel(PrimaryDataForm.name)
    private readonly primaryDataFormModel: Model<PrimaryDataFormDocument>,
    @InjectModel(MasterPrimaryDataChecklist.name)
    private readonly masterPrimaryDataChecklistModel: Model<MasterPrimaryDataChecklistDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  private parseLegacyAssessorDates(value: string): string[] {
    return [...new Set((value || '').split(',').map((d) => d.trim()).filter(Boolean))];
  }

  private parseDdMmYyyyToDate(value: string): Date | null {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

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
    const baseUrl = (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
    return `${baseUrl}${normalized}`;
  }

  private getFixedAssessorUploadPath(): string {
    return 'uploads/pic.jpeg';
  }

  private mapAssessorResponse(a: any) {
    const profileImage = this.toPublicFilePath(a.profile_image);
    const biodata = this.toPublicFilePath(a.biodata);
    const vendorRegistrationForm = this.toPublicFilePath(a.vendor_registration_form);
    const nonDisclosureAgreement = this.toPublicFilePath(a.non_disclosure_agreement);
    const healthDeclaration = this.toPublicFilePath(a.health_declaration);
    const gstDeclaration = this.toPublicFilePath(a.gst_declaration);
    const panCard = this.toPublicFilePath(a.pan_card);
    const cancelledCheque = this.toPublicFilePath(a.cancelled_cheque);

    return {
      id: a._id?.toString?.() || a._id,
      name: a.name,
      email: a.email,
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
      biodata,
      vendor_registration_form: vendorRegistrationForm,
      non_disclosure_agreement: nonDisclosureAgreement,
      health_declaration: healthDeclaration,
      gst_declaration: gstDeclaration,
      pan_card: panCard,
      cancelled_cheque: cancelledCheque,
      profile_image: profileImage,
      // Absolute URL aliases for frontend compatibility.
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

  async createAssessorAdminFlow(name: string, email: string, mobile: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!mobile || !mobile.trim()) {
      throw new BadRequestException({
        status: 'validations',
        errors: {
          mobile: ['mobile is required.'],
        },
      });
    }
    const existing = await this.assessorModel.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      throw new BadRequestException({
        status: 'validations',
        errors: {
          email: ['Assessor with this email already exists.'],
        },
      });
    }

    const assessor = await this.assessorModel.create({
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      status: '1',
    });

    return {
      status: 'success',
      message: 'Assessor added successfully',
      data: {
        id: assessor._id.toString(),
        name: assessor.name,
        email: assessor.email,
        mobile: (assessor as any).mobile,
        status: assessor.status,
      },
    };
  }

  async listAssessorsAdminFlow(query?: ListAssessorsQueryDto) {
    const parsedPage = Number.parseInt(String(query?.page ?? '1'), 10);
    const parsedLimit = Number.parseInt(String(query?.limit ?? '10'), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

    const filter: Record<string, any> = {};
    if (query?.name?.trim()) {
      filter.name = { $regex: query.name.trim(), $options: 'i' };
    }
    const phone = query?.phone?.trim() || query?.mobile?.trim();
    if (phone) {
      filter.mobile = { $regex: phone, $options: 'i' };
    }
    if (query?.email?.trim()) {
      filter.email = { $regex: query.email.trim(), $options: 'i' };
    }
    if (query?.industry_category?.trim() && query.industry_category !== 'All') {
      filter.industry_category = query.industry_category.trim();
    }
    if (query?.state?.trim() && query.state !== 'All') {
      filter.state = query.state.trim();
    }
    if (query?.account_status?.trim() && query.account_status !== 'All') {
      filter.status = query.account_status.trim();
    }
    if (query?.approval_status?.trim() && query.approval_status !== 'All') {
      filter.approval_status = query.approval_status.trim();
    }
    if (query?.profile_status?.trim() && query.profile_status !== 'All') {
      filter.profile_status = query.profile_status.trim();
    }

    const [assessors, total] = await Promise.all([
      this.assessorModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(cappedLimit)
        .lean(),
      this.assessorModel.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / cappedLimit));

    return {
      status: 'success',
      message: 'Assessors fetched successfully',
      data: assessors.map((a: any) => this.mapAssessorResponse(a)),
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

  async exportAssessorsAdminFlow(query?: ListAssessorsQueryDto) {
    const filter: Record<string, any> = {};
    if (query?.name?.trim()) {
      filter.name = { $regex: query.name.trim(), $options: 'i' };
    }
    const phone = query?.phone?.trim() || query?.mobile?.trim();
    if (phone) {
      filter.mobile = { $regex: phone, $options: 'i' };
    }
    if (query?.email?.trim()) {
      filter.email = { $regex: query.email.trim(), $options: 'i' };
    }
    if (query?.industry_category?.trim() && query.industry_category !== 'All') {
      filter.industry_category = query.industry_category.trim();
    }
    if (query?.state?.trim() && query.state !== 'All') {
      filter.state = query.state.trim();
    }
    if (query?.account_status?.trim() && query.account_status !== 'All') {
      filter.status = query.account_status.trim();
    }
    if (query?.approval_status?.trim() && query.approval_status !== 'All') {
      filter.approval_status = query.approval_status.trim();
    }
    if (query?.profile_status?.trim() && query.profile_status !== 'All') {
      filter.profile_status = query.profile_status.trim();
    }

    const assessors = await this.assessorModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const rows = assessors.map((a: any) => ({
      ...this.mapAssessorResponse(a),
      created_at: a.createdAt ? new Date(a.createdAt).toISOString() : '',
    }));
    const headers = [
      'id',
      'name',
      'email',
      'mobile',
      'industry_category',
      'state',
      'account_status',
      'approval_status',
      'profile_status',
      'created_at',
    ];

    const esc = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      headers.join(','),
      ...rows.map((r: any) =>
        [
          r.id,
          r.name,
          r.email,
          r.mobile,
          r.industry_category,
          r.state,
          r.account_status,
          r.approval_status,
          r.profile_status,
          r.created_at || '',
        ]
          .map(esc)
          .join(','),
      ),
    ];

    return {
      filename: `assessors-export-${Date.now()}.csv`,
      content: csvLines.join('\n'),
      total: rows.length,
    };
  }

  async updateAssessorApprovalStatusAdminFlow(
    assessorId: string,
    statusInput?: string,
    remarks?: string,
  ) {
    const assessor = await this.assessorModel.findById(assessorId);
    if (!assessor) {
      throw new NotFoundException({ status: 'error', message: 'Assessor not found' });
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
      // keep compatibility with custom incoming statuses
      approvalStatus = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    assessor.approval_status = approvalStatus;
    assessor.approval_remarks = (remarks || '').trim();
    await assessor.save();

    return {
      status: 'success',
      message: `Assessor ${approvalStatus.toLowerCase()} successfully`,
      data: this.mapAssessorResponse(assessor.toObject()),
    };
  }

  async getReportsAdminFlow(query?: ReportsQueryDto) {
    const parsedPage = Number.parseInt(String(query?.page ?? '1'), 10);
    const parsedLimit = Number.parseInt(String(query?.limit ?? '10'), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const cappedLimit = Math.min(limit, 100);

    const registerThroughInput = String(query?.register_through || '').trim().toLowerCase();
    const processType =
      registerThroughInput === 'cii' || registerThroughInput === 'c'
        ? 'c'
        : registerThroughInput === 'facilitator' || registerThroughInput === 'f'
          ? 'f'
          : '';

    const projectFilter: Record<string, any> = {};
    if (processType) {
      projectFilter.process_type = processType;
    }

    if (query?.year?.trim() && /^\d{4}$/.test(query.year.trim())) {
      const year = Number.parseInt(query.year.trim(), 10);
      projectFilter.createdAt = {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1),
      };
    }

    const projects = await this.projectModel
      .find(projectFilter)
      .select('_id company_id process_type createdAt')
      .sort({ createdAt: -1 })
      .lean();

    if (!projects.length) {
      return {
        status: 'success',
        message: 'Reports fetched successfully',
        data: [],
        pagination: {
          page,
          limit: cappedLimit,
          total: 0,
          total_pages: 1,
          has_next_page: false,
          has_prev_page: false,
        },
        applied_filters: {
          year: query?.year ?? '',
          name: query?.name ?? '',
          company_status: query?.company_status ?? '',
          register_through: query?.register_through ?? '',
          email: query?.email ?? '',
          facilitator: query?.facilitator ?? '',
          assessor: query?.assessor ?? '',
          coordinator: query?.coordinator ?? '',
        },
      };
    }

    const projectIds = projects.map((p: any) => p._id);
    const companyIds = [...new Set(projects.map((p: any) => String(p.company_id)))];

    const [companies, facilitatorAssignments, assessorAssignments, coordinatorAssignments] = await Promise.all([
      this.companyModel.find({ _id: { $in: companyIds } }).select('_id name email account_status reg_id').lean(),
      this.companyFacilitatorModel
        .find({ project_id: { $in: projectIds } })
        .populate('facilitator_id', 'name')
        .select('project_id facilitator_id')
        .lean(),
      this.companyAssessorModel
        .find({ project_id: { $in: projectIds } })
        .populate('assessor_id', 'name')
        .select('project_id assessor_id')
        .lean(),
      this.companyCoordinatorModel
        .find({ project_id: { $in: projectIds } })
        .populate('coordinator_id', 'name')
        .select('project_id coordinator_id')
        .lean(),
    ]);

    const companyById = new Map(companies.map((c: any) => [String(c._id), c]));
    const facilitatorByProjectId = new Map(
      facilitatorAssignments.map((r: any) => [String(r.project_id), (r.facilitator_id as any)?.name || '']),
    );
    const assessorByProjectId = new Map(
      assessorAssignments.map((r: any) => [String(r.project_id), (r.assessor_id as any)?.name || '']),
    );
    const coordinatorByProjectId = new Map(
      coordinatorAssignments.map((r: any) => [String(r.project_id), (r.coordinator_id as any)?.name || '']),
    );

    const rows = projects.map((p: any) => {
      const company = companyById.get(String(p.company_id)) || {};
      return {
        project_id: String(p._id),
        company_id: String(p.company_id),
        year: p.createdAt ? new Date(p.createdAt).getFullYear().toString() : '',
        register_through: p.process_type === 'f' ? 'Facilitator' : 'CII',
        company_name: (company as any).name || '',
        company_status: (company as any).account_status === '1' ? 'Active' : 'Inactive',
        company_status_value: (company as any).account_status || '',
        email: (company as any).email || '',
        reg_id: (company as any).reg_id || '',
        facilitator: facilitatorByProjectId.get(String(p._id)) || '',
        assessor: assessorByProjectId.get(String(p._id)) || '',
        coordinator: coordinatorByProjectId.get(String(p._id)) || '',
        created_at: p.createdAt || null,
      };
    });

    const contains = (value: string, needle: string) =>
      String(value || '').toLowerCase().includes(String(needle || '').trim().toLowerCase());

    const filtered = rows.filter((r) => {
      if (query?.name?.trim() && !contains(r.company_name, query.name)) return false;
      if (query?.email?.trim() && !contains(r.email, query.email)) return false;
      if (query?.facilitator?.trim() && query.facilitator !== 'All' && !contains(r.facilitator, query.facilitator)) return false;
      if (query?.assessor?.trim() && query.assessor !== 'All' && !contains(r.assessor, query.assessor)) return false;
      if (query?.coordinator?.trim() && query.coordinator !== 'All' && !contains(r.coordinator, query.coordinator)) return false;
      if (query?.company_status?.trim() && query.company_status !== 'All') {
        const normalized = query.company_status.trim().toLowerCase();
        if (normalized === 'active' && r.company_status_value !== '1') return false;
        if (normalized === 'inactive' && r.company_status_value === '1') return false;
        if (!['active', 'inactive'].includes(normalized) && r.company_status_value !== query.company_status.trim()) return false;
      }
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / cappedLimit));
    const start = (page - 1) * cappedLimit;
    const data = filtered.slice(start, start + cappedLimit);

    return {
      status: 'success',
      message: 'Reports fetched successfully',
      data,
      pagination: {
        page,
        limit: cappedLimit,
        total,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_prev_page: page > 1,
      },
      applied_filters: {
        year: query?.year ?? '',
        name: query?.name ?? '',
        company_status: query?.company_status ?? '',
        register_through: query?.register_through ?? '',
        email: query?.email ?? '',
        facilitator: query?.facilitator ?? '',
        assessor: query?.assessor ?? '',
        coordinator: query?.coordinator ?? '',
      },
    };
  }

  async getAssessorAdminFlow(assessorId: string) {
    const assessor = await this.assessorModel.findById(assessorId).lean();
    if (!assessor) {
      throw new NotFoundException({ status: 'error', message: 'Assessor not found' });
    }

    return {
      status: 'success',
      message: 'Assessor fetched successfully',
      data: this.mapAssessorResponse(assessor),
    };
  }

  async createAssessorProfileAdminFlow(
    dto: CreateAssessorProfileDto,
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
    const existing = await this.assessorModel.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      throw new BadRequestException({
        status: 'validations',
        errors: { email: ['Assessor with this email already exists.'] },
      });
    }

    const filePath = (f?: Express.Multer.File[]) => (f?.[0] ? this.getFixedAssessorUploadPath() : '');

    const assessor = await this.assessorModel.create({
      name: dto.name.trim(),
      email: normalizedEmail,
      mobile: dto.mobile.trim(),
      status: (dto.status || '1').toString(),
      approval_status: 'Pending',
      profile_status: 'Complete',
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
    });

    return {
      status: 'success',
      message: 'Assessor profile saved successfully',
      data: this.mapAssessorResponse(assessor),
    };
  }

  async updateAssessorProfileAdminFlow(
    assessorId: string,
    dto: CreateAssessorProfileDto,
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
    const assessor = await this.assessorModel.findById(assessorId);
    if (!assessor) {
      throw new NotFoundException({ status: 'error', message: 'Assessor not found' });
    }

    const normalizedEmail = (dto.email || assessor.email).trim().toLowerCase();
    const duplicate = await this.assessorModel
      .findOne({ _id: { $ne: assessorId }, email: normalizedEmail })
      .lean();
    if (duplicate) {
      throw new BadRequestException({
        status: 'validations',
        errors: { email: ['Assessor with this email already exists.'] },
      });
    }

    const filePath = (f?: Express.Multer.File[]) => (f?.[0] ? this.getFixedAssessorUploadPath() : undefined);

    assessor.name = (dto.name || assessor.name).trim();
    assessor.email = normalizedEmail;
    assessor.mobile = (dto.mobile || assessor.mobile).trim();
    assessor.status = (dto.status || assessor.status || '1').toString();
    assessor.industry_category = dto.industry_category ?? assessor.industry_category ?? '';
    assessor.alternate_mobile = dto.alternate_mobile ?? assessor.alternate_mobile ?? '';
    assessor.address_line_1 = dto.address_line_1 ?? assessor.address_line_1 ?? '';
    assessor.address_line_2 = dto.address_line_2 ?? assessor.address_line_2 ?? '';
    assessor.pincode = dto.pincode ?? assessor.pincode ?? '';
    assessor.city = dto.city ?? assessor.city ?? '';
    assessor.state = dto.state ?? assessor.state ?? '';
    assessor.pan_number = dto.pan_number ?? assessor.pan_number ?? '';
    assessor.enrollment_date = dto.enrollment_date ?? assessor.enrollment_date ?? '';
    assessor.gst_registered = dto.gst_registered != null ? this.toBool(dto.gst_registered) : !!assessor.gst_registered;
    assessor.gst_number = dto.gst_number ?? assessor.gst_number ?? '';
    assessor.lead_assessor = dto.lead_assessor != null ? this.toBool(dto.lead_assessor) : !!assessor.lead_assessor;
    assessor.assessor_grade = dto.assessor_grade ?? assessor.assessor_grade ?? '';
    assessor.emergency_contact_name = dto.emergency_contact_name ?? assessor.emergency_contact_name ?? '';
    assessor.emergency_mobile = dto.emergency_mobile ?? assessor.emergency_mobile ?? '';
    assessor.emergency_address_line_1 = dto.emergency_address_line_1 ?? assessor.emergency_address_line_1 ?? '';
    assessor.emergency_address_line_2 = dto.emergency_address_line_2 ?? assessor.emergency_address_line_2 ?? '';
    assessor.emergency_city = dto.emergency_city ?? assessor.emergency_city ?? '';
    assessor.emergency_state = dto.emergency_state ?? assessor.emergency_state ?? '';
    assessor.emergency_pincode = dto.emergency_pincode ?? assessor.emergency_pincode ?? '';
    assessor.bank_name = dto.bank_name ?? assessor.bank_name ?? '';
    assessor.account_number = dto.account_number ?? assessor.account_number ?? '';
    assessor.branch_name = dto.branch_name ?? assessor.branch_name ?? '';
    assessor.ifsc_code = dto.ifsc_code ?? assessor.ifsc_code ?? '';

    assessor.profile_image = filePath(files?.profile_image) ?? assessor.profile_image;
    assessor.biodata = filePath(files?.biodata) ?? assessor.biodata;
    assessor.vendor_registration_form = filePath(files?.vendor_registration_form) ?? assessor.vendor_registration_form;
    assessor.non_disclosure_agreement = filePath(files?.non_disclosure_agreement) ?? assessor.non_disclosure_agreement;
    assessor.health_declaration = filePath(files?.health_declaration) ?? assessor.health_declaration;
    assessor.gst_declaration = filePath(files?.gst_declaration) ?? assessor.gst_declaration;
    assessor.pan_card = filePath(files?.pan_card) ?? assessor.pan_card;
    assessor.cancelled_cheque = filePath(files?.cancelled_cheque) ?? assessor.cancelled_cheque;

    await assessor.save();

    return {
      status: 'success',
      message: 'Assessor profile updated successfully',
      data: this.mapAssessorResponse(assessor),
    };
  }

  /**
   * List projects for the logged-in company for the \"My Projects\" style listing.
   * Returns company + project level info needed by frontend tables.
   */
  async listCompanyProjects(companyId: string) {
    const company = await this.companyModel.findById(companyId).lean();
    if (!company) {
      throw new NotFoundException({
        status: 'error',
        message: 'Company not found',
      });
    }

    const projects = await this.projectModel
      .find({ company_id: companyId })
      .sort({ createdAt: -1 })
      .lean();

    const items = projects.map((p: any) => {
      const reg = p.registration_info || {};
      return {
        project_mongo_id: p._id?.toString() || null,
        company_id: company._id.toString(),
        company_name: company.name,
        company_email: company.email,
        company_mobile: company.mobile,
        account_status: company.account_status,
        project_code: p.project_id || null,
        process_type: p.process_type || 'c',
        next_activities_id: p.next_activities_id ?? null,
        // Registration-based fields for filters
        state_id: reg.state_id || null,
        entity_id: reg.entity_id || null,
        turnover: reg.turnover || null,
        // Optional extras if you want them later
        industry_id: reg.industry_id || null,
        sector_id: reg.sector_id || null,
        created_at: p.createdAt || null,
        updated_at: p.updatedAt || null,
      };
    });

    return {
      status: 'success',
      message: 'Projects retrieved successfully',
      data: items,
    };
  }

  /**
   * Create a new project for recertification (no project code yet).
   * Copies registration_info from the source project so filters (entity, state, turnover) still work.
   * New project appears in GET /api/company/projects with project_code = null.
   */
  async recertifyProject(companyId: string, projectId: string) {
    const sourceProject = await this.projectModel
      .findOne({ _id: projectId, company_id: companyId })
      .lean();

    if (!sourceProject) {
      throw new NotFoundException({
        status: 'error',
        message: 'Source project not found for recertification',
      });
    }

    const company = await this.companyModel.findById(companyId).lean();
    if (!company) {
      throw new NotFoundException({
        status: 'error',
        message: 'Company not found',
      });
    }

    const registrationInfo = (sourceProject as any).registration_info || {};
    const recertRegistrationInfo = {
      ...registrationInfo,
      recert_source_project_id: (sourceProject as any)._id.toString(),
    };

    const newProject = new this.projectModel({
      company_id: companyId,
      process_type: (sourceProject as any).process_type || 'c',
      next_activities_id: 2, // Start recertification from step 2 = "Company Filled Registration Info"
      profile_update: 1,
      project_id: undefined,
      proposal_document: undefined,
      launch_training_document: undefined,
      hand_holding_document: undefined,
      hand_holding_document2: undefined,
      hand_holding_document3: undefined,
      certificate_document_url: undefined,
      certificate_document_filename: undefined,
      certificate_upload_date: undefined,
      certificate_expiry_date: undefined,
      feedback_document_url: undefined,
      feedback_document_filename: undefined,
      feedback_upload_date: undefined,
      score_band_status: 0,
      percentage_score: undefined,
      total_score: undefined,
      max_points: undefined,
      criteria_projectscore: [],
      high_projectscore: [],
      max_score: [],
      score_band_pdf_path: undefined,
      registration_info: recertRegistrationInfo,
    });

    const savedProject = await newProject.save();

    await this.projectModel.updateOne(
      { _id: projectId },
      { $set: { recertification_project_id: savedProject._id } },
    );

    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: savedProject._id,
      description: 'Recertification project created from existing project',
      activity_type: 'cii',
      milestone_flow: 1, // Step 1 completed (Company Registered); next step = 2 (Registration Info)
      milestone_completed: true,
    });

    return {
      status: 'success',
      message: 'Recertification project created successfully',
      data: {
        project_id: savedProject._id.toString(),
        project_code: savedProject.project_id ?? null,
        next_activities_id: savedProject.next_activities_id,
      },
    };
  }

  async getCertificateSummary(
    companyId: string,
    projectId: string,
  ): Promise<{
    status: 'success';
    message: string;
    data: {
      profile: {
        id: string;
        name: string | undefined;
        certificate_document: string | null;
        feedback_document: string | null;
        score_band_status: 0 | 1;
      };
      percentage_score: number;
      total_score?: number;
      max_points?: number;
      criteria_projectscore: any[];
      high_projectscore: any[];
      max_score: any[];
      certification_level: string;
    };
  }> {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId }).lean();
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }
    const company = await this.companyModel.findById(project.company_id).lean();

    // Convert relative paths to full URLs for frontend
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    
    const certificate_document = project.certificate_document_url
      ? project.certificate_document_url.startsWith('http')
        ? project.certificate_document_url
        : `${baseUrl}/api/company/projects/${projectId}/certificate-document`
      : null;

    const feedback_document = project.feedback_document_url
      ? project.feedback_document_url.startsWith('http')
        ? project.feedback_document_url
        : `${baseUrl}/api/company/projects/${projectId}/feedback-document`
      : null;

    const score_band_status = (project.score_band_status || 0) as 0 | 1;
    const percentage_score = project.percentage_score ?? 0;
    const certification_level = getCertificationType(percentage_score);

    // Normalize to 9×20 so frontend Score Band grid always gets number[][] (see VIEW_CERTIFICATE_BACKEND_REQUIREMENTS)
    const criteria_projectscore = normalizeScoreBandRows(project.criteria_projectscore || []);
    const high_projectscore = normalizeScoreBandRows(project.high_projectscore || []);
    const max_score = normalizeScoreBandRows(project.max_score || []);

    return {
      status: 'success',
      message: 'Certificate data loaded',
      data: {
        profile: {
          id: project._id.toString(),
          name: company?.name,
          certificate_document,
          feedback_document,
          score_band_status,
        },
        percentage_score,
        total_score: project.total_score,
        max_points: project.max_points,
        criteria_projectscore,
        high_projectscore,
        max_score,
        certification_level,
      },
    };
  }

  async getProject(companyId: string, projectId: string) {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId }).lean();
    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    return project;
  }

  async getScoreBandPdfPath(companyId: string, projectId: string): Promise<string> {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    if (!project.score_band_pdf_path) {
      throw new NotFoundException({
        status: 'error',
        message: 'Score band not available',
      });
    }

    const relativePath = project.score_band_pdf_path;
    const absolutePath = join(process.cwd(), relativePath);

    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException({
        status: 'error',
        message: 'Score band PDF file not found on server',
      });
    }

    return absolutePath;
  }

  /**
   * Upload Plaque and Certificate PDF (Admin/Greenco Team).
   * Saves to uploads/company_certificate/{projectId}/, updates project.
   */
  async uploadCertificateDocument(
    companyId: string,
    projectId: string,
    file: Express.Multer.File,
  ): Promise<{ status: string; message: string; data?: any }> {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }
    const relativePath = `uploads/company_certificate/${projectId}/${file.filename}`;
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 3);
    project.certificate_document_url = relativePath;
    project.certificate_document_filename = file.originalname || 'certificate.pdf';
    project.certificate_upload_date = new Date();
    project.certificate_expiry_date = expiry;
    // Move main flow to milestone 18 (Certificate Uploaded) → next 19 (2nd Invoice uploaded)
    (project as any).next_activities_id = 19;
    await project.save();

    // Activity: step 18 – CII uploads certificate
    await this.companyActivityModel.create({
      company_id: project.company_id,
      project_id: project._id,
      description: 'CII Uploaded Certificate',
      activity_type: 'cii',
      milestone_flow: 18,
      milestone_completed: true,
    });
    return {
      status: 'success',
      message: 'Certificate uploaded successfully',
      data: {
        certificate_document_url: relativePath,
        certificate_document_filename: project.certificate_document_filename,
      },
    };
  }

  /**
   * Upload Feedback PDF (Admin/Greenco Team).
   * Saves to uploads/company_feedback/{projectId}/, updates project.
   */
  async uploadFeedbackDocument(
    companyId: string,
    projectId: string,
    file: Express.Multer.File,
  ): Promise<{ status: string; message: string; data?: any }> {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }
    const relativePath = `uploads/company_feedback/${projectId}/${file.filename}`;
    project.feedback_document_url = relativePath;
    project.feedback_document_filename = file.originalname || 'feedback.pdf';
    project.feedback_upload_date = new Date();
    // Move main flow to milestone 23 (Feedback Report uploaded) → next 24 (close-out)
    (project as any).next_activities_id = 24;
    await project.save();

    // Activity: step 23 – CII uploads feedback report
    await this.companyActivityModel.create({
      company_id: project.company_id,
      project_id: project._id,
      description: 'CII Uploaded Feedback Report',
      activity_type: 'cii',
      milestone_flow: 23,
      milestone_completed: true,
    });
    return {
      status: 'success',
      message: 'Feedback uploaded successfully',
      data: {
        feedback_document_url: relativePath,
        feedback_document_filename: project.feedback_document_filename,
      },
    };
  }

  /**
   * Toggle Show Score Band to Company (Admin). 0 = hide, 1 = show.
   */
  async updateScoreBandStatus(
    companyId: string,
    projectId: string,
    score_band_status: 0 | 1,
  ): Promise<{ status: string; message: string; data?: any }> {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }
    project.score_band_status = score_band_status;
    await project.save();
    return {
      status: 'success',
      message: 'Score band visibility updated',
      data: { score_band_status: project.score_band_status },
    };
  }

  async saveRegistrationInfo(
    companyId: string,
    projectId: string,
    dto: RegistrationInfoDto,
    files?: {
      company_brief_profile?: Express.Multer.File[];
      brief_profile?: Express.Multer.File[];
      turnover_document?: Express.Multer.File[];
      turnover?: Express.Multer.File[];
    },
  ) {
    if (!companyId || !projectId) {
      throw new BadRequestException({
        status: 'error',
        message: 'Missing company or project context',
      });
    }
    if (!Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException({
        status: 'error',
        message: 'Invalid project id',
      });
    }

    let project: CompanyProjectDocument | null = null;
    try {
      project = await this.projectModel.findOne({
        _id: new Types.ObjectId(projectId),
        company_id: new Types.ObjectId(companyId),
      });
    } catch (e) {
      throw new BadRequestException({
        status: 'error',
        message: 'Invalid project or company id',
      });
    }

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    // Normalize field names (handle alternative naming from frontend)
    const normalizedData: any = { ...dto };
    
    // Remove file fields from DTO (they're handled via @UploadedFiles() parameter)
    delete normalizedData.company_brief_profile;
    delete normalizedData.turnover_document;
    delete normalizedData.brief_profile;
    delete normalizedData.turnover;
    
    // Normalize pan_no -> pan_number
    if (dto.pan_no && !dto.pan_number) {
      normalizedData.pan_number = dto.pan_no;
      delete normalizedData.pan_no;
    }
    
    // Normalize gstin_no -> gstin
    if (dto.gstin_no && !dto.gstin) {
      normalizedData.gstin = dto.gstin_no;
      delete normalizedData.gstin_no;
    }

    // Handle file uploads
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    console.log('[Registration Info Service] Processing files:', {
      hasFiles: !!files,
      company_brief_profile: files?.company_brief_profile?.[0]?.filename,
      turnover_document: files?.turnover_document?.[0]?.filename,
    });

    if (files) {
      // Handle Company Brief Profile
      const briefProfileFile = files.company_brief_profile?.[0] || files.brief_profile?.[0];
      if (briefProfileFile) {
        const relativePath = `uploads/registration/${projectId}/${briefProfileFile.filename}`;
        const fullUrl = `${baseUrl}/${relativePath}`;
        normalizedData.company_brief_profile_url = fullUrl;
        normalizedData.company_brief_profile_filename = briefProfileFile.originalname;
        console.log('[Registration Info Service] Saved Company Brief Profile:', {
          url: fullUrl,
          filename: briefProfileFile.originalname,
          savedFilename: briefProfileFile.filename,
        });
      }

      // Handle Turnover Document
      const turnoverFile = files.turnover_document?.[0] || files.turnover?.[0];
      if (turnoverFile) {
        const relativePath = `uploads/registration/${projectId}/${turnoverFile.filename}`;
        const fullUrl = `${baseUrl}/${relativePath}`;
        normalizedData.turnover_document_url = fullUrl;
        normalizedData.turnover_document_filename = turnoverFile.originalname;
        console.log('[Registration Info Service] Saved Turnover Document:', {
          url: fullUrl,
          filename: turnoverFile.originalname,
          savedFilename: turnoverFile.filename,
        });
      }
    } else {
      console.log('[Registration Info Service] No files received');
    }

    // Store raw form data under registration_info
    project.registration_info = {
      ...(project.registration_info || {}),
      ...normalizedData,
    };
    
    // Mark profile as updated (registration form submitted)
    project.profile_update = 1;
    
    console.log('[Registration Info Service] Saving to database:', {
      projectId: projectId.toString(),
      hasCompanyBriefProfile: !!normalizedData.company_brief_profile_url,
      hasTurnoverDocument: !!normalizedData.turnover_document_url,
      registrationInfoKeys: Object.keys(project.registration_info),
      profile_update: project.profile_update,
    });

    try {
      await project.save();
    } catch (err: any) {
      const message = err?.message || 'Failed to save registration info';
      throw new BadRequestException({ status: 'error', message });
    }

    // Log activity: Company Filled Registration Info (milestone 2) and set next step to 3
    const companyObjId = new Types.ObjectId(companyId);
    const existingMilestone2 = await this.companyActivityModel.findOne({
      company_id: companyObjId,
      project_id: project._id,
      milestone_flow: 2,
    });
    if (!existingMilestone2) {
      await this.companyActivityModel.create({
        company_id: companyObjId,
        project_id: project._id,
        description: 'Registration form completed',
        activity_type: 'company',
        milestone_flow: 2,
        milestone_completed: true,
      });
      const nextId = Math.min(24, 3);
      if (project.next_activities_id < nextId) {
        await this.projectModel.updateOne(
          { _id: project._id },
          { $set: { next_activities_id: nextId } },
        );
      }
    }

    // In-app notification for the company so they see confirmation after filing
    if (companyId) {
      this.notificationsService
        .create(
          'Registration form submitted',
          'Your registration information has been saved successfully. You can view or update it from the project dashboard.',
          'C',
          companyId,
        )
        .then((doc) => {
          console.log('[Registration Info Service] Notification created for company', companyId, 'id:', (doc as any)?._id?.toString?.());
        })
        .catch((e) => {
          console.error('[Registration Info Service] Notification failed:', e?.message || e);
        });
    }

    console.log('[Registration Info Service] Saved successfully. Registration info:', {
      company_brief_profile_url: project.registration_info?.company_brief_profile_url,
      turnover_document_url: project.registration_info?.turnover_document_url,
    });

    // Optionally mirror some fields onto Company for Quickview/profile
    try {
      const company = await this.companyModel.findById(companyId);
      if (company) {
        if (dto.sector_id) {
          company.mst_sector_id = dto.sector_id;
        }
        if (dto.turnover) {
          company.turnover = dto.turnover;
        }
        await company.save();
      }
    } catch (err: any) {
      console.error('[Registration Info Service] Company mirror update failed:', err?.message || err);
      // Non-fatal: registration info was already saved
    }

    // Build response with file URLs if files were uploaded
    const response: any = {
      status: 'success',
      message: 'Registration info saved successfully',
      notification_created: true, // Frontend can refetch notifications when this is true
    };

    // Include file information in response if files were uploaded
    const fileData: any = {};
    
    if (normalizedData.company_brief_profile_url) {
      fileData.company_brief_profile = {
        url: normalizedData.company_brief_profile_url,
        filename: normalizedData.company_brief_profile_filename,
        downloadUrl: `${baseUrl}/api/company/projects/${projectId}/registration-files/company-brief-profile`,
      };
    }

    if (normalizedData.turnover_document_url) {
      fileData.turnover_document = {
        url: normalizedData.turnover_document_url,
        filename: normalizedData.turnover_document_filename,
        downloadUrl: `${baseUrl}/api/company/projects/${projectId}/registration-files/turnover-document`,
      };
    }

    if (Object.keys(fileData).length > 0) {
      response.data = fileData;
    }

    return response;
  }

  async getRegistrationInfo(companyId: string, projectId: string) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const registrationInfo = project.registration_info || {};

    // Build response data with all form fields
    const responseData: any = { ...registrationInfo };
    
    // Add file URLs if they exist (for viewing/downloading)
    if (registrationInfo.company_brief_profile_url) {
      responseData.company_brief_profile = {
        url: registrationInfo.company_brief_profile_url,
        filename: registrationInfo.company_brief_profile_filename || 'company_brief_profile',
        downloadUrl: `${baseUrl}/api/company/projects/${projectId}/registration-files/company-brief-profile`,
      };
    } else {
      responseData.company_brief_profile = null;
    }
    
    if (registrationInfo.turnover_document_url) {
      responseData.turnover_document = {
        url: registrationInfo.turnover_document_url,
        filename: registrationInfo.turnover_document_filename || 'turnover_document',
        downloadUrl: `${baseUrl}/api/company/projects/${projectId}/registration-files/turnover-document`,
      };
    } else {
      responseData.turnover_document = null;
    }

    // Remove internal file URL fields from response (keep only the structured objects)
    delete responseData.company_brief_profile_url;
    delete responseData.company_brief_profile_filename;
    delete responseData.turnover_document_url;
    delete responseData.turnover_document_filename;

    return {
      status: 'success',
      message: 'Registration info loaded successfully',
      data: responseData,
    };
  }

  async completeMilestone(
    companyId: string,
    projectId: string,
    dto: { milestone_flow: number; description: string; completed?: boolean },
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    const isCompleted = dto.completed !== undefined ? dto.completed : true;

    console.log('[Complete Milestone] Before update:', {
      projectId: project._id.toString(),
      current_next_activities_id: project.next_activities_id,
      milestone_flow: dto.milestone_flow,
      isCompleted,
    });

    await this.companyActivityModel.create({
      company_id: project.company_id,
      project_id: project._id,
      description: dto.description,
      activity_type: 'cii',
      milestone_flow: dto.milestone_flow,
      milestone_completed: isCompleted,
    });

    if (isCompleted) {
      const oldValue = project.next_activities_id;
      project.next_activities_id = dto.milestone_flow + 1;
      await project.save();
      
      console.log('[Complete Milestone] After update:', {
        projectId: project._id.toString(),
        old_next_activities_id: oldValue,
        new_next_activities_id: project.next_activities_id,
        milestone_flow: dto.milestone_flow,
      });
      
      // Verify it was saved
      const verifyProject = await this.projectModel.findById(projectId);
      console.log('[Complete Milestone] Verification:', {
        projectId: projectId,
        saved_next_activities_id: verifyProject?.next_activities_id,
      });
    }

    return {
      status: 'success',
      message: 'Milestone recorded successfully',
    };
  }

  async getQuickviewData(
    companyId: string,
    projectId: string,
  ): Promise<{
    status: 'success';
    message: string;
    data: any;
  }> {
    const project = await this.projectModel
      .findOne({ _id: projectId, company_id: companyId })
      .lean();

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found or quickview not available.',
      });
    }

    // Use project's own _id and company_id for queries (same as check-quickview-activities.js) so activities are found reliably.
    const pid = (project as any)._id;
    const cid = (project as any).company_id;

    const [
      company,
      allActivities,
      currentActivity,
      workOrder,
      companyFacilitator,
      companyCoordinator,
      companyAssessors,
    ] = await Promise.all([
      this.companyModel.findById(companyId).lean(),
      this.companyActivityModel
        .find({ company_id: cid, project_id: pid })
        .sort({ createdAt: -1 })
        .lean(),
      this.companyActivityModel
        .findOne({ company_id: cid, project_id: pid, activity_type: 'cii' })
        .sort({ createdAt: -1 })
        .lean(),
      this.companyWorkOrderModel
        .findOne({ company_id: cid, project_id: pid })
        .sort({ createdAt: -1 })
        .lean(),
      this.companyFacilitatorModel
        .findOne({ company_id: cid, project_id: pid })
        .populate('facilitator_id')
        .lean(),
      this.companyCoordinatorModel
        .findOne({ company_id: cid, project_id: pid })
        .populate('coordinator_id')
        .lean(),
      this.companyAssessorModel
        .find({ company_id: cid, project_id: pid })
        .lean(),
    ]);

    if (!company) {
      throw new NotFoundException({ status: 'error', message: 'Company not found.' });
    }

    const sector = company.mst_sector_id
      ? await this.sectorModel.findById(company.mst_sector_id).lean()
      : null;

    // Latest completed = highest milestone_flow among completed activities (not "first by date")
    // so that certificate/feedback steps show correctly even if payment was logged later
    const completedMilestones = (allActivities as any[]).filter(
      (a: any) => a.milestone_completed === true && a.milestone_flow,
    );
    const latestCompletedMilestoneNumberFromActivities =
      completedMilestones.length > 0
        ? Math.max(...completedMilestones.map((a: any) => a.milestone_flow))
        : 0;
    const completedMilestone =
      latestCompletedMilestoneNumberFromActivities > 0
        ? completedMilestones.find(
            (a: any) => a.milestone_flow === latestCompletedMilestoneNumberFromActivities,
          )
        : null;

    let facilitatorData = null;
    if (companyFacilitator && (companyFacilitator as any).facilitator_id) {
      const facilitator = (companyFacilitator as any).facilitator_id;
      const contractDocStatus = (companyFacilitator as any).contract_doc_status || 0;
      facilitatorData = {
        Facilitator_Detail: { name: facilitator.name, email: facilitator.email },
        contract_fee: (companyFacilitator as any).contract_fee || 0,
        contract_doc_status: contractDocStatus,
        contract_status: contractDocStatus === 1 ? 'Signed' : contractDocStatus === 0 ? 'Assigned' : 'Not Assigned',
        contract_status_label: contractDocStatus === 1 ? 'Contract Signed' : contractDocStatus === 0 ? 'Assigned - Pending Signature' : 'Not Assigned',
      };
    }

    let coordinatorData = null;
    if (companyCoordinator && (companyCoordinator as any).coordinator_id) {
      const coordinator = (companyCoordinator as any).coordinator_id;
      coordinatorData = {
        Coordinator_Detail: { name: coordinator.name, email: coordinator.email },
      };
    }

    const assessorIds = (companyAssessors as any[]).map((a) => a.assessor_id).filter(Boolean);
    const assessorsList = assessorIds.length
      ? await this.assessorModel.find({ _id: { $in: assessorIds } }).lean()
      : [];
    const assessorMap = new Map(assessorsList.map((a: any) => [a._id.toString(), a]));
    const assessorsData = (companyAssessors as any[]).map((ca: any) => {
      const assessor = assessorMap.get(ca.assessor_id?.toString?.());
      return assessor
        ? { Assessor_Detail: { name: assessor.name, email: assessor.email }, visit_dates: ca.visit_dates || [] }
        : null;
    }).filter(Boolean);

    // Detailed milestone steps flow (Main project flow) – define once, reuse for logs and milestone_flow
    const milestoneSteps: Record<number, { name: string; responsibility: string }> = {
      1: { name: 'Company Registered', responsibility: 'Company' },
      2: { name: 'Company Filled Registration Info', responsibility: 'Company' },
      3: { name: 'CII Uploaded Proposal Document', responsibility: 'CII' },
      4: { name: 'Company Uploaded Work Order Document', responsibility: 'Company' },
      5: { name: 'Work Order / Contract Document Accepted', responsibility: 'CII' },
      6: { name: 'CII to provide Project Code', responsibility: 'CII' },
      7: { name: 'Assign Project Co‑Ordinator', responsibility: 'CII' },
      8: { name: 'CII uploaded the PI/Tax Invoice', responsibility: 'CII' },
      9: { name: 'Company Paid Proforma Invoice', responsibility: 'Company' },
      10: { name: 'CII Acknowledged Proforma Invoice', responsibility: 'CII' },
      11: { name: 'Company Uploaded All Primary Data', responsibility: 'Company' },
      12: { name: 'CII Approved All Primary Data', responsibility: 'CII' },
      13: { name: 'All Checklist / Assessment Documents Uploaded by Company', responsibility: 'Company' },
      14: { name: 'CII Approved All Assessment Submittal', responsibility: 'CII' },
      15: { name: 'CII Assigned an Assessor', responsibility: 'CII' },
      16: { name: 'Preliminary Scoring submitted by CII', responsibility: 'CII' },
      17: { name: 'Final Scoring submitted (Rating Declaration)', responsibility: 'CII' },
      18: { name: 'Certificate Uploaded', responsibility: 'CII' },
      19: { name: '2nd Invoice uploaded', responsibility: 'CII' },
      20: { name: 'Payment Receipt of 2nd Invoice uploaded', responsibility: 'Company' },
      21: { name: 'Payment Receipt of 2nd Invoice acknowledged', responsibility: 'CII' },
      22: { name: 'Plaque & certificate dispatched', responsibility: 'CII' },
      23: { name: 'Feedback Report uploaded', responsibility: 'CII' },
      24: { name: 'Project close‑out / Sustenance phase', responsibility: 'Company' },
    };

    // Get all company activities – same step names and responsibility as Latest/Next Step
    const activitiesData = allActivities.map((activity) => {
      const flow = activity.milestone_flow != null ? activity.milestone_flow : null;
      const step = flow != null ? milestoneSteps[flow] : null;
      return {
        description: activity.description,
        activity: step ? step.name : activity.description,
        responsibility: step ? step.responsibility : (activity.activity_type === 'cii' ? 'CII' : 'Company'),
        created_at: (activity as any).createdAt
          ? (activity as any).createdAt.toISOString()
          : new Date().toISOString(),
        formatted_date: (activity as any).createdAt
          ? new Date((activity as any).createdAt).toLocaleString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
          : '',
        milestone_flow: flow,
        milestone_completed: activity.milestone_completed ?? false,
        activity_type: activity.activity_type || null,
      };
    });

    // Get last activity for milestone calculation
    const lastActivity = allActivities.length > 0 ? allActivities[0] : null;

    // Calculate current flow (matching Laravel logic)
    // $curent_flow = is_null($last_activity) ? 1 : $last_activity->milestone_flow;
    // if ($last_activity->milestone_completed) { $curent_flow += 1; }
    let currentFlow = 1;
    if (lastActivity) {
      currentFlow = lastActivity.milestone_flow || 1;
      if (lastActivity.milestone_completed) {
        currentFlow += 1;
      }
    }

    // Milestone responsibility map (for backward compatibility)
    const milestoneResponsibilityMap: Record<number, string> = {};
    Object.keys(milestoneSteps).forEach((key) => {
      const stepNum = parseInt(key);
      milestoneResponsibilityMap[stepNum] = milestoneSteps[stepNum].responsibility;
    });

    // Determine latest completed milestone (use highest completed step from activities)
    const latestCompletedMilestoneNumber = latestCompletedMilestoneNumberFromActivities;
    const latestCompletedMilestone = latestCompletedMilestoneNumber > 0
      ? milestoneSteps[latestCompletedMilestoneNumber]
      : null;
    const latestCompletedMilestoneName = latestCompletedMilestone?.name || null;

    // Next step: at least (latest + 1), use project.next_activities_id only if it's ahead (so stale DB still shows correct next)
    const derivedNext = latestCompletedMilestoneNumber >= 24 ? 24 : latestCompletedMilestoneNumber + 1;
    const storedNext = project.next_activities_id && project.next_activities_id > 0 ? project.next_activities_id : 0;
    const nextMilestoneNumber = Math.min(24, Math.max(derivedNext, storedNext));

    // Check if next milestone is already in progress (exists in activities but not completed)
    const nextMilestoneInProgress = allActivities.some(
      (activity) => activity.milestone_flow === nextMilestoneNumber && !activity.milestone_completed,
    );

    const nextMilestone = milestoneSteps[nextMilestoneNumber];
    const nextMilestoneName = nextMilestone?.name || 'Project Completed';

    const nextActivityInfo = {
      name: nextMilestoneName,
      status: nextMilestoneInProgress ? 'In Progress' : (nextMilestoneNumber > 24 ? 'Completed' : 'Pending'),
      responsibility: nextMilestone?.responsibility || milestoneResponsibilityMap[nextMilestoneNumber] || 'N/A',
    };

    // Base URL for document URLs
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

    // Tab visibility: after Assessor Visit (14) → show Certificate; after Certificate (15+) → show Recertification.
    // Don't return 15+ until certificate is uploaded (so Recertification stays hidden until certificate phase is done).
    const rawNextId = typeof project.next_activities_id === 'number' ? project.next_activities_id : (project.next_activities_id ? parseInt(String(project.next_activities_id), 10) : 1);
    const hasCertificate = !!(project as any).certificate_document_url;
    const effectiveNextId = !hasCertificate && rawNextId >= 15 ? 14 : rawNextId;

    // Step 24 display: if recertification started → "open new project"; if not → "Certificate created" / Completed
    const recertificationNewProjectId = (project as any).recertification_project_id?.toString?.() ?? (project as any).recertification_project_id;
    const isRecertifiedAndAtCloseOut = effectiveNextId === 24 && !!recertificationNewProjectId;
    const isAtCloseOutNoRecertify = effectiveNextId === 24 && !recertificationNewProjectId;
    const nextStepDisplayName = isRecertifiedAndAtCloseOut
      ? 'Recertification started – open your new project'
      : isAtCloseOutNoRecertify
        ? 'Certificate created'
        : nextActivityInfo.name;
    const nextStepDisplayStatus = isRecertifiedAndAtCloseOut
      ? 'Recertification'
      : isAtCloseOutNoRecertify
        ? 'Completed'
        : nextActivityInfo.status;
    const nextStepDisplayResponsibility = isAtCloseOutNoRecertify
      ? 'CII'
      : nextActivityInfo.responsibility;

    // Build profile object
    const profile = {
      id: project._id.toString(),
      name: company.name,
      reg_id: company.reg_id || '',
      project_id: project.project_id || project._id.toString(),
      email: company.email,
      mobile: company.mobile,
      turnover: company.turnover || '',
      mst_sector_id: company.mst_sector_id || '',
      account_status: company.account_status,
      status_updated_at: company.status_updated_at
        ? company.status_updated_at.toISOString()
        : (company as any).updatedAt
          ? (company as any).updatedAt.toISOString()
          : new Date().toISOString(),
      process_type: project.process_type,
      proposal_document: project.proposal_document
        ? project.proposal_document.startsWith('http')
          ? project.proposal_document
          : `${baseUrl}/${project.proposal_document}`
        : null,
      feedback_document: project.feedback_document_url
        ? project.feedback_document_url.startsWith('http')
          ? project.feedback_document_url
          : `${baseUrl}/api/company/projects/${projectId}/feedback-document`
        : null,
      next_activities_id: effectiveNextId,
      nextActivitiesId: effectiveNextId,
      next_activity: nextStepDisplayName,
      next_activity_status: nextStepDisplayStatus,
      next_responsibility: nextStepDisplayResponsibility,
    };

    // Build current activity data (Latest Step Completed)
    // Show the latest completed milestone, or fallback to latest activity description
    const currentActivityData = latestCompletedMilestoneName
      ? {
          activity: latestCompletedMilestoneName,
          activity_status: 'Completed',
          responsibility: latestCompletedMilestone?.responsibility || milestoneResponsibilityMap[latestCompletedMilestoneNumber] || 'Company',
        }
      : currentActivity
        ? {
            activity: currentActivity.description,
            activity_status: 'Done',
            responsibility: 'Company',
          }
        : {
            activity: 'No activity yet',
            activity_status: 'Pending',
            responsibility: 'Company',
          };

    // Build work order data
    const companyWo = workOrder
      ? {
          wo_doc: workOrder.wo_doc
            ? workOrder.wo_doc.startsWith('http')
              ? workOrder.wo_doc
              : `${baseUrl}/${workOrder.wo_doc}`
            : null,
          wo_status: workOrder.wo_status || 0,
          wo_doc_status_updated_at: workOrder.wo_doc_status_updated_at
            ? workOrder.wo_doc_status_updated_at.toISOString()
            : (workOrder as any).updatedAt
              ? (workOrder as any).updatedAt.toISOString()
              : new Date().toISOString(),
        }
      : {
          wo_doc: null,
          wo_status: 0,
          wo_doc_status_updated_at: null,
        };

    // Build last activity data
    const lastActivityData = lastActivity
      ? {
          description: lastActivity.description,
          created_at: (lastActivity as any).createdAt
            ? (lastActivity as any).createdAt.toISOString()
            : new Date().toISOString(),
          milestone_flow: lastActivity.milestone_flow || project.next_activities_id - 1,
          milestone_completed: lastActivity.milestone_completed || false,
        }
      : {
          description: 'Project started',
          created_at: (project as any).createdAt
            ? (project as any).createdAt.toISOString()
            : new Date().toISOString(),
          milestone_flow: 1,
          milestone_completed: false,
        };

    // Build sector data
    const sectorData = sector
      ? {
          name: sector.name,
          group_name: sector.group_name || '',
        }
      : {
          name: '',
          group_name: '',
        };

    // Named step IDs for frontend tab visibility (Primary Data → Assessment → Site Visit → Certificate → Recertification)
    const milestoneStepIds = {
      primaryData: 12,    // CII Approved All Primary Data – show Primary Data tab when nextActivitiesId >= 12
      assessment: 13,     // All Assessment Documents Uploaded – show Assessment tab when nextActivitiesId >= 13
      siteVisit: 14,      // CII Approved All Assessment – show Assessor Visit tab when nextActivitiesId >= 14
      award: 15,          // CII Assigned an Assessor – show View Certificate when nextActivitiesId >= 15
      sustenance: 16,    // Preliminary Scoring – show Recertification when nextActivitiesId >= 16
    };

    const next_step = {
      id: effectiveNextId,
      name: nextStepDisplayName,
      status: nextStepDisplayStatus,
      responsibility: nextStepDisplayResponsibility,
    };
    const latest_step = {
      id: latestCompletedMilestoneNumber || 0,
      name: latestCompletedMilestoneName || currentActivityData.activity,
      status: latestCompletedMilestoneNumber != null && latestCompletedMilestoneNumber > 0 ? 'Completed' : (currentActivityData.activity_status === 'Done' ? 'Done' : 'Pending'),
      responsibility: currentActivityData.responsibility,
    };

    return {
      status: 'success',
      message: 'Quickview data loaded successfully',
      data: {
        profile,
        next_step,
        latest_step,
        ...(recertificationNewProjectId ? { recertification_new_project_id: recertificationNewProjectId } : {}),
        sector: sectorData,
        current_activity_data: currentActivityData,
        company_wo: companyWo,
        companies_facilitator: facilitatorData,
        companies_coordinator: coordinatorData,
        companies_assessors: assessorsData,
        companies_activty: activitiesData,
        milestoneSteps: Object.keys(milestoneSteps).reduce((acc, key) => {
          acc[key] = milestoneSteps[parseInt(key)].name;
          return acc;
        }, {} as Record<string, string>),
        milestoeSteps: Object.keys(milestoneSteps).reduce((acc, key) => {
          acc[key] = milestoneSteps[parseInt(key)].name;
          return acc;
        }, {} as Record<string, string>),
        milestoneStepIds,
        last_activity: lastActivityData,
        milestone_flow: {
          current_flow: currentFlow,
          milestone_steps: Object.keys(milestoneSteps).reduce((acc, key) => {
            const n = parseInt(key);
            acc[n] = milestoneSteps[n].name;
            return acc;
          }, {} as Record<number, string>),
          milestone_status: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].reduce((acc, flowNum) => {
            let status = 'pending';
            if (currentFlow > flowNum) status = 'completed';
            else if (currentFlow === flowNum) status = 'in_progress';
            acc[flowNum] = {
              flow: flowNum,
              step: milestoneSteps[flowNum]?.name ?? '',
              status,
            };
            return acc;
          }, {} as Record<number, { flow: number; step: string; status: string }>),
        },
      },
    };
  }

  /**
   * Upload proposal document (Admin function - can be called directly or via MongoDB)
   * This logs milestone 3: "CII Uploaded Proposal Document"
   */
  async uploadProposalDocument(
    companyId: string,
    projectId: string,
    file: Express.Multer.File,
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    // Use Laravel-compatible path: uploads/company/{projectId}/
    const relativePath = `uploads/company/${projectId}/${file.filename}`;
    const fullUrl = `${baseUrl}/${relativePath}`;

    // Save proposal document path
    project.proposal_document = fullUrl;
    await project.save();

    // Generate company registration ID if not exists (similar to Laravel flow)
    const company = await this.companyModel.findById(companyId);
    if (company && !company.reg_id) {
      // Generate reg_id (you can implement your own logic here)
      const regId = `REG${Date.now()}`;
      company.reg_id = regId;
      await company.save();
      console.log('[Proposal Document] Generated reg_id:', regId);
    }

    // LOG ACTIVITY 3: CII Uploaded Proposal Document
    // Use correct flow based on process_type (1 for CII, 3 for Facilitator)
    const flow = project.process_type === 'c' ? 1 : 3;
    
    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: 'CII Uploaded Proposal Document',
      activity_type: 'cii',
      milestone_flow: 3,
      milestone_completed: true,
    });

    // Create notification - send to correct recipient based on process_type
    // For CII process ('c'): notify company (type 'C')
    // For Facilitator process ('f'): notify facilitator (type 'F'); if no facilitator assigned, notify company (type 'C') so they still see it
    let notifyType: 'C' | 'F' = project.process_type === 'c' ? 'C' : 'F';
    let notifyUserId: string = companyId;

    if (project.process_type === 'f') {
      const facilitator = await this.companyFacilitatorModel.findOne({
        company_id: companyId,
        project_id: projectId,
      });
      if (facilitator && facilitator.facilitator_id) {
        notifyUserId = facilitator.facilitator_id.toString();
      } else {
        // No facilitator yet: notify company so they see the proposal notification
        notifyType = 'C';
        notifyUserId = companyId;
      }
    }

    console.log('[Proposal Document] Notification target:', {
      notifyType,
      notifyUserId,
      processType: project.process_type,
    });

    if (notifyUserId) {
      this.notificationsService
        .create(
          'Proposal document uploaded',
          `Proposal document has been uploaded for your project ${project.project_id || project._id.toString()}.`,
          notifyType,
          notifyUserId,
        )
        .catch((e) =>
          console.error('[Proposal Document] Notification failed:', e?.message || e),
        );
    }

    // Update next_activities_id to 4 (Company Will Upload Work order)
    project.next_activities_id = 4;
    await project.save();

    console.log('[Proposal Document] Uploaded successfully:', {
      projectId: projectId.toString(),
      documentUrl: fullUrl,
      next_activities_id: project.next_activities_id,
    });

    return {
      status: 'success',
      message: 'Proposal Document uploaded successfully',
      data: {
        document_url: fullUrl,
        document_filename: file.originalname,
        project_id: projectId,
        next_activities_id: project.next_activities_id,
      },
    };
  }

  /**
   * Get proposal document info
   */
  async getProposalDocument(companyId: string, projectId: string) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    if (!project.proposal_document) {
      return {
        status: 'success',
        message: 'Proposal document not uploaded yet',
        data: {
          has_document: false,
          document_url: null,
        },
      };
    }

    return {
      status: 'success',
      message: 'Proposal document retrieved successfully',
      data: {
        has_document: true,
        document_url: project.proposal_document,
        document_filename: project.proposal_document.split('/').pop() || 'proposal.pdf',
      },
    };
  }

  /**
   * Upload resource center document
   */
  async uploadResourceDocument(
    companyId: string,
    projectId: string,
    file: Express.Multer.File,
    title?: string,
    documentType?: string,
    description?: string,
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const relativePath = `uploads/resources/${projectId}/${file.filename}`;
    const fullUrl = `${baseUrl}/${relativePath}`;

    // Create resource document entry
    const resourceDoc = new this.companyResourceDocumentModel({
      company_id: companyId,
      project_id: projectId,
      document_url: fullUrl,
      document_filename: file.originalname,
      document_title: title || file.originalname,
      document_type: documentType || 'general',
      description: description || '',
      is_active: true,
    });

    await resourceDoc.save();

    if (documentType === 'assessment_submittal') {
      this.notificationsService
        .create(
          'Assessment Submittal Uploaded',
          `An assessment submittal has been uploaded: ${title || file.originalname}. GreenCo Team will review it.`,
          'C',
          companyId,
        )
        .catch((e) => console.error('Assessment submittal upload notification failed:', e));

      // If all 9 category tabs now have at least one document, send "all complete" notification (once per project)
      const ASSESSMENT_CATEGORY_CODES = ['GSC', 'IE', 'PSL', 'MS', 'EM', 'CBM', 'WTM', 'MRM', 'GBE'];
      const projectAny = project as any;
      if (!projectAny.assessment_submittals_complete_notified) {
        const docs = await this.companyResourceDocumentModel
          .find({
            project_id: projectId,
            document_type: 'assessment_submittal',
            is_active: true,
          })
          .select('description')
          .lean();
        const categoriesPresent = new Set((docs as any[]).map((d) => (d.description || '').trim()).filter(Boolean));
        const allPresent = ASSESSMENT_CATEGORY_CODES.every((code) => categoriesPresent.has(code));
        if (allPresent) {
          this.notificationsService
            .create(
              'All Assessment Submittals Uploaded',
              'You have uploaded documents for all assessment categories (GSC, IE, PSL, MS, EM, CBM, WTM, MRM, GBE). GreenCo Team will review them.',
              'C',
              companyId,
            )
            .catch((e) => console.error('All assessment submittals complete notification failed:', e));
          await this.projectModel.updateOne(
            { _id: projectId, company_id: companyId },
            { $set: { assessment_submittals_complete_notified: true } },
          );
        }
      }
    }

    console.log('[Resource Document] Uploaded successfully:', {
      projectId: projectId.toString(),
      documentUrl: fullUrl,
      documentTitle: title,
    });

    return {
      status: 'success',
      message: 'Resource document uploaded successfully',
      data: {
        id: resourceDoc._id.toString(),
        document_url: fullUrl,
        document_filename: file.originalname,
        document_title: title || file.originalname,
        document_type: documentType || 'general',
      },
    };
  }

  /**
   * Get all resource center documents for a project
   */
  async getResourceDocuments(companyId: string, projectId: string) {
    const cId = Types.ObjectId.isValid(companyId) ? new Types.ObjectId(companyId) : companyId;
    const pId = Types.ObjectId.isValid(projectId) ? new Types.ObjectId(projectId) : projectId;
    const project = await this.projectModel.findOne({
      _id: pId,
      company_id: cId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    const resourceDocs = await this.companyResourceDocumentModel
      .find({
        company_id: cId,
        project_id: pId,
        is_active: true,
      })
      .sort({ createdAt: -1 });

    return {
      status: 'success',
      message: 'Resource documents retrieved successfully',
      data: {
        documents: resourceDocs.map((doc) => ({
          id: doc._id.toString(),
          document_url: doc.document_url,
          document_filename: doc.document_filename,
          document_title: doc.document_title || doc.document_filename,
          document_type: doc.document_type || 'general',
          description: doc.description || '',
          uploaded_at: (doc as any).createdAt
            ? (doc as any).createdAt.toISOString()
            : new Date().toISOString(),
        })),
        count: resourceDocs.length,
      },
    };
  }

  /**
   * Update assessment submittal (resource document) approval status and/or remarks.
   */
  async updateResourceDocumentStatus(
    companyId: string,
    projectId: string,
    documentId: string,
    updates: { document_status?: number; document_remarks?: string },
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }
    const doc = await this.companyResourceDocumentModel.findOne({
      _id: documentId,
      project_id: projectId,
      document_type: 'assessment_submittal',
      is_active: true,
    });
    if (!doc) {
      throw new NotFoundException({ status: 'error', message: 'Assessment submittal not found' });
    }
    const set: any = { updatedAt: new Date() };
    if (updates.document_status !== undefined) set.document_status = updates.document_status;
    if (updates.document_remarks !== undefined) set.document_remarks = updates.document_remarks;
    await this.companyResourceDocumentModel.updateOne({ _id: documentId }, { $set: set });

    // In-app + email when not accepted (status 2)
    if (updates.document_status === 2) {
      const company = await this.companyModel.findById(companyId).lean();
      const cf = await this.companyFacilitatorModel.findOne({ company_id: companyId, project_id: projectId }).populate('facilitator_id').lean();
      const docDetails = (doc as any).description || (doc as any).document_type || 'Assessment submittal';
      const remarks = updates.document_remarks || (doc as any).document_remarks || '';
      const detail = `Document: ${docDetails}. ${remarks ? `Remarks: ${remarks}` : ''}`;
      this.notificationsService.create('Assessment submittal not accepted', detail, 'C', companyId).catch((e) => console.error('Checklist not-accepted notification failed:', e));
      if (company?.email) {
        this.mailService.sendChecklistDocNotAcceptedEmail(company.email, company.name || 'Company', detail).catch((e) => console.error('Checklist not-accepted email failed:', e));
      }
      if (cf && (cf as any).facilitator_id) {
        const fid = (cf as any).facilitator_id._id?.toString?.() || (cf as any).facilitator_id;
        this.notificationsService.create('Assessment submittal not accepted', detail, 'F', fid).catch((e) => console.error('Checklist not-accepted notification to F failed:', e));
        if ((cf as any).facilitator_id.email) {
          this.mailService.sendChecklistDocNotAcceptedEmail((cf as any).facilitator_id.email, (cf as any).facilitator_id.name || 'Facilitator', detail).catch((e) => console.error('Checklist not-accepted email failed:', e));
        }
      }
    }

    return {
      status: 'success',
      message: 'Assessment submittal updated successfully',
      data: { id: documentId, ...set },
    };
  }

  /**
   * Get Proposal/Work Order Documents (combined endpoint for Proposal/Work Order page)
   */
  async getProposalWorkOrderDocuments(companyId: string, projectId: string) {
    const [project, workOrder] = await Promise.all([
      this.projectModel.findOne({ _id: projectId, company_id: companyId }).lean(),
      this.companyWorkOrderModel
        .findOne({ company_id: companyId, project_id: projectId })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const response: any = { proposal_document: null, work_order: null };
    const projectAny = project as any;
    const workOrderAny = workOrder as any;

    const proposalDocValue = projectAny.proposal_document;
    const hasProposalDoc = proposalDocValue && 
                          typeof proposalDocValue === 'string' && 
                          proposalDocValue.trim().length > 0;
    
    if (hasProposalDoc) {
      response.proposal_document = {
        has_document: true,
        document_url: proposalDocValue.startsWith('http') ? proposalDocValue : `${baseUrl}/${proposalDocValue}`,
        document_filename: proposalDocValue.split('/').pop() || 'proposal.pdf',
        path: proposalDocValue,
        uploaded_at: projectAny.updatedAt?.toISOString?.() ?? projectAny.createdAt?.toISOString?.() ?? new Date().toISOString(),
      };
    } else {
      response.proposal_document = { has_document: false, document_url: null, document_filename: null };
    }

    if (workOrderAny?.wo_doc) {
      const woDocPath = workOrderAny.wo_doc.startsWith('/') ? workOrderAny.wo_doc.substring(1) : workOrderAny.wo_doc;
      const woPath = woDocPath.startsWith('http') ? woDocPath : `${baseUrl}/${woDocPath}`;
      response.work_order = {
        wo_doc: workOrderAny.wo_doc,
        wo_doc_url: woPath,
        wo_status: workOrderAny.wo_status ?? 0,
        wo_remarks: workOrderAny.wo_remarks || null,
        wo_doc_status_updated_at: workOrderAny.wo_doc_status_updated_at?.toISOString?.() ?? workOrderAny.updatedAt?.toISOString?.() ?? workOrderAny.createdAt?.toISOString?.() ?? new Date().toISOString(),
        uploaded_at: workOrderAny.createdAt?.toISOString?.() ?? new Date().toISOString(),
      };
    } else {
      response.work_order = null;
    }

    return {
      status: 'success',
      message: 'Documents retrieved successfully',
      data: response,
    };
  }

  /**
   * Create a proposal/work order notification for the company (used by dev/test button).
   * Chooses message based on which documents exist.
   */
  async createProposalWorkOrderNotification(
    companyId: string,
    projectId: string,
  ): Promise<{
    status: 'success';
    message: string;
    data: { title: string; content: string };
  }> {
    const [project, workOrder] = await Promise.all([
      this.projectModel.findOne({ _id: projectId, company_id: companyId }).lean(),
      this.companyWorkOrderModel
        .findOne({ company_id: companyId, project_id: projectId })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const hasProposal = !!(project as any).proposal_document;
    const hasWorkOrder = !!(workOrder as any)?.wo_doc;

    if (!hasProposal && !hasWorkOrder) {
      throw new BadRequestException({
        status: 'error',
        message: 'No proposal or work order document found for this project.',
      });
    }

    let title = '';
    let content = '';

    if (hasProposal && hasWorkOrder) {
      title = 'Proposal and Work Order submitted';
      content =
        'Your proposal and work order documents have been submitted and will be reviewed by CII.';
    } else if (hasProposal) {
      title = 'Proposal document submitted';
      content =
        'Your proposal document has been submitted and will be reviewed by CII.';
    } else {
      title = 'Work order document submitted';
      content =
        'Your work order document has been submitted and will be reviewed by CII.';
    }

    await this.notificationsService.create(title, content, 'C', companyId);

    return {
      status: 'success',
      message: 'Notification created',
      data: { title, content },
    };
  }

  /**
   * List all active coordinators (for admin to choose and assign).
   */
  async listCoordinators(): Promise<{
    status: 'success';
    message: string;
    data: { coordinators: Array<{ id: string; name: string; email: string }> };
  }> {
    const docs = await this.coordinatorModel
      .find({
        $or: [{ status: '1' }, { status: 1 }, { status: { $exists: false } }],
      })
      .sort({ name: 1 })
      .select('_id name email')
      .lean();

    const coordinators = (docs as any[]).map((c) => ({
      id: c._id.toString(),
      name: c.name,
      email: c.email,
    }));

    return {
      status: 'success',
      message: 'Coordinators loaded',
      data: { coordinators },
    };
  }

  /**
   * Get Launch And Training (Site Visit Report) page data.
   * Used by both consultant (upload page) and company (read-only view after upload).
   */
  async getLaunchAndTraining(companyId: string, projectId: string) {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId }).lean();
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }
    const projectAny = project as any;
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const docPath = projectAny.launch_training_document;
    const documentUrl = docPath
      ? (docPath.startsWith('http') ? docPath : `${baseUrl}/${docPath.replace(/^\//, '')}`)
      : null;
    const reportDate = projectAny.launch_training_report_date
      ? (typeof projectAny.launch_training_report_date === 'string'
          ? projectAny.launch_training_report_date
          : (projectAny.launch_training_report_date as Date)?.toISOString?.())
      : null;
    return {
      status: 'success',
      message: 'Launch and training data retrieved successfully',
      data: {
        project_id: projectId,
        launch_training_document: documentUrl,
        launch_training_report_date: reportDate,
        document_filename: documentUrl ? docPath?.split('/').pop() ?? null : null,
      },
    };
  }

  /**
   * Get Resources Center Documents (matches Laravel/Blade Resources Center spec)
   * Returns: profile documents, work order, launch/training, hand holding 1–3, assessment submittals.
   * Response shape aligned with RESOURCES_CENTER_COMPLETE.md for frontend consumption.
   */
  /** Approval status labels for assessment submittals (0–3). */
  private getAssessmentSubmittalStatusLabels(): Record<number, string> {
    return { 0: 'Pending', 1: 'Accepted', 2: 'Not Accepted', 3: 'Under Review' };
  }

  async getResourcesCenterDocuments(companyId: string, projectId: string) {
    const pId = Types.ObjectId.isValid(projectId) ? new Types.ObjectId(projectId) : projectId;
    const cId = Types.ObjectId.isValid(companyId) ? new Types.ObjectId(companyId) : companyId;
    const project = await this.projectModel.findOne({ _id: pId, company_id: cId }).lean();
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const [workOrder, resourceDocs, company] = await Promise.all([
      this.companyWorkOrderModel
        .findOne({ company_id: cId, project_id: pId })
        .sort({ createdAt: -1 })
        .lean(),
      this.companyResourceDocumentModel
        .find({ project_id: pId, is_active: true })
        .sort({ createdAt: -1 })
        .lean(),
      this.companyModel.findById(companyId).select('mst_sector_id').lean(),
    ]);

    const companyAny = company as any;
    let sectorDoc: { name?: string; group_name?: string } | null = null;
    if (companyAny?.mst_sector_id) {
      sectorDoc = await this.sectorModel.findById(companyAny.mst_sector_id).select('name group_name').lean() as any;
    }
    const group = sectorDoc?.group_name ?? '';
    const sectorName = sectorDoc?.name ?? '';

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

    const toUrl = (path: string | undefined): string | null => {
      if (!path) return null;
      return path.startsWith('http') ? path : `${baseUrl}/${path.replace(/^\//, '')}`;
    };

    const projectAny = project as any;

    const documents: {
      proposal_document: string | null;
      work_order_document: string | null;
      launch_training_document: string | null;
      launch_training_report_date: string | null;
      hand_holding_document: string | null;
      hand_holding_document2: string | null;
      hand_holding_document3: string | null;
        assessment_submittals: Array<{
        id: string;
        document: string;
        document_title?: string;
        // document_status kept for backend use, but frontend should ignore it
        document_status: number;
        // approval_status no longer used (always empty string so UI does not show Pending/Accepted/etc.)
        approval_status: string;
        remarks: string | null;
        criterion_sc: string;
        criterion_name: string;
        created_at?: string;
        updated_at?: string;
      }>;
    } = {
      proposal_document: toUrl(projectAny.proposal_document) ?? null,
      work_order_document: (workOrder as any)?.wo_doc ? toUrl((workOrder as any).wo_doc) : null,
      launch_training_document: toUrl(projectAny.launch_training_document) ?? null,
      launch_training_report_date: projectAny.launch_training_report_date
        ? (typeof projectAny.launch_training_report_date === 'string'
            ? projectAny.launch_training_report_date
            : (projectAny.launch_training_report_date as Date)?.toISOString?.()) ?? null
        : null,
      hand_holding_document: toUrl(projectAny.hand_holding_document) ?? null,
      hand_holding_document2: toUrl(projectAny.hand_holding_document2) ?? null,
      hand_holding_document3: toUrl(projectAny.hand_holding_document3) ?? null,
      assessment_submittals: [],
    };

    for (const doc of resourceDocs as any[]) {
      if (!doc.document_url) continue;
      const docUrl = doc.document_url.startsWith('http')
        ? doc.document_url
        : `${baseUrl}/${doc.document_url.replace(/^\//, '')}`;
      const docType = doc.document_type || 'general';

      if (docType === 'launch_training' && !documents.launch_training_document) {
        documents.launch_training_document = docUrl;
      } else if (docType === 'hand_holding_1' && !documents.hand_holding_document) {
        documents.hand_holding_document = docUrl;
      } else if (docType === 'hand_holding_2' && !documents.hand_holding_document2) {
        documents.hand_holding_document2 = docUrl;
      } else if (docType === 'hand_holding_3' && !documents.hand_holding_document3) {
        documents.hand_holding_document3 = docUrl;
      } else if (docType === 'assessment_submittal') {
        const docAny = doc as any;
        documents.assessment_submittals.push({
          id: doc._id.toString(),
          document: docUrl,
          document_title: doc.document_title || doc.document_filename,
          // Do not surface status – frontend should not show Pending/Accepted/Not Accepted
          document_status: 0,
          approval_status: '',
          remarks: doc.document_remarks ?? null,
          criterion_sc: doc.description || '',
          criterion_name: doc.description || '',
          created_at: docAny.createdAt?.toISOString?.(),
          updated_at: docAny.updatedAt?.toISOString?.(),
        });
      }
    }

    return {
      status: 'success',
      message: 'Resources center documents retrieved successfully',
      data: {
        group,
        sector: sectorName,
        // approval_status_options removed so frontend does not render status dropdown
        documents,
        process_type: projectAny.process_type || 'c',
      },
    };
  }

  /**
   * Get Assignment Details (Coordinators and Facilitator)
   */
  async getAssignmentDetails(companyId: string, projectId: string) {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId }).lean();
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const [coordinators, facilitator] = await Promise.all([
      this.companyCoordinatorModel.find({ company_id: companyId, project_id: projectId }).lean(),
      this.companyFacilitatorModel.findOne({ company_id: companyId, project_id: projectId }).lean(),
    ]);

    const coordinatorIds = (coordinators as any[]).map((c) => c.coordinator_id).filter(Boolean);
    const coordinatorDetails = coordinatorIds.length
      ? await this.coordinatorModel.find({ _id: { $in: coordinatorIds } }).select('name email').lean()
      : [];
    const coordMap = new Map(coordinatorDetails.map((c: any) => [c._id.toString(), c]));

    const response: any = { coordinators: [], facilitator: null };

    for (const coord of coordinators as any[]) {
      if (coord.coordinator_id) {
        const detail = coordMap.get(coord.coordinator_id.toString());
        if (detail) {
          response.coordinators.push({ name: detail.name, email: detail.email });
        }
      }
    }

    if (facilitator && (facilitator as any).facilitator_id) {
      const facilitatorDetail = await this.facilitatorModel
        .findById((facilitator as any).facilitator_id)
        .select('name email')
        .lean();
      if (facilitatorDetail) {
        const contractDocStatus = (facilitator as any).contract_doc_status || 0;
        response.facilitator = {
          name: facilitatorDetail.name,
          email: facilitatorDetail.email,
          contract_fee: (facilitator as any).contract_fee || 0,
          contract_doc_status: contractDocStatus,
          contract_status: contractDocStatus === 1 ? 'Signed' : contractDocStatus === 0 ? 'Assigned' : 'Not Assigned',
          contract_status_label: contractDocStatus === 1 ? 'Contract Signed' : contractDocStatus === 0 ? 'Assigned - Pending Signature' : 'Not Assigned',
        };
      }
    }

    return { status: 'success', message: 'Assignment details retrieved successfully', data: response };
  }

  /**
   * Get invoices for project by type (Payments/Proforma = per_inv, Tax Invoices = inv).
   */
  async getInvoices(
    companyId: string,
    projectId: string,
    paymentFor: 'per_inv' | 'inv',
  ) {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId }).lean();
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const invoices = await this.companyInvoiceModel
      .find({
        company_id: companyId,
        project_id: projectId,
        payment_for: paymentFor,
      })
      .sort({ createdAt: -1 })
      .lean();

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const toUrl = (path: string | undefined) => {
      if (!path) return null;
      return path.startsWith('http') ? path : `${baseUrl}/${path.replace(/^\//, '')}`;
    };

    const list = invoices.map((inv: any) => ({
      id: inv._id.toString(),
      payment_for: inv.payment_for,
      invoice_document: toUrl(inv.invoice_document),
      invoice_document_filename: inv.invoice_document_filename,
      payable_amount: inv.payable_amount ?? 0,
      tax_amount: inv.tax_amount ?? 0,
      total_amount: inv.total_amount ?? 0,
      payment_type: inv.payment_type ?? null,
      payment_status: inv.payment_status ?? 0,
      trans_id: inv.trans_id ?? null,
      offline_tran_doc: inv.offline_tran_doc ? toUrl(inv.offline_tran_doc) : null,
      offline_tran_doc_filename: inv.offline_tran_doc_filename ?? null,
      approval_status: inv.approval_status ?? 0,
      approval_status_label: INVOICE_APPROVAL_STATUS[inv.approval_status ?? 0] ?? 'Pending',
      approval_status_color: INVOICE_APPROVAL_STATUS_COLORS[inv.approval_status ?? 0] ?? 'warning',
      created_at: inv.createdAt,
      updated_at: inv.updatedAt,
    }));

    return {
      status: 'success',
      message: paymentFor === PAYMENT_FOR_PROFORMA ? 'Proforma invoices retrieved' : 'Tax invoices retrieved',
      data: {
        invoices: list,
        approval_status_labels: INVOICE_APPROVAL_STATUS,
        approval_status_colors: INVOICE_APPROVAL_STATUS_COLORS,
      },
    };
  }

  /**
   * CII uploads PI (Proforma Invoice) or Tax Invoice document — next step after Assign Project Co-Ordinator / Resource Center.
   * Finds or creates an invoice for (project, payment_for) and sets invoice_document.
   */
  async uploadInvoiceDocument(
    companyId: string,
    projectId: string,
    paymentFor: 'per_inv' | 'inv',
    file: Express.Multer.File,
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    let invoice = await this.companyInvoiceModel.findOne({
      company_id: companyId,
      project_id: projectId,
      payment_for: paymentFor,
    });

    if (!invoice) {
      invoice = await this.companyInvoiceModel.create({
        company_id: companyId,
        project_id: projectId,
        payment_for: paymentFor,
        payable_amount: 0,
        tax_amount: 0,
        total_amount: 0,
      });
    }

    const relativePath = `uploads/company/${companyId}/invoices/${file.filename}`;
    invoice.invoice_document = relativePath;
    invoice.invoice_document_filename = file.originalname;
    await invoice.save();

    // LOG ACTIVITY 8: CII uploaded the PI/Tax Invoice
    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: `${paymentFor === PAYMENT_FOR_PROFORMA ? 'Proforma Invoice (PI)' : 'Tax Invoice'} uploaded`,
      activity_type: 'cii',
      milestone_flow: 8,
      milestone_completed: true,
    });

    // Advance next_activities_id to 9 (Company Paid Proforma Invoice) if still at/before 8
    const currentNext =
      typeof (project as any).next_activities_id === 'number'
        ? (project as any).next_activities_id
        : 0;
    if (currentNext < 9) {
      (project as any).next_activities_id = 9;
      await project.save();
    }

    const company = await this.companyModel.findById(companyId).lean();
    const projectCode = (project as any).project_id || projectId;
    const invoiceLabel = paymentFor === PAYMENT_FOR_PROFORMA ? 'Proforma Invoice document' : 'Invoice document';

    // In-app: notify Company (C)
    this.notificationsService
      .create(
        `GreenCo Team has raised the ${paymentFor === PAYMENT_FOR_PROFORMA ? 'Proforma Invoice' : 'Invoice'} document`,
        `Company ${company?.name || 'N/A'} ${invoiceLabel} has been raised by GreenCo Team`,
        'C',
        companyId,
      )
      .catch((e) => console.error('Invoice notification failed:', e));

    // In-app + email: notify Facilitator (F) if facilitator process
    const cf = await this.companyFacilitatorModel.findOne({ company_id: companyId, project_id: projectId }).populate('facilitator_id').lean();
    if (cf && (cf as any).facilitator_id) {
      const fid = (cf as any).facilitator_id._id?.toString?.() || (cf as any).facilitator_id;
      this.notificationsService
        .create(
          `GreenCo Team has raised the ${paymentFor === PAYMENT_FOR_PROFORMA ? 'Proforma Invoice' : 'Invoice'} document`,
          `Company ${company?.name || 'N/A'} ${invoiceLabel} has been raised by GreenCo Team`,
          'F',
          fid,
        )
        .catch((e) => console.error('Invoice notification to facilitator failed:', e));
      if ((cf as any).facilitator_id.email) {
        this.mailService.sendInvoiceRaisedEmail((cf as any).facilitator_id.email, (cf as any).facilitator_id.name || 'Facilitator', invoiceLabel, projectCode).catch((e) => console.error('Invoice email to facilitator failed:', e));
      }
    }
    if (company?.email) {
      this.mailService.sendInvoiceRaisedEmail(company.email, company.name || 'Company', invoiceLabel, projectCode).catch((e) => console.error('Invoice email to company failed:', e));
    }

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const documentUrl = relativePath.startsWith('http') ? relativePath : `${baseUrl}/${relativePath.replace(/^\//, '')}`;

    return {
      status: 'success',
      message: paymentFor === PAYMENT_FOR_PROFORMA ? 'Proforma Invoice uploaded successfully' : 'Tax Invoice uploaded successfully',
      data: {
        invoice_id: invoice._id.toString(),
        payment_for: invoice.payment_for,
        invoice_document: documentUrl,
        invoice_document_filename: invoice.invoice_document_filename,
      },
    };
  }

  /**
   * Submit payment for an invoice (payment type, transaction ID, supporting document).
   * File upload to uploads/company/{company_id}/; updates CompanyInvoice and optionally activity log.
   */
  async submitPayment(
    companyId: string,
    projectId: string,
    invoiceId: string,
    dto: SubmitPaymentDto,
    file?: Express.Multer.File,
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const invoice = await this.companyInvoiceModel.findOne({
      _id: invoiceId,
      company_id: companyId,
      project_id: projectId,
    });
    if (!invoice) {
      throw new NotFoundException({ status: 'error', message: 'Invoice not found' });
    }

    if (dto.payment_type === 'Offline') {
      if (!dto.trans_id?.trim()) {
        throw new BadRequestException({
          status: 'error',
          message: 'Transaction ID is required when payment mode is Offline',
        });
      }
      if (!file) {
        throw new BadRequestException({
          status: 'error',
          message: 'Supporting document is required when payment mode is Offline (PDF, JPG, JPEG, PNG)',
        });
      }
    }

    const relativePath = file
      ? `uploads/company/${companyId}/${file.filename}`
      : undefined;

    invoice.payment_type = dto.payment_type;
    invoice.trans_id = dto.payment_type === 'Offline' ? dto.trans_id?.trim() : undefined;
    if (relativePath) {
      invoice.offline_tran_doc = relativePath;
      invoice.offline_tran_doc_filename = file!.originalname;
    }
    invoice.payment_status = 1; // Mark as paid/submitted
    invoice.approval_status = 0; // Pending approval when submitted
    await invoice.save();

    const paymentDescription = `Payment submitted for invoice (${invoice.payment_for === PAYMENT_FOR_PROFORMA ? 'Proforma' : 'Tax Invoice'}): ${dto.payment_type}${dto.trans_id ? ` - ${dto.trans_id}` : ''}`;

    // Activity log
    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: paymentDescription,
      activity_type: 'company',
      // For Proforma payment, mark milestone 9 (Company Paid Proforma Invoice)
      milestone_flow: invoice.payment_for === PAYMENT_FOR_PROFORMA ? 9 : undefined,
      milestone_completed: invoice.payment_for === PAYMENT_FOR_PROFORMA ? true : undefined,
    });

    // When company pays Proforma invoice, advance next_activities_id to 10 (CII Acknowledged Proforma Invoice)
    if (invoice.payment_for === PAYMENT_FOR_PROFORMA) {
      const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId });
      if (project) {
        const currentNext =
          typeof (project as any).next_activities_id === 'number'
            ? (project as any).next_activities_id
            : 0;
        if (currentNext < 10) {
          (project as any).next_activities_id = 10;
          await project.save();
        }
      }
    }

    return {
      status: 'success',
      message: 'Payment submitted successfully',
      data: {
        invoice_id: invoice._id.toString(),
        payment_type: invoice.payment_type,
        payment_status: invoice.payment_status,
        approval_status: invoice.approval_status,
      },
    };
  }

  /**
   * Update invoice approval status (0=Pending, 1=Approved, 2=Rejected, 3=Under Review).
   */
  async updateInvoiceApprovalStatus(
    companyId: string,
    projectId: string,
    invoiceId: string,
    approvalStatus: number,
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const invoice = await this.companyInvoiceModel.findOne({
      _id: invoiceId,
      company_id: companyId,
      project_id: projectId,
    });
    if (!invoice) {
      throw new NotFoundException({ status: 'error', message: 'Invoice not found' });
    }

    invoice.approval_status = approvalStatus;
    await invoice.save();

    const labels = ['Pending', 'Approved', 'Rejected', 'Under Review'];
    const statusLabel = labels[approvalStatus] ?? 'Pending';

    // When Proforma is approved, mark milestone 10 (CII Acknowledged Proforma Invoice) and move to next step
    if (approvalStatus === 1 && invoice.payment_for === PAYMENT_FOR_PROFORMA) {
      await this.companyActivityModel.create({
        company_id: companyId,
        project_id: projectId,
        description: 'CII Acknowledged Proforma Invoice',
        activity_type: 'cii',
        milestone_flow: 10,
        milestone_completed: true,
      });

      const currentNext =
        typeof (project as any).next_activities_id === 'number'
          ? (project as any).next_activities_id
          : 0;
      // Next after 10 is 11 (Company Uploaded All Primary Data)
      if (currentNext < 11) {
        (project as any).next_activities_id = 11;
        await project.save();
      }
    }

    // When Approved (1) or Rejected (2), notify company and facilitator + email
    if (approvalStatus === 1 || approvalStatus === 2) {
      const company = await this.companyModel.findById(companyId).lean();
      const status = approvalStatus === 1 ? 'Approved' : 'DisApproved';
      const isProforma = invoice.payment_for === PAYMENT_FOR_PROFORMA;
      const companyName = company?.name || 'N/A';
      const title = isProforma
        ? `Proforma Invoice ${status}`
        : `GreenCo Team has ${status} the payment from company`;
      const content = isProforma
        ? `Proforma Invoice has been ${status.toLowerCase()} for company ${companyName}. ${approvalStatus === 1 ? 'Next: Site Visit document upload, then Primary Data Form.' : ''}`
        : `GreenCo Team has ${status} the payment from company ${companyName}`;
      this.notificationsService
        .create(title, content, 'C', companyId)
        .catch((e) => console.error('Payment status notification failed:', e));
      if (company?.email) {
        this.mailService.sendPaymentApprovalEmail(company.email, company.name || 'Company', status as 'Approved' | 'DisApproved').catch((e) => console.error('Payment approval email failed:', e));
      }
      const cf = await this.companyFacilitatorModel.findOne({ company_id: companyId, project_id: projectId }).populate('facilitator_id').lean();
      if (cf && (cf as any).facilitator_id) {
        const fid = (cf as any).facilitator_id._id?.toString?.() || (cf as any).facilitator_id;
        this.notificationsService
          .create(title, content, 'F', fid)
          .catch((e) => console.error('Payment status notification to facilitator failed:', e));
        if ((cf as any).facilitator_id.email) {
          this.mailService.sendPaymentApprovalEmail((cf as any).facilitator_id.email, (cf as any).facilitator_id.name || 'Facilitator', status as 'Approved' | 'DisApproved').catch((e) => console.error('Payment approval email to facilitator failed:', e));
        }
      }
    }

    return {
      status: 'success',
      message: 'Approval status updated',
      data: {
        invoice_id: invoice._id.toString(),
        approval_status: invoice.approval_status,
        approval_status_label: statusLabel,
      },
    };
  }

  /**
   * Upload Work Order Document (Company uploads)
   */
  async uploadWorkOrderDocument(
    companyId: string,
    projectId: string,
    file: Express.Multer.File,
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    // Check if work order already exists (for re-upload case)
    const existingWorkOrder = await this.companyWorkOrderModel
      .findOne({
        company_id: companyId,
        project_id: projectId,
      })
      .sort({ createdAt: -1 });

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    // Use Laravel-compatible path: uploads/companyproject/{projectId}/
    const relativePath = `uploads/companyproject/${projectId}/${file.filename}`;
    const fullUrl = `${baseUrl}/${relativePath}`;

    // Create or update work order document
    let workOrder;
    const isReUpload = existingWorkOrder && existingWorkOrder.wo_status === 2;

    if (existingWorkOrder && isReUpload) {
      // Update existing work order (re-upload after rejection)
      existingWorkOrder.wo_doc = relativePath;
      existingWorkOrder.wo_status = 0; // Reset to Under Review
      existingWorkOrder.wo_remarks = null; // Clear previous remarks
      await existingWorkOrder.save();
      workOrder = existingWorkOrder;
    } else {
      // Create new work order document
      workOrder = await this.companyWorkOrderModel.create({
        company_id: companyId,
        project_id: projectId,
        wo_doc: relativePath,
        wo_status: 0, // Under Review
        wo_remarks: null,
      });
    }

    // LOG ACTIVITY 4: Company Uploaded Work Order Document
    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: isReUpload 
        ? 'Company Re-Uploaded Work Order Document' 
        : 'Company Uploaded Work Order Document',
      activity_type: 'company',
      milestone_flow: 4,
      milestone_completed: true,
    });

    // Update next_activities_id to 5 (CII will Approved/Rejected Work Order)
    project.next_activities_id = 5;
    await project.save();

    // Get coordinator for notifications (if exists)
    const coordinator = await this.companyCoordinatorModel
      .findOne({
        company_id: companyId,
        project_id: projectId,
      })
      .sort({ createdAt: -1 });

    console.log('[Work Order Upload] Document uploaded successfully:', {
      projectId: projectId.toString(),
      documentUrl: fullUrl,
      isReUpload,
      next_activities_id: project.next_activities_id,
    });

    // In-app notification: work order uploaded (to company so they see confirmation)
    this.notificationsService
      .create(
        isReUpload ? 'Work order re-uploaded' : 'Work order submitted',
        isReUpload
          ? 'You have re-uploaded the work order document. It will be reviewed by CII.'
          : 'You have submitted the work order document. It will be reviewed by CII.',
        'C',
        companyId,
      )
      .catch((e) =>
        console.error('[Work Order Upload] Notification failed:', e?.message || e),
      );

    return {
      status: 'success',
      message: isReUpload 
        ? 'Work Order Document re-uploaded successfully' 
        : 'Work Order Document uploaded successfully',
      data: {
        document_url: fullUrl,
        document_filename: file.originalname,
        project_id: projectId,
        wo_status: 0, // Under Review
        next_activities_id: project.next_activities_id,
      },
    };
  }

  /**
   * Upload Launch And Training (Site Visit Report) – consultant/facilitator upload.
   * Saves to uploads/companyproject/launchAndTraining/{company_id}/, updates companies_projects,
   * and logs activity 63 (Consultant Uploaded Site Visit Report).
   */
  async uploadLaunchAndTraining(
    companyId: string,
    projectId: string,
    file: Express.Multer.File,
    launchTrainingReportDate?: string,
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const relativePath = `uploads/companyproject/launchAndTraining/${companyId}/${file.filename}`;
    const fullUrl = `${baseUrl}/${relativePath}`;

    const reportDate = launchTrainingReportDate
      ? (() => {
          const d = new Date(launchTrainingReportDate);
          return isNaN(d.getTime()) ? undefined : d;
        })()
      : undefined;

    (project as any).launch_training_document = relativePath;
    if (reportDate) (project as any).launch_training_report_date = reportDate;
    await project.save();

    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: 'Consultant Uploaded Site Visit Report',
      activity_type: 'company',
      milestone_flow: 63,
      milestone_completed: true,
    });

    // In-app: notify Company (C)
    const company = await this.companyModel.findById(companyId).lean();
    this.notificationsService
      .create(
        'Site Visit Report uploaded',
        'The Site Visit Report (Launch & Training) has been uploaded for your project. You can view it in the portal.',
        'C',
        companyId,
      )
      .catch((err) => console.error('Site visit notification failed:', err));

    // Email: notify company that site visit report has been uploaded
    this.mailService
      .sendSiteVisitReportUploadedEmail(company?.email, company?.name || 'Company')
      .catch((err) => console.error('Site visit report email failed:', err));

    return {
      status: 'success',
      message: 'Launch And Training Program uploaded Successfully!',
      data: {
        document_url: fullUrl,
        document_filename: file.originalname,
        project_id: projectId,
        launch_training_report_date: reportDate?.toISOString?.() ?? launchTrainingReportDate ?? null,
      },
    };
  }

  /**
   * Approve/Reject Work Order Document (Admin action)
   */
  async approveWorkOrder(
    companyId: string,
    projectId: string,
    workOrderId: string,
    dto: { wo_status: number; wo_remarks?: string },
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    const workOrder = await this.companyWorkOrderModel.findOne({
      _id: workOrderId,
      company_id: companyId,
      project_id: projectId,
    });

    if (!workOrder) {
      throw new NotFoundException({
        status: 'error',
        message: 'Work order document not found',
      });
    }

    // Update work order status
    console.log('[Work Order Approval] Before Update:', {
      workOrderId: workOrder._id?.toString(),
      current_wo_status: workOrder.wo_status,
      new_wo_status: dto.wo_status,
      dto: dto,
    });

    workOrder.wo_status = dto.wo_status;
    workOrder.wo_remarks = dto.wo_status === 2 ? dto.wo_remarks || null : null;
    workOrder.wo_doc_status_updated_at = new Date();
    
    const savedWorkOrder = await workOrder.save();
    
    console.log('[Work Order Approval] After Save:', {
      workOrderId: savedWorkOrder._id?.toString(),
      saved_wo_status: savedWorkOrder.wo_status,
      saved_wo_status_type: typeof savedWorkOrder.wo_status,
      saved_wo_remarks: savedWorkOrder.wo_remarks,
      saved_wo_doc_status_updated_at: savedWorkOrder.wo_doc_status_updated_at,
    });

    // Verify the save by querying again
    const verifyWorkOrder = await this.companyWorkOrderModel.findById(workOrder._id);
    console.log('[Work Order Approval] Verification Query:', {
      workOrderId: verifyWorkOrder?._id?.toString(),
      verified_wo_status: verifyWorkOrder?.wo_status,
      verified_wo_status_type: typeof verifyWorkOrder?.wo_status,
    });

    // If approved, generate reg_id if not exists
    if (dto.wo_status === 1) {
      const company = await this.companyModel.findById(companyId);
      if (company && !company.reg_id) {
        const regId = `REG${Date.now()}`;
        company.reg_id = regId;
        await company.save();
        console.log('[Work Order Approval] Generated reg_id:', regId);
      }

      // Advance next_activities_id to 6 (Assignment completed → Launch & Training tab)
      const currentNext =
        typeof (project as any).next_activities_id === 'number'
          ? (project as any).next_activities_id
          : 0;
      if (currentNext < 6) {
        (project as any).next_activities_id = 6;
        await project.save();
      }
    }

    // LOG ACTIVITY 5: CII Approved/Rejected Work Order Document
    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: dto.wo_status === 1
        ? 'CII Approved Work Order Document'
        : 'CII Rejected Work Order Document',
      activity_type: 'cii',
      milestone_flow: 5,
      milestone_completed: dto.wo_status === 1,
    });

    // Notify the company that owns the project (user_id must be project's company_id, notify_type 'C')
    const projectCompanyId = (project.company_id || workOrder.company_id)?.toString?.() || companyId;
    if (dto.wo_status === 1 && projectCompanyId) {
      this.notificationsService
        .create(
          'Work order approved',
          `Your work order has been approved by CII for project ${project.project_id || projectId}. You can proceed to the next step.`,
          'C',
          projectCompanyId,
        )
        .catch((e) =>
          console.error('[Work Order Approval] Notification failed:', e?.message || e),
        );
    } else if (dto.wo_status === 2 && projectCompanyId) {
      this.notificationsService
        .create(
          'Work order rejected',
          `Your work order was not accepted.${dto.wo_remarks ? ` Remarks: ${dto.wo_remarks}` : ''} You may re-upload from the Proposal/Work Order tab.`,
          'C',
          projectCompanyId,
        )
        .catch((e) =>
          console.error('[Work Order Approval] Notification failed:', e?.message || e),
        );
    }

    console.log('[Work Order Approval] Status updated:', {
      projectId: projectId.toString(),
      wo_status: dto.wo_status,
      next_activities_id: project.next_activities_id,
    });

    return {
      status: 'success',
      message: dto.wo_status === 1
        ? 'Work Order Document approved successfully'
        : 'Work Order Document rejected',
      data: {
        wo_status: dto.wo_status,
        wo_remarks: dto.wo_status === 2 ? dto.wo_remarks : null,
        next_activities_id: project.next_activities_id,
      },
    };
  }

  /**
   * Get Project Details (for tab visibility)
   */
  async getProjectDetails(companyId: string, projectId: string) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    // Get facilitator
    const facilitator = await this.companyFacilitatorModel.findOne({
      company_id: companyId,
      project_id: projectId,
    });

    // Get work order (latest)
    const workOrder = await this.companyWorkOrderModel
      .findOne({
        company_id: companyId,
        project_id: projectId,
      })
      .sort({ createdAt: -1 });

    return {
      status: 'success',
      message: 'Project details retrieved successfully',
      data: {
        profile_update: (project as any).profile_update || 0,
        proposal_document: project.proposal_document || null,
        process_type: project.process_type || 'c',
        facilitator: !!facilitator,
        work_order: workOrder
          ? {
              wo_status: workOrder.wo_status || null,
            }
          : null,
        next_activities_id: project.next_activities_id || null,
        next_activity: null, // Can be derived from milestone steps if needed
      },
    };
  }

  /**
   * Create Project Code (Milestone 6)
   * Admin creates a unique project code for a company project
   */
  async createProjectCode(
    companyId: string,
    projectId: string,
    projectCode: string,
  ) {
    // Validate project exists and belongs to company
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    // Validate project code is unique (check in both companyprojects and companies)
    const existingProject = await this.projectModel.findOne({
      project_id: projectCode,
      _id: { $ne: projectId }, // Exclude current project
    });

    if (existingProject) {
      throw new BadRequestException({
        status: 'error',
        message: 'Project code already exists. Please use a unique project code.',
      });
    }

    // Check if company already has this project_id
    const company = await this.companyModel.findById(companyId);
    if (company) {
      // Note: In MongoDB, we might not need to update company.project_id
      // as it's typically stored per project, not per company
      // But we'll log it for reference
      console.log('[Create Project Code] Company found:', {
        companyId: company._id.toString(),
        companyName: company.name,
      });
    }

    // Update project with project code and next_activities_id
    project.project_id = projectCode;
    project.next_activities_id = 7; // Assign Project Co-Ordinator
    await project.save();

    console.log('[Create Project Code] Project updated:', {
      projectId: project._id.toString(),
      projectCode: projectCode,
      next_activities_id: project.next_activities_id,
    });

    // In-app: notify Company (GreenCo Team has create new project id)
    this.notificationsService
      .create(
        'GreenCo Team has create new project id',
        `Company ${company.name} GreenCo Team has create new project id`,
        'C',
        companyId,
      )
      .catch((err) => console.error('Notification create failed:', err));

    // LOG ACTIVITY 6: CII to provide Project Code
    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: 'CII to provide Project Code',
      activity_type: 'cii',
      milestone_flow: 6,
      milestone_completed: true,
    });

    console.log('[Create Project Code] Activity logged (Milestone 6)');

    // TODO: Send notification to company
    // Notify Company about project code creation
    // This would typically use a notification service/model

    return {
      status: 'success',
      message: 'Project code created successfully',
      data: {
        project_id: projectCode,
        next_activities_id: project.next_activities_id,
        next_activity: 'Assign Project Co‑Ordinator',
        next_activity_status: 'Pending',
        next_responsibility: 'CII',
      },
    };
  }

  /**
   * Assign Coordinator (Milestone 7)
   * Admin assigns a coordinator to a company project
   */
  async assignCoordinator(
    companyId: string,
    projectId: string,
    coordinatorId: string,
  ) {
    // Validate project exists and belongs to company
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    // Validate coordinator exists
    const coordinator = await this.coordinatorModel.findById(coordinatorId);
    if (!coordinator) {
      throw new NotFoundException({
        status: 'error',
        message: 'Coordinator not found',
      });
    }

    // Check if coordinator is already assigned to this project
    const existingAssignment = await this.companyCoordinatorModel.findOne({
      company_id: companyId,
      project_id: projectId,
      coordinator_id: coordinatorId,
    });

    if (existingAssignment) {
      throw new BadRequestException({
        status: 'error',
        message: 'Coordinator is already assigned to this project',
      });
    }

    // Create coordinator assignment
    await this.companyCoordinatorModel.create({
      company_id: companyId,
      project_id: projectId,
      coordinator_id: coordinatorId,
    });

    console.log('[Assign Coordinator] Coordinator assigned:', {
      projectId: projectId.toString(),
      coordinatorId: coordinatorId,
      coordinatorName: coordinator.name,
    });

    // Update next_activities_id to 8 (CII uploaded the PI/Tax Invoice)
    project.next_activities_id = 8;
    await project.save();

    // LOG ACTIVITY 7: Assign Project Co-Ordinator
    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: 'Assign Project Co‑Ordinator',
      activity_type: 'cii',
      milestone_flow: 7,
      milestone_completed: true,
    });

    console.log('[Assign Coordinator] Activity logged (Milestone 7)');

    // In-app: notify Company (C)
    this.notificationsService
      .create(
        'GreenCo Team has assigned a Coordinator for your Project',
        `Coordinator ${coordinator.name} has been assigned for your project by GreenCo Team`,
        'C',
        companyId,
      )
      .catch((err) => console.error('Notification to company failed:', err));

    // In-app: notify Coordinator (CO) so they see assignment in their portal (if used)
    this.notificationsService
      .create(
        'You have been assigned as Coordinator for a Project',
        `You have been assigned as Coordinator for project ${project.project_id || project._id.toString()}.`,
        'CO',
        coordinator._id.toString(),
      )
      .catch((err) => console.error('Notification to coordinator failed:', err));

    return {
      status: 'success',
      message: 'Coordinator assigned successfully',
      data: {
        coordinator: {
          id: coordinator._id.toString(),
          name: coordinator.name,
          email: coordinator.email,
        },
        next_activities_id: project.next_activities_id,
        next_activity: 'CII uploaded the PI/Tax Invoice',
        next_activity_status: 'Pending',
        next_responsibility: 'CII',
      },
    };
  }

  /**
   * Assign Facilitator
   * Admin assigns a facilitator to a company project
   */
  async assignFacilitator(
    companyId: string,
    projectId: string,
    facilitatorId: string,
    contractFee?: number,
    contractDocument?: Express.Multer.File,
  ) {
    // Validate project exists and belongs to company
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });

    if (!project) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found',
      });
    }

    // Validate facilitator exists
    const facilitator = await this.facilitatorModel.findById(facilitatorId);
    if (!facilitator) {
      throw new NotFoundException({
        status: 'error',
        message: 'Facilitator not found',
      });
    }

    // Handle contract document upload if provided
    let contractDocumentPath = null;
    if (contractDocument) {
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
      const relativePath = `uploads/facilitator-contracts/${projectId}/${contractDocument.filename}`;
      contractDocumentPath = `${baseUrl}/${relativePath}`;
      console.log('[Assign Facilitator] Contract document saved:', contractDocumentPath);
    }

    // Check if facilitator is already assigned
    const existingFacilitator = await this.companyFacilitatorModel.findOne({
      company_id: companyId,
      project_id: projectId,
    });

    if (existingFacilitator) {
      // Update existing facilitator assignment
      existingFacilitator.facilitator_id = facilitatorId as any;
      if (contractFee !== undefined) {
        existingFacilitator.contract_fee = contractFee;
      }
      // contract_doc_status remains 0 until facilitator signs
      await existingFacilitator.save();
    } else {
      // Create new facilitator assignment
      await this.companyFacilitatorModel.create({
        company_id: companyId,
        project_id: projectId,
        facilitator_id: facilitatorId,
        contract_fee: contractFee || 0,
        contract_doc_status: 0, // Not signed yet
      });
    }

    console.log('[Assign Facilitator] Facilitator assigned:', {
      projectId: projectId.toString(),
      facilitatorId: facilitatorId,
      facilitatorName: facilitator.name,
      contractFee: contractFee,
    });

    // LOG ACTIVITY: CII Assigned A Facilitator
    // Note: This might be milestone 15 or a different activity depending on your flow
    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: 'CII Assigned A Facilitator',
      activity_type: 'cii',
      milestone_flow: 15, // Adjust based on your milestone flow
      milestone_completed: true,
    });

    console.log('[Assign Facilitator] Activity logged');

    const company = await this.companyModel.findById(companyId).lean();
    const projectCode = (project as any).project_id || projectId;

    // In-app: notify Facilitator (F)
    this.notificationsService
      .create(
        'GreenCo Team has assigned a Facilitator for your company',
        `Facilitator ${facilitator.name} has assigned to Company ${company?.name || 'N/A'} by GreenCo Team`,
        'F',
        facilitatorId,
      )
      .catch((err) => console.error('Notification to facilitator failed:', err));

    // In-app: notify Company (C)
    this.notificationsService
      .create(
        'GreenCo Team has assigned a facilitator for your Project',
        `Facilitator ${facilitator.name} has been assigned for your Project ${projectCode} by GreenCo Team`,
        'C',
        companyId,
      )
      .catch((err) => console.error('Notification to company failed:', err));

    // Email: to facilitator and company
    this.mailService
      .sendFacilitatorAssignedToCompanyEmail(
        facilitator.email,
        facilitator.name,
        company?.name || 'Company',
      )
      .catch((err) => console.error('Email to facilitator failed:', err));
    this.mailService
      .sendCompanyFacilitatorAssignedEmail(
        company?.email,
        company?.name || 'Company',
        facilitator.name,
        projectCode,
      )
      .catch((err) => console.error('Email to company failed:', err));

    return {
      status: 'success',
      message: 'Facilitator assigned successfully',
      data: {
        facilitator: {
          id: facilitator._id.toString(),
          name: facilitator.name,
          email: facilitator.email,
        },
        contract_fee: contractFee || 0,
        contract_document: contractDocumentPath,
        contract_doc_status: 0, // Not signed yet
      },
    };
  }

  /**
   * Assign Assessor (Site Visit Scheduling)
   * Admin assigns an assessor to a company project with optional visit dates.
   */
  async assignAssessor(
    companyId: string,
    projectId: string,
    assessorId: string,
    visitDates?: string[],
  ) {
    const project = await this.projectModel.findOne({
      _id: projectId,
      company_id: companyId,
    });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const assessor = await this.assessorModel.findById(assessorId);
    if (!assessor) {
      throw new NotFoundException({ status: 'error', message: 'Assessor not found' });
    }

    const company = await this.companyModel.findById(companyId).lean();
    const projectCode = (project as any).project_id || projectId;

    let companyAssessor = await this.companyAssessorModel.findOne({
      company_id: companyId,
      project_id: projectId,
      assessor_id: assessorId,
    });

    const dates = visitDates && visitDates.length > 0 ? visitDates : [new Date().toISOString().slice(0, 10)];

    if (companyAssessor) {
      companyAssessor.visit_dates = dates;
      await companyAssessor.save();
    } else {
      await this.companyAssessorModel.create({
        company_id: companyId,
        project_id: projectId,
        assessor_id: assessorId,
        visit_dates: dates,
      });
    }

    // In-app: notify Assessor (AS)
    this.notificationsService
      .create(
        'Greenco Team has assigned an Assessor for your company',
        `Assessor ${assessor.name} has assigned to Company ${company?.name || 'N/A'} by Admin`,
        'AS',
        assessorId,
      )
      .catch((err) => console.error('Notification to assessor failed:', err));

    // In-app: notify Company (C)
    this.notificationsService
      .create(
        'GreenCo Team has assigned an Assessor for your project',
        `Assessor ${assessor.name} has been assigned for your project by GreenCo Team. Check site visit details.`,
        'C',
        companyId,
      )
      .catch((err) => console.error('Notification to company failed:', err));

    // Email: to assessor
    this.mailService
      .sendAssessorAssignedToCompanyEmail(
        assessor.email,
        assessor.name,
        company?.name || 'Company',
      )
      .catch((err) => console.error('Email to assessor failed:', err));

    // Advance to 14 (CII Approved All Assessment / Assessor phase done) so Certificate tab opens after Assessor Visit Details
    const currentNext = (project as any).next_activities_id ?? 0;
    if (currentNext < 14) {
      (project as any).next_activities_id = 14;
      await project.save();
    }

    return {
      status: 'success',
      message: 'Assessor assigned successfully',
      data: {
        assessor: {
          id: assessor._id.toString(),
          name: assessor.name,
          email: assessor.email,
        },
        visit_dates: dates,
      },
    };
  }

  /**
   * Legacy Admin assessor flow:
   * POST /api/admin/assign_assessor/:companyProjectId
   */
  async assignAssessorAdminFlow(
    companyProjectId: string,
    selectAssessor: string,
    assessorDate: string,
    assessorAmount: number,
  ) {
    const project = await this.projectModel.findById(companyProjectId);
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const companyId = (project as any).company_id?.toString?.() || (project as any).company_id;
    const assessor = await this.assessorModel.findById(selectAssessor);
    if (!assessor) {
      throw new BadRequestException({
        status: 'validations',
        errors: { selectassessor: ['Invalid assessor selected.'] },
      });
    }

    const dates = this.parseLegacyAssessorDates(assessorDate);
    if (!dates.length) {
      throw new BadRequestException({
        status: 'validations',
        errors: { assessor_date: ['assessor_date is required.'] },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const dateStr of dates) {
      const parsed = this.parseDdMmYyyyToDate(dateStr);
      if (!parsed) {
        throw new BadRequestException({
          status: 'validations',
          errors: { assessor_date: [`Invalid date format "${dateStr}". Use d/m/Y.`] },
        });
      }
      if (parsed < today) {
        throw new BadRequestException({
          status: 'validations',
          errors: { assessor_date: [`Past date "${dateStr}" is not allowed.`] },
        });
      }
    }

    const hadAssessorBefore = (await this.companyAssessorModel.countDocuments({
      company_id: companyId,
      project_id: companyProjectId,
    })) > 0;

    const rowsToCreate: any[] = [];
    for (const dateStr of dates) {
      const assessorBusy = await this.companyAssessorModel.findOne({
        assessor_id: selectAssessor,
        visit_dates: dateStr,
      });
      if (assessorBusy) {
        throw new BadRequestException({
          status: 'validations',
          errors: {
            selectassessor: [
              'Assessor has been given another assessment on the day selected. Please select another date for assessement.',
            ],
          },
        });
      }

      const projectDateHasAnotherAssessor = await this.companyAssessorModel.findOne({
        project_id: companyProjectId,
        visit_dates: dateStr,
        assessor_id: { $ne: selectAssessor },
      });
      if (projectDateHasAnotherAssessor) {
        throw new BadRequestException({
          status: 'validations',
          errors: {
            assessor_date: [
              'Another Assessor has been assigned for assessment on the day selected. Please select another assessor.',
            ],
          },
        });
      }

      rowsToCreate.push({
        company_id: companyId,
        project_id: companyProjectId,
        assessor_id: selectAssessor,
        visit_dates: [dateStr],
        assessor_amount: Number(assessorAmount) || 0,
      });
    }

    await this.companyAssessorModel.insertMany(rowsToCreate);

    const company = await this.companyModel.findById(companyId).lean();
    this.notificationsService
      .create(
        'GreenCo Team has assigned an Assessor for your project',
        `Assessor ${assessor.name} has been assigned for your project by GreenCo Team. Check site visit details.`,
        'C',
        companyId,
      )
      .catch((err) => console.error('Notification to company failed:', err));

    this.notificationsService
      .create(
        'Greenco Team has assigned an Assessor',
        `You have been assigned to company ${company?.name || 'N/A'}.`,
        'AS',
        selectAssessor,
      )
      .catch((err) => console.error('Notification to assessor failed:', err));

    this.mailService
      .sendAssessorAssignedToCompanyEmail(
        assessor.email,
        assessor.name,
        company?.name || 'Company',
      )
      .catch((err) => console.error('Assessor assignment email failed:', err));

    if (!hadAssessorBefore) {
      await this.companyActivityModel.create({
        company_id: companyId,
        project_id: companyProjectId,
        description: 'CII Assigned an Assessor',
        activity_type: 'cii',
        milestone_flow: 13,
        milestone_completed: true,
      });
      const currentNext = Number((project as any).next_activities_id || 0);
      if (currentNext < 13) {
        (project as any).next_activities_id = 13;
        await project.save();
      }
    }

    return {
      status: 'success',
      message: 'Assessor assigned Successfully!',
    };
  }

  /**
   * Legacy Admin payment status flow:
   * POST /api/admin/payment_status/:companyProjectId
   */
  async paymentStatusAdminFlow(
    companyProjectId: string,
    paymentId: string,
    status: number,
    remarks?: string,
  ) {
    const project = await this.projectModel.findById(companyProjectId);
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const companyId = (project as any).company_id?.toString?.() || (project as any).company_id;
    const invoice = await this.companyInvoiceModel.findOne({
      _id: paymentId,
      project_id: companyProjectId,
      company_id: companyId,
    });

    if (!invoice) {
      throw new BadRequestException({
        status: 'error',
        message: 'Some Error Occurred. Please try again after sometime!',
      });
    }

    invoice.approval_status = status;
    (invoice as any).payment_status = status === 1 ? 1 : 2;
    (invoice as any).remarks = remarks || '';
    (invoice as any).approved_by = process.env.ADMIN_EMAIL || 'admin';
    (invoice as any).approved_at = new Date();
    await invoice.save();

    const currentNext = Number((project as any).next_activities_id || 0);
    const isSecondCycle = currentNext >= 18;
    if (status === 1) {
      (project as any).next_activities_id = isSecondCycle ? Math.max(currentNext, 19) : Math.max(currentNext, 8);
    } else if (status === 2) {
      (project as any).next_activities_id = isSecondCycle ? 18 : 7;
      await this.companyActivityModel.create({
        company_id: companyId,
        project_id: companyProjectId,
        description: 'Payment rejected by Admin',
        activity_type: 'cii',
        milestone_flow: isSecondCycle ? 18 : 7,
        milestone_completed: false,
      });
    }
    await project.save();

    return {
      status: 'success',
      message: 'Status Changed Successfully!',
    };
  }

  // ---------- Primary Data Form ----------

  /**
   * Get sections dynamically from master_primary_data_checklist only (distinct info_type + label).
   * All section values come from DB; no static list. Run seed-primary-data-master.js if empty.
   */
  async getSectionsFromMaster(): Promise<{ info_type: string; tab_id: string; label: string }[]> {
    const aggregated = await this.masterPrimaryDataChecklistModel.aggregate([
      { $match: { is_active: 1 } },
      { $sort: { checklist_order: 1 } },
      {
        $group: {
          _id: '$info_type',
          label: { $first: '$checklist_name' },
          order: { $min: '$checklist_order' },
        },
      },
      { $match: { _id: { $exists: true, $nin: [null, ''] } } },
      { $sort: { order: 1 } },
      { $project: { info_type: '$_id', label: 1, _id: 0 } },
    ]);
    return aggregated.map((a: any) => ({
      info_type: a.info_type || '',
      tab_id: a.info_type || '',
      label: a.label && String(a.label).trim() ? a.label : (a.info_type || 'Section'),
    }));
  }

  /** Sections metadata for UI (tabs, labels, info_type) – fetched dynamically from master. */
  async getPrimaryDataSections() {
    const sections = await this.getSectionsFromMaster();
    return {
      status: 'success',
      message: 'Primary data sections',
      data: { sections },
    };
  }

  /** document_status: 0 Pending, 1 Accepted, 2 Not Accepted, 3 Under Review */
  getPrimaryDataDocStatusLabels(): Record<number, string> {
    return {
      [PRIMARY_DATA_DOC_STATUS.PENDING]: 'Pending',
      [PRIMARY_DATA_DOC_STATUS.ACCEPTED]: 'Accepted',
      [PRIMARY_DATA_DOC_STATUS.NOT_ACCEPTED]: 'Not Accepted',
      [PRIMARY_DATA_DOC_STATUS.UNDER_REVIEW]: 'Under Review',
    };
  }

  /**
   * Get Primary Data Form (company): master checklist + saved data grouped by info_type.
   * Sections and info_type keys are derived dynamically from master_primary_data_checklist.
   */
  async getPrimaryData(companyId: string, projectId: string) {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId }).lean();
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const cId = new Types.ObjectId(companyId);
    const pId = new Types.ObjectId(projectId);
    const [masterList, savedRows, sections] = await Promise.all([
      this.masterPrimaryDataChecklistModel.find({ is_active: 1 }).sort({ checklist_order: 1 }).lean(),
      this.primaryDataFormModel.find({ company_id: cId, project_id: pId }).lean(),
      this.getSectionsFromMaster(),
    ]);

    const infoTypesFromMaster = [...new Set((masterList as any[]).map((r) => r.info_type).filter(Boolean))];
    const byInfoType: Record<string, any[]> = {};
    const savedByDataId: Record<string, any> = {};
    for (const t of infoTypesFromMaster) {
      byInfoType[t] = [];
    }
    for (const row of savedRows as any[]) {
      const t = row.info_type || 'gi';
      if (!byInfoType[t]) byInfoType[t] = [];
      byInfoType[t].push(row);
      const dataIdStr = (row.data_id && row.data_id.toString) ? row.data_id.toString() : String(row.data_id);
      if (dataIdStr) savedByDataId[dataIdStr] = row;
    }

    const finalSubmitCount = (savedRows as any[]).filter((r) => r.final_submit === 1).length;
    const approvalCount = (savedRows as any[]).filter((r) => r.document_status === PRIMARY_DATA_DOC_STATUS.ACCEPTED).length;

    // Merged rows: for each master row, attach saved values so Reference Unit (and FY) come from saved when present.
    // primary_data_rows is keyed by info_type (gi, ee, wc, ...) so the UI can use primary_data_rows[activeSection].
    const mergedRowsFlat = (masterList as any[]).map((master) => {
      const mid = master._id?.toString?.() ?? master._id;
      const saved = mid ? savedByDataId[mid] : null;
      const refUnit = saved?.reference_unit != null && String(saved.reference_unit).trim() !== ''
        ? String(saved.reference_unit)
        : (master.reference_unit != null && String(master.reference_unit).trim() !== '' ? String(master.reference_unit) : '-');
      return {
        ...master,
        reference_unit: refUnit,
        reference_unit_display: refUnit,
        parameter: saved?.parameter ?? master.parameter,
        details: saved?.details ?? master.details,
        fy1: saved?.fy1 ?? master.fy1 ?? 0,
        fy2: saved?.fy2 ?? master.fy2 ?? 0,
        fy3: saved?.fy3 ?? master.fy3 ?? 0,
        fy4: saved?.fy4 ?? master.fy4 ?? 0,
        fy5: saved?.fy5 ?? master.fy5 ?? 0,
        extrapolated: saved?.extrapolated ?? master.extrapolated,
        lt_target: saved?.lt_target ?? master.lt_target,
        additional_details: saved?.additional_details ?? master.additional_details,
        document: saved?.document,
        document_status: saved?.document_status,
        final_submit: saved?.final_submit,
      };
    });
    const primary_data_rows: Record<string, any[]> = {};
    for (const row of mergedRowsFlat as any[]) {
      const t = row.info_type || 'gi';
      if (!primary_data_rows[t]) primary_data_rows[t] = [];
      primary_data_rows[t].push(row);
    }

    return {
      status: 'success',
      message: 'Primary data form retrieved',
      data: {
        project_id: projectId,
        master_primary_data: masterList,
        saved_by_info_type: byInfoType,
        saved_by_data_id: savedByDataId,
        primary_data_rows,
        final_submit_docs: finalSubmitCount,
        primary_data_approval_count: approvalCount,
        document_status_labels: this.getPrimaryDataDocStatusLabels(),
        sections,
      },
    };
  }

  /**
   * Save Primary Data by section (form_type + payload). Maps section payload to doc array and upserts.
   * Payload can be: (1) doc array, or (2) object keyed by data_id with { fy1, fy2, fy3, fy4, extrapolated, lt_target, reference_unit, details, ... }.
   */
  async savePrimaryDataBySection(
    companyId: string,
    projectId: string,
    formType: string,
    payload: any,
    finalSubmit?: boolean,
  ) {
    let doc: any[] = [];
    if (Array.isArray(payload)) {
      doc = payload;
    } else if (payload && typeof payload === 'object') {
      const mongoose = require('mongoose');
      const infoType = formType && String(formType).trim() ? formType : 'gi';
      const masterRows = await this.masterPrimaryDataChecklistModel
        .find({ info_type: infoType, is_active: 1 })
        .lean();
      for (const row of masterRows as any[]) {
        const dataId = row._id.toString();
        const sectionRow = payload[dataId] ?? payload[row.parameter] ?? payload[row.checklist_name];
        if (sectionRow == null) continue;
        doc.push({
          data_id: dataId,
          info_type: infoType,
          parameter: row.parameter,
          reference_unit: sectionRow.reference_unit ?? row.reference_unit,
          details: sectionRow.details,
          fy1: sectionRow.fy1 ?? 0,
          fy2: sectionRow.fy2 ?? 0,
          fy3: sectionRow.fy3 ?? 0,
          fy4: sectionRow.fy4 ?? 0,
          fy5: sectionRow.fy5 ?? 0,
          extrapolated: sectionRow.extrapolated,
          lt_target: sectionRow.lt_target,
          additional_details: sectionRow.additional_details,
        });
      }
    }
    if (finalSubmit) {
      return this.submitPrimaryData(companyId, projectId, doc.length ? doc : []);
    }
    return this.storePrimaryData(companyId, projectId, doc);
  }

  /**
   * Store Primary Data (field-by-field): update or insert from doc array. No final submit.
   * Accepts doc as array or object keyed by data_id (same shape as /save payload).
   */
  async storePrimaryData(companyId: string, projectId: string, doc: any[] | Record<string, any>) {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const mongoose = require('mongoose');
    const cId = new mongoose.Types.ObjectId(companyId);
    const pId = new mongoose.Types.ObjectId(projectId);

    const toNum = (v: unknown): number | undefined =>
      v === '' || v == null ? undefined : (Number.isFinite(Number(v)) ? Number(v) : undefined);

    const items: any[] = Array.isArray(doc)
      ? doc
      : Object.entries(doc || {}).map(([data_id, sectionRow]) => ({
          data_id,
          info_type: sectionRow?.info_type,
          parameter: sectionRow?.parameter,
          reference_unit: sectionRow?.reference_unit,
          details: sectionRow?.details,
          fy1: sectionRow?.fy1,
          fy2: sectionRow?.fy2,
          fy3: sectionRow?.fy3,
          fy4: sectionRow?.fy4,
          fy5: sectionRow?.fy5,
          extrapolated: sectionRow?.extrapolated,
          lt_target: sectionRow?.lt_target,
          additional_details: sectionRow?.additional_details,
        }));

    for (const item of items) {
      const dataId = item.data_id ? new mongoose.Types.ObjectId(item.data_id) : undefined;
      if (!dataId) continue;

      const update: any = {
        info_type: item.info_type || 'gi',
        parameter: item.parameter,
        reference_unit: item.reference_unit,
        details: item.details,
        fy1: toNum(item.fy1) ?? 0,
        fy2: toNum(item.fy2) ?? 0,
        fy3: toNum(item.fy3) ?? 0,
        fy4: toNum(item.fy4) ?? 0,
        fy5: toNum(item.fy5) ?? 0,
        extrapolated: toNum(item.extrapolated),
        lt_target: toNum(item.lt_target),
        additional_details: item.additional_details,
      };

      await this.primaryDataFormModel.updateOne(
        { company_id: cId, project_id: pId, data_id: dataId },
        { $set: update },
        { upsert: true },
      );
    }

    return { status: 'success', message: 'Success! Primary Data Updated.' };
  }

  /**
   * Submit Primary Data: set final_submit = 1 for all project rows, advance next_activities_id to 11 (Company Uploaded All Primary Data), then activity + notifications.
   */
  async submitPrimaryData(companyId: string, projectId: string, doc: any[]) {
    await this.storePrimaryData(companyId, projectId, doc);

    const mongoose = require('mongoose');
    const pId = new mongoose.Types.ObjectId(projectId);
    await this.primaryDataFormModel.updateMany(
      { company_id: companyId, project_id: pId },
      { $set: { final_submit: 1 } },
    );

    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId });
    if (project) {
      const currentNext = (project as any).next_activities_id ?? 0;
      if (currentNext < 11) {
        (project as any).next_activities_id = 11; // Company Uploaded All Primary Data
        await project.save();
      }
    }

    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: 'Company has submitted the Primary Form Data',
      activity_type: 'company',
      milestone_flow: 9,
      milestone_completed: true,
    });

    this.notificationsService
      .create(
        'Primary Data Submitted',
        'Your Primary Data form has been submitted successfully. GreenCo Team will review it.',
        'C',
        companyId,
      )
      .catch((e) => console.error('Primary data submission notification failed:', e));

    return { status: 'success', message: 'Success! Primary Data Submitted.' };
  }

  /**
   * Update Primary Data (document re-upload): set document path and document_status = 0.
   */
  async updatePrimaryData(
    companyId: string,
    projectId: string,
    updates: { data_id: string; document?: string }[],
  ) {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const mongoose = require('mongoose');
    const pId = new mongoose.Types.ObjectId(projectId);

    for (const u of updates) {
      const dataId = new mongoose.Types.ObjectId(u.data_id);
      await this.primaryDataFormModel.updateOne(
        { company_id: companyId, project_id: pId, data_id: dataId },
        { $set: { document: u.document || null, document_status: PRIMARY_DATA_DOC_STATUS.PENDING } },
      );
    }

    await this.companyActivityModel.create({
      company_id: companyId,
      project_id: projectId,
      description: 'Company has re-submitted the Primary Form Data Documents',
      activity_type: 'company',
      milestone_flow: 9,
      milestone_completed: false,
    });

    return { status: 'success', message: 'Success! Primary Data Documents Uploaded Successfully!' };
  }

  /**
   * Get Primary Data for Admin approval view (submitted rows only, grouped by info_type).
   * Sections derived dynamically from master.
   */
  async getPrimaryDataForApproval(projectId: string) {
    const project = await this.projectModel.findOne({ _id: projectId }).lean();
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }
    const projectAny = project as any;
    const companyId = projectAny.company_id?.toString?.() || projectAny.company_id;

    const [savedRows, masterList, sections] = await Promise.all([
      this.primaryDataFormModel
        .find({ company_id: companyId, project_id: projectId, final_submit: 1 })
        .lean(),
      this.masterPrimaryDataChecklistModel.find({ is_active: 1 }).sort({ checklist_order: 1 }).lean(),
      this.getSectionsFromMaster(),
    ]);

    const infoTypesFromMaster = [...new Set((masterList as any[]).map((r) => r.info_type).filter(Boolean))];
    const byInfoType: Record<string, any[]> = {};
    for (const t of infoTypesFromMaster) {
      byInfoType[t] = [];
    }
    for (const row of savedRows as any[]) {
      const t = row.info_type || 'gi';
      if (!byInfoType[t]) byInfoType[t] = [];
      byInfoType[t].push(row);
    }

    const approvalCount = (savedRows as any[]).filter((r) => r.document_status === PRIMARY_DATA_DOC_STATUS.ACCEPTED).length;

    return {
      status: 'success',
      message: 'Primary data for approval',
      data: {
        project_id: projectId,
        company_id: companyId,
        master_primary_data: masterList,
        saved_by_info_type: byInfoType,
        primary_data_approval_count: approvalCount,
        document_status_labels: this.getPrimaryDataDocStatusLabels(),
        sections,
      },
    };
  }

  /**
   * Admin: Approve/reject one section (form_type). Updates document_status and document_remarks for that info_type.
   * When primary_data_approval_count >= 110, runs cii_activity(10).
   */
  async primaryDataFormApproval(
    companyId: string,
    projectId: string,
    formType: string,
    status: number,
    remark?: string,
  ) {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }

    const mongoose = require('mongoose');
    const pId = new mongoose.Types.ObjectId(projectId);

    await this.primaryDataFormModel.updateMany(
      { company_id: companyId, project_id: pId, info_type: formType },
      { $set: { document_status: status, document_remarks: remark || null } },
    );

    const company = await this.companyModel.findById(companyId).lean();
    const cf = await this.companyFacilitatorModel.findOne({ company_id: companyId, project_id: projectId }).populate('facilitator_id').lean();

    // In-app + email when not accepted (status 2)
    if (status === PRIMARY_DATA_DOC_STATUS.NOT_ACCEPTED) {
      const detail = `Section: ${formType}. ${remark ? `Remarks: ${remark}` : ''}`;
      this.notificationsService.create('Primary data not accepted', detail, 'C', companyId).catch((e) => console.error('Primary not-accepted notification failed:', e));
      if (company?.email) {
        this.mailService.sendPrimaryDocNotAcceptedEmail(company.email, company.name || 'Company', detail).catch((e) => console.error('Primary not-accepted email failed:', e));
      }
      if (cf && (cf as any).facilitator_id) {
        const fid = (cf as any).facilitator_id._id?.toString?.() || (cf as any).facilitator_id;
        this.notificationsService.create('Primary data not accepted', detail, 'F', fid).catch((e) => console.error('Primary not-accepted notification to F failed:', e));
        if ((cf as any).facilitator_id.email) {
          this.mailService.sendPrimaryDocNotAcceptedEmail((cf as any).facilitator_id.email, (cf as any).facilitator_id.name || 'Facilitator', detail).catch((e) => console.error('Primary not-accepted email failed:', e));
        }
      }
    }

    // In-app + email when accepted (status 1)
    if (status === PRIMARY_DATA_DOC_STATUS.ACCEPTED) {
      const detail = `Primary data section "${formType}" has been accepted by GreenCo Team.`;
      this.notificationsService.create('Primary data accepted', detail, 'C', companyId).catch((e) => console.error('Primary accepted notification failed:', e));
      if (company?.email) {
        this.mailService.sendPrimaryDocAcceptedEmail(company.email, company.name || 'Company', formType).catch((e) => console.error('Primary accepted email failed:', e));
      }
      if (cf && (cf as any).facilitator_id) {
        const fid = (cf as any).facilitator_id._id?.toString?.() || (cf as any).facilitator_id;
        this.notificationsService.create('Primary data accepted', detail, 'F', fid).catch((e) => console.error('Primary accepted notification to F failed:', e));
        if ((cf as any).facilitator_id.email) {
          this.mailService.sendPrimaryDocAcceptedEmail((cf as any).facilitator_id.email, (cf as any).facilitator_id.name || 'Facilitator', formType).catch((e) => console.error('Primary accepted email failed:', e));
        }
      }
    }

    const updated = await this.primaryDataFormModel
      .find({ company_id: companyId, project_id: pId })
      .lean();
    const approvalCount = (updated as any[]).filter((r) => r.document_status === PRIMARY_DATA_DOC_STATUS.ACCEPTED).length;

    if (approvalCount >= 110) {
      await this.companyActivityModel.create({
        company_id: companyId,
        project_id: projectId,
        description: 'Greenco Team has accepted/not accepted the Primary Data Form Document',
        activity_type: 'cii',
        milestone_flow: 10,
        milestone_completed: true,
      });
      (project as any).next_activities_id = 11; // Next: All Assessment Submittals to be uploaded
      await project.save();
    }

    return {
      status: 'success',
      message: 'Primary Data save successfully',
      data: { primary_data_approval_count: approvalCount },
    };
  }

  /**
   * Export Primary Data section to Excel. Returns buffer and filename for download.
   */
  async exportPrimaryDataSection(
    companyId: string,
    projectId: string,
    section: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }
    const mongoose = require('mongoose');
    const pId = new mongoose.Types.ObjectId(projectId);
    const rows = await this.primaryDataFormModel
      .find({ company_id: companyId, project_id: pId, info_type: section })
      .lean();
    let Workbook: any;
    try {
      const exceljs = await import('exceljs');
      Workbook = exceljs.Workbook;
    } catch {
      throw new BadRequestException({
        status: 'error',
        message: 'Excel export requires the exceljs package. Run: npm install exceljs',
      });
    }
    const wb = new Workbook();
    const ws = wb.addWorksheet(section.toUpperCase(), { headerFooter: { firstHeader: section } });
    const columns = [
      { header: 'data_id', key: 'data_id', width: 26 },
      { header: 'info_type', key: 'info_type', width: 12 },
      { header: 'parameter', key: 'parameter', width: 24 },
      { header: 'reference_unit', key: 'reference_unit', width: 16 },
      { header: 'details', key: 'details', width: 20 },
      { header: 'fy1', key: 'fy1', width: 10 },
      { header: 'fy2', key: 'fy2', width: 10 },
      { header: 'fy3', key: 'fy3', width: 10 },
      { header: 'fy4', key: 'fy4', width: 10 },
      { header: 'fy5', key: 'fy5', width: 10 },
      { header: 'extrapolated', key: 'extrapolated', width: 12 },
      { header: 'lt_target', key: 'lt_target', width: 12 },
      { header: 'document_status', key: 'document_status', width: 14 },
      { header: 'document_remarks', key: 'document_remarks', width: 20 },
    ];
    ws.columns = columns;
    ws.addRows(
      (rows as any[]).map((r) => ({
        data_id: r.data_id?.toString?.() ?? r.data_id,
        info_type: r.info_type,
        parameter: r.parameter,
        reference_unit: r.reference_unit,
        details: r.details,
        fy1: r.fy1,
        fy2: r.fy2,
        fy3: r.fy3,
        fy4: r.fy4,
        fy5: r.fy5,
        extrapolated: r.extrapolated,
        lt_target: r.lt_target,
        document_status: r.document_status,
        document_remarks: r.document_remarks,
      })),
    );
    const buffer = (await wb.xlsx.writeBuffer()) as Buffer;
    const filename = `primary_data_${section}_${projectId}.xlsx`;
    return { buffer, filename };
  }

  /**
   * Import Primary Data section from Excel. Parses sheet and upserts rows by data_id.
   */
  async importPrimaryDataSection(
    companyId: string,
    projectId: string,
    section: string,
    file: Express.Multer.File,
  ): Promise<{ status: string; message: string; imported?: number }> {
    const project = await this.projectModel.findOne({ _id: projectId, company_id: companyId });
    if (!project) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }
    let buffer: Buffer;
    if ((file as any).buffer) {
      buffer = (file as any).buffer;
    } else if ((file as any).path && fs.existsSync((file as any).path)) {
      buffer = fs.readFileSync((file as any).path);
    } else {
      throw new BadRequestException({ status: 'error', message: 'No file buffer or path' });
    }
    let Workbook: any;
    try {
      const exceljs = await import('exceljs');
      Workbook = exceljs.Workbook;
    } catch {
      throw new BadRequestException({
        status: 'error',
        message: 'Excel import requires the exceljs package. Run: npm install exceljs',
      });
    }
    const wb = new Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) {
      throw new BadRequestException({ status: 'error', message: 'No sheet in workbook' });
    }
    const mongoose = require('mongoose');
    const cId = new mongoose.Types.ObjectId(companyId);
    const pId = new mongoose.Types.ObjectId(projectId);
    let imported = 0;
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = (cell?.value?.toString?.() ?? '').toLowerCase().replace(/\s+/g, '_');
    });
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const obj: any = {};
      row.eachCell((cell, colNumber) => {
        const key = headers[colNumber - 1];
        if (key) obj[key] = cell?.value;
      });
      const dataId = obj.data_id?.toString?.()?.trim?.();
      if (!dataId) continue;
      try {
        const dataIdObj = new mongoose.Types.ObjectId(dataId);
        const update = {
          info_type: section,
          parameter: obj.parameter,
          reference_unit: obj.reference_unit,
          details: obj.details,
          fy1: Number(obj.fy1) || 0,
          fy2: Number(obj.fy2) || 0,
          fy3: Number(obj.fy3) || 0,
          fy4: Number(obj.fy4) || 0,
          fy5: Number(obj.fy5) || 0,
          extrapolated: obj.extrapolated != null ? Number(obj.extrapolated) : undefined,
          lt_target: obj.lt_target != null ? Number(obj.lt_target) : undefined,
        };
        await this.primaryDataFormModel.updateOne(
          { company_id: cId, project_id: pId, data_id: dataIdObj },
          { $set: update },
          { upsert: true },
        );
        imported++;
      } catch (_) {
        // skip invalid data_id
      }
    }
    return {
      status: 'success',
      message: `Import completed for section ${section}`,
      imported,
    };
  }

  /**
   * Send sustenance reminders (Activity deadlines).
   * Call from cron or GET /api/company/projects/reminders/send-sustenance-reminders
   * Finds projects with certificate_expiry within 25 months and sustenance_mail_sent not set; sends email to company (and admin); sets sustenance_mail_sent = 1.
   */
  async sendSustenanceReminders(): Promise<{ sent: number; message: string }> {
    const now = new Date();
    const in25Months = new Date(now);
    in25Months.setMonth(in25Months.getMonth() + 25);
    const projects = await this.projectModel
      .find({
        certificate_expiry_date: { $exists: true, $ne: null, $lte: in25Months },
        $or: [{ sustenance_mail_sent: { $exists: false } }, { sustenance_mail_sent: 0 }, { sustenance_mail_sent: null }],
      })
      .limit(50)
      .lean();

    let sent = 0;
    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USERNAME;
    for (const proj of projects as any[]) {
      const companyId = proj.company_id?.toString?.() || proj.company_id;
      const company = await this.companyModel.findById(companyId).lean();
      if (company?.email) {
        this.mailService.sendSustenanceReminderEmail(company.email, company.name || 'Company').catch((e) => console.error('Sustenance reminder email failed:', e));
        sent++;
      }
      if (adminEmail) {
        this.mailService.sendSustenanceReminderEmail(adminEmail, 'Admin').catch((e) => console.error('Sustenance reminder to admin failed:', e));
      }
      await this.projectModel.updateOne({ _id: proj._id }, { $set: { sustenance_mail_sent: 1 } });
    }
    return { sent, message: `Sustenance reminders sent: ${sent}` };
  }
}


