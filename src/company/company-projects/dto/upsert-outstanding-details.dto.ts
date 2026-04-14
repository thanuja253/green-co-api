import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class UpsertOutstandingDetailsDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  outstanding_amount: number;

  @IsDateString({}, { message: 'date must be in valid date format' })
  date: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  remarks: string;

  @IsString()
  @IsIn(['Unpaid', 'Partial', 'Paid'])
  status: 'Unpaid' | 'Partial' | 'Paid';
}
