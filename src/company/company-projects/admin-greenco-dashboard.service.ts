import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { LegacyData, LegacyDataDocument } from '../schemas/legacy-data.schema';
import {
  CompanyProject,
  CompanyProjectDocument,
} from '../schemas/company-project.schema';
import {
  CompanyActivity,
  CompanyActivityDocument,
} from '../schemas/company-activity.schema';
import {
  CompanyCoordinator,
  CompanyCoordinatorDocument,
} from '../schemas/company-coordinator.schema';
import {
  normalizeCertificationLevelLabel,
  sortCertificationChartItems,
} from '../../helpers/certification.helper';

/** Legacy PHP: pipeline table only includes projects with MAX(normalized activity) <= 21. */
const PHP_PIPELINE_MAX_NORMALIZED = 21;

/** Active company filter — PHP account_status = 1, deleted_at IS NULL. */
function activeCompanyFilter(): Record<string, any> {
  return {
    account_status: { $in: [1, '1'] },
    $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
  };
}

function inactiveCompanyFilter(): Record<string, any> {
  return {
    account_status: { $in: [0, '0'] },
    $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
  };
}

/** PHP `whereNull('deleted_at')` — used on all company registration counts. */
function notDeletedCompanyFilter(): Record<string, any> {
  return {
    $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
  };
}

function yearMatchExpr(year: number): Record<string, any> {
  return { $eq: [{ $year: '$createdAt' }, year] };
}

/** Rows excluded before MAX — PHP activity_status <> 'Rejected'. */
function notRejectedActivityMatch(): Record<string, any> {
  return {
    $or: [
      { activity_status: { $exists: false } },
      { activity_status: null },
      { activity_status: '' },
      { activity_status: { $nin: ['Rejected', 'rejected', 'REJECTED'] } },
    ],
  };
}

/** Legacy PHP TRUNCATE(activities_id/10, 1) when activities_id >= 61 (e.g. 64 → 6.4). */
function normalizeActivityId(raw: number): number {
  const id = Number(raw) || 0;
  if (id >= 61) {
    return Math.trunc((id / 10) * 10) / 10;
  }
  return id;
}

/** Mongo $expr: per-row normalized activities_id (use before $group $max). */
function normalizedActivityIdExpr(field = '$milestone_flow'): Record<string, any> {
  return {
    $cond: [
      { $gte: [field, 61] },
      { $trunc: [{ $divide: [field, 10] }, 1] },
      field,
    ],
  };
}

type AssessmentChannel = 'cii' | 'facilitator';

type PipelineStageBucket = 'launch' | 'pre' | 'assess' | 'rating' | 'rated';

type ProjectStageRow = {
  project_id: string;
  company_id: string;
  assessment_through: AssessmentChannel;
  max_raw_activity_id: number;
  max_activity_id: number;
};

function resolveAssessmentChannel(
  assessmentThroughRaw: unknown,
  processTypeFallback?: string,
): AssessmentChannel {
  const at = String(assessmentThroughRaw || '')
    .trim()
    .toLowerCase();
  if (at === 'cii' || at === 'c') return 'cii';
  if (at === 'facilitator' || at === 'f' || at === 'fac') return 'facilitator';
  const pt = String(processTypeFallback || 'c').toLowerCase();
  return pt === 'f' ? 'facilitator' : 'cii';
}

/** Map normalized max_activity_id to one status row (legacy DashboardController ranges). */
function bucketByLegacyStage(
  stage: number,
  channel: 'cii' | 'facilitator',
  ciiLaunchMax: number,
  ciiPreMin: number,
): PipelineStageBucket | null {
  if (!(stage >= 5)) return null;
  const launchMax = channel === 'cii' ? ciiLaunchMax : 6.2;
  const preMin = channel === 'cii' ? ciiPreMin : 6.3;
  if (stage >= 5 && stage <= launchMax) return 'launch';
  if (stage >= preMin && stage < 10) return 'pre';
  if (stage >= 10 && stage < 12) return 'assess';
  if (stage >= 12 && stage < 15) return 'rating';
  if (stage >= 15) return 'rated';
  return null;
}

type PipelineCounters = {
  cii_lunch_report_pending: number;
  facilitator_lunch_report_pending: number;
  cii_preassessment_pending: number;
  facilitator_preassessment_pending: number;
  cii_assessment_pending: number;
  facilitator_assessment_pending: number;
  cii_rating_pending: number;
  facilitator_rating_pending: number;
  cii_rated_companies: number;
  facilitator_rated_companies: number;
  processedCiiCompanyIds: string[];
  processedFacilitatorCompanyIds: string[];
};

