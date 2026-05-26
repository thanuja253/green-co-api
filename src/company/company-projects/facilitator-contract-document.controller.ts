import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'node:path';
import * as fs from 'node:fs';
import { CompanyProjectsService } from './company-projects.service';
import { FacilitatorJwtAuthGuard } from '../facilitator-auth/guards/facilitator-jwt-auth.guard';
import { FacilitatorAccountStatusGuard } from '../facilitator-auth/guards/facilitator-account-status.guard';

const facilitatorContractUploadInterceptor = () =>
  FileInterceptor('contract_document', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const projectId = (req as any).params?.projectId || 'unknown';
        const uploadPath = join(
          process.cwd(),
          'uploads',
          'facilitator-signed-contracts',
          projectId,
        );
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
  });

/**
 * Facilitator-only contract document APIs (separate from company/admin work-order routes).
 * Base: /api/facilitator/projects and /api/facilitators/projects
 */
@Controller(['api/facilitator/projects', 'api/facilitators/projects'])
@UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
export class FacilitatorContractDocumentController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  @Get(':projectId/quickview')
  async getQuickview(@Request() req, @Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getQuickviewDataForFacilitator(
      req.user.facilitatorId,
      projectId,
    );
  }

  @Get(':projectId/signed-contract-document')
  async getSignedContractDocument(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFacilitatorSignedContractDocument(
      req.user.facilitatorId,
      projectId,
    );
  }

  @Post(':projectId/signed-contract-document')
  @UseInterceptors(facilitatorContractUploadInterceptor())
  async uploadSignedContractDocument(
    @Request() req,
    @Param('projectId') projectId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use multipart field contract_document (PDF, max 10MB).',
      });
    }
    return this.companyProjectsService.uploadFacilitatorSignedContractDocument(
      req.user.facilitatorId,
      projectId,
      file,
    );
  }

  @Post(':projectId/signed-contract-document/reupload')
  @UseInterceptors(facilitatorContractUploadInterceptor())
  async reuploadSignedContractDocument(
    @Request() req,
    @Param('projectId') projectId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message:
          'No file uploaded. Use multipart field contract_document (PDF) after CII rejection.',
      });
    }
    return this.companyProjectsService.reuploadFacilitatorSignedContractDocument(
      req.user.facilitatorId,
      projectId,
      file,
    );
  }
}
