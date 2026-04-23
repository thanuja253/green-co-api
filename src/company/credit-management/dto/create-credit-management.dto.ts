import { Allow, IsOptional, IsString } from 'class-validator';

export class CreateCreditManagementDto {
  @IsOptional()
  @IsString()
  checklist_criteria?: string;

  @IsOptional()
  @IsString()
  credit_main_heading?: string;

  @IsOptional()
  @IsString()
  credit_number?: string;

  @IsOptional()
  @IsString()
  parameter?: string;

  @IsOptional()
  @IsString()
  max_score?: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  status?: string;

  // Legacy scoring payload compatibility
  @IsOptional()
  @Allow()
  criteria_id?: unknown;

  @IsOptional()
  @IsString()
  criteria_name?: string;

  @IsOptional()
  @IsString()
  group_name?: string;
}

