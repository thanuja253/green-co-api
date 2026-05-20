import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleManagement, RoleManagementDocument } from '../schemas/role-management.schema';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import { ADMIN_PERMISSIONS_SEED } from './admin-permissions.seed';

@Injectable()
export class RoleManagementService implements OnModuleInit {
  constructor(
    @InjectModel(RoleManagement.name)
    private readonly roleModel: Model<RoleManagementDocument>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<PermissionDocument>,
  ) {}

  async onModuleInit() {
    await this.ensurePermissionsSeeded();
  }

  private normalizePermissionIds(raw: unknown): number[] {
    if (raw == null) return [];
    const values = Array.isArray(raw) ? raw : typeof raw === 'object' ? Object.values(raw as object) : [raw];
    return values
      .map((v) => Number.parseInt(String(v), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  private resolvePermissionIdsFromRole(role: any): number[] {
    if (Array.isArray(role?.permission_ids) && role.permission_ids.length) {
      return role.permission_ids.map((n: number) => Number(n)).filter((n: number) => n > 0);
    }
    return this.normalizePermissionIds(role?.permissions);
  }

  private mapRole(role: any) {
    const permissionIds = this.resolvePermissionIdsFromRole(role);
    return {
      id: role._id?.toString?.() || role._id,
      name: role.name || '',
      status: role.status || '1',
      formnumber: role.formnumber || '',
      permissions: permissionIds,
      permission_ids: permissionIds,
      created_at: role.createdAt || null,
      updated_at: role.updatedAt || null,
    };
  }

  private mapRoleDataTableRow(role: any) {
    return {
      id: role._id?.toString?.() || role._id,
      name: role.name || '',
      status: role.status || '1',
    };
  }

  async ensurePermissionsSeeded(): Promise<void> {
    const count = await this.permissionModel.countDocuments();
    if (count > 0) return;
    await this.permissionModel.insertMany(
      ADMIN_PERMISSIONS_SEED.map((p) => ({
        legacy_id: p.legacy_id,
        module_name: p.module_name,
        name: p.name,
        display_name: p.display_name,
        guard_name: 'admin',
      })),
      { ordered: false },
    );
  }

  async listPermissions() {
    await this.ensurePermissionsSeeded();
    const rows = await this.permissionModel.find().sort({ module_name: 1, legacy_id: 1 }).lean();
    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
      const moduleName = row.module_name || 'Other';
      if (!grouped[moduleName]) grouped[moduleName] = [];
      grouped[moduleName].push({
        id: row.legacy_id,
        legacy_id: row.legacy_id,
        module_name: row.module_name,
        name: row.name,
        display_name: row.display_name,
        guard_name: row.guard_name || 'admin',
      });
    }
    return {
      status: 'success',
      message: 'Permissions fetched successfully',
      data: rows.map((r) => ({
        id: r.legacy_id,
        legacy_id: r.legacy_id,
        module_name: r.module_name,
        name: r.name,
        display_name: r.display_name,
      })),
      permissions: grouped,
    };
  }

  async createRole(dto: CreateRoleDto) {
    const name = (dto.name || '').trim();
    if (!name) {
      throw new BadRequestException({
        status: 'validations',
        errors: { name: ['The name field is required.'] },
      });
    }

    const permissionIds = this.normalizePermissionIds(dto.permissions);
    if (!permissionIds.length) {
      throw new BadRequestException({
        status: 'error',
        message: 'Please select atleast 1 permission.',
      });
    }

    const existing = await this.roleModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
    if (existing) {
      throw new BadRequestException({
        status: 'validations',
        errors: { name: ['Role is already exist!'] },
      });
    }

    const created = await this.roleModel.create({
      name,
      status: (dto.status ?? '1').toString(),
      formnumber: (dto.formnumber || '').trim(),
      permission_ids: permissionIds,
    });

    return {
      status: 'success',
      message: 'Role added successfully!',
      data: this.mapRole(created.toObject()),
    };
  }

  async listRoles(query?: ListRolesQueryDto) {
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
    if (query?.name?.trim()) {
      filter.name = { $regex: query.name.trim(), $options: 'i' };
    }
    const status = (query?.account_status || query?.status || '').trim();
    if (status && status !== 'All') {
      filter.status = status;
    }
    const searchValue =
      query?.search?.trim() ||
      (query as any)?.['search[value]']?.trim?.() ||
      '';
    if (searchValue) {
      filter.name = { $regex: searchValue, $options: 'i' };
    }

    const [roles, total] = await Promise.all([
      this.roleModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cappedLimit).lean(),
      this.roleModel.countDocuments(filter),
    ]);

    if (isDataTable) {
      return {
        draw,
        recordsTotal: total,
        recordsFiltered: total,
        data: roles.map((r) => this.mapRoleDataTableRow(r)),
      };
    }

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
        search: searchValue,
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

  async getRoleView(roleId: string) {
    const role = await this.roleModel.findById(roleId).lean();
    if (!role) {
      throw new NotFoundException({ status: 'error', message: 'Role not found' });
    }
    const permissionPayload = await this.listPermissions();
    const assigned = this.resolvePermissionIdsFromRole(role);
    return {
      status: 'success',
      message: 'Role view fetched successfully',
      data: {
        role: this.mapRole(role),
        permissions: permissionPayload.permissions,
        asignedPerms: assigned,
        assigned_permissions: assigned,
      },
    };
  }

  async updateRole(roleId: string, dto: CreateRoleDto) {
    const row = await this.roleModel.findById(roleId);
    if (!row) {
      throw new NotFoundException({ status: 'error', message: 'Role not found' });
    }

    const name = (dto.name || '').trim();
    if (!name) {
      throw new BadRequestException({
        status: 'validations',
        errors: { name: ['The name field is required.'] },
      });
    }

    const permissionIds = this.normalizePermissionIds(dto.permissions);
    if (!permissionIds.length) {
      throw new BadRequestException({
        status: 'error',
        message: 'Please select atleast 1 permission.',
      });
    }

    const exists = await this.roleModel
      .findOne({ _id: { $ne: row._id }, name: new RegExp(`^${name}$`, 'i') })
      .lean();
    if (exists) {
      throw new BadRequestException({
        status: 'validations',
        errors: { name: ['Role is already exist!'] },
      });
    }

    row.name = name;
    row.status = (dto.status ?? row.status ?? '1').toString();
    row.formnumber = (dto.formnumber || row.formnumber || '').trim();
    row.permission_ids = permissionIds;
    await row.save();

    return {
      status: 'success',
      message: 'Role updated successfully!',
      data: this.mapRole(row.toObject()),
    };
  }

  async bulkUpdateStatus(rawRoleIds: unknown, rawStatus: unknown) {
    const status = String(rawStatus ?? '').trim();
    if (!['0', '1'].includes(status)) {
      throw new BadRequestException({
        success: false,
        errors: { status: ['The status field is required.'] },
      });
    }

    const idsFromArray = Array.isArray(rawRoleIds)
      ? rawRoleIds
      : String(rawRoleIds || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
    const roleIds = idsFromArray.map((v) => String(v).trim()).filter(Boolean);
    if (!roleIds.length) {
      throw new BadRequestException({
        success: false,
        errors: { assessor_id: ['Please select at least one role.'] },
      });
    }

    const roles = await this.roleModel.find({ _id: { $in: roleIds } });
    for (const role of roles) {
      if (String((role as any).status || '1') !== status) {
        (role as any).status = status;
        await role.save();
      }
    }

    return {
      success: true,
      message: 'Status update Successfull!',
    };
  }

  async exportRoles(query?: ListRolesQueryDto): Promise<{ filename: string; content: string }> {
    const filter: Record<string, any> = {};
    if (query?.name?.trim()) {
      filter.name = { $regex: query.name.trim(), $options: 'i' };
    }
    const status = (query?.account_status || query?.status || '').trim();
    if (status && status !== 'All') {
      filter.status = status;
    }

    const rows = await this.roleModel.find(filter).sort({ createdAt: -1 }).lean();
    const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      ['id', 'name', 'status', 'permission_ids'].map(escapeCsv).join(','),
      ...rows.map((row: any) =>
        [
          String(row._id),
          row.name || '',
          row.status || '',
          this.resolvePermissionIdsFromRole(row).join('|'),
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ];

    return {
      filename: 'role.csv',
      content: csvLines.join('\n'),
    };
  }
}
