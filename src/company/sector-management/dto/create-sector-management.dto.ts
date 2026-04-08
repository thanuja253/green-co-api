import { IsOptional, IsString } from 'class-validator';

export class CreateSectorManagementDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  group_name?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

