import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class AdminAssignAssessorDto {
  @IsNotEmpty()
  @IsString()
  selectassessor: string;

  @IsNotEmpty()
  @IsString()
  assessor_date: string; // dd/mm/yyyy,dd/mm/yyyy

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  assessor_amount: number;
}

