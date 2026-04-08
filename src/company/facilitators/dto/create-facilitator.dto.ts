import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateFacilitatorDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  mobile_number?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

