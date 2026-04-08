import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sector, SectorDocument } from '../schemas/sector.schema';
import { CreateSectorManagementDto } from './dto/create-sector-management.dto';
import { ListSectorsQueryDto } from './dto/list-sectors-query.dto';

@Injectable()
export class SectorManagementService {
  constructor(
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
  ) {}

  private mapSector(doc: any) {
    return {
      id: String(doc._id),
      name: doc.name || '',
      group_name: doc.group_name || '',
      status: String(doc.status ?? '1'),
      created_at: doc.createdAt || null,
      updated_at: doc.updatedAt || null,
    };
  }

  async createSector(payload: CreateSectorManagementDto) {
    const name = String(payload?.name || '').trim();
    if (!name) throw new BadRequestException('name is required');

    const groupName = String(payload?.group_name || '').trim();
    const exists = await this.sectorModel
      .findOne({
        name: new RegExp(`^${name}$`, 'i'),
        group_name: new RegExp(`^${groupName}$`, 'i'),
      })
      .lean();
    if (exists) throw new BadRequestException('Sector already exists in selected group');

    const created = await this.sectorModel.create({
      name,
      group_name: groupName || undefined,
      status: String(payload?.status || '1').trim() || '1',
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

    const filter: Record<string, any> = {};
    if (query?.name?.trim()) filter.name = { $regex: query.name.trim(), $options: 'i' };
    if (query?.group_name?.trim() && query.group_name.trim().toLowerCase() !== 'all') {
      filter.group_name = { $regex: `^${query.group_name.trim()}$`, $options: 'i' };
    }
    if (query?.status?.trim() && query.status.trim().toLowerCase() !== 'all') {
      filter.status = query.status.trim();
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { group_name: { $regex: s, $options: 'i' } },
        { status: { $regex: s, $options: 'i' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.sectorModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cappedLimit).lean(),
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
}

