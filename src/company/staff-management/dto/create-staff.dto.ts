import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

function toTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export class CreateStaffDto {
  /**
   * Accepts `employee_code`, `employeecode`, or legacy numeric values (coerced to string).
   */
  @Transform(({ obj, value }) =>
    toTrimmedString(value ?? obj?.employeecode ?? obj?.employee_code),
  )
  @IsString()
  @IsNotEmpty({ message: 'The employee code field is required.' })
  employee_code: string;

  /** Legacy key — whitelisted; value is merged into employee_code above. */
  @IsOptional()
  employeecode?: string | number;

  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty({ message: 'The name field is required.' })
  name: string;

  @Transform(({ value }) => toTrimmedString(value).toLowerCase())
  @IsEmail()
  email: string;

  @IsOptional()
  @Transform(({ obj, value }) =>
    toTrimmedString(value ?? obj?.mobile ?? obj?.mobile_number),
  )
  @IsString()
  mobile_number?: string;

  @IsOptional()
  mobile?: string | number;

  @IsOptional()
  role?: string | number | Array<string | number>;

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  role_id?: string;

  @IsOptional()
  @IsString()
  role_name?: string;

  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty({ message: 'The address field is required.' })
  address: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  status?: string;
}
