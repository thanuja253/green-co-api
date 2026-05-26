import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Request,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
  NotFoundException,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import { CompanyProjectsService } from './company-projects.service';
import { JwtAuthGuard } from '../company-auth/guards/jwt-auth.guard';
import { AccountStatusGuard } from '../company-auth/guards/account-status.guard';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { join } from 'path';
import * as fs from 'fs';
import { CompleteMilestoneDto } from './dto/complete-milestone.dto';
import { ApproveWorkOrderDto } from './dto/approve-workorder.dto';
import { WorkOrderAcceptanceDetailsDto } from './dto/work-order-acceptance.dto';
import { ProjectCodeUpsertDto } from './dto/project-code-upsert.dto';
import { CreateProjectCodeDto } from './dto/create-project-code.dto';
import { AssignAssessorDto } from './dto/assign-assessor.dto';
import { AssignFacilitatorDto } from './dto/assign-facilitator.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { UpdateInvoiceApprovalDto } from './dto/update-invoice-approval.dto';
import { CreateProformaInvoiceV2Dto } from './dto/create-proforma-invoice-v2.dto';
import { UpdateProformaInvoiceV2Dto } from './dto/update-proforma-invoice-v2.dto';
import { UpdateFinanceV2ReminderDto } from './dto/update-finance-v2-reminder.dto';
import { SubmitFinanceV2PaymentDto } from './dto/submit-finance-v2-payment.dto';
import { UpdateFinanceV2ApprovalDto } from './dto/update-finance-v2-approval.dto';
import { UploadLaunchAndTrainingDto } from './dto/upload-launch-and-training.dto';
import { PrimaryDataStoreDto } from './dto/primary-data-store.dto';
import { PrimaryDataFormApprovalDto } from './dto/primary-data-approval.dto';
import { UpdateAssessmentSubmittalDto } from './dto/update-assessment-submittal.dto';
import { ScoreBandStatusDto } from './dto/score-band-status.dto';
import {
  ReviewProposalDocumentDto,
  normalizeProposalReviewAction,
} from './dto/review-proposal-document.dto';
import {
  ReviewWorkOrderDocumentDto,
  normalizeWorkOrderReviewAction,
} from './dto/review-work-order-document.dto';
import {
  REGISTRATION_INFO_FILE_FIELDS,
  createRegistrationInfoValidationPipe,
  parseRegistrationMultipartBody,
  registrationInfoMulterOptions,
} from './registration-info-upload.config';
import {
  LaunchTrainingSessionFiles,
  addLaunchTrainingSessionFromMultipart,
  launchTrainingSessionUploadInterceptor,
} from './launch-training-session-upload.config';

/**
 * Multer may receive multiple file fields; prefer the first **non-empty** part in
 * `proposal_document` → `proposalDocument` → `file` order so an empty stub in
 * `proposal_document` does not win over real bytes in `file`.
 */
function pickProposalMultipartPdf(files?: {
  proposal_document?: Express.Multer.File[];
  proposalDocument?: Express.Multer.File[];
  file?: Express.Multer.File[];
}): Express.Multer.File | undefined {
  const ordered = [
    files?.proposal_document?.[0],
    files?.proposalDocument?.[0],
    files?.file?.[0],
  ];
  for (const f of ordered) {
    if (f && (f.size ?? 0) > 0) {
      return f;
    }
  }
  return ordered.find((f) => !!f);
}

function assertNonEmptyProposalPdf(file: Express.Multer.File): void {
  if ((file.size ?? 0) > 0) {
    return;
  }
  const diskPath = (file as Express.Multer.File & { path?: string }).path;
  if (diskPath && fs.existsSync(diskPath)) {
    try {
      fs.unlinkSync(diskPath);
    } catch {
      /* ignore */
    }
  }
  throw new BadRequestException({
    status: 'error',
    message:
      'Uploaded PDF is empty (0 bytes). Send real file bytes, e.g. curl -F "proposal_document=@/path/to/document.pdf" …/proposal-document/reupload — copying multipart from DevTools often drops the binary body.',
  });
}

@Controller(['api/company/projects', 'api/companyproject', 'api/companyprojects'])
export class CompanyProjectsController {
  constructor(
    private readonly companyProjectsService: CompanyProjectsService,
  ) {}

  /**
   * List all active coordinators (for admin dropdown).
   * GET /api/company/projects/coordinators
   */
  @Get('coordinators')
  @UseGuards(AdminJwtAuthGuard)
  async listCoordinators(): Promise<any> {
    return this.companyProjectsService.listCoordinators();
  }

  // Test route to verify controller is working
  @Get('test')
  testRoute() {
    return { status: 'success', message: 'CompanyProjectsController is working' };
  }

  /**
   * List projects for the logged-in company (for project listing table).
   * GET /api/company/projects
   */
  @Get()
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async listCompanyProjects(@Request() req): Promise<any> {
    return this.companyProjectsService.listCompanyProjects(req.user.userId);
  }

  /**
   * Create a new recertification project (no project code yet; copies registration_info).`1Az  
   * POST /api/company/projects/:projectId/recertify
   */
  @Post(':projectId/recertify')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async recertifyProject(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.recertifyProject(
      req.user.userId,
      projectId,
    );
  }

  /**
   * Send sustenance reminders (for cron / activity deadlines).
   * GET /api/company/projects/reminders/send-sustenance-reminders
   * No auth required so external cron can call it; optionally protect with API key in production.
   */
  @Get('reminders/send-sustenance-reminders')
  async sendSustenanceReminders(): Promise<{ status: string; data: { sent: number; message: string } }> {
    const result = await this.companyProjectsService.sendSustenanceReminders();
    return { status: 'success', data: result };
  }

