import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateProposalStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['accepted', 'rejected'])
  status: 'accepted' | 'rejected';

  @IsOptional()
  @IsString()
  remarks?: string;
}
