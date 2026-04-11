import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Manual project code e.g. CI2604006 — stored uppercase. */
export class ProjectCodeUpsertDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Project code may only contain letters, numbers, hyphens, and underscores',
  })
  project_code: string;
}
