import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CompanyProject, CompanyProjectDocument } from '../schemas/company-project.schema';
import {
  CompanyActivity,
  CompanyActivityDocument,
} from '../schemas/company-activity.schema';
import { State, StateDocument } from '../schemas/state.schema';

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

function yearMatchExpr(year: number, field = '$createdAt'): Record<string, any> {
  return { $eq: [{ $year: field }, year] };
}

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

export type InertMetricTriple = {
  carry: number;
  current: number;
  total: number;
};

export type InertCompaniesData = {
  tab: string;
  pageTitle: string;
  selected_year: number;
  carry_year: number;
  not_enrolled_only_registered: InertMetricTriple;
  not_rated_only_enrolled: InertMetricTriple;
  not_close_project_only_rated: InertMetricTriple;
  stalled: InertMetricTriple;
  chart: {
    labels: string[];
    rows: Array<Array<string | number>>;
  };
};

@Injectable()
export class AdminInertCompaniesService {
  constructor(
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyProject.name)
    private readonly projectModel: Model<CompanyProjectDocument>,
    @InjectModel(CompanyActivity.name)
    private readonly activityModel: Model<CompanyActivityDocument>,
    @InjectModel(State.name) private readonly stateModel: Model<StateDocument>,
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

  private sixthMonthCutoff(): Date {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 6);
    return d;
  }

  /** PHP: distinct company_id, activities_id = 5, not Rejected, company year = selected year. */
  private async countEnrolledCompanies(year: number): Promise<number> {
    const rows = await this.activityModel
      .aggregate([
        {
          $match: {
            milestone_flow: 5,
            company_id: { $exists: true, $ne: null },
            ...notRejectedActivityMatch(),
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
            $expr: { $eq: [{ $year: '$co.createdAt' }, year] },
            ...notDeletedCompanyFilter(),
          },
        },
        { $group: { _id: '$company_id' } },
        { $count: 'n' },
      ])
      .exec();
    return rows[0]?.n ?? 0;
  }

  /** PHP: CompanyProject::where('project_status', 1)->where('created_at', '<', sixth_month)->count() */
  private async countProjectsByStatus(status: number): Promise<number> {
    return this.projectModel.countDocuments({
      project_status: status,
      createdAt: { $lt: this.sixthMonthCutoff() },
    });
  }

  /**
   * PHP: distinct companies with activity milestone_flow = 15, company registered in year.
   */
  private async countRatedCompaniesByRegistrationYear(year: number): Promise<number> {
    const rows = await this.activityModel
      .aggregate([
        {
          $match: {
            milestone_flow: 15,
            company_id: { $exists: true, $ne: null },
            ...notRejectedActivityMatch(),
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
            $expr: { $eq: [{ $year: '$co.createdAt' }, year] },
            ...notDeletedCompanyFilter(),
          },
        },
        { $group: { _id: '$company_id' } },
        { $count: 'n' },
      ])
      .exec();
    return rows[0]?.n ?? 0;
  }

  /** PHP stalled: account_status=0, created year, updated year = current year. */
  private async countStalled(createdYear: number, updatedYear: number): Promise<number> {
    return this.companyModel.countDocuments({
      account_status: { $in: [0, '0'] },
      ...notDeletedCompanyFilter(),
      $expr: {
        $and: [
          { $eq: [{ $year: '$createdAt' }, createdYear] },
          { $eq: [{ $year: '$updatedAt' }, updatedYear] },
        ],
      },
    });
  }

  /** Resolve project state key (legacy column or registration_info). */
  private projectStateKeyAddFields(): Record<string, any> {
    return {
      state_key: {
        $let: {
          vars: {
            raw: {
              $ifNull: [
                '$state',
                '$registration_info.state_id',
                '$registration_info.state',
              ],
            },
          },
          in: {
            $cond: [
              { $eq: [{ $type: '$$raw' }, 'objectId'] },
              { $toString: '$$raw' },
              { $toString: '$$raw' },
            ],
          },
        },
      },
    };
  }

  /**
   * State chart — Register: max activity 2–3 per company (PHP logic).
   * Enrolled: projects with wo_status=1, profile_update=1, created in year.
   * Rated: activity 15, grouped by project.state.
   */
  private async buildStateWiseChart(year: number): Promise<{
    labels: string[];
    rows: Array<Array<string | number>>;
  }> {
    const registerByState = await this.activityModel
      .aggregate([
        {
          $match: {
            milestone_flow: { $exists: true, $ne: null },
            company_id: { $exists: true, $ne: null },
            ...notRejectedActivityMatch(),
          },
        },
        {
          $group: {
            _id: '$company_id',
            max_activity_id: { $max: '$milestone_flow' },
          },
        },
        {
          $match: {
            max_activity_id: { $gte: 2, $lte: 3 },
          },
        },
        {
          $lookup: {
            from: 'companyprojects',
            localField: '_id',
            foreignField: 'company_id',
            as: 'proj',
          },
        },
        { $unwind: { path: '$proj', preserveNullAndEmptyArrays: false } },
        {
          $addFields: {
            state_key: {
              $let: {
                vars: {
                  raw: {
                    $ifNull: [
                      '$proj.state',
                      '$proj.registration_info.state_id',
                      '$proj.registration_info.state',
                    ],
                  },
                },
                in: { $toString: '$$raw' },
              },
            },
          },
        },
        {
          $match: {
            state_key: { $nin: ['', 'null', 'undefined'] },
          },
        },
        { $group: { _id: '$state_key', count: { $sum: 1 } } },
      ])
      .exec();

    const enrolledByState = await this.projectModel
      .aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.UTC(year, 0, 1, 1)),
              $lt: new Date(Date.UTC(year + 1, 0, 1, 1)),
            },
            profile_update: { $in: [1, '1'] },
          },
        },
        {
          $lookup: {
            from: 'companyworkorders',
            localField: '_id',
            foreignField: 'project_id',
            as: 'wo',
          },
        },
        { $unwind: { path: '$wo', preserveNullAndEmptyArrays: false } },
        {
          $match: {
            'wo.wo_status': { $in: [1, '1'] },
          },
        },
        { $addFields: this.projectStateKeyAddFields() },
        {
          $match: {
            state_key: { $nin: ['', 'null', 'undefined'] },
          },
        },
        { $group: { _id: '$state_key', count: { $sum: 1 } } },
      ])
      .exec();

    const ratedByState = await this.activityModel
      .aggregate([
        {
          $match: {
            milestone_flow: 15,
            project_id: { $exists: true, $ne: null },
            ...notRejectedActivityMatch(),
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
            $expr: { $eq: [{ $year: '$co.createdAt' }, year] },
            ...notDeletedCompanyFilter(),
          },
        },
        {
          $lookup: {
            from: 'companyprojects',
            localField: 'project_id',
            foreignField: '_id',
            as: 'proj',
          },
        },
        { $unwind: { path: '$proj', preserveNullAndEmptyArrays: false } },
        {
          $addFields: {
            state_key: {
              $let: {
                vars: {
                  raw: {
                    $ifNull: [
                      '$proj.state',
                      '$proj.registration_info.state_id',
                      '$proj.registration_info.state',
                    ],
                  },
                },
                in: { $toString: '$$raw' },
              },
            },
          },
        },
        {
          $match: {
            state_key: { $nin: ['', 'null', 'undefined'] },
          },
        },
        { $group: { _id: '$state_key', count: { $sum: 1 } } },
      ])
      .exec();

    const registerMap = new Map<string, number>(
      registerByState.map((r: { _id: unknown; count: number }) => [
        String(r._id),
        Number(r.count || 0),
      ]),
    );
    const enrolledMap = new Map<string, number>(
      enrolledByState.map((r: { _id: unknown; count: number }) => [
        String(r._id),
        Number(r.count || 0),
      ]),
    );
    const ratedMap = new Map<string, number>(
      ratedByState.map((r: { _id: unknown; count: number }) => [
        String(r._id),
        Number(r.count || 0),
      ]),
    );

    const states = await this.stateModel
      .find({ status: { $in: [1, '1'] } })
      .select('_id name')
      .sort({ name: 1 })
      .lean();

    const labels = ['State', 'Register', 'Enrolled', 'Rated'];
    const rows: Array<Array<string | number>> = [];

    const pickCount = (map: Map<string, number>, id: string, name: string) =>
      map.get(id) ?? map.get(name) ?? 0;

    for (const st of states as any[]) {
      const stateId = String(st._id);
      const stateName = String(st.name || stateId);
      rows.push([
        stateName,
        pickCount(registerMap, stateId, stateName),
        pickCount(enrolledMap, stateId, stateName),
        pickCount(ratedMap, stateId, stateName),
      ]);
    }

    return { labels, rows };
  }

  async loadInertCompanies(query: Record<string, any>): Promise<InertCompaniesData> {
    const currentYear = this.resolveYear(query);
    const carryYear = currentYear - 1;

    const [
      yearlyRegisteredCurrent,
      yearlyRegisteredCarry,
      yearlyEnrolledCurrent,
      yearlyEnrolledCarry,
      notRatedCarry,
      notRatedCurrent,
      notCloseCurrent,
      notCloseCarry,
      stalledCarry,
      stalledCurrent,
    ] = await Promise.all([
      this.companyModel.countDocuments({
        ...activeCompanyFilter(),
        $expr: yearMatchExpr(currentYear),
        ...notDeletedCompanyFilter(),
      }),
      this.companyModel.countDocuments({
        ...activeCompanyFilter(),
        $expr: yearMatchExpr(carryYear),
        ...notDeletedCompanyFilter(),
      }),
      this.countEnrolledCompanies(currentYear),
      this.countEnrolledCompanies(carryYear),
      this.countProjectsByStatus(1),
      this.countProjectsByStatus(0),
      this.countRatedCompaniesByRegistrationYear(currentYear),
      this.countRatedCompaniesByRegistrationYear(carryYear),
      this.countStalled(carryYear, currentYear),
      this.countStalled(currentYear, currentYear),
    ]);

    const notEnrolledCarry = Math.max(0, yearlyRegisteredCarry - yearlyEnrolledCarry);
    const notEnrolledCurrent = Math.max(
      0,
      yearlyRegisteredCurrent - yearlyEnrolledCurrent,
    );

    const chart = await this.buildStateWiseChart(currentYear);

    return {
      tab: 'inert_companies',
      pageTitle: 'Dashboard',
      selected_year: currentYear,
      carry_year: carryYear,
      not_enrolled_only_registered: {
        carry: notEnrolledCarry,
        current: notEnrolledCurrent,
        total: notEnrolledCarry + notEnrolledCurrent,
      },
      not_rated_only_enrolled: {
        carry: notRatedCarry,
        current: notRatedCurrent,
        total: notRatedCarry + notRatedCurrent,
      },
      not_close_project_only_rated: {
        carry: notCloseCarry,
        current: notCloseCurrent,
        total: notCloseCarry + notCloseCurrent,
      },
      stalled: {
        carry: stalledCarry,
        current: stalledCurrent,
        total: stalledCarry + stalledCurrent,
      },
      chart,
    };
  }

  /** Blade-compatible flat keys + chartState for Chart.js. */
  private toPhpCompatiblePayload(data: InertCompaniesData): Record<string, unknown> {
    const chartState: Array<Array<string | number>> = [
      data.chart.labels,
      ...data.chart.rows,
    ];
    return {
      ...data,
      tab: data.tab,
      pageTitle: data.pageTitle,
      selected_year: data.selected_year,
      not_enrolled_only_registered_carry: data.not_enrolled_only_registered.carry,
      not_enrolled_only_registered_current: data.not_enrolled_only_registered.current,
      total_not_enrolled_only_registered: data.not_enrolled_only_registered.total,
      not_rated_only_enrolled_carry: data.not_rated_only_enrolled.carry,
      not_rated_only_enrolled_current: data.not_rated_only_enrolled.current,
      total_not_rated_only_enrolled: data.not_rated_only_enrolled.total,
      not_close_project_only_rated_carry: data.not_close_project_only_rated.carry,
      not_close_project_only_rated_current: data.not_close_project_only_rated.current,
      total_not_close_project_only_rated: data.not_close_project_only_rated.total,
      stalled_carry: data.stalled.carry,
      stalled_current: data.stalled.current,
      total_stalled: data.stalled.total,
      chartState,
    };
  }

  async getInertCompaniesDashboard(query: Record<string, any>): Promise<{
    status: string;
    message: string;
    data: Record<string, unknown>;
  }> {
    const core = await this.loadInertCompanies(query);
    return {
      status: 'success',
      message: 'Inert Companies dashboard data',
      data: {
        ...this.toPhpCompatiblePayload(core),
        last_refreshed_at: new Date().toISOString(),
      },
    };
  }
}
