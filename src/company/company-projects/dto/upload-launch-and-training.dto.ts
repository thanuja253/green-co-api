import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UploadLaunchAndTrainingDto {
  @IsOptional()
  @IsString()
  launch_training_report_date?: string; // e.g. YYYY-MM-DD or ISO date

  /** Same meaning as launch_training_report_date (admin Launch & Training sessions). */
  @IsOptional()
  @IsString()
  session_date?: string;

  /** Backward-compatible alias used by some clients; treated same as session_date. */
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : String(value),
  )
  @IsString()
  session?: string;

  /**
   * UI may send which session slot (1–4); upload handler ignores it.
   * Whitelisted so global `forbidNonWhitelisted` accepts multipart/form fields.
   */
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : String(value),
  )
  @IsString()
  session_index?: string;

  /** Optional session time (UI metadata; not persisted separately from session_date). */
  @IsOptional()
  @IsString()
  session_time?: string;

  /** Presigned S3 upload — same pattern as proposal / work order. */
  @IsOptional()
  @IsString()
  launch_session_file_s3_key?: string;

  @IsOptional()
  @IsString()
  launch_training_document_s3_key?: string;

  @IsOptional()
  @IsString()
  launch_and_training_document_s3_key?: string;

  @IsOptional()
  @IsString()
  document_s3_key?: string;

  @IsOptional()
  @IsString()
  file_s3_key?: string;

  @IsOptional()
  @IsString()
  s3_key?: string;
}
