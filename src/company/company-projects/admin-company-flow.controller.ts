import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { Request, Response } from 'express';
import { CompanyProjectsService } from './company-projects.service';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { AdminAssignAssessorDto } from './dto/admin-assign-assessor.dto';
import { AdminPaymentStatusDto } from './dto/admin-payment-status.dto';
import { CreateAssessorDto } from './dto/create-assessor.dto';
import { CreateAssessorProfileDto } from './dto/create-assessor-profile.dto';
import { ListAssessorsQueryDto } from './dto/list-assessors-query.dto';
import { UpdateAssessorApprovalDto } from './dto/update-assessor-approval.dto';
import { UpdateAssessorDocumentApprovalDto } from './dto/update-assessor-document-approval.dto';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { AssignFacilitatorDto } from './dto/assign-facilitator.dto';
import { CreateCoordinatorDto } from './dto/create-coordinator.dto';
import { UpdateCoordinatorDto } from './dto/update-coordinator.dto';
import { UpsertPlaqueDetailsDto } from './dto/upsert-plaque-details.dto';
import { UpsertOutstandingDetailsDto } from './dto/upsert-outstanding-details.dto';
import { OutstandingDuePaymentDto } from './dto/outstanding-due-payment.dto';
import { ScoreBandStatusDto } from './dto/score-band-status.dto';
import {
  REGISTRATION_INFO_FILE_FIELDS,
  createRegistrationInfoValidationPipe,
  parseRegistrationMultipartBody,
  registrationInfoMulterOptions,
} from './registration-info-upload.config';

