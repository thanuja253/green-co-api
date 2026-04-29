import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
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

  @IsNotEmpty({ message: 'Assessment type is required' })
  @IsEnum(['cii', 'facilitator', 'c', 'f'], {
    message: 'Assessment must be one of "cii", "facilitator", "c", or "f"',
  })
  assessment: 'cii' | 'facilitator' | 'c' | 'f';

  @ValidateIf((o) => o.assessment === 'facilitator' || o.assessment === 'f')
  @IsNotEmpty({ message: 'Facilitator selection is required when assessment is facilitator' })
  @IsString()
  selectfacilitator?: string;
}



