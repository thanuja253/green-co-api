import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SectorManagementController } from './sector-management.controller';
import { SectorManagementService } from './sector-management.service';
import { Sector, SectorSchema } from '../schemas/sector.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Sector.name, schema: SectorSchema }])],
  controllers: [SectorManagementController],
  providers: [SectorManagementService],
})
export class SectorManagementModule {}

