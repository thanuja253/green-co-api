import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  edit_employee_code?: string;

  @IsOptional()
  @IsString()
  edit_name?: string;

  @IsOptional()
  @IsEmail()
  edit_email?: string;

  @IsOptional()
  @IsString()
  edit_mobile?: string;

  @IsOptional()
  @IsString()
  edit_address?: string;

  @IsOptional()
  edit_role?: string | number | Array<string | number>;

  @IsOptional()
  @IsString()
  edit_status?: string;
}
