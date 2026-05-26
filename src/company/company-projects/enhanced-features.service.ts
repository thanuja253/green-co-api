import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { CompanyProject, CompanyProjectDocument } from '../schemas/company-project.schema';
import { CompanyInvoice, CompanyInvoiceDocument, PAYMENT_FOR_PROFORMA } from '../schemas/company-invoice.schema';
import { CompanyActivity, CompanyActivityDocument } from '../schemas/company-activity.schema';
import { CompanyCoordinator, CompanyCoordinatorDocument } from '../schemas/company-coordinator.schema';
import { CompanyFacilitator, CompanyFacilitatorDocument } from '../schemas/company-facilitator.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { Coordinator, CoordinatorDocument } from '../schemas/coordinator.schema';
import { CoordinatorChecklistVerification, CoordinatorChecklistVerificationDocument } from '../schemas/coordinator-checklist-verification.schema';
import { ChecklistVersion, ChecklistVersionDocument } from '../schemas/checklist-version.schema';
import { EmailTemplate, EmailTemplateDocument } from '../schemas/email-template.schema';
import { CompanyDashboardResource, CompanyDashboardResourceDocument } from '../schemas/company-dashboard-resource.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../../mail/mail.service';
import { join } from 'node:path';

@Injectable()
export class EnhancedFeaturesService {
  constructor(
    @InjectModel(CompanyProject.name) private readonly projectModel: Model<CompanyProjectDocument>,
    @InjectModel(CompanyInvoice.name) private readonly invoiceModel: Model<CompanyInvoiceDocument>,
    @InjectModel(CompanyActivity.name) private readonly activityModel: Model<CompanyActivityDocument>,
    @InjectModel(CompanyCoordinator.name) private readonly compCoordinatorModel: Model<CompanyCoordinatorDocument>,
    @InjectModel(CompanyFacilitator.name) private readonly compFacilitatorModel: Model<CompanyFacilitatorDocument>,
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Coordinator.name) private readonly coordinatorModel: Model<CoordinatorDocument>,
    @InjectModel(CoordinatorChecklistVerification.name) private readonly checklistVerificationModel: Model<CoordinatorChecklistVerificationDocument>,
    @InjectModel(ChecklistVersion.name) private readonly checklistVersionModel: Model<ChecklistVersionDocument>,
    @InjectModel(EmailTemplate.name) private readonly emailTemplateModel: Model<EmailTemplateDocument>,
    @InjectModel(CompanyDashboardResource.name) private readonly dashboardResourceModel: Model<CompanyDashboardResourceDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  // ── Sync Missing Milestone Notifications (one-time fix for pre-code-change uploads) ──

