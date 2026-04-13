import { IsIn, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateInvoiceApprovalV2Dto {
  @IsNumber()
  @IsIn([1, 2])
  approval_status: 1 | 2;

  @IsString()
  @IsNotEmpty()
  remarks: string;
}
