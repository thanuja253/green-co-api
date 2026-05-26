import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ChecklistVersionDocument = ChecklistVersion & Document;

@Schema({ timestamps: true, collection: 'checklist_versions' })
export class ChecklistVersion {
  @Prop({ required: true, index: true })
  checklist_id: string;

  @Prop({ required: true })
  version: number;

  @Prop({ required: true })
  version_label: string;

  @Prop({ type: Object, required: true })
  checklist_data: Record<string, any>;

  @Prop({ default: 'active' })
  status: string;

  @Prop()
  created_by?: string;

  @Prop()
  created_by_name?: string;

  @Prop()
  change_notes?: string;

  @Prop()
  effective_from?: Date;

  @Prop()
  effective_until?: Date;
}

export const ChecklistVersionSchema = SchemaFactory.createForClass(ChecklistVersion);
ChecklistVersionSchema.index({ checklist_id: 1, version: 1 }, { unique: true });
ChecklistVersionSchema.index({ checklist_id: 1, status: 1 });
