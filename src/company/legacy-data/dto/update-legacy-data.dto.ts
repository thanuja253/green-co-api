import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateLegacyDataDto {
  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  level_of_certification?: string;

  @IsOptional()
  @IsString()
  date_of_award?: string;

  @IsOptional()
  @IsString()
  expiry_date?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  sector_id?: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone_no?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;
}

