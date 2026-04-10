import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RegistrationInfoDto } from './dto/registration-info.dto';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

export const REGISTRATION_INFO_FILE_FIELDS = [
  { name: 'company_brief_profile', maxCount: 1 },
  { name: 'brief_profile', maxCount: 1 },
  { name: 'turnover_document', maxCount: 1 },
  { name: 'turnover', maxCount: 1 },
];

export const registrationInfoMulterOptions = {
  storage: diskStorage({
    destination: (req: any, file, cb) => {
      const projectId = req.params?.projectId;
      const uploadPath = join(process.cwd(), 'uploads', 'registration', projectId);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      const fieldName = file.fieldname || 'file';
      cb(null, `${fieldName}-${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Invalid file type: ${file.mimetype}. Only PDF, DOC, DOCX, and images are allowed.`),
        false,
      );
    }
  },
};

/**
 * Normalize multipart body + merge multer files (same as registration save/update handlers).
 */
export function parseRegistrationMultipartBody(
  body: any,
  files?: {
    company_brief_profile?: Express.Multer.File[];
    brief_profile?: Express.Multer.File[];
    turnover_document?: Express.Multer.File[];
    turnover?: Express.Multer.File[];
  },
  reqFilesFallback?: Record<string, Express.Multer.File[]>,
): {
  dto: RegistrationInfoDto;
  files?: {
    company_brief_profile?: Express.Multer.File[];
    brief_profile?: Express.Multer.File[];
    turnover_document?: Express.Multer.File[];
    turnover?: Express.Multer.File[];
  };
} {
  let merged = files;
  if (
    (!merged || Object.keys(merged).length === 0) &&
    reqFilesFallback &&
    Object.keys(reqFilesFallback).length > 0
  ) {
    merged = reqFilesFallback as any;
  }

  const cleanedBody = { ...body };

  if (
    cleanedBody.company_brief_profile &&
    typeof cleanedBody.company_brief_profile === 'object' &&
    Object.keys(cleanedBody.company_brief_profile).length === 0
  ) {
    delete cleanedBody.company_brief_profile;
  }
  if (
    cleanedBody.turnover_document &&
    typeof cleanedBody.turnover_document === 'object' &&
    Object.keys(cleanedBody.turnover_document).length === 0
  ) {
    delete cleanedBody.turnover_document;
  }
  if (
    cleanedBody.brief_profile &&
    typeof cleanedBody.brief_profile === 'object' &&
    Object.keys(cleanedBody.brief_profile).length === 0
  ) {
    delete cleanedBody.brief_profile;
  }
  if (
    cleanedBody.turnover &&
    typeof cleanedBody.turnover === 'object' &&
    Object.keys(cleanedBody.turnover).length === 0
  ) {
    delete cleanedBody.turnover;
  }

  return { dto: cleanedBody as RegistrationInfoDto, files: merged };
}

export function createRegistrationInfoValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
    skipMissingProperties: false,
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: (errors) => {
      if (!errors || errors.length === 0) {
        return null as any;
      }
      const filteredErrors = errors.filter(
        (error) =>
          error.property !== 'company_brief_profile' &&
          error.property !== 'turnover_document' &&
          error.property !== 'brief_profile' &&
          error.property !== 'turnover',
      );
      if (filteredErrors.length === 0) {
        return null as any;
      }
      const formattedErrors: Record<string, string[]> = {};
      filteredErrors.forEach((error) => {
        if (error.constraints) {
          formattedErrors[error.property] = Object.values(error.constraints);
        }
      });
      return new BadRequestException({
        status: 'error',
        message: 'Validation failed',
        errors: formattedErrors,
      });
    },
  });
}
