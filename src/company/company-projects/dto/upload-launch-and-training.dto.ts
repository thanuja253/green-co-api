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
}
