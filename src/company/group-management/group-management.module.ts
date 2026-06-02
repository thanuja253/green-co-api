import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupManagementController } from './group-management.controller';
import { GroupManagementService } from './group-management.service';
import { GroupManagement, GroupManagementSchema } from '../schemas/group-management.schema';
import { Sector, SectorSchema } from '../schemas/sector.schema';
import { Company, CompanySchema } from '../schemas/company.schema';
import { CompanyProject, CompanyProjectSchema } from '../schemas/company-project.schema';
import { CompanyWorkOrder, CompanyWorkOrderSchema } from '../schemas/company-workorder.schema';
import { ChecklistVersioningModule } from '../checklist-versioning/checklist-versioning.module';

@Module({
  imports: [
    ChecklistVersioningModule,
    MongooseModule.forFeature([
      { name: GroupManagement.name, schema: GroupManagementSchema },
      { name: Sector.name, schema: SectorSchema },
      { name: Company.name, schema: CompanySchema },
      { name: CompanyProject.name, schema: CompanyProjectSchema },
      { name: CompanyWorkOrder.name, schema: CompanyWorkOrderSchema },
    ]),
  ],
  controllers: [GroupManagementController],
  providers: [GroupManagementService],
})
export class GroupManagementModule {}

