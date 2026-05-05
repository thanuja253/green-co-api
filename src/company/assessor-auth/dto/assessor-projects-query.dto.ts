import { IsOptional, IsString } from 'class-validator';

export class AssessorProjectsQueryDto {
  /** When myprojects is called without JWT, pass Mongo assessor id. */
  @IsOptional()
  @IsString()
  assessor_id?: string;

  @IsOptional()
  @IsString()
  assessorId?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  // DataTables compatibility
  @IsOptional()
  @IsString()
  draw?: string;

  @IsOptional()
  @IsString()
  start?: string;

  @IsOptional()
  @IsString()
  length?: string;

  @IsOptional()
  @IsString()
  company_id?: string;

  // Legacy filter name from old assessor table
  @IsOptional()
  @IsString()
  reg_id?: string;

  @IsOptional()
  @IsString()
  project_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  account_status?: string;

  // Legacy filter name from old assessor table
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  verification_status?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  turnover_min?: string;

  // Legacy filter names
  @IsOptional()
  @IsString()
  fromturnover?: string;

  @IsOptional()
  @IsString()
  turnover_max?: string;

  // Legacy filter names
  @IsOptional()
  @IsString()
  toturnover?: string;

  @IsOptional()
  search?: unknown;
}
