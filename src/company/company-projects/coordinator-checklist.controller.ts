import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { EnhancedFeaturesService } from './enhanced-features.service';

@Controller()
export class CoordinatorChecklistController {
  constructor(private readonly enhancedFeaturesService: EnhancedFeaturesService) {}

  @Get('api/coordinator/:coordinatorId/assigned-projects')
  @UseGuards(AdminJwtAuthGuard)
  async getAssignedProjects(@Param('coordinatorId') coordinatorId: string) {
    return this.enhancedFeaturesService.getCoordinatorAssignedProjects(coordinatorId);
  }

  @Post('api/coordinator/:coordinatorId/projects/:projectId/verify-checklist')
  @UseGuards(AdminJwtAuthGuard)
  async confirmChecklistVerification(
    @Param('coordinatorId') coordinatorId: string,
    @Param('projectId') projectId: string,
    @Body() body: { remarks?: string },
  ) {
    return this.enhancedFeaturesService.confirmChecklistVerification(
      coordinatorId,
      projectId,
      body.remarks,
    );
  }

  @Get('api/admin/projects/:projectId/checklist-verification-status')
  @UseGuards(AdminJwtAuthGuard)
  async getChecklistVerificationStatus(@Param('projectId') projectId: string) {
    return this.enhancedFeaturesService.getChecklistVerificationStatus(projectId);
  }
}
