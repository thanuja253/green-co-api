import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SubmitFinanceV2PaymentDto {
  @Transform(({ value, obj }) => {
    const candidates = [
      value,
      obj?.payment_type,
      obj?.paymentType,
      obj?.payment_mode,
      obj?.transaction_mode,
      obj?.trans_mode,
      obj?.mode,
    ];
    const raw = candidates.find(
      (v) => v !== undefined && v !== null && String(v).trim() !== '',
    );
    const normalized = String(raw ?? '').trim().toLowerCase();
    if (normalized === 'online') return 'Online';
    if (normalized === 'offline') return 'Offline';
    return value;
  })
  @IsOptional()
  @IsIn(['Online', 'Offline'])
  payment_type?: 'Online' | 'Offline';

  @Transform(({ value, obj }) => value ?? obj?.transaction_id)
  @IsOptional()
  @IsString()
  @Matches(/^\S(?!.*\s{2,}).*\S$|^\S+$/, {
    message: 'Transaction ID cannot have leading/trailing spaces or double spaces',
  })
  trans_id?: string;

  @IsOptional()
  @IsString()
  transaction_id?: string;

  @IsOptional()
  @IsString()
  payment_mode?: string;

  @IsOptional()
  @IsString()
  transaction_mode?: string;

  @IsOptional()
  @IsString()
  trans_mode?: string;

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
