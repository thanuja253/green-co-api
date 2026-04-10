import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ReviewProposalDto {
  @IsNotEmpty()
  @IsNumber()
  @IsIn([1, 2]) // 1 = Accepted, 2 = Rejected
  proposal_status: number;

  @IsOptional()
  @IsString()
  proposal_remarks?: string;
}
