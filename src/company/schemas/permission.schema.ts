import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PermissionDocument = Permission & Document;

@Schema({ timestamps: true })
export class Permission {
  @Prop({ required: true, unique: true })
  legacy_id: number;

  @Prop({ trim: true })
  module_name?: string;

  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ trim: true })
  display_name?: string;

  @Prop({ default: 'admin', trim: true })
  guard_name?: string;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
