import { Body, Controller, Get, Param, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ParameterManagementService } from './parameter-management.service';
import { CreateParameterDto } from './dto/create-parameter.dto';
import { ListParametersQueryDto } from './dto/list-parameters-query.dto';

@Controller()
export class ParameterManagementController {
  constructor(private readonly parameterService: ParameterManagementService) {}

  @Post('api/admin/parameter')
  @Post('admin/parameter')
  @Post('api/admin/parameters')
  @Post('admin/parameters')
  @Post('api/admin/criteria')
  @Post('admin/criteria')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createParameter(@Body() payload: CreateParameterDto) {
    return this.parameterService.createParameter(payload);
  }

  @Get('api/admin/parameter')
  @Get('admin/parameter')
  @Get('api/admin/parameters')
  @Get('admin/parameters')
  @Get('api/admin/criteria')
  @Get('admin/criteria')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listParameters(@Query() query: ListParametersQueryDto) {
    return this.parameterService.listParameters(query);
  }

  @Get('api/admin/parameter/:id')
  @Get('admin/parameter/:id')
  @Get('api/admin/parameters/:id')
  @Get('admin/parameters/:id')
  @Get('api/admin/criteria/:id')
  @Get('admin/criteria/:id')
  async getParameter(@Param('id') id: string) {
    return this.parameterService.getParameter(id);
  }
}

