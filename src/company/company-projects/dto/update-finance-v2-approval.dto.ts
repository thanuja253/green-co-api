import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

/** 0=Pending, 1=Approved, 2=Rejected, 3=Under Review */
export class UpdateFinanceV2ApprovalDto {
  @Transform(({ value }) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    const label = trimmed.toLowerCase();
    if (label === 'pending') return 0;
    if (label === 'approved' || label === 'acknowledged') return 1;
    if (label === 'rejected' || label === 'not acknowledged') return 2;
    if (label === 'under review') return 3;
    return value;
  })
  @IsNumber()
  @IsIn([0, 1, 2, 3])
  approval_status: number;

  // Preferred key.
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  remarks?: string;

  // Backward-compatible alias key used by some clients.
  @Transform(({ value, obj }) => value ?? obj?.approval_remarks)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  approval_remarks?: string;
}
