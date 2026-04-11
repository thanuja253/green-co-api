import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Admin records PO and acceptance date after work order is approved (before project code).
 * acceptance_date: YYYY-MM-DD; must not be in the future (UTC calendar day).
 */
export class WorkOrderPoDetailsDto {
  @IsString()
  @IsNotEmpty()
  po_number: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}/, {
    message: 'acceptance_date must start with YYYY-MM-DD (ISO date)',
  })
  acceptance_date: string;
}
