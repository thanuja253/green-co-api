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
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(AnyFilesInterceptor())
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createParameter(@Body() payload: CreateParameterDto) {
    return this.parameterService.createParameter(payload);
  }

  @Post('api/admin/criteria')
  @Post('admin/criteria')
  @UseInterceptors(AnyFilesInterceptor())
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createCriteria(@Body() payload: CreateParameterDto) {
    return this.parameterService.createParameter(payload);
  }

  @Get('api/admin/parameter')
  @Get('admin/parameter')
  @Get('api/admin/parameters')
  @Get('admin/parameters')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listParameters(@Query() query: ListParametersQueryDto) {
    return this.parameterService.listParameters(query);
  }

  @Get('api/admin/criteria')
  @Get('admin/criteria')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listCriteria(@Query() query: ListParametersQueryDto) {
    return this.parameterService.listParameters(query);
  }

  /**
   * Public/company helper for Assessment Submittals:
   * Given a sector id, returns group + sector + all criteria (parameters) mapped to that group.
   *
   * GET /api/company/assessment-criteria/sector/:sectorId
   */
  @Get('api/company/assessment-criteria/sector/:sectorId')
  async listCriteriaForSector(@Param('sectorId') sectorId: string) {
    return this.parameterService.listCriteriaForSector(sectorId);
  }

  // Legacy datatable endpoint compatibility
  @Get('api/admin/criteria_data')
  @Get('admin/criteria_data')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listParametersData(@Query() query: ListParametersQueryDto) {
    return this.parameterService.listParameters(query);
  }

  @Get('api/admin/criteria_bulk_export')
  @Get('admin/criteria_bulk_export')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async exportParameters(@Query() query: ListParametersQueryDto, @Res() res: Response): Promise<void> {
    const exported = await this.parameterService.exportParameters(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  @Get('api/admin/parameter/:id')
  @Get('admin/parameter/:id')
  @Get('api/admin/parameters/:id')
  @Get('admin/parameters/:id')
  async getParameter(@Param('id') id: string) {
    return this.parameterService.getParameter(id);
  }

  @Get('api/admin/criteria/:id')
  @Get('admin/criteria/:id')
  async getCriteria(@Param('id') id: string) {
    return this.parameterService.getParameter(id);
  }

  @Put('api/admin/parameter/:id')
  @Put('admin/parameter/:id')
  @Put('api/admin/parameters/:id')
  @Put('admin/parameters/:id')
  @Patch('api/admin/parameter/:id')
  @Patch('admin/parameter/:id')
  @Patch('api/admin/parameters/:id')
  @Patch('admin/parameters/:id')
  @Post('api/admin/parameter/:id')
  @Post('admin/parameter/:id')
  @Post('api/admin/parameters/:id')
  @Post('admin/parameters/:id')
  @UseInterceptors(AnyFilesInterceptor())
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateParameter(@Param('id') id: string, @Body() payload: CreateParameterDto) {
    return this.parameterService.updateParameter(id, payload);
  }

  @Put('api/admin/criteria/:id')
  @Put('admin/criteria/:id')
  @Patch('api/admin/criteria/:id')
  @Patch('admin/criteria/:id')
  @Post('api/admin/criteria/:id')
  @Post('admin/criteria/:id')
  @UseInterceptors(AnyFilesInterceptor())
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateCriteria(@Param('id') id: string, @Body() payload: CreateParameterDto) {
    return this.parameterService.updateParameter(id, payload);
  }
}