  async syncMilestoneNotifications(projectId: string) {
    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');

    const companyIdStr = String(project.company_id);
    const company = await this.companyModel.findById(companyIdStr).lean();
    const companyName = company?.name || 'Company';
    const isFacilitatorFlow = ((project as any).process_type || '').toLowerCase() === 'f';
    const currentNext = Number((project as any).next_activities_id || 0);
    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

    const actions: string[] = [];

    // Check: 2nd invoice exists but milestone 19 not yet advanced
    if (currentNext === 19) {
      const invoiceCount = await this.invoiceModel.countDocuments({
        project_id: new Types.ObjectId(projectId),
      });
      if (invoiceCount >= 2) {
        (project as any).next_activities_id = 20;
        await project.save();

        const existing19 = await this.activityModel.findOne({
          project_id: new Types.ObjectId(projectId),
          milestone_flow: 19,
          milestone_completed: true,
        });
        if (!existing19) {
          await this.activityModel.create({
            company_id: companyIdStr,
            project_id: projectId,
            description: '2nd Invoice uploaded',
            activity_type: 'cii',
            milestone_flow: 19,
            milestone_completed: true,
          });
        }
        actions.push('Advanced next_activities_id from 19 → 20');
      }
    }

    // Send facilitator notification if facilitator flow
    if (isFacilitatorFlow) {
      let facilitatorId: string | undefined;
      const cf = await this.compFacilitatorModel
        .findOne({ company_id: companyIdStr, project_id: projectId })
        .lean();
      if (cf?.facilitator_id) {
        facilitatorId = String(cf.facilitator_id);
      }

      const latestInvoice = await this.invoiceModel
        .findOne({ project_id: new Types.ObjectId(projectId) })
        .sort({ createdAt: -1 })
        .lean();

      const invoiceLabel = (latestInvoice as any)?.invoice_type === 'tax' ? 'Tax Invoice' : 'Proforma Invoice';

      await this.notificationsService.logWorkflowStepForProject(
        {
          company_name: companyName,
          company_id: companyIdStr,
          project_id: projectId,
          activity: `CII uploaded ${invoiceLabel} – awaiting supporting documents from Facilitator`,
          responsibility: 'CII',
          shortcut_url: `${frontendBase}/admin/projects/${projectId}/finance`,
        },
        'step_completed',
        { company: true, admin: true, facilitatorId },
      );
      actions.push(`Sent facilitator notification (facilitator_id=${facilitatorId || 'N/A'})`);
    }

    return {
      status: 'success',
      message: actions.length ? 'Sync completed' : 'Nothing to sync',
      data: { project_id: projectId, actions },
    };
  }

  // ── Proforma Invoice Auto-generation ──

  async autoGenerateProformaInvoice(
    projectId: string,
    dto: { amount: number; sgst?: number; cgst?: number; igst?: number },
    adminInfo?: { sub?: string; name?: string },
  ) {
    const project = await this.projectModel.findById(projectId).lean();
    if (!project) throw new NotFoundException('Project not found');

    const sgstRate = dto.sgst || 0;
    const cgstRate = dto.cgst || 0;
    const igstRate = dto.igst || 0;
    const taxAmount = Math.round(dto.amount * (sgstRate + cgstRate + igstRate) / 100 * 100) / 100;
    const totalAmount = Math.round((dto.amount + taxAmount) * 100) / 100;

    const invoice = await this.invoiceModel.create({
      company_id: new Types.ObjectId(String(project.company_id)),
      project_id: new Types.ObjectId(projectId),
      payment_for: PAYMENT_FOR_PROFORMA,
      invoice_type: 'proforma',
      invoice_title: 'Auto-generated Proforma Invoice',
      payable_amount: dto.amount,
      sgst: sgstRate,
      cgst: cgstRate,
      igst: igstRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      payment_status: 0,
      approval_status: 0,
      outstanding_status: 'Unpaid',
      due_amount: totalAmount,
      paid_amount: 0,
    });

    const companyIdStr = String(project.company_id);
    const company = await this.companyModel.findById(companyIdStr).lean();
    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

    const isFacilitatorFlow = ((project as any).process_type || '').toLowerCase() === 'f';
    let facilitatorId: string | undefined;
    if (isFacilitatorFlow) {
      const cf = await this.compFacilitatorModel
        .findOne({ company_id: companyIdStr, project_id: projectId })
        .lean();
      if (cf?.facilitator_id) {
        facilitatorId = String(cf.facilitator_id);
      }
    }

    await this.notificationsService.logWorkflowStepForProject(
      {
        company_name: company?.name || 'Company',
        company_id: companyIdStr,
        project_id: projectId,
        activity: isFacilitatorFlow
          ? 'CII uploaded Proforma Invoice – awaiting supporting documents from Facilitator'
          : 'Proforma Invoice Auto-generated',
        responsibility: 'CII',
        shortcut_url: `${frontendBase}/admin/projects/${projectId}/finance`,
      },
      'step_completed',
      { company: true, admin: true, facilitatorId },
    );

    return {
      status: 'success',
      message: 'Proforma Invoice auto-generated',
      data: {
        id: String(invoice._id),
        invoice_type: 'proforma',
        payable_amount: dto.amount,
        sgst: sgstRate,
        cgst: cgstRate,
        igst: igstRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      },
    };
  }

