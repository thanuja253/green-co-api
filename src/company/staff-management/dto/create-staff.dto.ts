import { Expose, Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

function toTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/** Runs after transforms; accepts `employee_code` or `employeecode` on the raw body. */
@ValidatorConstraint({ name: 'hasEmployeeCode', async: false })
class HasEmployeeCodeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const o = args.object as Record<string, unknown>;
    return toTrimmedString(o.employee_code ?? o.employeecode).length > 0;
  }

  defaultMessage() {
    return 'The employee code field is required.';
  }
}

export class CreateStaffDto {
  /**
   * Maps JSON key `employeecode` → `employee_code` (class-transformer skips @Transform when the target key is absent).
   */
  @Expose({ name: 'employeecode' })
  @Transform(({ value, obj }) =>
    toTrimmedString(value ?? obj?.employee_code ?? obj?.employeecode),
  )
  @Validate(HasEmployeeCodeConstraint)
  @IsString()
  @IsNotEmpty({ message: 'The employee code field is required.' })
  employee_code: string;

  @IsOptional()
  employeecode?: string | number;

  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty({ message: 'The name field is required.' })
  name: string;

  @Transform(({ value }) => toTrimmedString(value).toLowerCase())
  @IsEmail()
  email: string;

  @Expose({ name: 'mobile' })
  @IsOptional()
  @Transform(({ value, obj }) =>
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
