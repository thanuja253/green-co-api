import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitFinanceV2PaymentDto {
  @IsIn(['Online', 'Offline'])
  payment_type: 'Online' | 'Offline';

  @IsOptional()
  @IsString()
  @Matches(/^\S(?!.*\s{2,}).*\S$|^\S+$/, {
    message: 'Transaction ID cannot have leading/trailing spaces or double spaces',
  })
  trans_id?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  paid_amount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  remarks?: string;
}
