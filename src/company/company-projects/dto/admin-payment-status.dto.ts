import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AdminPaymentStatusDto {
  @IsNotEmpty()
  @IsString()
  payment_id: string;

  @IsNotEmpty()
  @IsNumber()
  @IsIn([1, 2])
  status: number; // 1 approved, 2 rejected

  @IsOptional()
  @IsString()
  remarks?: string;
}

