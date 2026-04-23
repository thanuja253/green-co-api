import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GroupManagement, GroupManagementDocument } from '../schemas/group-management.schema';
import { Sector, SectorDocument } from '../schemas/sector.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CompanyProject, CompanyProjectDocument } from '../schemas/company-project.schema';
import { CompanyWorkOrder, CompanyWorkOrderDocument } from '../schemas/company-workorder.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { ListGroupsQueryDto } from './dto/list-groups-query.dto';

@Injectable()
export class GroupManagementService {
  private normalizeName(input: unknown): string {
    return String(input || '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  constructor(
    @InjectModel(GroupManagement.name)
    private readonly groupModel: Model<GroupManagementDocument>,
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyProject.name)
    private readonly projectModel: Model<CompanyProjectDocument>,
    @InjectModel(CompanyWorkOrder.name)
    private readonly companyWorkOrderModel: Model<CompanyWorkOrderDocument>,
  ) {}

  private toAbsoluteFileUrl(path?: string): string {
    const cleaned = String(path || '').trim();
    if (!cleaned) return '';
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    const normalized = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
    const host = (process.env.API_BASE_URL || process.env.APP_URL || '').trim();
    return host ? `${host.replace(/\/$/, '')}${normalized}` : normalized;
  }

  private resolveName(payload: CreateGroupDto): string {
    return this.normalizeName(
      payload?.name || payload?.group_add_name || payload?.group_name || '',
    );
  }

  private resolveStatus(payload: CreateGroupDto): string {
    const resolved =
      String(
        payload?.status || payload?.group_add_status || payload?.group_status || '1',
      ).trim() || '1';
    if (!['0', '1'].includes(resolved)) {
      throw new BadRequestException('status is required and must be 0 or 1');
    }
    return resolved;
  }

  private hasStatusPayload(payload: CreateGroupDto): boolean {
    return [payload?.status, payload?.group_add_status, payload?.group_status].some(
      (v) => String(v ?? '').trim() !== '',
    );
  }

  private mapGroup(doc: any) {
    if (!doc) return null;
    const checklist = doc.sample_document || '';
    return {
      id: String(doc._id),
      name: doc.name || '',
      group_name: doc.name || '',
      status: doc.status || '',
      sample_document: doc.sample_document || '',
      sample_document_url: this.toAbsoluteFileUrl(doc.sample_document),
      checklist_document: checklist,
      checklist_document_name: checklist ? checklist.split('/').pop() : '',
      checklist_document_url: this.toAbsoluteFileUrl(checklist),
      created_at: doc.createdAt || null,
      updated_at: doc.updatedAt || null,
    };
  }

  private async hasRunningProjectDependency(groupName: string): Promise<boolean> {
    const normalized = String(groupName || '').trim();
    if (!normalized) return false;

    const sectors = await this.sectorModel
      .find({ group_name: normalized })
      .select('_id')
      .lean();
    if (!sectors.length) return false;

    const sectorIds = sectors.map((s: any) => String(s._id));
    const companies = await this.companyModel
      .find({ mst_sector_id: { $in: sectorIds } })
      .select('_id')
      .lean();
    if (!companies.length) return false;

    const companyIds = companies.map((c: any) => c._id);
    const projects = await this.projectModel
      .find({ company_id: { $in: companyIds } })
      .select('_id')
      .lean();
    if (!projects.length) return false;

    const projectIds = projects.map((p: any) => p._id);
    const running = await this.companyWorkOrderModel
      .exists({ project_id: { $in: projectIds }, wo_status: 1 });
    return !!running;
  }

  private async validateAndApplyStatusCascade(
    groupRow: any,
    nextStatus: string,
    nextName?: string,
  ): Promise<void> {
    const currentStatus = String(groupRow?.status || '1');
    const normalizedNextStatus = String(nextStatus || '1').trim() || '1';
    const normalizedName = String(nextName || groupRow?.name || '').trim();
    const isChanging = normalizedNextStatus !== currentStatus;
    if (!isChanging) return;

    if (normalizedNextStatus === '0') {
      const hasDependency = await this.hasRunningProjectDependency(normalizedName);
      if (hasDependency) {
        throw new BadRequestException(
          'Group selected is assigned to a current running project!',
        );
      }
    }

    if (normalizedName) {
      await this.sectorModel.updateMany(
        { group_name: normalizedName },
        { $set: { status: normalizedNextStatus } },
      );
    }
  }