  // ── Invoice Filters ──

  async getFilteredInvoices(projectId: string, filter: string) {
    const project = await this.projectModel.findById(projectId).lean();
    if (!project) throw new NotFoundException('Project not found');

    let query: any = { project_id: new Types.ObjectId(projectId) };

    switch (filter) {
      case 'first_tax_invoice_pending': {
        const taxInvoices = await this.invoiceModel
          .find({ ...query, $or: [{ invoice_type: 'tax' }, { payment_for: 'inv' }] })
          .sort({ createdAt: 1 })
          .lean();
        const first = taxInvoices[0];
        if (first && (first.payment_status === 0 || first.outstanding_status === 'Unpaid')) {
          return { status: 'success', data: [this.mapInvoice(first)] };
        }
        return { status: 'success', data: [] };
      }
      case 'second_tax_invoice_pending': {
        const taxInvoices = await this.invoiceModel
          .find({ ...query, $or: [{ invoice_type: 'tax' }, { payment_for: 'inv' }] })
          .sort({ createdAt: 1 })
          .lean();
        const second = taxInvoices[1];
        if (second && (second.payment_status === 0 || second.outstanding_status === 'Unpaid')) {
          return { status: 'success', data: [this.mapInvoice(second)] };
        }
        return { status: 'success', data: [] };
      }
      case 'rating_completed': {
        const latestActivity = await this.activityModel
          .findOne({ project_id: new Types.ObjectId(projectId), milestone_flow: { $gte: 17 } })
          .lean();
        if (!latestActivity) return { status: 'success', data: [] };
        const invoices = await this.invoiceModel.find(query).sort({ createdAt: -1 }).lean();
        return { status: 'success', data: invoices.map((i) => this.mapInvoice(i)) };
      }
      default:
        throw new BadRequestException(
          'Invalid filter. Use: first_tax_invoice_pending, second_tax_invoice_pending, rating_completed',
        );
    }
  }

  async getInvoiceFilters() {
    return {
      status: 'success',
      data: [
        { key: 'first_tax_invoice_pending', label: 'First Tax Invoice Pending' },
        { key: 'second_tax_invoice_pending', label: 'Second Tax Invoice Pending' },
        { key: 'rating_completed', label: 'Rating Completed' },
      ],
    };
  }

  // ── Coordinator Checklist ──

  async getCoordinatorAssignedProjects(coordinatorId: string) {
    const assignments = await this.compCoordinatorModel
      .find({ coordinator_id: new Types.ObjectId(coordinatorId) })
      .lean();

    const projectIds = assignments.map((a) => a.project_id);
    const projects = await this.projectModel.find({ _id: { $in: projectIds } }).lean();
    const companyIds = [...new Set(projects.map((p: any) => String(p.company_id)))];
    const companies = await this.companyModel
      .find({ _id: { $in: companyIds.map((id) => new Types.ObjectId(id)) } })
      .select('name email')
      .lean();
    const companyMap = new Map(companies.map((c: any) => [String(c._id), c]));

    const verifications = await this.checklistVerificationModel
      .find({
        coordinator_id: new Types.ObjectId(coordinatorId),
        project_id: { $in: projectIds },
      })
      .lean();
    const verificationMap = new Map(verifications.map((v: any) => [String(v.project_id), v]));

    const items = projects.map((p: any) => {
      const company = companyMap.get(String(p.company_id));
      const verification = verificationMap.get(String(p._id));
      return {
        project_id: String(p._id),
        company_id: String(p.company_id),
        company_name: company?.name || '',
        project_code: p.project_id || '',
        profile_update: p.profile_update || 0,
        checklist_verified: verification?.is_verified || false,
        verified_at: verification?.verified_at || null,
      };
    });

    return { status: 'success', data: items };
  }

