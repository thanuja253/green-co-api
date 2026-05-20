import { IsOptional, IsString } from 'class-validator';

export class ListRolesQueryDto {
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
  status?: string;

  @IsOptional()
  @IsString()
  account_status?: string;

  @IsOptional()
  @IsString()
  search?: string;

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

