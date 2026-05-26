import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CoordinatorChecklistVerificationDocument = CoordinatorChecklistVerification & Document;

@Schema({ timestamps: true, collection: 'coordinator_checklist_verifications' })
export class CoordinatorChecklistVerification {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CompanyProject', required: true })
  project_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  coordinator_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Company', required: true })
  company_id: MongooseSchema.Types.ObjectId;

  @Prop({ default: false })
  is_verified: boolean;

  @Prop()
  verified_at?: Date;

  @Prop()
  remarks?: string;
}

export const CoordinatorChecklistVerificationSchema = SchemaFactory.createForClass(
  CoordinatorChecklistVerification,
);
CoordinatorChecklistVerificationSchema.index(
  { project_id: 1, coordinator_id: 1 },
  { unique: true },
);