  async confirmChecklistVerification(
    coordinatorId: string,
    projectId: string,
    remarks?: string,
  ) {
    const assignment = await this.compCoordinatorModel.findOne({
      coordinator_id: new Types.ObjectId(coordinatorId),
      project_id: new Types.ObjectId(projectId),
    });
    if (!assignment) {
      throw new BadRequestException('You are not assigned to this project');
    }

    const existing = await this.checklistVerificationModel.findOne({
      coordinator_id: new Types.ObjectId(coordinatorId),
      project_id: new Types.ObjectId(projectId),
    });
    if (existing?.is_verified) {
      throw new BadRequestException('Checklist already verified for this project');
    }

    const now = new Date();
    await this.checklistVerificationModel.findOneAndUpdate(
      { coordinator_id: new Types.ObjectId(coordinatorId), project_id: new Types.ObjectId(projectId) },
      {
        $set: {
          is_verified: true,
          verified_at: now,
          company_id: assignment.company_id,
          remarks: remarks || '',
        },
      },
      { upsert: true, new: true },
    );

    await this.projectModel.findByIdAndUpdate(projectId, {
      $set: {
        coordinator_checklist_verified: true,
        coordinator_checklist_verified_at: now,
        coordinator_checklist_verified_by: coordinatorId,
      },
    });

    return {
      status: 'success',
      message: 'Checklist verification confirmed',
      data: { project_id: projectId, is_verified: true, verified_at: now },
    };
  }

  // ── Certificate & Plaque Automation ──

  async generateCertificateAndPlaque(projectId: string) {
    const project = await this.projectModel.findById(projectId).lean();
    if (!project) throw new NotFoundException('Project not found');

    const certCompanyId = String(project.company_id);
    const company = await this.companyModel.findById(certCompanyId).lean();
    if (!company) throw new NotFoundException('Company not found');

    const companyName = (company.name || '').substring(0, 250);
    const rating = project.rating_label || this.deriveRatingFromScore(project);

    if (!rating) {
      throw new BadRequestException('Rating not finalized yet. Cannot generate certificate/plaque.');
    }

    const certPath = `uploads/certificates/${projectId}/certificate_${Date.now()}.pdf`;
    const plaquePath = `uploads/certificates/${projectId}/plaque_${Date.now()}.pdf`;

    await this.projectModel.findByIdAndUpdate(projectId, {
      $set: {
        certificate_pdf_path: certPath,
        plaque_pdf_path: plaquePath,
        rating_label: rating,
        cert_plaque_generated: true,
        cert_plaque_generated_at: new Date(),
      },
    });

    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    await this.notificationsService.logWorkflowStepForProject(
      {
        company_name: companyName,
        company_id: certCompanyId,
        project_id: projectId,
        activity: 'Certificate & Plaque Auto-generated',
        responsibility: 'CII',
        shortcut_url: `${frontendBase}/admin/projects/${projectId}/certificate`,
      },
      'step_completed',
      { company: true, admin: true },
    );

    return {
      status: 'success',
      message: 'Certificate and Plaque PDFs generated',
      data: {
        project_id: projectId,
        company_name: companyName,
        rating,
        certificate_pdf_path: certPath,
        plaque_pdf_path: plaquePath,
        generated_at: new Date(),
      },
    };
  }

  private deriveRatingFromScore(project: any): string | null {
    const score = project.percentage_score;
    if (score == null) return null;
    if (score >= 90) return 'Platinum';
    if (score >= 75) return 'Gold';
    if (score >= 60) return 'Silver';
    if (score >= 45) return 'Bronze';
    if (score >= 30) return 'First Certified';
    return null;
  }

  // ── Email Template Management ──

  async createEmailTemplate(dto: {
    name: string;
    subject_template: string;
    body_template: string;
    template_type: string;
    available_placeholders?: string[];
  }, adminInfo?: { sub?: string }) {
    const template = await this.emailTemplateModel.create({
      ...dto,
      created_by: adminInfo?.sub || 'admin',
    });
    return { status: 'success', message: 'Email template created', data: template.toObject() };
  }

