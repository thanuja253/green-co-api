import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CoordinatorDocument = Coordinator & Document;

@Schema({ timestamps: true })
export class Coordinator {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  /** Phone / mobile for dropdown display: "Name - 9398758947" */
  @Prop({ trim: true })
  mobile?: string;

  @Prop({ default: '1' })
  status: string;
}

export const CoordinatorSchema = SchemaFactory.createForClass(Coordinator);



