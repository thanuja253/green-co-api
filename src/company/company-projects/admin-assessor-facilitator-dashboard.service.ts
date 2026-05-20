import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CompanyProject, CompanyProjectDocument } from '../schemas/company-project.schema';
import {
  CompanyWorkOrder,
  CompanyWorkOrderDocument,
} from '../schemas/company-workorder.schema';
import {
  CompanyCoordinator,
  CompanyCoordinatorDocument,
} from '../schemas/company-coordinator.schema';
import { Assessor, AssessorDocument } from '../schemas/assessor.schema';
import { Facilitator, FacilitatorDocument } from '../schemas/facilitator.schema';

function activeCompanyFilter(): Record<string, any> {
  return {
    account_status: { $in: [1, '1'] },
    $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
  };
}

function notDeletedCompanyFilter(): Record<string, any> {
  return {
    $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
  };
}

function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)),
  };
}

function yearMatchOnCreatedAt(year: number): Record<string, any> {
  const { start, end } = yearBounds(year);
  return { createdAt: { $gte: start, $lt: end } };
}

/** PHP `status = 1` */
function activeStatusFilter(): Record<string, any> {
  return { status: { $in: [1, '1', true] } };
}

/** PHP `status = 0` */
function inactiveStatusFilter(): Record<string, any> {
  return { status: { $in: [0, '0', false] } };
}

/** PHP `profile_updated = 0` → profile not complete. */
function profileNotUpdatedFilter(): Record<string, any> {
  return {
    $or: [
      { profile_status: { $exists: false } },
      { profile_status: null },
      { profile_status: '' },
      { profile_status: { $ne: 'Complete' } },
      { profile_status: { $regex: /^incomplete$/i } },
    ],
  };
}

/** PHP `verification_status = 0` → pending approval. */
function underApprovalFilter(): Record<string, any> {
  return {
    $or: [
      { approval_status: { $exists: false } },
      { approval_status: null },
      { approval_status: '' },
      { approval_status: { $regex: /^pending$/i } },
      { verification_status: { $in: [0, '0', false] } },
    ],
  };
}

export type StatCardItem = { label: string; value: number };

export type StatCardSection = {
  title: string;
  items: StatCardItem[];
};

export type AssessorFacilitatorDashboardData = {
  tab: string;
  pageTitle: string;
  selected_year: number;
  total_company: number;
  facilitator: StatCardSection;
  assessor: StatCardSection;
  work_order: StatCardSection;
  launch_training: StatCardSection;
  coordinator: StatCardSection;
};

