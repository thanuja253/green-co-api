import { IsObject, IsOptional, IsString } from 'class-validator';

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
  @IsObject()
  permissions?: Record<string, any>;
}

