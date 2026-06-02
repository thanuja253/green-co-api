import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChecklistVersioningService } from './checklist-versioning.service';
import { CreateGroupChecklistVersionDto } from './dto/create-group-checklist-version.dto';
import { UpdateGroupChecklistVersionDto } from './dto/update-group-checklist-version.dto';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';

@Controller()
@UseGuards(AdminJwtAuthGuard)
export class ChecklistVersioningController {
  constructor(private readonly checklistVersioningService: ChecklistVersioningService) {}

  // ── Group checklist versions (SOW admin module) ──

  @Get('api/admin/groups/:groupId/checklist-versions')
  @Get('admin/groups/:groupId/checklist-versions')
  async listVersions(@Param('groupId') groupId: string) {
    return this.checklistVersioningService.listVersionsForGroup(groupId);
  }

  @Get('api/admin/groups/:groupId/checklist-versions/active')
  @Get('admin/groups/:groupId/checklist-versions/active')
  async getActive(@Param('groupId') groupId: string) {
    return this.checklistVersioningService.getActiveVersionForGroup(groupId);
  }

  @Get('api/admin/groups/:groupId/checklist-versions/:versionId')
  @Get('admin/groups/:groupId/checklist-versions/:versionId')
  async getVersion(
    @Param('groupId') groupId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.checklistVersioningService.getVersion(groupId, versionId);
  }

  @Post('api/admin/groups/:groupId/checklist-versions')
  @Post('admin/groups/:groupId/checklist-versions')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createVersion(
    @Param('groupId') groupId: string,
    @Body() dto: CreateGroupChecklistVersionDto,
    @Request() req: any,
  ) {
    return this.checklistVersioningService.createVersion(groupId, dto, req.admin);
  }

  @Post('api/admin/groups/:groupId/checklist-versions/:versionId/clone')
  @Post('admin/groups/:groupId/checklist-versions/:versionId/clone')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async cloneVersion(
    @Param('groupId') groupId: string,
    @Param('versionId') versionId: string,
    @Body() dto: CreateGroupChecklistVersionDto,
    @Request() req: any,
  ) {
    return this.checklistVersioningService.cloneVersion(groupId, versionId, dto, req.admin);
  }

  @Patch('api/admin/groups/:groupId/checklist-versions/:versionId')
  @Patch('admin/groups/:groupId/checklist-versions/:versionId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateVersion(
    @Param('groupId') groupId: string,
    @Param('versionId') versionId: string,
    @Body() dto: UpdateGroupChecklistVersionDto,
  ) {
    return this.checklistVersioningService.updateVersion(groupId, versionId, dto);
  }

  @Post('api/admin/groups/:groupId/checklist-versions/:versionId/activate')
  @Post('admin/groups/:groupId/checklist-versions/:versionId/activate')
  async activateVersion(
    @Param('groupId') groupId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.checklistVersioningService.activateVersion(groupId, versionId);
  }

  @Post('api/admin/groups/:groupId/checklist-versions/:versionId/archive')
  @Post('admin/groups/:groupId/checklist-versions/:versionId/archive')
  async archiveVersion(
    @Param('groupId') groupId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.checklistVersioningService.archiveVersion(groupId, versionId);
  }

  @Post('api/admin/groups/:groupId/checklist-versions/:versionId/checklist-document')
  @Post('admin/groups/:groupId/checklist-versions/:versionId/checklist-document')
  @UseInterceptors(
    FileInterceptor('checklist_document', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadChecklistDocument(
    @Param('groupId') groupId: string,
    @Param('versionId') versionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { checklist_document?: string },
  ) {
    const relativePath = file
      ? `uploads/groups/versions/${groupId}/${versionId}-${Date.now()}-${file.originalname}`
      : body?.checklist_document;
    if (!relativePath) {
      return {
        status: 'error',
        message: 'Provide multipart checklist_document or body.checklist_document path',
      };
    }
    if (file?.buffer) {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const full = path.join(process.cwd(), relativePath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, file.buffer);
    }
    return this.checklistVersioningService.updateVersion(groupId, versionId, {
      checklist_document: relativePath,
    });
  }

  @Get('api/admin/groups/:groupId/checklist-versions/:versionId/parameters')
  @Get('admin/groups/:groupId/checklist-versions/:versionId/parameters')
  async listVersionParameters(
    @Param('groupId') groupId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.checklistVersioningService.listVersionParameters(groupId, versionId);
  }

  @Get('api/admin/groups/:groupId/checklist-versions/:versionId/credits')
  @Get('admin/groups/:groupId/checklist-versions/:versionId/credits')
  async listVersionCredits(
    @Param('groupId') groupId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.checklistVersioningService.listVersionCredits(groupId, versionId);
  }

  // ── Project version assignment ──

  @Get('api/admin/projects/:projectId/checklist-version')
  @Get('admin/projects/:projectId/checklist-version')
  async getProjectVersion(@Param('projectId') projectId: string) {
    return this.checklistVersioningService.getProjectChecklistVersion(projectId);
  }

  @Post('api/admin/projects/:projectId/checklist-version/pin')
  @Post('admin/projects/:projectId/checklist-version/pin')
  async pinProjectVersion(
    @Param('projectId') projectId: string,
    @Query('force') force?: string,
  ) {
    return this.checklistVersioningService.pinActiveVersionToProject(
      projectId,
      force === '1' || force === 'true',
    );
  }

  // ── Migration (run once after deploy) ──

  @Post('api/admin/checklist-versions/migrate/backfill')
  @Post('admin/checklist-versions/migrate/backfill')
  async backfill() {
    return this.checklistVersioningService.runBackfillMigration();
  }

  // ── Legacy compatibility (existing enhanced-features paths) ──

  @Get('api/admin/checklist-versions')
  async listLegacy(@Query('checklist_id') checklistId: string) {
    if (!checklistId) {
      return { status: 'error', message: 'checklist_id or groupId query is required' };
    }
    return this.checklistVersioningService.listVersionsForGroup(checklistId);
  }
}
