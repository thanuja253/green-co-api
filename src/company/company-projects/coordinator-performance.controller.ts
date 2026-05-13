import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CompanyProjectsService } from './company-projects.service';

@Controller()
export class CoordinatorPerformanceController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  @Get('api/admin/coordinator-performance/dashboard')
  async getAdminCoordinatorPerformanceDashboard(@Query() query: Record<string, any>): Promise<any> {
    return this.companyProjectsService.getCoordinatorPerformanceDashboard(query, {
      role: 'admin',
    });
  }

  @Get('api/coordinator/coordinator-performance/dashboard')
  async getCoordinatorPerformanceDashboard(
    @Req() req: Request,
    @Query() query: Record<string, any>,
  ): Promise<any> {
    const tokenCoordinatorId =
      (req as any)?.user?.coordinatorId ||
      (req as any)?.user?.coordinator_id ||
      (req as any)?.user?.id;
    return this.companyProjectsService.getCoordinatorPerformanceDashboard(query, {
      role: 'coordinator',
      tokenCoordinatorId: tokenCoordinatorId ? String(tokenCoordinatorId) : undefined,
    });
  }

  @Patch('api/coordinator/projects/:projectId/remarks')
  async updateCoordinatorProjectRemarks(
    @Param('projectId') projectId: string,
    @Body() body: Record<string, any>,
  ): Promise<any> {
    return this.companyProjectsService.updateCoordinatorProjectRemarks(
      projectId,
      body?.remarks,
    );
  }

  @Post('api/coordinator/projects/:projectId/target-dates')
  async createCoordinatorProjectTargetDates(
    @Param('projectId') projectId: string,
    @Body() body: Record<string, any>,
  ): Promise<any> {
    return this.companyProjectsService.createCoordinatorProjectTargetDates(
      projectId,
      body,
    );
  }

  @Post('api/admin/coordinator-performance/year-freeze')
  async freezeCoordinatorPerformanceYear(
    @Body() body: Record<string, any>,
  ): Promise<any> {
    const year = String(body?.year || '').trim();
    const freezeDate = String(body?.freeze_date || '').trim();
    if (!year || !freezeDate) {
      throw new BadRequestException({
        status: 'error',
        message: 'year and freeze_date are required.',
      });
    }
    return this.companyProjectsService.freezeCoordinatorPerformanceYear(year, freezeDate);
  }
}
