import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpsertOutstandingDetailsDto {
  @IsOptional()
  @IsString()
  outstanding_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  outstanding_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  outstanding_amt?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsDateString({}, { message: 'date must be in valid date format' })
  date?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsDateString({}, { message: 'outstanding_date must be in valid date format' })
  outstanding_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  outstanding_remark?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Unpaid', 'Partial', 'Paid', 'unpaid', 'partial', 'paid'])
  status?: 'Unpaid' | 'Partial' | 'Paid' | 'unpaid' | 'partial' | 'paid';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paid_amt?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paid_amount?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsDateString({}, { message: 'paid_date must be in valid date format' })
  paid_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  paid_remark?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  outstanding_amt_paid?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  due_outstanding_amt?: number;
}
