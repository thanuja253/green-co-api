import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MasterChecklistSectorDocument = MasterChecklistSector & Document;

@Schema({ timestamps: true, collection: 'master_checklist_sectors' })
export class MasterChecklistSector {
  // Legacy-compatible key name from Laravel table.
  @Prop({ required: true, index: true })
  criterian_id: string;

  @Prop({ required: true, index: true })
  group_id: string;

  @Prop()
  from_date?: Date;
}

export const MasterChecklistSectorSchema =
  SchemaFactory.createForClass(MasterChecklistSector);
MasterChecklistSectorSchema.index({ criterian_id: 1, group_id: 1 }, { unique: true });
