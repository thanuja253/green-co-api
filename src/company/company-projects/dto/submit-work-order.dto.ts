import { IsNotEmpty, IsString, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class SubmitWorkOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Work Order Number is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  wo_number: string;

  @IsDateString({}, { message: 'Work Order Date must be a valid date' })
  @IsNotEmpty({ message: 'Work Order Date is required' })
  wo_date: string;
}
