import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MasterChecklistSectorDocument = MasterChecklistSector & Document;

@Schema({ timestamps: true, collection: 'master_checklist_sectors' })
export class MasterChecklistSector {
  // Legacy-compatible key name from Laravel table.
  @Prop({ required: true, index: true })
  criterian_id: string;

  // Optional sector-specific mapping. When present, criteria fetch should prefer this over group mapping.
  @Prop({ required: false, index: true })
  sector_id?: string;

  @Prop({ required: true, index: true })
  group_id: string;

  /** When set, parameter mapping applies only to this checklist version. */
  @Prop({ index: true })
  checklist_version_id?: string;

  @Prop()
  from_date?: Date;
}

export const MasterChecklistSectorSchema =
  SchemaFactory.createForClass(MasterChecklistSector);
// Non-unique: multiple rows per group when checklist_version_id differs.
MasterChecklistSectorSchema.index({ criterian_id: 1, group_id: 1 });
MasterChecklistSectorSchema.index(
  { criterian_id: 1, group_id: 1, checklist_version_id: 1 },
  {
    unique: true,
    partialFilterExpression: { checklist_version_id: { $type: 'string' } },
  },
);
