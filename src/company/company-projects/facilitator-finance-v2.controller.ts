import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import * as fs from 'node:fs';
import { CompanyProjectsService } from './company-projects.service';
import { CreateProformaInvoiceV2Dto } from './dto/create-proforma-invoice-v2.dto';
import { UpdateProformaInvoiceV2Dto } from './dto/update-proforma-invoice-v2.dto';
import { SubmitFinanceV2PaymentDto } from './dto/submit-finance-v2-payment.dto';
import { UpdateFinanceV2ApprovalDto } from './dto/update-finance-v2-approval.dto';

@Controller(['api/facilitator/projects', 'api/facilitators/projects'])
export class FacilitatorFinanceV2Controller {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  @Get([':projectId/finance-v2/proforma-invoices', ':projectId/finance-v2/invoices'])
  async getFinanceV2Invoices(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getFinanceV2InvoicesByProjectId(projectId);
  }

  @Post([':projectId/finance-v2/proforma-invoices', ':projectId/finance-v2/invoices'])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('invoice_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'finance-v2');
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `finance-v2-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invoice document must be PDF, JPG, JPEG or PNG.'), false);
      },
    }),
  )
  async createFinanceV2Invoice(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProformaInvoiceV2Dto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use field name "invoice_document".',
      });
    }
    return this.companyProjectsService.createFinanceV2InvoiceByProjectId(projectId, dto, file);
  }

  @Patch([
    ':projectId/finance-v2/proforma-invoices/:invoiceId',
    ':projectId/finance-v2/invoices/:invoiceId',
  ])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('invoice_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'finance-v2');
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `finance-v2-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invoice document must be PDF, JPG, JPEG or PNG.'), false);
      },
    }),
  )
  async updateFinanceV2Invoice(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateProformaInvoiceV2Dto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<any> {
    return this.companyProjectsService.updateFinanceV2InvoiceByProjectId(projectId, invoiceId, dto, file);
  }

  @Post([
    ':projectId/finance-v2/proforma-invoices/:invoiceId/submit-payment',
    ':projectId/finance-v2/tax-invoices/:invoiceId/submit-payment',
    ':projectId/finance-v2/invoices/:invoiceId/submit-payment',
    ':projectId/finance-v2/invoices/:invoiceId/upload-supporting',
    ':projectId/finance-v2/invoices/:invoiceId/supporting-document',
    ':projectId/finance-v2/invoices/:invoiceId/payment',
    ':projectId/finance-v2/invoices/:invoiceId/submit',
    ':projectId/finance-v2/invoices/:invoiceId/reupload',
  ])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'supportingdocument', maxCount: 1 },
        { name: 'supporting_document', maxCount: 1 },
        { name: 'supportingDocument', maxCount: 1 },
        { name: 'supporting-document', maxCount: 1 },
        { name: 'supporting_doc', maxCount: 1 },
        { name: 'supportingDoc', maxCount: 1 },
        { name: 'document', maxCount: 1 },
        { name: 'payment_document', maxCount: 1 },
        { name: 'offline_tran_doc', maxCount: 1 },
        { name: 'offlineTranDoc', maxCount: 1 },
        { name: 'file', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const projectId = (req as any).params?.projectId || 'unknown';
            const uploadPath = join(process.cwd(), 'uploads', 'company', projectId, 'finance-v2-payments');
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            cb(null, `finance-v2-payment-${uniqueSuffix}${ext}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
          if (allowed.includes(file.mimetype)) cb(null, true);
          else cb(new Error('Supporting document must be PDF, JPG, JPEG or PNG.'), false);
        },
      },
    ),
  )
  async submitFinanceV2Payment(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: SubmitFinanceV2PaymentDto,
    @UploadedFiles()
    files?: {
      supportingdocument?: Express.Multer.File[];
      supporting_document?: Express.Multer.File[];
      supportingDocument?: Express.Multer.File[];
      'supporting-document'?: Express.Multer.File[];
      supporting_doc?: Express.Multer.File[];
      supportingDoc?: Express.Multer.File[];
      document?: Express.Multer.File[];
      payment_document?: Express.Multer.File[];
      offline_tran_doc?: Express.Multer.File[];
      offlineTranDoc?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
  ): Promise<any> {
    const file =
      files?.supportingdocument?.[0] ||
      files?.supporting_document?.[0] ||
      files?.supportingDocument?.[0] ||
      files?.['supporting-document']?.[0] ||
      files?.supporting_doc?.[0] ||
      files?.supportingDoc?.[0] ||
      files?.document?.[0] ||
      files?.payment_document?.[0] ||
      files?.offline_tran_doc?.[0] ||
      files?.offlineTranDoc?.[0] ||
      files?.file?.[0];
    return this.companyProjectsService.submitFinanceV2PaymentByProjectId(
      projectId,
      invoiceId,
      dto,
      file,
    );
  }

  @Patch(':projectId/finance-v2/proforma-invoices/:invoiceId/approval')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateFinanceV2Approval(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateFinanceV2ApprovalDto,
  ): Promise<any> {
    if (dto.approval_status !== 1 && dto.approval_status !== 2) {
      throw new BadRequestException({
        status: 'error',
        message:
          'Facilitator approval only supports Approved (1) or Rejected (2). Under Review (3) is not allowed.',
      });
    }
    return this.companyProjectsService.updateFinanceV2ApprovalByProjectId(projectId, invoiceId, dto);
  }

  @Get(':projectId/finance-v2/proforma-invoices/:invoiceId/approval')
  async getFinanceV2ProformaInvoicesApproval(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFinanceV2ApprovalByProjectId(projectId, invoiceId);
  }

  @Get(':projectId/finance-v2/proforma/:invoiceId/approval')
  async getFinanceV2ProformaApproval(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFinanceV2ApprovalByProjectId(projectId, invoiceId);
  }

  /**
   * Dedicated facilitator Proforma APIs (separate from shared /invoices routes).
   */
  @Get(':projectId/finance-v2/proforma')
  async getFinanceV2ProformaInvoices(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFinanceV2InvoicesByProjectId(projectId);
  }

  @Post(':projectId/finance-v2/proforma')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('invoice_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const resolvedProjectId = (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', resolvedProjectId, 'finance-v2');
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `finance-v2-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invoice document must be PDF, JPG, JPEG or PNG.'), false);
      },
    }),
  )
  async createFinanceV2ProformaInvoice(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProformaInvoiceV2Dto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use field name "invoice_document".',
      });
    }
    return this.companyProjectsService.createFinanceV2InvoiceByProjectId(
      projectId,
      { ...dto, invoice_type: 'proforma', payment_for: 'per_inv', payment_type: 'proforma' },
      file,
    );
  }

  @Patch(':projectId/finance-v2/proforma/:invoiceId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('invoice_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const resolvedProjectId = (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', resolvedProjectId, 'finance-v2');
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `finance-v2-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invoice document must be PDF, JPG, JPEG or PNG.'), false);
      },
    }),
  )
  async updateFinanceV2ProformaInvoice(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateProformaInvoiceV2Dto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<any> {
    return this.companyProjectsService.updateFinanceV2InvoiceByProjectId(
      projectId,
      invoiceId,
      { ...dto, invoice_type: 'proforma', payment_for: 'per_inv', payment_type: 'proforma' },
      file,
    );
  }

  @Patch(':projectId/finance-v2/proforma/:invoiceId/approval')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateFinanceV2ProformaApproval(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateFinanceV2ApprovalDto,
  ): Promise<any> {
    if (dto.approval_status !== 1 && dto.approval_status !== 2) {
      throw new BadRequestException({
        status: 'error',
        message:
          'Facilitator approval only supports Approved (1) or Rejected (2). Under Review (3) is not allowed.',
      });
    }
    return this.companyProjectsService.updateFinanceV2ApprovalByProjectId(projectId, invoiceId, dto);
  }

  @Post(':projectId/finance-v2/proforma/:invoiceId/submit-payment')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'supportingdocument', maxCount: 1 },
        { name: 'supporting_document', maxCount: 1 },
        { name: 'supportingDocument', maxCount: 1 },
        { name: 'supporting-document', maxCount: 1 },
        { name: 'supporting_doc', maxCount: 1 },
        { name: 'supportingDoc', maxCount: 1 },
        { name: 'document', maxCount: 1 },
        { name: 'payment_document', maxCount: 1 },
        { name: 'offline_tran_doc', maxCount: 1 },
        { name: 'offlineTranDoc', maxCount: 1 },
        { name: 'file', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const resolvedProjectId = (req as any).params?.projectId || 'unknown';
            const uploadPath = join(
              process.cwd(),
              'uploads',
              'company',
              resolvedProjectId,
              'finance-v2-payments',
            );
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            cb(null, `finance-v2-payment-${uniqueSuffix}${ext}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
          if (allowed.includes(file.mimetype)) cb(null, true);
          else cb(new Error('Supporting document must be PDF, JPG, JPEG or PNG.'), false);
        },
      },
    ),
  )
  async submitFinanceV2ProformaPayment(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: SubmitFinanceV2PaymentDto,
    @UploadedFiles()
    files?: {
      supportingdocument?: Express.Multer.File[];
      supporting_document?: Express.Multer.File[];
      supportingDocument?: Express.Multer.File[];
      'supporting-document'?: Express.Multer.File[];
      supporting_doc?: Express.Multer.File[];
      supportingDoc?: Express.Multer.File[];
      document?: Express.Multer.File[];
      payment_document?: Express.Multer.File[];
      offline_tran_doc?: Express.Multer.File[];
      offlineTranDoc?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
  ): Promise<any> {
    const file =
      files?.supportingdocument?.[0] ||
      files?.supporting_document?.[0] ||
      files?.supportingDocument?.[0] ||
      files?.['supporting-document']?.[0] ||
      files?.supporting_doc?.[0] ||
      files?.supportingDoc?.[0] ||
      files?.document?.[0] ||
      files?.payment_document?.[0] ||
      files?.offline_tran_doc?.[0] ||
      files?.offlineTranDoc?.[0] ||
      files?.file?.[0];
    return this.companyProjectsService.submitFinanceV2PaymentByProjectId(projectId, invoiceId, dto, file);
  }

  /**
   * Dedicated facilitator Tax APIs (including tax-tab aliases).
   */
  @Get([':projectId/finance-v2/tax-invoices', ':projectId/finance-v2/tax-tab'])
  async getFinanceV2TaxInvoices(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getFinanceV2InvoicesByProjectId(projectId);
  }

  @Post([':projectId/finance-v2/tax-invoices', ':projectId/finance-v2/tax-tab'])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('invoice_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const resolvedProjectId = (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', resolvedProjectId, 'finance-v2');
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `finance-v2-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invoice document must be PDF, JPG, JPEG or PNG.'), false);
      },
    }),
  )
  async createFinanceV2TaxInvoice(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProformaInvoiceV2Dto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'No file uploaded. Use field name "invoice_document".',
      });
    }
    return this.companyProjectsService.createFinanceV2InvoiceByProjectId(
      projectId,
      { ...dto, invoice_type: 'tax', payment_for: 'inv', payment_type: 'tax' },
      file,
    );
  }

  @Patch([
    ':projectId/finance-v2/tax-invoices/:invoiceId',
    ':projectId/finance-v2/tax-tab/:invoiceId',
  ])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('invoice_document', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const resolvedProjectId = (req as any).params?.projectId || 'unknown';
          const uploadPath = join(process.cwd(), 'uploads', 'company', resolvedProjectId, 'finance-v2');
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `finance-v2-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invoice document must be PDF, JPG, JPEG or PNG.'), false);
      },
    }),
  )
  async updateFinanceV2TaxInvoice(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateProformaInvoiceV2Dto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<any> {
    return this.companyProjectsService.updateFinanceV2InvoiceByProjectId(
      projectId,
      invoiceId,
      { ...dto, invoice_type: 'tax', payment_for: 'inv', payment_type: 'tax' },
      file,
    );
  }

  @Patch([
    ':projectId/finance-v2/tax-invoices/:invoiceId/approval',
    ':projectId/finance-v2/tax-tab/:invoiceId/approval',
  ])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateFinanceV2TaxApproval(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateFinanceV2ApprovalDto,
  ): Promise<any> {
    if (dto.approval_status !== 1 && dto.approval_status !== 2) {
      throw new BadRequestException({
        status: 'error',
        message:
          'Facilitator approval only supports Approved (1) or Rejected (2). Under Review (3) is not allowed.',
      });
    }
    return this.companyProjectsService.updateFinanceV2ApprovalByProjectId(projectId, invoiceId, dto);
  }

  @Get(':projectId/finance-v2/tax-invoices/:invoiceId/approval')
  async getFinanceV2TaxInvoicesApproval(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFinanceV2ApprovalByProjectId(projectId, invoiceId);
  }

  @Get(':projectId/finance-v2/tax-tab/:invoiceId/approval')
  async getFinanceV2TaxTabApproval(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFinanceV2ApprovalByProjectId(projectId, invoiceId);
  }

  @Post([
    ':projectId/finance-v2/tax-invoices/:invoiceId/submit-payment',
    ':projectId/finance-v2/tax-tab/:invoiceId/submit-payment',
    ':projectId/finance-v2/tax-tab/:invoiceId/upload-supporting',
    ':projectId/finance-v2/tax-tab/:invoiceId/supporting-document',
    ':projectId/finance-v2/tax-tab/:invoiceId/payment',
    ':projectId/finance-v2/tax-tab/:invoiceId/submit',
    ':projectId/finance-v2/tax-tab/:invoiceId/reupload',
  ])
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'supportingdocument', maxCount: 1 },
        { name: 'supporting_document', maxCount: 1 },
        { name: 'supportingDocument', maxCount: 1 },
        { name: 'file', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const resolvedProjectId = (req as any).params?.projectId || 'unknown';
            const uploadPath = join(
              process.cwd(),
              'uploads',
              'company',
              resolvedProjectId,
              'finance-v2-payments',
            );
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            cb(null, `finance-v2-payment-${uniqueSuffix}${ext}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
          if (allowed.includes(file.mimetype)) cb(null, true);
          else cb(new Error('Supporting document must be PDF, JPG, JPEG or PNG.'), false);
        },
      },
    ),
  )
  async submitFinanceV2TaxPayment(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: SubmitFinanceV2PaymentDto,
    @UploadedFiles()
    files?: {
      supportingdocument?: Express.Multer.File[];
      supporting_document?: Express.Multer.File[];
      supportingDocument?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
  ): Promise<any> {
    const file =
      files?.supportingdocument?.[0] ||
      files?.supporting_document?.[0] ||
      files?.supportingDocument?.[0] ||
      files?.file?.[0];
    return this.companyProjectsService.submitFinanceV2PaymentByProjectId(projectId, invoiceId, dto, file);
  }
}

