import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FreezeDashboardDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2099)
  year: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
