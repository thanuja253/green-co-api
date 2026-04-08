import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateIndustryDto } from './create-industry.dto';

export class BulkCreateIndustriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateIndustryDto)
  industries: CreateIndustryDto[];
}

