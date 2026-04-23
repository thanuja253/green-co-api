import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ParameterManagement, ParameterManagementDocument } from '../schemas/parameter-management.schema';
import { GroupManagement, GroupManagementDocument } from '../schemas/group-management.schema';
import { Sector, SectorDocument } from '../schemas/sector.schema';
import {
  MasterChecklistSector,
  MasterChecklistSectorDocument,
} from '../schemas/master-checklist-sector.schema';
import { CreateParameterDto } from './dto/create-parameter.dto';
import { ListParametersQueryDto } from './dto/list-parameters-query.dto';

@Injectable()
export class ParameterManagementService {
  constructor(
    @InjectModel(ParameterManagement.name)
    private readonly parameterModel: Model<ParameterManagementDocument>,
    @InjectModel(GroupManagement.name)
    private readonly groupModel: Model<GroupManagementDocument>,
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
    @InjectModel(MasterChecklistSector.name)
    private readonly checklistSectorModel: Model<MasterChecklistSectorDocument>,
  ) {}

  private resolveName(payload: CreateParameterDto): string {
    return String(
      payload?.name ||
        payload?.title ||
        payload?.criteria_add_name ||
        payload?.criteria_edit_name ||
        '',
    ).trim();
  }

  private resolveShortName(payload: CreateParameterDto): string {
    return String(
      payload?.short_name ||
        payload?.shortName ||
        payload?.shortname ||
        payload?.criteria_add_sc_name ||
        payload?.criteria_edit_sc_name ||
        '',
    ).trim();
  }

  private resolveGroupIds(payload: CreateParameterDto): string[] {
    const raw =
      payload?.criteria_group_add ??
      payload?.criteria_group_edit ??
      payload?.group_ids ??
      payload?.group_id ??
      [];
    const values = Array.isArray(raw)
      ? raw
      : String(raw || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
    return values.map((v) => String(v).trim()).filter(Boolean);
  }

  private async validateGroupIds(rawGroupIds: string[]): Promise<string[]> {
    if (!rawGroupIds.length) {
      throw new BadRequestException('criteria_group_add is required');
    }

    const resolvedIds: string[] = [];
    for (const raw of rawGroupIds) {
      const v = String(raw || '').trim();
      if (!v) continue;
      const byId = await this.groupModel.findById(v).select('_id').lean();
      if (byId) {
        resolvedIds.push(String((byId as any)._id));
        continue;
      }
      const byName = await this.groupModel
        .findOne({ name: new RegExp(`^${v}$`, 'i') })
        .select('_id')
        .lean();
      if (byName) {
        resolvedIds.push(String((byName as any)._id));
        continue;
      }
      throw new BadRequestException(`Invalid group selection: ${v}`);
    }

    return [...new Set(resolvedIds)];
  }

  private async syncCriteriaGroups(criteriaId: string, groupIds: string[]): Promise<void> {
    await this.checklistSectorModel.deleteMany({ criterian_id: criteriaId });
    if (!groupIds.length) return;
    const uniqueGroupIds = [...new Set(groupIds)];
    await this.checklistSectorModel.insertMany(
      uniqueGroupIds.map((groupId) => ({
        criterian_id: criteriaId,
        group_id: groupId,
        from_date: new Date(),
      })),
      { ordered: false },
    );
  }

  private mapRow(doc: any) {
    return {
      id: String(doc._id),
      name: doc.name || '',
      short_name: doc.short_name || '',
      status: String(doc.status ?? '1'),
      created_at: doc.createdAt || null,
      updated_at: doc.updatedAt || null,
    };
  }

  async createParameter(payload: CreateParameterDto) {
    const name = this.resolveName(payload);
    const shortName = this.resolveShortName(payload);
    if (!name) throw new BadRequestException('name is required');
    if (!shortName) throw new BadRequestException('short_name is required');

    const [nameExists, shortExists] = await Promise.all([
      this.parameterModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean(),
      this.parameterModel.findOne({ short_name: new RegExp(`^${shortName}$`, 'i') }).lean(),
    ]);
    if (nameExists) throw new BadRequestException('Parameter already exists');
    if (shortExists) throw new BadRequestException('short_name already exists');

    const groupIds = await this.validateGroupIds(this.resolveGroupIds(payload));

    const created = await this.parameterModel.create({
      name,
      short_name: shortName,
      status: String(payload?.status || '1').trim() || '1',
    });
    await this.syncCriteriaGroups(String((created as any)._id), groupIds);
    return {
      status: 'success',
      message: 'Parameter created successfully',
      data: this.mapRow(created.toObject()),
    };
  }

  async listParameters(query?: ListParametersQueryDto) {
    const draw = Number.parseInt(String(query?.draw ?? '0'), 10) || 0;
    const dtStart = Number.parseInt(String(query?.start ?? '0'), 10);
    const dtLength = Number.parseInt(String(query?.length ?? '10'), 10);
    const isDataTable = Number.isFinite(dtStart) || Number.isFinite(dtLength) || draw > 0;

    const parsedPage = Number.parseInt(String(query?.page ?? '1'), 10);
    const parsedLimit = Number.parseInt(
      String(query?.limit ?? (isDataTable ? dtLength : '10')),
      10,
    );
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = isDataTable
      ? Number.isFinite(dtStart) && dtStart >= 0
        ? dtStart
        : 0
      : (page - 1) * cappedLimit;

    const filter: Record<string, any> = {};
    if (query?.name?.trim()) filter.name = { $regex: query.name.trim(), $options: 'i' };
    if (query?.short_name?.trim()) filter.short_name = { $regex: query.short_name.trim(), $options: 'i' };
    if (query?.status?.trim() && query.status.trim().toLowerCase() !== 'all') {
      filter.status = query.status.trim();
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { short_name: { $regex: s, $options: 'i' } },
        { status: { $regex: s, $options: 'i' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.parameterModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cappedLimit).lean(),
      this.parameterModel.countDocuments(filter),
    ]);

    if (isDataTable) {
      return {
        draw,
        recordsTotal: total,
        recordsFiltered: total,
        data: rows.map((r) => this.mapRow(r)),
      };
    }

    const totalPages = Math.max(1, Math.ceil(total / cappedLimit));
    return {
      status: 'success',
      message: 'Parameters fetched successfully',
      data: rows.map((r) => this.mapRow(r)),
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
        short_name: query?.short_name ?? '',
        status: query?.status ?? '',
        search: query?.search ?? '',
      },
    };
  }

