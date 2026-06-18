import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { basename, extname, join, dirname } from 'node:path';
import { promises as fs } from 'node:fs';
import * as fsSync from 'node:fs';
import { Readable } from 'node:stream';
import type { Express, Response } from 'express';
import {
  pickFinanceV2InvoiceS3KeyFromBody,
  pickFinanceV2PaymentS3KeyFromBody,
  pickLaunchTrainingS3KeyFromBody,
  pickS3KeyFromBody,
} from './project-document-storage.util';

export {
  pickFinanceV2InvoiceS3KeyFromBody,
  pickFinanceV2PaymentS3KeyFromBody,
  pickLaunchTrainingS3KeyFromBody,
  pickS3KeyFromBody,
};

const LAUNCH_TRAINING_PREFIX = 'uploads/companyproject/launchAndTraining';
const FINANCE_V2_PROJECT_PREFIX = 'uploads/companyproject';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client | null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cloudFrontUrl: string;
  private readonly useS3: boolean;

  constructor(private readonly configService: ConfigService) {
    this.region = (this.configService.get<string>('AWS_REGION') || 'ap-south-1').trim();
    this.bucket = (this.configService.get<string>('AWS_S3_BUCKET') || '').trim();
    this.cloudFrontUrl = (this.configService.get<string>('AWS_CLOUDFRONT_URL') || '').replace(
      /\/+$/,
      '',
    );
    const accessKeyId = (this.configService.get<string>('AWS_ACCESS_KEY_ID') || '').trim();
    const secretAccessKey = (
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || ''
    ).trim();

    this.useS3 = Boolean(this.bucket && accessKeyId && secretAccessKey);

    if (this.useS3) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`S3 enabled (bucket=${this.bucket}, region=${this.region})`);
    } else {
      this.s3Client = null;
      this.logger.warn(
        'S3 disabled — set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY. Files will be written to local disk only.',
      );
    }
  }

  private requireS3Client(): S3Client {
    if (!this.s3Client) {
      throw new ServiceUnavailableException(
        'S3 is not configured. Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.',
      );
    }
    return this.s3Client;
  }

  /** Object key for Launch & Training session files (matches frontend S3_UPLOAD_FOLDERS). */
  buildLaunchTrainingSessionKey(projectId: string, originalname: string): string {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = extname(originalname || '') || '';
    return `${LAUNCH_TRAINING_PREFIX}/${projectId}/launch-session-${unique}${ext}`;
  }

  async saveLaunchTrainingSessionFile(
    projectId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const key = this.buildLaunchTrainingSessionKey(projectId, file.originalname);
    await this.persistFile(key, file);
    return key;
  }

  /**
   * Resolve Launch & Training session key from presigned client upload (body fields) or multer file bytes.
   */
  async resolveLaunchTrainingSessionKey(
    projectId: string,
    file: Express.Multer.File | undefined,
    body: Record<string, unknown> | undefined,
  ): Promise<{ key: string; originalFilename: string }> {
    const fromBody = pickLaunchTrainingS3KeyFromBody(body);
    if (fromBody) {
      const normalized = this.normalizeStorageKey(fromBody);
      if (!normalized) {
        throw new BadRequestException({
          status: 'error',
          message: 'Invalid s3_key in request body.',
        });
      }
      const exists = await this.storageKeyExists(normalized);
      if (!exists) {
        throw new BadRequestException({
          status: 'error',
          message: `Uploaded file not found in storage for key: ${normalized}. Complete the S3 PUT before calling this API.`,
        });
      }
      return {
        key: normalized,
        originalFilename: basename(normalized) || 'launch-training-session',
      };
    }
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message:
          'No file uploaded. Use multipart field launch_session_file, file, document, document_file, upload, or launch_upload (PDF or image, max 10MB), or provide launch_session_file_s3_key / s3_key after presigned upload.',
      });
    }
    const key = await this.saveLaunchTrainingSessionFile(projectId, file);
    return { key, originalFilename: file.originalname };
  }

  async saveLegacyLaunchTrainingFile(
    projectId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    return this.saveLaunchTrainingSessionFile(projectId, file);
  }

  /**
   * Public URL for API responses. When S3 is configured, returns CloudFront URL when set.
   * Accepts keys like `uploads/companyproject/launchAndTraining/{projectId}/file.png`.
   */
  resolvePublicUrl(path?: string | null): string | null {
    const raw = String(path || '').trim();
    if (!raw) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    const key = raw.replace(/^\/+/, '');
    if (this.cloudFrontUrl) {
      return `${this.cloudFrontUrl}/${key}`;
    }
    if (this.useS3) {
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }
    const base = (this.configService.get<string>('API_BASE_URL') || '').replace(/\/+$/, '');
    return base ? `${base}/${key}` : `/${key}`;
  }

  async uploadFile(file: Express.Multer.File, folder = 'uploads'): Promise<string> {
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    await this.persistFile(key, file);
    return key;
  }

  async deleteFile(key: string) {
    if (this.useS3 && this.s3Client) {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return { message: 'File deleted successfully' };
    }
    const diskPath = join(process.cwd(), key);
    if (await fs.stat(diskPath).catch(() => null)) {
      await fs.unlink(diskPath);
    }
    return { message: 'File deleted successfully' };
  }

  async getSignedDownloadUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.requireS3Client(), command, { expiresIn: 3600 });
  }

  async getSignedUploadUrl(fileName: string, contentType: string, folder = 'uploads') {
    const key = `${folder}/${Date.now()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.requireS3Client(), command, { expiresIn: 3600 });
    return { key, url };
  }

  async listFiles(prefix = '') {
    const result = await this.requireS3Client().send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      }),
    );
    return result.Contents || [];
  }

  /** Normalize DB / URL / presign values to an object key under `uploads/…`. */
  normalizeStorageKey(raw: string): string | null {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const u = new URL(trimmed);
        const path = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
        const uploadsIdx = path.indexOf('uploads/');
        if (uploadsIdx >= 0) return path.slice(uploadsIdx);
        return path || null;
      } catch {
        return null;
      }
    }
    if (trimmed.startsWith('uploads/')) return trimmed.replace(/^\/+/, '');
    const idx = trimmed.indexOf('/uploads/');
    if (idx >= 0) return trimmed.slice(idx + 1);
    if (trimmed.startsWith('/uploads/')) return trimmed.replace(/^\/+/, '');
    return trimmed.replace(/^\/+/, '');
  }

  buildProposalDocumentKey(projectId: string, originalname: string): string {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = extname(originalname || '') || '.pdf';
    return `uploads/company/${projectId}/proposal-${uniqueSuffix}${ext}`;
  }

  buildWorkOrderDocumentKey(projectId: string, originalname: string): string {
    const timestamp = Date.now();
    const safeName = String(originalname || 'workorder.pdf').replace(/[/\\]+/g, '_');
    return `uploads/companyproject/${projectId}/${timestamp}_${safeName}`;
  }

  buildFinanceV2InvoiceKey(projectId: string, originalname: string): string {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = extname(originalname || '') || '.pdf';
    return `${FINANCE_V2_PROJECT_PREFIX}/${projectId}/finance-v2/finance-v2-${uniqueSuffix}${ext}`;
  }

  buildFinanceV2PaymentKey(projectId: string, originalname: string): string {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = extname(originalname || '') || '.pdf';
    return `${FINANCE_V2_PROJECT_PREFIX}/${projectId}/finance-v2-payments/finance-v2-payment-${uniqueSuffix}${ext}`;
  }

  /**
   * Resolve Finance v2 invoice key from presigned client upload (body fields) or multer file bytes.
   */
  async resolveFinanceV2InvoiceKey(
    projectId: string,
    file: Express.Multer.File | undefined,
    body: Record<string, unknown> | undefined,
  ): Promise<{ key: string; originalFilename: string }> {
    const fromBody = pickFinanceV2InvoiceS3KeyFromBody(body);
    if (fromBody) {
      const normalized = this.normalizeStorageKey(fromBody);
      if (!normalized) {
        throw new BadRequestException({
          status: 'error',
          message: 'Invalid s3_key in request body.',
        });
      }
      const exists = await this.storageKeyExists(normalized);
      if (!exists) {
        throw new BadRequestException({
          status: 'error',
          message: `Uploaded file not found in storage for key: ${normalized}. Complete the S3 PUT before calling this API.`,
        });
      }
      return {
        key: normalized,
        originalFilename: basename(normalized) || 'finance-v2-invoice.pdf',
      };
    }
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message:
          'No file uploaded. Use field name "invoice_document" or provide invoice_document_s3_key / s3_key after presigned upload.',
      });
    }
    const key = this.buildFinanceV2InvoiceKey(projectId, file.originalname);
    await this.saveMulterFileToStorage(file, key);
    return { key, originalFilename: file.originalname };
  }

  /**
   * Resolve Finance v2 payment supporting-document key from presigned upload or multer file bytes.
   */
  async resolveFinanceV2PaymentKey(
    projectId: string,
    file: Express.Multer.File | undefined,
    body: Record<string, unknown> | undefined,
  ): Promise<{ key: string; originalFilename: string }> {
    const fromBody = pickFinanceV2PaymentS3KeyFromBody(body);
    if (fromBody) {
      const normalized = this.normalizeStorageKey(fromBody);
      if (!normalized) {
        throw new BadRequestException({
          status: 'error',
          message: 'Invalid s3_key in request body.',
        });
      }
      const exists = await this.storageKeyExists(normalized);
      if (!exists) {
        throw new BadRequestException({
          status: 'error',
          message: `Uploaded file not found in storage for key: ${normalized}. Complete the S3 PUT before calling this API.`,
        });
      }
      return {
        key: normalized,
        originalFilename: basename(normalized) || 'finance-v2-payment.pdf',
      };
    }
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message:
          'Supporting document is required when payment mode is Offline. Use supportingdocument or provide supportingdocument_s3_key / s3_key after presigned upload.',
      });
    }
    const key = this.buildFinanceV2PaymentKey(projectId, file.originalname);
    await this.saveMulterFileToStorage(file, key);
    return { key, originalFilename: file.originalname };
  }

  /**
   * Resolve storage key from presigned client upload (body fields) or multer file bytes.
   */
  async resolveProjectDocumentKey(
    projectId: string,
    file: Express.Multer.File | undefined,
    body: Record<string, unknown> | undefined,
    kind: 'proposal' | 'work-order',
  ): Promise<string> {
    const fromBody = pickS3KeyFromBody(body);
    if (fromBody) {
      const normalized = this.normalizeStorageKey(fromBody);
      if (!normalized) {
        throw new BadRequestException({
          status: 'error',
          message: 'Invalid s3_key in request body.',
        });
      }
      const exists = await this.storageKeyExists(normalized);
      if (!exists) {
        throw new BadRequestException({
          status: 'error',
          message: `Uploaded file not found in storage for key: ${normalized}. Complete the S3 PUT before calling this API.`,
        });
      }
      return normalized;
    }
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message:
          kind === 'proposal'
            ? 'No file uploaded. Use proposal_document, proposalDocument, or file.'
            : 'No file uploaded. Use workorderdocument (PDF) or s3_key after presigned upload.',
      });
    }
    const key =
      kind === 'proposal'
        ? this.buildProposalDocumentKey(projectId, file.originalname)
        : this.buildWorkOrderDocumentKey(projectId, file.originalname);
    return this.saveMulterFileToStorage(file, key);
  }

  async saveMulterFileToStorage(file: Express.Multer.File, key: string): Promise<string> {
    await this.persistFile(key, file);
    const diskPath = (file as Express.Multer.File & { path?: string }).path;
    if (diskPath && fsSync.existsSync(diskPath)) {
      try {
        await fs.unlink(diskPath);
      } catch {
        /* ignore temp cleanup */
      }
    }
    return key;
  }

  async storageKeyExists(key: string): Promise<boolean> {
    const normalized = this.normalizeStorageKey(key);
    if (!normalized) return false;
    const diskPath = join(process.cwd(), normalized);
    if (fsSync.existsSync(diskPath)) return true;
    if (!this.useS3 || !this.s3Client) return false;
    try {
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: normalized }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getStorageMtimeMs(key: string): Promise<number | null> {
    const normalized = this.normalizeStorageKey(key);
    if (!normalized) return null;
    const diskPath = join(process.cwd(), normalized);
    try {
      if (fsSync.existsSync(diskPath)) {
        return fsSync.statSync(diskPath).mtimeMs;
      }
    } catch {
      /* ignore */
    }
    if (!this.useS3 || !this.s3Client) return null;
    try {
      const head = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: normalized }),
      );
      return head.LastModified ? head.LastModified.getTime() : null;
    } catch {
      return null;
    }
  }

  async streamStorageKeyToResponse(
    res: Response,
    key: string,
    filename: string,
    contentType = 'application/pdf',
  ): Promise<void> {
    const normalized = this.normalizeStorageKey(key);
    if (!normalized) {
      throw new NotFoundException({ status: 'error', message: 'File not found' });
    }

    const diskPath = join(process.cwd(), normalized);
    if (fsSync.existsSync(diskPath)) {
      res.setHeader('Content-Type', contentType);
      const safeName = String(filename).replace(/"/g, "'");
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
      await new Promise<void>((resolve, reject) => {
        res.status(200).sendFile(diskPath, (err) => (err ? reject(err) : resolve()));
      });
      return;
    }

    if (this.useS3 && this.s3Client) {
      try {
        const out = await this.s3Client.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: normalized }),
        );
        res.setHeader('Content-Type', contentType);
        const safeName = String(filename).replace(/"/g, "'");
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
        res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
        if (out.ContentLength != null) {
          res.setHeader('Content-Length', String(out.ContentLength));
        }
        const body = out.Body;
        if (body instanceof Readable) {
          await new Promise<void>((resolve, reject) => {
            body.on('error', reject);
            res.on('close', resolve);
            body.pipe(res);
          });
          return;
        }
      } catch (err: any) {
        this.logger.warn(`S3 get failed for ${normalized}: ${err?.message || err}`);
      }
    }

    throw new NotFoundException({ status: 'error', message: 'File not found' });
  }

  private async persistFile(key: string, file: Express.Multer.File): Promise<void> {
    const body = await this.readFileBuffer(file);
    if (this.useS3 && this.s3Client) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: file.mimetype || 'application/octet-stream',
          ServerSideEncryption: 'AES256',
        }),
      );
      this.logger.log(`Uploaded to s3://${this.bucket}/${key}`);
      return;
    }
    const diskPath = join(process.cwd(), key);
    await fs.mkdir(dirname(diskPath), { recursive: true });
    await fs.writeFile(diskPath, body);
    this.logger.log(`Saved to disk: ${diskPath}`);
  }

  private async readFileBuffer(file: Express.Multer.File): Promise<Buffer> {
    if (file.buffer?.length) {
      return file.buffer;
    }
    if (file.path) {
      return fs.readFile(file.path);
    }
    throw new Error('Uploaded file has no buffer or path');
  }
}