@Injectable()
export class AdminAssessorFacilitatorDashboardService {
  constructor(
    @InjectModel(Facilitator.name)
    private readonly facilitatorModel: Model<FacilitatorDocument>,
    @InjectModel(Assessor.name)
    private readonly assessorModel: Model<AssessorDocument>,
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyWorkOrder.name)
    private readonly workOrderModel: Model<CompanyWorkOrderDocument>,
    @InjectModel(CompanyProject.name)
    private readonly projectModel: Model<CompanyProjectDocument>,
    @InjectModel(CompanyCoordinator.name)
    private readonly coordinatorModel: Model<CompanyCoordinatorDocument>,
  ) {}

  private resolveYear(query: Record<string, any>): number {
    const now = new Date();
    let currentYear = now.getUTCFullYear();
    const qYear = query?.year ?? query?.selectedYear;
    if (qYear !== undefined && qYear !== null && String(qYear).trim() !== '') {
      const y = Number.parseInt(String(qYear), 10);
      if (Number.isFinite(y)) currentYear = y;
    }
    return currentYear;
  }

  /**
   * PHP: distinct companies with WO in year (optional wo_status = 1 for "to given").
   */
  private async countDistinctCompaniesWithWorkOrder(
    year: number,
    woStatusAcceptedOnly: boolean,
  ): Promise<number> {
    const { start, end } = yearBounds(year);
    const match: Record<string, any> = {
      createdAt: { $gte: start, $lt: end, $ne: null },
    };
    if (woStatusAcceptedOnly) {
      match.wo_status = { $in: [1, '1'] };
    }

    const rows = await this.workOrderModel
      .aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'companyprojects',
            localField: 'project_id',
            foreignField: '_id',
            as: 'proj',
          },
        },
        { $unwind: { path: '$proj', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$proj.company_id' } },
        { $count: 'n' },
      ])
      .exec();

    return rows[0]?.n ?? 0;
  }

  /** PHP launch_training_complete: active company + launch_training_document set. */
  private async countLaunchTrainingComplete(year: number): Promise<number> {
    const { start, end } = yearBounds(year);
    const rows = await this.projectModel
      .aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end },
          },
        },
        {
          $lookup: {
            from: 'companies',
            localField: 'company_id',
            foreignField: '_id',
            as: 'co',
          },
        },
        { $unwind: '$co' },
        {
          $match: {
            'co.account_status': { $in: [1, '1'] },
            ...notDeletedCompanyFilter(),
            launch_training_document: {
              $exists: true,
              $nin: [null, ''],
            },
          },
        },
        { $count: 'n' },
      ])
      .exec();
    return rows[0]?.n ?? 0;
  }

  async loadAssessorFacilitatorDashboard(
    query: Record<string, any>,
  ): Promise<AssessorFacilitatorDashboardData> {
    const year = this.resolveYear(query);
    const yearFilter = yearMatchOnCreatedAt(year);

    const [
      regFacilitator,
      profileNotUpdatedFacilitator,
      underApprovedFacilitator,
      activeFacilitator,
      inactiveFacilitator,
      regAssessor,
      assessorProfileNotUpdated,
      underApprovedAssessor,
      activeAssessor,
      inactiveAssessor,
      workOrderToGiven,
      workOrderUploaded,
      totalCompany,
      launchTrainingComplete,
      coordinatorAssign,
    ] = await Promise.all([
      this.facilitatorModel.countDocuments(yearFilter),
      this.facilitatorModel.countDocuments({
        ...yearFilter,
        ...profileNotUpdatedFilter(),
      }),
      this.facilitatorModel.countDocuments({
        ...yearFilter,
        ...underApprovalFilter(),
      }),
      this.facilitatorModel.countDocuments({
        ...yearFilter,
        ...activeStatusFilter(),
      }),
      this.facilitatorModel.countDocuments({
        ...yearFilter,
        ...inactiveStatusFilter(),
      }),
      this.assessorModel.countDocuments(yearFilter),
      this.assessorModel.countDocuments({
        ...yearFilter,
        ...profileNotUpdatedFilter(),
      }),
      this.assessorModel.countDocuments({
        ...yearFilter,
        ...underApprovalFilter(),
      }),
      this.assessorModel.countDocuments({
        ...yearFilter,
        ...activeStatusFilter(),
      }),
      this.assessorModel.countDocuments({
        ...yearFilter,
        ...inactiveStatusFilter(),
      }),
      this.countDistinctCompaniesWithWorkOrder(year, true),
      this.countDistinctCompaniesWithWorkOrder(year, false),
      this.companyModel.countDocuments({
        ...activeCompanyFilter(),
        ...yearFilter,
        ...notDeletedCompanyFilter(),
      }),
      this.countLaunchTrainingComplete(year),
      this.coordinatorModel.countDocuments(yearFilter),
    ]);

    const workOrderToBeUploaded =
      workOrderUploaded !== 0 ? Math.max(0, totalCompany - workOrderUploaded) : 0;

    const launchTrainingPending = Math.max(0, totalCompany - launchTrainingComplete);

    const coordinatorNotAssign =
      coordinatorAssign !== 0 ? Math.max(0, totalCompany - coordinatorAssign) : 0;

    return {
      tab: 'assessorAndFacilitator',
      pageTitle: 'Dashboard',
      selected_year: year,
      total_company: totalCompany,
      facilitator: {
        title: 'Faciliator Statistics',
        items: [
          { label: 'No of facilitator registered', value: regFacilitator },
          {
            label: 'No of facilitator profile not updated',
            value: profileNotUpdatedFacilitator,
          },
          {
            label: 'No of facilitator under approval',
            value: underApprovedFacilitator,
          },
          { label: 'No of facilitator active', value: activeFacilitator },
          { label: 'No of facilitator inactive', value: inactiveFacilitator },
        ],
      },
      assessor: {
        title: 'Assessor Statistics',
        items: [
          { label: 'No of assessor registered', value: regAssessor },
          {
            label: 'No of assessor profile not updated',
            value: assessorProfileNotUpdated,
          },
          {
            label: 'No of assessor under approval',
            value: underApprovedAssessor,
          },
          { label: 'No of assessor active', value: activeAssessor },
          { label: 'No of assessor inactive', value: inactiveAssessor },
        ],
      },
      work_order: {
        title: 'Work Order Statistics',
        items: [
          { label: 'No of work order to given', value: workOrderToGiven },
          { label: 'No of work order uploaded', value: workOrderUploaded },
          {
            label: 'No of work order to be uploaded',
            value: workOrderToBeUploaded,
          },
        ],
      },
      launch_training: {
        title: 'Launch Program & Hand Holding Document',
        items: [
          { label: 'No of launch completed', value: launchTrainingComplete },
          { label: 'No of launch pending', value: launchTrainingPending },
        ],
      },
      coordinator: {
        title: 'Co-ordinator Status',
        items: [
          { label: 'No of Co-ordinator assigned', value: coordinatorAssign },
          {
            label: 'No of Co-ordinator not assigned',
            value: coordinatorNotAssign,
          },
        ],
      },
    };
  }

  /** Blade-compatible flat keys + nested cards for Next.js. */
  private toPhpCompatiblePayload(
    data: AssessorFacilitatorDashboardData,
  ): Record<string, unknown> {
    const pick = (section: StatCardSection, index: number) =>
      section.items[index]?.value ?? 0;

    return {
      ...data,
      reg_facilitator: pick(data.facilitator, 0),
      profile_not_updated_facilitator: pick(data.facilitator, 1),
      under_approved_facilitator: pick(data.facilitator, 2),
      active_facilitator: pick(data.facilitator, 3),
      inactive_facilitator: pick(data.facilitator, 4),
      reg_assessor: pick(data.assessor, 0),
      assessor_profile_not_updated: pick(data.assessor, 1),
      under_approved_updated: pick(data.assessor, 2),
      active_assessor: pick(data.assessor, 3),
      inactive_assessor: pick(data.assessor, 4),
      work_order_to_given: pick(data.work_order, 0),
      work_order_uploaded: pick(data.work_order, 1),
      work_order_to_be_uploaded: pick(data.work_order, 2),
      launch_training_complete: pick(data.launch_training, 0),
      launch_training_pending: pick(data.launch_training, 1),
      co_ordinator_assign: pick(data.coordinator, 0),
      co_ordinator_not_assign: pick(data.coordinator, 1),
      cards: {
        facilitator: data.facilitator,
        assessor: data.assessor,
        work_order: data.work_order,
        launch_training: data.launch_training,
        coordinator: data.coordinator,
      },
    };
  }

  async getAssessorFacilitatorDashboard(query: Record<string, any>): Promise<{
    status: string;
    message: string;
    data: Record<string, unknown>;
  }> {
    const core = await this.loadAssessorFacilitatorDashboard(query);
    return {
      status: 'success',
      message: 'Assessor & Facilitator dashboard data',
      data: {
        ...this.toPhpCompatiblePayload(core),
        last_refreshed_at: new Date().toISOString(),
      },
    };
  }
}
