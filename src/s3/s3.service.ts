import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extname, join, dirname } from 'node:path';
import { promises as fs } from 'node:fs';
import type { Express } from 'express';

const LAUNCH_TRAINING_PREFIX = 'uploads/companyproject/launchAndTraining';

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
