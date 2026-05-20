import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { StaffManagementService } from './staff-management.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';

@Controller()
@UseGuards(AdminJwtAuthGuard)
export class StaffManagementController {
  constructor(private readonly staffManagementService: StaffManagementService) {}

  @Post('api/admin/staff')
  @Post('admin/staff')
  @Post('api/admin/staff/create')
  @Post('admin/staff/create')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createStaff(@Body() dto: CreateStaffDto) {
    return this.staffManagementService.createStaff(dto);
  }

  @Get('api/admin/staff')
  @Get('admin/staff')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listStaff(@Query() query: ListStaffQueryDto) {
    return this.staffManagementService.listStaff(query);
  }

  @Get('api/admin/staff_data')
  @Get('admin/staff_data')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listStaffData(@Query() query: ListStaffQueryDto) {
    return this.staffManagementService.listStaff(query);
  }

  @Get('api/admin/staff/form-data')
  @Get('admin/staff/form-data')
  async staffFormData() {
    const roles = await this.staffManagementService.listActiveRolesForSelect();
    return { status: 'success', roles };
  }

  @Put('api/admin/staff_bulk_update')
  @Put('admin/staff_bulk_update')
  @Post('api/admin/staff_bulk_update')
  @Post('admin/staff_bulk_update')
  async bulkUpdateStatus(@Body() body: { assessor_id?: string[] | string; status?: string }) {
    return this.staffManagementService.bulkUpdateStatus(body?.assessor_id, body?.status);
  }

  @Get('api/admin/staff_bulk_export')
  @Get('admin/staff_bulk_export')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async exportStaff(@Query() query: ListStaffQueryDto, @Res() res: Response): Promise<void> {
    const exported = await this.staffManagementService.exportStaff(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  @Get('api/admin/staff/:staffId')
  @Get('admin/staff/:staffId')
  async getStaff(@Param('staffId') staffId: string) {
    return this.staffManagementService.getStaff(staffId);
  }

  @Put('api/admin/staff/:staffId')
  @Put('admin/staff/:staffId')
  @Patch('api/admin/staff/:staffId')
  @Patch('admin/staff/:staffId')
  @Post('api/admin/staff/:staffId')
  @Post('admin/staff/:staffId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateStaff(@Param('staffId') staffId: string, @Body() dto: UpdateStaffDto) {
    return this.staffManagementService.updateStaff(staffId, dto);
  }
}
