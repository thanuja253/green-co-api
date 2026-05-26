import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { basename, join } from 'path';
import * as fs from 'fs';
import {
  AssessmentChecklistDocument,
  AssessmentChecklistDocumentDocument,
  AssessmentChecklistStatus,
} from '../schemas/assessment-checklist-document.schema';
import { Sector, SectorDocument } from '../schemas/sector.schema';
import { GroupManagement, GroupManagementDocument } from '../schemas/group-management.schema';
import {
  ParameterManagement,
  ParameterManagementDocument,
} from '../schemas/parameter-management.schema';
import { CompanyProject, CompanyProjectDocument } from '../schemas/company-project.schema';
import { CompanyFacilitator, CompanyFacilitatorDocument } from '../schemas/company-facilitator.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../../mail/mail.service';

function normalizeTitle(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

@Injectable()
export class AssessmentChecklistDocumentsService {
  constructor(
    @InjectModel(AssessmentChecklistDocument.name)
    private readonly docModel: Model<AssessmentChecklistDocumentDocument>,
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
    @InjectModel(GroupManagement.name)
    private readonly groupModel: Model<GroupManagementDocument>,
    @InjectModel(ParameterManagement.name)
    private readonly criteriaModel: Model<ParameterManagementDocument>,
    @InjectModel(CompanyProject.name)
    private readonly projectModel: Model<CompanyProjectDocument>,
    @InjectModel(CompanyFacilitator.name)
    private readonly companyFacilitatorModel: Model<CompanyFacilitatorDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  private toUrl(path: string): string {
    const base = (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  async listForProject(projectId: string, criteriaId?: string, latestPerCriteria = false) {
    const filter: Record<string, any> = { project_id: projectId, is_active: true };
    if (criteriaId?.trim()) filter.criteria_id = criteriaId.trim();
    const rows = await this.docModel.find(filter).sort({ updatedAt: -1, createdAt: -1 }).lean();

    const finalRows =
      latestPerCriteria && !criteriaId?.trim()
        ? rows.filter((row: any, idx: number, arr: any[]) => {
            const cid = String(row?.criteria_id || '').trim();
            if (!cid) return true;
            return arr.findIndex((x: any) => String(x?.criteria_id || '').trim() === cid) === idx;
          })
        : rows;

    return {
      status: 'success',
      message: 'Checklist documents fetched successfully',
      data: finalRows.map((r: any) => ({
        id: String(r._id),
        project_id: r.project_id,
        sector_id: r.sector_id,
        sector_name: r.sector_name,
        group_id: r.group_id,
        group_name: r.group_name,
        criteria_id: r.criteria_id,
        criteria_name: r.criteria_name,
        criteria_short_name: r.criteria_short_name || '',
        title: r.title,
        document_path: `/${String(r.document_path || '').replace(/^\/+/, '')}`,
        document_url: this.toUrl(`/${String(r.document_path || '').replace(/^\/+/, '')}`),
        status: r.status,
        remarks: r.remarks || '',
        created_at: r.createdAt || null,
        updated_at: r.updatedAt || null,
      })),
    };
  }

  async uploadForProject(args: {
    projectId: string;
    sectorId: string;
    criteriaId: string;
    title: string;
    documentPath: string;
    uploadedByRole: 'COMPANY' | 'ADMIN';
    uploadedById?: string;
  }) {
    const sector = await this.sectorModel.findById(args.sectorId).lean();
    if (!sector) throw new NotFoundException({ status: 'error', message: 'Sector not found' });
    const groupId = String((sector as any).group_id || '').trim();
    if (!groupId) {
      throw new BadRequestException({ status: 'error', message: 'Sector does not have group mapping' });
    }
    const groupName = String((sector as any).group_name || '').trim();
    const sectorName = String((sector as any).name || '').trim();

    const criteria = await this.criteriaModel.findById(args.criteriaId).lean();
    if (!criteria) throw new NotFoundException({ status: 'error', message: 'Criteria not found' });

    const title = normalizeTitle(args.title);
    if (!title) {
      throw new BadRequestException({ status: 'validations', errors: { title: ['title is required.'] } });
    }
    if (!args.documentPath?.trim()) {
      throw new BadRequestException({ status: 'error', message: 'document_path is required' });
    }

    // If there is an active rejected doc with same title+criteria, deactivate it (reupload loop)
    await this.docModel.updateMany(
      {
        project_id: args.projectId,
        criteria_id: args.criteriaId,
        title,
        is_active: true,
        status: 'Rejected',
      },
      { $set: { is_active: false } },
    );

    const status: AssessmentChecklistStatus =
      args.uploadedByRole === 'ADMIN' ? 'Approved' : 'Pending';

    const created = await this.docModel.create({
      project_id: args.projectId,
      sector_id: args.sectorId,
      sector_name: sectorName,
      group_id: groupId,
      group_name: groupName,
      criteria_id: String((criteria as any)._id),
      criteria_name: (criteria as any).name || '',
      criteria_short_name: (criteria as any).short_name || '',
      title,
      document_path: String(args.documentPath).replace(/^\/+/, ''),
      status,
      remarks: '',
      is_active: true,
      uploaded_by_role: args.uploadedByRole,
      reviewed_by: args.uploadedByRole === 'ADMIN' ? (args.uploadedById || 'admin') : undefined,
      reviewed_at: args.uploadedByRole === 'ADMIN' ? new Date() : undefined,
    });

    if (args.uploadedByRole === 'COMPANY') {
      this.sendChecklistUploadNotifications(args.projectId, title, (criteria as any).short_name || (criteria as any).name || '').catch(
        (e) => console.error('[AssessmentChecklist] Upload notification failed:', e),
      );
    }

    return {
      status: 'success',
      message: 'Checklist document uploaded successfully',
      data: {
        id: String((created as any)._id),
        status: created.status,
      },
    };
  }

  async updateStatus(docId: string, status: AssessmentChecklistStatus, remarks: string, adminId?: string) {
    const row = await this.docModel.findById(docId);
    if (!row || !row.is_active) {
      throw new NotFoundException({ status: 'error', message: 'Checklist document not found' });
    }
    row.status = status;
    row.remarks = String(remarks || '').trim();
    row.reviewed_by = adminId || 'admin';
    row.reviewed_at = new Date();
    await row.save();

    this.sendChecklistStatusNotifications(
      String(row.project_id),
      row.title || '',
      (row as any).criteria_short_name || (row as any).criteria_name || '',
      status,
      row.remarks || '',
    ).catch((e) => console.error('[AssessmentChecklist] Status notification failed:', e));

    return {
      status: 'success',
      message: 'Checklist document updated successfully',
      data: { id: String(row._id), status: row.status, remarks: row.remarks || '' },
    };
  }

  async getSampleChecklistDocumentForProject(projectId: string, sectorId?: string) {
    const resolvedProjectId = String(projectId || '').trim();
    if (!resolvedProjectId) {
      throw new BadRequestException({ status: 'error', message: 'projectId is required' });
    }

    let resolvedSectorId = String(sectorId || '').trim();
    if (!resolvedSectorId) {
      const latestDoc = await this.docModel
        .findOne({ project_id: resolvedProjectId, is_active: true })
        .sort({ updatedAt: -1, createdAt: -1 })
        .select('sector_id')
        .lean();
      resolvedSectorId = String((latestDoc as any)?.sector_id || '').trim();
    }
    if (!resolvedSectorId) {
      throw new NotFoundException({
        status: 'error',
        message: 'No sector context found to fetch sample checklist document',
      });
    }

    const isObjectId = Types.ObjectId.isValid(resolvedSectorId);
    let sector = isObjectId
      ? await this.sectorModel.findById(resolvedSectorId).select('group_id group_name').lean()
      : null;
    if (!sector) {
      // Backward compatibility: some UIs pass sector name in sector_id query.
      sector = await this.sectorModel
        .findOne({ name: new RegExp(`^${resolvedSectorId}$`, 'i') })
        .select('group_id group_name')
        .lean();
    }
    if (!sector) {
      throw new NotFoundException({ status: 'error', message: 'Sector not found' });
    }

    const groupId = String((sector as any)?.group_id || '').trim();
    if (!groupId) {
      throw new NotFoundException({ status: 'error', message: 'Group mapping not found for sector' });
    }

    const group = await this.groupModel.findById(groupId).select('sample_document').lean();
    const relativePath = String((group as any)?.sample_document || '').trim().replace(/^\/+/, '');
    if (!relativePath) {
      throw new NotFoundException({ status: 'error', message: 'Sample checklist document not found' });
    }

    const absolutePath = join(process.cwd(), relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException({ status: 'error', message: 'Sample checklist file missing on server' });
    }

    return {
      absolutePath,
      filename: basename(absolutePath),
    };
  }

  private async resolveProjectContext(projectId: string) {
    const project = await this.projectModel.findById(projectId).lean();
    if (!project) return null;
    const companyId = String((project as any).company_id);
    const company = await this.companyModel.findById(companyId).lean();
    const cf = await this.companyFacilitatorModel
      .findOne({ company_id: companyId, project_id: projectId })
      .populate('facilitator_id')
      .lean();
    return {
      companyId,
      companyName: (company as any)?.name || 'Company',
      companyEmail: (company as any)?.email || null,
      projectCode: (project as any).project_id || projectId,
      facilitator: cf && (cf as any).facilitator_id ? (cf as any).facilitator_id : null,
    };
  }

  private async sendChecklistUploadNotifications(projectId: string, docTitle: string, criteriaLabel: string) {
    const ctx = await this.resolveProjectContext(projectId);
    if (!ctx) return;
    const detail = `${ctx.companyName} uploaded assessment checklist document: ${docTitle}${criteriaLabel ? ` (${criteriaLabel})` : ''} for project ${ctx.projectCode}.`;

    this.notificationsService
      .create('Assessment Checklist Document Uploaded', `Your assessment checklist document "${docTitle}" has been uploaded. GreenCo Team will review it.`, 'C', ctx.companyId)
      .catch((e) => console.error('[AssessmentChecklist] Company notification failed:', e));

    this.notificationsService
      .create(`${ctx.companyName}: Assessment Checklist Document Uploaded`, detail, 'A')
      .catch((e) => console.error('[AssessmentChecklist] Admin notification failed:', e));

    if (ctx.facilitator) {
      const fid = ctx.facilitator._id?.toString?.() || String(ctx.facilitator);
      this.notificationsService
        .create('Assessment Checklist Document Uploaded', detail + ' Please review.', 'F', fid)
        .catch((e) => console.error('[AssessmentChecklist] Facilitator notification failed:', e));
      if (ctx.facilitator.email) {
        this.mailService
          .sendRatingEmail({
            to: ctx.facilitator.email,
            cc: [],
            subject: `GreenCo - Assessment Checklist Uploaded by ${ctx.companyName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Assessment Checklist Document Uploaded</h2>
                <p>Dear ${ctx.facilitator.name || 'Facilitator'},</p>
                <p><strong>${ctx.companyName}</strong> has uploaded an assessment checklist document: <strong>${docTitle}</strong>${criteriaLabel ? ` (${criteriaLabel})` : ''} for project <strong>${ctx.projectCode}</strong>.</p>
                <p>Please log in to the portal to review.</p>
                <p>Best regards,<br>Green Co Team</p>
              </div>
            `,
          })
          .catch((e) => console.error('[AssessmentChecklist] Facilitator email failed:', e));
      }
    }
  }

  private async sendChecklistStatusNotifications(
    projectId: string,
    docTitle: string,
    criteriaLabel: string,
    status: AssessmentChecklistStatus,
    remarks: string,
  ) {
    const ctx = await this.resolveProjectContext(projectId);
    if (!ctx) return;
    const statusLabel = status === 'Approved' ? 'accepted' : 'not accepted';
    const detail = `Assessment checklist document "${docTitle}"${criteriaLabel ? ` (${criteriaLabel})` : ''} has been ${statusLabel} for project ${ctx.projectCode}.${remarks ? ` Remarks: ${remarks}` : ''}`;

    this.notificationsService
      .create(`Assessment checklist ${statusLabel}`, detail, 'C', ctx.companyId)
      .catch((e) => console.error('[AssessmentChecklist] Company status notification failed:', e));

    if (ctx.facilitator) {
      const fid = ctx.facilitator._id?.toString?.() || String(ctx.facilitator);
      this.notificationsService
        .create(`Assessment checklist ${statusLabel}`, `${ctx.companyName}: ${detail}`, 'F', fid)
        .catch((e) => console.error('[AssessmentChecklist] Facilitator status notification failed:', e));
      if (ctx.facilitator.email) {
        this.mailService
          .sendRatingEmail({
            to: ctx.facilitator.email,
            cc: [],
            subject: `GreenCo - Assessment Checklist ${status === 'Approved' ? 'Accepted' : 'Not Accepted'} for ${ctx.companyName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Assessment Checklist ${status === 'Approved' ? 'Accepted' : 'Not Accepted'}</h2>
                <p>Dear ${ctx.facilitator.name || 'Facilitator'},</p>
                <p>An assessment checklist document for <strong>${ctx.companyName}</strong> has been <strong>${statusLabel}</strong>.</p>
                <p>Document: <strong>${docTitle}</strong>${criteriaLabel ? ` (${criteriaLabel})` : ''} — Project: <strong>${ctx.projectCode}</strong></p>
                ${remarks ? `<p>Remarks: ${remarks}</p>` : ''}
                <p>Please log in to the portal for details.</p>
                <p>Best regards,<br>Green Co Team</p>
              </div>
            `,
          })
          .catch((e) => console.error('[AssessmentChecklist] Facilitator status email failed:', e));
      }
    }

    if (status === 'Rejected' && ctx.companyEmail) {
      this.mailService
        .sendChecklistDocNotAcceptedEmail(ctx.companyEmail, ctx.companyName, `Document: ${docTitle}${criteriaLabel ? ` (${criteriaLabel})` : ''}.${remarks ? ` Remarks: ${remarks}` : ''}`)
        .catch((e) => console.error('[AssessmentChecklist] Company rejection email failed:', e));
    }
  }
}

