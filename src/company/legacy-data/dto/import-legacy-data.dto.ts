import { IsArray, IsOptional, IsString } from 'class-validator';

export class ImportLegacyDataDto {
  @IsOptional()
  @IsString()
  csv_text?: string;

  @IsOptional()
  @IsArray()
  rows?: Array<Record<string, any>>;
}

