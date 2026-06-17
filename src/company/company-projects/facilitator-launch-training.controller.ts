import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CompanyProjectsService } from './company-projects.service';
import { UploadLaunchAndTrainingDto } from './dto/upload-launch-and-training.dto';
import {
  LaunchTrainingSessionFiles,
  launchTrainingLegacyDocumentUploadInterceptor,
  launchTrainingSessionUploadInterceptor,
} from './launch-training-session-upload.config';
import { pickLaunchTrainingS3KeyFromBody } from '../../s3/project-document-storage.util';
import { FacilitatorJwtAuthGuard } from '../facilitator-auth/guards/facilitator-jwt-auth.guard';
import { FacilitatorAccountStatusGuard } from '../facilitator-auth/guards/facilitator-account-status.guard';

@Controller(['api/facilitator/projects', 'api/facilitators/projects'])
@UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
export class FacilitatorLaunchTrainingController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  @Get(':projectId/launch-and-training')
  async getLaunchAndTraining(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getLaunchAndTrainingByProjectId(projectId);
  }

  @Get(':projectId/launch-training')
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
  async getLaunchTraining(@Request() req, @Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getLaunchTrainingProgramForFacilitator(
      req.user.facilitatorId,
      projectId,
    );
  }

  @Get(':projectId/launch-training-program')
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
  async getLaunchTrainingProgram(@Request() req, @Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getLaunchTrainingProgramForFacilitator(
      req.user.facilitatorId,
      projectId,
    );
  }

  @Post(':projectId/launch-training-sessions')
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
  @UseInterceptors(launchTrainingSessionUploadInterceptor())
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async postLaunchTrainingSessions(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: UploadLaunchAndTrainingDto,
    @UploadedFiles() files?: LaunchTrainingSessionFiles,
  ): Promise<any> {
    const file =
      files?.launch_session_file?.[0] ||
      files?.file?.[0] ||
      files?.document?.[0] ||
      files?.document_file?.[0] ||
      files?.upload?.[0] ||
      files?.launch_upload?.[0];
    const body = dto as Record<string, unknown>;
    if (!file && !pickLaunchTrainingS3KeyFromBody(body)) {
      throw new BadRequestException({
        status: 'error',
        message:
          'No file uploaded. Use multipart field launch_session_file, file, document, document_file, upload, or launch_upload (PDF or image, max 10MB), or provide launch_session_file_s3_key / s3_key after presigned upload.',
      });
    }
    return this.companyProjectsService.addLaunchTrainingSessionForFacilitator(
      req.user.facilitatorId,
      projectId,
      file,
      dto.session_date || dto.launch_training_report_date,
      body,
    );
  }

  @Post(':projectId/launch-training')
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
  @UseInterceptors(launchTrainingSessionUploadInterceptor())
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async postLaunchTraining(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: UploadLaunchAndTrainingDto,
    @UploadedFiles() files?: LaunchTrainingSessionFiles,
  ): Promise<any> {
    const file =
      files?.launch_session_file?.[0] ||
      files?.file?.[0] ||
      files?.document?.[0] ||
      files?.document_file?.[0] ||
      files?.upload?.[0] ||
      files?.launch_upload?.[0];
    const body = dto as Record<string, unknown>;
    if (!file && !pickLaunchTrainingS3KeyFromBody(body)) {
      throw new BadRequestException({
        status: 'error',
        message:
          'No file uploaded. Use multipart field launch_session_file, file, document, document_file, upload, or launch_upload (PDF or image, max 10MB), or provide launch_session_file_s3_key / s3_key after presigned upload.',
      });
    }
    return this.companyProjectsService.addLaunchTrainingSessionForFacilitator(
      req.user.facilitatorId,
      projectId,
      file,
      dto.session_date || dto.launch_training_report_date,
      body,
    );
  }

  @Post(':projectId/launch-and-training-document')
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
  @UseInterceptors(launchTrainingLegacyDocumentUploadInterceptor())
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async uploadLaunchAndTrainingDocument(
    @Request() req,
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadLaunchAndTrainingDto,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Please select a PDF file (launch_upload).',
      });
    }
    return this.companyProjectsService.uploadLaunchAndTrainingForFacilitator(
      req.user.facilitatorId,
      projectId,
      file,
      dto.launch_training_report_date,
    );
  }
}

