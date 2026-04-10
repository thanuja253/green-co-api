import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, Max, Min } from 'class-validator';

export class CompleteMilestoneDto {
  @IsInt()
  @Min(1)
  @Max(24) // Updated to support all 24 milestones
  milestone_flow: number;

  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean = true;

  /** Who completed this step — drives notification copy ("by company" vs "by CII"). Default: cii */
  @IsOptional()
  @IsIn(['company', 'cii'])
  activity_type?: 'company' | 'cii';
}


