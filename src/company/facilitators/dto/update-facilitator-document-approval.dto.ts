import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateFacilitatorDocumentApprovalDto {
  @IsString()
  @IsIn(['Approved', 'Rejected', 'Pending'])
  status: 'Approved' | 'Rejected' | 'Pending';

  @IsOptional()
  @IsString()
  remarks?: string;
}
