import { IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';

const PLAQUE_TEXT_REGEX = /^[A-Za-z0-9_\- ]+$/;

export class UpsertPlaqueDetailsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(PLAQUE_TEXT_REGEX, {
    message: 'contact_person can only contain letters, numbers, space, underscore, and hyphen',
  })
  contact_person: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(PLAQUE_TEXT_REGEX, {
    message: 'designation can only contain letters, numbers, space, underscore, and hyphen',
  })
  designation: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'mobile must be exactly 10 digits' })
  @Matches(/^[6-9]\d{9}$/, {
    message: 'mobile must start with 6, 7, 8, or 9 and be 10 digits',
  })
  mobile: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  company_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(PLAQUE_TEXT_REGEX, {
    message: 'address can only contain letters, numbers, space, underscore, and hyphen',
  })
  address: string;
}
