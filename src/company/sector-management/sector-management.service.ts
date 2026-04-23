import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sector, SectorDocument } from '../schemas/sector.schema';
import { GroupManagement, GroupManagementDocument } from '../schemas/group-management.schema';
import { CompanyProject, CompanyProjectDocument } from '../schemas/company-project.schema';
import { CompanyWorkOrder, CompanyWorkOrderDocument } from '../schemas/company-workorder.schema';
import { CreateSectorManagementDto } from './dto/create-sector-management.dto';
import { ListSectorsQueryDto } from './dto/list-sectors-query.dto';

@Injectable()
export class SectorManagementService {
  constructor(
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
    @InjectModel(GroupManagement.name)
    private readonly groupModel: Model<GroupManagementDocument>,
    @InjectModel(CompanyProject.name)
    private readonly projectModel: Model<CompanyProjectDocument>,
    @InjectModel(CompanyWorkOrder.name)
    private readonly companyWorkOrderModel: Model<CompanyWorkOrderDocument>,
  ) {}

  private normalizeName(input: unknown): string {
    return String(input || '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private resolveName(payload: CreateSectorManagementDto): string {
    return this.normalizeName(
      payload?.name || payload?.sector_add_name || payload?.sector_edit_name || '',
    );
  }

  private resolveGroupId(payload: CreateSectorManagementDto): string {
    return String(
      payload?.group_id || payload?.sector_group_add || payload?.sector_group_edit || '',
    ).trim();
  }

  private resolveStatus(payload: CreateSectorManagementDto): string {
    const resolved =
      String(
        payload?.status || payload?.sector_add_status || payload?.sector_edit_status || '1',
      ).trim() || '1';
    if (!['0', '1'].includes(resolved)) {
      throw new BadRequestException('status is required and must be 0 or 1');
    }
    return resolved;
  }

  private hasStatusPayload(payload: CreateSectorManagementDto): boolean {
    return [payload?.status, payload?.sector_add_status, payload?.sector_edit_status].some(
      (v) => String(v ?? '').trim() !== '',
    );
  }

  private hasGroupPayload(payload: CreateSectorManagementDto): boolean {
    return [payload?.group_id, payload?.group_name, payload?.sector_group_add, payload?.sector_group_edit].some(
      (v) => String(v ?? '').trim() !== '',
    );
  }

  private async findGroupByPayload(payload: CreateSectorManagementDto) {
    const groupId = this.resolveGroupId(payload);
    if (groupId) {
      const byId = await this.groupModel.findById(groupId).lean();
      if (byId) return byId;
      throw new BadRequestException('selected group does not exist');
    }

    const groupName = String(payload?.group_name || '').trim();
    if (groupName) {
      const byName = await this.groupModel
        .findOne({ name: new RegExp(`^${groupName}$`, 'i') })
        .lean();
      if (byName) return byName;
      throw new BadRequestException('selected group does not exist');
    }

    return null;
  }

  private async ensureCanActivateUnderGroup(group: any, nextStatus: string) {
    if (String(nextStatus) !== '1') return;
    if (String(group?.status || '0') === '0') {
      throw new BadRequestException(
        'The selected Group is In-active. Please activate the Group or select a group which is active!',
      );
    }
  }

  private async hasRunningProjectDependency(sectorIds: string[]): Promise<boolean> {
    if (!sectorIds.length) return false;

    const projects = await this.projectModel
      .find({ mst_sector_id: { $in: sectorIds } })
      .select('_id')
      .lean();
    if (!projects.length) return false;

    const projectIds = projects.map((p: any) => p._id);
    const running = await this.companyWorkOrderModel.exists({
      project_id: { $in: projectIds },
      wo_status: 1,
    });
    return !!running;
  }

  private mapSector(doc: any) {
    return {
      id: String(doc._id),
      name: doc.name || '',
      group_id: doc.group_id || '',
      group_name: doc.group_name || '',
      status: String(doc.status ?? '1'),
      created_at: doc.createdAt || null,
      updated_at: doc.updatedAt || null,
    };
  }

  async createSector(payload: CreateSectorManagementDto) {
    const name = this.resolveName(payload);
    if (!name) throw new BadRequestException('name is required');
    if (!this.hasGroupPayload(payload)) {
      throw new BadRequestException('group is required');
    }
    if (!this.hasStatusPayload(payload)) {
      throw new BadRequestException('status is required');
    }

    const exists = await this.sectorModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
    if (exists) throw new BadRequestException('Sector already exists');

    const group = await this.findGroupByPayload(payload);
    const status = this.resolveStatus(payload);
    await this.ensureCanActivateUnderGroup(group, status);

    const created = await this.sectorModel.create({
      name,
      group_id: String(group._id),
      group_name: String((group as any).name || '').trim(),
      status,
    });

    return {
      status: 'success',
      message: 'Sector created successfully',
      data: this.mapSector(created.toObject()),
    };
  }

  async listSectors(query?: ListSectorsQueryDto) {
    const parsedPage = Number.parseInt(String(query?.page ?? '1'), 10);
    const parsedLimit = Number.parseInt(String(query?.limit ?? '10'), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

    const andFilters: Record<string, any>[] = [
      {
        group_id: { $exists: true, $ne: '' },
      },
    ];
    if (query?.name?.trim()) {
      andFilters.push({ name: { $regex: query.name.trim(), $options: 'i' } });
    }
    const groupFilter = String(query?.group_id || query?.group_name || '').trim();
    if (groupFilter && groupFilter.toLowerCase() !== 'all') {
      andFilters.push({
        $or: [
          { group_id: groupFilter },
          { group_name: { $regex: `^${groupFilter}$`, $options: 'i' } },
        ],
      });
    }
    if (query?.status?.trim() && query.status.trim().toLowerCase() !== 'all') {
      andFilters.push({ status: query.status.trim() });
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      const searchOr = [
        { name: { $regex: s, $options: 'i' } },
        { group_name: { $regex: s, $options: 'i' } },
        { status: { $regex: s, $options: 'i' } },
      ];
      andFilters.push({ $or: searchOr });
    }
    const filter: Record<string, any> = andFilters.length ? { $and: andFilters } : {};

    const [rows, total] = await Promise.all([
      this.sectorModel.find(filter).sort({ name: 1 }).skip(skip).limit(cappedLimit).lean(),
      this.sectorModel.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / cappedLimit));
    return {
      status: 'success',
      message: 'Sectors fetched successfully',
      data: rows.map((r) => this.mapSector(r)),
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
        group_name: query?.group_name ?? '',
        status: query?.status ?? '',
        search: query?.search ?? '',
      },
    };
  }

  async getSector(id: string) {
    const row = await this.sectorModel.findById(id).lean();
    if (!row) throw new NotFoundException('Sector not found');
    return {
      status: 'success',
      message: 'Sector fetched successfully',
      data: this.mapSector(row),
    };
  }

  async updateSector(id: string, payload: CreateSectorManagementDto) {
    const row = await this.sectorModel.findById(id);
    if (!row) throw new NotFoundException('Sector not found');

    const name = this.resolveName(payload);
    if (!name) throw new BadRequestException('name is required');
    if (!this.hasGroupPayload(payload)) {
      throw new BadRequestException('group is required');
    }
    if (!this.hasStatusPayload(payload)) {
      throw new BadRequestException('status is required');
    }

    const exists = await this.sectorModel
      .findOne({ _id: { $ne: row._id }, name: new RegExp(`^${name}$`, 'i') })
      .lean();
    if (exists) throw new BadRequestException('Sector already exists');

    const group = await this.findGroupByPayload(payload);

    const nextStatus = this.resolveStatus(payload);
    await this.ensureCanActivateUnderGroup(group, nextStatus);
    if (nextStatus === '0') {
      const hasDependency = await this.hasRunningProjectDependency([String(row._id)]);
      if (hasDependency) {
        throw new BadRequestException(
          'Sector selected is assigned to a current running project!',
        );
      }
    }

    row.name = name;
    row.group_id = String(group._id);
    row.group_name = String((group as any).name || '').trim();
    row.status = nextStatus;
    await row.save();

    return {
      status: 'success',
      message: 'Sector updated successfully',
      data: this.mapSector(row.toObject()),
    };
  }

  async bulkUpdateStatus(rawSectorIds: unknown, rawStatus: unknown) {
    const status = String(rawStatus ?? '').trim();
    if (!['0', '1'].includes(status)) {
      throw new BadRequestException('status is required and must be 0 or 1');
    }

    const idsFromArray = Array.isArray(rawSectorIds)
      ? rawSectorIds
      : String(rawSectorIds || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
    const sectorIds = idsFromArray.map((v) => String(v).trim()).filter(Boolean);
    if (!sectorIds.length) {
      throw new BadRequestException('group_id is required');
    }

    const sectors = await this.sectorModel.find({ _id: { $in: sectorIds } });
    if (sectors.length !== sectorIds.length) {
      throw new BadRequestException('one or more group_id values are invalid');
    }
    if (status === '0') {
      const hasDependency = await this.hasRunningProjectDependency(
        sectors.map((s) => String((s as any)._id)),
      );
      if (hasDependency) {
        throw new BadRequestException(
          'Sector selected is assigned to a current running project!',
        );
      }
    }

    for (const sector of sectors) {
      const group = await this.groupModel.findById((sector as any).group_id).lean();
      if (!group) continue;
      await this.ensureCanActivateUnderGroup(group, status);
      (sector as any).status = status;
      (sector as any).group_name = String((group as any).name || '').trim();
      await sector.save();
    }

    return {
      success: true,
      message: 'Status update Successfull!',
    };
  }

  async exportSectors(query?: ListSectorsQueryDto): Promise<{ filename: string; content: string }> {
    const andFilters: Record<string, any>[] = [
      {
        group_id: { $exists: true, $ne: '' },
      },
    ];
    if (query?.name?.trim()) {
      andFilters.push({ name: { $regex: query.name.trim(), $options: 'i' } });
    }
    const groupFilter = String(query?.group_id || query?.group_name || '').trim();
    if (groupFilter && groupFilter.toLowerCase() !== 'all') {
      andFilters.push({
        $or: [
          { group_id: groupFilter },
          { group_name: { $regex: `^${groupFilter}$`, $options: 'i' } },
        ],
      });
    }
    if (query?.status?.trim() && query.status.trim().toLowerCase() !== 'all') {
      andFilters.push({ status: query.status.trim() });
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      const searchOr = [
        { name: { $regex: s, $options: 'i' } },
        { group_name: { $regex: s, $options: 'i' } },
        { status: { $regex: s, $options: 'i' } },
      ];
      andFilters.push({ $or: searchOr });
    }
    const filter: Record<string, any> = andFilters.length ? { $and: andFilters } : {};

    const rows = await this.sectorModel.find(filter).sort({ name: 1 }).lean();
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      ['id', 'name', 'group_id', 'group_name', 'status'].map(esc).join(','),
      ...rows.map((r: any) =>
        [String(r._id), r.name || '', r.group_id || '', r.group_name || '', r.status || '1']
          .map(esc)
          .join(','),
      ),
    ];

    return {
      filename: `sectors-${Date.now()}.csv`,
      content: csvLines.join('\n'),
    };
  }
}

