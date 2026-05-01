import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterThroughFacilitatorDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Company name is required' })
  @IsString()
  @MinLength(2, { message: 'Company name must be at least 2 characters' })
  @MaxLength(50, { message: 'Company name must not exceed 50 characters' })
  company_name: string;

  @IsNotEmpty({ message: 'Mobile number is required' })
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Please Enter a Valid Mobile Number',
  })
  mobileno: string;

  @IsOptional()
  @IsString()
  facilitator_id?: string;

  @IsOptional()
  @IsString()
  consultant_id?: string;

  @IsOptional()
  @IsString()
  facilitator_code?: string;
}

