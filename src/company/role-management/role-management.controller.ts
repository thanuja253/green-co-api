import { Body, Controller, Get, Param, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { RoleManagementService } from './role-management.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';

@Controller()
export class RoleManagementController {
  constructor(private readonly roleManagementService: RoleManagementService) {}

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

  @Get('api/admin/roles/:roleId')
  @Get('admin/roles/:roleId')
  async getRole(@Param('roleId') roleId: string) {
    return this.roleManagementService.getRole(roleId);
  }
}

