import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDocument = Company & Document;

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true, unique: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ required: true, unique: true })
  mobile: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '1' }) // '1' = active, '0' = inactive (legacy PHP integer 1/0)
  account_status: string;

  /** Legacy PHP `companies.assessment_through`: `cii` | `facilitator`. */
  @Prop()
  assessment_through?: string;

  @Prop({ default: '0' }) // '1' = verified, '0' = not verified
  verified_status: string;

  @Prop()
  reg_id?: string;

  @Prop()
  turnover?: string;

  @Prop()
  mst_sector_id?: string;

  @Prop()
  status_updated_at?: Date;

  @Prop({ default: null })
  deleted_at?: Date | null;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

