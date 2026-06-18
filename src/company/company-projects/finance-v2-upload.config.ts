import { BadRequestException } from '@nestjs/common';
import {
  pickFinanceV2InvoiceS3KeyFromBody,
  pickFinanceV2PaymentS3KeyFromBody,
} from '../../s3/project-document-storage.util';

export type FinanceV2PaymentFiles = {
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
};

export function assertFinanceV2InvoiceCreateUpload(
  file: Express.Multer.File | undefined,
  body: object,
): void {
  if (!file && !pickFinanceV2InvoiceS3KeyFromBody(body as Record<string, unknown>)) {
    throw new BadRequestException({
      status: 'error',
      message:
        'No file uploaded. Use field name "invoice_document" or provide invoice_document_s3_key / s3_key after presigned upload.',
    });
  }
}

export function pickFinanceV2PaymentMultipartFile(
  files?: FinanceV2PaymentFiles,
): Express.Multer.File | undefined {
  return (
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
    files?.file?.[0]
  );
}

export { pickFinanceV2InvoiceS3KeyFromBody, pickFinanceV2PaymentS3KeyFromBody };
