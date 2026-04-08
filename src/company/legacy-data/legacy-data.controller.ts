import { Body, Controller, Get, Param, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { LegacyDataService } from './legacy-data.service';
import { CreateLegacyDataDto } from './dto/create-legacy-data.dto';
import { ListLegacyDataQueryDto } from './dto/list-legacy-data-query.dto';
import { ImportLegacyDataDto } from './dto/import-legacy-data.dto';

@Controller()
export class LegacyDataController {
  constructor(private readonly legacyDataService: LegacyDataService) {}

  @Post('api/admin/legacy-data')
  @Post('admin/legacy-data')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async addLegacyData(@Body() dto: CreateLegacyDataDto) {
    return this.legacyDataService.createLegacyData(dto);
  }

  @Post('api/admin/legacyData')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async addLegacyDataCamel(@Body() dto: CreateLegacyDataDto) {
    return this.legacyDataService.createLegacyData(dto);
  }

  @Post('admin/legacyData')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async addLegacyDataAdminCamel(@Body() dto: CreateLegacyDataDto) {
    return this.legacyDataService.createLegacyData(dto);
  }

  @Post('api/admin/legacyData/import')
  @Post('admin/legacyData/import')
  @Post('api/admin/legacy-data/import')
  @Post('admin/legacy-data/import')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async importLegacyData(@Body() dto: ImportLegacyDataDto) {
    return this.legacyDataService.importLegacyData(dto);
  }

  @Get('api/admin/legacy-data')
  @Get('admin/legacy-data')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listLegacyData(@Query() query: ListLegacyDataQueryDto) {
    return this.legacyDataService.listLegacyData(query);
  }

  @Get('api/admin/legacyData')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listLegacyDataCamel(@Query() query: ListLegacyDataQueryDto) {
    return this.legacyDataService.listLegacyData(query);
  }

  @Get('admin/legacyData')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listLegacyDataAdminCamel(@Query() query: ListLegacyDataQueryDto) {
    return this.legacyDataService.listLegacyData(query);
  }

  @Get('api/admin/legacy-data/:id')
  @Get('admin/legacy-data/:id')
  async getLegacyData(@Param('id') id: string) {
    return this.legacyDataService.getLegacyDataById(id);
  }

  @Get('api/admin/legacyData/:id')
  async getLegacyDataCamel(@Param('id') id: string) {
    return this.legacyDataService.getLegacyDataById(id);
  }

  @Get('admin/legacyData/:id')
  async getLegacyDataAdminCamel(@Param('id') id: string) {
    return this.legacyDataService.getLegacyDataById(id);
  }
}

