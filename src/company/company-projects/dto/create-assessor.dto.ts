import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { IsOptional } from 'class-validator';

export class CreateAssessorDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9+\-\s()]{8,20}$/, {
    message: 'mobile must be a valid mobile number',
  })
  @IsOptional()
  mobile?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{8,20}$/, {
    message: 'mobile_number must be a valid mobile number',
  })
  mobile_number?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

