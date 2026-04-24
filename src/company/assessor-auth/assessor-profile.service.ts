import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assessor, AssessorDocument } from '../schemas/assessor.schema';
import { lookupIfscDetails } from '../../common/ifsc-lookup.util';
import { ASSESSOR_PROFILE_DOCUMENT_KEYS } from './assessor-profile-document-keys';

@Injectable()
export class AssessorProfileService {
  constructor(
    @InjectModel(Assessor.name)
    private readonly assessorModel: Model<AssessorDocument>,
  ) {}

  private toBool(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y';
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

  private requireNonEmpty(value: unknown): boolean {
    return String(value ?? '').trim().length > 0;
  }

  private assertRequiredProfileFields(
    body: Record<string, any>,
    existing: AssessorDocument,
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
    const errors: Record<string, string[]> = {};
    const pick = (k: string) => body?.[k] ?? (existing as any)?.[k];

    // All text fields mandatory except alternate_mobile and address_line_2 (per requirement)
    const requiredTextFields = [
      'name',
      'email',
      'mobile',
      'industry_category',
      'address_line_1',
      'pincode',
      'city',
      'state',
      'pan_number',
      'enrollment_date',
      'gst_registered',
      'lead_assessor',
      'assessor_grade',
      'emergency_contact_name',
      'emergency_mobile',
      'emergency_address_line_1',
      'emergency_city',
      'emergency_state',
      'emergency_pincode',
      'account_number',
      'ifsc_code',
    ];

    for (const field of requiredTextFields) {
      if (!this.requireNonEmpty(pick(field))) {
        errors[field] = [`${field} is required.`];
      }
    }

    // GST number is required only when GST registered = Yes/true/1
    const gstRegisteredRaw = pick('gst_registered');
    const gstRegistered = this.toBool(gstRegisteredRaw);
    if (gstRegistered && !this.requireNonEmpty(pick('gst_number'))) {
      errors.gst_number = ['gst_number is required when GST is Yes.'];
    }

    // Required documents (assessor flow)
    const requiredDocs = [
      'profile_image',
      'biodata',
      'vendor_registration_form',
      'non_disclosure_agreement',
      'health_declaration',
      'pan_card',
      'cancelled_cheque',
    ] as const;

    for (const docField of requiredDocs) {
      const hasNew = !!files?.[docField]?.[0];
      const hasExisting = this.requireNonEmpty((existing as any)?.[docField]);
      if (!hasNew && !hasExisting) {
        errors[docField] = [`${docField} document is required.`];
      }
    }

    // GST declaration required only when GST is Yes/true/1
    if (gstRegistered) {
      const docField = 'gst_declaration';
      const hasNew = !!files?.[docField]?.[0];
      const hasExisting = this.requireNonEmpty((existing as any)?.[docField]);
      if (!hasNew && !hasExisting) {
        errors[docField] = [`${docField} document is required when GST is Yes.`];
      }
    }

    if (Object.keys(errors).length) {
      throw new BadRequestException({ status: 'validations', errors });
    }
  }

  async getMyProfile(assessorId: string): Promise<any> {
    const row = await this.assessorModel.findById(assessorId).lean();
    if (!row) throw new NotFoundException({ status: 'error', message: 'Assessor not found' });
    return {
      status: 'success',
      message: 'Profile fetched successfully',
      data: {
        ...row,
        id: String((row as any)._id),
      },
    };
  }

  async updateMyProfile(
    assessorId: string,
    body: Record<string, any>,
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
  ): Promise<any> {
    const assessor = await this.assessorModel.findById(assessorId);
    if (!assessor) throw new NotFoundException({ status: 'error', message: 'Assessor not found' });

    const filePath = (f?: Express.Multer.File[]) =>
      f?.[0] ? `uploads/assessors/${f[0].filename}` : undefined;

    // Strict validations for assessor self-submission.
    this.assertRequiredProfileFields(body, assessor, files);
    const email = String(body?.email ?? assessor.email ?? '').trim().toLowerCase();

    const bankInfo = await this.deriveBankDetails(
      body?.ifsc_code ?? assessor.ifsc_code,
      body?.bank_name ?? assessor.bank_name,
      body?.branch_name ?? assessor.branch_name,
    );

    assessor.name = String(body?.name ?? assessor.name ?? '').trim();
    assessor.email = email;
    assessor.mobile = String(body?.mobile ?? assessor.mobile ?? '').trim();
    assessor.status = String(body?.status ?? assessor.status ?? '1');

    assessor.industry_category = body?.industry_category ?? assessor.industry_category;
    assessor.alternate_mobile = body?.alternate_mobile ?? assessor.alternate_mobile;
    assessor.address_line_1 = body?.address_line_1 ?? assessor.address_line_1;
    assessor.address_line_2 = body?.address_line_2 ?? assessor.address_line_2;
    assessor.pincode = body?.pincode ?? assessor.pincode;
    assessor.city = body?.city ?? assessor.city;
    assessor.state = body?.state ?? assessor.state;
    assessor.pan_number = body?.pan_number ?? assessor.pan_number;
    assessor.enrollment_date = body?.enrollment_date ?? assessor.enrollment_date;

    if (body?.gst_registered !== undefined) assessor.gst_registered = this.toBool(body.gst_registered);
    assessor.gst_number = body?.gst_number ?? assessor.gst_number;
    if (body?.lead_assessor !== undefined) assessor.lead_assessor = this.toBool(body.lead_assessor);
    assessor.assessor_grade = body?.assessor_grade ?? assessor.assessor_grade;

    assessor.emergency_contact_name = body?.emergency_contact_name ?? assessor.emergency_contact_name;
    assessor.emergency_mobile = body?.emergency_mobile ?? assessor.emergency_mobile;
    assessor.emergency_address_line_1 = body?.emergency_address_line_1 ?? assessor.emergency_address_line_1;
    assessor.emergency_address_line_2 = body?.emergency_address_line_2 ?? assessor.emergency_address_line_2;
    assessor.emergency_city = body?.emergency_city ?? assessor.emergency_city;
    assessor.emergency_state = body?.emergency_state ?? assessor.emergency_state;
    assessor.emergency_pincode = body?.emergency_pincode ?? assessor.emergency_pincode;

    assessor.bank_name = bankInfo.bank_name;
    assessor.account_number = body?.account_number ?? assessor.account_number;
    assessor.branch_name = bankInfo.branch_name;
    assessor.ifsc_code = bankInfo.ifsc_code;

    assessor.profile_image = filePath(files?.profile_image) ?? assessor.profile_image;
    assessor.biodata = filePath(files?.biodata) ?? assessor.biodata;
    assessor.vendor_registration_form = filePath(files?.vendor_registration_form) ?? assessor.vendor_registration_form;
    assessor.non_disclosure_agreement =
      filePath(files?.non_disclosure_agreement) ?? assessor.non_disclosure_agreement;
    assessor.health_declaration = filePath(files?.health_declaration) ?? assessor.health_declaration;
    assessor.gst_declaration = filePath(files?.gst_declaration) ?? assessor.gst_declaration;
    assessor.pan_card = filePath(files?.pan_card) ?? assessor.pan_card;
    assessor.cancelled_cheque = filePath(files?.cancelled_cheque) ?? assessor.cancelled_cheque;

    const prev = ((assessor as any).document_approvals || {}) as Record<
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
    for (const key of ASSESSOR_PROFILE_DOCUMENT_KEYS) {
      if (files?.[key]?.[0]) {
        docApprovals[key] = { status: 'Pending', remarks: '' };
      }
    }
    (assessor as any).document_approvals = docApprovals;

    // Assessor submissions always require admin review.
    assessor.approval_status = 'Pending';
    assessor.approval_remarks = '';
    assessor.profile_status = 'Complete';

    await assessor.save();

    return {
      status: 'success',
      message: 'Profile submitted for approval',
      data: {
        id: assessor._id.toString(),
        approval_status: assessor.approval_status,
        profile_status: assessor.profile_status,
      },
    };
  }
}

