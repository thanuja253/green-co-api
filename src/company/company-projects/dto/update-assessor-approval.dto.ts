import { IsOptional, IsString } from 'class-validator';

export class UpdateAssessorApprovalDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  approval_status?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

