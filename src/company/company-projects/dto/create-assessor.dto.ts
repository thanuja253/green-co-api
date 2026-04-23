import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

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

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return undefined;
  })
  send_credentials?: boolean;
}

