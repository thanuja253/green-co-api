import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CompanyProjectsService } from './company-projects.service';
import { AssessorJwtAuthGuard } from '../assessor-auth/guards/assessor-jwt-auth.guard';
import { AssessorAccountStatusGuard } from '../assessor-auth/guards/assessor-account-status.guard';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

@Controller()
export class AssessorCompanyProjectsController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  private parseExpenseBody(body: Record<string, any>) {
    const invoicetitle = String(body?.invoicetitle ?? body?.invoice_title ?? '').trim();
    const invoiceamount = Number(body?.invoiceamount ?? body?.invoice_amount ?? body?.payable_amount);
    const sgst = Number(body?.sgst);
    const cgst = Number(body?.cgst);
    const igst = Number(body?.igst);
    const payment_date = String(body?.payment_date ?? '').trim();
    const payment_for = String(body?.payment_for ?? body?.expense_type ?? 'expA').trim() || 'expA';

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
      throw new BadRequestException({
        status: 'error',
        message: 'Validation failed for expense payload.',
      });
    }

    return { invoicetitle, invoiceamount, sgst, cgst, igst, payment_date, payment_for };
  }

  /**
   * Assessor portal quickview (assessor-token compatible).
   */
  @Get('api/assessors/projects/:projectId/quickview')
  @Get('assessors/projects/:projectId/quickview')
  @Get('api/assessor/projects/:projectId/quickview')
  @Get('assessor/projects/:projectId/quickview')
  async getAssessorQuickview(
    @Request() req: { user?: { assessorId?: string } },
    @Param('projectId') projectId: string,
  ): Promise<any> {
    const assessorId = String(req?.user?.assessorId || '').trim();
    if (assessorId) {
      return this.companyProjectsService.getQuickviewDataForAssessor(assessorId, projectId);
    }
    return this.companyProjectsService.getQuickviewDataPublicByProject(projectId);
  }

  /**
   * Export final scoring CSV from assessor portal (legacy-compatible path aliases).
   */
  @Get('api/assessors/download_final_scoring/:projectId')
  @Get('assessors/download_final_scoring/:projectId')
  @Get('api/assessor/download_final_scoring/:projectId')
  @Get('assessor/download_final_scoring/:projectId')
  @Get('api/assessor/projects/:projectId/export-scoring-document')
  @Get('api/assessors/projects/:projectId/export-scoring-document')
  @Get('assessor/projects/:projectId/export-scoring-document')
  @Get('assessors/projects/:projectId/export-scoring-document')
  @Get('api/assessor/projects/:projectId/export_scoring_document')
  @Get('api/assessors/projects/:projectId/export_scoring_document')
  @Get('assessor/projects/:projectId/export_scoring_document')
  @Get('assessors/projects/:projectId/export_scoring_document')
  @Get('api/assessor/auth/export_scoring_document/:projectId')
  @Get('api/assessors/auth/export_scoring_document/:projectId')
  @Get('assessor/auth/export_scoring_document/:projectId')
  @Get('assessors/auth/export_scoring_document/:projectId')
  async downloadFinalScoringForAssessor(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    const exported = await this.companyProjectsService.downloadFinalScoringForAdmin(projectId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  /**
   * Assessor compatibility route for sample checklist document download.
   * Internally redirects to the company sample-download API.
   */
  @Get('api/assessor/projects/:projectId/download-sample-checklist-document')
  @Get('api/assessor/projects/:projectId/download_sample_checklist_document')
  @Get('api/assessor/auth/download_sample_checklist_document/:projectId')
  @Get('api/assessors/projects/:projectId/download-sample-checklist-document')
  @Get('api/assessors/projects/:projectId/download_sample_checklist_document')
  @Get('api/assessors/auth/download_sample_checklist_document/:projectId')
  async downloadSampleChecklistDocumentForAssessor(
    @Param('projectId') projectId: string,
    @Query('sector_id') sectorId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const safeProjectId = encodeURIComponent(String(projectId || '').trim());
    const sectorQuery =
      String(sectorId || '').trim() !== ''
        ? `?sector_id=${encodeURIComponent(String(sectorId || '').trim())}`
        : '';
    res.redirect(
      302,
      `/api/company/projects/${safeProjectId}/assessment-checklist-sample-document${sectorQuery}`,
    );
  }

  /**
   * Assessor score save (draft/update) compatibility API.
   */
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  @Post('api/assessor/update_assessor_score/:projectId')
  @Post('assessor/update_assessor_score/:projectId')
  @Post('api/assessors/update_assessor_score/:projectId')
  @Post('assessors/update_assessor_score/:projectId')
  @Post('api/assessor/update_assessor_score')
  @Post('assessor/update_assessor_score')
  @Post('api/assessors/update_assessor_score')
  @Post('assessors/update_assessor_score')
  async updateAssessorScore(
    @Request() req: { user?: { assessorId?: string } },
    @Param('projectId') projectId: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<any> {
    const assessorId = String(req?.user?.assessorId || '').trim();
    let projectIdFromBody = '';
    if (typeof body?.project_id === 'string' || typeof body?.project_id === 'number') {
      projectIdFromBody = String(body.project_id);
    } else if (typeof body?.projectId === 'string' || typeof body?.projectId === 'number') {
      projectIdFromBody = String(body.projectId);
    }
    const resolvedProjectId = String(projectId || projectIdFromBody).trim();
    return this.companyProjectsService.updateAssessorScore(
      assessorId,
      resolvedProjectId,
      body as Record<string, any>,
    );
  }

  /**
   * Assessor score final submit compatibility API.
   */
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  @Post('api/assessor/finalsubmit_assessor_score/:projectId')
  @Post('assessor/finalsubmit_assessor_score/:projectId')
  @Post('api/assessors/finalsubmit_assessor_score/:projectId')
  @Post('assessors/finalsubmit_assessor_score/:projectId')
  @Post('api/assessor/finalsubmit_assessor_score')
  @Post('assessor/finalsubmit_assessor_score')
  @Post('api/assessors/finalsubmit_assessor_score')
  @Post('assessors/finalsubmit_assessor_score')
  async finalSubmitAssessorScore(
    @Request() req: { user?: { assessorId?: string } },
    @Param('projectId') projectId: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<any> {
    const assessorId = String(req?.user?.assessorId || '').trim();
    let projectIdFromBody = '';
    if (typeof body?.project_id === 'string' || typeof body?.project_id === 'number') {
      projectIdFromBody = String(body.project_id);
    } else if (typeof body?.projectId === 'string' || typeof body?.projectId === 'number') {
      projectIdFromBody = String(body.projectId);
    }
    const resolvedProjectId = String(projectId || projectIdFromBody).trim();
    return this.companyProjectsService.finalSubmitAssessorScore(
      assessorId,
      resolvedProjectId,
      body as Record<string, any>,
    );
  }

  /**
   * Assessor portal expense list (Finance -> Expenses tab).
   */
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  @Get([
    'api/assessor/projects/:projectId/expenses',
    'assessor/projects/:projectId/expenses',
    'api/assessors/projects/:projectId/expenses',
    'assessors/projects/:projectId/expenses',
    'api/assessor/auth/expenses/:projectId',
    'assessor/auth/expenses/:projectId',
    'api/assessors/auth/expenses/:projectId',
    'assessors/auth/expenses/:projectId',
  ])
  async listAssessorProjectExpenses(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getInvoicesByProjectIdAndPaymentFor(
      projectId,
      'expA',
    );
  }

  /**
   * Assessor portal create expense (supports file upload + GST fields).
   */
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  @Post([
    'api/assessor/projects/:projectId/expenses',
    'assessor/projects/:projectId/expenses',
    'api/assessors/projects/:projectId/expenses',
    'assessors/projects/:projectId/expenses',
    'api/assessor/auth/expenses/:projectId',
    'assessor/auth/expenses/:projectId',
    'api/assessors/auth/expenses/:projectId',
    'assessors/auth/expenses/:projectId',
  ])
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'regFeeInvoice', maxCount: 1 },
      { name: 'invoice_file', maxCount: 1 },
      { name: 'document', maxCount: 1 },
    ], {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'expenses');
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `expense-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const isPdf =
          file.mimetype === 'application/pdf' &&
          extname(file.originalname).toLowerCase() === '.pdf';
        if (!isPdf) {
          cb(new BadRequestException('Only PDF is allowed.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async createAssessorProjectExpense(
    @Param('projectId') projectId: string,
    @Body() body: Record<string, any>,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ): Promise<any> {
    const regFeeInvoice =
      files?.regFeeInvoice?.[0] ?? files?.invoice_file?.[0] ?? files?.document?.[0];
    if (!regFeeInvoice) {
      throw new BadRequestException({
        status: 'error',
        message: 'Expense document is required.',
      });
    }
    const payload = this.parseExpenseBody(body);
    return this.companyProjectsService.createCiiExpenseInvoiceByProjectId(
      projectId,
      payload,
      regFeeInvoice,
    );
  }

  /**
   * Assessor portal update expense.
   */
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  @Patch([
    'api/assessor/projects/:projectId/expenses/:invoiceId',
    'assessor/projects/:projectId/expenses/:invoiceId',
    'api/assessors/projects/:projectId/expenses/:invoiceId',
    'assessors/projects/:projectId/expenses/:invoiceId',
    'api/assessor/auth/expenses/:projectId/:invoiceId',
    'assessor/auth/expenses/:projectId/:invoiceId',
    'api/assessors/auth/expenses/:projectId/:invoiceId',
    'assessors/auth/expenses/:projectId/:invoiceId',
  ])
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'regFeeInvoice', maxCount: 1 },
      { name: 'invoice_file', maxCount: 1 },
      { name: 'document', maxCount: 1 },
    ], {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'expenses');
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `expense-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const isPdf =
          file.mimetype === 'application/pdf' &&
          extname(file.originalname).toLowerCase() === '.pdf';
        if (!isPdf) {
          cb(new BadRequestException('Only PDF is allowed.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async updateAssessorProjectExpense(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: Record<string, any>,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ): Promise<any> {
    const regFeeInvoice =
      files?.regFeeInvoice?.[0] ?? files?.invoice_file?.[0] ?? files?.document?.[0];
    const payload = this.parseExpenseBody(body);
    return this.companyProjectsService.updateCiiExpenseInvoiceByProjectId(
      projectId,
      invoiceId,
      payload,
      regFeeInvoice,
    );
  }
}

