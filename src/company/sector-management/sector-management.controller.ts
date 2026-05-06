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
import { SectorManagementService } from './sector-management.service';
import { CreateSectorManagementDto } from './dto/create-sector-management.dto';
import { ListSectorsQueryDto } from './dto/list-sectors-query.dto';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';

@Controller()
@UseGuards(AdminJwtAuthGuard)
export class SectorManagementController {
  constructor(private readonly sectorService: SectorManagementService) {}

  @Post('api/admin/sector')
  @Post('admin/sector')
  @Post('api/admin/sectors')
  @Post('admin/sectors')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createSector(@Body() payload: CreateSectorManagementDto) {
    return this.sectorService.createSector(payload);
  }

  @Get('api/admin/sector')
  @Get('admin/sector')
  @Get('api/admin/sectors')
  @Get('admin/sectors')
  @Get('api/admin/master-data/sector')
  @Get('admin/master-data/sector')
  @Get('api/admin/master-data/sectors')
  @Get('admin/master-data/sectors')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listSectors(@Query() query: ListSectorsQueryDto) {
    return this.sectorService.listSectors(query);
  }

  // Legacy datatable path compatibility
  @Get('api/admin/sector_data')
  @Get('admin/sector_data')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listSectorsData(@Query() query: ListSectorsQueryDto) {
    return this.sectorService.listSectors(query);
  }

  @Put('api/admin/sector_bulk_update')
  @Put('admin/sector_bulk_update')
  @Post('api/admin/sector_bulk_update')
  @Post('admin/sector_bulk_update')
  async bulkUpdateStatus(@Body() body: { group_id?: string[] | string; status?: string }) {
    return this.sectorService.bulkUpdateStatus(body?.group_id, body?.status);
  }

  @Get('api/admin/sector_bulk_export')
  @Get('admin/sector_bulk_export')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async exportSectors(@Query() query: ListSectorsQueryDto, @Res() res: Response): Promise<void> {
    const exported = await this.sectorService.exportSectors(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  @Get('api/admin/sector/:id')
  @Get('admin/sector/:id')
  @Get('api/admin/sectors/:id')
  @Get('admin/sectors/:id')
  async getSector(@Param('id') id: string) {
    return this.sectorService.getSector(id);
  }

  @Put('api/admin/sector/:id')
  @Put('admin/sector/:id')
  @Put('api/admin/sectors/:id')
  @Put('admin/sectors/:id')
  @Patch('api/admin/sector/:id')
  @Patch('admin/sector/:id')
  @Patch('api/admin/sectors/:id')
  @Patch('admin/sectors/:id')
  @Post('api/admin/sector/:id')
  @Post('admin/sector/:id')
  @Post('api/admin/sectors/:id')
  @Post('admin/sectors/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateSector(@Param('id') id: string, @Body() payload: CreateSectorManagementDto) {
    return this.sectorService.updateSector(id, payload);
  }
}

