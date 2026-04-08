import { IsOptional, IsString } from 'class-validator';

export class ReportsQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  company_status?: string;

  @IsOptional()
  @IsString()
  register_through?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  facilitator?: string;

  @IsOptional()
  @IsString()
  assessor?: string;

  @IsOptional()
  @IsString()
  coordinator?: string;
}

