import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OutstandingDuePaymentDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  due_amt?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  due_amount?: number;

  @IsOptional()
  @IsDateString({}, { message: 'paid_date must be in valid date format' })
  paid_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  paid_remark?: string;
}
