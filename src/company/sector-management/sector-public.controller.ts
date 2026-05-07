import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { SectorManagementService } from './sector-management.service';
import { ListSectorsQueryDto } from './dto/list-sectors-query.dto';

@Controller('api/company')
export class SectorPublicController {
  constructor(private readonly sectorService: SectorManagementService) {}

  /**
   * Public/company read-only sector listing for company panel dropdowns.
   * Forced to active sectors only so admin-only data/operations remain protected.
   */
  @Get('sector_data')
  @Get('sectors')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )
  async listActiveSectors(@Query() query: ListSectorsQueryDto) {
    return this.sectorService.listSectors({
      ...query,
      status: '1',
    });
  }
}