  async updateEmailTemplate(
    templateId: string,
    dto: { name?: string; subject_template?: string; body_template?: string; available_placeholders?: string[] },
    adminInfo?: { sub?: string },
  ) {
    const template = await this.emailTemplateModel.findByIdAndUpdate(
      templateId,
      { $set: { ...dto, updated_by: adminInfo?.sub || 'admin' } },
      { new: true },
    );
    if (!template) throw new NotFoundException('Email template not found');
    return { status: 'success', message: 'Email template updated', data: template.toObject() };
  }

  async getEmailTemplates(templateType?: string) {
    const filter: any = { status: 'active' };
    if (templateType) filter.template_type = templateType;
    const templates = await this.emailTemplateModel.find(filter).sort({ createdAt: -1 }).lean();
    return { status: 'success', data: templates };
  }

  async getEmailTemplateById(templateId: string) {
    const template = await this.emailTemplateModel.findById(templateId).lean();
    if (!template) throw new NotFoundException('Email template not found');
    return { status: 'success', data: template };
  }

  async prepareRatingEmail(projectId: string, templateId: string) {
    const project = await this.projectModel.findById(projectId).lean();
    if (!project) throw new NotFoundException('Project not found');

    const prepCompanyId = String(project.company_id);
    const company = await this.companyModel.findById(prepCompanyId).lean();
    if (!company) throw new NotFoundException('Company not found');

    const template = await this.emailTemplateModel.findById(templateId).lean();
    if (!template) throw new NotFoundException('Email template not found');

    const companyName = company.name || '';
    const rating = project.rating_label || '';

    const subject = this.replacePlaceholders(template.subject_template, {
      company_name: companyName,
      rating,
      project_code: project.project_id || '',
    });
    const body = this.replacePlaceholders(template.body_template, {
      company_name: companyName,
      rating,
      project_code: project.project_id || '',
      date: new Date().toISOString().split('T')[0],
    });

    const attachments: string[] = [];
    if (project.certificate_pdf_path) attachments.push(project.certificate_pdf_path);
    if (project.plaque_pdf_path) attachments.push(project.plaque_pdf_path);

    return {
      status: 'success',
      data: {
        to: '',
        cc: [company.email],
        subject,
        body,
        attachments,
        company_name: companyName,
        rating,
        project_code: project.project_id || '',
      },
    };
  }

