import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyProjectsController } from './company-projects.controller';
import { AdminCompanyFlowController } from './admin-company-flow.controller';
import { AdminLaunchTrainingController } from './admin-launch-training.controller';
import { AssessorCompanyProjectsController } from './assessor-company-projects.controller';
import { FacilitatorFinanceV2Controller } from './facilitator-finance-v2.controller';
import { FacilitatorLaunchTrainingController } from './facilitator-launch-training.controller';
import { FacilitatorContractDocumentController } from './facilitator-contract-document.controller';
import { AdminFacilitatorContractController } from './admin-facilitator-contract.controller';
import { CoordinatorPerformanceController } from './coordinator-performance.controller';
import { AdminGreencoDashboardController } from './admin-greenco-dashboard.controller';
import { WorkOrderFlowController } from './work-order-flow.controller';
import { AdminEnhancedFeaturesController } from './admin-enhanced-features.controller';
import { CoordinatorChecklistController } from './coordinator-checklist.controller';
import { CompanyDashboardResourcesController } from './company-dashboard-resources.controller';
import { CompanyProjectsService } from './company-projects.service';
import { AdminGreencoDashboardService } from './admin-greenco-dashboard.service';
import { AdminInertCompaniesService } from './admin-inert-companies.service';
import { AdminAssessorFacilitatorDashboardService } from './admin-assessor-facilitator-dashboard.service';
import { WorkOrderFlowService } from './work-order-flow.service';
import { DashboardFreezeService } from './dashboard-freeze.service';
import { EnhancedFeaturesService } from './enhanced-features.service';
import { State, StateSchema } from '../schemas/state.schema';
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
import {
  DashboardSnapshot,
  DashboardSnapshotSchema,
} from '../schemas/dashboard-snapshot.schema';
import {
  ChecklistVersion,
  ChecklistVersionSchema,
} from '../schemas/checklist-version.schema';
import {
  CoordinatorChecklistVerification,
  CoordinatorChecklistVerificationSchema,
} from '../schemas/coordinator-checklist-verification.schema';
import {
  EmailTemplate,
  EmailTemplateSchema,
} from '../schemas/email-template.schema';
import {
  CompanyDashboardResource,
  CompanyDashboardResourceSchema,
} from '../schemas/company-dashboard-resource.schema';
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
      { name: State.name, schema: StateSchema },
      { name: DashboardSnapshot.name, schema: DashboardSnapshotSchema },
      { name: ChecklistVersion.name, schema: ChecklistVersionSchema },
      { name: CoordinatorChecklistVerification.name, schema: CoordinatorChecklistVerificationSchema },
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
      { name: CompanyDashboardResource.name, schema: CompanyDashboardResourceSchema },
    ]),
  ],
  controllers: [
    CompanyProjectsController,
    AdminCompanyFlowController,
    AdminLaunchTrainingController,
    AssessorCompanyProjectsController,
    FacilitatorFinanceV2Controller,
    FacilitatorLaunchTrainingController,
    FacilitatorContractDocumentController,
    AdminFacilitatorContractController,
    CoordinatorPerformanceController,
    AdminGreencoDashboardController,
    WorkOrderFlowController,
    AdminEnhancedFeaturesController,
    CoordinatorChecklistController,
    CompanyDashboardResourcesController,
  ],
  providers: [
    CompanyProjectsService,
    AdminGreencoDashboardService,
    AdminInertCompaniesService,
    AdminAssessorFacilitatorDashboardService,
    WorkOrderFlowService,
    DashboardFreezeService,
    EnhancedFeaturesService,
  ],
  exports: [CompanyProjectsService, EnhancedFeaturesService],
})
export class CompanyProjectsModule {}


