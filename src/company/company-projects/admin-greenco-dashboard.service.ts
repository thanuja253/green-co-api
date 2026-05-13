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

/** Active company filter (Nest uses string account_status; optional soft-delete). */
function activeCompanyFilter(): Record<string, any> {
  return {
    account_status: '1',
    $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
  };
}

function yearMatchExpr(year: number): Record<string, any> {
  return { $eq: [{ $year: '$createdAt' }, year] };
}

/**
 * Approximate Laravel `cii_activity_log` max_activity buckets using
 * `companyprojects.next_activities_id` (next step to complete).
 * See legacy PHP DashboardController — fractional ids collapsed to integer bands.
 */
function bucketCii(nextRaw: number): 'launch' | 'pre' | 'assess' | 'rating' | 'rated' | 'early' {
  const n = Number(nextRaw) || 1;
  if (n >= 16) return 'rated';
  if (n >= 13) return 'rating';
  if (n >= 11) return 'assess';
  if (n >= 8) return 'pre';
  if (n >= 5) return 'launch';
  return 'early';
}

function bucketFacilitator(nextRaw: number): 'launch' | 'pre' | 'assess' | 'rating' | 'rated' | 'early' {
  const n = Number(nextRaw) || 1;
  if (n >= 16) return 'rated';
  if (n >= 13) return 'rating';
  if (n >= 11) return 'assess';
  if (n >= 7) return 'pre';
  if (n >= 5) return 'launch';
  return 'early';
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
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

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
   * Legacy PHP counts one row per **project** (grouped by project_id in SQL), not per company.
   */
  private accumulatePipeline(
    projects: Array<{ company_id: any; process_type?: string; next_activities_id?: number }>,
    yearCompanyIdSet: Set<string>,
  ): PipelineCounters {
    const out = this.emptyPipeline();
    for (const p of projects) {
      const cid = String(p.company_id ?? '');
      if (!cid || !yearCompanyIdSet.has(cid)) continue;
      const pt = String(p.process_type || 'c').toLowerCase();
      const next = Number(p.next_activities_id ?? 0);
      if (next < 5) continue;
      const isCii = pt === 'c';
      const b = isCii ? bucketCii(next) : bucketFacilitator(next);
      if (b === 'early') continue;
      if (isCii) out.processedCiiCompanyIds.push(cid);
      else out.processedFacilitatorCompanyIds.push(cid);
      switch (b) {
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

  /** Pipeline rows for companies registered in `year` (active), one count per project row. */
  private async pipelineForYear(year: number): Promise<PipelineCounters> {
    const companies = await this.companyModel
      .find({
        ...activeCompanyFilter(),
        $expr: yearMatchExpr(year),
      })
      .select('_id')
      .lean();
    const idSet = new Set((companies as any[]).map((c) => String(c._id)));
    if (!idSet.size) return this.emptyPipeline();
    const projects = await this.projectModel
      .find({
        company_id: { $in: [...idSet].map((id) => new Types.ObjectId(id)) },
      })
      .select('company_id process_type next_activities_id')
      .lean();
    return this.accumulatePipeline(projects as any[], idSet);
  }

  private async yearlyEnrolledCompanyCount(year: number): Promise<number> {
    const rows = await this.activityModel
      .aggregate([
        {
          $match: {
            milestone_flow: 5,
            milestone_completed: true,
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
            'co.account_status': '1',
            $expr: { $eq: [{ $year: '$co.createdAt' }, year] },
            $or: [{ 'co.deleted_at': null }, { 'co.deleted_at': { $exists: false } }],
          },
        },
        { $group: { _id: '$company_id' } },
        { $count: 'n' },
      ])
      .exec();
    return rows[0]?.n ?? 0;
  }

  private async yearlyRatedCompanyCount(year: number): Promise<number> {
    const rows = await this.activityModel
      .aggregate([
        {
          $match: {
            milestone_flow: { $gte: 15, $lt: 60 },
            milestone_completed: true,
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
            'co.account_status': '1',
            $expr: { $eq: [{ $year: '$co.createdAt' }, year] },
            $or: [{ 'co.deleted_at': null }, { 'co.deleted_at': { $exists: false } }],
          },
        },
        { $group: { _id: '$company_id' } },
        { $count: 'n' },
      ])
      .exec();
    return rows[0]?.n ?? 0;
  }

  private async countCompaniesRegisteredThrough(
    year: number,
    processType: 'c' | 'f',
  ): Promise<number> {
    const rows = await this.projectModel
      .aggregate([
        {
          $match: {
            process_type: processType,
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
            'co.account_status': '1',
            $expr: { $eq: [{ $year: '$co.createdAt' }, year] },
            $or: [{ 'co.deleted_at': null }, { 'co.deleted_at': { $exists: false } }],
          },
        },
        { $group: { _id: '$company_id' } },
        { $count: 'n' },
      ])
      .exec();
    return rows[0]?.n ?? 0;
  }

  private async combinedCertificationChart(year: number): Promise<
    Array<{ level: string; count: number }>
  > {
    const db = this.mongoConnection.db;
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

    const legacyRows = await this.legacyDataModel
      .find({
        level_of_certification: { $exists: true, $nin: [null, ''] },
        $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
      })
      .select('level_of_certification date_of_award')
      .lean();

    const legacyByLevel = new Map<string, number>();
    for (const r of legacyRows as any[]) {
      const y = this.extractYear(r.date_of_award);
      if (y !== year) continue;
      const level = String(r.level_of_certification || '').trim();
      if (!level) continue;
      legacyByLevel.set(level, (legacyByLevel.get(level) || 0) + 1);
    }

    const combined = new Map<string, number>();
    for (const row of certAgg as any[]) {
      const k = String(row._id || '').trim();
      if (!k) continue;
      combined.set(k, (combined.get(k) || 0) + Number(row.count || 0));
    }
    for (const [k, v] of legacyByLevel) {
      combined.set(k, (combined.get(k) || 0) + v);
    }

    return [...combined.entries()].map(([level, count]) => ({ level, count }));
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
    const now = new Date();
    let currentYear = now.getUTCFullYear();
    const qYear = query?.year ?? query?.selectedYear;
    if (qYear !== undefined && qYear !== null && String(qYear).trim() !== '') {
      const y = Number.parseInt(String(qYear), 10);
      if (Number.isFinite(y)) currentYear = y;
    }
    const lastYear = currentYear - 1;

    const [companiesCount, legacyCount, inactiveCompanies, yearlyRegistered] = await Promise.all([
      this.companyModel.countDocuments({
        $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
      }),
      this.legacyDataModel.countDocuments({
        $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
      }),
      this.companyModel.countDocuments({
        account_status: '0',
        $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
      }),
      this.companyModel.countDocuments({
        ...activeCompanyFilter(),
        $expr: yearMatchExpr(currentYear),
      }),
    ]);

    const [
      ciiCompany,
      facilitatorCompany,
      yearlyEnrolledCompanies,
      yearlyRatedCompanies,
      currentPipeline,
      carryPipeline,
      combinedData,
      uniqueProjectCount,
    ] = await Promise.all([
      this.countCompaniesRegisteredThrough(currentYear, 'c'),
      this.countCompaniesRegisteredThrough(currentYear, 'f'),
      this.yearlyEnrolledCompanyCount(currentYear),
      this.yearlyRatedCompanyCount(currentYear),
      this.pipelineForYear(currentYear),
      this.pipelineForYear(lastYear),
      this.combinedCertificationChart(currentYear),
      this.uniqueAssessorApprovedProjectCount(),
    ]);

    const yearlyOnlyRegistered = Math.max(0, yearlyRegistered - yearlyEnrolledCompanies);

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
        companies: companiesCount,
        legacy_companies: legacyCount,
        cii_company: ciiCompany,
        facilitator_company: facilitatorCompany,
        yearly_registered_companies: yearlyRegistered,
        yearly_enrolled_companies: yearlyEnrolledCompanies,
        yearly_only_registered_companies: yearlyOnlyRegistered,
        yearly_ratted_companies: yearlyRatedCompanies,
        inactive_companies: inactiveCompanies,
        total_companies: companiesCount + legacyCount,
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
        combined_data: combinedData,
        uniqueProjectCount: [{ unique_project_count: uniqueProjectCount }],
        meta: {
          source: 'nestjs',
          notes:
            'Pipeline counts approximate legacy PHP cii_activity_log using companyprojects.next_activities_id; one increment per project row in range. Enrollment uses milestone_flow=5 completed; rated uses milestone_flow 15–59.',
        },
      },
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
