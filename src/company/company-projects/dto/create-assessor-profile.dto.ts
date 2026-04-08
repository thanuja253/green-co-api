import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAssessorProfileDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  mobile: string;

  @IsOptional() @IsString() industry_category?: string;
  @IsOptional() @IsString() alternate_mobile?: string;
  @IsOptional() @IsString() address_line_1?: string;
  @IsOptional() @IsString() address_line_2?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pan_number?: string;
  @IsOptional() @IsString() enrollment_date?: string;
  @IsOptional() @IsString() gst_registered?: string;
  @IsOptional() @IsString() gst_number?: string;
  @IsOptional() @IsString() lead_assessor?: string;
  @IsOptional() @IsString() assessor_grade?: string;
  @IsOptional() @IsString() status?: string;

  @IsOptional() @IsString() emergency_contact_name?: string;
  @IsOptional() @IsString() emergency_mobile?: string;
  @IsOptional() @IsString() emergency_address_line_1?: string;
  @IsOptional() @IsString() emergency_address_line_2?: string;
  @IsOptional() @IsString() emergency_city?: string;
  @IsOptional() @IsString() emergency_state?: string;
  @IsOptional() @IsString() emergency_pincode?: string;

  @IsOptional() @IsString() bank_name?: string;
  @IsOptional() @IsString() account_number?: string;
  @IsOptional() @IsString() branch_name?: string;
  @IsOptional() @IsString() ifsc_code?: string;
}

