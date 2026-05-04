import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateFacilitatorProfileDto {
  @IsOptional()
  @IsString()
  consultant_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  facilitator_name?: string;

  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsEmail()
  facilitator_email?: string;

  @IsOptional()
  @IsEmail()
  company_email?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  industry_category?: string;

  /** Some clients send PascalCase; whitelisted for ValidationPipe. */
  @IsOptional()
  @IsString()
  Industry_category?: string;

  @IsOptional()
  @IsString()
  organization?: string;

  /** Some clients send PascalCase; whitelisted for ValidationPipe. */
  @IsOptional()
  @IsString()
  Organization?: string;

  @IsOptional()
  @IsString()
  alternate_mobile?: string;

  @IsOptional()
  @IsString()
  address_line_1?: string;

  @IsOptional()
  @IsString()
  address_line_2?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pan_number?: string;

  @IsOptional()
  @IsString()
  enrollment_date?: string;

  @IsOptional()
  @IsString()
  gst_registered?: string;

  @IsOptional()
  @IsString()
  gst_number?: string;

  @IsOptional()
  @IsString()
  lead_assessor?: string;

  @IsOptional()
  @IsString()
  assessor_grade?: string;

  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  emergency_mobile?: string;

  @IsOptional()
  @IsString()
  emergency_address_line_1?: string;

  @IsOptional()
  @IsString()
  emergency_address_line_2?: string;

  @IsOptional()
  @IsString()
  emergency_city?: string;

  @IsOptional()
  @IsString()
  emergency_state?: string;

  @IsOptional()
  @IsString()
  emergency_pincode?: string;

  @IsOptional()
  @IsString()
  bank_name?: string;

  @IsOptional()
  @IsString()
  account_number?: string;

  @IsOptional()
  @IsString()
  branch_name?: string;

  @IsOptional()
  @IsString()
  ifsc_code?: string;

  @IsOptional()
  @IsString()
  educational_qualification?: string;

  @IsOptional()
  @IsString()
  additional_professional_qualification?: string;

  @IsOptional()
  @IsString()
  total_years_professional_experience?: string;

  @IsOptional()
  @IsString()
  years_env_sustainability?: string;

  @IsOptional()
  @IsString()
  areas_of_specialization?: string;

  @IsOptional()
  @IsString()
  company_website?: string;

  @IsOptional()
  @IsString()
  company_website_details?: string;

  @IsOptional()
  @IsString()
  linkedin_profile?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

