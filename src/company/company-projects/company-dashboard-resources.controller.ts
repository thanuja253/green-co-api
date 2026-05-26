import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../company-auth/guards/jwt-auth.guard';
import { EnhancedFeaturesService } from './enhanced-features.service';

@Controller('api/company/dashboard')
@UseGuards(JwtAuthGuard)
export class CompanyDashboardResourcesController {
  constructor(private readonly enhancedFeaturesService: EnhancedFeaturesService) {}

  @Get('resources')
  async getDashboardResources(@Query('type') type?: string) {
    return this.enhancedFeaturesService.getDashboardResources(type);
  }

  @Get('resources/video')
  async getUserGuideVideo() {
    return this.enhancedFeaturesService.getDashboardResources('user_guide_video');
  }

  @Get('resources/faq')
  async getFAQ() {
    return this.enhancedFeaturesService.getDashboardResources('faq');
  }

  @Get('resources/manual')
  async getUserManual() {
    return this.enhancedFeaturesService.getDashboardResources('user_manual');
  }
}
