import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CreditManagementDocument = CreditManagement & Document;

@Schema({ timestamps: true })
export class CreditManagement {
  @Prop({ required: true, trim: true })
  checklist_criteria: string;

  @Prop({ required: true, trim: true })
  credit_main_heading: string;

  @Prop({ required: true, trim: true, unique: true })
  credit_number: string;

  @Prop({ required: true, trim: true })
  parameter: string;

  @Prop({ required: true, trim: true })
  max_score: string;

  @Prop({ trim: true })
  requirements?: string;

  @Prop({ default: '1', trim: true })
  status: string;
}

export const CreditManagementSchema = SchemaFactory.createForClass(CreditManagement);

