import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CompanyProjectDocument = CompanyProject & Document;

@Schema({ timestamps: true })
export class CompanyProject {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Company', required: true })
  company_id: MongooseSchema.Types.ObjectId;

  @Prop({ default: 'c' }) // 'c' = cii, 'f' = facilitator
  process_type: string;

  @Prop({ default: 1 })
  next_activities_id: number;

  // Certificate & feedback documents (optional)
  @Prop()
  certificate_document_url?: string;

  @Prop()
  certificate_document_filename?: string;

  @Prop()
  certificate_upload_date?: Date;

  @Prop()
  certificate_expiry_date?: Date;

  @Prop()
  sustenance_date?: Date;

  @Prop()
  sustenance_mail_sent?: number; // 0/1 - for reminder cron

  @Prop()
  feedback_document_url?: string;

  @Prop()
  feedback_document_filename?: string;

  @Prop()
  feedback_upload_date?: Date;

  // Score band metadata
  @Prop({ default: 0 }) // 0 = not available, 1 = available
  score_band_status: number;

  @Prop()
  percentage_score?: number;

  @Prop()
  total_score?: number;

  @Prop()
  max_points?: number;

  @Prop({ type: Array, default: [] })
  criteria_projectscore?: any[];

  @Prop({ type: Array, default: [] })
  high_projectscore?: any[];

  @Prop({ type: Array, default: [] })
  max_score?: any[];

  // Optional path to generated score band PDF
  @Prop()
  score_band_pdf_path?: string;

  @Prop()
  proposal_document?: string;

  @Prop({ default: 0 }) // 0 = Pending, 1 = Accepted, 2 = Rejected
  proposal_status?: number;

  @Prop()
  proposal_remarks?: string;

  @Prop()
  proposal_status_updated_at?: Date;

  @Prop()
  launch_training_document?: string;

  @Prop()
  launch_training_report_date?: Date;

  /** Up to 4 Launch & Training sessions (document + date each). Legacy single fields above remain for backward compatibility. */
  @Prop({
    type: [
      {
        session_index: { type: Number, required: true },
        document_path: { type: String, required: true },
        document_filename: { type: String },
        session_date: { type: Date },
        uploaded_at: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  launch_training_sessions?: Array<{
    session_index: number;
    document_path: string;
    document_filename?: string;
    session_date?: Date;
    uploaded_at?: Date;
  }>;

  @Prop()
  hand_holding_document?: string;

  @Prop()
  hand_holding_document2?: string;

  @Prop()
  hand_holding_document3?: string;

  @Prop({ default: 0 })
  profile_update?: number; // 0 or 1 - indicates if registration form is submitted

  /** Set when "All assessment submittals uploaded" notification has been sent (one per project) */
  @Prop({ default: false })
  assessment_submittals_complete_notified?: boolean;

  @Prop()
  project_id?: string; // Project code/identifier

  /** Admin-entered PO number after work order approval, before project code is assigned. */
  @Prop()
  work_order_po_number?: string;

  /** Admin-entered date of acceptance (not in the future); defaults from client WO upload in UI. */
  @Prop()
  work_order_po_acceptance_date?: Date;

  // Raw registration info from the big Registration Info form
  // (industry/entity/sector/state, addresses, SEZ, turnover, etc.)
  @Prop({ type: Object, default: {} })
  registration_info?: Record<string, any>;

  /** When this project was used as source for recertification, the new project id (so quickview can show "open new project" instead of step 24). */
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  recertification_project_id?: MongooseSchema.Types.ObjectId;
}

export const CompanyProjectSchema = SchemaFactory.createForClass(CompanyProject);
CompanyProjectSchema.index({ company_id: 1 });
CompanyProjectSchema.index({ _id: 1, company_id: 1 });
