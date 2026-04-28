import { IsEmail, IsNotEmpty } from 'class-validator';

export class FacilitatorLoginDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
