import { IsIn, IsNotEmpty, IsNumber, IsString } from 'class-validator';

/** 0=Pending, 1=Approved, 2=Rejected, 3=Under Review */
export class UpdateFinanceV2ApprovalDto {
  @IsNumber()
  @IsIn([0, 1, 2, 3])
  approval_status: number;

  @IsString()
  @IsNotEmpty()
  remarks: string;
}
