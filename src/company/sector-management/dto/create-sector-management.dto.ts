import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateSectorManagementDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9 &()\-]+$/, {
    message: 'name may contain only letters, numbers, spaces, &, (), and -',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9 &()\-]+$/, {
    message: 'group_name may contain only letters, numbers, spaces, &, (), and -',
  })
  group_name?: string;

  @IsOptional()
  @IsString()
  group_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['0', '1'])
  status?: string;

  // Legacy payload compatibility
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9 &()\-]+$/, {
    message: 'sector_add_name may contain only letters, numbers, spaces, &, (), and -',
  })
  sector_add_name?: string;

  @IsOptional()
  @IsString()
  sector_group_add?: string;

  @IsOptional()
  @IsString()
  @IsIn(['0', '1'])
  sector_add_status?: string;

  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9 &()\-]+$/, {
    message: 'sector_edit_name may contain only letters, numbers, spaces, &, (), and -',
  })
  sector_edit_name?: string;

  @IsOptional()
  @IsString()
  sector_group_edit?: string;

  @IsOptional()
  @IsString()
  @IsIn(['0', '1'])
  sector_edit_status?: string;
}

