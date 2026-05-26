import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DashboardSnapshotDocument = DashboardSnapshot & Document;

@Schema({ timestamps: true, collection: 'dashboard_snapshots' })
export class DashboardSnapshot {
  @Prop({ required: true, index: true })
  year: number;

  @Prop({ required: true })
  freeze_date: Date;

  @Prop({ default: true })
  is_frozen: boolean;

  @Prop({ type: Object, default: {} })
  metrics: Record<string, any>;

  @Prop({ type: Object, default: {} })
  pipeline_data: Record<string, any>;

  @Prop({ type: Object, default: {} })
  certification_data: Record<string, any>;

  @Prop({ type: Array, default: [] })
  carryover_project_ids: string[];

  @Prop()
  frozen_by?: string;

  @Prop()
  frozen_by_name?: string;

  @Prop()
  notes?: string;
}

export const DashboardSnapshotSchema = SchemaFactory.createForClass(DashboardSnapshot);
DashboardSnapshotSchema.index({ year: 1 }, { unique: true });
