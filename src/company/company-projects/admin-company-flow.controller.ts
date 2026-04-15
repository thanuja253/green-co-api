import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
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
import { ReportsQueryDto } from './dto/reports-query.dto';
import { AssignFacilitatorDto } from './dto/assign-facilitator.dto';
import { CreateCoordinatorDto } from './dto/create-coordinator.dto';
import { UpdateCoordinatorDto } from './dto/update-coordinator.dto';
import { UpsertPlaqueDetailsDto } from './dto/upsert-plaque-details.dto';
import { UpsertOutstandingDetailsDto } from './dto/upsert-outstanding-details.dto';
import { OutstandingDuePaymentDto } from './dto/outstanding-due-payment.dto';
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

  @Get('api/admin/projects/:projectId/quickview')
  @Get('admin/projects/:projectId/quickview')
  async getQuickviewForAdmin(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getQuickviewDataForAdmin(projectId);
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

  @Post('api/admin/assessors/:assessorId/approval-status')
  @Post('admin/assessors/:assessorId/approval-status')
  @Post('api/admin/assessors/:assessorId/approve')
  @Post('admin/assessors/:assessorId/approve')
  @Post('api/admin/assessors/:assessorId/reject')
  @Post('admin/assessors/:assessorId/reject')
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
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async assignAssessor(
    @Param('companyProjectId') companyProjectId: string,
    @Body() dto: AdminAssignAssessorDto,
  ): Promise<any> {
    return this.companyProjectsService.assignAssessorAdminFlow(
      companyProjectId,
      dto.selectassessor,
      dto.assessor_date,
      dto.assessor_amount,
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
    return this.companyProjectsService.upsertOutstandingDetailsByProjectId(projectId, dto);
  }

  @Patch('api/admin/projects/:projectId/outstanding')
  @Patch('admin/projects/:projectId/outstanding')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateOutstandingDetails(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertOutstandingDetailsDto,
  ): Promise<any> {
    return this.companyProjectsService.upsertOutstandingDetailsByProjectId(projectId, dto);
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
      return { status: 'error', message: 'Some Error Occurred...' };
    }
  }
}

