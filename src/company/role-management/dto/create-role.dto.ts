import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  formnumber?: string;

  @IsOptional()
  @IsArray()
  permissions?: Array<string | number>;
}

