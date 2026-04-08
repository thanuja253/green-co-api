import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LegacyDataDocument = LegacyData & Document;

@Schema({ timestamps: true })
export class LegacyData {
  @Prop({ required: true, trim: true })
  company_name: string;

  @Prop({ trim: true })
  level_of_certification?: string;

  @Prop({ trim: true })
  date_of_award?: string;

  @Prop({ trim: true })
  expiry_date?: string;

  @Prop({ trim: true })
  sector_id?: string;

  @Prop({ trim: true })
  sector?: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  phone_no?: string;

  @Prop({ trim: true })
  created_by?: string;

  @Prop({ trim: true })
  updated_by?: string;

  @Prop()
  deleted_at?: Date | null;
}

export const LegacyDataSchema = SchemaFactory.createForClass(LegacyData);

