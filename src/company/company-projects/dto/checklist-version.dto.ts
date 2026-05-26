import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateChecklistVersionDto {
  @IsString()
  @IsNotEmpty()
  checklist_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  version_label: string;

  @IsObject()
  @IsNotEmpty()
  checklist_data: Record<string, any>;

  @IsOptional()
  @IsString()
  change_notes?: string;

  @IsOptional()
  @IsString()
  effective_from?: string;
}

export class UpdateChecklistVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  version_label?: string;

  @IsOptional()
  @IsObject()
  checklist_data?: Record<string, any>;

  @IsOptional()
  @IsString()
  change_notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  effective_until?: string;
}

export class AssignChecklistVersionDto {
  @IsString()
  @IsNotEmpty()
  checklist_version_id: string;
}
