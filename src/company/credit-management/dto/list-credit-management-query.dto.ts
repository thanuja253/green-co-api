import { IsOptional, IsString } from 'class-validator';

export class ListCreditManagementQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  checklist_criteria?: string;

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
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

