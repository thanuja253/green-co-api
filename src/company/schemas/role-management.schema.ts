import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoleManagementDocument = RoleManagement & Document;

@Schema({ timestamps: true })
export class RoleManagement {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ default: '1', trim: true })
  status: string;

  @Prop({ trim: true })
  formnumber?: string;

  @Prop({ type: Object, default: {} })
  permissions?: Record<string, any>;
}

export const RoleManagementSchema = SchemaFactory.createForClass(RoleManagement);

