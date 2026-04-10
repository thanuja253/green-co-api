import { IsEmail, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateQuickviewDataDto {
  @IsOptional()
  @IsObject()
  company?: {
    name?: string;
    email?: string;
    mobile?: string;
    account_status?: string;
    verified_status?: string;
    reg_id?: string;
    turnover?: string;
    mst_sector_id?: string;
  };

  @IsOptional()
  @IsObject()
  project?: {
    project_id?: string;
    process_type?: string;
    next_activities_id?: number;
  };

  @IsOptional()
  @IsObject()
  registration_info?: Record<string, any>;

  // Convenience top-level aliases
  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsEmail()
  company_email?: string;

  @IsOptional()
  @IsString()
  company_mobile?: string;

  @IsOptional()
  @IsString()
  project_code?: string;

  @IsOptional()
  @IsString()
  process_type?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(999)
  next_activities_id?: number;
}
