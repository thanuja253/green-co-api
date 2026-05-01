import { Body, Controller, Get, Param, Post, Put, Query, Req, UploadedFiles, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { FacilitatorsService } from './facilitators.service';
import { CreateFacilitatorDto } from './dto/create-facilitator.dto';
import { CreateFacilitatorProfileDto } from './dto/create-facilitator-profile.dto';
import { ListFacilitatorsQueryDto } from './dto/list-facilitators-query.dto';
import { UpdateFacilitatorApprovalDto } from './dto/update-facilitator-approval.dto';
import { UpdateFacilitatorDocumentApprovalDto } from './dto/update-facilitator-document-approval.dto';
import { Request } from 'express';

@Controller()
export class FacilitatorsController {
  constructor(private readonly facilitatorsService: FacilitatorsService) {}

  @Get('api/company/facilitators')
  @Get('company/facilitators')
  async getFacilitators() {
    return this.facilitatorsService.getFacilitators();
  }

  @Post('admin/facilitators')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createFacilitator(@Body() dto: CreateFacilitatorDto): Promise<any> {
    const mobile = (dto.mobile || dto.mobile_number || '').trim();
    return this.facilitatorsService.createFacilitatorAdminFlow(dto.name, dto.email, mobile);
  }

  @Post('api/admin/facilitators')
  @Post('api/admin/facilitators/create')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createFacilitatorApi(@Body() dto: CreateFacilitatorDto): Promise<any> {
    const mobile = (dto.mobile || dto.mobile_number || '').trim();
    return this.facilitatorsService.createFacilitatorAdminFlow(dto.name, dto.email, mobile);
  }

  @Post('admin/facilitators/create')
  @Post('api/admin/facilitators/create')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createFacilitatorCreateAlias(@Body() dto: CreateFacilitatorDto): Promise<any> {
    const mobile = (dto.mobile || dto.mobile_number || '').trim();
    return this.facilitatorsService.createFacilitatorAdminFlow(dto.name, dto.email, mobile);
  }

  @Post('api/admin/facilitators/create')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createFacilitatorCreateApiAlias(@Body() dto: CreateFacilitatorDto): Promise<any> {
    const mobile = (dto.mobile || dto.mobile_number || '').trim();
    return this.facilitatorsService.createFacilitatorAdminFlow(dto.name, dto.email, mobile);
  }

  @Get('admin/facilitators')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listFacilitators(@Query() query: ListFacilitatorsQueryDto): Promise<any> {
    return this.facilitatorsService.listFacilitatorsAdminFlow(query);
  }

  @Get('api/admin/facilitators')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listFacilitatorsApi(@Query() query: ListFacilitatorsQueryDto): Promise<any> {
    return this.facilitatorsService.listFacilitatorsAdminFlow(query);
  }

  @Get('admin/facilitators/:facilitatorId')
  @Get('facilitators/:facilitatorId')
  async getFacilitator(@Param('facilitatorId') facilitatorId: string): Promise<any> {
    return this.facilitatorsService.getFacilitatorAdminFlow(facilitatorId);
  }

  @Get('api/admin/facilitators/:facilitatorId')
  async getFacilitatorApi(@Param('facilitatorId') facilitatorId: string): Promise<any> {
    return this.facilitatorsService.getFacilitatorAdminFlow(facilitatorId);
  }

  @Get('api/admin/facilitators/:facilitatorId/profile-data')
  @Get('admin/facilitators/:facilitatorId/profile-data')
  async getFacilitatorProfileData(@Param('facilitatorId') facilitatorId: string): Promise<any> {
    return this.facilitatorsService.getFacilitatorAdminFlow(facilitatorId);
  }

  @Get('api/admin/facilitators/:facilitatorId/approval-status')
  @Get('admin/facilitators/:facilitatorId/approval-status')
  async getFacilitatorApprovalStatus(@Param('facilitatorId') facilitatorId: string): Promise<any> {
    return this.facilitatorsService.getFacilitatorApprovalStatusAdminFlow(facilitatorId);
  }

  @Post('api/admin/facilitators/:facilitatorId/approval-status')
  @Post('admin/facilitators/:facilitatorId/approval-status')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateFacilitatorApproval(
    @Param('facilitatorId') facilitatorId: string,
    @Body() dto: UpdateFacilitatorApprovalDto,
    @Req() req: Request,
  ): Promise<any> {
    const status = 'approved';
    return this.facilitatorsService.updateFacilitatorApprovalStatusAdminFlow(
      facilitatorId,
      status,
      dto.remarks,
    );
  }

  @Post('api/admin/facilitators/:facilitatorId/approve')
  @Post('admin/facilitators/:facilitatorId/approve')
  async approveFacilitator(@Param('facilitatorId') facilitatorId: string): Promise<any> {
    return this.facilitatorsService.updateFacilitatorApprovalStatusAdminFlow(
      facilitatorId,
      'approved',
      '',
    );
  }

  @Post('api/admin/facilitators/:facilitatorId/reject')
  @Post('admin/facilitators/:facilitatorId/reject')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async rejectFacilitator(
    @Param('facilitatorId') facilitatorId: string,
    @Body() dto: UpdateFacilitatorApprovalDto,
  ): Promise<any> {
    return this.facilitatorsService.updateFacilitatorApprovalStatusAdminFlow(
      facilitatorId,
      'rejected',
      dto.remarks,
    );
  }

  @Post('api/admin/facilitators/:facilitatorId/approval-status/reset')
  @Post('admin/facilitators/:facilitatorId/approval-status/reset')
  async resetFacilitatorApprovalStatus(@Param('facilitatorId') facilitatorId: string): Promise<any> {
    return this.facilitatorsService.resetFacilitatorApprovalStatusAdminFlow(facilitatorId);
  }

  /**
   * Admin: approve/reject/pending one facilitator-uploaded document.
   * Re-upload by facilitator resets that document to Pending.
   */
  @Post('api/admin/facilitators/:facilitatorId/documents/:documentKey/approval-status')
  @Post('admin/facilitators/:facilitatorId/documents/:documentKey/approval-status')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateFacilitatorDocumentApproval(
    @Param('facilitatorId') facilitatorId: string,
    @Param('documentKey') documentKey: string,
    @Body() dto: UpdateFacilitatorDocumentApprovalDto,
  ): Promise<any> {
    return this.facilitatorsService.updateFacilitatorDocumentApprovalAdminFlow(
      facilitatorId,
      documentKey,
      dto.status,
      dto.remarks,
    );
  }

  @Post('admin/facilitators/profile')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'biodata', maxCount: 1 },
        { name: 'brief_profile_individual', maxCount: 1 },
        { name: 'brief_profile_organization', maxCount: 1 },
        { name: 'projects_handled', maxCount: 1 },
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
            const uploadPath = join(process.cwd(), 'uploads', 'facilitators');
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
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
  async createFacilitatorProfile(
    @Body() body: Record<string, any>,
    @UploadedFiles()
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      brief_profile_individual?: Express.Multer.File[];
      brief_profile_organization?: Express.Multer.File[];
      projects_handled?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ): Promise<any> {
    const dto: CreateFacilitatorProfileDto = {
      ...body,
      name: String(body?.name || body?.facilitator_name || body?.company_name || '').trim() || undefined,
      email:
        String(body?.email || body?.facilitator_email || body?.company_email || '')
          .trim()
          .toLowerCase() || undefined,
    };
    return this.facilitatorsService.upsertFacilitatorProfileAdminFlow(dto, files);
  }

  @Post('api/admin/facilitators/profile')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'biodata', maxCount: 1 },
        { name: 'brief_profile_individual', maxCount: 1 },
        { name: 'brief_profile_organization', maxCount: 1 },
        { name: 'projects_handled', maxCount: 1 },
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
            const uploadPath = join(process.cwd(), 'uploads', 'facilitators');
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
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
  async createFacilitatorProfileApi(
    @Body() body: Record<string, any>,
    @UploadedFiles()
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      brief_profile_individual?: Express.Multer.File[];
      brief_profile_organization?: Express.Multer.File[];
      projects_handled?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ): Promise<any> {
    return this.createFacilitatorProfile(body, files);
  }

  @Post('api/admin/facilitators/profile/upsert')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'biodata', maxCount: 1 },
        { name: 'brief_profile_individual', maxCount: 1 },
        { name: 'brief_profile_organization', maxCount: 1 },
        { name: 'projects_handled', maxCount: 1 },
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
            const uploadPath = join(process.cwd(), 'uploads', 'facilitators');
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
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
  async upsertFacilitatorProfile(
    @Body() body: Record<string, any>,
    @UploadedFiles()
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      brief_profile_individual?: Express.Multer.File[];
      brief_profile_organization?: Express.Multer.File[];
      projects_handled?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ): Promise<any> {
    const dto: CreateFacilitatorProfileDto = {
      ...body,
      name: String(body?.name || body?.facilitator_name || body?.company_name || '').trim() || undefined,
      email:
        String(body?.email || body?.facilitator_email || body?.company_email || '')
          .trim()
          .toLowerCase() || undefined,
    };
    return this.facilitatorsService.upsertFacilitatorProfileAdminFlow(dto, files);
  }

  @Put('api/admin/facilitators/:facilitatorId/edit')
  @Put('api/admin/facilitators/:facilitatorId')
  @Put('admin/facilitators/:facilitatorId/edit')
  @Put('admin/facilitators/:facilitatorId')
  @Put('facilitators/:facilitatorId/edit')
  @Put('facilitators/:facilitatorId')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'biodata', maxCount: 1 },
        { name: 'brief_profile_individual', maxCount: 1 },
        { name: 'brief_profile_organization', maxCount: 1 },
        { name: 'projects_handled', maxCount: 1 },
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
            const uploadPath = join(process.cwd(), 'uploads', 'facilitators');
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
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
  async updateFacilitatorProfile(
    @Param('facilitatorId') facilitatorId: string,
    @Body() dto: CreateFacilitatorProfileDto,
    @UploadedFiles()
    files?: {
      profile_image?: Express.Multer.File[];
      biodata?: Express.Multer.File[];
      brief_profile_individual?: Express.Multer.File[];
      brief_profile_organization?: Express.Multer.File[];
      projects_handled?: Express.Multer.File[];
      vendor_registration_form?: Express.Multer.File[];
      non_disclosure_agreement?: Express.Multer.File[];
      health_declaration?: Express.Multer.File[];
      gst_declaration?: Express.Multer.File[];
      pan_card?: Express.Multer.File[];
      cancelled_cheque?: Express.Multer.File[];
    },
  ): Promise<any> {
    return this.facilitatorsService.updateFacilitatorProfileAdminFlow(facilitatorId, dto, files);
  }
}



