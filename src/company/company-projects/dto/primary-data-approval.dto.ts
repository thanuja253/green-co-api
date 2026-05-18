import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

/** Admin approval: status 1 Accepted, 2 Not Accepted, 3 Under Review */
export class PrimaryDataFormApprovalDto {
  @IsString()
  form_type: string; // gi, ee, wc, re, gge, wm, mcr, gsc, ps, gin, tar

  @IsNumber()
  @IsIn([1, 2, 3], { message: 'status must be 1 (Accepted), 2 (Not Accepted), or 3 (Under Review)' })
  status: number;

  @IsOptional()
  @IsString()
  remark?: string;

  /** Alias used by some admin UIs (same as `remark`). */
  @IsOptional()
  @IsString()
  remarks?: string;
}
