import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGroupChecklistVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  change_notes?: string;

  @IsOptional()
  @IsString()
  checklist_document?: string;
}
