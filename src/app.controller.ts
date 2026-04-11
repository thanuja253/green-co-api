import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CompanyProjectsService } from './company/company-projects/company-projects.service';

@Controller()
export class AppController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}
  @Get()
  getRoot() {
    return {
      status: 'success',
      message: 'Green Co API is running',
      version: '1.0.0',
      endpoints: {
        auth: '/api/company/auth',
        register: '/api/company/auth/register',
        login: '/api/company/auth/login',
        forgotPassword: '/api/company/auth/forgot-password',
      },
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'success',
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Legacy public URL pattern from disk-based multer; now streams from GridFS / embedded data.
   */
  @Get('uploads/registration/:projectId/:filename')
  async legacyRegistrationUpload(
    @Param('projectId') projectId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.companyProjectsService.streamLegacyRegistrationUploadPath(projectId, filename, res);
  }
}

