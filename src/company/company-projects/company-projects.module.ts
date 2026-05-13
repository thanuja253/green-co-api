import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyProjectsController } from './company-projects.controller';
import { AdminCompanyFlowController } from './admin-company-flow.controller';
import { AdminLaunchTrainingController } from './admin-launch-training.controller';
import { AssessorCompanyProjectsController } from './assessor-company-projects.controller';
import { FacilitatorFinanceV2Controller } from './facilitator-finance-v2.controller';
import { FacilitatorLaunchTrainingController } from './facilitator-launch-training.controller';
import { CoordinatorPerformanceController } from './coordinator-performance.controller';
import { AdminGreencoDashboardController } from './admin-greenco-dashboard.controller';
import { CompanyProjectsService } from './company-projects.service';
import { AdminGreencoDashboardService } from './admin-greenco-dashboard.service';
import {
  CompanyProject,
  CompanyProjectSchema,
} from '../schemas/company-project.schema';
import { Company, CompanySchema } from '../schemas/company.schema';
import { LegacyData, LegacyDataSchema } from '../schemas/legacy-data.schema';
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
import {
  CreditManagement,
  CreditManagementSchema,
} from '../schemas/credit-management.schema';
import {
  ParameterManagement,
  ParameterManagementSchema,
} from '../schemas/parameter-management.schema';
import {
  MasterChecklistSector,
  MasterChecklistSectorSchema,
} from '../schemas/master-checklist-sector.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [
    NotificationsModule,
    MailModule,
    MongooseModule.forFeature([
      { name: CompanyProject.name, schema: CompanyProjectSchema },
      { name: Company.name, schema: CompanySchema },
      { name: LegacyData.name, schema: LegacyDataSchema },
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
      { name: CreditManagement.name, schema: CreditManagementSchema },
      { name: ParameterManagement.name, schema: ParameterManagementSchema },
      { name: MasterChecklistSector.name, schema: MasterChecklistSectorSchema },
    ]),
  ],
  controllers: [
    CompanyProjectsController,
    AdminCompanyFlowController,
    AdminLaunchTrainingController,
    AssessorCompanyProjectsController,
    FacilitatorFinanceV2Controller,
    FacilitatorLaunchTrainingController,
    CoordinatorPerformanceController,
    AdminGreencoDashboardController,
  ],
  providers: [CompanyProjectsService, AdminGreencoDashboardService],
  exports: [CompanyProjectsService],
})
export class CompanyProjectsModule {}


