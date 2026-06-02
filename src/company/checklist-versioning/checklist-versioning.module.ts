import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChecklistVersioningController } from './checklist-versioning.controller';
import { ChecklistVersioningService } from './checklist-versioning.service';
import { ChecklistVersion, ChecklistVersionSchema } from '../schemas/checklist-version.schema';
import { GroupManagement, GroupManagementSchema } from '../schemas/group-management.schema';
import {
  MasterChecklistSector,
  MasterChecklistSectorSchema,
} from '../schemas/master-checklist-sector.schema';
import {
  ParameterManagement,
  ParameterManagementSchema,
} from '../schemas/parameter-management.schema';
import { CompanyProject, CompanyProjectSchema } from '../schemas/company-project.schema';
import { Company, CompanySchema } from '../schemas/company.schema';
import { Sector, SectorSchema } from '../schemas/sector.schema';
import { CreditManagement, CreditManagementSchema } from '../schemas/credit-management.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChecklistVersion.name, schema: ChecklistVersionSchema },
      { name: GroupManagement.name, schema: GroupManagementSchema },
      { name: MasterChecklistSector.name, schema: MasterChecklistSectorSchema },
      { name: ParameterManagement.name, schema: ParameterManagementSchema },
      { name: CompanyProject.name, schema: CompanyProjectSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Sector.name, schema: SectorSchema },
      { name: CreditManagement.name, schema: CreditManagementSchema },
    ]),
  ],
  controllers: [ChecklistVersioningController],
  providers: [ChecklistVersioningService],
  exports: [ChecklistVersioningService],
})
export class ChecklistVersioningModule {}
