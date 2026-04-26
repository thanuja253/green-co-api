import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CompanyProjectsService } from './company-projects.service';
import { AssessorJwtAuthGuard } from '../assessor-auth/guards/assessor-jwt-auth.guard';
import { AssessorAccountStatusGuard } from '../assessor-auth/guards/assessor-account-status.guard';
import { Response } from 'express';

@Controller()
export class AssessorCompanyProjectsController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  /**
   * Assessor portal quickview (assessor-token compatible).
   */
  @Get('api/assessors/projects/:projectId/quickview')
  @Get('assessors/projects/:projectId/quickview')
  @Get('api/assessor/projects/:projectId/quickview')
  @Get('assessor/projects/:projectId/quickview')
  async getAssessorQuickview(
    @Request() req: { user?: { assessorId?: string } },
    @Param('projectId') projectId: string,
  ): Promise<any> {
    const assessorId = String(req?.user?.assessorId || '').trim();
    if (assessorId) {
      return this.companyProjectsService.getQuickviewDataForAssessor(assessorId, projectId);
    }
    return this.companyProjectsService.getQuickviewDataPublicByProject(projectId);
  }

  /**
   * Export final scoring CSV from assessor portal (legacy-compatible path aliases).
   */
  @Get('api/assessors/download_final_scoring/:projectId')
  @Get('assessors/download_final_scoring/:projectId')
  @Get('api/assessor/download_final_scoring/:projectId')
  @Get('assessor/download_final_scoring/:projectId')
  async downloadFinalScoringForAssessor(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    const exported = await this.companyProjectsService.downloadFinalScoringForAdmin(projectId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  /**
   * Assessor score save (draft/update) compatibility API.
   */
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  @Post('api/assessor/update_assessor_score/:projectId')
  @Post('assessor/update_assessor_score/:projectId')
  @Post('api/assessors/update_assessor_score/:projectId')
  @Post('assessors/update_assessor_score/:projectId')
  @Post('api/assessor/update_assessor_score')
  @Post('assessor/update_assessor_score')
  @Post('api/assessors/update_assessor_score')
  @Post('assessors/update_assessor_score')
  async updateAssessorScore(
    @Request() req: { user?: { assessorId?: string } },
    @Param('projectId') projectId: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<any> {
    const assessorId = String(req?.user?.assessorId || '').trim();
    let projectIdFromBody = '';
    if (typeof body?.project_id === 'string' || typeof body?.project_id === 'number') {
      projectIdFromBody = String(body.project_id);
    } else if (typeof body?.projectId === 'string' || typeof body?.projectId === 'number') {
      projectIdFromBody = String(body.projectId);
    }
    const resolvedProjectId = String(projectId || projectIdFromBody).trim();
    return this.companyProjectsService.updateAssessorScore(
      assessorId,
      resolvedProjectId,
      body as Record<string, any>,
    );
  }

  /**
   * Assessor score final submit compatibility API.
   */
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  @Post('api/assessor/finalsubmit_assessor_score/:projectId')
  @Post('assessor/finalsubmit_assessor_score/:projectId')
  @Post('api/assessors/finalsubmit_assessor_score/:projectId')
  @Post('assessors/finalsubmit_assessor_score/:projectId')
  @Post('api/assessor/finalsubmit_assessor_score')
  @Post('assessor/finalsubmit_assessor_score')
  @Post('api/assessors/finalsubmit_assessor_score')
  @Post('assessors/finalsubmit_assessor_score')
  async finalSubmitAssessorScore(
    @Request() req: { user?: { assessorId?: string } },
    @Param('projectId') projectId: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<any> {
    const assessorId = String(req?.user?.assessorId || '').trim();
    let projectIdFromBody = '';
    if (typeof body?.project_id === 'string' || typeof body?.project_id === 'number') {
      projectIdFromBody = String(body.project_id);
    } else if (typeof body?.projectId === 'string' || typeof body?.projectId === 'number') {
      projectIdFromBody = String(body.projectId);
    }
    const resolvedProjectId = String(projectId || projectIdFromBody).trim();
    return this.companyProjectsService.finalSubmitAssessorScore(
      assessorId,
      resolvedProjectId,
      body as Record<string, any>,
    );
  }
}

