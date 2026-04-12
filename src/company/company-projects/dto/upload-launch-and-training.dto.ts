import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Multipart body for legacy Launch & Training upload
 * (`POST .../launch-and-training-document` and related admin company-project upload routes).
 * Dashboards often send `session_index` + `session_date` like the multi-session endpoint.
 */
export class UploadLaunchAndTrainingDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '' || value === null) return undefined;
    const n = Number.parseInt(String(value), 10);
    return Number.isNaN(n) ? value : n;
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  session_index?: number;

  /** Same meaning as `launch_training_report_date` (prefer one or the other). */
  @IsOptional()
  @IsString()
  session_date?: string;

  @IsOptional()
  @IsString()
  launch_training_report_date?: string; // e.g. YYYY-MM-DD or d-m-Y from frontend
}
