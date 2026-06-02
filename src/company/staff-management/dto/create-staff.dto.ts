import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateStaffDto {
  @Transform(({ value }) => (value == null ? value : String(value)))
  @IsString()
  employee_code: string;

  /** Legacy payload key used by some admin UIs. */
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @IsString()
  employeecode?: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  mobile_number?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  role?: string | number | Array<string | number>;

  @IsOptional()
  @IsString()
  role_id?: string;

  @IsOptional()
  @IsString()
  role_name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

