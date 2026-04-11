import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Multipart body for Launch & Training session upload (session_index 1–4, optional session_date). */
export class AddLaunchTrainingSessionDto {
  @Transform(({ value }) => {
    if (value === undefined || value === '' || value === null) return 1;
    const n = parseInt(String(value), 10);
    return Number.isNaN(n) ? value : n;
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  session_index: number;

  @IsOptional()
  @IsString()
  session_date?: string;
}
