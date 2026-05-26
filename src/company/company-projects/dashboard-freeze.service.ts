import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DashboardSnapshot, DashboardSnapshotDocument } from '../schemas/dashboard-snapshot.schema';
import { CompanyProject, CompanyProjectDocument } from '../schemas/company-project.schema';
import { CompanyActivity, CompanyActivityDocument } from '../schemas/company-activity.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CompanyInvoice, CompanyInvoiceDocument } from '../schemas/company-invoice.schema';
import { AdminGreencoDashboardService } from './admin-greenco-dashboard.service';

@Injectable()
export class DashboardFreezeService {
  private readonly logger = new Logger(DashboardFreezeService.name);

  constructor(
    @InjectModel(DashboardSnapshot.name) private readonly snapshotModel: Model<DashboardSnapshotDocument>,
    @InjectModel(CompanyProject.name) private readonly projectModel: Model<CompanyProjectDocument>,
    @InjectModel(CompanyActivity.name) private readonly activityModel: Model<CompanyActivityDocument>,
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyInvoice.name) private readonly invoiceModel: Model<CompanyInvoiceDocument>,
    private readonly dashboardService: AdminGreencoDashboardService,
  ) {}

  @Cron('0 0 1 1 *')
  async handleYearEndAutoFreeze() {
    const previousYear = new Date().getFullYear() - 1;
    const alreadyFrozen = await this.isDashboardFrozen(previousYear);
    if (alreadyFrozen) {
      this.logger.log(`Year-end auto-freeze: ${previousYear} already frozen, skipping.`);
      return;
    }

    this.logger.log(`Year-end auto-freeze: freezing dashboard for ${previousYear}...`);
    try {
      await this.freezeDashboard(
        previousYear,
        { sub: 'system', name: 'Auto Year-End Freeze' },
        `Automatic freeze triggered on Jan 1 ${previousYear + 1}`,
      );
      this.logger.log(`Year-end auto-freeze: ${previousYear} frozen successfully.`);
    } catch (err) {
      this.logger.error(`Year-end auto-freeze failed for ${previousYear}:`, err);
    }
  }

  async freezeDashboard(
    year: number,
    adminInfo: { sub?: string; name?: string },
    notes?: string,
  ) {
    const existing = await this.snapshotModel.findOne({ year });
    if (existing?.is_frozen) {
      throw new BadRequestException(`Dashboard for year ${year} is already frozen`);
    }

    const metricsResult = await this.dashboardService.getGreencoStatusDashboard({ year: String(year) });
    const metrics = metricsResult.data || {};

    const carryoverProjects = await this.findCarryoverProjects(year);

    const commonFields = {
      is_frozen: true,
      freeze_date: new Date(),
      metrics,
      carryover_project_ids: carryoverProjects,
      frozen_by: adminInfo.sub || 'admin',
      frozen_by_name: adminInfo.name || 'Admin',
      notes: notes || '',
    };

    const snapshot = existing
      ? await this.snapshotModel.findOneAndUpdate({ year }, { $set: commonFields }, { new: true })
      : await this.snapshotModel.create({ year, ...commonFields });

    return {
      status: 'success',
      message: `Dashboard frozen for year ${year}`,
      data: {
        year,
        is_frozen: true,
        freeze_date: snapshot?.freeze_date ?? new Date(),
        carryover_projects_count: carryoverProjects.length,
        frozen_by_name: snapshot?.frozen_by_name ?? 'Admin',
      },
    };
  }

  async getFrozenDashboard(year: number) {
    const snapshot = await this.snapshotModel.findOne({ year }).lean();
    if (!snapshot) throw new NotFoundException(`No snapshot found for year ${year}`);

    return {
      status: 'success',
      message: `Dashboard snapshot for year ${year}`,
      data: {
        year: snapshot.year,
        is_frozen: snapshot.is_frozen,
        freeze_date: snapshot.freeze_date,
        metrics: snapshot.metrics,
        carryover_project_ids: snapshot.carryover_project_ids,
        frozen_by_name: snapshot.frozen_by_name,
        notes: snapshot.notes,
      },
    };
  }

  async getAvailableYears() {
    const snapshots = await this.snapshotModel
      .find({})
      .select('year is_frozen freeze_date')
      .sort({ year: -1 })
      .lean();

    const currentYear = new Date().getFullYear();
    const years = snapshots.map((s) => ({
      year: s.year,
      is_frozen: s.is_frozen,
      freeze_date: s.freeze_date,
    }));

    const hasCurrentYear = years.some((y) => y.year === currentYear);
    if (!hasCurrentYear) {
      years.unshift({ year: currentYear, is_frozen: false, freeze_date: null as any });
    }

    return {
      status: 'success',
      message: 'Available dashboard years',
      data: { years, current_year: currentYear },
    };
  }

  async isDashboardFrozen(year: number): Promise<boolean> {
    const snapshot = await this.snapshotModel.findOne({ year, is_frozen: true }).lean();
    return !!snapshot;
  }

  private async findCarryoverProjects(year: number): Promise<string[]> {
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const incompleteActivities = await this.activityModel.aggregate([
      {
        $match: {
          project_id: { $exists: true, $ne: null },
          milestone_flow: { $exists: true, $lt: 15 },
          createdAt: { $lte: yearEnd },
        },
      },
      {
        $group: {
          _id: '$project_id',
          max_milestone: { $max: '$milestone_flow' },
        },
      },
      {
        $match: {
          max_milestone: { $lt: 15 },
        },
      },
    ]);

    return incompleteActivities.map((r: any) => String(r._id));
  }
}
