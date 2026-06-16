import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @Transform(({ value }) => String(value ?? '').trim())
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}



