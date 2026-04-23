import { IsOptional, IsString } from 'class-validator';

export class ListParametersQueryDto {
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
  short_name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

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
}

