import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AssessmentChecklistDocumentDocument = AssessmentChecklistDocument & Document;

export type AssessmentChecklistStatus = 'Pending' | 'Approved' | 'Rejected';

@Schema({ timestamps: true, collection: 'assessment_checklist_documents' })
export class AssessmentChecklistDocument {
  @Prop({ required: true, index: true })
  project_id: string;

  @Prop({ required: true, index: true })
  sector_id: string;

  @Prop({ required: true, index: true })
  group_id: string;

  @Prop({ required: true })
  group_name: string;

  @Prop({ required: true })
  sector_name: string;

  // Criteria/parameter id from ParameterManagement (criteria master)
  @Prop({ required: true, index: true })
  criteria_id: string;

  @Prop({ required: true })
  criteria_name: string;

  @Prop()
  criteria_short_name?: string;

  @Prop({ required: true })
  title: string;

  // Stored relative path under /uploads (served by main.ts static)
  @Prop({ required: true })
  document_path: string;

  @Prop({ default: 'Pending', index: true })
  status: AssessmentChecklistStatus;

  @Prop()
  remarks?: string;

  @Prop({ default: true, index: true })
  is_active: boolean;

  @Prop({ default: 'COMPANY' })
  uploaded_by_role: 'COMPANY' | 'ADMIN';

  @Prop()
  reviewed_by?: string;

  @Prop()
  reviewed_at?: Date;
}

export const AssessmentChecklistDocumentSchema = SchemaFactory.createForClass(
  AssessmentChecklistDocument,
);
AssessmentChecklistDocumentSchema.index(
  { project_id: 1, criteria_id: 1, title: 1, is_active: 1 },
  { name: 'assessment_checklist_doc_lookup' },
);

