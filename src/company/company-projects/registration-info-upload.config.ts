import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RegistrationInfoDto } from './dto/registration-info.dto';
import { memoryStorage } from 'multer';

export const REGISTRATION_INFO_FILE_FIELDS = [
  { name: 'company_brief_profile', maxCount: 1 },
  { name: 'brief_profile', maxCount: 1 },
  { name: 'turnover_document', maxCount: 1 },
  { name: 'turnover', maxCount: 1 },
  { name: 'sez_document', maxCount: 1 },
  { name: 'sezDocument', maxCount: 1 },
  { name: 'sez_input', maxCount: 1 },
  { name: 'sezinput', maxCount: 1 },
];

/**
 * Registration files are uploaded into memory then written to MongoDB GridFS (bucket `registration_uploads`).
 * GridFS avoids the 16MB document limit and survives Render redeploys (no reliance on local disk).
 */
export const registrationInfoMulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    if (file.fieldname === 'sez_document') {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type for sez_document. Only PDF is allowed.'), false);
      }
      return;
    }
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
    sez_document?: Express.Multer.File[];
    sezDocument?: Express.Multer.File[];
    sez_input?: Express.Multer.File[];
    sezinput?: Express.Multer.File[];
  },
  reqFilesFallback?: Record<string, Express.Multer.File[]>,
): {
  dto: RegistrationInfoDto;
  files?: {
    company_brief_profile?: Express.Multer.File[];
    brief_profile?: Express.Multer.File[];
    turnover_document?: Express.Multer.File[];
    turnover?: Express.Multer.File[];
    sez_document?: Express.Multer.File[];
    sezDocument?: Express.Multer.File[];
    sez_input?: Express.Multer.File[];
    sezinput?: Express.Multer.File[];
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
  if (
    cleanedBody.sez_document &&
    typeof cleanedBody.sez_document === 'object' &&
    Object.keys(cleanedBody.sez_document).length === 0
  ) {
    delete cleanedBody.sez_document;
  }
  if (cleanedBody.sezDocument && typeof cleanedBody.sezDocument === 'object' && Object.keys(cleanedBody.sezDocument).length === 0) {
    delete cleanedBody.sezDocument;
  }
  if (cleanedBody.sez_input && typeof cleanedBody.sez_input === 'object' && Object.keys(cleanedBody.sez_input).length === 0) {
    delete cleanedBody.sez_input;
  }
  if (cleanedBody.sezinput && typeof cleanedBody.sezinput === 'object' && Object.keys(cleanedBody.sezinput).length === 0) {
    delete cleanedBody.sezinput;
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
          error.property !== 'turnover' &&
          error.property !== 'sez_document' &&
          error.property !== 'sezDocument' &&
          error.property !== 'sez_input' &&
          error.property !== 'sezinput',
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
