import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import type { Request } from 'express';
import { AssessorJwtAuthGuard } from './guards/assessor-jwt-auth.guard';
import { AssessorAccountStatusGuard } from './guards/assessor-account-status.guard';
import { AssessorProfileService } from './assessor-profile.service';

@Controller('api/assessor/profile')
export class AssessorProfileController {
  constructor(private readonly assessorProfileService: AssessorProfileService) {}

  @Get('me')
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  async me(@Req() req: any): Promise<any> {
    return this.assessorProfileService.getMyProfile(req.user.assessorId);
  }

  /**
   * Assessor self-profile update (multipart).
   * Any update sets approval_status = Pending and clears approval_remarks
   * so admin can approve/reject, and assessor can re-upload until approved.
   */
  @Patch()
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
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
          destination: (_req, _file, cb) => {
            const uploadPath = join(process.cwd(), 'uploads', 'assessors');
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
          },
          filename: (_req, file, cb) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
          },
        }),
        fileFilter: (_req, file, cb) => {
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
  async updateMyProfile(
    @Req() req: Request & { user: { assessorId: string } },
    @Body() body: Record<string, any>,
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
    return this.assessorProfileService.updateMyProfile(req.user.assessorId, body, files);
  }
}

