import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParameterManagementController } from './parameter-management.controller';
import { ParameterManagementService } from './parameter-management.service';
import { ParameterManagement, ParameterManagementSchema } from '../schemas/parameter-management.schema';
import { GroupManagement, GroupManagementSchema } from '../schemas/group-management.schema';
import { Sector, SectorSchema } from '../schemas/sector.schema';
import {
  MasterChecklistSector,
  MasterChecklistSectorSchema,
} from '../schemas/master-checklist-sector.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ParameterManagement.name, schema: ParameterManagementSchema },
      { name: GroupManagement.name, schema: GroupManagementSchema },
      { name: Sector.name, schema: SectorSchema },
      { name: MasterChecklistSector.name, schema: MasterChecklistSectorSchema },
    ]),
  ],
  controllers: [ParameterManagementController],
  providers: [ParameterManagementService],
})
export class ParameterManagementModule {}

