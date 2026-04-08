import { Body, Controller, Get, Param, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { SectorManagementService } from './sector-management.service';
import { CreateSectorManagementDto } from './dto/create-sector-management.dto';
import { ListSectorsQueryDto } from './dto/list-sectors-query.dto';

@Controller()
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
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listSectors(@Query() query: ListSectorsQueryDto) {
    return this.sectorService.listSectors(query);
  }

  @Get('api/admin/sector/:id')
  @Get('admin/sector/:id')
  @Get('api/admin/sectors/:id')
  @Get('admin/sectors/:id')
  async getSector(@Param('id') id: string) {
    return this.sectorService.getSector(id);
  }
}

