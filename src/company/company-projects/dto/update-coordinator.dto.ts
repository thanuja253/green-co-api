import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCoordinatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  mobile?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
