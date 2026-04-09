import { IsOptional, IsString } from 'class-validator';

export class CreateCreditManagementDto {
  @IsString()
  checklist_criteria: string;

  @IsString()
  credit_main_heading: string;

  @IsString()
  credit_number: string;

  @IsString()
  parameter: string;

  @IsString()
  max_score: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

