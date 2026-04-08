import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AssessorGradeDocument = AssessorGrade & Document;

@Schema({ timestamps: true })
export class AssessorGrade {
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  name: string;

  @Prop({ default: 1 })
  status: number;
}

export const AssessorGradeSchema = SchemaFactory.createForClass(AssessorGrade);

