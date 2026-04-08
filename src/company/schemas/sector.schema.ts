import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SectorDocument = Sector & Document;

@Schema({ timestamps: true })
export class Sector {
  @Prop({ required: true })
  name: string;

  @Prop()
  group_name?: string;

  @Prop({ default: '1' })
  status?: string;
}

export const SectorSchema = SchemaFactory.createForClass(Sector);



