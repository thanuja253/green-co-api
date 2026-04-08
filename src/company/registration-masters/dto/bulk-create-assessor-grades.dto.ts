import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateAssessorGradeDto } from './create-assessor-grade.dto';

export class BulkCreateAssessorGradesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessorGradeDto)
  grades: CreateAssessorGradeDto[];
}

