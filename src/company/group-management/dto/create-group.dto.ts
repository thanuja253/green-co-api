import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateGroupDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9 &()\-]+$/, {
    message: 'name may contain only letters, numbers, spaces, &, (), and -',
  })
  name?: string;

  // Legacy admin payload compatibility
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9 &()\-]+$/, {
    message: 'group_add_name may contain only letters, numbers, spaces, &, (), and -',
  })
  group_add_name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9 &()\-]+$/, {
    message: 'group_name may contain only letters, numbers, spaces, &, (), and -',
  })
  group_name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['0', '1'])
  status?: string;

  // Legacy admin payload compatibility
  @IsOptional()
  @IsString()
  @IsIn(['0', '1'])
  group_add_status?: string;

  @IsOptional()
  @IsString()
  @IsIn(['0', '1'])
  group_status?: string;
}

