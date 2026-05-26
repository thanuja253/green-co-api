import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDashboardResourceDto {
  @IsIn(['user_guide_video', 'faq', 'user_manual'])
  resource_type: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sort_order?: number;
}

export class UpdateDashboardResourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sort_order?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
