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

  /**
   * Legacy frontend payloads sometimes send `permission` or `permission_ids`.
   * Keep these optional so global ValidationPipe does not reject the request.
   */
  @IsOptional()
  @IsArray()
  permission?: Array<string | number>;

  @IsOptional()
  @IsArray()
  permission_ids?: Array<string | number>;
}

