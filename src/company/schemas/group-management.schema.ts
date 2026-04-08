import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GroupManagementDocument = GroupManagement & Document;

@Schema({ timestamps: true })
export class GroupManagement {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ default: '1', trim: true })
  status: string;

  @Prop({ trim: true })
  sample_document?: string;
}

export const GroupManagementSchema = SchemaFactory.createForClass(GroupManagement);

