import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChecklistVersionDocument = ChecklistVersion & Document;

export type ChecklistVersionStatus = 'draft' | 'active' | 'archived';

@Schema({ timestamps: true, collection: 'checklist_versions' })
export class ChecklistVersion {
  /** Group this version belongs to (SOW: version per group). */
  @Prop({ index: true })
  group_id?: string;

  /** Human-readable code: V1, V2, V3. */
  @Prop()
  version_code?: string;

  /** Display name / label. */
  @Prop()
  label?: string;

  /** S3 or local path to checklist file for this version. */
  @Prop()
  checklist_document?: string;

  @Prop({ default: 'draft' })
  status: ChecklistVersionStatus | string;

  @Prop()
  effective_from?: Date;

  @Prop()
  effective_until?: Date;

  /** Legacy: treated as group_id when group_id is absent. */
  @Prop({ index: true })
  checklist_id?: string;

  @Prop()
  version?: number;

  @Prop()
  version_label?: string;

  @Prop({ type: Object, default: {} })
  checklist_data?: Record<string, any>;

  @Prop()
  created_by?: string;

  @Prop()
  created_by_name?: string;

  @Prop()
  change_notes?: string;
}

export const ChecklistVersionSchema = SchemaFactory.createForClass(ChecklistVersion);
ChecklistVersionSchema.index({ group_id: 1, version_code: 1 }, { unique: true, sparse: true });
ChecklistVersionSchema.index({ group_id: 1, status: 1 });
ChecklistVersionSchema.index({ checklist_id: 1, version: 1 }, { unique: true, sparse: true });
ChecklistVersionSchema.index({ checklist_id: 1, status: 1 });
