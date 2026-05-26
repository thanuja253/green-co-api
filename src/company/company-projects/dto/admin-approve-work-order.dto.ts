import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class AdminApproveWorkOrderDto {
  @IsIn(['approved', 'rejected'])
  action: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  wo_number?: string;

  @IsOptional()
  @IsString()
  wo_date?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Company Name cannot be blank' })
  @MaxLength(250)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  company_name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Total Fee must be non-negative' })
  total_fee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Registration Fee must be non-negative' })
  registration_fee?: number;

  @IsOptional()
  @IsString()
  rejection_reason?: string;
}
