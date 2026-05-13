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
}
