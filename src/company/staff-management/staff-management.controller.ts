import { Body, Controller, Get, Param, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { StaffManagementService } from './staff-management.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';

@Controller()
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

  @Get('api/admin/staff/:staffId')
  @Get('admin/staff/:staffId')
  async getStaff(@Param('staffId') staffId: string) {
    return this.staffManagementService.getStaff(staffId);
  }
}

