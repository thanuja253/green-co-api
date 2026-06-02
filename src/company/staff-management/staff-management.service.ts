import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { RoleManagement, RoleManagementDocument } from '../schemas/role-management.schema';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { passwordGeneration } from '../../helpers/password.helper';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class StaffManagementService {
  constructor(
    @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
    @InjectModel(RoleManagement.name) private readonly roleModel: Model<RoleManagementDocument>,
    private readonly mailService: MailService,
  ) {}

  private resolveRoleId(raw: unknown): string {
    if (Array.isArray(raw)) {
      const first = raw[0];
      return String(first ?? '').trim();
    }
    return String(raw ?? '').trim();
  }

  private mapStaff(staff: any) {
    const status = String(staff.status ?? '1');
    return {
      id: staff._id?.toString?.() || staff._id,
      employee_code: staff.employee_code || '',
      employeecode: staff.employee_code || '',
      name: staff.name || '',
      email: staff.email || '',
      phone: staff.mobile_number || '',
      mobile: staff.mobile_number || '',
      mobile_number: staff.mobile_number || '',
      role_id: staff.role_id || '',
      role_name: staff.role_name || '',
      address: staff.address || '',
      designation: staff.designation || '',
      status,
      verification_status: staff.verification_status ?? status,
      role: staff.user_role || 'RT',
      created_at: staff.createdAt || null,
      updated_at: staff.updatedAt || null,
    };
  }

  private async resolveRoleMeta(roleId: string) {
    if (!roleId) return { role_id: '', role_name: '' };
    const role = await this.roleModel.findById(roleId).lean();
    return {
      role_id: roleId,
      role_name: role?.name || '',
    };
  }

  async createStaff(dto: CreateStaffDto) {
    const employeeCode = (dto.employee_code || dto.employeecode || '').trim();
    const name = (dto.name || '').trim();
    const email = (dto.email || '').trim().toLowerCase();
    const mobile = (dto.mobile || dto.mobile_number || '').trim();
    const address = (dto.address || '').trim();
    const roleId = this.resolveRoleId(dto.role ?? dto.role_id);
    const status = String(dto.status ?? '1').trim();

    const errors: Record<string, string[] | undefined> = {};
    if (!employeeCode || employeeCode.length < 3) {
      errors.employee_code = ['The employee code field is required.'];
    }
    if (!name || name.length < 3) {
      errors.name = ['The name field is required.'];
    }
    if (!address || address.length < 3) {
      errors.address = ['The address field is required.'];
    }
    if (!roleId) {
      errors.role = ['The role field is required.'];
    }
    if (!email) {
      errors.email = ['The email field is required.'];
    }
    if (!mobile || mobile.length !== 10) {
      errors.mobile = ['The Mobile Number Must be 10 digits'];
    }
    if (!status) {
      errors.status = ['The status field is required.'];
    }
    if (Object.keys(errors).length) {
      throw new BadRequestException({ status: 'validations', errors });
    }

    const existingCode = await this.staffModel.findOne({ employee_code: employeeCode }).lean();
    if (existingCode) {
      throw new BadRequestException({
        status: 'validations',
        errors: { employee_code: ['The employee code has already been taken.'] },
      });
    }

    const existingEmail = await this.staffModel.findOne({ email }).lean();
    if (existingEmail) {
      throw new BadRequestException({
        status: 'validations',
        errors: { email: ['The email has already been taken.'] },
      });
    }

    const existingMobile = await this.staffModel.findOne({ mobile_number: mobile }).lean();
    if (existingMobile) {
      throw new BadRequestException({
        status: 'validations',
        errors: { mobile: ['The mobile has already been taken.'] },
      });
    }

    const existingName = await this.staffModel
      .findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
      .lean();
    if (existingName) {
      throw new BadRequestException({
        status: 'validations',
        errors: { name: ['The name has already been taken.'] },
      });
    }

    const roleMeta = await this.resolveRoleMeta(roleId);
    const plainPassword = passwordGeneration(6);
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const created = await this.staffModel.create({
      employee_code: employeeCode,
      name,
      email,
      mobile_number: mobile,
      role_id: roleMeta.role_id,
      role_name: roleMeta.role_name,
      address,
      designation: (dto.designation || '').trim(),
      status,
      verification_status: '1',
      user_role: 'RT',
      password: passwordHash,
    });

    this.mailService
      .sendStaffCreatedEmail(email, name, plainPassword)
      .catch((err) => console.error('Staff created email failed:', err));

    return {
      status: 'success',
      message: 'Staff added successfully!',
      data: this.mapStaff(created.toObject()),
    };
  }

  async listStaff(query?: ListStaffQueryDto) {
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
    if (query?.email?.trim()) filter.email = { $regex: query.email.trim(), $options: 'i' };
    const phone = query?.phone?.trim() || query?.mobile_number?.trim() || query?.mobile?.trim();
    if (phone) filter.mobile_number = { $regex: phone, $options: 'i' };
    if (query?.employee_code?.trim()) {
      filter.employee_code = { $regex: query.employee_code.trim(), $options: 'i' };
    }
    if (query?.designation?.trim()) {
      filter.designation = { $regex: query.designation.trim(), $options: 'i' };
    }
    if (query?.status?.trim() && query.status !== 'All') filter.status = query.status.trim();
    if (query?.role?.trim()) filter.user_role = { $regex: query.role.trim(), $options: 'i' };

    const searchValue =
      query?.search?.trim() ||
      (query as any)?.['search[value]']?.trim?.() ||
      '';
    if (searchValue) {
      filter.$or = [
        { employee_code: { $regex: searchValue, $options: 'i' } },
        { name: { $regex: searchValue, $options: 'i' } },
        { email: { $regex: searchValue, $options: 'i' } },
        { mobile_number: { $regex: searchValue, $options: 'i' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.staffModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cappedLimit).lean(),
      this.staffModel.countDocuments(filter),
    ]);

    if (isDataTable) {
      return {
        draw,
        recordsTotal: total,
        recordsFiltered: total,
        data: rows.map((r) => this.mapStaff(r)),
      };
    }

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
        search: searchValue,
        name: query?.name ?? '',
        email: query?.email ?? '',
        phone: query?.phone ?? query?.mobile_number ?? query?.mobile ?? '',
        designation: query?.designation ?? '',
        status: query?.status ?? '',
        employee_code: query?.employee_code ?? '',
      },
    };
  }

  async getStaff(staffId: string) {
    const row = await this.staffModel.findById(staffId).lean();
    if (!row) {
      throw new NotFoundException({ status: 'error', message: 'Staff not found' });
    }
    return this.mapStaff(row);
  }

  async updateStaff(staffId: string, dto: UpdateStaffDto) {
    const row = await this.staffModel.findById(staffId).select('+password');
    if (!row) {
      throw new NotFoundException({ status: 'error', message: 'Staff not found' });
    }

    const employeeCode = (dto.edit_employee_code || '').trim();
    const name = (dto.edit_name || '').trim();
    const email = (dto.edit_email || '').trim().toLowerCase();
    const mobile = (dto.edit_mobile || '').trim();
    const address = (dto.edit_address || '').trim();
    const roleId = this.resolveRoleId(dto.edit_role);
    const status = String(dto.edit_status ?? '').trim();

    const errors: Record<string, string[] | undefined> = {};
    if (!employeeCode || employeeCode.length < 3) errors.edit_employee_code = ['The edit employee code field is required.'];
    if (!name || name.length < 3) errors.edit_name = ['The edit name field is required.'];
    if (!address || address.length < 3) errors.edit_address = ['The edit address field is required.'];
    if (!roleId) errors.edit_role = ['The edit role field is required.'];
    if (!email) errors.edit_email = ['The edit email field is required.'];
    if (!mobile || mobile.length !== 10) errors.edit_mobile = ['The Mobile Number Must be 10 digits'];
    if (!status) errors.edit_status = ['The edit status field is required.'];
    if (Object.keys(errors).length) {
      throw new BadRequestException({ status: 'validations', errors });
    }

    const duplicateEmail = await this.staffModel
      .findOne({ _id: { $ne: row._id }, email })
      .lean();
    if (duplicateEmail) {
      throw new BadRequestException({
        status: 'validations',
        errors: { edit_email: ['The email has already been taken.'] },
      });
    }

    const duplicateMobile = await this.staffModel
      .findOne({ _id: { $ne: row._id }, mobile_number: mobile })
      .lean();
    if (duplicateMobile) {
      throw new BadRequestException({
        status: 'validations',
        errors: { edit_mobile: ['The mobile has already been taken.'] },
      });
    }

    const roleMeta = await this.resolveRoleMeta(roleId);
    const previousEmail = String(row.email || '').trim().toLowerCase();
    const emailChanged = previousEmail !== email;

    if (emailChanged) {
      const plainPassword = passwordGeneration(8);
      row.password = await bcrypt.hash(plainPassword, 10);
      const details = { name, email, mobile, password: plainPassword };
      this.mailService
        .sendStaffEmailChangedEmail(email, details)
        .catch((err) => console.error('Staff email changed notification failed:', err));
      this.mailService
        .sendStaffDetailsChangedEmail(previousEmail, details)
        .catch((err) => console.error('Staff details changed notification failed:', err));
    }

    row.employee_code = employeeCode;
    row.name = name;
    row.email = email;
    row.mobile_number = mobile;
    row.address = address;
    row.role_id = roleMeta.role_id;
    row.role_name = roleMeta.role_name;
    row.status = status;
    row.verification_status = status;
    row.user_role = 'RT';
    await row.save();

    return {
      status: 'success',
      message: 'Staff Details Updated successfully!',
      data: this.mapStaff(row.toObject()),
    };
  }

  async bulkUpdateStatus(rawStaffIds: unknown, rawStatus: unknown) {
    const status = String(rawStatus ?? '').trim();
    if (!['0', '1'].includes(status)) {
      throw new BadRequestException({
        success: false,
        errors: { status: ['The status field is required.'] },
      });
    }

    const idsFromArray = Array.isArray(rawStaffIds)
      ? rawStaffIds
      : String(rawStaffIds || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
    const staffIds = idsFromArray.map((v) => String(v).trim()).filter(Boolean);
    if (!staffIds.length) {
      throw new BadRequestException({
        success: false,
        errors: { assessor_id: ['Please select a Staff'] },
      });
    }

    const users = await this.staffModel.find({ _id: { $in: staffIds } });
    for (const user of users) {
      const current = String((user as any).status || '1');
      if (current === status) continue;
      const details = {
        name: (user as any).name,
        email: (user as any).email,
        mobile: (user as any).mobile_number,
      };
      if (status === '0') {
        this.mailService
          .sendStaffAccountDeactivatedEmail((user as any).email, details)
          .catch((err) => console.error('Staff deactivate email failed:', err));
      } else {
        this.mailService
          .sendStaffAccountActivatedEmail((user as any).email, details)
          .catch((err) => console.error('Staff activate email failed:', err));
      }
      (user as any).status = status;
      await user.save();
    }

    return {
      success: true,
      message: 'Status update Successfull!',
    };
  }

  async exportStaff(query?: ListStaffQueryDto): Promise<{ filename: string; content: string }> {
    const filter: Record<string, any> = {};
    if (query?.employee_code?.trim()) {
      filter.employee_code = { $regex: query.employee_code.trim(), $options: 'i' };
    }
    if (query?.status?.trim() && query.status !== 'All') filter.status = query.status.trim();
    if (query?.name?.trim()) filter.name = { $regex: query.name.trim(), $options: 'i' };
    if (query?.email?.trim()) filter.email = { $regex: query.email.trim(), $options: 'i' };
    const mobile = query?.mobile?.trim() || query?.mobile_number?.trim();
    if (mobile) filter.mobile_number = { $regex: mobile, $options: 'i' };

    const rows = await this.staffModel.find(filter).sort({ createdAt: -1 }).lean();
    const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      ['id', 'employee_code', 'name', 'email', 'mobile', 'role_name', 'status', 'address']
        .map(escapeCsv)
        .join(','),
      ...rows.map((row: any) =>
        [
          String(row._id),
          row.employee_code || '',
          row.name || '',
          row.email || '',
          row.mobile_number || '',
          row.role_name || '',
          row.status || '',
          row.address || '',
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ];

    return {
      filename: 'staff.csv',
      content: csvLines.join('\n'),
    };
  }

  async listActiveRolesForSelect() {
    const roles = await this.roleModel.find({ status: '1' }).sort({ name: 1 }).lean();
    return roles.map((r: any) => ({
      id: String(r._id),
      name: r.name || '',
    }));
  }
}
