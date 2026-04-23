import { IsOptional, IsString } from 'class-validator';

export class CreateParameterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  short_name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  // Legacy criteria payload compatibility
  @IsOptional()
  @IsString()
  criteria_add_name?: string;

  @IsOptional()
  @IsString()
  criteria_add_sc_name?: string;

  @IsOptional()
  @IsString()
  criteria_edit_name?: string;

  @IsOptional()
  @IsString()
  criteria_edit_sc_name?: string;

  // UI label compatibility (Title / Short Name)
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsString()
  shortname?: string;

  // Legacy criteria-group compatibility
  @IsOptional()
  criteria_group_add?: string[] | string;

  @IsOptional()
  criteria_group_edit?: string[] | string;

  @IsOptional()
  group_id?: string[] | string;

  @IsOptional()
  group_ids?: string[] | string;
}

