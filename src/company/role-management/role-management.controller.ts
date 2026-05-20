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
import { RoleManagementService } from './role-management.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';

@Controller()
@UseGuards(AdminJwtAuthGuard)
export class RoleManagementController {
  constructor(private readonly roleManagementService: RoleManagementService) {}

  @Get('api/admin/permissions')
  @Get('admin/permissions')
  async listPermissions() {
    return this.roleManagementService.listPermissions();
  }

  @Post('api/admin/roles')
  @Post('admin/roles')
  @Post('api/admin/roles/create')
  @Post('admin/roles/create')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createRole(@Body() dto: CreateRoleDto) {
    return this.roleManagementService.createRole(dto);
  }

  @Get('api/admin/roles')
  @Get('admin/roles')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listRoles(@Query() query: ListRolesQueryDto) {
    return this.roleManagementService.listRoles(query);
  }

  @Get('api/admin/roles_data')
  @Get('admin/roles_data')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listRolesData(@Query() query: ListRolesQueryDto) {
    return this.roleManagementService.listRoles(query);
  }

  @Put('api/admin/roles_bulk_update')
  @Put('admin/roles_bulk_update')
  @Post('api/admin/roles_bulk_update')
  @Post('admin/roles_bulk_update')
  async bulkUpdateStatus(@Body() body: { assessor_id?: string[] | string; status?: string }) {
    return this.roleManagementService.bulkUpdateStatus(body?.assessor_id, body?.status);
  }

  @Get('api/admin/roles_bulk_export')
  @Get('admin/roles_bulk_export')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async exportRoles(@Query() query: ListRolesQueryDto, @Res() res: Response): Promise<void> {
    const exported = await this.roleManagementService.exportRoles(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  @Get('api/admin/roles_view/:roleId')
  @Get('admin/roles_view/:roleId')
  async getRoleView(@Param('roleId') roleId: string) {
    return this.roleManagementService.getRoleView(roleId);
  }

  @Get('api/admin/roles/:roleId')
  @Get('admin/roles/:roleId')
  async getRole(@Param('roleId') roleId: string) {
    return this.roleManagementService.getRole(roleId);
  }

  @Put('api/admin/roles/:roleId')
  @Put('admin/roles/:roleId')
  @Patch('api/admin/roles/:roleId')
  @Patch('admin/roles/:roleId')
  @Post('api/admin/roles/:roleId')
  @Post('admin/roles/:roleId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateRole(@Param('roleId') roleId: string, @Body() dto: CreateRoleDto) {
    return this.roleManagementService.updateRole(roleId, dto);
  }
}
