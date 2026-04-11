import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Admin-entered PO and acceptance date after the work order is accepted (wo_status = 1).
 * Date must not be in the future (validated in service).
 */
export class WorkOrderAcceptanceDetailsDto {
  @IsString()
  @MaxLength(120)
  wo_po_number: string;

  /** ISO date string (e.g. 2026-04-11 or full ISO); cannot be after end of today (server local). */
  @IsString()
  @IsNotEmpty()
  wo_acceptance_date: string;
}
