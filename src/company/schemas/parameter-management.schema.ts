import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ParameterManagementDocument = ParameterManagement & Document;

@Schema({ timestamps: true })
export class ParameterManagement {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ required: true, trim: true, unique: true })
  short_name: string;

  @Prop({ default: '1', trim: true })
  status: string;
}

export const ParameterManagementSchema = SchemaFactory.createForClass(ParameterManagement);

