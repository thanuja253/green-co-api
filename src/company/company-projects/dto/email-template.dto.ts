import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateEmailTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @IsNotEmpty()
  subject_template: string;

  @IsString()
  @IsNotEmpty()
  body_template: string;

  @IsString()
  @IsNotEmpty()
  template_type: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  available_placeholders?: string[];
}

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  subject_template?: string;

  @IsOptional()
  @IsString()
  body_template?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  available_placeholders?: string[];
}

export class SendRatingEmailDto {
  @IsString()
  @IsNotEmpty()
  template_id: string;

  @IsString()
  @IsNotEmpty()
  plant_head_email: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additional_cc?: string[];
}
