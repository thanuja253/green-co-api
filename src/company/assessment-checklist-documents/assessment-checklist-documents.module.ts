import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AssessmentChecklistDocument,
  AssessmentChecklistDocumentSchema,
} from '../schemas/assessment-checklist-document.schema';
import { Sector, SectorSchema } from '../schemas/sector.schema';
import { GroupManagement, GroupManagementSchema } from '../schemas/group-management.schema';
import {
  ParameterManagement,
  ParameterManagementSchema,
} from '../schemas/parameter-management.schema';
import { Company, CompanySchema } from '../schemas/company.schema';
import { AssessmentChecklistDocumentsController } from './assessment-checklist-documents.controller';
import { AssessmentChecklistDocumentsService } from './assessment-checklist-documents.service';
import { AccountStatusGuard } from '../company-auth/guards/account-status.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssessmentChecklistDocument.name, schema: AssessmentChecklistDocumentSchema },
      { name: Sector.name, schema: SectorSchema },
      { name: GroupManagement.name, schema: GroupManagementSchema },
      { name: ParameterManagement.name, schema: ParameterManagementSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  controllers: [AssessmentChecklistDocumentsController],
  providers: [AssessmentChecklistDocumentsService, AccountStatusGuard],
})
export class AssessmentChecklistDocumentsModule {}