  // More specific routes first to avoid route conflicts
  @Get(':projectId/scoreband-download')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async downloadScoreBand(
    @Request() req,
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    console.log(`[ScoreBand Download] Request received for projectId: ${projectId}`);
    try {
      const pdfPath = await this.companyProjectsService.getScoreBandPdfPath(
        req.user.userId,
        projectId,
      );

      console.log(`[ScoreBand Download] PDF path: ${pdfPath}`);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Score_Band.pdf"',
      );

      return res.sendFile(pdfPath);
    } catch (error) {
      console.error(`[ScoreBand Download] Error:`, error);
      // If it's already a NotFoundException with proper format, re-throw it
      if (error instanceof NotFoundException) {
        throw error;
      }
      // For any other errors, return generic error
      return res.status(500).json({
        status: 'error',
        message: 'Failed to download score band PDF',
      });
    }
  }

  @Get(':projectId/certificate-document')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getCertificateDocument(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    const file = await this.companyProjectsService.getCertificateDocumentDownloadByProjectId(projectId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.filename}"`,
    );

    return res.sendFile(file.absolutePath);
  }

  @Get(':projectId/feedback-document')
  async getFeedbackDocument(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    const file = await this.companyProjectsService.getFeedbackDocumentDownloadByProjectId(
      projectId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.filename}"`,
    );

    return res.sendFile(file.absolutePath);
  }

  @Get(':projectId/certificate')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getCertificateSummary(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getCertificateSummary(
      req.user.userId,
      projectId,
    );
  }

  /**
   * Upload Plaque and Certificate (Admin/Greenco Team).
   * POST /api/company/projects/:projectId/certificate-upload
   * Body: multipart/form-data, field name "certificate_upload" (PDF).
   */
  @Post(':projectId/certificate-upload')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileInterceptor('certificate_upload', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'company_certificate', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname) || '.pdf';
          cb(null, `${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only PDF is allowed for certificate.'), false);
        }
      },
    }),
  )
  async uploadCertificate(
    @Request() req,
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({ status: 'error', message: 'No file uploaded' });
    }
    return this.companyProjectsService.uploadCertificateDocument(
      req.user.userId,
      projectId,
      file,
    );
  }

  /**
   * Upload Feedback (Admin/Greenco Team).
   * POST /api/company/projects/:projectId/feedback-upload
   * Body: multipart/form-data, field name "feedback_upload" (PDF).
   */
  @Post(':projectId/feedback-upload')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileInterceptor('feedback_upload', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'company_feedback', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname) || '.pdf';
          cb(null, `${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only PDF is allowed for feedback.'), false);
        }
      },
    }),
  )
  async uploadFeedback(
    @Request() req,
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({ status: 'error', message: 'No file uploaded' });
    }
    return this.companyProjectsService.uploadFeedbackDocument(
      req.user.userId,
      projectId,
      file,
    );
  }

  /**
   * Show Score Band to Company (Admin toggle). 0 = hide, 1 = show.
   * PATCH /api/company/projects/:projectId/score-band-status
   */
  @Patch(':projectId/score-band-status')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateScoreBandStatus(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: ScoreBandStatusDto,
  ): Promise<any> {
    return this.companyProjectsService.updateScoreBandStatus(
      req.user.userId,
      projectId,
      dto.score_band_status,
    );
  }

  @Get(':projectId/quickview')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  async getQuickview(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    const resolved = await this.companyProjectsService.resolveProjectForQuickview(projectId);
    if (!resolved?.company_id) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found or quickview not available.',
      });
    }
    const resolvedCompanyId = String(resolved.company_id);
    const resolvedProjectId = String(resolved._id);
    const jwtCompanyId = String(req?.user?.userId || '').trim();
    if (jwtCompanyId && jwtCompanyId !== resolvedCompanyId) {
      throw new NotFoundException({
        status: 'error',
        message: 'Project not found or quickview not available.',
      });
    }
    return this.companyProjectsService.getQuickviewData(
      resolvedCompanyId,
      resolvedProjectId,
    );
  }

  @Post(':projectId/milestones')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async completeMilestone(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: CompleteMilestoneDto,
  ): Promise<any> {
    return this.companyProjectsService.completeMilestone(
      req.user.userId,
      projectId,
      dto,
    );
  }

  /**
   * Save (first submit) or update registration form — same fields and multipart file fields as creation.
   * POST = first save (may advance milestone 2). PUT/PATCH = update only (same merge rules, no milestone side effects).
   */
  @Post(':projectId/registration-info')
  @Put(':projectId/registration-info')
  @Patch(':projectId/registration-info')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileFieldsInterceptor(REGISTRATION_INFO_FILE_FIELDS, registrationInfoMulterOptions),
  )
  @UsePipes(createRegistrationInfoValidationPipe())
  async saveRegistrationInfo(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() body: any, // Accept any to handle FormData properly
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
    console.log('========================================');
    console.log('[Registration Info Controller] ====== REQUEST RECEIVED ======');
    console.log('[Registration Info Controller] Request headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
    });
    
    // Check if Content-Type is multipart/form-data
    const contentType = req.headers['content-type'] || '';
    console.log('[Registration Info Controller] Content-Type check:', {
      contentType,
      isMultipart: contentType.includes('multipart/form-data'),
    });
    
    if (!contentType.includes('multipart/form-data')) {
      console.error('[Registration Info Controller] ❌ ERROR: Content-Type is not multipart/form-data!', {
        received: contentType,
        expected: 'multipart/form-data',
        message: 'Frontend must send FormData with Content-Type: multipart/form-data',
      });
    } else {
      console.log('[Registration Info Controller] ✅ Content-Type is correct: multipart/form-data');
    }
    
    // Log raw body keys (if any)
    console.log('[Registration Info Controller] Request body keys:', body ? Object.keys(body) : 'no body');
    console.log('========================================');
    console.log('[Registration Info Controller] Files from @UploadedFiles():', {
      hasFiles: !!files,
      filesType: typeof files,
      filesValue: files,
      company_brief_profile: files?.company_brief_profile?.length || 0,
      brief_profile: files?.brief_profile?.length || 0,
      turnover_document: files?.turnover_document?.length || 0,
      turnover: files?.turnover?.length || 0,
    });
    
    const reqFiles = (req as any).files;
    const { dto, files: mergedFiles } = parseRegistrationMultipartBody(body, files, reqFiles);

    console.log('[Registration Info Controller] Calling service with:', {
      hasFiles: !!mergedFiles,
      filesKeys: mergedFiles ? Object.keys(mergedFiles) : [],
      dtoKeys: Object.keys(dto).slice(0, 5),
    });

    const isUpdate = req.method === 'PUT' || req.method === 'PATCH';
    const result = await this.companyProjectsService.saveRegistrationInfo(
      req.user.userId,
      projectId,
      dto,
      mergedFiles,
      isUpdate ? { isUpdate: true, skipMilestone: true } : undefined,
    );

    console.log('[Registration Info Controller] Service returned:', {
      status: result.status,
      hasData: !!result.data,
    });

    return result;
  }   /**
   * Facilitator-only registration flow endpoint (keeps existing /registration-info unchanged).
   * Supports company_brief_profile upload via multipart/form-data.
   */
  @Post(':projectId/facilitator-registration-info')
  @Put(':projectId/facilitator-registration-info')
  @Patch(':projectId/facilitator-registration-info')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileFieldsInterceptor(REGISTRATION_INFO_FILE_FIELDS, registrationInfoMulterOptions),
  )
  @UsePipes(createRegistrationInfoValidationPipe())
  async saveFacilitatorRegistrationInfo(
    @Request() req,
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
    const isUpdate = req.method === 'PUT' || req.method === 'PATCH';
    return this.companyProjectsService.saveFacilitatorRegistrationInfo(
      req.user.userId,
      projectId,
      dto,
      mergedFiles,
      isUpdate ? { isUpdate: true, skipMilestone: true } : undefined,
    );
  }

  @Get(':projectId/registration-info')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getRegistrationInfo(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getRegistrationInfo(
      req.user.userId,
      projectId,
    );
  }

  @Get(':projectId/facilitator-registration-info')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getFacilitatorRegistrationInfo(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFacilitatorRegistrationInfoByProjectId(
      projectId,
    );
  }

  /**
   * Admin-safe alias to fetch registration info by project id.
   * GET /api/company/projects/:projectId/admin/registration-data
   */
  @Get(':projectId/admin/registration-data')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getRegistrationInfoForAdminAlias(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getRegistrationInfoForAdmin(projectId);
  }

  /**
   * Admin: update registration form (same multipart fields as company POST).
   * PUT/PATCH /api/company/projects/:projectId/admin/registration-data
   */
  @Put(':projectId/admin/registration-data')
  @Patch(':projectId/admin/registration-data')
  @UseInterceptors(
    FileFieldsInterceptor(REGISTRATION_INFO_FILE_FIELDS, registrationInfoMulterOptions),
  )
  @UsePipes(createRegistrationInfoValidationPipe())
  async updateRegistrationInfoForAdmin(
    @Request() req,
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

  @Get(':projectId/registration-files/:fileType')
  async getRegistrationFile(
    @Param('projectId') projectId: string,
    @Param('fileType') fileType: string,
    @Res() res: Response,
  ) {
    const project = await this.companyProjectsService.getProjectForRegistrationFile(projectId);

    const download = await this.companyProjectsService.resolveRegistrationFileDownload(
      project.registration_info,
      fileType,
    );
    await this.companyProjectsService.streamRegistrationFileToResponse(res, download);
  }

  /**
   * **Proposal reupload (CII)** — allowed when there is **no** work-order row, WO **status is unset**, or latest WO is **rejected** (`wo_status = 2`). Same flags as `proposal_reupload_path` / `can_replace_proposal` on GET combined/proposal-document.
   *
   * **Client flow**
   * 1. `POST|PUT|PATCH` this URL with `multipart/form-data` and field `proposal_document` | `proposalDocument` | `file` (PDF).
   * 2. `response.data` is **proposal-only** (no `work_order` root or inside `proposal_workorder_documents`). For WO + proposal together, `GET …/proposal-workorder-documents/refresh`.
   * 3. Optional refetch: `GET …/proposal-workorder-documents/refresh` with `cache: 'no-store'`.
   *
   * Same multipart rules as `POST …/proposal-document` (first upload).
   * POST|PUT|PATCH …/proposal-document/reupload
   */
  @Post(':projectId/proposal-document/reupload')
  @Put(':projectId/proposal-document/reupload')
  @Patch(':projectId/proposal-document/reupload')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'proposal_document', maxCount: 1 },
        { name: 'proposalDocument', maxCount: 1 },
        { name: 'file', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const projectId = req.params.projectId;
            const uploadPath = join(process.cwd(), 'uploads', 'company', projectId);
            if (!fs.existsSync(uploadPath)) {
              fs.mkdirSync(uploadPath, { recursive: true });
              console.log(`[Proposal Document Reupload] Created directory: ${uploadPath}`);
            }
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            const filename = `proposal-${uniqueSuffix}${ext}`;
            cb(null, filename);
          },
        }),
        limits: {
          fileSize: 10 * 1024 * 1024,
        },
        fileFilter: (req, file, cb) => {
          const isPdfMime = file.mimetype === 'application/pdf';
          const isPdfExt = extname(file.originalname || '').toLowerCase() === '.pdf';
          if (isPdfMime && isPdfExt) {
            cb(null, true);
            return;
          }
          cb(new Error('Invalid file type. Only PDF is allowed.'), false);
        },
      },
    ),
  )
  async replaceProposalDocument(
    @Param('projectId') projectId: string,
    @UploadedFiles()
    files?: {
      proposal_document?: Express.Multer.File[];
      proposalDocument?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
  ): Promise<any> {
    const file = pickProposalMultipartPdf(files);
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use proposal_document, proposalDocument, or file.',
      });
    }
    assertNonEmptyProposalPdf(file);
    return this.companyProjectsService.replaceProposalDocumentByProjectId(projectId, file);
  }

  /**
   * Upload Proposal Document (Admin function - can be called directly or via MongoDB).
   * Response includes merged GET …/proposal-document fields and `data.proposal_document` (same shape as proposal-workorder-documents).
   * POST /api/company/projects/:projectId/proposal-document
   */
  @Post(':projectId/proposal-document')
  @Put(':projectId/proposal-document')
  @Patch(':projectId/proposal-document')
  @UseGuards()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'proposal_document', maxCount: 1 },
        { name: 'proposalDocument', maxCount: 1 },
        { name: 'file', maxCount: 1 },
      ],
      {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          // Use Laravel-compatible path: uploads/company/{projectId}/
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
            console.log(`[Proposal Document] Created directory: ${uploadPath}`);
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `proposal-${uniqueSuffix}${ext}`;
          console.log(`[Proposal Document] Generated filename: ${filename}`);
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
      fileFilter: (req, file, cb) => {
        const isPdfMime = file.mimetype === 'application/pdf';
        const isPdfExt = extname(file.originalname || '').toLowerCase() === '.pdf';
        if (isPdfMime && isPdfExt) {
          cb(null, true);
          return;
        }
        cb(new Error('Invalid file type. Only PDF is allowed.'), false);
      },
      },
    ),
  )
  async uploadProposalDocument(
    @Param('projectId') projectId: string,
    @UploadedFiles()
    files?: {
      proposal_document?: Express.Multer.File[];
      proposalDocument?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
  ): Promise<any> {
    const file = pickProposalMultipartPdf(files);

    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use proposal_document, proposalDocument, or file.',
      });
    }
    assertNonEmptyProposalPdf(file);

    console.log('[Proposal Document Controller] Upload request:', {
      projectId,
      filename: file.originalname,
      size: file.size,
    });

    return this.companyProjectsService.uploadProposalDocumentByProjectId(projectId, file);
  }

  /**
   * Same payload as GET proposal-document; JSON response is marked no-store for clients refreshing after reupload.
   * GET /api/company/projects/:projectId/proposal-document/reload
   */
  @Get(':projectId/proposal-document/reload')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async reloadProposalDocumentState(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getProposalDocumentByProjectId(projectId);
  }

  /**
   * Proposal PDF metadata only (no `work_order` object). Use this when you only care about the document after upload/reupload.
   * GET /api/company/projects/:projectId/proposal-document/document
   */
  @Get(':projectId/proposal-document/document')
  async getProposalDocumentFileInfo(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getProposalDocumentFileInfoByProjectId(projectId);
  }

  /**
   * Get proposal metadata (view URL, status, work order summary; can_replace_proposal when latest WO is rejected).
   * GET /api/company/projects/:projectId/proposal-document
   */
  @Get(':projectId/proposal-document')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async getProposalDocument(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getProposalDocumentByProjectId(projectId);
  }

  /**
   * Company dashboard Latest / Next for proposal (use after CII re-upload).
   * GET /api/company/projects/:projectId/proposal-document/workflow
   */
  @Get(':projectId/proposal-document/workflow')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async getProposalDocumentWorkflow(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getProposalDocumentWorkflowByProjectId(projectId);
  }

  /**
   * Company accepts or rejects the proposal PDF (before work-order upload).
   * PATCH|POST /api/company/projects/:projectId/proposal-document/review
   * Body: `{ "action": "accept" }` or `{ "status": "accept" }` (also `1` / `2`, `remark` / `remarks`).
   */
  @Patch(':projectId/proposal-document/review')
  @Post(':projectId/proposal-document/review')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async reviewProposalDocument(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: ReviewProposalDocumentDto,
  ): Promise<any> {
    const action = normalizeProposalReviewAction(dto);
    if (!action) {
      throw new BadRequestException({
        status: 'error',
        message: 'Provide action or status as "accept" or "reject" (status 1 = accept, 2 = reject)',
      });
    }
    const remarks = dto.remarks ?? dto.remark;
    const companyId = String(req?.user?.userId || '').trim();
    if (companyId) {
      return this.companyProjectsService.reviewProposalDocument(
        companyId,
        projectId,
        action,
        remarks,
      );
    }
    return this.companyProjectsService.reviewProposalDocumentByProjectId(
      projectId,
      action,
      remarks,
    );
  }

  @Get(':projectId/proposal-document/file')
  async viewProposalDocument(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.companyProjectsService.streamProposalDocumentByProjectId(projectId, res);
  }

  /**
   * DEV/TEST: Create proposal/work order notification for this project.
   * POST /api/company/projects/:projectId/info/create-notification
   */
  @Post(':projectId/info/create-notification')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async createProposalWorkOrderNotification(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.createProposalWorkOrderNotification(
      req.user.userId,
      projectId,
    );
  }

  /**
   * Upload Resource Center Document
   * POST /api/company/projects/:projectId/resource-documents
   */
  @Post(':projectId/resource-documents')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileInterceptor('resource_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'resources', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
            console.log(`[Resource Document] Created directory: ${uploadPath}`);
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `resource-${uniqueSuffix}${ext}`;
          console.log(`[Resource Document] Generated filename: ${filename}`);
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/jpg',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and images are allowed.'), false);
        }
      },
    }),
  )
  async uploadResourceDocument(
    @Request() req,
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; document_type?: string; description?: string },
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded',
      });
    }

    console.log('[Resource Document Controller] Upload request:', {
      projectId,
      filename: file.originalname,
      size: file.size,
      title: body.title,
      document_type: body.document_type,
    });

    return this.companyProjectsService.uploadResourceDocument(
      req.user.userId,
      projectId,
      file,
      body.title,
      body.document_type,
      body.description,
    );
  }

  /**
   * Get All Resource Center Documents
   * GET /api/company/projects/:projectId/resource-documents
   */
  @Get(':projectId/resource-documents')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getResourceDocuments(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getResourceDocuments(
      req.user.userId,
      projectId,
    );
  }

  /**
   * Update Assessment Submittal approval status and/or remarks.
   * PATCH /api/company/projects/:projectId/resource-documents/:documentId
   */
  @Patch(':projectId/resource-documents/:documentId')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateResourceDocument(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateAssessmentSubmittalDto,
  ): Promise<any> {
    return this.companyProjectsService.updateResourceDocumentStatus(
      req.user.userId,
      projectId,
      documentId,
      {
        document_status: dto.document_status,
        document_remarks: dto.document_remarks,
      },
    );
  }

  /**
   * **Refetch after proposal upload/reupload** — same body as `GET …/proposal-workorder-documents`, dedicated URL for dashboards (`useProposalRefresh()`).
   * Use `response.data.proposal_document` for proposal-only state; `data.work_order` for WO. Headers: `no-store`.
   * GET /api/company/projects/:projectId/proposal-workorder-documents/refresh
   */
  @Get(':projectId/proposal-workorder-documents/refresh')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async refreshProposalWorkOrderDocuments(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getProposalWorkOrderDocumentsByProjectId(projectId);
  }

  /**
   * Get Proposal/Work Order Documents (combined endpoint).
   * When `proposal_badge_label` is `"Rejected by company"`, `proposal_reupload_path` is set — use POST|PUT|PATCH there for the single proposal reupload API.
   * GET /api/company/projects/:projectId/proposal-workorder-documents
   */
  @Get(':projectId/proposal-workorder-documents')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async getProposalWorkOrderDocuments(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getProposalWorkOrderDocumentsByProjectId(projectId);
  }

  /**
   * Get Resources Center (all project documents: proposal, work order, launch/training, hand holding, assessment submittals).
   * GET /api/company/projects/:projectId/resources-center
   */
  @Get(':projectId/resources-center')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getResourcesCenter(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getResourcesCenterDocuments(
      req.user.userId,
      projectId,
    );
  }

  /**
   * Get Resources Center Documents (alias).
   * GET /api/company/projects/:projectId/resources-center-documents
   */
  @Get(':projectId/resources-center-documents')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getResourcesCenterDocuments(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getResourcesCenterDocuments(
      req.user.userId,
      projectId,
    );
  }

  /**
   * Get Launch And Training (Site Visit Report) – consultant/company page data.
   * GET /api/company/projects/:projectId/launch-and-training
   */
  @Get(':projectId/launch-and-training')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getLaunchAndTraining(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getLaunchAndTraining(
      req.user.userId,
      projectId,
    );
  }

  /**
   * Launch & Training Program — same payload as `/api/admin/projects/.../launch-training`.
   * Some admin UIs call the **company** API base (`/api/company/projects/...`); without these aliases, POST returns 404.
   */
  @Get(':projectId/launch-training')
  async getLaunchTrainingCompanyApiAlias(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getLaunchTrainingProgramForAdmin(projectId);
  }

  @Get(':projectId/launch-training-program')
  async getLaunchTrainingProgramCompanyApiAlias(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getLaunchTrainingProgramForAdmin(projectId);
  }

  @Post(':projectId/launch-training-sessions')
  @UseInterceptors(launchTrainingSessionUploadInterceptor())
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async postLaunchTrainingSessionsCompanyAlias(
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
  async postLaunchTrainingCompanyAlias(
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

  /**
   * Upload Launch And Training (Site Visit Report) – consultant/facilitator upload.
   * POST /api/company/projects/:projectId/launch-and-training-document
   * Body (multipart): launch_upload (file, PDF), launch_training_report_date (string).
   */
  @Post(':projectId/launch-and-training-document')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileInterceptor('launch_upload', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const companyId = (req as any).user?.userId;
          if (!companyId) {
            cb(new Error('Unauthorized'), '');
            return;
          }
          const uploadPath = join(
            process.cwd(),
            'uploads',
            'companyproject',
            'launchAndTraining',
            companyId,
          );
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const now = new Date();
          const ymdhis =
            now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
          const filename = `${ymdhis}_${file.originalname}`;
          cb(null, filename);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF files are allowed.'), false);
        }
      },
    }),
  )
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async uploadLaunchAndTraining(
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
    return this.companyProjectsService.uploadLaunchAndTraining(
      req.user.userId,
      projectId,
      file,
      dto.launch_training_report_date,
    );
  }

  /**
   * Get Assignment Details
   * GET /api/company/projects/:projectId/assignment-details
   */
  @Get(':projectId/assignment-details')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getAssignmentDetails(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getAssignmentDetails(
      req.user.userId,
      projectId,
    );
  }

  /**
   * Primary Data Form: load form + saved data (company).
   * GET /api/company/projects/:projectId/primary-data
   */
  @Get(':projectId/primary-data')
  async getPrimaryData(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    const companyId = req?.user?.userId;
    return this.companyProjectsService.getPrimaryData(companyId, projectId);
  }

  /**
   * Primary Data EE only: load Energy Efficiency section data.
   * GET /api/company/projects/:projectId/primary-data/ee
   */
  @Get(':projectId/primary-data/ee')
  async getPrimaryDataEe(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    const companyId = req?.user?.userId;
    return this.companyProjectsService.getPrimaryDataEe(companyId, projectId);
  }

  /**
   * Primary Data: list sections (info_type, tab_id, label).
   * GET /api/company/projects/:projectId/primary-data/sections
   */
  @Get(':projectId/primary-data/sections')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getPrimaryDataSections(): Promise<any> {
    return this.companyProjectsService.getPrimaryDataSections();
  }

  /**
   * Primary Data: save by section (form_type + payload). Optional final_submit.
   * POST /api/company/projects/:projectId/primary-data/save
   * Body: { form_type: "gi"|"ee"|...|"tar"|"all", data: {...} or [...], final_submit?: boolean }
   */
  @Post(':projectId/primary-data/save')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async savePrimaryData(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() body: { form_type?: string; data?: any; doc?: any[]; final_submit?: boolean; [key: string]: any },
  ): Promise<any> {
    const formType = body?.form_type ?? 'all';
    const payload = body?.data ?? body?.doc ?? (formType && body?.[formType]) ?? body;
    return this.companyProjectsService.savePrimaryDataBySection(
      req.user.userId,
      projectId,
      formType,
      payload,
      body?.final_submit,
    );
  }

  /**
   * Primary Data EE only: save with legacy EE payload shape.
   * POST /api/company/projects/:projectId/primary-data/ee
   * Body supports: form_type=ee, ee[6], ee[7], ... (same as legacy /company/primary_data/:projectId).
   */
  @Post(':projectId/primary-data/ee')
  async savePrimaryDataEe(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() body: { form_type?: string; formType?: string; ee?: Record<string, any> | any[]; [key: string]: any },
  ): Promise<any> {
    const companyId = req?.user?.userId;
    return this.companyProjectsService.savePrimaryDataEeByCompanyProjectId(
      companyId,
      projectId,
      body,
    );
  }

  /**
   * Primary Data: store (update/insert rows, no final submit).
   * POST /api/company/projects/:projectId/primary-data/store
   * Body: { doc: Array<PrimaryDataFormItem> | Record<data_id, PrimaryDataFormItem> }
   */
  @Post(':projectId/primary-data/store')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async storePrimaryData(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: PrimaryDataStoreDto,
  ): Promise<any> {
    return this.companyProjectsService.storePrimaryData(
      req.user.userId,
      projectId,
      dto.doc,
    );
  }

  /**
   * Primary Data: final submit (sets final_submit = 1, activity + notifications).
   * POST /api/company/projects/:projectId/primary-data/submit
   */
  @Post(':projectId/primary-data/submit')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async submitPrimaryData(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: PrimaryDataStoreDto,
  ): Promise<any> {
    return this.companyProjectsService.submitPrimaryData(
      req.user.userId,
      projectId,
      dto.doc,
    );
  }

  /**
   * Primary Data: update documents (set document path and document_status = 0).
   * POST /api/company/projects/:projectId/primary-data/update
   * Body: { updates: [{ data_id: string, document?: string }] }
   */
  @Post(':projectId/primary-data/update')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async updatePrimaryData(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() body: { updates: { data_id: string; document?: string }[] },
  ): Promise<any> {
    if (!body.updates || !Array.isArray(body.updates)) {
      throw new BadRequestException({ status: 'error', message: 'updates array required' });
    }
    return this.companyProjectsService.updatePrimaryData(
      req.user.userId,
      projectId,
      body.updates,
    );
  }

  /**
   * Primary Data: Admin approval view (submitted data grouped by info_type).
   * GET /api/company/projects/:projectId/primary-data/approval
   */
  @Get(':projectId/primary-data/approval')
  async getPrimaryDataForApproval(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getPrimaryDataForApproval(projectId);
  }

  /**
   * Primary Data: Admin approve/reject one section (form_type + status + remark).
   * POST /api/company/projects/:projectId/primary-data/approval
   */
  @Post(':projectId/primary-data/approval')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async primaryDataFormApproval(
    @Param('projectId') projectId: string,
    @Body() dto: PrimaryDataFormApprovalDto,
  ): Promise<any> {
    return this.companyProjectsService.primaryDataFormApproval(
      projectId,
      dto.form_type,
      dto.status,
      dto.remark ?? dto.remarks,
    );
  }

  /**
   * Primary Data: Export section to Excel.
   * GET /api/company/projects/:projectId/primary-data/export/:section
   */
  @Get(':projectId/primary-data/export/:section')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async exportPrimaryDataSection(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('section') section: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.companyProjectsService.exportPrimaryDataSection(
      req.user.userId,
      projectId,
      section,
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * Primary Data: Import section from Excel.
   * POST /api/company/projects/:projectId/primary-data/import/:section
   * Body: multipart, file field name "file".
   */
  @Post(':projectId/primary-data/import/:section')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const ok =
          file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.originalname?.toLowerCase().endsWith('.xlsx');
        if (ok) cb(null, true);
        else cb(new Error('Only .xlsx files are allowed'), false);
      },
    }),
  )
  async importPrimaryDataSection(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('section') section: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({ status: 'error', message: 'No file uploaded. Use field name "file".' });
    }
    return this.companyProjectsService.importPrimaryDataSection(
      req.user.userId,
      projectId,
      section,
      file,
    );
  }

  /**
   * Finance v2 (new API): create/list Proforma/Tax invoice rows with SGST/CGST/IGST + reminder settings.
   * These endpoints are separate from legacy `/invoices/*` APIs.
   */
  @Get([':projectId/finance-v2/proforma-invoices', ':projectId/finance-v2/invoices'])
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async getFinanceV2Invoices(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFinanceV2InvoicesByProjectId(projectId);
  }

  /**
   * Finance v2: Tax invoices (same data family as proforma; filter client-side by invoice_type if needed).
   * GET /api/company/projects/:projectId/finance-v2/tax-invoices
   */
  @Get([':projectId/finance-v2/tax-invoices', ':projectId/finance-v2/tax-tab'])
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async getFinanceV2TaxInvoices(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFinanceV2InvoicesByProjectId(projectId);
  }

  @Post([':projectId/finance-v2/proforma-invoices', ':projectId/finance-v2/invoices'])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('invoice_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'finance-v2');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `finance-v2-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invoice document must be PDF, JPG, JPEG or PNG.'), false);
        }
      },
    }),
  )
  async createFinanceV2Invoice(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProformaInvoiceV2Dto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use field name "invoice_document".',
      });
    }
    return this.companyProjectsService.createFinanceV2InvoiceByProjectId(projectId, dto, file);
  }

  @Post([':projectId/finance-v2/tax-invoices', ':projectId/finance-v2/tax-tab'])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('invoice_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'finance-v2');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `finance-v2-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invoice document must be PDF, JPG, JPEG or PNG.'), false);
        }
      },
    }),
  )
  async createFinanceV2TaxInvoice(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProformaInvoiceV2Dto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use field name "invoice_document".',
      });
    }
    return this.companyProjectsService.createFinanceV2InvoiceByProjectId(
      projectId,
      { ...dto, invoice_type: 'tax', payment_for: 'inv', payment_type: 'tax' },
      file,
    );
  }

  @Patch([
    ':projectId/finance-v2/proforma-invoices/:invoiceId',
    ':projectId/finance-v2/invoices/:invoiceId',
    ':projectId/finance-v2/tax-invoices/:invoiceId',
    ':projectId/finance-v2/tax-tab/:invoiceId',
  ])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('invoice_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'finance-v2');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `finance-v2-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invoice document must be PDF, JPG, JPEG or PNG.'), false);
        }
      },
    }),
  )
  async updateFinanceV2Invoice(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateProformaInvoiceV2Dto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<any> {
    return this.companyProjectsService.updateFinanceV2InvoiceByProjectId(projectId, invoiceId, dto, file);
  }

  @Patch(':projectId/finance-v2/proforma-invoices/:invoiceId/reminder-settings')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateFinanceV2ReminderSettings(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateFinanceV2ReminderDto,
  ): Promise<any> {
    return this.companyProjectsService.updateFinanceV2ReminderSettingsByProjectId(
      projectId,
      invoiceId,
      dto,
    );
  }

  @Post([
    ':projectId/finance-v2/proforma-invoices/:invoiceId/submit-payment',
    ':projectId/finance-v2/tax-invoices/:invoiceId/submit-payment',
    ':projectId/finance-v2/tax-tab/:invoiceId/submit-payment',
    ':projectId/finance-v2/invoices/:invoiceId/submit-payment',
  ])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'supportingdocument', maxCount: 1 },
      { name: 'supporting_document', maxCount: 1 },
      { name: 'supportingDocument', maxCount: 1 },
      { name: 'file', maxCount: 1 },
    ], {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'finance-v2-payments');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `finance-v2-payment-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Supporting document must be PDF, JPG, JPEG or PNG.'), false);
      },
    }),
  )
  async submitFinanceV2Payment(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: SubmitFinanceV2PaymentDto,
    @UploadedFiles()
    files?: {
      supportingdocument?: Express.Multer.File[];
      supporting_document?: Express.Multer.File[];
      supportingDocument?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
  ): Promise<any> {
    const file =
      files?.supportingdocument?.[0] ||
      files?.supporting_document?.[0] ||
      files?.supportingDocument?.[0] ||
      files?.file?.[0];
    return this.companyProjectsService.submitFinanceV2PaymentByProjectId(
      projectId,
      invoiceId,
      dto,
      file,
    );
  }

  @Patch([
    ':projectId/finance-v2/proforma-invoices/:invoiceId/approval',
    ':projectId/finance-v2/tax-invoices/:invoiceId/approval',
    ':projectId/finance-v2/tax-tab/:invoiceId/approval',
  ])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateFinanceV2Approval(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateFinanceV2ApprovalDto,
  ): Promise<any> {
    return this.companyProjectsService.updateFinanceV2ApprovalByProjectId(
      projectId,
      invoiceId,
      dto,
    );
  }

  /**
   * Finance v2 reminders (new API):
   * - send pending reminders due as of now (+15 day rollover)
   * - trigger one invoice reminder immediately
   */
  @Post(':projectId/finance-v2/proforma-invoices/reminders/process')
  async processFinanceV2Reminders(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.processFinanceV2RemindersForProjectByProjectId(projectId);
  }

  @Post(':projectId/finance-v2/proforma-invoices/:invoiceId/reminder/send-now')
  async sendFinanceV2ReminderNow(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
  ): Promise<any> {
    return this.companyProjectsService.sendFinanceV2ReminderNowByProjectId(projectId, invoiceId);
  }

  /**
   * Finance: Payments/Proforma invoices (payment_for = per_inv).
   * GET /api/company/projects/:projectId/proforma-invoices
   *
   * Response: `{ status, message, data: { invoices, ... } }` where `data.invoices[]` matches
   * frontend `CompanyInvoiceItem` keys including: `trans_id`, `payment_type` ('Online' | 'Offline'),
   * `offline_tran_doc` (absolute URL), `offline_tran_doc_filename`.
   */
  @Get(':projectId/proforma-invoices')
  async getProformaInvoices(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getInvoicesByProjectId(projectId, 'per_inv');
  }

  /**
   * Finance: Tax Invoices (payment_for = inv).
   * GET /api/company/projects/:projectId/tax-invoices
   *
   * Same response shape as proforma-invoices: `data.invoices[]` with `trans_id`, `payment_type`,
   * `offline_tran_doc`, `offline_tran_doc_filename` (and other invoice fields from `getInvoices`).
   */
  @Get(':projectId/tax-invoices')
  async getTaxInvoices(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getInvoicesByProjectId(projectId, 'inv');
  }

  /**
   * Finance: CII uploads PI (Proforma Invoice) or Tax Invoice — next step after Assign Project Co-Ordinator / Resource Center.
   * POST /api/company/projects/:projectId/invoices/upload
   * Form: payment_for = 'per_inv' | 'inv', file = invoice_document (PDF, etc.)
   */
  @Post(':projectId/invoices/upload')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileInterceptor('invoice_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const companyId = (req as any).user?.userId;
          const uploadPath = join(process.cwd(), 'uploads', 'company', companyId || 'unknown', 'invoices');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const paymentFor = (req as any).body?.payment_for === 'inv' ? 'tax' : 'proforma';
          const ext = extname(file.originalname);
          cb(null, `${paymentFor}-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/jpg',
          'image/png',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invoice document must be PDF, DOC, DOCX or image.'), false);
        }
      },
    }),
  )
  async uploadInvoiceDocument(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() body: { payment_for?: string },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Please select an invoice document (PDF, DOC, DOCX or image).',
      });
    }
    const paymentFor = body.payment_for === 'inv' ? 'inv' : 'per_inv';
    return this.companyProjectsService.uploadInvoiceDocument(
      req.user.userId,
      projectId,
      paymentFor,
      file,
    );
  }

  /**
   * Finance: Submit payment for an invoice (payment type, transaction ID, supporting document).
   * POST /api/company/projects/:projectId/invoices/:invoiceId/submit-payment
   */
  @Post(':projectId/invoices/:invoiceId/submit-payment')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'supportingdocument', maxCount: 1 },
      { name: 'supporting_document', maxCount: 1 },
      { name: 'supportingDocument', maxCount: 1 },
      { name: 'file', maxCount: 1 },
    ], {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const companyIdOrProjectId = (req as any).user?.userId || (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', companyIdOrProjectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `payment-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Supporting document must be PDF, JPG, JPEG or PNG.'), false);
        }
      },
    }),
  )
  async submitPayment(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: SubmitPaymentDto,
    @UploadedFiles()
    files?: {
      supportingdocument?: Express.Multer.File[];
      supporting_document?: Express.Multer.File[];
      supportingDocument?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
  ): Promise<any> {
    const file =
      files?.supportingdocument?.[0] ||
      files?.supporting_document?.[0] ||
      files?.supportingDocument?.[0] ||
      files?.file?.[0];
    return this.companyProjectsService.submitPaymentByProjectId(
      projectId,
      invoiceId,
      dto,
      file,
    );
  }

  /**
   * Finance: Update invoice approval status (admin or backend).
   * PATCH /api/company/projects/:projectId/invoices/:invoiceId/approval
   * Body: { "approval_status": 0 | 1 | 2 | 3 } — 0=Pending, 1=Approved, 2=Rejected, 3=Under Review
   */
  @Patch(':projectId/invoices/:invoiceId/approval')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateInvoiceApproval(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateInvoiceApprovalDto,
  ): Promise<any> {
    return this.companyProjectsService.updateInvoiceApprovalStatusByProjectId(
      projectId,
      invoiceId,
      dto.approval_status,
    );
  }

  /**
   * Company re-uploads work order PDF after **CII/admin rejected** it (`wo_status = 2`).
   * POST /api/company/projects/:projectId/work-order-document/reupload
   */
  @Post(':projectId/work-order-document/reupload')
  @UseInterceptors(
    FileInterceptor('workorderdocument', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'companyproject', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const ext = extname(file.originalname);
          cb(null, `${timestamp}_${file.originalname}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF files are allowed.'), false);
        }
      },
    }),
  )
  async reuploadWorkOrderDocument(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use field workorderdocument (PDF).',
      });
    }
    return this.companyProjectsService.reuploadWorkOrderDocumentByProjectId(projectId, file);
  }

  /**
   * Disabled — company does not accept/reject work order. Use upload/reupload; admin uses PATCH …/review.
   */
  @Patch(':projectId/work-order-document/company-review')
  @Post(':projectId/work-order-document/company-review')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async reviewWorkOrderDocumentByCompany(
    @Param('projectId') projectId: string,
    @Body() dto: ReviewWorkOrderDocumentDto,
  ): Promise<any> {
    const action = normalizeWorkOrderReviewAction(dto);
    if (!action) {
      throw new BadRequestException({
        status: 'error',
        message: 'Provide action or status as "accept" or "reject" (status 1 = accept, 2 = reject)',
      });
    }
    const remarks = dto.remarks ?? dto.remark;
    return this.companyProjectsService.reviewWorkOrderDocumentByCompanyByProjectId(
      projectId,
      action,
      remarks,
    );
  }

  /**
   * CII/Admin accept or reject **company-uploaded** work order.
   * PATCH /api/company/projects/:projectId/work-order-document/review
   * Body: { "wo_status": 1 | 2, "wo_remarks": "..." } (remarks required when wo_status is 2)
   */
  @Patch(':projectId/work-order-document/review')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async reviewWorkOrderDocument(
    @Param('projectId') projectId: string,
    @Body() dto: ApproveWorkOrderDto,
  ): Promise<any> {
    if (dto.wo_status === 2 && !dto.wo_remarks) {
      throw new BadRequestException({
        status: 'error',
        message: 'Remarks are required when rejecting work order',
      });
    }
    return this.companyProjectsService.updateWorkOrderStatusByProjectId(projectId, dto);
  }

  /**
   * GET PO number + acceptance date (and suggested default date when accepted but not yet saved).
   * GET /api/company/projects/:projectId/work-order-document/acceptance
   */
  @Get(':projectId/work-order-document/acceptance')
  async getWorkOrderAcceptanceDetails(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getWorkOrderAcceptanceDetailsByProjectId(projectId);
  }

  /**
   * Save PO number + acceptance date after work order is accepted (wo_status = 1).
   * PATCH /api/company/projects/:projectId/work-order-document/acceptance
   * Body: { "wo_po_number": "PO-123", "wo_acceptance_date": "2026-04-11" } — date cannot be in the future.
   */
  @Patch(':projectId/work-order-document/acceptance')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async setWorkOrderAcceptanceDetails(
    @Param('projectId') projectId: string,
    @Body() dto: WorkOrderAcceptanceDetailsDto,
  ): Promise<any> {
    return this.companyProjectsService.setWorkOrderAcceptanceDetailsByProjectId(projectId, dto);
  }

  /**
   * Company uploads work order PDF (proposal must be accepted first).
   * POST /api/company/projects/:projectId/work-order-document
   * Multipart field: workorderdocument (PDF).
   */
  @Post(':projectId/work-order-document')
  @UseInterceptors(
    FileInterceptor('workorderdocument', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          // Use Laravel-compatible path: uploads/companyproject/{projectId}/
          const uploadPath = join(process.cwd(), 'uploads', 'companyproject', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
            console.log(`[Work Order Upload] Created directory: ${uploadPath}`);
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const ext = extname(file.originalname);
          const filename = `${timestamp}_${file.originalname}`;
          console.log(`[Work Order Upload] Generated filename: ${filename}`);
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
      fileFilter: (req, file, cb) => {
        // Only allow PDF files
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF files are allowed.'), false);
        }
      },
    }),
  )
  async uploadWorkOrderDocument(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Please select a PDF file.',
      });
    }

    console.log('[Work Order Upload Controller] Upload request:', {
      projectId,
      filename: file.originalname,
      size: file.size,
    });

    return this.companyProjectsService.uploadWorkOrderDocumentByProjectId(projectId, file);
  }

  /**
   * Alias of POST …/work-order-document (company upload).
   * POST /api/company/projects/:projectId/work-order-document/company-upload
   */
  @Post(':projectId/work-order-document/company-upload')
  @UseInterceptors(
    FileInterceptor('workorderdocument', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'companyproject', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          cb(null, `${timestamp}_${file.originalname}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF files are allowed.'), false);
        }
      },
    }),
  )
  async uploadWorkOrderDocumentAsCompany(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use field workorderdocument (PDF).',
      });
    }
    const resolved = await this.companyProjectsService.resolveProjectForQuickview(projectId);
    if (!resolved?.company_id) {
      throw new NotFoundException({ status: 'error', message: 'Project not found' });
    }
    return this.companyProjectsService.uploadWorkOrderDocument(
      String(resolved.company_id),
      String(resolved._id),
      file,
    );
  }

  /**
   * Company dashboard Latest / Next for work order (refresh after CII upload/re-upload).
   * GET /api/company/projects/:projectId/work-order-document/workflow
   */
  @Get(':projectId/work-order-document/workflow')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async getWorkOrderDocumentWorkflow(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getWorkOrderDocumentWorkflowByProjectId(projectId);
  }

  /**
   * Latest work order metadata + status for any panel (Mongo project id or company id in path).
   * GET /api/company/projects/:projectId/work-order-document
   */
  @Get(':projectId/work-order-document')
  async getWorkOrderDocument(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getWorkOrderDocumentByProjectId(projectId);
  }

  @Get(':projectId/facilitator-contract-document')
  async getFacilitatorContractDocument(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getWorkOrderDocumentByProjectId(projectId);
  }

  @Post(':projectId/facilitator-contract-document')
  @UseInterceptors(
    FileInterceptor('workorderdocument', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'companyproject', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          cb(null, `${timestamp}_${file.originalname}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Invalid file type. Only PDF files are allowed.'), false);
      },
    }),
  )
  async uploadFacilitatorContractDocument(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Please select a PDF file.',
      });
    }
    return this.companyProjectsService.uploadFacilitatorContractDocumentByProjectId(
      projectId,
      file,
    );
  }

  @Post(':projectId/facilitator-contract-document/reupload')
  @UseInterceptors(
    FileInterceptor('workorderdocument', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'companyproject', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          cb(null, `${timestamp}_${file.originalname}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Invalid file type. Only PDF files are allowed.'), false);
      },
    }),
  )
  async reuploadFacilitatorContractDocument(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use field workorderdocument (PDF).',
      });
    }
    return this.companyProjectsService.reuploadFacilitatorContractDocumentByProjectId(
      projectId,
      file,
    );
  }

  @Patch(':projectId/facilitator-contract-document/review')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async reviewFacilitatorContractDocument(
    @Param('projectId') projectId: string,
    @Body() dto: ApproveWorkOrderDto,
  ): Promise<any> {
    if (dto.wo_status === 2 && !dto.wo_remarks) {
      throw new BadRequestException({
        status: 'error',
        message: 'Remarks are required when rejecting work order',
      });
    }
    return this.companyProjectsService.updateWorkOrderStatusByProjectId(projectId, dto);
  }

  @Get(':projectId/facilitator-contract-document/acceptance')
  async getFacilitatorContractAcceptance(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getWorkOrderAcceptanceDetailsByProjectId(projectId);
  }

  @Patch(':projectId/facilitator-contract-document/acceptance')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async setFacilitatorContractAcceptance(
    @Param('projectId') projectId: string,
    @Body() dto: WorkOrderAcceptanceDetailsDto,
  ): Promise<any> {
    return this.companyProjectsService.setWorkOrderAcceptanceDetailsByProjectId(projectId, dto);
  }

  /**
   * Update latest work order status (accept/reject) when caller uses company JWT.
   * PATCH /api/company/projects/:projectId/work-order-document/status
   */
  @Patch(':projectId/work-order-document/status')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async updateWorkOrderStatus(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: ApproveWorkOrderDto,
  ): Promise<any> {
    if (dto.wo_status === 2 && !dto.wo_remarks) {
      throw new BadRequestException({
        status: 'error',
        message: 'Remarks are required when rejecting work order',
      });
    }
    return this.companyProjectsService.updateWorkOrderStatus(
      req.user.userId,
      projectId,
      dto,
    );
  }

  /**
   * Approve/Reject Work Order Document (Admin action)
   * POST /api/company/projects/:projectId/work-order/:workOrderId/approve
   */
  @Post(':projectId/work-order/:workOrderId/approve')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async approveWorkOrder(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('workOrderId') workOrderId: string,
    @Body() dto: ApproveWorkOrderDto,
  ): Promise<any> {
    // Validate remarks if rejecting
    if (dto.wo_status === 2 && !dto.wo_remarks) {
      throw new BadRequestException({
        status: 'error',
        message: 'Remarks are required when rejecting work order',
      });
    }

    return this.companyProjectsService.approveWorkOrder(
      req.user.userId,
      projectId,
      workOrderId,
      dto,
    );
  }

  /**
   * Get Project Details (for tab visibility)
   * GET /api/company/projects/:projectId/details
   */
  @Get(':projectId/details')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getProjectDetails(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getProjectDetails(
      req.user.userId,
      projectId,
    );
  }

  /**
   * GET project code + flags for Quick View (assign after PO / inline edit).
   * GET /api/company/projects/:projectId/project-code
   */
  @Get(':projectId/project-code')
  async getProjectCodeAssignment(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getProjectCodeAssignmentByProjectId(projectId);
  }

  /**
   * POST assign or update project code (admin; path = Mongo project id or company id).
   * First assign runs milestone 6; updates only change the code string.
   * POST /api/company/projects/:projectId/project-code/upsert
   * Body: { "project_code": "CI2604006" }
   */
  @Post(':projectId/project-code/upsert')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async upsertProjectCode(
    @Param('projectId') projectId: string,
    @Body() dto: ProjectCodeUpsertDto,
  ): Promise<any> {
    return this.companyProjectsService.upsertProjectCodeByProjectId(projectId, dto.project_code);
  }

  /**
   * Same as POST .../project-code/upsert — shorter URL for UIs.
   * POST /api/company/projects/:projectId/project-code/assign
   * Body: { "project_code": "CI2604006" }
   */
  @Post(':projectId/project-code/assign')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async assignProjectCode(
    @Param('projectId') projectId: string,
    @Body() dto: ProjectCodeUpsertDto,
  ): Promise<any> {
    return this.companyProjectsService.upsertProjectCodeByProjectId(projectId, dto.project_code);
  }

  /**
   * Create Project Code (Milestone 6)
   * POST /api/company/projects/:projectId/project-code
   * Admin creates a unique project code for a company project
   */
  @Post(':projectId/project-code')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async createProjectCode(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectCodeDto,
  ): Promise<any> {
    return this.companyProjectsService.createProjectCode(
      req.user.userId,
      projectId,
      dto.project_id,
    );
  }

  /**
   * Assign Assessor (Site Visit Scheduling)
   * POST /api/company/projects/:projectId/assign-assessor
   * Body: { assessor_id: string, visit_dates?: string[] }
   */
  @Post(':projectId/assign-assessor')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async assignAssessor(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: AssignAssessorDto,
  ): Promise<any> {
    return this.companyProjectsService.assignAssessor(
      req.user.userId,
      projectId,
      dto.assessor_id,
      dto.visit_dates,
    );
  }

  /**
   * Remove Assessor assignment by assessor id or assignment id.
   * DELETE /api/company/projects/:projectId/assessors/:assessorId
   */
  @Delete(':projectId/assessors/:assessorId')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async removeAssessorAssignment(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('assessorId') assessorId: string,
  ): Promise<any> {
    return this.companyProjectsService.removeAssessorAssignment(
      req.user.userId,
      projectId,
      assessorId,
    );
  }

  /**
   * Assign Coordinator (Milestone 7)
   * POST /api/company/projects/:projectId/assign-coordinator
   * Admin assigns a coordinator to a company project
   */
  @Post(':projectId/assign-coordinator')
  async assignCoordinator(
    @Param('projectId') projectId: string,
    /** Raw body: global ValidationPipe strips unknown keys from DTOs; keep full payload for assign. */
    @Body() body: Record<string, unknown>,
  ): Promise<any> {
    return this.companyProjectsService.assignCoordinatorByProjectId(projectId, body);
  }

  /**
   * GET /api/company/projects/:projectId/assignments — coordinators, facilitator, limits, flags
   */
  @Get(':projectId/assignments')
  async getProjectAssignments(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getProjectAssignmentsByProjectId(projectId);
  }

  /**
   * DELETE /api/company/projects/:projectId/coordinators/:assignmentId — remove one coordinator slot
   */
  @Delete(':projectId/coordinators/:assignmentId')
  async removeCoordinatorAssignment(
    @Param('projectId') projectId: string,
    @Param('assignmentId') assignmentId: string,
  ): Promise<any> {
    return this.companyProjectsService.removeCoordinatorAssignmentByProjectId(projectId, assignmentId);
  }

  /**
   * DELETE /api/company/projects/:projectId/facilitator — remove facilitator (CI + Facilitator flow)
   */
  @Delete(':projectId/facilitator')
  async removeFacilitatorAssignment(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.removeFacilitatorAssignmentByProjectId(projectId);
  }

  /**
   * Assign Facilitator
   * POST /api/company/projects/:projectId/assign-facilitator
   * Admin assigns a facilitator to a company project
   */
  @Post(':projectId/assign-facilitator')
  @UseInterceptors(
    FileInterceptor('contract_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'facilitator-contracts', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `contract-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Allow PDF and image files
        if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PDF and image files are allowed for contract document.'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async assignFacilitator(
    @Param('projectId') projectId: string,
    @Body() dto: AssignFacilitatorDto,
    @UploadedFile() contractDocument?: Express.Multer.File,
  ): Promise<any> {
    return this.companyProjectsService.assignFacilitatorByProjectId(
      projectId,
      dto.facilitator_id,
      dto.contract_fee,
      contractDocument,
    );
  }
}
