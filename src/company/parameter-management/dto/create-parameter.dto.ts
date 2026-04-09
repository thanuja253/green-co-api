import { IsOptional, IsString } from 'class-validator';

export class CreateParameterDto {
  @IsString()
  name: string;

  @IsString()
  short_name: string;

  @IsOptional()
  @IsString()
  status?: string;
}

