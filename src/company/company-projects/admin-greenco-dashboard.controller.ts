import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { AdminGreencoDashboardService } from './admin-greenco-dashboard.service';

/**
 * JSON equivalent of Laravel `GET /admin/dashboard` (Greenco Status tab).
 * Query: `year` or `selectedYear` (optional).
 */
@Controller()
@UseGuards(AdminJwtAuthGuard)
export class AdminGreencoDashboardController {
  constructor(private readonly greencoDashboard: AdminGreencoDashboardService) {}

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
}