  async createGroup(payload: CreateGroupDto, sampleDocumentPath?: string) {
    const name = this.resolveName(payload);
    if (!name) {
      throw new BadRequestException('name is required');
    }
    if (!this.hasStatusPayload(payload)) {
      throw new BadRequestException('status is required');
    }

    const exists = await this.groupModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
    if (exists) {
      throw new BadRequestException('Group already exists');
    }

    const created = await this.groupModel.create({
      name,
      status: this.resolveStatus(payload),
      sample_document: sampleDocumentPath || '',
    });

    return {
      status: 'success',
      message: 'Group created successfully',
      data: this.mapGroup(created.toObject()),
    };
  }

  async listGroups(query?: ListGroupsQueryDto) {
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
    if (query?.status?.trim() && query.status.trim().toLowerCase() !== 'all') {
      filter.status = query.status.trim();
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      filter.$or = [{ name: { $regex: s, $options: 'i' } }, { status: { $regex: s, $options: 'i' } }];
    }

    const [rows, total] = await Promise.all([
      this.groupModel.find(filter).sort({ name: 1 }).skip(skip).limit(cappedLimit).lean(),
      this.groupModel.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / cappedLimit));
    return {
      status: 'success',
      message: 'Groups fetched successfully',
      data: rows.map((r) => this.mapGroup(r)),
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
        status: query?.status ?? '',
        search: query?.search ?? '',
      },
    };
  }

  async getGroup(id: string) {
    const row = await this.groupModel.findById(id).lean();
    if (!row) {
      throw new NotFoundException('Group not found');
    }
    return {
      status: 'success',
      message: 'Group fetched successfully',
      data: this.mapGroup(row),
    };
  }

  async updateGroup(
    id: string,
    payload: CreateGroupDto,
    sampleDocumentPath?: string,
  ) {
    const row = await this.groupModel.findById(id);
    if (!row) {
      throw new NotFoundException('Group not found');
    }

    const name = this.resolveName(payload);
    if (!name) {
      throw new BadRequestException('name is required');
    }
    if (!this.hasStatusPayload(payload)) {
      throw new BadRequestException('status is required');
    }

    const exists = await this.groupModel
      .findOne({
        _id: { $ne: row._id },
        name: new RegExp(`^${name}$`, 'i'),
      })
      .lean();
    if (exists) {
      throw new BadRequestException('Group already exists');
    }

    const nextStatus = this.resolveStatus(payload);
    await this.validateAndApplyStatusCascade(row, nextStatus, name);

    const previousName = String(row.name || '').trim();
    row.name = name;
    row.status = nextStatus;
    if (sampleDocumentPath) {
      row.sample_document = sampleDocumentPath;
    }
    await row.save();

    if (previousName && previousName !== name) {
      await this.sectorModel.updateMany(
        { group_name: previousName },
        { $set: { group_name: name } },
      );
    }

    return {
      status: 'success',
      message: 'Group updated successfully',
      data: this.mapGroup(row.toObject()),
    };
  }

  async bulkUpdateStatus(rawGroupIds: unknown, rawStatus: unknown) {
    const status = String(rawStatus ?? '').trim();
    if (!['0', '1'].includes(status)) {
      throw new BadRequestException('status is required and must be 0 or 1');
    }

    const idsFromArray = Array.isArray(rawGroupIds)
      ? rawGroupIds
      : String(rawGroupIds || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
    const groupIds = idsFromArray.map((v) => String(v).trim()).filter(Boolean);
    if (!groupIds.length) {
      throw new BadRequestException('group_id is required');
    }

    const groups = await this.groupModel.find({ _id: { $in: groupIds } });
    if (groups.length !== groupIds.length) {
      throw new BadRequestException('one or more group_id values are invalid');
    }
    for (const g of groups) {
      const current = String((g as any).status || '1');
      if (current === status) continue;
      await this.validateAndApplyStatusCascade(g, status, String((g as any).name || ''));
      (g as any).status = status;
      await g.save();
    }

    return {
      success: true,
      message: 'Status update Successfull!',
    };
  }

  async exportGroups(query?: ListGroupsQueryDto): Promise<{ filename: string; content: string }> {
    const filter: Record<string, any> = {};
    if (query?.name?.trim()) {
      filter.name = { $regex: query.name.trim(), $options: 'i' };
    }
    if (query?.status?.trim() && query.status.trim().toLowerCase() !== 'all') {
      filter.status = query.status.trim();
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      filter.$or = [{ name: { $regex: s, $options: 'i' } }, { status: { $regex: s, $options: 'i' } }];
    }

    const rows = await this.groupModel.find(filter).sort({ name: 1 }).lean();
    const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      ['id', 'group_name', 'status', 'checklist_document'].map(escapeCsv).join(','),
      ...rows.map((row: any) =>
        [
          String(row._id),
          row.name || '',
          row.status || '',
          row.sample_document || '',
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ];

    return {
      filename: `groups-${Date.now()}.csv`,
      content: csvLines.join('\n'),
    };
  }
}

