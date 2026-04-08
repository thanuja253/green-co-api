import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleManagement, RoleManagementDocument } from '../schemas/role-management.schema';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';

@Injectable()
export class RoleManagementService {
  constructor(
    @InjectModel(RoleManagement.name)
    private readonly roleModel: Model<RoleManagementDocument>,
  ) {}

  private mapRole(role: any) {
    return {
      id: role._id?.toString?.() || role._id,
      name: role.name || '',
      status: role.status || '1',
      formnumber: role.formnumber || '',
      permissions: role.permissions || {},
      created_at: role.createdAt || null,
      updated_at: role.updatedAt || null,
    };
  }

  async createRole(dto: CreateRoleDto) {
    const name = (dto.name || '').trim();
    if (!name) {
      throw new BadRequestException({
        status: 'validations',
        errors: { name: ['name is required.'] },
      });
    }

    const existing = await this.roleModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
    if (existing) {
      throw new BadRequestException({
        status: 'validations',
        errors: { name: ['Role with this name already exists.'] },
      });
    }

    const created = await this.roleModel.create({
      name,
      status: (dto.status || '1').toString(),
      formnumber: (dto.formnumber || '').trim(),
      permissions: dto.permissions || {},
    });

    return {
      status: 'success',
      message: 'Role created successfully',
      data: this.mapRole(created.toObject()),
    };
  }

  async listRoles(query?: ListRolesQueryDto) {
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
    const status = (query?.account_status || query?.status || '').trim();
    if (status && status !== 'All') {
      filter.status = status;
    }

    const [roles, total] = await Promise.all([
      this.roleModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(cappedLimit)
        .lean(),
      this.roleModel.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / cappedLimit));
    return {
      status: 'success',
      message: 'Roles fetched successfully',
      data: roles.map((r) => this.mapRole(r)),
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
        account_status: query?.account_status ?? query?.status ?? '',
      },
    };
  }

  async getRole(roleId: string) {
    const role = await this.roleModel.findById(roleId).lean();
    if (!role) {
      throw new NotFoundException({ status: 'error', message: 'Role not found' });
    }
    return {
      status: 'success',
      message: 'Role fetched successfully',
      data: this.mapRole(role),
    };
  }
}

