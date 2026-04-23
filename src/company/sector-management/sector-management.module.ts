import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SectorManagementController } from './sector-management.controller';
import { SectorManagementService } from './sector-management.service';
import { Sector, SectorSchema } from '../schemas/sector.schema';
import { GroupManagement, GroupManagementSchema } from '../schemas/group-management.schema';
import { CompanyProject, CompanyProjectSchema } from '../schemas/company-project.schema';
import { CompanyWorkOrder, CompanyWorkOrderSchema } from '../schemas/company-workorder.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sector.name, schema: SectorSchema },
      { name: GroupManagement.name, schema: GroupManagementSchema },
      { name: CompanyProject.name, schema: CompanyProjectSchema },
      { name: CompanyWorkOrder.name, schema: CompanyWorkOrderSchema },
    ]),
  ],
  controllers: [SectorManagementController],
  providers: [SectorManagementService],
})
export class SectorManagementModule {}

