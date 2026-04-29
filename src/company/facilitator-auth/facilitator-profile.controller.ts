import {
  BadRequestException,
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
import * as jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { FacilitatorAccountStatusGuard } from './guards/facilitator-account-status.guard';
import { FacilitatorJwtAuthGuard } from './guards/facilitator-jwt-auth.guard';
import { FacilitatorProfileService } from './facilitator-profile.service';

@Controller()
export class FacilitatorProfileController {
  constructor(private readonly facilitatorProfileService: FacilitatorProfileService) {}

  @Get('api/facilitator/profile/me')
  @Get('facilitator/profile/me')
  @Get('api/facilitators/profile/me')
  @Get('facilitators/profile/me')
  async me(@Req() req: any): Promise<any> {
    let facilitatorId = String(
      req?.user?.facilitatorId ||
      req?.query?.facilitator_id ||
      req?.query?.facilitatorId ||
      req?.query?.id ||
      '',
    ).trim();
    if (!facilitatorId) {
      const auth = String(req?.headers?.authorization || '').trim();
      const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
      if (token) {
        const decoded = jwt.decode(token) as Record<string, any> | null;
        facilitatorId = String(decoded?.sub || '').trim();
      }
    }
    if (!facilitatorId) {
      throw new BadRequestException({
        status: 'error',
        message: 'facilitator_id is required',
      });
    }
    return this.facilitatorProfileService.getMyProfile(facilitatorId);
  }

  @Get('api/facilitator/profile/required-fields')
  @Get('facilitator/profile/required-fields')
  @Get('api/facilitators/profile/required-fields')
  @Get('facilitators/profile/required-fields')
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
  async requiredFields(): Promise<any> {
    return {
      status: 'success',
      message: 'Required fields fetched successfully',
      data: {
        required_text_fields: [
          'consultant_id',
          'name',
          'email',
          'mobile',
          'address_line_1',
          'state',
          'city',
          'pincode',
          'educational_qualification',
          'additional_professional_qualification',
          'total_years_professional_experience',
          'years_env_sustainability',
          'areas_of_specialization',
        ],
        required_documents: [
          'vendor_registration_form',
          'brief_profile_individual',
          'brief_profile_organization',
          'projects_handled',
        ],
        conditional_required: [],
      },
    };
  }

  @Patch('api/facilitator/profile')
  @Patch('facilitator/profile')
  @Patch('api/facilitators/profile')
  @Patch('facilitators/profile')
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'vendor_registration_form', maxCount: 1 },
        { name: 'brief_profile_individual', maxCount: 1 },
        { name: 'brief_profile_organization', maxCount: 1 },
        { name: 'projects_handled', maxCount: 1 },
        { name: 'non_disclosure_agreement', maxCount: 1 },
        { name: 'health_declaration', maxCount: 1 },
        { name: 'gst_declaration', maxCount: 1 },
        { name: 'pan_card', maxCount: 1 },
        { name: 'cancelled_cheque', maxCount: 1 },
        // Backward compatibility aliases
        { name: 'biodata', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_req, _file, cb) => {
            const uploadPath = join(process.cwd(), 'uploads', 'facilitators');
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
          },
          filename: (_req, file, cb) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateMyProfile(
    @Req() req: Request & { user: { facilitatorId: string } },
    @Body() body: Record<string, any>,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ): Promise<any> {
    return this.facilitatorProfileService.updateMyProfile(req.user.facilitatorId, body, files);
  }
}
