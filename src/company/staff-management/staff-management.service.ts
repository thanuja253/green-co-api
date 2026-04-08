import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { RoleManagement, RoleManagementDocument } from '../schemas/role-management.schema';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';

@Injectable()
export class StaffManagementService {
  constructor(
    @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
    @InjectModel(RoleManagement.name) private readonly roleModel: Model<RoleManagementDocument>,
  ) {}

  private mapStaff(staff: any) {
    return {
      id: staff._id?.toString?.() || staff._id,
      employee_code: staff.employee_code || '',
      name: staff.name || '',
      email: staff.email || '',
      phone: staff.mobile_number || '',
      mobile_number: staff.mobile_number || '',
      role_id: staff.role_id || '',
      role_name: staff.role_name || '',
      address: staff.address || '',
      designation: staff.designation || '',
      status: staff.status || '1',
      created_at: staff.createdAt || null,
      updated_at: staff.updatedAt || null,
    };
  }

  async createStaff(dto: CreateStaffDto) {
    const employeeCode = (dto.employee_code || '').trim();
    const name = (dto.name || '').trim();
    const email = (dto.email || '').trim().toLowerCase();

    if (!employeeCode || !name || !email) {
      throw new BadRequestException({
        status: 'validations',
        errors: {
          employee_code: !employeeCode ? ['employee_code is required.'] : undefined,
          name: !name ? ['name is required.'] : undefined,
          email: !email ? ['email is required.'] : undefined,
        },
      });
    }

    const existingCode = await this.staffModel.findOne({ employee_code: employeeCode }).lean();
    if (existingCode) {
      throw new BadRequestException({
        status: 'validations',
        errors: { employee_code: ['Employee code already exists.'] },
      });
    }

    const existingEmail = await this.staffModel.findOne({ email }).lean();
    if (existingEmail) {
      throw new BadRequestException({
        status: 'validations',
        errors: { email: ['Email already exists.'] },
      });
    }

    let roleName = (dto.role_name || '').trim();
    const roleId = (dto.role_id || '').trim();
    if (roleId && !roleName) {
      const role = await this.roleModel.findById(roleId).lean();
      if (role) roleName = role.name || '';
    }

    const created = await this.staffModel.create({
      employee_code: employeeCode,
      name,
      email,
      mobile_number: (dto.mobile_number || '').trim(),
      role_id: roleId,
      role_name: roleName,
      address: (dto.address || '').trim(),
      designation: (dto.designation || '').trim(),
      status: (dto.status || '1').toString(),
    });

    return {
      status: 'success',
      message: 'Staff added successfully',
      data: this.mapStaff(created.toObject()),
    };
  }

  async listStaff(query?: ListStaffQueryDto) {
    const parsedPage = Number.parseInt(String(query?.page ?? '1'), 10);
    const parsedLimit = Number.parseInt(String(query?.limit ?? '10'), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

    const filter: Record<string, any> = {};
    if (query?.name?.trim()) filter.name = { $regex: query.name.trim(), $options: 'i' };
    if (query?.email?.trim()) filter.email = { $regex: query.email.trim(), $options: 'i' };
    const phone = query?.phone?.trim() || query?.mobile_number?.trim();
    if (phone) filter.mobile_number = { $regex: phone, $options: 'i' };
    if (query?.designation?.trim()) filter.designation = { $regex: query.designation.trim(), $options: 'i' };
    if (query?.status?.trim() && query.status !== 'All') filter.status = query.status.trim();

    if (query?.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { employee_code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile_number: { $regex: search, $options: 'i' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.staffModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cappedLimit).lean(),
      this.staffModel.countDocuments(filter),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / cappedLimit));

    return {
      status: 'success',
      message: 'Staff fetched successfully',
      data: rows.map((r) => this.mapStaff(r)),
      pagination: {
        page,
        limit: cappedLimit,
        total,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_prev_page: page > 1,
      },
      applied_filters: {
        search: query?.search ?? '',
        name: query?.name ?? '',
        email: query?.email ?? '',
        phone: query?.phone ?? query?.mobile_number ?? '',
        designation: query?.designation ?? '',
        status: query?.status ?? '',
      },
    };
  }

  async getStaff(staffId: string) {
    const row = await this.staffModel.findById(staffId).lean();
    if (!row) {
      throw new NotFoundException({ status: 'error', message: 'Staff not found' });
    }
    return {
      status: 'success',
      message: 'Staff fetched successfully',
      data: this.mapStaff(row),
    };
  }
}

