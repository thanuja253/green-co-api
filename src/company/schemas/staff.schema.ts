import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StaffDocument = Staff & Document;

@Schema({ timestamps: true })
export class Staff {
  @Prop({ required: true, trim: true, unique: true })
  employee_code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ trim: true })
  mobile_number?: string;

  @Prop({ trim: true })
  role_id?: string;

  @Prop({ trim: true })
  role_name?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  designation?: string;

  @Prop({ default: '1', trim: true })
  status?: string;
}

export const StaffSchema = SchemaFactory.createForClass(Staff);