@Injectable()
export class AdminGreencoDashboardService {
  constructor(
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(LegacyData.name) private readonly legacyDataModel: Model<LegacyDataDocument>,
    @InjectModel(CompanyProject.name)
    private readonly projectModel: Model<CompanyProjectDocument>,
    @InjectModel(CompanyActivity.name)
    private readonly activityModel: Model<CompanyActivityDocument>,
    @InjectModel(CompanyCoordinator.name)
    private readonly companyCoordinatorModel: Model<CompanyCoordinatorDocument>,
    @InjectConnection() private readonly mongoConnection: Connection,
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

  private emptyPipeline(): PipelineCounters {
    return {
      cii_lunch_report_pending: 0,
      facilitator_lunch_report_pending: 0,
      cii_preassessment_pending: 0,
      facilitator_preassessment_pending: 0,
      cii_assessment_pending: 0,
      facilitator_assessment_pending: 0,
      cii_rating_pending: 0,
      facilitator_rating_pending: 0,
      cii_rated_companies: 0,
      facilitator_rated_companies: 0,
      processedCiiCompanyIds: [],
      processedFacilitatorCompanyIds: [],
    };
  }

  /**
   * Legacy PHP pipeline table: companies registered in `year`, projects with activity log,
   * MAX(normalized activities_id) <= 21, split by companies.assessment_through.
   */
  private async loadPipelineProjectStagesForYear(
    companyRegistrationYear: number,
  ): Promise<ProjectStageRow[]> {
    const aggRows = await this.activityModel
      .aggregate([
        {
          $match: {
            project_id: { $exists: true, $ne: null },
            milestone_flow: { $exists: true, $ne: null },
            ...notRejectedActivityMatch(),
          },
        },
        {
          $addFields: {
            norm_activity_id: normalizedActivityIdExpr('$milestone_flow'),
          },
        },
        {
          $group: {
            _id: '$project_id',
            company_id: { $first: '$company_id' },
            max_raw_activity_id: { $max: '$milestone_flow' },
            max_activity_id: { $max: '$norm_activity_id' },
          },
        },
        { $match: { max_activity_id: { $lte: PHP_PIPELINE_MAX_NORMALIZED } } },
        {
          $lookup: {
            from: 'companies',
            localField: 'company_id',
            foreignField: '_id',
            as: 'co',
          },
        },
        { $unwind: { path: '$co', preserveNullAndEmptyArrays: false } },
        {
          $match: {
            'co.account_status': { $in: [1, '1'] },
            $or: [{ 'co.deleted_at': null }, { 'co.deleted_at': { $exists: false } }],
            $expr: { $eq: [{ $year: '$co.createdAt' }, companyRegistrationYear] },
          },
        },
        {
          $lookup: {
            from: 'companyprojects',
            localField: '_id',
            foreignField: '_id',
            as: 'proj',
          },
        },
        {
          $project: {
            project_id: '$_id',
            company_id: 1,
            max_raw_activity_id: 1,
            max_activity_id: 1,
            assessment_through_raw: {
              $ifNull: [
                '$co.assessment_through',
                {
                  $cond: [
                    { $eq: [{ $arrayElemAt: ['$proj.process_type', 0] }, 'f'] },
                    'facilitator',
                    'cii',
                  ],
                },
              ],
            },
            process_type_fallback: { $arrayElemAt: ['$proj.process_type', 0] },
          },
        },
      ])
      .exec();

    return (aggRows as any[]).map((r) => ({
      project_id: String(r.project_id),
      company_id: String(r.company_id),
      assessment_through: resolveAssessmentChannel(
        r.assessment_through_raw,
        r.process_type_fallback,
      ),
      max_raw_activity_id: Number(r.max_raw_activity_id || 0),
      max_activity_id: Number(r.max_activity_id || 0),
    }));
  }

  private accumulatePipelineFromActivityLog(projectStages: ProjectStageRow[]): PipelineCounters {
    const out = this.emptyPipeline();

    const ciiStages = projectStages
      .filter((p) => p.assessment_through === 'cii')
      .map((p) => p.max_activity_id);
    const ciiFlexible = ciiStages.some((s) => s >= 6.4 && s <= 6.6);
    const ciiLaunchMax = ciiFlexible ? 6.4 : 6.2;
    const ciiPreMin = ciiFlexible ? 6.5 : 6.3;

    for (const p of projectStages) {
      const isCii = p.assessment_through === 'cii';
      const channel: AssessmentChannel = isCii ? 'cii' : 'facilitator';
      const bucket = bucketByLegacyStage(p.max_activity_id, channel, ciiLaunchMax, ciiPreMin);
      if (!bucket) continue;
      if (isCii) out.processedCiiCompanyIds.push(p.company_id);
      else out.processedFacilitatorCompanyIds.push(p.company_id);
      switch (bucket) {
        case 'launch':
          if (isCii) out.cii_lunch_report_pending += 1;
          else out.facilitator_lunch_report_pending += 1;
          break;
        case 'pre':
          if (isCii) out.cii_preassessment_pending += 1;
          else out.facilitator_preassessment_pending += 1;
          break;
        case 'assess':
          if (isCii) out.cii_assessment_pending += 1;
          else out.facilitator_assessment_pending += 1;
          break;
        case 'rating':
          if (isCii) out.cii_rating_pending += 1;
          else out.facilitator_rating_pending += 1;
          break;
        case 'rated':
          if (isCii) out.cii_rated_companies += 1;
          else out.facilitator_rated_companies += 1;
          break;
        default:
          break;
      }
    }
    return out;
  }

  /** Current or carry column: companies registered in that calendar year (PHP year(created_at)). */
  private async pipelineForYear(companyRegistrationYear: number): Promise<PipelineCounters> {
    const projectStages = await this.loadPipelineProjectStagesForYear(companyRegistrationYear);
    return this.accumulatePipelineFromActivityLog(projectStages);
  }

  /**
   * Top registration cards — PHP DashboardController@index (companies + legacy_data only).
   * Does not use activity log, companyactivities, or process_type.
   */
  async getRegistrationSummary(query: Record<string, any>): Promise<{
    status: string;
    message: string;
    data: Record<string, any>;
  }> {
    const year = this.resolveYear(query);
    const cards = await this.loadRegistrationCardMetrics(year);
    return {
      status: 'success',
      message: 'Admin dashboard registration summary',
      data: {
        selected_year: year,
        ...cards,
        last_refreshed_at: new Date().toISOString(),
      },
    };
  }

  private async loadRegistrationCardMetrics(year: number): Promise<{
    companies: number;
    legacy_companies: number;
    cii_company: number;
    facilitator_company: number;
    other_registered_companies: number;
    yearly_registered_companies: number;
    inactive_companies: number;
    total_companies: number;
    cii_plus_facilitator: number;
    registration_counts_aligned: boolean;
  }> {
    const yearFilter = {
      ...activeCompanyFilter(),
      $expr: yearMatchExpr(year),
    };

    const [
      companies,
      legacy_companies,
      cii_company,
      facilitator_company,
      yearly_registered_companies,
      inactive_companies,
    ] = await Promise.all([
      this.companyModel.countDocuments(notDeletedCompanyFilter()),
      this.legacyDataModel.countDocuments({}),
      this.companyModel.countDocuments({
        assessment_through: 'cii',
        ...yearFilter,
      }),
      this.companyModel.countDocuments({
        assessment_through: 'facilitator',
        ...yearFilter,
      }),
      this.companyModel.countDocuments(yearFilter),
      this.companyModel.countDocuments(inactiveCompanyFilter()),
    ]);

    const cii_plus_facilitator = cii_company + facilitator_company;
    const other_registered_companies = Math.max(
      0,
      yearly_registered_companies - cii_plus_facilitator,
    );

    return {
      companies,
      legacy_companies,
      cii_company,
      facilitator_company,
      other_registered_companies,
      yearly_registered_companies,
      inactive_companies,
      total_companies: companies + legacy_companies,
      cii_plus_facilitator,
      registration_counts_aligned: other_registered_companies === 0,
    };
  }

  /**
   * Second row cards — PHP DashboardController@index (cii_activity_log + companies only).
   * Does not use process_type, assessment_through, or pipeline MAX stage logic.
   */
  async getEnrollmentSummary(query: Record<string, any>): Promise<{
    status: string;
    message: string;
    data: Record<string, any>;
  }> {
    const year = this.resolveYear(query);
    const cards = await this.loadEnrollmentCardMetrics(year);
    return {
      status: 'success',
      message: 'Admin dashboard enrollment summary',
      data: {
        selected_year: year,
        ...cards,
        last_refreshed_at: new Date().toISOString(),
      },
    };
  }

  private companyMatchForActivityYear(year: number): Record<string, any> {
    return {
      'co.account_status': { $in: [1, '1'] },
      $expr: { $eq: [{ $year: '$co.createdAt' }, year] },
      $or: [{ 'co.deleted_at': null }, { 'co.deleted_at': { $exists: false } }],
    };
  }

  /** Distinct company_id from companyactivities (PHP cii_activity_log) + company year filters. */
  private async distinctCompaniesFromActivityLog(
    year: number,
    activityMatch: Record<string, any>,
  ): Promise<number> {
    const rows = await this.activityModel
      .aggregate([
        {
          $match: {
            company_id: { $exists: true, $ne: null },
            milestone_flow: { $exists: true, $ne: null },
            ...notRejectedActivityMatch(),
            ...activityMatch,
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
        { $match: this.companyMatchForActivityYear(year) },
        { $group: { _id: '$company_id' } },
        { $count: 'n' },
      ])
      .exec();
    return rows[0]?.n ?? 0;
  }

  private async loadEnrollmentCardMetrics(
    year: number,
    yearlyRegisteredOverride?: number,
  ): Promise<{
    yearly_registered_companies: number;
    yearly_enrolled_companies: number;
    yearly_only_registered_companies: number;
    yearly_ratted_companies: number;
    yearly_rated_companies: number;
  }> {
    const yearly_registered_companies =
      yearlyRegisteredOverride ??
      (await this.companyModel.countDocuments({
        ...activeCompanyFilter(),
        $expr: yearMatchExpr(year),
      }));

    const [yearly_enrolled_companies, yearly_ratted_companies] = await Promise.all([
      this.distinctCompaniesFromActivityLog(year, { milestone_flow: 5 }),
      this.distinctCompaniesFromActivityLog(year, {
        milestone_flow: { $gte: 15, $lt: 60 },
      }),
    ]);

    const yearly_only_registered_companies = Math.max(
      0,
      yearly_registered_companies - yearly_enrolled_companies,
    );

    return {
      yearly_registered_companies,
      yearly_enrolled_companies,
      yearly_only_registered_companies,
      yearly_ratted_companies,
      yearly_rated_companies: yearly_ratted_companies,
    };
  }

  private addCertificationCount(
    bucket: Map<string, number>,
    rawLabel: unknown,
    stats: { excluded_invalid_labels: number },
  ): void {
    const level = normalizeCertificationLevelLabel(rawLabel);
    if (!level) {
      const raw = String(rawLabel ?? '').trim();
      if (raw) stats.excluded_invalid_labels += 1;
      return;
    }
    bucket.set(level, (bucket.get(level) || 0) + 1);
  }

  private async combinedCertificationChart(year: number): Promise<{
    items: Array<{ level: string; count: number }>;
    excluded_invalid_labels: number;
  }> {
    const db = this.mongoConnection.db;
    const stats = { excluded_invalid_labels: 0 };
    const combined = new Map<string, number>();

    const certCollections = await db.listCollections({ name: 'certification_data' }).toArray();
    if (certCollections.length > 0) {
      const certAgg = await db
        .collection('certification_data')
        .aggregate([
          {
            $lookup: {
              from: 'companies',
              localField: 'company_id',
              foreignField: '_id',
              as: 'co',
            },
          },
          { $unwind: { path: '$co', preserveNullAndEmptyArrays: false } },
          {
            $match: {
              certification_type: { $exists: true, $nin: [null, ''] },
              $expr: { $eq: [{ $year: '$co.createdAt' }, year] },
            },
          },
          { $group: { _id: '$certification_type', count: { $sum: 1 } } },
        ])
        .toArray();

      for (const row of certAgg as any[]) {
        const level = normalizeCertificationLevelLabel(row._id);
        const count = Number(row.count || 0);
        if (!level) {
          stats.excluded_invalid_labels += count;
          continue;
        }
        combined.set(level, (combined.get(level) || 0) + count);
      }
    }

    const legacyRows = await this.legacyDataModel
      .find({
        level_of_certification: { $exists: true, $nin: [null, ''] },
        $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
      })
      .select('level_of_certification date_of_award')
      .lean();

    for (const r of legacyRows as any[]) {
      const y = this.extractYear(r.date_of_award);
      if (y !== year) continue;
      this.addCertificationCount(combined, r.level_of_certification, stats);
    }

    const items = sortCertificationChartItems(
      [...combined.entries()].map(([level, count]) => ({ level, count })),
    );

    return { items, excluded_invalid_labels: stats.excluded_invalid_labels };
  }

  private extractYear(dateOfAward: unknown): number | null {
    if (dateOfAward == null) return null;
    if (dateOfAward instanceof Date) return dateOfAward.getUTCFullYear();
    const s = String(dateOfAward).trim();
    if (!s) return null;
    const m = s.match(/^(\d{4})/);
    if (m) return Number(m[1]);
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.getUTCFullYear();
    return null;
  }

  private async uniqueAssessorApprovedProjectCount(): Promise<number> {
    const db = this.mongoConnection.db;
    const n = await db.collection('company_assesment_scoring').distinct('project_id', {
      assessor_approval: 1,
    });
    return n.length;
  }

  async getGreencoStatusDashboard(query: Record<string, any>): Promise<{
    status: string;
    message: string;
    data: Record<string, any>;
  }> {
    const currentYear = this.resolveYear(query);
    const lastYear = currentYear - 1;

    const [registrationCards, currentPipeline, carryPipeline, combinedData, uniqueProjectCount] =
      await Promise.all([
        this.loadRegistrationCardMetrics(currentYear),
        this.pipelineForYear(currentYear),
        this.pipelineForYear(lastYear),
        this.combinedCertificationChart(currentYear),
        this.uniqueAssessorApprovedProjectCount(),
      ]);

    const enrollmentCards = await this.loadEnrollmentCardMetrics(
      currentYear,
      registrationCards.yearly_registered_companies,
    );

    const grand_total_launch_carry =
      carryPipeline.cii_lunch_report_pending + carryPipeline.facilitator_lunch_report_pending;
    const grand_total_launch_current =
      currentPipeline.cii_lunch_report_pending + currentPipeline.facilitator_lunch_report_pending;
    const grand_total_company_rating_pending_carry =
      carryPipeline.cii_rating_pending + carryPipeline.facilitator_rating_pending;
    const grand_total_company_rating_pending_current =
      currentPipeline.cii_rating_pending + currentPipeline.facilitator_rating_pending;
    const grand_total_assessment_pending_carry =
      carryPipeline.cii_assessment_pending + carryPipeline.facilitator_assessment_pending;
    const grand_total_assessment_pending_current =
      currentPipeline.cii_assessment_pending + currentPipeline.facilitator_assessment_pending;
    const grand_total_pre_assessment_carry =
      carryPipeline.cii_preassessment_pending + carryPipeline.facilitator_preassessment_pending;
    const grand_total_pre_assessment_current =
      currentPipeline.cii_preassessment_pending + currentPipeline.facilitator_preassessment_pending;
    const grand_total_company_rated_carry =
      carryPipeline.cii_rated_companies + carryPipeline.facilitator_rated_companies;
    const grand_total_company_rated_current =
      currentPipeline.cii_rated_companies + currentPipeline.facilitator_rated_companies;

    const cii_grand_total_carry =
      carryPipeline.cii_lunch_report_pending +
      carryPipeline.cii_rating_pending +
      carryPipeline.cii_assessment_pending +
      carryPipeline.cii_preassessment_pending +
      carryPipeline.cii_rated_companies;
    const cii_grand_total_current =
      currentPipeline.cii_lunch_report_pending +
      currentPipeline.cii_rating_pending +
      currentPipeline.cii_assessment_pending +
      currentPipeline.cii_preassessment_pending +
      currentPipeline.cii_rated_companies;
    const fac_grand_total_carry =
      carryPipeline.facilitator_lunch_report_pending +
      carryPipeline.facilitator_rating_pending +
      carryPipeline.facilitator_assessment_pending +
      carryPipeline.facilitator_preassessment_pending +
      carryPipeline.facilitator_rated_companies;
    const fac_grand_total_current =
      currentPipeline.facilitator_lunch_report_pending +
      currentPipeline.facilitator_rating_pending +
      currentPipeline.facilitator_assessment_pending +
      currentPipeline.facilitator_preassessment_pending +
      currentPipeline.facilitator_rated_companies;
    const grand_total_carry =
      grand_total_pre_assessment_carry +
      grand_total_launch_carry +
      grand_total_assessment_pending_carry +
      grand_total_company_rated_carry +
      grand_total_company_rating_pending_carry;
    const grand_total_current =
      grand_total_pre_assessment_current +
      grand_total_launch_current +
      grand_total_assessment_pending_current +
      grand_total_company_rated_current +
      grand_total_company_rating_pending_current;

    return {
      status: 'success',
      message: 'Greenco Status dashboard data',
      data: {
        tab: 'greenco_status',
        pageTitle: 'Dashboard',
        selected_year: currentYear,
        companies: registrationCards.companies,
        legacy_companies: registrationCards.legacy_companies,
        cii_company: registrationCards.cii_company,
        facilitator_company: registrationCards.facilitator_company,
        yearly_registered_companies: registrationCards.yearly_registered_companies,
        yearly_enrolled_companies: enrollmentCards.yearly_enrolled_companies,
        yearly_only_registered_companies: enrollmentCards.yearly_only_registered_companies,
        yearly_ratted_companies: enrollmentCards.yearly_ratted_companies,
        yearly_rated_companies: enrollmentCards.yearly_rated_companies,
        inactive_companies: registrationCards.inactive_companies,
        total_companies: registrationCards.total_companies,
        ...this.flattenPipeline('carry_', carryPipeline),
        ...this.flattenPipeline('', currentPipeline),
        grand_total_launch_carry,
        grand_total_launch_current,
        grand_total_company_rating_pending_carry,
        grand_total_company_rating_pending_current,
        grand_total_assessment_pending_carry,
        grand_total_assessment_pending_current,
        grand_total_pre_assessment_carry,
        grand_total_pre_assessment_current,
        grand_total_company_rated_carry,
        grand_total_company_rated_current,
        cii_grand_total_carry,
        cii_grand_total_current,
        fac_grand_total_carry,
        fac_grand_total_current,
        grand_total_carry,
        grand_total_current,
        combined_data: combinedData.items,
        certification_chart_meta: {
          excluded_invalid_labels: combinedData.excluded_invalid_labels,
          note:
            'Chart uses canonical levels only (First Certified, Bronze, Silver, Gold, Platinum, etc.). Invalid legacy labels are excluded.',
        },
        uniqueProjectCount: [{ unique_project_count: uniqueProjectCount }],
        meta: {
          source: 'nestjs',
          parity: 'DashboardController@index',
          notes:
            'Row1: companies.assessment_through only. Row2: companyactivities milestone_flow 5 / 15-59, activity_status<>Rejected. Pipeline: MAX(normalized milestone_flow)<=21. Carry=year-1 registration.',
        },
      },
    };
  }

  async getDashboardSummary(query: Record<string, any>) {
    const currentYear = this.resolveYear(query);
    const now = new Date();
    const status = await this.getGreencoStatusDashboard(query);
    const d = status.data || {};
    const yearCompanyIds = (
      await this.companyModel
        .find({ ...activeCompanyFilter(), $expr: yearMatchExpr(currentYear) })
        .select('_id')
        .lean()
    ).map((c: any) => String(c._id));
    const idObjects = yearCompanyIds.map((id) => new Types.ObjectId(id));
    const assignedCompanyIds = await this.companyCoordinatorModel.distinct('company_id', {
      company_id: { $in: idObjects },
    });

    const monthStart =
      currentYear === now.getUTCFullYear()
        ? new Date(Date.UTC(currentYear, now.getUTCMonth(), 1))
        : new Date(Date.UTC(currentYear, 11, 1));
    const monthEnd =
      currentYear === now.getUTCFullYear()
        ? now
        : new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
    const [ciiDeltaMonth, facDeltaMonth] = await Promise.all([
      this.projectModel.countDocuments({
        process_type: 'c',
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
      this.projectModel.countDocuments({
        process_type: 'f',
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
    ]);

    return {
      status: 'success',
      message: 'Admin dashboard summary',
      data: {
        year: currentYear,
        registered_via_cii: {
          total: Number(d.cii_company || 0),
          delta_this_month: ciiDeltaMonth,
        },
        registered_via_facilitator: {
          total: Number(d.facilitator_company || 0),
          delta_this_month: facDeltaMonth,
        },
        total_registered: {
          year: currentYear,
          total: Number(d.yearly_registered_companies || 0),
        },
        overall_companies: {
          total: Number(d.total_companies || 0),
          inactive_count: Number(d.inactive_companies || 0),
        },
        enrolled_count: Number(d.yearly_enrolled_companies || 0),
        only_registered_count: Number(d.yearly_only_registered_companies || 0),
        rated_count: Number(d.yearly_ratted_companies || d.yearly_rated_companies || 0),
        yearly_registered_companies: Number(d.yearly_registered_companies || 0),
        coordinator_assigned_count: assignedCompanyIds.length,
        coordinator_pending_count: Math.max(0, yearCompanyIds.length - assignedCompanyIds.length),
        last_refreshed_at: new Date().toISOString(),
      },
    };
  }

  async getGrowthTrends(query: Record<string, any>) {
    const currentYear = this.resolveYear(query);
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const companyAgg = await this.companyModel.aggregate([
      { $match: { ...activeCompanyFilter(), $expr: yearMatchExpr(currentYear) } },
      { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
    ]);
    const certAgg = await this.projectModel.aggregate([
      {
        $match: {
          certificate_upload_date: { $exists: true, $ne: null },
          $expr: { $eq: [{ $year: '$certificate_upload_date' }, currentYear] },
        },
      },
      { $group: { _id: { $month: '$certificate_upload_date' }, count: { $sum: 1 } } },
    ]);
    const regMap = new Map(companyAgg.map((r: any) => [Number(r._id), Number(r.count || 0)]));
    const certMap = new Map(certAgg.map((r: any) => [Number(r._id), Number(r.count || 0)]));
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return {
        month: m,
        label: monthLabels[i],
        registration_count: regMap.get(m) || 0,
        certification_count: certMap.get(m) || 0,
      };
    });
    return {
      status: 'success',
      message: 'Admin dashboard growth trends',
      data: { year: currentYear, months, last_refreshed_at: new Date().toISOString() },
    };
  }

  async getCertificationDistribution(query: Record<string, any>) {
    const currentYear = this.resolveYear(query);
    const chart = await this.combinedCertificationChart(currentYear);
    const items = chart.items.map((r) => ({
      rating_key: String(r.level || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/\+/g, '_plus'),
      rating_label: String(r.level || '').trim(),
      count: Number(r.count || 0),
    }));
    const total = items.reduce((s, i) => s + i.count, 0);
    return {
      status: 'success',
      message: 'Admin dashboard certification distribution',
      data: {
        year: currentYear,
        items,
        total,
        excluded_invalid_labels: chart.excluded_invalid_labels,
        meta: {
          excluded_invalid_labels: chart.excluded_invalid_labels,
          note:
            chart.excluded_invalid_labels > 0
              ? `${chart.excluded_invalid_labels} legacy/certification row(s) had invalid level labels and were omitted from the chart. Fix level_of_certification in legacy data (use Bronze, Silver, Gold, etc.).`
              : 'All certification labels matched canonical rating levels.',
        },
        last_refreshed_at: new Date().toISOString(),
      },
    };
  }

  async getPipelineByStage(query: Record<string, any>) {
    const currentYear = this.resolveYear(query);
    const p = await this.pipelineForYear(currentYear);
    const stages = [
      {
        stage_key: 'launch_training',
        stage_label: 'Launch Training',
        count: Number(p.cii_lunch_report_pending || 0) + Number(p.facilitator_lunch_report_pending || 0),
        order: 1,
      },
      {
        stage_key: 'pre_assessment',
        stage_label: 'Pre-Assessment',
        count: Number(p.cii_preassessment_pending || 0) + Number(p.facilitator_preassessment_pending || 0),
        order: 2,
      },
      {
        stage_key: 'assessment',
        stage_label: 'Assessment',
        count: Number(p.cii_assessment_pending || 0) + Number(p.facilitator_assessment_pending || 0),
        order: 3,
      },
      {
        stage_key: 'rating',
        stage_label: 'Rating',
        count: Number(p.cii_rating_pending || 0) + Number(p.facilitator_rating_pending || 0),
        order: 4,
      },
      {
        stage_key: 'rated',
        stage_label: 'Rated',
        count: Number(p.cii_rated_companies || 0) + Number(p.facilitator_rated_companies || 0),
        order: 5,
      },
    ];
    return {
      status: 'success',
      message: 'Admin dashboard pipeline by stage',
      data: { year: currentYear, stages, last_refreshed_at: new Date().toISOString() },
    };
  }

  async getCompanyStatusOverview(query: Record<string, any>) {
    const currentYear = this.resolveYear(query);
    const carry = await this.pipelineForYear(currentYear - 1);
    const curr = await this.pipelineForYear(currentYear);
    const makeRow = (
      row_key: string,
      description: string,
      ciiCarry: number,
      ciiCurr: number,
      facCarry: number,
      facCurr: number,
    ) => {
      const totalCarry = ciiCarry + facCarry;
      const totalCurr = ciiCurr + facCurr;
      return {
        row_key,
        description,
        ci_ci: ciiCarry,
        ci_cu: ciiCurr,
        fac_ci: facCarry,
        fac_cu: facCurr,
        total_ci: totalCarry,
        total_cu: totalCurr,
      };
    };
    const rows = [
      makeRow(
        'launch_training',
        'Launch Training Pending',
        carry.cii_lunch_report_pending,
        curr.cii_lunch_report_pending,
        carry.facilitator_lunch_report_pending,
        curr.facilitator_lunch_report_pending,
      ),
      makeRow(
        'pre_assessment',
        'Pre-Assessment Pending',
        carry.cii_preassessment_pending,
        curr.cii_preassessment_pending,
        carry.facilitator_preassessment_pending,
        curr.facilitator_preassessment_pending,
      ),
      makeRow(
        'assessment',
        'Assessment Pending',
        carry.cii_assessment_pending,
        curr.cii_assessment_pending,
        carry.facilitator_assessment_pending,
        curr.facilitator_assessment_pending,
      ),
      makeRow(
        'rating',
        'Rating Pending',
        carry.cii_rating_pending,
        curr.cii_rating_pending,
        carry.facilitator_rating_pending,
        curr.facilitator_rating_pending,
      ),
      makeRow(
        'rated',
        'Rated Companies',
        carry.cii_rated_companies,
        curr.cii_rated_companies,
        carry.facilitator_rated_companies,
        curr.facilitator_rated_companies,
      ),
    ];

    const sum = (vals: number[]) => vals.reduce((a, b) => a + b, 0);
    const grandTotalRow = {
      row_key: 'grand_total',
      description: 'Grand Total',
      ci_ci: sum(rows.map((r) => r.ci_ci)),
      ci_cu: sum(rows.map((r) => r.ci_cu)),
      fac_ci: sum(rows.map((r) => r.fac_ci)),
      fac_cu: sum(rows.map((r) => r.fac_cu)),
      total_ci: sum(rows.map((r) => r.total_ci)),
      total_cu: sum(rows.map((r) => r.total_cu)),
    };
    rows.push(grandTotalRow);

    return {
      status: 'success',
      message: 'Admin dashboard company status overview',
      data: {
        year: currentYear,
        carry_year: currentYear - 1,
        grand_total_current: grandTotalRow.total_cu,
        grand_total_carry: grandTotalRow.total_ci,
        rows,
        last_refreshed_at: new Date().toISOString(),
      },
    };
  }

  async getRecentActivity(query: Record<string, any>) {
    const limit = Math.min(Math.max(Number.parseInt(String(query?.limit || '20'), 10) || 20, 1), 100);
    const rows = await this.activityModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('description activity_type company_id project_id createdAt milestone_completed')
      .lean();
    const items = (rows as any[]).map((r) => ({
      id: String(r._id),
      message: String(r.description || ''),
      created_at: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      severity: r.milestone_completed ? 'success' : 'info',
      entity_type: r.project_id ? 'project' : 'company',
      entity_id: String(r.project_id || r.company_id || ''),
      actor_name: String(r.activity_type || '').toUpperCase() || null,
    }));
    return {
      status: 'success',
      message: 'Admin dashboard recent activity',
      data: { items, last_refreshed_at: new Date().toISOString() },
    };
  }

  private flattenPipeline(prefix: string, p: PipelineCounters): Record<string, number> {
    const key = (s: string) => (prefix ? `${prefix}${s}` : s);
    return {
      [key('cii_lunch_report_pending')]: p.cii_lunch_report_pending,
      [key('facilitator_lunch_report_pending')]: p.facilitator_lunch_report_pending,
      [key('cii_preassessment_pending')]: p.cii_preassessment_pending,
      [key('facilitator_preassessment_pending')]: p.facilitator_preassessment_pending,
      [key('cii_assessment_pending')]: p.cii_assessment_pending,
      [key('facilitator_assessment_pending')]: p.facilitator_assessment_pending,
      [key('cii_rating_pending')]: p.cii_rating_pending,
      [key('facilitator_rating_pending')]: p.facilitator_rating_pending,
      [key('cii_rated_companies')]: p.cii_rated_companies,
      [key('facilitator_rated_companies')]: p.facilitator_rated_companies,
    };
  }
}
