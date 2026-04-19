import {
  Allow,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateProformaInvoiceV2Dto {
  @IsOptional()
  @Transform(({ value, obj }) => {
    if (value === 'proforma' || value === 'tax') return value;
    const paymentFor = String(obj?.payment_for ?? '').trim().toLowerCase();
    if (paymentFor === 'inv') return 'tax';
    if (paymentFor === 'per_inv') return 'proforma';
    const paymentType = String(obj?.payment_type ?? '').trim().toLowerCase();
    if (paymentType === 'tax') return 'tax';
    if (paymentType === 'proforma') return 'proforma';
    return value;
  })
  @IsIn(['proforma', 'tax'])
  invoice_type?: 'proforma' | 'tax';

  @IsOptional()
  @IsIn(['per_inv', 'inv'])
  payment_for?: 'per_inv' | 'inv';

  @IsOptional()
  @IsIn(['proforma', 'tax'])
  payment_type?: 'proforma' | 'tax';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return typeof value === 'string' ? value.trim() : value;
  })
  @MaxLength(50)
  invoice_title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  payable_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(28)
  sgst?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(28)
  cgst?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(28)
  igst?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const raw = typeof value === 'string' ? value.trim() : String(value).trim();
    if (/^\d{1,2}$/.test(raw)) {
      const n = parseInt(raw, 10);
      if (n >= 1 && n <= 38) return n.toString().padStart(2, '0');
    }
    return raw;
  })
  @Matches(/^\d{2}$/, { message: 'supplier_state_code must be a valid state code (01–38)' })
  supplier_state_code?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const raw = typeof value === 'string' ? value.trim() : String(value).trim();
    if (/^\d{1,2}$/.test(raw)) {
      const n = parseInt(raw, 10);
      if (n >= 1 && n <= 38) return n.toString().padStart(2, '0');
    }
    return raw;
  })
  @Matches(/^\d{2}$/, { message: 'place_of_supply_state_code must be a valid state code (01–38)' })
  place_of_supply_state_code?: string;

  /** Client preview only; ignored on update (server recomputes). */
  @IsOptional()
  @Allow()
  sgst_amt?: unknown;

  @IsOptional()
  @Allow()
  cgst_amt?: unknown;

  @IsOptional()
  @Allow()
  igst_amt?: unknown;

  @IsOptional()
  @Allow()
  transaction_type?: unknown;

  @IsOptional()
  @Allow()
  is_intra_state?: unknown;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  send_reminder?: 0 | 1;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  send_invoice_to?: string;
}
