import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import type { Request } from 'express';
import { JwtAuthGuard } from '../company-auth/guards/jwt-auth.guard';
import { AccountStatusGuard } from '../company-auth/guards/account-status.guard';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { AssessmentChecklistDocumentsService } from './assessment-checklist-documents.service';

@Controller()
export class AssessmentChecklistDocumentsController {
  constructor(private readonly docsService: AssessmentChecklistDocumentsService) {}

  /**
   * Company: list checklist docs for project (optionally filter by criteria_id)
   * GET /api/company/projects/:projectId/assessment-checklist-documents?criteria_id=...
   * GET /api/companies/projects/:projectId/assessment-checklist-documents?criteria_id=... (alias)
   */
  @Get('api/company/projects/:projectId/assessment-checklist-documents')
  async listCompany(
    @Param('projectId') projectId: string,
    @Query('criteria_id') criteriaId?: string,
  ) {
    return this.docsService.listForProject(projectId, criteriaId);
  }

  @Get('api/companies/projects/:projectId/assessment-checklist-documents')
  async listCompanyAlias(
    @Param('projectId') projectId: string,
    @Query('criteria_id') criteriaId?: string,
  ) {
    return this.docsService.listForProject(projectId, criteriaId);
  }

  /**
   * Company: upload checklist doc (Pending until admin approves)
   * POST /api/company/projects/:projectId/assessment-checklist-documents
   * POST /api/companies/projects/:projectId/assessment-checklist-documents (alias)
   * multipart: document(file), title(string), sector_id(string), criteria_id(string)
   */
  @Post('api/company/projects/:projectId/assessment-checklist-documents')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileInterceptor('document', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const pid = (req as any).params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'companyproject', 'assessmentChecklist', pid);
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `checklist-${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
        ];
        if (!allowed.includes(file.mimetype)) {
          cb(new Error('Only PDF/PNG/JPG/JPEG are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async uploadCompany(
    @Req() req: Request & { user: { userId: string } },
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (!file) {
      return { status: 'error', message: 'No file uploaded. Field name must be document.' };
    }
    const title = String(body?.title || '').trim();
    const sectorId = String(body?.sector_id || body?.sectorId || '').trim();
    const criteriaId = String(body?.criteria_id || body?.criteriaId || '').trim();
    return this.docsService.uploadForProject({
      projectId,
      sectorId,
      criteriaId,
      title,
      documentPath: `uploads/companyproject/assessmentChecklist/${projectId}/${file.filename}`,
      uploadedByRole: 'COMPANY',
      uploadedById: req.user.userId,
    });
  }

  @Post('api/companies/projects/:projectId/assessment-checklist-documents')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileInterceptor('document', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const pid = (req as any).params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'companyproject', 'assessmentChecklist', pid);
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `checklist-${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
        ];
        if (!allowed.includes(file.mimetype)) {
          cb(new Error('Only PDF/PNG/JPG/JPEG are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async uploadCompanyAlias(
    @Req() req: Request & { user: { userId: string } },
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (!file) {
      return { status: 'error', message: 'No file uploaded. Field name must be document.' };
    }
    const title = String(body?.title || '').trim();
    const sectorId = String(body?.sector_id || body?.sectorId || '').trim();
    const criteriaId = String(body?.criteria_id || body?.criteriaId || '').trim();
    return this.docsService.uploadForProject({
      projectId,
      sectorId,
      criteriaId,
      title,
      documentPath: `uploads/companyproject/assessmentChecklist/${projectId}/${file.filename}`,
      uploadedByRole: 'COMPANY',
      uploadedById: req.user.userId,
    });
  }

  /**
   * Admin: list checklist docs for project (review)
   * GET /api/admin/projects/:projectId/assessment-checklist-documents?status=Pending|Approved|Rejected&criteria_id=...
   */
  @Get('api/admin/projects/:projectId/assessment-checklist-documents')
  @UseGuards(AdminJwtAuthGuard)
  async listAdmin(
    @Param('projectId') projectId: string,
    @Query('criteria_id') criteriaId?: string,
  ) {
    // status filtering can be done client-side from returned rows (kept simple)
    return this.docsService.listForProject(projectId, criteriaId);
  }

  /**
   * Admin: approve/reject checklist doc
   * PATCH /api/admin/assessment-checklist-documents/:documentId/status
   * body: { status: "Approved"|"Rejected", remarks?: string }
   */
  @Patch('api/admin/assessment-checklist-documents/:documentId/status')
  @UseGuards(AdminJwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateStatus(
    @Req() req: any,
    @Param('documentId') documentId: string,
    @Body() body: any,
  ) {
    const status = String(body?.status || '').trim();
    if (!['Approved', 'Rejected'].includes(status)) {
      return { status: 'error', message: 'status must be Approved or Rejected' };
    }
    const remarks = String(body?.remarks || body?.document_remarks || '').trim();
    return this.docsService.updateStatus(
      documentId,
      status as any,
      remarks,
      req.user?.userId,
    );
  }
}

