import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateStateDto } from './create-state.dto';

export class BulkCreateStatesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStateDto)
  states: CreateStateDto[];
}

