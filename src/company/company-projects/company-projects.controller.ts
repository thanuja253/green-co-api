import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
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
import { join } from 'path';
import * as fs from 'fs';
import { CompleteMilestoneDto } from './dto/complete-milestone.dto';
import { RegistrationInfoDto } from './dto/registration-info.dto';
import { ApproveWorkOrderDto } from './dto/approve-workorder.dto';
import { CreateProjectCodeDto } from './dto/create-project-code.dto';
import { AssignCoordinatorDto } from './dto/assign-coordinator.dto';
import { AssignAssessorDto } from './dto/assign-assessor.dto';
import { AssignFacilitatorDto } from './dto/assign-facilitator.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { UpdateInvoiceApprovalDto } from './dto/update-invoice-approval.dto';
import { UploadLaunchAndTrainingDto } from './dto/upload-launch-and-training.dto';
import { AddLaunchTrainingSessionDto } from './dto/add-launch-training-session.dto';
import { PrimaryDataStoreDto } from './dto/primary-data-store.dto';
import { PrimaryDataFormApprovalDto } from './dto/primary-data-approval.dto';
import { UpdateAssessmentSubmittalDto } from './dto/update-assessment-submittal.dto';
import { ScoreBandStatusDto } from './dto/score-band-status.dto';
import { AdminJwtAuthGuard } from '../../admin/admin-auth/guards/admin-jwt-auth.guard';
import { UpdateQuickviewDataDto } from './dto/update-quickview-data.dto';
import { ReviewProposalDto } from './dto/review-proposal.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';
import { WorkOrderPoDetailsDto } from './dto/work-order-po-details.dto';
import { mergeNestedRegistrationBody } from './registration-info-normalize';

@Controller('api/company/projects')
export class CompanyProjectsController {
  constructor(
    private readonly companyProjectsService: CompanyProjectsService,
  ) {}

  /**
   * List all active coordinators (for admin dropdown).
   * GET /api/company/projects/coordinators
   */
  @Get('coordinators')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
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
   * Create a new recertification project (no project code yet; copies registration_info).
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
    @Request() req,
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    const project = await this.companyProjectsService.getProject(
      req.user.userId,
      projectId,
    );

    if (!project.certificate_document_url) {
      throw new NotFoundException({
        status: 'error',
        message: 'Certificate document not found',
      });
    }

    const filePath = join(process.cwd(), project.certificate_document_url);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException({
        status: 'error',
        message: 'Certificate file not found on server',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${project.certificate_document_filename || 'certificate.pdf'}"`,
    );

    return res.sendFile(filePath);
  }

