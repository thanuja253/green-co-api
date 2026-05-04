import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Facilitator, FacilitatorDocument } from '../schemas/facilitator.schema';
import {
  FACILITATOR_PROFILE_DOCUMENT_KEYS,
} from './facilitator-profile-document-keys';

@Injectable()
export class FacilitatorProfileService {
  constructor(
    @InjectModel(Facilitator.name)
    private readonly facilitatorModel: Model<FacilitatorDocument>,
  ) {}

  private requireNonEmpty(value: unknown): boolean {
    return String(value ?? '').trim().length > 0;
  }

  private toBool(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y';
  }

  private assertRequiredProfileFields(
    body: Record<string, any>,
    existing: FacilitatorDocument,
    files?: Record<string, Express.Multer.File[]>,
  ) {
    const errors: Record<string, string[]> = {};
    const pick = (k: string) => body?.[k] ?? (existing as any)?.[k];

    // Required fields from facilitator profile form.
    const requiredTextFields = [
      'consultant_id',
      'name',
      'email',
      'mobile',
      'address_line_1',
      'state',
      'city',
      'pincode',
      'educational_qualification',
      'additional_professional_qualification',
      'total_years_professional_experience',
      'years_env_sustainability',
      'areas_of_specialization',
    ];

    for (const field of requiredTextFields) {
      if (!this.requireNonEmpty(pick(field))) {
        errors[field] = [`${field} is required.`];
      }
    }

    const declarationAccepted =
      this.toBool(body?.declaration_accepted ?? (existing as any)?.declaration_accepted);
    if (!declarationAccepted) {
      errors.declaration_accepted = ['Please accept the declaration.'];
    }

    // Required attachments from profile form.
    const requiredDocs = [
      'vendor_registration_form',
      'brief_profile_individual',
      'brief_profile_organization',
      'projects_handled',
    ] as const;
    for (const docField of requiredDocs) {
      const hasNew = !!files?.[docField]?.[0];
      const hasExisting = docField === 'brief_profile_individual'
        ? this.requireNonEmpty((existing as any)?.brief_profile_individual) ||
          this.requireNonEmpty((existing as any)?.biodata)
        : this.requireNonEmpty((existing as any)?.[docField]);
      if (!hasNew && !hasExisting) {
        errors[docField] = [`${docField} document is required.`];
      }
    }

    if (Object.keys(errors).length) {
      throw new BadRequestException({ status: 'validations', errors });
    }
  }

  async getMyProfile(facilitatorId: string): Promise<any> {
    const row = await this.facilitatorModel.findById(facilitatorId).lean();
    if (!row) throw new NotFoundException({ status: 'error', message: 'Facilitator not found' });
    const docApprovals = ((row as any).document_approvals || {}) as Record<
      string,
      { status?: string; remarks?: string }
    >;
    const hasDocumentReviews = Object.keys(docApprovals).length > 0;
    const rawApproval = String((row as any).approval_status || '').trim();
    const normalizedApproval = rawApproval.toLowerCase();
    const isDraftProfile =
      !hasDocumentReviews &&
      (String((row as any).profile_status || '').trim().toLowerCase() !== 'complete');
    const uiApprovalStatus = isDraftProfile
      ? 'Draft'
      : normalizedApproval === 'approved'
        ? 'Approved'
        : normalizedApproval === 'rejected'
          ? 'Rejected'
          : normalizedApproval === 'pending'
            ? 'Pending'
            : 'Draft';
    return {
      status: 'success',
      message: 'Profile fetched successfully',
      data: {
        ...(row as any),
        id: String((row as any)._id),
        industry_category: String((row as any).industry_category || (row as any).organization || ''),
        organization: String((row as any).industry_category || (row as any).organization || ''),
        approval_status: uiApprovalStatus,
        overall_approval_status: uiApprovalStatus,
        can_edit_profile: uiApprovalStatus !== 'Approved',
      },
    };
  }

