import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FacilitatorDocument = Facilitator & Document;

@Schema({ timestamps: true })
export class Facilitator {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  mobile?: string;

  @Prop({ default: '1' })
  status: string;

  @Prop()
  industry_category?: string;

  @Prop()
  alternate_mobile?: string;

  @Prop()
  address_line_1?: string;

  @Prop()
  address_line_2?: string;

  @Prop()
  pincode?: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop()
  pan_number?: string;

  @Prop()
  enrollment_date?: string;

  @Prop({ default: false })
  gst_registered?: boolean;

  @Prop()
  gst_number?: string;

  @Prop({ default: false })
  lead_assessor?: boolean;

  @Prop()
  assessor_grade?: string;

  @Prop()
  emergency_contact_name?: string;

  @Prop()
  emergency_mobile?: string;

  @Prop()
  emergency_address_line_1?: string;

  @Prop()
  emergency_address_line_2?: string;

  @Prop()
  emergency_city?: string;

  @Prop()
  emergency_state?: string;

  @Prop()
  emergency_pincode?: string;

  @Prop()
  bank_name?: string;

  @Prop()
  account_number?: string;

  @Prop()
  branch_name?: string;

  @Prop()
  ifsc_code?: string;

  @Prop()
  biodata?: string;

  @Prop()
  vendor_registration_form?: string;

  @Prop()
  non_disclosure_agreement?: string;

  @Prop()
  health_declaration?: string;

  @Prop()
  gst_declaration?: string;

  @Prop()
  pan_card?: string;

  @Prop()
  cancelled_cheque?: string;

  @Prop()
  profile_image?: string;

  @Prop({ default: 'Pending' })
  approval_status?: string;

  @Prop()
  approval_remarks?: string;

  @Prop({ default: 'Incomplete' })
  profile_status?: string;
}

export const FacilitatorSchema = SchemaFactory.createForClass(Facilitator);



