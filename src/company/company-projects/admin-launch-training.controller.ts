import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CompanyProjectsService } from './company-projects.service';
import { UploadLaunchAndTrainingDto } from './dto/upload-launch-and-training.dto';
import {
  LaunchTrainingSessionFiles,
  addLaunchTrainingSessionFromMultipart,
  launchTrainingSessionUploadInterceptor,
} from './launch-training-session-upload.config';

/**
 * Admin Launch & Training — GET + POST under one controller prefix.
 *
 * Base path: `/api/admin/projects` — short `@Get` / `@Post` segments avoid fragile full-path metadata on `@Controller()`.
 * `main.ts` rewrites `/admin/projects/*` → `/api/admin/projects/*`.
 *
 * Company API aliases live on `CompanyProjectsController` (`/api/company/projects/.../launch-training`).
 */
@Controller('api/admin/projects')
export class AdminLaunchTrainingController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  @Get(':projectId/launch-training')
  async getLaunchTraining(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getLaunchTrainingProgramForAdmin(projectId);
  }

  @Get(':projectId/launch-training-program')
  async getLaunchTrainingProgram(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getLaunchTrainingProgramForAdmin(projectId);
  }

  @Post(':projectId/launch-training-sessions')
  @UseInterceptors(launchTrainingSessionUploadInterceptor())
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async postLaunchTrainingSessions(
    @Param('projectId') projectId: string,
    @Body() dto: UploadLaunchAndTrainingDto,
    @UploadedFiles() files?: LaunchTrainingSessionFiles,
  ): Promise<any> {
    return addLaunchTrainingSessionFromMultipart(
      this.companyProjectsService,
      projectId,
      dto,
      files,
    );
  }

  @Post(':projectId/launch-training')
  @UseInterceptors(launchTrainingSessionUploadInterceptor())
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async postLaunchTraining(
    @Param('projectId') projectId: string,
    @Body() dto: UploadLaunchAndTrainingDto,
    @UploadedFiles() files?: LaunchTrainingSessionFiles,
  ): Promise<any> {
    return addLaunchTrainingSessionFromMultipart(
      this.companyProjectsService,
      projectId,
      dto,
      files,
    );
  }
}
