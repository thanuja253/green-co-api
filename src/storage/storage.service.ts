import { Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extname, join, dirname } from 'node:path';
import { promises as fs } from 'node:fs';
import type { Express } from 'express';

const LAUNCH_TRAINING_PREFIX = 'uploads/companyproject/launchAndTraining';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null;
  private readonly bucket: string;
  private readonly cloudFrontUrl: string;
  private readonly useS3: boolean;

  constructor() {
    const region = (process.env.AWS_REGION || 'ap-south-1').trim();
    this.bucket = (process.env.AWS_S3_BUCKET || '').trim();
    this.cloudFrontUrl = (process.env.AWS_CLOUDFRONT_URL || '').replace(/\/+$/, '');
    const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();

    this.useS3 = Boolean(this.bucket && accessKeyId && secretAccessKey);

    if (this.useS3) {
      this.s3Client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`S3 uploads enabled (bucket=${this.bucket}, region=${region})`);
    } else {
      this.s3Client = null;
      this.logger.warn(
        'S3 uploads disabled — set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY. Files will be written to local disk only.',
      );
    }
  }

  /** Object key for a Launch & Training session file (matches frontend S3_UPLOAD_FOLDERS). */
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

  /** Legacy single site-visit / launch-training document (same folder layout, project id segment). */
  async saveLegacyLaunchTrainingFile(
    projectId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    return this.saveLaunchTrainingSessionFile(projectId, file);
  }

  /**
   * Public URL for API responses. When S3 is configured, returns CloudFront URL (not Render /uploads).
   * Stores and accepts keys like `uploads/companyproject/launchAndTraining/{projectId}/file.png`.
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
      return `https://${this.bucket}.s3.${(process.env.AWS_REGION || 'ap-south-1').trim()}.amazonaws.com/${key}`;
    }
    const base = (process.env.API_BASE_URL || '').replace(/\/+$/, '');
    return base ? `${base}/${key}` : `/${key}`;
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
