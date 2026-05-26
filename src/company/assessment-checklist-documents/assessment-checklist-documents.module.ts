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
import { CompanyProject, CompanyProjectSchema } from '../schemas/company-project.schema';
import { CompanyFacilitator, CompanyFacilitatorSchema } from '../schemas/company-facilitator.schema';
import { AssessmentChecklistDocumentsController } from './assessment-checklist-documents.controller';
import { AssessmentChecklistDocumentsService } from './assessment-checklist-documents.service';
import { AccountStatusGuard } from '../company-auth/guards/account-status.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssessmentChecklistDocument.name, schema: AssessmentChecklistDocumentSchema },
      { name: Sector.name, schema: SectorSchema },
      { name: GroupManagement.name, schema: GroupManagementSchema },
      { name: ParameterManagement.name, schema: ParameterManagementSchema },
      { name: Company.name, schema: CompanySchema },
      { name: CompanyProject.name, schema: CompanyProjectSchema },
      { name: CompanyFacilitator.name, schema: CompanyFacilitatorSchema },
    ]),
    NotificationsModule,
    MailModule,
  ],
  controllers: [AssessmentChecklistDocumentsController],
  providers: [AssessmentChecklistDocumentsService, AccountStatusGuard],
})
export class AssessmentChecklistDocumentsModule {}