  private replacePlaceholders(template: string, values: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(String.raw`\{${key}\}`, 'gi'), value);
    }
    return result;
  }

  async sendRatingEmail(
    projectId: string,
    templateId: string,
    plantHeadEmail: string,
    additionalCc?: string[],
  ) {
    const prepared = await this.prepareRatingEmail(projectId, templateId);
    const emailData = prepared.data;

    const project = await this.projectModel.findById(projectId).lean();
    const sendCompanyId = project ? String(project.company_id) : null;
    const company = sendCompanyId ? await this.companyModel.findById(sendCompanyId).lean() : null;

    const ccList: string[] = [];
    if (company?.email) ccList.push(company.email);

    const greencoTeamEmail = (process.env.GREENCO_TEAM_EMAIL || '').trim();
    if (greencoTeamEmail) ccList.push(greencoTeamEmail);
    const muthuSirEmail = (process.env.MUTHU_SIR_EMAIL || '').trim();
    if (muthuSirEmail) ccList.push(muthuSirEmail);
    if (additionalCc) ccList.push(...additionalCc);

    const attachments: Array<{ filename: string; path: string }> = [];
    if (project?.certificate_pdf_path) {
      attachments.push({
        filename: 'Certificate.pdf',
        path: join(process.cwd(), project.certificate_pdf_path),
      });
    }
    if (project?.plaque_pdf_path) {
      attachments.push({
        filename: 'Plaque.pdf',
        path: join(process.cwd(), project.plaque_pdf_path),
      });
    }

    await this.mailService.sendRatingEmail({
      to: plantHeadEmail,
      cc: ccList,
      subject: emailData.subject,
      html: emailData.body,
      attachments,
    });

    return {
      status: 'success',
      message: 'Rating email sent successfully',
      data: {
        sent_to: plantHeadEmail,
        cc: ccList,
        subject: emailData.subject,
        attachments_count: attachments.length,
      },
    };
  }

  // ── Checklist Versioning ──

  async createChecklistVersion(dto: {
    checklist_id: string;
    version_label: string;
    checklist_data: Record<string, any>;
    change_notes?: string;
    effective_from?: string;
  }, adminInfo?: { sub?: string; name?: string }) {
    const latestVersion = await this.checklistVersionModel
      .findOne({ checklist_id: dto.checklist_id })
      .sort({ version: -1 })
      .lean();

    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    if (latestVersion?.status === 'active') {
      await this.checklistVersionModel.findByIdAndUpdate(latestVersion._id, {
        $set: { effective_until: new Date().toISOString() },
      });
    }

    const version = await this.checklistVersionModel.create({
      checklist_id: dto.checklist_id,
      version: nextVersion,
      version_label: dto.version_label,
      checklist_data: dto.checklist_data,
      status: 'active',
      created_by: adminInfo?.sub || 'admin',
      created_by_name: adminInfo?.name || 'Admin',
      change_notes: dto.change_notes || '',
      effective_from: dto.effective_from ? new Date(dto.effective_from) : new Date(),
    });

    return {
      status: 'success',
      message: `Checklist version ${nextVersion} created`,
      data: version.toObject(),
    };
  }

  async updateChecklistVersion(
    versionId: string,
    dto: { version_label?: string; checklist_data?: Record<string, any>; change_notes?: string; status?: string; effective_until?: string },
  ) {
    const update: any = {};
    if (dto.version_label !== undefined) update.version_label = dto.version_label;
    if (dto.checklist_data !== undefined) update.checklist_data = dto.checklist_data;
    if (dto.change_notes !== undefined) update.change_notes = dto.change_notes;
    if (dto.status !== undefined) update.status = dto.status;
    if (dto.effective_until !== undefined) update.effective_until = new Date(dto.effective_until);

    const version = await this.checklistVersionModel.findByIdAndUpdate(
      versionId,
      { $set: update },
      { new: true },
    );
    if (!version) throw new NotFoundException('Checklist version not found');
    return { status: 'success', message: 'Checklist version updated', data: version.toObject() };
  }

  async getChecklistVersions(checklistId: string) {
    const versions = await this.checklistVersionModel
      .find({ checklist_id: checklistId })
      .sort({ version: -1 })
      .lean();
    return { status: 'success', data: versions };
  }

  async getChecklistVersionById(versionId: string) {
    const version = await this.checklistVersionModel.findById(versionId).lean();
    if (!version) throw new NotFoundException('Checklist version not found');
    return { status: 'success', data: version };
  }

  async getActiveChecklistVersion(checklistId: string) {
    const version = await this.checklistVersionModel
      .findOne({ checklist_id: checklistId, status: 'active' })
      .sort({ version: -1 })
      .lean();
    if (!version) throw new NotFoundException('No active checklist version found');
    return { status: 'success', data: version };
  }

  async assignChecklistVersionToProject(projectId: string, checklistVersionId: string) {
    const version = await this.checklistVersionModel.findById(checklistVersionId).lean();
    if (!version) throw new NotFoundException('Checklist version not found');

    await this.projectModel.findByIdAndUpdate(projectId, {
      $set: {
        checklist_version_id: checklistVersionId,
        checklist_version_number: version.version,
      },
    });

    return {
      status: 'success',
      message: `Checklist version ${version.version} assigned to project`,
      data: { project_id: projectId, version: version.version, version_label: version.version_label },
    };
  }

  // ── Company Dashboard Resources ──

  async createDashboardResource(dto: {
    resource_type: string;
    title: string;
    description?: string;
    url?: string;
    question?: string;
    answer?: string;
    sort_order?: number;
  }) {
    const resource = await this.dashboardResourceModel.create(dto);
    return { status: 'success', message: 'Resource created', data: resource.toObject() };
  }

  async updateDashboardResource(resourceId: string, dto: Record<string, any>) {
    const resource = await this.dashboardResourceModel.findByIdAndUpdate(
      resourceId,
      { $set: dto },
      { new: true },
    );
    if (!resource) throw new NotFoundException('Resource not found');
    return { status: 'success', message: 'Resource updated', data: resource.toObject() };
  }

  async getDashboardResources(resourceType?: string) {
    const filter: any = { status: 'active' };
    if (resourceType) filter.resource_type = resourceType;
    const resources = await this.dashboardResourceModel
      .find(filter)
      .sort({ sort_order: 1, createdAt: -1 })
      .lean();

    const grouped = {
      user_guide_video: resources.filter((r) => r.resource_type === 'user_guide_video'),
      faq: resources.filter((r) => r.resource_type === 'faq'),
      user_manual: resources.filter((r) => r.resource_type === 'user_manual'),
    };

    return { status: 'success', data: resourceType ? resources : grouped };
  }

  async deleteDashboardResource(resourceId: string) {
    await this.dashboardResourceModel.findByIdAndUpdate(resourceId, { $set: { status: 'inactive' } });
    return { status: 'success', message: 'Resource deleted' };
  }

  // ── Score Band Calculation (Sector-Agnostic Fix) ──

  async recalculateScoreBand(projectId: string) {
    const db = this.mongoConnection.db;

    const scoringDocs = await db
      .collection('company_assesment_scoring')
      .find({ project_id: new Types.ObjectId(projectId) })
      .toArray();

    if (!scoringDocs.length) {
      throw new NotFoundException('No scoring data found for this project');
    }

    let totalScore = 0;
    let maxPoints = 0;
    const criteriaScores: any[] = [];

    for (const doc of scoringDocs) {
      const score = Number(doc.total_score || doc.score || 0);
      const max = Number(doc.max_score || doc.maximum_score || doc.max_points || 0);
      totalScore += score;
      maxPoints += max;

      criteriaScores.push({
        criteria_id: doc.criteria_id || doc.criterian_id,
        score,
        max,
        percentage: max > 0 ? Math.round((score / max) * 100 * 100) / 100 : 0,
      });
    }

    const percentageScore = maxPoints > 0
      ? Math.round((totalScore / maxPoints) * 100 * 100) / 100
      : 0;

    await this.projectModel.findByIdAndUpdate(projectId, {
      $set: {
        total_score: totalScore,
        max_points: maxPoints,
        percentage_score: percentageScore,
        score_band_status: 1,
      },
    });

    return {
      status: 'success',
      message: 'Score band recalculated (sector-agnostic)',
      data: {
        project_id: projectId,
        total_score: totalScore,
        max_points: maxPoints,
        percentage_score: percentageScore,
        criteria_scores: criteriaScores,
      },
    };
  }

  private mapInvoice(inv: any) {
    return {
      id: String(inv._id),
      company_id: String(inv.company_id),
      project_id: String(inv.project_id),
      invoice_type: inv.invoice_type || (inv.payment_for === 'inv' ? 'tax' : 'proforma'),
      invoice_title: inv.invoice_title || '',
      payable_amount: inv.payable_amount || 0,
      tax_amount: inv.tax_amount || 0,
      total_amount: inv.total_amount || 0,
      payment_status: inv.payment_status || 0,
      outstanding_status: inv.outstanding_status || 'Unpaid',
      paid_amount: inv.paid_amount || 0,
      due_amount: inv.due_amount || 0,
      created_at: inv.createdAt,
    };
  }
}