  @Get(':projectId/feedback-document')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getFeedbackDocument(
    @Request() req,
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    const project = await this.companyProjectsService.getProject(
      req.user.userId,
      projectId,
    );

    if (!project.feedback_document_url) {
      throw new NotFoundException({
        status: 'error',
        message: 'Feedback document not found',
      });
    }

    const filePath = join(process.cwd(), project.feedback_document_url);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException({
        status: 'error',
        message: 'Feedback file not found on server',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${project.feedback_document_filename || 'feedback.pdf'}"`,
    );

    return res.sendFile(filePath);
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

  /**
   * GET /api/company/projects/:projectId/quickview
   * Open route (no JWT): param may be project _id or company _id — matches admin workflow-status / registration-data.
   */
  @Get(':projectId/quickview')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  async getQuickview(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getQuickviewDataForAdmin(projectId);
  }

  /**
   * GET /api/company/projects/:projectId/workflow-status
   * Same next/latest step logic as quickview, smaller payload for other panels.
   */
  @Get(':projectId/workflow-status')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getWorkflowStatus(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getWorkflowStatus(req.user.userId, projectId);
  }

  /**
   * GET /api/company/projects/:projectId/admin/workflow-status
   * Same as workflow-status; :projectId may be company id or project id. Open route — protect in production.
   */
  @Get(':projectId/admin/workflow-status')
  async getWorkflowStatusAdmin(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getWorkflowStatusForAdmin(projectId);
  }

  /**
   * PATCH /api/company/projects/:projectId/quickview-data
   * Company panel update API for quickview-shown fields.
   */
  @Patch(':projectId/quickview-data')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateQuickviewData(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateQuickviewDataDto,
  ): Promise<any> {
    return this.companyProjectsService.updateQuickviewData(
      req.user.userId,
      projectId,
      dto,
      false,
    );
  }

  /**
   * PATCH /api/company/projects/:projectId/admin/quickview-data
   * Admin panel update API for same quickview fields.
   */
  @Patch(':projectId/admin/quickview-data')
  @UseGuards(AdminJwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateQuickviewDataAsAdmin(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateQuickviewDataDto,
  ): Promise<any> {
    return this.companyProjectsService.updateQuickviewData(
      null,
      projectId,
      dto,
      true,
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

  @Post(':projectId/registration-info')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'company_brief_profile', maxCount: 1 },
        { name: 'brief_profile', maxCount: 1 }, // Alternative field name
        { name: 'turnover_document', maxCount: 1 },
        { name: 'turnover', maxCount: 1 }, // Alternative field name
        { name: 'sez_document', maxCount: 1 },
        { name: 'sez_input', maxCount: 1 }, // Alternative field name
      ],
      {
      storage: diskStorage({
        destination: (req, file, cb) => {
          console.log('[File Upload Interceptor] ====== INTERCEPTOR RUNNING ======');
          console.log('[File Upload Interceptor] Destination callback called', {
            contentType: req.headers['content-type'],
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          });
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'registration', projectId);
          // Create directory if it doesn't exist
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
            console.log(`[File Upload] Created directory: ${uploadPath}`);
          }
          console.log(`[File Upload] Saving file to: ${uploadPath}`, {
            fieldname: file.fieldname,
            originalname: file.originalname,
          });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          // Generate unique filename: fieldname-timestamp.extension
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const fieldName = file.fieldname || 'file';
          const filename = `${fieldName}-${uniqueSuffix}${ext}`;
          console.log(`[File Upload] Generated filename: ${filename}`, {
            originalname: file.originalname,
            fieldname: file.fieldname,
            extension: ext,
          });
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
      fileFilter: (req, file, cb) => {
        console.log('[File Upload Filter] Checking file:', {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
        });
        
        // SEZ document: PDF only. Other registration docs keep existing allowed types.
        if (file.fieldname === 'sez_document' || file.fieldname === 'sez_input') {
          if (file.mimetype === 'application/pdf') {
            console.log('[File Upload Filter] SEZ file accepted:', file.originalname);
            cb(null, true);
          } else {
            console.log('[File Upload Filter] SEZ file rejected - invalid type:', file.mimetype);
            cb(new Error(`Invalid SEZ file type: ${file.mimetype}. Only PDF is allowed.`), false);
          }
          return;
        }

        // Allow PDF, DOC, DOCX, images
        const allowedMimes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/jpg',
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
          console.log('[File Upload Filter] File accepted:', file.originalname);
          cb(null, true);
        } else {
          console.log('[File Upload Filter] File rejected - invalid type:', file.mimetype);
          cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, DOC, DOCX, and images are allowed.`), false);
        }
      },
    }),
  )
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false, // CRITICAL: Allow extra fields (overrides global pipe)
      skipMissingProperties: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Custom exception factory to ignore file field errors
      exceptionFactory: (errors) => {
        if (!errors || errors.length === 0) {
          return null as any;
        }
        
        // Filter out errors for file fields (they're handled separately via @UploadedFiles)
        const filteredErrors = errors.filter(
          (error) =>
            error.property !== 'company_brief_profile' &&
            error.property !== 'turnover_document' &&
            error.property !== 'brief_profile' &&
            error.property !== 'turnover' &&
            error.property !== 'sez_document' &&
            error.property !== 'sez_input',
        );
        
        // If all errors are for file fields, ignore them completely
        if (filteredErrors.length === 0) {
          // Return a pass-through (no error) - file fields are handled separately
          return null as any;
        }
        
        // Return validation errors only for non-file fields
        const formattedErrors: Record<string, string[]> = {};
        filteredErrors.forEach((error) => {
          if (error.constraints) {
            formattedErrors[error.property] = Object.values(error.constraints);
          }
        });
        
        return new BadRequestException({
          status: 'error',
          message: 'Validation failed',
          errors: formattedErrors,
        });
      },
    }),
  )
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
      sez_input?: Express.Multer.File[];
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
      sez_document: files?.sez_document?.length || 0,
      sez_input: files?.sez_input?.length || 0,
    });
    
    // Also check req.files (Multer might put files there as fallback)
    const reqFiles = (req as any).files;
    console.log('[Registration Info Controller] req.files (fallback):', reqFiles);
    console.log('[Registration Info Controller] req.file (single file fallback):', (req as any).file);
    
    // If @UploadedFiles() is empty but req.files has data, use that instead
    if ((!files || Object.keys(files).length === 0) && reqFiles && Object.keys(reqFiles).length > 0) {
      console.log('[Registration Info Controller] Using req.files as fallback');
      files = reqFiles;
    }
    
    console.log('[Registration Info Controller] Final files to pass to service:', {
      hasFiles: !!files,
      filesKeys: files ? Object.keys(files) : [],
    });

    if (files) {
      if (files.company_brief_profile?.[0]) {
        console.log('[Registration Info] Company Brief Profile file:', {
          filename: files.company_brief_profile[0].filename,
          originalname: files.company_brief_profile[0].originalname,
          size: files.company_brief_profile[0].size,
          mimetype: files.company_brief_profile[0].mimetype,
        });
      }
      if (files.turnover_document?.[0]) {
        console.log('[Registration Info] Turnover Document file:', {
          filename: files.turnover_document[0].filename,
          originalname: files.turnover_document[0].originalname,
          size: files.turnover_document[0].size,
          mimetype: files.turnover_document[0].mimetype,
        });
      }
    }

    // Clean up body - remove empty file field objects
    let cleanedBody = { ...body };
    if (cleanedBody.company_brief_profile && typeof cleanedBody.company_brief_profile === 'object' && Object.keys(cleanedBody.company_brief_profile).length === 0) {
      delete cleanedBody.company_brief_profile;
    }
    if (cleanedBody.turnover_document && typeof cleanedBody.turnover_document === 'object' && Object.keys(cleanedBody.turnover_document).length === 0) {
      delete cleanedBody.turnover_document;
    }
    if (cleanedBody.brief_profile && typeof cleanedBody.brief_profile === 'object' && Object.keys(cleanedBody.brief_profile).length === 0) {
      delete cleanedBody.brief_profile;
    }
    if (cleanedBody.turnover && typeof cleanedBody.turnover === 'object' && Object.keys(cleanedBody.turnover).length === 0) {
      delete cleanedBody.turnover;
    }
    if (cleanedBody.sez_document && typeof cleanedBody.sez_document === 'object' && Object.keys(cleanedBody.sez_document).length === 0) {
      delete cleanedBody.sez_document;
    }
    if (cleanedBody.sez_input && typeof cleanedBody.sez_input === 'object' && Object.keys(cleanedBody.sez_input).length === 0) {
      delete cleanedBody.sez_input;
    }

    // Flatten nested JSON shapes: { payload: {...} }, { registration_info: {...} }, { data: {...} }
    cleanedBody = mergeNestedRegistrationBody(cleanedBody);
    this.validateRegistrationInfoPayload(cleanedBody);

    // Convert to DTO
    const dto = cleanedBody as RegistrationInfoDto;

    console.log('[Registration Info Controller] Calling service with:', {
      hasFiles: !!files,
      filesKeys: files ? Object.keys(files) : [],
      dtoKeys: Object.keys(dto).slice(0, 5), // First 5 keys
    });

    const result = await this.companyProjectsService.saveRegistrationInfo(
      req.user.userId,
      projectId,
      dto,
      files,
    );

    console.log('[Registration Info Controller] Service returned:', {
      status: result.status,
      hasData: !!result.data,
    });

    return result;
  }

  private pickFirst(body: Record<string, any>, keys: string[]): any {
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined && body[k] !== null) {
        return body[k];
      }
    }
    return undefined;
  }

  private toCleanString(v: any): string {
    if (v === undefined || v === null) return '';
    return String(v).trim();
  }

  private validateRegistrationInfoPayload(body: Record<string, any>): void {
    const errors: Record<string, string[]> = {};
    const addErr = (field: string, msg: string) => {
      if (!errors[field]) errors[field] = [];
      errors[field].push(msg);
    };

    const companyName = this.toCleanString(this.pickFirst(body, ['company_name', 'companyName', 'name']));
    const email = this.toCleanString(this.pickFirst(body, ['email', 'company_email', 'companyEmail']));
    const mobile = this.toCleanString(this.pickFirst(body, ['mobileno', 'mobile', 'company_mobile', 'companyMobile']));
    const city = this.toCleanString(this.pickFirst(body, ['location', 'city']));
    const state = this.toCleanString(this.pickFirst(body, ['state', 'state_id']));
    const postalAddress = this.toCleanString(this.pickFirst(body, ['postaladdress', 'plant_address']));
    const postalPincode = this.toCleanString(this.pickFirst(body, ['postal_address_pincode', 'plant_pincode']));
    const billingAddress = this.toCleanString(this.pickFirst(body, ['billingaddress', 'billing_address']));
    const billingPincode = this.toCleanString(this.pickFirst(body, ['billing_address_pincode', 'billing_pincode']));
    const plantEmail = this.toCleanString(this.pickFirst(body, ['plant_email', 'plant_head_email']));
    const plantContact = this.toCleanString(this.pickFirst(body, ['plant_contact_no', 'plant_head_mobile']));
    const industry = this.toCleanString(this.pickFirst(body, ['industry', 'industry_id']));
    const entity = this.toCleanString(this.pickFirst(body, ['entity', 'entity_id']));
    const sector = this.toCleanString(this.pickFirst(body, ['sector', 'sector_id']));
    const companyTypeSez = this.pickFirst(body, ['company_type_sez', 'is_sez', 'isSez']);
    const latestTurnover = this.toCleanString(this.pickFirst(body, ['latestturnover', 'turnover']));
    const electrical = this.toCleanString(this.pickFirst(body, ['electricalenergyconsumption']));
    const thermal = this.toCleanString(this.pickFirst(body, ['thermalenergyconsumption']));
    const water = this.toCleanString(this.pickFirst(body, ['waterconsumption']));
    const tanNo = this.toCleanString(this.pickFirst(body, ['tanno', 'tan_no']));
    const panNo = this.toCleanString(this.pickFirst(body, ['panno', 'pan_no', 'pan_number']));
    const gstinNo = this.toCleanString(this.pickFirst(body, ['gstinno', 'gstin_no', 'gstin']));
    const declaration = this.pickFirst(body, ['inlineCheckbox', 'declaration', 'is_declaration_accepted']);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const indianMobileRegex = /^[6-9][0-9]{9}$/;
    const cityRegex = /^[A-Za-z ]+$/;
    const indianPincodeRegex = /^[1-9][0-9]{5}$/;
    const decimalTwoRegex = /^\d+(\.\d{1,2})?$/;
    const tanRegex = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    const hasDoubleSpaces = (s: string) => /\s{2,}/.test(s);

    if (!companyName) addErr('company_name', 'Company name is required');
    else {
      if (companyName.length < 3 || companyName.length > 50) addErr('company_name', 'Company name must be between 3 and 50 characters');
      if (hasDoubleSpaces(companyName)) addErr('company_name', 'Company name cannot contain multiple consecutive spaces');
    }

    if (!email) addErr('email', 'Email is required');
    else if (!emailRegex.test(email)) addErr('email', 'Email format is invalid');

    // Some clients don't post company mobile on edit/update calls; validate format only when provided.
    if (mobile && !indianMobileRegex.test(mobile)) {
      addErr('mobileno', 'Mobile number must be a valid 10-digit Indian number');
    }

    if (!city) addErr('location', 'City is required');
    else {
      if (city.length < 3 || city.length > 50) addErr('location', 'City must be between 3 and 50 characters');
      if (!cityRegex.test(city)) addErr('location', 'City can contain only letters and spaces');
      if (hasDoubleSpaces(city)) addErr('location', 'City cannot contain multiple consecutive spaces');
    }

    if (!state) addErr('state', 'State is required');

    if (!postalAddress) addErr('postaladdress', 'Postal address is required');
    else if (postalAddress.length < 10 || postalAddress.length > 150) addErr('postaladdress', 'Postal address must be between 10 and 150 characters');

    if (!postalPincode) addErr('postal_address_pincode', 'Postal address pincode is required');
    else if (!indianPincodeRegex.test(postalPincode)) addErr('postal_address_pincode', 'Postal address pincode must be a valid 6-digit Indian pincode');

    if (!billingAddress) addErr('billingaddress', 'Billing address is required');
    else if (billingAddress.length < 10 || billingAddress.length > 150) addErr('billingaddress', 'Billing address must be between 10 and 150 characters');

    if (!billingPincode) addErr('billing_address_pincode', 'Billing address pincode is required');
    else if (!indianPincodeRegex.test(billingPincode)) addErr('billing_address_pincode', 'Billing address pincode must be a valid 6-digit Indian pincode');

    if (!plantEmail) addErr('plant_email', 'Plant email is required');
    else if (!emailRegex.test(plantEmail)) addErr('plant_email', 'Plant email format is invalid');

    if (!plantContact) addErr('plant_contact_no', 'Plant contact number is required');
    else if (!indianMobileRegex.test(plantContact)) addErr('plant_contact_no', 'Plant contact number must be a valid 10-digit Indian number');

    if (!industry) addErr('industry', 'Industry is required');
    if (!entity) addErr('entity', 'Entity is required');
    if (!sector) addErr('sector', 'Sector is required');

    if (companyTypeSez === undefined || companyTypeSez === null || String(companyTypeSez).trim() === '') {
      addErr('company_type_sez', 'Company type SEZ is required');
    }

    if (!latestTurnover) addErr('latestturnover', 'Latest turnover is required');
    else if (!decimalTwoRegex.test(latestTurnover)) addErr('latestturnover', 'Latest turnover must be a valid number with up to 2 decimal places');

    if (electrical && !decimalTwoRegex.test(electrical)) {
      addErr('electricalenergyconsumption', 'Electrical energy consumption must be a valid number with up to 2 decimal places');
    }

    if (thermal && !decimalTwoRegex.test(thermal)) {
      addErr('thermalenergyconsumption', 'Thermal energy consumption must be a valid number with up to 2 decimal places');
    }

    if (water && !decimalTwoRegex.test(water)) {
      addErr('waterconsumption', 'Water consumption must be a valid number with up to 2 decimal places');
    }

    if (!tanNo) addErr('tanno', 'TAN number is required');
    else if (!tanRegex.test(tanNo.toUpperCase())) addErr('tanno', 'TAN number format is invalid');

    if (!panNo) addErr('panno', 'PAN number is required');
    else if (!panRegex.test(panNo.toUpperCase())) addErr('panno', 'PAN number format is invalid');

    if (!gstinNo) addErr('gstinno', 'GSTIN number is required');
    else if (!gstRegex.test(gstinNo.toUpperCase())) addErr('gstinno', 'GSTIN number format is invalid');

    const declarationAccepted =
      declaration === true ||
      declaration === 1 ||
      declaration === '1' ||
      String(declaration).toLowerCase() === 'true' ||
      String(declaration).toLowerCase() === 'on' ||
      String(declaration).toLowerCase() === 'yes';
    // Allow update calls that don't resend checkbox; enforce only when declaration field is posted.
    if (declaration !== undefined && declaration !== null && !declarationAccepted) {
      addErr('inlineCheckbox', 'Declaration is required');
    }

    if (Object.keys(errors).length > 0) {
      throw new BadRequestException({
        status: 'error',
        message: 'Validation failed',
        errors,
      });
    }
  }

  @Get(':projectId/registration-info')
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

  /**
   * GET /api/company/projects/:projectId/registration-data
   * Alias for registration-info, returns saved registration form + masters.
   */
  @Get(':projectId/registration-data')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getRegistrationData(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getRegistrationInfo(
      req.user.userId,
      projectId,
    );
  }

  /**
   * GET /api/company/projects/:projectId/admin/registration-data
   * Registration payload + masters. Param may be project _id **or** company _id
   * (same id as GET registered-companies `items[].id`).
   * No auth guard: open for local/admin tooling; do not expose publicly without a reverse proxy rule.
   */
  @Get(':projectId/admin/registration-data')
  async getAdminRegistrationData(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getRegistrationInfoForAdmin(projectId);
  }

  @Get(':projectId/registration-files/:fileType')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getRegistrationFile(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('fileType') fileType: string,
    @Res() res: Response,
  ) {
    const project = await this.companyProjectsService.getProject(
      req.user.userId,
      projectId,
    );

    const registrationInfo = project.registration_info || {};
    let filePath: string | null = null;
    let filename: string = 'file';

    if (fileType === 'company-brief-profile' || fileType === 'brief-profile') {
      filePath = registrationInfo.company_brief_profile_url;
      filename = registrationInfo.company_brief_profile_filename || 'company_brief_profile';
    } else if (fileType === 'turnover-document' || fileType === 'turnover') {
      filePath = registrationInfo.turnover_document_url;
      filename = registrationInfo.turnover_document_filename || 'turnover_document';
    } else if (fileType === 'sez-document' || fileType === 'sez-input' || fileType === 'sez') {
      filePath = registrationInfo.sez_document_url;
      filename = registrationInfo.sez_document_filename || 'sez_document.pdf';
    }

    if (!filePath) {
      throw new NotFoundException({
        status: 'error',
        message: 'File not found',
      });
    }

    // Extract relative path from URL if it's a full URL
    const relativePath = filePath.startsWith('http')
      ? filePath.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '')
      : filePath;

    const fullPath = join(process.cwd(), relativePath);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException({
        status: 'error',
        message: 'File not found on server',
      });
    }

    // Determine content type based on file extension
    const ext = extname(filename).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };

    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    return res.sendFile(fullPath);
  }

  /**
   * Upload Proposal Document (Admin function - can be called directly or via MongoDB)
   * POST /api/company/projects/:projectId/proposal-document
   */
  @Post(':projectId/proposal-document')
  @UseGuards(AdminJwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('proposal_document', {
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
        const allowedMimes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF, DOC, DOCX are allowed.'), false);
        }
      },
    }),
  )
  async uploadProposalDocument(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded',
      });
    }

    console.log('[Proposal Document Controller] Upload request:', {
      projectId,
      filename: file.originalname,
      size: file.size,
    });

    return this.companyProjectsService.uploadProposalDocumentForAdmin(projectId, file);
  }

  /**
   * Upload Proposal Document (Admin upload responsibility).
   * POST /api/company/projects/:projectId/admin/proposal-document
   */
  @Post(':projectId/admin/proposal-document')
  @UseGuards(AdminJwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('proposal_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `proposal-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowedMimes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invalid file type. Only PDF, DOC, DOCX are allowed.'), false);
      },
    }),
  )
  async uploadProposalDocumentAsAdmin(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded',
      });
    }
    return this.companyProjectsService.uploadProposalDocumentForAdmin(projectId, file);
  }

  /**
   * Admin: form defaults + saved PO fields (after WO approved, before project code).
   * GET /api/company/projects/:projectId/admin/work-order-po
   */
  @Get(':projectId/admin/work-order-po')
  @UseGuards(AdminJwtAuthGuard)
  async getWorkOrderPoAdmin(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getWorkOrderPoAdminFormForAdmin(projectId);
  }

  /**
   * Admin: save PO number + acceptance date (not in the future). Required before project code if WO was approved.
   * PATCH /api/company/projects/:projectId/admin/work-order-po
   */
  @Patch(':projectId/admin/work-order-po')
  @UseGuards(AdminJwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async patchWorkOrderPoAdmin(
    @Param('projectId') projectId: string,
    @Body() dto: WorkOrderPoDetailsDto,
  ): Promise<any> {
    return this.companyProjectsService.saveWorkOrderPoDetailsForAdmin(projectId, dto);
  }

  /**
   * Admin: create project code (same rules as company route + PO gate when WO approved).
   * POST /api/company/projects/:projectId/admin/project-code
   */
  @Post(':projectId/admin/project-code')
  @UseGuards(AdminJwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createProjectCodeAdmin(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectCodeDto,
  ): Promise<any> {
    return this.companyProjectsService.createProjectCodeForAdmin(projectId, dto.project_id);
  }

  /**
   * Company accepts/rejects proposal document.
   * POST /api/company/projects/:projectId/proposal/approval
   */
  @Post(':projectId/proposal/approval')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async reviewProposalDocument(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: ReviewProposalDto,
  ): Promise<any> {
    if (dto.proposal_status === 2 && !dto.proposal_remarks) {
      throw new BadRequestException({
        status: 'error',
        message: 'Remarks are required when rejecting proposal',
      });
    }
    return this.companyProjectsService.reviewProposalDocument(
      req.user.userId,
      projectId,
      dto,
    );
  }

  /**
   * Company updates proposal decision with string status.
   * PATCH /api/company/projects/:projectId/proposal-document/status
   * Body: { status: "accepted" | "rejected", remarks?: string }
   */
  @Patch(':projectId/proposal-document/status')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateProposalStatus(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProposalStatusDto,
  ): Promise<any> {
    if (dto.status === 'rejected' && !dto.remarks) {
      throw new BadRequestException({
        status: 'error',
        message: 'Remarks are required when rejecting proposal',
      });
    }
    return this.companyProjectsService.reviewProposalDocument(
      req.user.userId,
      projectId,
      {
        proposal_status: dto.status === 'accepted' ? 1 : 2,
        proposal_remarks: dto.remarks,
      },
    );
  }

  /**
   * Get Proposal Document
   * GET /api/company/projects/:projectId/proposal-document
   */
  @Get(':projectId/proposal-document')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getProposalDocument(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getProposalDocument(
      req.user.userId,
      projectId,
    );
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
   * Get Proposal/Work Order Documents (combined endpoint)
   * GET /api/company/projects/:projectId/proposal-workorder-documents
   *
   * Open route (no company JWT): same id resolution as quickview — `:projectId` may be project _id or company _id.
   * Lets admin dashboard load this page without a company Bearer token.
   */
  @Get(':projectId/proposal-workorder-documents')
  async getProposalWorkOrderDocuments(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getProposalWorkOrderDocumentsForAdmin(projectId);
  }

  /**
   * Admin: identical JSON to GET .../proposal-workorder-documents; requires admin JWT.
   * `:projectId` may be project _id or company _id.
   */
  @Get(':projectId/admin/proposal-workorder-documents')
  @UseGuards(AdminJwtAuthGuard)
  async getProposalWorkOrderDocumentsAdmin(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getProposalWorkOrderDocumentsForAdmin(projectId);
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
   * Get Launch And Training – up to 4 sessions, read-only for company.
   * GET /api/company/projects/:projectId/launch-and-training
   *
   * `data.sessions`: uploaded sessions (document_url, document_filename, session_date, uploaded_at, session_index).
   * `data.launch_training_document` / `launch_training_report_date`: first session or legacy (older UIs).
   * Also: sessions_count, max_sessions (4), coordinator_assigned, section_available, legacy_single.
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
   * Admin: same GET as company; projectId may be company _id or project _id.
   * GET /api/company/projects/:projectId/admin/launch-and-training
   *
   * Prefer dashboard route: GET /api/admin/projects/:projectId/launch-training-program (includes id_resolution).
   */
  @Get(':projectId/admin/launch-and-training')
  @UseGuards(AdminJwtAuthGuard)
  async getLaunchAndTrainingAdmin(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getLaunchAndTrainingForAdmin(projectId);
  }

  /**
   * Add/replace Launch & Training session 1–4 (PDF). Requires coordinator assigned.
   * POST /api/company/projects/:projectId/launch-and-training/sessions
   * Multipart: launch_upload (file), session_index (1–4), session_date (optional).
   */
  @Post(':projectId/launch-and-training/sessions')
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
  async addLaunchTrainingSession(
    @Request() req,
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AddLaunchTrainingSessionDto,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Please select a PDF file (launch_upload).',
      });
    }
    return this.companyProjectsService.addLaunchTrainingSession(
      req.user.userId,
      projectId,
      file,
      dto,
    );
  }

  /**
   * Admin: add/replace Launch & Training session (resolved company + project like other admin routes).
   * POST /api/company/projects/:projectId/admin/launch-and-training/sessions
   */
  @Post(':projectId/admin/launch-and-training/sessions')
  @UseGuards(AdminJwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('launch_upload', {
      storage: memoryStorage(),
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
  async addLaunchTrainingSessionAdmin(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AddLaunchTrainingSessionDto,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Please select a PDF file (launch_upload).',
      });
    }
    return this.companyProjectsService.addLaunchTrainingSessionForAdmin(projectId, file, dto);
  }

  /**
   * Upload Launch And Training (Site Visit Report) – consultant/facilitator upload.
   * POST /api/company/projects/:projectId/launch-and-training-document
   * Body (multipart): launch_upload (file, PDF), launch_training_report_date (string).
   * Same as session_index 1 on POST .../launch-and-training/sessions.
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
   * Admin: legacy session-1 upload (memory → saved under resolved company folder in service).
   * POST /api/company/projects/:projectId/admin/launch-and-training-document
   */
  @Post(':projectId/admin/launch-and-training-document')
  @UseGuards(AdminJwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('launch_upload', {
      storage: memoryStorage(),
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
  async uploadLaunchAndTrainingAdmin(
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
    return this.companyProjectsService.uploadLaunchAndTrainingForAdmin(
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
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getPrimaryData(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getPrimaryData(req.user.userId, projectId);
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
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getPrimaryDataForApproval(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getPrimaryDataForApproval(projectId);
  }

  /**
   * Primary Data: Admin approve/reject one section (form_type + status + remark).
   * POST /api/company/projects/:projectId/primary-data/approval
   */
  @Post(':projectId/primary-data/approval')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async primaryDataFormApproval(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: PrimaryDataFormApprovalDto,
  ): Promise<any> {
    return this.companyProjectsService.primaryDataFormApproval(
      req.user.userId,
      projectId,
      dto.form_type,
      dto.status,
      dto.remark,
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
   * Finance: Payments/Proforma invoices (payment_for = per_inv).
   * GET /api/company/projects/:projectId/proforma-invoices
   */
  @Get(':projectId/proforma-invoices')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getProformaInvoices(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getInvoices(
      req.user.userId,
      projectId,
      'per_inv',
    );
  }

  /**
   * Finance: Tax Invoices (payment_for = inv).
   * GET /api/company/projects/:projectId/tax-invoices
   */
  @Get(':projectId/tax-invoices')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getTaxInvoices(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getInvoices(
      req.user.userId,
      projectId,
      'inv',
    );
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
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('supportingdocument', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const companyId = (req as any).user?.userId;
          const uploadPath = join(process.cwd(), 'uploads', 'company', companyId || 'unknown');
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
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: SubmitPaymentDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<any> {
    return this.companyProjectsService.submitPayment(
      req.user.userId,
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
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateInvoiceApproval(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateInvoiceApprovalDto,
  ): Promise<any> {
    return this.companyProjectsService.updateInvoiceApprovalStatus(
      req.user.userId,
      projectId,
      invoiceId,
      dto.approval_status,
    );
  }

  /**
   * Upload Work Order Document (Company uploads)
   * POST /api/company/projects/:projectId/work-order-document
   */
  @Post(':projectId/work-order-document')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
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
    @Request() req,
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

    return this.companyProjectsService.uploadWorkOrderDocument(
      req.user.userId,
      projectId,
      file,
    );
  }

  /**
   * Get latest Work Order document metadata.
   * GET /api/company/projects/:projectId/work-order-document
   */
  @Get(':projectId/work-order-document')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getWorkOrderDocument(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getWorkOrderDocument(
      req.user.userId,
      projectId,
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
   * Assign Coordinator (Milestone 7)
   * POST /api/company/projects/:projectId/assign-coordinator
   * Admin assigns a coordinator to a company project
   */
  @Post(':projectId/assign-coordinator')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async assignCoordinator(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: AssignCoordinatorDto,
  ): Promise<any> {
    return this.companyProjectsService.assignCoordinator(
      req.user.userId,
      projectId,
      dto.coordinator_id,
    );
  }

  /**
   * Assign Facilitator
   * POST /api/company/projects/:projectId/assign-facilitator
   * Admin assigns a facilitator to a company project
   */
  @Post(':projectId/assign-facilitator')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
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
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: AssignFacilitatorDto,
    @UploadedFile() contractDocument?: Express.Multer.File,
  ): Promise<any> {
    return this.companyProjectsService.assignFacilitator(
      req.user.userId,
      projectId,
      dto.facilitator_id,
      dto.contract_fee,
      contractDocument,
    );
  }
}
