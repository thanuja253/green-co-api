import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { AdminGreencoDashboardService } from './admin-greenco-dashboard.service';
import { AdminInertCompaniesService } from './admin-inert-companies.service';
import { AdminAssessorFacilitatorDashboardService } from './admin-assessor-facilitator-dashboard.service';

/**
 * JSON equivalent of Laravel `GET /admin/dashboard` (Greenco Status tab).
 * Query: `year` or `selectedYear` (optional).
 */
@Controller()
@UseGuards(AdminJwtAuthGuard)
export class AdminGreencoDashboardController {
  constructor(
    private readonly greencoDashboard: AdminGreencoDashboardService,
    private readonly inertCompaniesDashboard: AdminInertCompaniesService,
    private readonly assessorFacilitatorDashboard: AdminAssessorFacilitatorDashboardService,
  ) {}

  @Get('api/admin/dashboard')
  @Get('admin/dashboard')
  async greencoStatus(@Query() query: Record<string, string>) {
    return this.greencoDashboard.getGreencoStatusDashboard(query);
  }

  @Get('api/admin/dashboard/summary')
  async summary(@Query() query: Record<string, any>) {
    return this.greencoDashboard.getDashboardSummary(query);
  }

  /** Top 4 registration cards only — PHP DashboardController@index row 1. */
  @Get('api/admin/dashboard/registration-summary')
  async registrationSummary(@Query() query: Record<string, any>) {
    return this.greencoDashboard.getRegistrationSummary(query);
  }

  /** Second row: Enrolled / Only registered / Rated — PHP DashboardController@index row 2. */
  @Get('api/admin/dashboard/enrollment-summary')
  async enrollmentSummary(@Query() query: Record<string, any>) {
    return this.greencoDashboard.getEnrollmentSummary(query);
  }

  @Get('api/admin/dashboard/growth-trends')
  async growthTrends(@Query() query: Record<string, any>) {
    return this.greencoDashboard.getGrowthTrends(query);
  }

  @Get('api/admin/dashboard/certification-distribution')
  async certificationDistribution(@Query() query: Record<string, any>) {
    return this.greencoDashboard.getCertificationDistribution(query);
  }

  @Get('api/admin/dashboard/pipeline-by-stage')
  async pipelineByStage(@Query() query: Record<string, any>) {
    return this.greencoDashboard.getPipelineByStage(query);
  }

  @Get('api/admin/dashboard/company-status-overview')
  async companyStatusOverview(@Query() query: Record<string, any>) {
    return this.greencoDashboard.getCompanyStatusOverview(query);
  }

  @Get('api/admin/dashboard/recent-activity')
  async recentActivity(@Query() query: Record<string, any>) {
    return this.greencoDashboard.getRecentActivity(query);
  }

  /**
   * Laravel `GET /admin/inert_companies?year=` — KPI cards + state-wise chart.
   */
  @Get('api/admin/dashboard/inert-companies')
  @Get('admin/dashboard/inert-companies')
  async inertCompanies(@Query() query: Record<string, any>) {
    return this.inertCompaniesDashboard.getInertCompaniesDashboard(query);
  }

  /**
   * Laravel `GET /admin/assessorAndFacilitator?year=` — facilitator/assessor/WO/launch/coordinator stats.
   */
  @Get('api/admin/dashboard/assessor-facilitator')
  @Get('admin/dashboard/assessor-facilitator')
  async assessorFacilitator(@Query() query: Record<string, any>) {
    return this.assessorFacilitatorDashboard.getAssessorFacilitatorDashboard(query);
  }
}
