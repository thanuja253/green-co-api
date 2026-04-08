import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UploadedFiles, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { Request, Response } from 'express';
import { CompanyProjectsService } from './company-projects.service';
import { AdminAssignAssessorDto } from './dto/admin-assign-assessor.dto';
import { AdminPaymentStatusDto } from './dto/admin-payment-status.dto';
import { CreateAssessorDto } from './dto/create-assessor.dto';
import { CreateAssessorProfileDto } from './dto/create-assessor-profile.dto';
import { ListAssessorsQueryDto } from './dto/list-assessors-query.dto';
import { UpdateAssessorApprovalDto } from './dto/update-assessor-approval.dto';

@Controller()
export class AdminCompanyFlowController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

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
}

