import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CompanyProjectsService } from './company-projects.service';
import { AdminJwtAuthGuard } from '../../admin/admin-auth/guards/admin-jwt-auth.guard';

/**
 * Admin dashboard routes under `/api/admin/projects` (and legacy `/admin/projects` for proxies).
 */
@Controller(['api/admin/projects', 'admin/projects'])
export class AdminProjectsController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  /**
   * GET /api/admin/projects/:projectId/launch-training-program
   * Legacy: GET /admin/projects/:projectId/launch-training-program
   *
   * Reads all Launch & Training session uploads plus legacy single-document fields.
   * `:projectId` may be project Mongo _id or company _id (resolved to latest project).
   */
  @Get(':projectId/launch-training-program')
  @UseGuards(AdminJwtAuthGuard)
  async getLaunchTrainingProgram(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getLaunchTrainingProgramForAdmin(projectId);
  }
}
