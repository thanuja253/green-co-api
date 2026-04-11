import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCoordinatorDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  /** Phone / mobile for dropdown label: "Name - 9398758947" */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mobile?: string;

  /** Optional; default active "1" */
  @IsOptional()
  @IsString()
  status?: string;
}
