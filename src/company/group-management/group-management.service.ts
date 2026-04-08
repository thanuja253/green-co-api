import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GroupManagement, GroupManagementDocument } from '../schemas/group-management.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { ListGroupsQueryDto } from './dto/list-groups-query.dto';

@Injectable()
export class GroupManagementService {
  constructor(
    @InjectModel(GroupManagement.name)
    private readonly groupModel: Model<GroupManagementDocument>,
  ) {}

  private mapGroup(doc: any) {
    if (!doc) return null;
    return {
      id: String(doc._id),
      name: doc.name || '',
      status: doc.status || '',
      sample_document: doc.sample_document || '',
      created_at: doc.createdAt || null,
      updated_at: doc.updatedAt || null,
    };
  }

  async createGroup(payload: CreateGroupDto, sampleDocumentPath?: string) {
    const name = String(payload?.name || '').trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }

    const exists = await this.groupModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
    if (exists) {
      throw new BadRequestException('Group already exists');
    }

    const created = await this.groupModel.create({
      name,
      status: String(payload?.status || '1').trim() || '1',
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
      this.groupModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cappedLimit).lean(),
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
}

