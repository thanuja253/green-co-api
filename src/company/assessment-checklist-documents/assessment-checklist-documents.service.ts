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
}

