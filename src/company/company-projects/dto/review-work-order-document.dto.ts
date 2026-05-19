import { IsOptional, IsString } from 'class-validator';

/** Normalize `action` or `status` from body (string or number). */
export function normalizeWorkOrderReviewAction(body: {
  action?: unknown;
  status?: unknown;
}): 'accept' | 'reject' | null {
  const raw = body.action ?? body.status;
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (['accept', 'accepted', '1', 'approve', 'approved'].includes(s)) return 'accept';
  if (['reject', 'rejected', '2', 'not_accepted', 'decline', 'declined'].includes(s)) {
    return 'reject';
  }
  return null;
}

export class ReviewWorkOrderDocumentDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  status?: string | number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
