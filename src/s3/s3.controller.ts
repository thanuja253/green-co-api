import {
  Controller,
  Post,
  Delete,
  Get,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { S3Service } from './s3.service';

@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const key = await this.s3Service.uploadFile(file);
    return { success: true, key };
  }

  @Post('presigned-upload')
  async getPresignedUploadUrl(
    @Body()
    body: {
      fileName: string;
      contentType: string;
      folder?: string;
    },
  ) {
    return this.s3Service.getSignedUploadUrl(
      body.fileName,
      body.contentType,
      body.folder,
    );
  }

  @Get('download-url')
  async getDownloadUrl(@Query('key') key: string) {
    const url = await this.s3Service.getSignedDownloadUrl(key);
    return { url };
  }

  @Get('list')
  async listFiles(@Query('prefix') prefix?: string) {
    return this.s3Service.listFiles(prefix);
  }

  @Delete()
  async deleteFile(@Query('key') key: string) {
    return this.s3Service.deleteFile(key);
  }
}
