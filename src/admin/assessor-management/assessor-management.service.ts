import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Assessor, AssessorDocument } from '../../company/schemas/assessor.schema';
import { State, StateDocument } from '../../company/schemas/state.schema';
import { Industry, IndustryDocument } from '../../company/schemas/industry.schema';
import { CreateAssessorDto } from './dto/create-assessor.dto';
import { UpdateAssessorDto } from './dto/update-assessor.dto';
import { passwordGeneration } from '../../helpers/password.helper';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class AssessorManagementService {
  constructor(
    @InjectModel(Assessor.name) private readonly assessorModel: Model<AssessorDocument>,
    @InjectModel(State.name) private readonly stateModel: Model<StateDocument>,
    @InjectModel(Industry.name) private readonly industryModel: Model<IndustryDocument>,
  ) {}

  private mapAssessor(item: any) {
    const id = item?._id?.toString?.() || item?.id?.toString?.() || '';
    const verification = String(
      item?.verification_status ?? item?.verificationStatus ?? '0',
    );
    const profileUpdated = String(item?.profile_updated ?? '0');
    const verificationNum = verification === '1' ? 1 : 0;
    const profileUpdatedNum = profileUpdated === '1' ? 1 : 0;
    const withAssetUrl = (value: string | undefined) => {
      if (!value) return '';
      return String(value).startsWith('/uploads/') ? value : `/uploads/${value}`;
    };
    return {
      ...item,
      id,
      mobile_number: item?.mobile || '',
      category_id: item?.category_id || item?.industryCategory || '',
      industryCategory: item?.industryCategory || item?.category_id || '',
      assessor_grade_id: item?.assessor_grade_id || '',
      assessor_grade: item?.assessor_grade || item?.grade || '',
      pan_number: item?.pan_number || item?.pan_no || '',
      pan_no: item?.pan_no || item?.pan_number || '',
      verification_status: verification,
      verificationStatus: verification,
      verification_status_num: verificationNum,
      profile_updated: profileUpdated,
      profile_updated_num: profileUpdatedNum,
      profileStatus: profileUpdatedNum === 1 ? 'Completed' : 'Pending',
      can_view: profileUpdatedNum === 1,
      company_logo_url: withAssetUrl(item?.company_logo || item?.profile_image),
      profile_image_url: withAssetUrl(item?.profile_image || item?.company_logo),
      cancelled_check_url: withAssetUrl(
        item?.cancelled_check || item?.cancelled_cheque || item?.cancel_check,
      ),
      cancel_check_url: withAssetUrl(
        item?.cancel_check || item?.cancelled_check || item?.cancelled_cheque,
      ),
      health_doc_url: withAssetUrl(item?.health_doc || item?.health_document),
      health_document_url: withAssetUrl(item?.health_document || item?.health_doc),
      gst_form_url: withAssetUrl(item?.gst_form),
      vendor_stamp_url: withAssetUrl(item?.vendor_stamp || item?.vendorstamp),
      ndc_form_url: withAssetUrl(item?.ndc_form || item?.ndc),
      pan_url: withAssetUrl(item?.pan),
      biodata_url: withAssetUrl(item?.biodata),
    };
  }

  private applyUploadedFiles(
    payload: Record<string, any>,
    files: Express.Multer.File[] = [],
  ) {
    const fieldToSchemaKey: Record<string, string> = {
      company_logo: 'company_logo',
      profile_image: 'company_logo',
      cancelled_check: 'cancelled_check',
      cancelled_cheque: 'cancelled_check',
      cancel_check: 'cancelled_check',
      health_doc: 'health_doc',
      health_document: 'health_doc',
      gst_form: 'gst_form',
      vendor_stamp: 'vendor_stamp',
      vendorstamp: 'vendor_stamp',
      ndc_form: 'ndc_form',
      ndc: 'ndc_form',
      pan: 'pan',
      biodata: 'biodata',
    };
    for (const f of files) {
      const schemaKey = fieldToSchemaKey[f.fieldname];
      if (!schemaKey) continue;
      payload[schemaKey] = `assessors/${f.filename}`;
    }
  }

  private toZeroOne(value: unknown): string {
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return value === 1 ? '1' : '0';
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'completed', 'active', 'approved'].includes(normalized)) {
        return '1';
      }
      return '0';
    }
    return '0';
  }

  private setIfDefined(
    payload: Record<string, any>,
    key: string,
    value: unknown,
    transform?: (v: unknown) => unknown,
  ) {
    if (value === undefined) return;
    payload[key] = transform ? transform(value) : value;
  }

  private toTrimmedText(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    return '';
  }

  private applyStatusFields(payload: Record<string, any>, dto: UpdateAssessorDto) {
    this.setIfDefined(payload, 'status', dto.status, (v) => this.toZeroOne(v));
    this.setIfDefined(payload, 'verification_status', dto.verification_status, (v) =>
      this.toZeroOne(v),
    );
    this.setIfDefined(payload, 'verification_status', dto.verificationStatus, (v) =>
      this.toZeroOne(v),
    );
    const hasExplicitProfileUpdated = dto.profile_updated !== undefined;
    this.setIfDefined(payload, 'profile_updated', dto.profile_updated, (v) =>
      this.toZeroOne(v),
    );
    const profileStatusValue = dto.profileStatus ?? (dto as any).profile_status;
    if (!hasExplicitProfileUpdated && profileStatusValue !== undefined) {
      payload.profile_updated =
        String(profileStatusValue).trim().toLowerCase() === 'completed' ? '1' : '0';
    }
    this.setIfDefined(payload, 'gst_enabled', dto.gst_enabled, (v) => this.toZeroOne(v));
    this.setIfDefined(payload, 'gst', dto.gst, (v) => this.toZeroOne(v));
  }

  private applyBasicFields(payload: Record<string, any>, dto: UpdateAssessorDto) {
    this.setIfDefined(payload, 'name', dto.name, (v) => this.toTrimmedText(v));
    this.setIfDefined(payload, 'email', dto.email, (v) =>
      this.toTrimmedText(v).toLowerCase(),
    );
    this.setIfDefined(payload, 'mobile', dto.mobile, (v) => this.toTrimmedText(v));
    this.setIfDefined(payload, 'mobile', dto.mobile_number, (v) => this.toTrimmedText(v));
    this.setIfDefined(payload, 'alternate_mobile', dto.alternate_mobile, (v) =>
      this.toTrimmedText(v),
    );
    this.setIfDefined(payload, 'industryCategory', dto.industryCategory);
    this.setIfDefined(payload, 'category_id', dto.category_id);
    this.setIfDefined(payload, 'assessor_grade_id', dto.assessor_grade_id);
  }

  private buildUpdatePayload(dto: UpdateAssessorDto): Record<string, any> {
    const payload: Record<string, any> = {};
    this.applyBasicFields(payload, dto);
    this.applyStatusFields(payload, dto);

    const passthroughFields = [
      'state_id',
      'city',
      'address1',
      'address2',
      'pincode',
      'assessor_grade',
      'grade',
      'gstin_no',
      'emergency_name',
      'emergency_mobile',
      'emergency_address1',
      'emergency_address2',
      'emergency_city',
      'emergency_state_id',
      'emergency_pincode',
      'bank_name',
      'account_number',
      'branch_name',
      'ifsc_code',
      'pan_number',
      'pan_no',
    ];
    passthroughFields.forEach((f) => {
      if ((dto as any)[f] !== undefined) payload[f] = (dto as any)[f];
    });

    return payload;
  }

  private async validateUniqueFields(assessorId: string, payload: Record<string, any>) {
    if (payload.email) {
      const emailExists = await this.assessorModel.findOne({
        _id: { $ne: assessorId },
        email: payload.email,
      });
      if (emailExists) {
        throw new ConflictException({
          status: 'validations',
          errors: { email: ['Email already exists'] },
        });
      }
    }

    if (payload.mobile) {
      const mobileExists = await this.assessorModel.findOne({
        _id: { $ne: assessorId },
        mobile: payload.mobile,
      });
      if (mobileExists) {
        throw new ConflictException({
          status: 'validations',
          errors: { mobile: ['Mobile number already exists'] },
        });
      }
    }
  }

  private isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    return false;
  }

  private hasLikelyFinalFormContent(payload: Record<string, any>): boolean {
    const indicatorKeys = [
      'address1',
      'city',
      'pincode',
      'emergency_name',
      'emergency_mobile',
      'bank_name',
      'account_number',
      'ifsc_code',
      'assessor_grade',
      'assessor_grade_id',
      'category_id',
      'industryCategory',
    ];
    return indicatorKeys.some((k) => !this.isEmptyValue(payload[k]));
  }

  private validateFinalSubmitPayload(merged: Record<string, any>) {
    const errors: Record<string, string[]> = {};
    const addError = (field: string, message: string) => {
      if (!errors[field]) errors[field] = [];
      errors[field].push(message);
    };

    const requiredFields: Array<{ key: string; label: string }> = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'mobile', label: 'Mobile number' },
      { key: 'status', label: 'Account status' },
      { key: 'state_id', label: 'State' },
      { key: 'city', label: 'City' },
      { key: 'address1', label: 'Address line 1' },
      { key: 'pincode', label: 'Pincode' },
      { key: 'category_id', label: 'Industry category' },
      { key: 'assessor_grade', label: 'Assessor grade' },
      { key: 'emergency_name', label: 'Emergency contact name' },
      { key: 'emergency_mobile', label: 'Emergency contact mobile' },
      { key: 'emergency_address1', label: 'Emergency address line 1' },
      { key: 'emergency_city', label: 'Emergency city' },
      { key: 'emergency_state_id', label: 'Emergency state' },
      { key: 'emergency_pincode', label: 'Emergency pincode' },
      { key: 'bank_name', label: 'Bank name' },
      { key: 'account_number', label: 'Account number' },
      { key: 'branch_name', label: 'Branch name' },
      { key: 'ifsc_code', label: 'IFSC code' },
    ];

    // category / grade fallback aliases
    const categoryValue = merged.category_id ?? merged.industryCategory;
    const gradeValue = merged.assessor_grade ?? merged.assessor_grade_id ?? merged.grade;

    for (const field of requiredFields) {
      let value = merged[field.key];
      if (field.key === 'category_id') value = categoryValue;
      if (field.key === 'assessor_grade') value = gradeValue;
      if (this.isEmptyValue(value)) addError(field.key, `${field.label} is required for final submit`);
    }

    // GST validation: if enabled, GSTIN must be provided
    const gstFlag = this.toZeroOne(merged.gst_enabled ?? merged.gst);
    if (gstFlag === '1' && this.isEmptyValue(merged.gstin_no)) {
      addError('gstin_no', 'GSTIN number is required when GST is enabled');
    }

    return errors;
  }

  private resolveExplicitCompletionIntent(
    dto: UpdateAssessorDto,
    updatePayload: Record<string, any>,
  ): { explicitDraft: boolean; explicitFinal: boolean } {
    const hasExplicitProfileUpdated = dto.profile_updated !== undefined;
    const profileStatusValue = dto.profileStatus ?? (dto as any).profile_status;
    const hasExplicitProfileStatus = profileStatusValue !== undefined;
    const finalSubmitValue =
      (dto as any)?.finalSubmit ??
      (dto as any)?.final_submit ??
      (dto as any)?.is_final_submit;
    const hasExplicitFinalSubmit = finalSubmitValue !== undefined;

    if (hasExplicitProfileUpdated) {
      return {
        explicitDraft: updatePayload.profile_updated === '0',
        explicitFinal: updatePayload.profile_updated === '1',
      };
    }

    if (hasExplicitProfileStatus) {
      const status = String(profileStatusValue || '').trim().toLowerCase();
      return {
        explicitDraft: status === 'pending',
        explicitFinal: status === 'completed',
      };
    }

    if (hasExplicitFinalSubmit) {
      const isFinal = this.toZeroOne(finalSubmitValue) === '1';
      return {
        explicitDraft: !isFinal,
        explicitFinal: isFinal,
      };
    }

    return { explicitDraft: false, explicitFinal: false };
  }

  async createAssessor(dto: CreateAssessorDto) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const mobile = dto.mobile.trim();

    const existing = await this.assessorModel.find({
      $or: [
        { email },
        { mobile },
        { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } },
      ],
    });
    const conflictErrors: Record<string, string[]> = {};
    const nameTaken = existing.some(
      (a: any) => String(a?.name || '').trim().toLowerCase() === name.toLowerCase(),
    );
    const emailTaken = existing.some(
      (a: any) => String(a?.email || '').trim().toLowerCase() === email,
    );
    const mobileTaken = existing.some((a: any) => String(a?.mobile || '').trim() === mobile);

    if (nameTaken) {
      conflictErrors.name = ['Name is already taken'];
    }
    if (emailTaken) {
      conflictErrors.email = ['Email is already taken'];
    }
    if (mobileTaken) {
      conflictErrors.mobile = ['Mobile number is already taken'];
    }

    if (Object.keys(conflictErrors).length > 0) {
      throw new ConflictException({
        status: 'validations',
        errors: conflictErrors,
      });
    }

    const generatedPassword = passwordGeneration(8);
    const password = await bcrypt.hash(generatedPassword, 10);
    let status = '1';
    if (dto.status !== undefined) {
      status = String(dto.status) === '1' ? '1' : '0';
    }

    await this.assessorModel.create({
      name,
      email,
      mobile,
      password,
      status,
      verification_status: '0',
      profile_updated: '0',
    });

    return {
      status: 'success',
      message: 'Assessor added successfully!',
      data: {
        generated_password: generatedPassword,
      },
    };
  }

  private async buildCategoryFilter(categoryIdRaw: string): Promise<Record<string, any>> {
    const cid = categoryIdRaw.trim();
    const ors: Record<string, any>[] = [{ category_id: cid }];
    if (Types.ObjectId.isValid(cid)) {
      ors.push({ category_id: new Types.ObjectId(cid) });
      const ind = await this.industryModel.findById(cid).select('name').lean();
      if (ind?.name) {
        ors.push({ industryCategory: ind.name });
        ors.push({
          industryCategory: { $regex: `^${escapeRegex(ind.name)}$`, $options: 'i' },
        });
      }
    } else {
      ors.push({ industryCategory: { $regex: escapeRegex(cid), $options: 'i' } });
    }
    return { $or: ors };
  }

  private async buildStateFilter(stateIdRaw: string): Promise<Record<string, any>> {
    const sid = stateIdRaw.trim();
    const candidates = new Set<string>([sid]);
    if (Types.ObjectId.isValid(sid)) {
      const doc = await this.stateModel.findById(sid).select('code name').lean();
      if (doc) {
        candidates.add(String((doc as any)._id));
        if ((doc as any).code) candidates.add(String((doc as any).code));
      }
    } else {
      const byCode = await this.stateModel.findOne({ code: sid }).select('_id code').lean();
      if (byCode) {
        candidates.add(String((byCode as any)._id));
        if ((byCode as any).code) candidates.add(String((byCode as any).code));
      }
      const byName = await this.stateModel
        .findOne({ name: { $regex: `^${escapeRegex(sid)}$`, $options: 'i' } })
        .select('_id code')
        .lean();
      if (byName) {
        candidates.add(String((byName as any)._id));
        if ((byName as any).code) candidates.add(String((byName as any).code));
      }
    }
    return { state_id: { $in: [...candidates] } };
  }

  private statusIn(value: string): Record<string, any> {
    const s = String(value);
    const alt = s === '1' || s === '0' ? (s === '1' ? 1 : 0) : s;
    return { $in: [s, alt] };
  }

  async listAssessors(query: Record<string, any>) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 10), 1), 100);
    const skip = (page - 1) * limit;

    const andParts: Record<string, any>[] = [];

    const name = typeof query.name === 'string' ? query.name.trim() : '';
    if (name) andParts.push({ name: { $regex: escapeRegex(name), $options: 'i' } });

    const email = typeof query.email === 'string' ? query.email.trim() : '';
    if (email) andParts.push({ email: { $regex: escapeRegex(email), $options: 'i' } });

    const mobile = typeof query.mobile === 'string' ? query.mobile.trim() : '';
    if (mobile) andParts.push({ mobile: { $regex: escapeRegex(mobile), $options: 'i' } });

    if (query.status !== undefined && query.status !== '') {
      andParts.push({ status: this.statusIn(String(query.status)) });
    }
    if (query.verificationStatus !== undefined && query.verificationStatus !== '') {
      andParts.push({
        verification_status: this.statusIn(String(query.verificationStatus)),
      });
    }

    const categoryRaw =
      query.category_id !== undefined && query.category_id !== null
        ? String(query.category_id).trim()
        : '';
    if (categoryRaw !== '') {
      andParts.push(await this.buildCategoryFilter(categoryRaw));
    }

    const stateRaw =
      query.state_id !== undefined && query.state_id !== null
        ? String(query.state_id).trim()
        : '';
    if (stateRaw !== '') {
      andParts.push(await this.buildStateFilter(stateRaw));
    }

    const ps = query.profileStatus ?? query.profile_status;
    if (ps !== undefined && ps !== null && String(ps).trim() !== '') {
      const normalized = String(ps).trim().toLowerCase();
      if (normalized !== 'all') {
        if (
          normalized === 'completed' ||
          normalized === '1' ||
          normalized === 'true'
        ) {
          andParts.push({ profile_updated: { $in: ['1', 1] } });
        } else if (
          normalized === 'pending' ||
          normalized === '0' ||
          normalized === 'false'
        ) {
          andParts.push({
            $or: [
              { profile_updated: { $in: ['0', 0] } },
              { profile_updated: { $exists: false } },
              { profile_updated: null },
              { profile_updated: '' },
            ],
          });
        }
      }
    }

    let where: Record<string, any>;
    if (andParts.length === 0) where = {};
    else if (andParts.length === 1) where = andParts[0];
    else where = { $and: andParts };

    const [items, total] = await Promise.all([
      this.assessorModel
        .find(where)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.assessorModel.countDocuments(where),
    ]);

    return {
      status: 'success',
      data: {
        items: (items as any[]).map((i) => this.mapAssessor(i.toObject ? i.toObject() : i)),
        total,
        page,
        limit,
      },
    };
  }

  async getAssessorById(id: string, query: Record<string, any> = {}) {
    const assessorId = String(id || '').trim();
    const email = typeof query.email === 'string' ? query.email.trim().toLowerCase() : '';
    const mobile = typeof query.mobile === 'string' ? query.mobile.trim() : '';

    const resolveByFallback = async () => {
      if (!email && !mobile) return null;
      const ors: Record<string, any>[] = [];
      if (email) ors.push({ email });
      if (mobile) ors.push({ mobile });
      if (ors.length === 0) return null;
      return this.assessorModel.findOne({ $or: ors }).select('-password');
    };

    let assessor: any = null;
    if (Types.ObjectId.isValid(assessorId)) {
      assessor = await this.assessorModel.findById(assessorId).select('-password');
    } else {
      assessor = await resolveByFallback();
      if (!assessor) {
        throw new BadRequestException({
          status: 'error',
          message: 'Invalid assessor id',
        });
      }
    }

    if (!assessor) assessor = await resolveByFallback();
    if (!assessor) {
      throw new NotFoundException({
        status: 'error',
        message: 'Assessor not found',
      });
    }

    return {
      status: 'success',
      data: this.mapAssessor(assessor.toObject ? assessor.toObject() : assessor),
    };
  }

  async updateAssessorById(id: string, dto: UpdateAssessorDto, files: Express.Multer.File[] = []) {
    const assessorId = String(id || '').trim();
    if (!Types.ObjectId.isValid(assessorId)) {
      throw new BadRequestException({
        status: 'error',
        message: 'Invalid assessor id',
      });
    }

    const existing = await this.assessorModel.findById(assessorId).select('-password');
    if (!existing) {
      throw new NotFoundException({
        status: 'error',
        message: 'Assessor not found',
      });
    }

    const updatePayload = this.buildUpdatePayload(dto);
    this.applyUploadedFiles(updatePayload, files);
    // Some UIs submit "finalSubmit" flag instead of profile_updated/profileStatus.
    const maybeFinalSubmit =
      (dto as any)?.finalSubmit ??
      (dto as any)?.final_submit ??
      (dto as any)?.is_final_submit;
    if (maybeFinalSubmit !== undefined) {
      updatePayload.profile_updated = this.toZeroOne(maybeFinalSubmit);
    }
    await this.validateUniqueFields(assessorId, updatePayload);

    const existingObj = existing.toObject ? existing.toObject() : (existing as any);
    const merged = { ...existingObj, ...updatePayload };

    const { explicitDraft, explicitFinal } = this.resolveExplicitCompletionIntent(
      dto,
      updatePayload,
    );

    // Strict validation when explicitly final submit.
    if (explicitFinal) {
      const errors = this.validateFinalSubmitPayload(merged);
      if (Object.keys(errors).length > 0) {
        throw new BadRequestException({
          status: 'validations',
          errors,
        });
      }
      updatePayload.profile_updated = '1';
    } else if (!explicitDraft) {
      // Auto-complete when profile data is fully filled even if UI forgot final flag.
      const errors = this.validateFinalSubmitPayload(merged);
      if (
        Object.keys(errors).length === 0 ||
        this.hasLikelyFinalFormContent(updatePayload)
      ) {
        // Also handles legacy UIs that submit final form without explicit final flag.
        updatePayload.profile_updated = '1';
      }
    }

    const updated = await this.assessorModel
      .findByIdAndUpdate(assessorId, { $set: updatePayload }, { new: true })
      .select('-password');

    return {
      status: 'success',
      message: 'Assessor updated successfully',
      data: this.mapAssessor(updated?.toObject ? updated.toObject() : updated),
    };
  }
}
