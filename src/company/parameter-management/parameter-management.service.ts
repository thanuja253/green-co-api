import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ParameterManagement, ParameterManagementDocument } from '../schemas/parameter-management.schema';
import { CreateParameterDto } from './dto/create-parameter.dto';
import { ListParametersQueryDto } from './dto/list-parameters-query.dto';

@Injectable()
export class ParameterManagementService {
  constructor(
    @InjectModel(ParameterManagement.name)
    private readonly parameterModel: Model<ParameterManagementDocument>,
  ) {}

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
    const name = String(payload?.name || '').trim();
    const shortName = String(payload?.short_name || '').trim();
    if (!name) throw new BadRequestException('name is required');
    if (!shortName) throw new BadRequestException('short_name is required');

    const [nameExists, shortExists] = await Promise.all([
      this.parameterModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean(),
      this.parameterModel.findOne({ short_name: new RegExp(`^${shortName}$`, 'i') }).lean(),
    ]);
    if (nameExists) throw new BadRequestException('Parameter already exists');
    if (shortExists) throw new BadRequestException('short_name already exists');

    const created = await this.parameterModel.create({
      name,
      short_name: shortName,
      status: String(payload?.status || '1').trim() || '1',
    });
    return {
      status: 'success',
      message: 'Parameter created successfully',
      data: this.mapRow(created.toObject()),
    };
  }

  async listParameters(query?: ListParametersQueryDto) {
    const parsedPage = Number.parseInt(String(query?.page ?? '1'), 10);
    const parsedLimit = Number.parseInt(String(query?.limit ?? '10'), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

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
}

