import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { DashboardFreezeService } from './dashboard-freeze.service';
import { EnhancedFeaturesService } from './enhanced-features.service';
import { FreezeDashboardDto } from './dto/dashboard-freeze.dto';
import { AutoProformaInvoiceDto } from './dto/auto-proforma-invoice.dto';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto, SendRatingEmailDto } from './dto/email-template.dto';
import { CreateChecklistVersionDto, UpdateChecklistVersionDto, AssignChecklistVersionDto } from './dto/checklist-version.dto';
import { CreateDashboardResourceDto, UpdateDashboardResourceDto } from './dto/dashboard-resource.dto';

@Controller()
@UseGuards(AdminJwtAuthGuard)
export class AdminEnhancedFeaturesController {
  constructor(
    private readonly dashboardFreezeService: DashboardFreezeService,
    private readonly enhancedFeaturesService: EnhancedFeaturesService,
  ) {}

  // ── Sync Missing Milestone Notifications ──

  @Post('api/admin/projects/:projectId/sync-milestone-notifications')
  async syncMilestoneNotifications(@Param('projectId') projectId: string) {
    return this.enhancedFeaturesService.syncMilestoneNotifications(projectId);
  }

  // ── Dashboard Freeze ──

  @Post('api/admin/dashboard/freeze')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async freezeDashboard(@Body() dto: FreezeDashboardDto, @Request() req: any) {
    return this.dashboardFreezeService.freezeDashboard(dto.year, req.admin || {}, dto.notes);
  }

  @Get('api/admin/dashboard/frozen/:year')
  async getFrozenDashboard(@Param('year') year: string) {
    return this.dashboardFreezeService.getFrozenDashboard(Number.parseInt(year, 10));
  }

  @Get('api/admin/dashboard/years')
  async getAvailableYears() {
    return this.dashboardFreezeService.getAvailableYears();
  }

  @Get('api/admin/dashboard/frozen-status/:year')
  async isFrozen(@Param('year') year: string) {
    const yearNum = Number.parseInt(year, 10);
    const frozen = await this.dashboardFreezeService.isDashboardFrozen(yearNum);
    return { status: 'success', data: { year: yearNum, is_frozen: frozen } };
  }

  // ── Proforma Invoice Auto-generation ──

  @Post('api/admin/projects/:projectId/proforma-invoice/auto-generate')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async autoGenerateProformaInvoice(
    @Param('projectId') projectId: string,
    @Body() dto: AutoProformaInvoiceDto,
    @Request() req: any,
  ) {
    return this.enhancedFeaturesService.autoGenerateProformaInvoice(projectId, dto, req.admin);
  }

  // ── Invoice Filters ──

  @Get('api/admin/projects/:projectId/invoices/filter')
  async getFilteredInvoices(
    @Param('projectId') projectId: string,
    @Query('filter') filter: string,
  ) {
    return this.enhancedFeaturesService.getFilteredInvoices(projectId, filter);
  }

  @Get('api/admin/invoice-filters')
  async getInvoiceFilters() {
    return this.enhancedFeaturesService.getInvoiceFilters();
  }

  // ── Certificate & Plaque Automation ──

  @Post('api/admin/projects/:projectId/generate-cert-plaque')
  async generateCertificateAndPlaque(@Param('projectId') projectId: string) {
    return this.enhancedFeaturesService.generateCertificateAndPlaque(projectId);
  }

  // ── Email Template Management ──

  @Post('api/admin/email-templates')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createEmailTemplate(@Body() dto: CreateEmailTemplateDto, @Request() req: any) {
    return this.enhancedFeaturesService.createEmailTemplate(dto, req.admin);
  }

  @Put('api/admin/email-templates/:templateId')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateEmailTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: UpdateEmailTemplateDto,
    @Request() req: any,
  ) {
    return this.enhancedFeaturesService.updateEmailTemplate(templateId, dto, req.admin);
  }

  @Get('api/admin/email-templates')
  async getEmailTemplates(@Query('type') type?: string) {
    return this.enhancedFeaturesService.getEmailTemplates(type);
  }

  @Get('api/admin/email-templates/:templateId')
  async getEmailTemplateById(@Param('templateId') templateId: string) {
    return this.enhancedFeaturesService.getEmailTemplateById(templateId);
  }

  @Get('api/admin/projects/:projectId/rating-email/prepare')
  async prepareRatingEmail(
    @Param('projectId') projectId: string,
    @Query('template_id') templateId: string,
  ) {
    return this.enhancedFeaturesService.prepareRatingEmail(projectId, templateId);
  }

  @Post('api/admin/projects/:projectId/rating-email/send')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async sendRatingEmail(
    @Param('projectId') projectId: string,
    @Body() dto: SendRatingEmailDto,
  ) {
    return this.enhancedFeaturesService.sendRatingEmail(
      projectId,
      dto.template_id,
      dto.plant_head_email,
      dto.additional_cc,
    );
  }

  // ── Checklist Versioning ──

  @Post('api/admin/checklist-versions')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createChecklistVersion(@Body() dto: CreateChecklistVersionDto, @Request() req: any) {
    return this.enhancedFeaturesService.createChecklistVersion(dto, req.admin);
  }

  @Put('api/admin/checklist-versions/:versionId')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateChecklistVersion(
    @Param('versionId') versionId: string,
    @Body() dto: UpdateChecklistVersionDto,
  ) {
    return this.enhancedFeaturesService.updateChecklistVersion(versionId, dto);
  }

  @Get('api/admin/checklist-versions')
  async getChecklistVersions(@Query('checklist_id') checklistId: string) {
    return this.enhancedFeaturesService.getChecklistVersions(checklistId);
  }

  @Get('api/admin/checklist-versions/:versionId')
  async getChecklistVersionById(@Param('versionId') versionId: string) {
    return this.enhancedFeaturesService.getChecklistVersionById(versionId);
  }

  @Get('api/admin/checklist-versions/:checklistId/active')
  async getActiveChecklistVersion(@Param('checklistId') checklistId: string) {
    return this.enhancedFeaturesService.getActiveChecklistVersion(checklistId);
  }

  @Patch('api/admin/projects/:projectId/checklist-version')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async assignChecklistVersionToProject(
    @Param('projectId') projectId: string,
    @Body() dto: AssignChecklistVersionDto,
  ) {
    return this.enhancedFeaturesService.assignChecklistVersionToProject(
      projectId,
      dto.checklist_version_id,
    );
  }

  // ── Score Band Recalculation ──

  @Post('api/admin/projects/:projectId/recalculate-score-band')
  async recalculateScoreBand(@Param('projectId') projectId: string) {
    return this.enhancedFeaturesService.recalculateScoreBand(projectId);
  }

  // ── Company Dashboard Resources (Admin CRUD) ──

  @Post('api/admin/dashboard-resources')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createDashboardResource(@Body() dto: CreateDashboardResourceDto) {
    return this.enhancedFeaturesService.createDashboardResource(dto);
  }

  @Put('api/admin/dashboard-resources/:resourceId')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateDashboardResource(
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateDashboardResourceDto,
  ) {
    return this.enhancedFeaturesService.updateDashboardResource(resourceId, dto);
  }

  @Delete('api/admin/dashboard-resources/:resourceId')
  async deleteDashboardResource(@Param('resourceId') resourceId: string) {
    return this.enhancedFeaturesService.deleteDashboardResource(resourceId);
  }
}