  async getParameter(id: string) {
    const row = await this.parameterModel.findById(id).lean();
    if (!row) throw new NotFoundException('Parameter not found');
    return {
      status: 'success',
      message: 'Parameter fetched successfully',
      data: this.mapRow(row),
    };
  }

  async updateParameter(id: string, payload: CreateParameterDto) {
    const row = await this.parameterModel.findById(id);
    if (!row) throw new NotFoundException('Parameter not found');

    const name = this.resolveName(payload);
    const shortName = this.resolveShortName(payload);
    if (!name) throw new BadRequestException('name is required');
    if (!shortName) throw new BadRequestException('short_name is required');

    const [nameExists, shortExists] = await Promise.all([
      this.parameterModel
        .findOne({ _id: { $ne: row._id }, name: new RegExp(`^${name}$`, 'i') })
        .lean(),
      this.parameterModel
        .findOne({ _id: { $ne: row._id }, short_name: new RegExp(`^${shortName}$`, 'i') })
        .lean(),
    ]);
    if (nameExists) throw new BadRequestException('Parameter already exists');
    if (shortExists) throw new BadRequestException('short_name already exists');

    const groupIds = await this.validateGroupIds(this.resolveGroupIds(payload));

    row.name = name;
    row.short_name = shortName;
    row.status = String(payload?.status || row.status || '1').trim() || '1';
    await row.save();
    await this.syncCriteriaGroups(String((row as any)._id), groupIds);

    return {
      status: 'success',
      message: 'Parameter updated successfully',
      data: this.mapRow(row.toObject()),
    };
  }

  async exportParameters(query?: ListParametersQueryDto): Promise<{ filename: string; content: string }> {
    const filter: Record<string, any> = {};
    if (query?.name?.trim()) filter.name = { $regex: query.name.trim(), $options: 'i' };
    if (query?.short_name?.trim()) filter.short_name = { $regex: query.short_name.trim(), $options: 'i' };
    if (query?.status?.trim() && query.status.trim().toLowerCase() !== 'all') {
      filter.status = query.status.trim();
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { short_name: { $regex: s, $options: 'i' } },
        { status: { $regex: s, $options: 'i' } },
      ];
    }

    const rows = await this.parameterModel.find(filter).sort({ name: 1 }).lean();
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      ['id', 'name', 'short_name', 'status'].map(esc).join(','),
      ...rows.map((r: any) => [String(r._id), r.name || '', r.short_name || '', String(r.status ?? '1')].map(esc).join(',')),
    ];
    return {
      filename: `criteria-${Date.now()}.csv`,
      content: csvLines.join('\n'),
    };
  }

  async listCriteriaForSector(sectorId: string) {
    const sector = await this.sectorModel.findById(String(sectorId || '').trim()).lean();
    if (!sector) {
      throw new NotFoundException({ status: 'error', message: 'Sector not found' });
    }
    const groupId = String((sector as any).group_id || '').trim();
    const groupName = String((sector as any).group_name || '').trim();
    if (!groupId) {
      throw new BadRequestException({ status: 'error', message: 'Sector does not have a group mapping' });
    }

    const mappings = await this.checklistSectorModel
      .find({ group_id: groupId })
      .select('criterian_id from_date')
      .lean();
    const criteriaIds = [...new Set(mappings.map((m: any) => String(m.criterian_id || '').trim()).filter(Boolean))];
    if (!criteriaIds.length) {
      return {
        status: 'success',
        message: 'Criteria fetched successfully',
        data: {
          sector_id: String((sector as any)._id),
          sector_name: String((sector as any).name || ''),
          group_id: groupId,
          group_name: groupName,
          criteria: [],
        },
      };
    }

    const rows = await this.parameterModel
      .find({ _id: { $in: criteriaIds } } as any)
      .sort({ name: 1 })
      .lean();
    return {
      status: 'success',
      message: 'Criteria fetched successfully',
      data: {
        sector_id: String((sector as any)._id),
        sector_name: String((sector as any).name || ''),
        group_id: groupId,
        group_name: groupName,
        criteria: rows.map((r: any) => this.mapRow(r)),
      },
    };
  }
}