  async updateMyProfile(
    facilitatorId: string,
    body: Record<string, any>,
    files?: Record<string, Express.Multer.File[]>,
  ): Promise<any> {
    const facilitator = await this.facilitatorModel.findById(facilitatorId);
    if (!facilitator) throw new NotFoundException({ status: 'error', message: 'Facilitator not found' });

    const filePath = (field: string) => (files?.[field]?.[0] ? `uploads/facilitators/${files[field][0].filename}` : undefined);

    this.assertRequiredProfileFields(body, facilitator, files);

    facilitator.consultant_id = String(body?.consultant_id ?? facilitator.consultant_id ?? '').trim();
    facilitator.name = String(body?.name ?? facilitator.name ?? '').trim();
    facilitator.email = String(body?.email ?? facilitator.email ?? '').trim().toLowerCase();
    facilitator.mobile = String(body?.mobile ?? facilitator.mobile ?? '').trim();

    const nextOrganization =
      body?.organization ??
      body?.industry_category ??
      facilitator.industry_category ??
      (facilitator as any).organization;
    facilitator.industry_category = nextOrganization;
    (facilitator as any).organization = nextOrganization;
    facilitator.alternate_mobile = body?.alternate_mobile ?? facilitator.alternate_mobile;
    facilitator.address_line_1 = body?.address_line_1 ?? facilitator.address_line_1;
    facilitator.address_line_2 = body?.address_line_2 ?? facilitator.address_line_2;
    facilitator.pincode = body?.pincode ?? facilitator.pincode;
    facilitator.city = body?.city ?? facilitator.city;
    facilitator.state = body?.state ?? facilitator.state;

    // Profile-specific professional details
    (facilitator as any).educational_qualification =
      body?.educational_qualification ?? (facilitator as any).educational_qualification;
    (facilitator as any).additional_professional_qualification =
      body?.additional_professional_qualification ?? (facilitator as any).additional_professional_qualification;
    (facilitator as any).total_years_professional_experience =
      body?.total_years_professional_experience ?? (facilitator as any).total_years_professional_experience;
    (facilitator as any).years_env_sustainability =
      body?.years_env_sustainability ?? (facilitator as any).years_env_sustainability;
    (facilitator as any).areas_of_specialization =
      body?.areas_of_specialization ?? (facilitator as any).areas_of_specialization;
    (facilitator as any).company_website =
      body?.company_website ?? (facilitator as any).company_website;
    (facilitator as any).linkedin_profile =
      body?.linkedin_profile ?? (facilitator as any).linkedin_profile;
    (facilitator as any).declaration_accepted =
      body?.declaration_accepted !== undefined
        ? this.toBool(body.declaration_accepted)
        : (facilitator as any).declaration_accepted;

    facilitator.profile_image = filePath('profile_image') ?? facilitator.profile_image;
    facilitator.vendor_registration_form =
      filePath('vendor_registration_form') ?? facilitator.vendor_registration_form;

    // Keep old + new aliases supported.
    (facilitator as any).brief_profile_individual =
      filePath('brief_profile_individual') ?? (facilitator as any).brief_profile_individual;
    facilitator.biodata =
      filePath('biodata') ??
      filePath('brief_profile_individual') ??
      facilitator.biodata;
    (facilitator as any).brief_profile_organization =
      filePath('brief_profile_organization') ?? (facilitator as any).brief_profile_organization;
    (facilitator as any).projects_handled =
      filePath('projects_handled') ?? (facilitator as any).projects_handled;

    const prev = ((facilitator as any).document_approvals || {}) as Record<
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
      if (files?.[key]?.[0]) {
        docApprovals[key] = { status: 'Pending', remarks: '' };
      }
    }
    // Alias handling: re-uploading biodata should also reset brief_profile_individual.
    if (files?.biodata?.[0]) {
      docApprovals.brief_profile_individual = { status: 'Pending', remarks: '' };
    }
    (facilitator as any).document_approvals = docApprovals;

    // Facilitator self-submit must always go for admin re-review.
    // This prevents any stale "Approved" status from remaining after facilitator updates.
    facilitator.approval_status = 'Pending';
    facilitator.approval_remarks = '';
    facilitator.profile_status = 'Complete';

    await facilitator.save();

    return {
      status: 'success',
      message: 'Profile submitted for approval',
      data: {
        id: facilitator._id.toString(),
        consultant_id: facilitator.consultant_id || '',
        approval_status: facilitator.approval_status,
        profile_status: facilitator.profile_status,
      },
    };
  }
}
