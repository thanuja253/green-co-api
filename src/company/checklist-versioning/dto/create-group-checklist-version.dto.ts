import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGroupChecklistVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  change_notes?: string;

  /** When set, clone parameters (master_checklist_sectors) from this version id. */
  @IsOptional()
  @IsString()
  clone_from_version_id?: string;

  @IsOptional()
  @IsIn(['draft'])
  status?: 'draft';
}
