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

  @IsOptional()
  @IsString()
  turnover_min?: string;

  @IsOptional()
  @IsString()
  fromturnover?: string;

  @IsOptional()
  @IsString()
  turnover_max?: string;

  @IsOptional()
  @IsString()
  toturnover?: string;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsString()
  t?: string;
}