@Controller()
export class AdminCompanyFlowController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  @Get('api/admin/projects/:projectId/registration-data')
  @Get('admin/projects/:projectId/registration-data')
  async getProjectRegistrationDataForAdmin(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getRegistrationInfoForAdmin(projectId);
  }

  @Get('api/admin/projects/:projectId/registration-files/:fileType')
  @Get('admin/projects/:projectId/registration-files/:fileType')
  async getProjectRegistrationFileForAdmin(
    @Param('projectId') projectId: string,
    @Param('fileType') fileType: string,
    @Res() res: Response,
  ): Promise<void> {
    const download = await this.companyProjectsService.getRegistrationFileDownloadForAdmin(
      projectId,
      fileType,
    );
    await this.companyProjectsService.streamRegistrationFileToResponse(res, download);
  }

  @Put('api/admin/projects/:projectId/registration-data')
  @Patch('api/admin/projects/:projectId/registration-data')
  @Put('admin/projects/:projectId/registration-data')
  @Patch('admin/projects/:projectId/registration-data')
  @UseInterceptors(
    FileFieldsInterceptor(REGISTRATION_INFO_FILE_FIELDS, registrationInfoMulterOptions),
  )
  @UsePipes(createRegistrationInfoValidationPipe())
  async updateProjectRegistrationDataForAdmin(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body() body: any,
    @UploadedFiles() files?: {
      company_brief_profile?: Express.Multer.File[];
      brief_profile?: Express.Multer.File[];
      turnover_document?: Express.Multer.File[];
      turnover?: Express.Multer.File[];
      sez_document?: Express.Multer.File[];
      sezDocument?: Express.Multer.File[];
      sez_input?: Express.Multer.File[];
      sezinput?: Express.Multer.File[];
    },
  ): Promise<any> {
    const reqFiles = (req as any).files;
    const { dto, files: mergedFiles } = parseRegistrationMultipartBody(body, files, reqFiles);
    return this.companyProjectsService.updateRegistrationInfoForAdmin(projectId, dto, mergedFiles);
  }

  @Get([
    'api/admin/projects/:projectId/quickview',
    'admin/projects/:projectId/quickview',
    'api/admin/projects/:projectId/p-details',
    'admin/projects/:projectId/p-details',
    'api/admin/projects/:projectId/p_details',
    'admin/projects/:projectId/p_details',
  ])
  async getQuickviewForAdmin(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getQuickviewDataForAdmin(projectId);
  }

  /**
   * Legacy admin certificate summary compatibility endpoints.
   */
  @Get([
    'api/admin/projects/:projectId/certificate',
    'admin/projects/:projectId/certificate',
    'api/admin/upload_certificate/:projectId',
    'admin/upload_certificate/:projectId',
  ])
  async getCertificateSummaryForAdmin(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getCertificateSummaryByProjectId(projectId);
  }

  /**
   * Legacy/new admin certificate document download compatibility.
   */
  @Get([
    'api/admin/projects/:projectId/certificate-document',
    'admin/projects/:projectId/certificate-document',
    'api/admin/upload_certificate/:projectId/document',
    'admin/upload_certificate/:projectId/document',
  ])
  async getCertificateDocumentForAdmin(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.companyProjectsService.getCertificateDocumentDownloadByProjectId(projectId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.sendFile(file.absolutePath);
  }

  @Get('api/admin/projects/:projectId/assignments')
  @Get('admin/projects/:projectId/assignments')
  async getProjectAssignmentsForAdmin(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getProjectAssignmentsForAdmin(projectId);
  }

  @Post('api/admin/projects/:projectId/assign-coordinator')
  @Post('admin/projects/:projectId/assign-coordinator')
  async assignCoordinatorForAdmin(
    @Param('projectId') projectId: string,
    /** Raw body so arbitrary UI field names (e.g. dropdown label) are not stripped. */
    @Body() body: Record<string, unknown>,
  ): Promise<any> {
    return this.companyProjectsService.assignCoordinatorForAdmin(projectId, body);
  }

  @Delete('api/admin/projects/:projectId/coordinators/:assignmentId')
  @Delete('admin/projects/:projectId/coordinators/:assignmentId')
  async removeCoordinatorForAdmin(
    @Param('projectId') projectId: string,
    @Param('assignmentId') assignmentId: string,
  ): Promise<any> {
    return this.companyProjectsService.removeCoordinatorAssignmentForAdmin(projectId, assignmentId);
  }

  /**
   * Admin compatibility for legacy/new UI that posts to
   * /api/company/projects/:projectId/assign-assessor from admin panel.
   */
  @Post('api/company/projects/:projectId/assign-assessor')
  @Post('company/projects/:projectId/assign-assessor')
  @UseGuards(AdminJwtAuthGuard)
  async assignAssessorViaCompanyPathForAdmin(
    @Param('projectId') projectId: string,
    @Body() body: Record<string, unknown>,
  ): Promise<any> {
    const assessorId = String(body?.assessor_id ?? body?.selectassessor ?? '').trim();
    if (!assessorId) {
      throw new BadRequestException({
        status: 'validations',
        errors: { assessor_id: ['assessor_id is required.'] },
      });
    }

    const rawDates = body?.visit_dates ?? body?.assessor_date;
    let visitDates: string[] | undefined;
    if (Array.isArray(rawDates)) {
      visitDates = rawDates.map((v) => String(v).trim()).filter(Boolean);
    } else if (typeof rawDates === 'string' && rawDates.trim()) {
      visitDates = rawDates
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }

    return this.companyProjectsService.assignAssessorForAdmin(projectId, assessorId, visitDates);
  }

  @Delete('api/company/projects/:projectId/assessors/:assessorId')
  @Delete('company/projects/:projectId/assessors/:assessorId')
  @Delete('api/company/projects/:projectId/remove-assessor/:assessorId')
  @Delete('company/projects/:projectId/remove-assessor/:assessorId')
  @Post('api/company/projects/:projectId/remove-assessor/:assessorId')
  @Post('company/projects/:projectId/remove-assessor/:assessorId')
  @UseGuards(AdminJwtAuthGuard)
  async removeAssessorViaCompanyPathForAdmin(
    @Param('projectId') projectId: string,
    @Param('assessorId') assessorId: string,
  ): Promise<any> {
    return this.companyProjectsService.removeAssessorAssignmentForAdmin(projectId, assessorId);
  }

  @Post('api/admin/projects/:projectId/assign-facilitator')
  @Post('admin/projects/:projectId/assign-facilitator')
  @UseInterceptors(
    FileInterceptor('contract_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const pid = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'facilitator-contracts', pid);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `contract-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PDF and image files are allowed for contract document.'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async assignFacilitatorForAdmin(
    @Param('projectId') projectId: string,
    @Body() dto: AssignFacilitatorDto,
    @UploadedFile() contractDocument?: Express.Multer.File,
  ): Promise<any> {
    return this.companyProjectsService.assignFacilitatorForAdmin(
      projectId,
      dto.facilitator_id,
      dto.contract_fee,
      contractDocument,
    );
  }

  @Delete('api/admin/projects/:projectId/facilitator')
  @Delete('admin/projects/:projectId/facilitator')
  async removeFacilitatorForAdmin(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.removeFacilitatorAssignmentForAdmin(projectId);
  }

  /** Launch & Training GET/POST: `admin-launch-training.controller.ts` */

  /** Master coordinator directory (MongoDB): dropdown uses `label` = "Name - mobile". */
  @Get('api/admin/coordinators')
  @Get('admin/coordinators')
  async listCoordinatorsMaster(): Promise<any> {
    return this.companyProjectsService.listCoordinators();
  }

  @Post('api/admin/coordinators')
  @Post('admin/coordinators')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createCoordinatorMaster(@Body() dto: CreateCoordinatorDto): Promise<any> {
    return this.companyProjectsService.createCoordinatorAdmin(dto);
  }

  @Patch('api/admin/coordinators/:coordinatorId')
  @Patch('admin/coordinators/:coordinatorId')
  @Put('api/admin/coordinators/:coordinatorId')
  @Put('admin/coordinators/:coordinatorId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateCoordinatorMaster(
    @Param('coordinatorId') coordinatorId: string,
    @Body() dto: UpdateCoordinatorDto,
  ): Promise<any> {
    return this.companyProjectsService.updateCoordinatorAdmin(coordinatorId, dto);
  }

  @Delete('api/admin/coordinators/:coordinatorId')
  @Delete('admin/coordinators/:coordinatorId')
  async deactivateCoordinatorMaster(@Param('coordinatorId') coordinatorId: string): Promise<any> {
    return this.companyProjectsService.deactivateCoordinatorAdmin(coordinatorId);
  }

  @Get('api/admin/projects/:projectId/workflow-status')
  @Get('admin/projects/:projectId/workflow-status')
  async getWorkflowStatusForAdmin(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getWorkflowStatusForAdmin(projectId);
  }

  @Patch('api/admin/projects/:projectId/quickview-data')
  @Patch('admin/projects/:projectId/quickview-data')
  async updateQuickviewDataForAdmin(
    @Param('projectId') projectId: string,
    @Body() payload: any,
  ): Promise<any> {
    return this.companyProjectsService.updateQuickviewDataForAdmin(
      projectId,
      payload,
    );
  }

  /**
   * Legacy admin compatibility: some UIs call POST /pr-details.
   * Route aliases are mapped to the same quickview update service.
   */
  @Post([
    'api/admin/projects/:projectId/pr-details',
    'admin/projects/:projectId/pr-details',
    'api/admin/projects/:projectId/pr_details',
    'admin/projects/:projectId/pr_details',
    'api/admin/projects/:projectId/p-details',
    'admin/projects/:projectId/p-details',
    'api/admin/projects/:projectId/p_details',
    'admin/projects/:projectId/p_details',
  ])
  async updatePrDetailsForAdmin(
    @Param('projectId') projectId: string,
    @Body() payload: any,
  ): Promise<any> {
    return this.companyProjectsService.updateQuickviewDataForAdmin(
      projectId,
      payload,
    );
  }

  /**
   * Assessment scoring compatibility endpoints (legacy admin UI).
   */
  @Get('api/admin/assesment_scoring/:projectId')
  @Get('admin/assesment_scoring/:projectId')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getAssessmentScoring(
    @Param('projectId') projectId: string,
    @Query('criteria_id') criteriaId?: string,
    @Query('crt') criteriaIdAlias?: string,
  ): Promise<any> {
    const resolvedCriteriaId = String(criteriaId ?? criteriaIdAlias ?? '').trim();
    return this.companyProjectsService.getAssessmentScoringForAdmin(
      projectId,
      resolvedCriteriaId || undefined,
    );
  }

  @Post('api/admin/store_assessment_scores/:projectId')
  @Post('admin/store_assessment_scores/:projectId')
  @UseInterceptors(AnyFilesInterceptor())
  async storeAssessmentScores(
    @Param('projectId') projectId: string,
    @Body() body: Record<string, unknown>,
  ): Promise<any> {
    return this.companyProjectsService.storeAssessmentScoresForAdmin(
      projectId,
      body as Record<string, any>,
      false,
    );
  }

  @Post('api/admin/finalsubmit_assessment_scores/:projectId')
  @Post('admin/finalsubmit_assessment_scores/:projectId')
  @UseInterceptors(AnyFilesInterceptor())
  async finalSubmitAssessmentScores(
    @Param('projectId') projectId: string,
    @Body() body: Record<string, unknown>,
  ): Promise<any> {
    return this.companyProjectsService.storeAssessmentScoresForAdmin(
      projectId,
      body as Record<string, any>,
      true,
    );
  }

  @Get('api/admin/summary_sheet/:projectId')
  @Get('api/admin/company/summary_sheet/:projectId')
  @Get('admin/summary_sheet/:projectId')
  @Get('admin/company/summary_sheet/:projectId')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getSummarySheet(
    @Param('projectId') projectId: string,
    @Query('criteria_id') criteriaId?: string,
  ): Promise<any> {
    return this.companyProjectsService.getAssessmentSummarySheetForAdmin(projectId, criteriaId);
  }

  @Get('api/admin/download_final_scoring/:projectId')
  @Get('api/admin/company/download_final_scoring/:projectId')
  @Get('admin/download_final_scoring/:projectId')
  @Get('admin/company/download_final_scoring/:projectId')
  async downloadFinalScoring(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    const exported = await this.companyProjectsService.downloadFinalScoringForAdmin(projectId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  @Post('api/admin/assessors')
  @Post('admin/assessors')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )
  async createAssessor(@Body() dto: CreateAssessorDto): Promise<any> {
    const mobile = (dto.mobile || dto.mobile_number || '').trim();
    return this.companyProjectsService.createAssessorAdminFlow(
      dto.name,
      dto.email,
      mobile,
      dto.send_credentials === true,
    );
  }

  @Get('api/admin/assessors')
  @Get('admin/assessors')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async listAssessors(@Query() query: ListAssessorsQueryDto): Promise<any> {
    return this.companyProjectsService.listAssessorsAdminFlow(query);
  }

  // Legacy frontend export compatibility
  @Get('api/admin/assessors_bulk_export')
  @Get('admin/assessors_bulk_export')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async exportAssessors(@Query() query: ListAssessorsQueryDto, @Res() res: Response): Promise<void> {
    const exported = await this.companyProjectsService.exportAssessorsAdminFlow(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  @Get('api/admin/company_bulk_export')
  @Get('admin/company_bulk_export')
  async exportCompaniesBulk(
    @Query() query: Record<string, any>,
    @Res() res: Response,
  ): Promise<void> {
    const exported = await this.companyProjectsService.exportCompaniesBulk(query || {});
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  @Get('api/admin/primary_data_form_comparsion')
  @Get('admin/primary_data_form_comparsion')
  async exportPrimaryDataComparison(
    @Query() query: Record<string, any>,
    @Res() res: Response,
  ): Promise<void> {
    const exported = await this.companyProjectsService.exportPrimaryDataFormComparison(
      query || {},
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  @Get('api/admin/rating_data_form_comparsion')
  @Get('admin/rating_data_form_comparsion')
  async exportRatingDataComparison(
    @Query() query: Record<string, any>,
    @Res() res: Response,
  ): Promise<void> {
    const exported = await this.companyProjectsService.exportRatingDataFormComparison(
      query || {},
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.buffer);
  }

  @Get('api/admin/check_comparsion_report')
  @Get('admin/check_comparsion_report')
  async exportScoringComparison(
    @Query() query: Record<string, any>,
    @Res() res: Response,
  ): Promise<void> {
    const exported = await this.companyProjectsService.exportScoringComparisonReport(
      query || {},
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.buffer);
  }

  @Post('api/admin/assessors/:assessorId/approval-status')
  @Post('admin/assessors/:assessorId/approval-status')
  @Post('api/admin/assessor_status/:assessorId')
  @Post('admin/assessor_status/:assessorId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateAssessorApproval(
    @Param('assessorId') assessorId: string,
    @Body() dto: UpdateAssessorApprovalDto,
    @Req() req: Request,
  ): Promise<any> {
    const path = req.path.toLowerCase();
    let status = dto.approval_status || dto.status || '';
    if (!status) {
      if (path.includes('/reject')) status = 'rejected';
      else if (path.includes('/approve')) status = 'approved';
    }
    return this.companyProjectsService.updateAssessorApprovalStatusAdminFlow(
      assessorId,
      status,
      dto.remarks,
    );
  }

  @Post('api/admin/assessors/:assessorId/approve')
  @Post('admin/assessors/:assessorId/approve')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async approveAssessor(
    @Param('assessorId') assessorId: string,
    @Body() dto: UpdateAssessorApprovalDto,
  ): Promise<any> {
    return this.companyProjectsService.updateAssessorApprovalStatusAdminFlow(
      assessorId,
      'approved',
      dto.remarks,
    );
  }

  @Post('api/admin/assessors/:assessorId/reject')
  @Post('admin/assessors/:assessorId/reject')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async rejectAssessor(
    @Param('assessorId') assessorId: string,
    @Body() dto: UpdateAssessorApprovalDto,
  ): Promise<any> {
    return this.companyProjectsService.updateAssessorApprovalStatusAdminFlow(
      assessorId,
      'rejected',
      dto.remarks,
    );
  }

  /**
   * Admin: approve/reject/pending one assessor-uploaded document (PAN, cheque, etc.).
   * Re-upload by assessor resets that document to Pending (see assessor PATCH profile).
   *
   * PATCH /api/admin/assessors/:assessorId/documents/:documentKey/approval
   * body: { "status": "Approved" | "Rejected" | "Pending", "remarks": "..." }
   */
  @Patch('api/admin/assessors/:assessorId/documents/:documentKey/approval')
  @Patch('admin/assessors/:assessorId/documents/:documentKey/approval')
  @Post('api/admin/assessors/:assessorId/documents/:documentKey/approval-status')
  @Post('admin/assessors/:assessorId/documents/:documentKey/approval-status')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateAssessorDocumentApproval(
    @Param('assessorId') assessorId: string,
    @Param('documentKey') documentKey: string,
    @Body() dto: UpdateAssessorDocumentApprovalDto,
  ): Promise<any> {
    return this.companyProjectsService.updateAssessorDocumentApprovalAdminFlow(
      assessorId,
      documentKey,
      dto.status,
      dto.remarks,
    );
  }

  @Get('api/admin/assessors/:assessorId')
  @Get('admin/assessors/:assessorId')
  async getAssessor(@Param('assessorId') assessorId: string): Promise<any> {
    return this.companyProjectsService.getAssessorAdminFlow(assessorId);
  }

  // Legacy frontend path compatibility
  @Get('assessors/:assessorId')
  async getAssessorLegacy(@Param('assessorId') assessorId: string): Promise<any> {
    return this.companyProjectsService.getAssessorAdminFlow(assessorId);
  }

  @Post('api/admin/assessors/profile')
  @Post('admin/assessors/profile')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'biodata', maxCount: 1 },
        { name: 'vendor_registration_form', maxCount: 1 },
        { name: 'non_disclosure_agreement', maxCount: 1 },
        { name: 'health_declaration', maxCount: 1 },
        { name: 'gst_declaration', maxCount: 1 },
        { name: 'pan_card', maxCount: 1 },
        { name: 'cancelled_cheque', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = join(process.cwd(), 'uploads', 'assessors');
            if (!fs.existsSync(uploadPath)) {
              fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
          },
        }),
        fileFilter: (req, file, cb) => {
          if (file.fieldname === 'profile_image') {
            const imageTypes = ['image/png', 'image/jpeg', 'image/jpg'];
            if (!imageTypes.includes(file.mimetype)) {
              cb(new Error('profile_image must be PNG/JPG/JPEG'), false);
              return;
            }
          }
          cb(null, true);
        },
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createAssessorProfile(
    @Body() dto: CreateAssessorProfileDto,
    @UploadedFiles()
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ): Promise<any> {
    return this.companyProjectsService.createAssessorProfileAdminFlow(dto, files);
  }

  @Put('api/admin/assessors/:assessorId/edit')
  @Put('api/admin/assessors/:assessorId')
  @Put('admin/assessors/:assessorId/edit')
  @Put('admin/assessors/:assessorId')
  @Put('assessors/:assessorId/edit')
  @Put('assessors/:assessorId')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'biodata', maxCount: 1 },
        { name: 'vendor_registration_form', maxCount: 1 },
        { name: 'non_disclosure_agreement', maxCount: 1 },
        { name: 'health_declaration', maxCount: 1 },
        { name: 'gst_declaration', maxCount: 1 },
        { name: 'pan_card', maxCount: 1 },
        { name: 'cancelled_cheque', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = join(process.cwd(), 'uploads', 'assessors');
            if (!fs.existsSync(uploadPath)) {
              fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
          },
        }),
        fileFilter: (req, file, cb) => {
          if (file.fieldname === 'profile_image') {
            const imageTypes = ['image/png', 'image/jpeg', 'image/jpg'];
            if (!imageTypes.includes(file.mimetype)) {
              cb(new Error('profile_image must be PNG/JPG/JPEG'), false);
              return;
            }
          }
          cb(null, true);
        },
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateAssessorProfile(
    @Param('assessorId') assessorId: string,
    @Body() dto: Partial<CreateAssessorProfileDto>,
    @UploadedFiles()
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ): Promise<any> {
    return this.companyProjectsService.updateAssessorProfileAdminFlow(assessorId, dto, files);
  }

  // Dedicated POST updater for legacy frontend forms (Nest cannot reliably mix PUT+POST decorators on one handler)
  @Post('api/admin/assessors/:assessorId/edit')
  @Post('api/admin/assessors/:assessorId/profile')
  @Post('api/admin/assessors/:assessorId/public')
  @Post('api/admin/assessor_profile/:assessorId')
  @Post('admin/assessors/:assessorId/edit')
  @Post('admin/assessors/:assessorId/profile')
  @Post('admin/assessors/:assessorId/public')
  @Post('admin/assessor_profile/:assessorId')
  @Post('assessors/:assessorId/edit')
  @Post('assessors/:assessorId/profile')
  @Post('assessors/:assessorId/public')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'biodata', maxCount: 1 },
        { name: 'vendor_registration_form', maxCount: 1 },
        { name: 'non_disclosure_agreement', maxCount: 1 },
        { name: 'health_declaration', maxCount: 1 },
        { name: 'gst_declaration', maxCount: 1 },
        { name: 'pan_card', maxCount: 1 },
        { name: 'cancelled_cheque', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = join(process.cwd(), 'uploads', 'assessors');
            if (!fs.existsSync(uploadPath)) {
              fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateAssessorProfilePostAlias(
    @Param('assessorId') assessorId: string,
    @Body() dto: Partial<CreateAssessorProfileDto>,
    @UploadedFiles()
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ): Promise<any> {
    return this.companyProjectsService.updateAssessorProfileAdminFlow(assessorId, dto, files);
  }

  // Legacy frontend compatibility route (JSON update without file upload)
  @Put('admin/assessors/:assessorId')
  @Put('assessors/:assessorId')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'biodata', maxCount: 1 },
        { name: 'vendor_registration_form', maxCount: 1 },
        { name: 'non_disclosure_agreement', maxCount: 1 },
        { name: 'health_declaration', maxCount: 1 },
        { name: 'gst_declaration', maxCount: 1 },
        { name: 'pan_card', maxCount: 1 },
        { name: 'cancelled_cheque', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = join(process.cwd(), 'uploads', 'assessors');
            if (!fs.existsSync(uploadPath)) {
              fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateAssessorProfileLegacy(
    @Param('assessorId') assessorId: string,
    @Body() dto: Partial<CreateAssessorProfileDto>,
    @UploadedFiles()
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ): Promise<any> {
    return this.companyProjectsService.updateAssessorProfileAdminFlow(assessorId, dto, files);
  }

  // API route explicitly for clients using /api/admin/assessors/:id (without /edit)
  @Put('api/admin/assessors/:assessorId')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'biodata', maxCount: 1 },
        { name: 'vendor_registration_form', maxCount: 1 },
        { name: 'non_disclosure_agreement', maxCount: 1 },
        { name: 'health_declaration', maxCount: 1 },
        { name: 'gst_declaration', maxCount: 1 },
        { name: 'pan_card', maxCount: 1 },
        { name: 'cancelled_cheque', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = join(process.cwd(), 'uploads', 'assessors');
            if (!fs.existsSync(uploadPath)) {
              fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateAssessorProfileApiLegacy(
    @Param('assessorId') assessorId: string,
    @Body() dto: Partial<CreateAssessorProfileDto>,
    @UploadedFiles()
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ): Promise<any> {
    return this.companyProjectsService.updateAssessorProfileAdminFlow(assessorId, dto, files);
  }

  /**
   * Legacy admin flow compatibility:
   * POST /api/admin/assign_assessor/:companyProjectId
   */
  @Post('api/admin/assign_assessor/:companyProjectId')
  @Post('admin/assign_assessor/:companyProjectId')
  async assignAssessor(
    @Param('companyProjectId') companyProjectId: string,
    @Body() body: Record<string, unknown>,
  ): Promise<any> {
    const assessorId = String(body?.selectassessor ?? body?.assessor_id ?? '').trim();
    const legacyDate = String(body?.assessor_date ?? '').trim();
    const rawVisitDates = body?.visit_dates;
    const assessorAmount = Number(body?.assessor_amount ?? 0);

    if (!assessorId) {
      throw new BadRequestException({
        status: 'validations',
        errors: { assessor_id: ['assessor_id is required.'] },
      });
    }

    // Legacy payload path: requires assessor_date (dd/mm/yyyy,dd/mm/yyyy) + assessor_amount
    if (legacyDate) {
      return this.companyProjectsService.assignAssessorAdminFlow(
        companyProjectId,
        assessorId,
        legacyDate,
        Number.isFinite(assessorAmount) ? assessorAmount : 0,
      );
    }

    // New payload path: assessor_id + optional visit_dates[]
    let visitDates: string[] | undefined;
    if (Array.isArray(rawVisitDates)) {
      visitDates = rawVisitDates.map((v) => String(v).trim()).filter(Boolean);
    } else if (typeof rawVisitDates === 'string' && rawVisitDates.trim()) {
      visitDates = rawVisitDates
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return this.companyProjectsService.assignAssessorForAdmin(
      companyProjectId,
      assessorId,
      visitDates,
    );
  }

  @Delete('api/admin/projects/:companyProjectId/assessors/:assessorId')
  @Delete('admin/projects/:companyProjectId/assessors/:assessorId')
  @Delete('api/admin/remove_assessor/:companyProjectId/:assessorId')
  @Delete('admin/remove_assessor/:companyProjectId/:assessorId')
  @Post('api/admin/remove_assessor/:companyProjectId/:assessorId')
  @Post('admin/remove_assessor/:companyProjectId/:assessorId')
  async removeAssessor(
    @Param('companyProjectId') companyProjectId: string,
    @Param('assessorId') assessorId: string,
  ): Promise<any> {
    return this.companyProjectsService.removeAssessorAssignmentForAdmin(
      companyProjectId,
      assessorId,
    );
  }

  // Legacy UI compatibility where assessor id is sent in body instead of URL param.
  @Post('api/admin/remove_assessor/:companyProjectId')
  @Post('admin/remove_assessor/:companyProjectId')
  @Post('api/company/projects/:projectId/remove-assessor')
  @Post('company/projects/:projectId/remove-assessor')
  @UseGuards(AdminJwtAuthGuard)
  async removeAssessorByBody(
    @Param('companyProjectId') companyProjectId?: string,
    @Param('projectId') projectId?: string,
    @Body() body?: Record<string, unknown>,
  ): Promise<any> {
    const resolvedProjectId = String(companyProjectId ?? projectId ?? '').trim();
    const assessorId = String(body?.assessor_id ?? body?.selectassessor ?? body?.assessorId ?? '').trim();
    if (!resolvedProjectId || !assessorId) {
      throw new BadRequestException({
        status: 'validations',
        errors: { assessor_id: ['assessor_id is required.'] },
      });
    }
    return this.companyProjectsService.removeAssessorAssignmentForAdmin(
      resolvedProjectId,
      assessorId,
    );
  }

  /**
   * Legacy admin flow compatibility:
   * POST /api/admin/payment_status/:companyProjectId
   */
  @Post('api/admin/payment_status/:companyProjectId')
  @Post('admin/payment_status/:companyProjectId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async paymentStatus(
    @Param('companyProjectId') companyProjectId: string,
    @Body() dto: AdminPaymentStatusDto,
  ): Promise<any> {
    return this.companyProjectsService.paymentStatusAdminFlow(
      companyProjectId,
      dto.payment_id,
      dto.status,
      dto.remarks,
    );
  }

  /** Finance v2 admin compatibility: list invoices for project. */
  @Get('api/admin/projects/:projectId/finance-v2/proforma-invoices')
  @Get('admin/projects/:projectId/finance-v2/proforma-invoices')
  async getFinanceV2InvoicesForAdmin(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFinanceV2InvoicesByProjectId(projectId);
  }

  /** Finance v2 admin compatibility: update approval status/remarks. */
  @Post('api/admin/projects/:projectId/finance-v2/proforma-invoices/:invoiceId/approval-status')
  @Post('admin/projects/:projectId/finance-v2/proforma-invoices/:invoiceId/approval-status')
  @Patch('api/admin/projects/:projectId/finance-v2/proforma-invoices/:invoiceId/approval-status')
  @Patch('admin/projects/:projectId/finance-v2/proforma-invoices/:invoiceId/approval-status')
  async updateFinanceV2ApprovalForAdmin(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: Record<string, any>,
  ): Promise<any> {
    const approval_status =
      body?.approval_status ??
      body?.status ??
      body?.approvalStatus;
    const remarks =
      body?.remarks ??
      body?.approval_remarks ??
      body?.approvalRemarks;

    return this.companyProjectsService.updateFinanceV2ApprovalByProjectId(
      projectId,
      invoiceId,
      {
        approval_status,
        remarks,
      } as any,
    );
  }

  @Get('api/admin/reports')
  @Get('admin/reports')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async getReports(@Query() query: ReportsQueryDto): Promise<any> {
    return this.companyProjectsService.getReportsAdminFlow(query);
  }

  /**
   * Certification completed listing:
   * projects where certificate is uploaded.
   */
  @Get('api/admin/projects/certification-completed')
  @Get('admin/projects/certification-completed')
  @Get('api/admin/projects/certification_completed')
  @Get('admin/projects/certification_completed')
  async listCertificationCompletedProjects(@Query() query: Record<string, any>): Promise<any> {
    return this.companyProjectsService.listCertificationCompletedProjects(query);
  }

  @Get('api/admin/financeDocument/:companyProject')
  @Get('admin/financeDocument/:companyProject')
  async getFinanceDocument(
    @Param('companyProject') companyProject: string,
    @Query('payment_for') paymentFor: string,
  ): Promise<any> {
    return this.companyProjectsService.getInvoicesByProjectIdAndPaymentFor(
      companyProject,
      paymentFor || 'expA',
    );
  }

  @Get('api/admin/projects/:projectId/plaque')
  @Get('admin/projects/:projectId/plaque')
  async getPlaqueDetails(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getPlaqueDetailsByProjectId(projectId);
  }

  @Post('api/admin/projects/:projectId/plaque')
  @Post('admin/projects/:projectId/plaque')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async upsertPlaqueDetails(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertPlaqueDetailsDto,
  ): Promise<any> {
    return this.companyProjectsService.upsertPlaqueDetailsByProjectId(projectId, dto);
  }

  @Patch('api/admin/projects/:projectId/plaque')
  @Patch('admin/projects/:projectId/plaque')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updatePlaqueDetails(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertPlaqueDetailsDto,
  ): Promise<any> {
    return this.companyProjectsService.upsertPlaqueDetailsByProjectId(projectId, dto);
  }

  @Get('api/admin/projects/:projectId/outstanding')
  @Get('admin/projects/:projectId/outstanding')
  async getOutstandingDetails(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getOutstandingDetailsByProjectId(projectId);
  }

  @Post('api/admin/projects/:projectId/outstanding')
  @Post('admin/projects/:projectId/outstanding')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async upsertOutstandingDetails(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertOutstandingDetailsDto,
  ): Promise<any> {
    return this.companyProjectsService.upsertOutstandingDetailsByProjectId(projectId, dto, true);
  }

  @Patch('api/admin/projects/:projectId/outstanding')
  @Patch('admin/projects/:projectId/outstanding')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateOutstandingDetails(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertOutstandingDetailsDto,
  ): Promise<any> {
    return this.companyProjectsService.upsertOutstandingDetailsByProjectId(projectId, dto, false);
  }

  @Post('api/admin/projects/:projectId/outstanding/due-payment')
  @Post('admin/projects/:projectId/outstanding/due-payment')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async payOutstandingDueAmount(
    @Param('projectId') projectId: string,
    @Body() dto: OutstandingDuePaymentDto,
  ): Promise<any> {
    return this.companyProjectsService.payOutstandingDueAmountByProjectId(projectId, dto);
  }

  @Get('company/primary_data/:companyProject')
  async getPrimaryDataGiLegacy(
    @Param('companyProject') companyProject: string,
  ): Promise<any> {
    return this.companyProjectsService.getPrimaryDataGiLegacyByProjectId(companyProject);
  }

  @Post('company/primary_data/:companyProject')
  async savePrimaryDataGiLegacy(
    @Param('companyProject') companyProject: string,
    @Body() body: Record<string, any>,
  ): Promise<any> {
    return this.companyProjectsService.savePrimaryDataGiLegacyByProjectId(
      companyProject,
      body,
    );
  }

  @Patch('company/primary_data/:companyProject')
  async updatePrimaryDataGiLegacy(
    @Param('companyProject') companyProject: string,
    @Body() body: Record<string, any>,
  ): Promise<any> {
    return this.companyProjectsService.updatePrimaryDataGiLegacyByProjectId(
      companyProject,
      body,
    );
  }

  @Get('company/import/ee/:projectid')
  async viewEnergyImport(@Param('projectid') projectid: string): Promise<any> {
    return {
      status: 'success',
      message: 'EE import endpoint available',
      data: {
        project_id: projectid,
        upload_field: 'energy_efficiency',
        accepted_extensions: ['.xls', '.xlsx', '.csv'],
      },
    };
  }

  @Post('company/import/ee/:projectid')
  @UseInterceptors(
    FileInterceptor('energy_efficiency', {
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname || '').toLowerCase();
        if (!['.xls', '.xlsx', '.csv'].includes(ext)) {
          cb(
            new BadRequestException(
              'Only excel(.xls or .xlsx) file types allowed',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async importEnergyData(
    @Param('projectid') projectid: string,
    @UploadedFile() energy_efficiency?: Express.Multer.File,
  ): Promise<any> {
    if (!energy_efficiency) {
      throw new BadRequestException('Please upload a file to import data.');
    }
    return {
      status: 'error',
      message:
        'EE spreadsheet import is not implemented in this API. Use POST /company/primary_data/:projectId with form_type=ee payload.',
      data: { project_id: projectid },
    };
  }

  /**
   * Legacy admin certificate tab toggle compatibility:
   * PATCH /api/admin/projects/:projectId/certificate
   * Body: { score_band_status: 0 | 1 }
   */
  @Patch('api/admin/projects/:projectId/certificate')
  @Patch('admin/projects/:projectId/certificate')
  @Patch('api/admin/upload_certificate/:projectId')
  @Patch('admin/upload_certificate/:projectId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateCertificateTabStatusForAdmin(
    @Param('projectId') projectId: string,
    @Body() dto: ScoreBandStatusDto,
  ): Promise<any> {
    return this.companyProjectsService.updateScoreBandStatusByProjectId(
      projectId,
      dto.score_band_status,
    );
  }

  /**
   * Legacy admin certificate upload compatibility endpoint.
   * POST /api/admin/certificate_upload/:projectId
   * multipart field: certificate_upload (PDF)
   */
  @Post('api/admin/upload_certificate/:projectId')
  @Post('admin/upload_certificate/:projectId')
  @Post('api/admin/projects/:projectId/certificate')
  @Post('admin/projects/:projectId/certificate')
  @Post('api/admin/certificate_upload/:projectId')
  @Post('admin/certificate_upload/:projectId')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'company_certificate', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.pdf';
          cb(null, `${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new BadRequestException('Only PDF is allowed for certificate.'), false);
      },
    }),
  )
  async uploadCertificateLegacy(
    @Param('projectId') projectId: string,
    @Body() body?: Record<string, unknown>,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<any> {
    const certificateUpload = Array.isArray(files) ? files[0] : undefined;
    if (!certificateUpload) {
      const rawToggle =
        body?.score_band_status ??
        body?.show_score_band ??
        body?.showScoreBand ??
        body?.visible;
      const normalizedToggle = (() => {
        if (rawToggle === 1 || rawToggle === '1' || rawToggle === true || rawToggle === 'true') return 1;
        if (rawToggle === 0 || rawToggle === '0' || rawToggle === false || rawToggle === 'false') return 0;
        return null;
      })();
      if (normalizedToggle !== null) {
        return this.companyProjectsService.updateScoreBandStatusByProjectId(
          projectId,
          normalizedToggle,
        );
      }
      throw new BadRequestException({ status: 'error', message: 'No file uploaded' });
    }
    return this.companyProjectsService.uploadCertificateDocumentByProjectId(
      projectId,
      certificateUpload,
    );
  }

  /**
   * Legacy admin feedback upload compatibility endpoint.
   * POST /api/admin/company/feedback_upload/:projectId
   * multipart field: feedback_upload (PDF)
   */
  @Post('api/admin/company/feedback_upload/:projectId')
  @Post('admin/company/feedback_upload/:projectId')
  @UseInterceptors(
    FileInterceptor('feedback_upload', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'company_feedback', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.pdf';
          cb(null, `${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new BadRequestException('Only PDF is allowed for feedback.'), false);
      },
    }),
  )
  async uploadFeedbackLegacy(
    @Param('projectId') projectId: string,
    @UploadedFile() feedbackUpload?: Express.Multer.File,
  ): Promise<any> {
    if (!feedbackUpload) {
      throw new BadRequestException({ status: 'error', message: 'No file uploaded' });
    }
    return this.companyProjectsService.uploadFeedbackDocumentByProjectId(
      projectId,
      feedbackUpload,
    );
  }

  @Get('company/energy_export')
  async exportEnergy(
    @Query('company_id') companyId: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!companyId?.trim()) {
      throw new BadRequestException('company_id query parameter is required');
    }
    const { buffer, filename } =
      await this.companyProjectsService.exportEnergyEfficiencyForCompany(
        companyId.trim(),
      );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('api/admin/upload_inv/:companyProject')
  @Post('admin/upload_inv/:companyProject')
  @UseInterceptors(
    FileInterceptor('regFeeInvoice', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.companyProject;
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'expenses');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `expense-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const isPdf = file.mimetype === 'application/pdf' && extname(file.originalname).toLowerCase() === '.pdf';
        if (!isPdf) {
          cb(new BadRequestException('Only PDF is allowed.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadExpenseInvoice(
    @Param('companyProject') companyProject: string,
    @Body() body: any,
    @UploadedFile() regFeeInvoice?: Express.Multer.File,
  ): Promise<any> {
    try {
      const invoicetitle = String(body?.invoicetitle ?? '').trim();
      const invoiceamount = Number(body?.invoiceamount);
      const sgst = Number(body?.sgst);
      const cgst = Number(body?.cgst);
      const igst = Number(body?.igst);
      const payment_date = String(body?.payment_date ?? '').trim();
      const payment_for = String(body?.payment_for ?? '').trim();

      const titleRegex = /^[A-Za-z0-9_\- ]+$/;
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(payment_date);
      const max2 = (n: number) => Number.isFinite(n) && Math.round(n * 100) === n * 100;

      if (
        payment_for !== 'expA' ||
        !regFeeInvoice ||
        invoicetitle.length < 3 ||
        invoicetitle.length > 50 ||
        !titleRegex.test(invoicetitle) ||
        !Number.isFinite(invoiceamount) ||
        invoiceamount <= 0 ||
        !max2(invoiceamount) ||
        !Number.isFinite(sgst) ||
        !Number.isFinite(cgst) ||
        !Number.isFinite(igst) ||
        sgst < 0 || sgst > 100 || !max2(sgst) ||
        cgst < 0 || cgst > 100 || !max2(cgst) ||
        igst < 0 || igst > 100 || !max2(igst) ||
        !validDate
      ) {
        return { status: 'error', message: 'Some Error Occurred...' };
      }

      return this.companyProjectsService.createCiiExpenseInvoiceByProjectId(
        companyProject,
        {
          invoicetitle,
          invoiceamount,
          sgst,
          cgst,
          igst,
          payment_date,
          payment_for,
        },
        regFeeInvoice,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return { status: 'error', message: 'Some Error Occurred...' };
    }
  }

  @Patch('api/admin/upload_inv/:companyProject/:invoiceId')
  @Patch('admin/upload_inv/:companyProject/:invoiceId')
  @UseInterceptors(
    FileInterceptor('regFeeInvoice', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.companyProject;
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'expenses');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `expense-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const isPdf = file.mimetype === 'application/pdf' && extname(file.originalname).toLowerCase() === '.pdf';
        if (!isPdf) {
          cb(new BadRequestException('Only PDF is allowed.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async updateExpenseInvoice(
    @Param('companyProject') companyProject: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: any,
    @UploadedFile() regFeeInvoice?: Express.Multer.File,
  ): Promise<any> {
    try {
      const invoicetitle = String(body?.invoicetitle ?? '').trim();
      const invoiceamount = Number(body?.invoiceamount);
      const sgst = Number(body?.sgst);
      const cgst = Number(body?.cgst);
      const igst = Number(body?.igst);
      const payment_date = String(body?.payment_date ?? '').trim();
      const payment_for = String(body?.payment_for ?? '').trim();

      const titleRegex = /^[A-Za-z0-9_\- ]+$/;
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(payment_date);
      const max2 = (n: number) => Number.isFinite(n) && Math.round(n * 100) === n * 100;

      if (
        payment_for !== 'expA' ||
        invoicetitle.length < 3 ||
        invoicetitle.length > 50 ||
        !titleRegex.test(invoicetitle) ||
        !Number.isFinite(invoiceamount) ||
        invoiceamount <= 0 ||
        !max2(invoiceamount) ||
        !Number.isFinite(sgst) ||
        !Number.isFinite(cgst) ||
        !Number.isFinite(igst) ||
        sgst < 0 || sgst > 100 || !max2(sgst) ||
        cgst < 0 || cgst > 100 || !max2(cgst) ||
        igst < 0 || igst > 100 || !max2(igst) ||
        !validDate
      ) {
        return { status: 'error', message: 'Some Error Occurred...' };
      }

      return this.companyProjectsService.updateCiiExpenseInvoiceByProjectId(
        companyProject,
        invoiceId,
        {
          invoicetitle,
          invoiceamount,
          sgst,
          cgst,
          igst,
          payment_date,
          payment_for,
        },
        regFeeInvoice,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return { status: 'error', message: 'Some Error Occurred...' };
    }
  }
}

