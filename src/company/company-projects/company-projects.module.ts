import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyProjectsController } from './company-projects.controller';
import { CompanyProjectsService } from './company-projects.service';
import {
  CompanyProject,
  CompanyProjectSchema,
} from '../schemas/company-project.schema';
import { Company, CompanySchema } from '../schemas/company.schema';
import {
  CompanyFacilitator,
  CompanyFacilitatorSchema,
} from '../schemas/company-facilitator.schema';
import {
  CompanyCoordinator,
  CompanyCoordinatorSchema,
} from '../schemas/company-coordinator.schema';
import {
  CompanyAssessor,
  CompanyAssessorSchema,
} from '../schemas/company-assessor.schema';
import {
  CompanyActivity,
  CompanyActivitySchema,
} from '../schemas/company-activity.schema';
import {
  CompanyWorkOrder,
  CompanyWorkOrderSchema,
} from '../schemas/company-workorder.schema';
import {
  CompanyResourceDocument,
  CompanyResourceDocumentSchema,
} from '../schemas/company-resource-document.schema';
import {
  CompanyInvoice,
  CompanyInvoiceSchema,
} from '../schemas/company-invoice.schema';
import { Sector, SectorSchema } from '../schemas/sector.schema';
import {
  Facilitator,
  FacilitatorSchema,
} from '../schemas/facilitator.schema';
import {
  Coordinator,
  CoordinatorSchema,
} from '../schemas/coordinator.schema';
import { Assessor, AssessorSchema } from '../schemas/assessor.schema';
import {
  PrimaryDataForm,
  PrimaryDataFormSchema,
} from '../schemas/primary-data-form.schema';
import {
  MasterPrimaryDataChecklist,
  MasterPrimaryDataChecklistSchema,
} from '../schemas/master-primary-data-checklist.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../../mail/mail.module';
import { RegistrationMastersModule } from '../registration-masters/registration-masters.module';
import { AdminAuthModule } from '../../admin/admin-auth/admin-auth.module';

@Module({
  imports: [
    AdminAuthModule,
    NotificationsModule,
    MailModule,
    RegistrationMastersModule,
    MongooseModule.forFeature([
      { name: CompanyProject.name, schema: CompanyProjectSchema },
      { name: Company.name, schema: CompanySchema },
      { name: CompanyFacilitator.name, schema: CompanyFacilitatorSchema },
      { name: CompanyCoordinator.name, schema: CompanyCoordinatorSchema },
      { name: CompanyAssessor.name, schema: CompanyAssessorSchema },
      { name: CompanyActivity.name, schema: CompanyActivitySchema },
      { name: CompanyWorkOrder.name, schema: CompanyWorkOrderSchema },
      { name: CompanyResourceDocument.name, schema: CompanyResourceDocumentSchema },
      { name: CompanyInvoice.name, schema: CompanyInvoiceSchema },
      { name: Sector.name, schema: SectorSchema },
      { name: Facilitator.name, schema: FacilitatorSchema },
      { name: Coordinator.name, schema: CoordinatorSchema },
      { name: Assessor.name, schema: AssessorSchema },
      { name: PrimaryDataForm.name, schema: PrimaryDataFormSchema },
      { name: MasterPrimaryDataChecklist.name, schema: MasterPrimaryDataChecklistSchema },
    ]),
  ],
  controllers: [CompanyProjectsController],
  providers: [CompanyProjectsService],
})
export class CompanyProjectsModule {}


