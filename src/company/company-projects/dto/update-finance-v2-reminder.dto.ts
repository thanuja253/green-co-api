import { IsDateString, IsEmail, IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateFinanceV2ReminderDto {
  @Type(() => Number)
  @IsIn([0, 1])
  send_reminder: 0 | 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  @Max(365)
  max_reminders?: number;

  @IsOptional()
  @IsDateString()
  reminder_end_date?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  send_invoice_to?: string;
}
