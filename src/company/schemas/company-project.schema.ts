import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CompanyProjectDocument = CompanyProject & Document;

/** Up to 4 informational Launch & Training sessions (admin uploads; no approval flow). */
const LaunchTrainingSessionSubSchema = new MongooseSchema(
  {
    relative_path: { type: String, required: true },
    original_filename: { type: String },
    session_date: { type: Date },
    uploaded_at: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

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

  @Prop({ default: '' })
  coordinator_remarks?: string;

  @Prop({ type: [Date], default: [] })
  coordinator_target_dates?: Date[];

  @Prop({ default: false })
  coordinator_target_dates_locked?: boolean;

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

  /** 0 = pending company review, 1 = accepted, 2 = rejected (CII must re-upload). */
  @Prop()
  proposal_review_status?: number;

  @Prop()
  proposal_review_remarks?: string;

  @Prop()
  proposal_review_updated_at?: Date;

  @Prop()
  launch_training_document?: string;

  @Prop()
  launch_training_report_date?: Date;

  @Prop({ type: [LaunchTrainingSessionSubSchema], default: [] })
  launch_training_sessions?: Array<{
    relative_path: string;
    original_filename?: string;
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

  // Raw registration info from the big Registration Info form
  // (industry/entity/sector/state, addresses, SEZ, turnover, etc.)
  @Prop({ type: Object, default: {} })
  registration_info?: Record<string, any>;

  /** When this project was used as source for recertification, the new project id (so quickview can show "open new project" instead of step 24). */
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  recertification_project_id?: MongooseSchema.Types.ObjectId;

  /** Checklist version used for this project's assessment (links to ChecklistVersion). */
  @Prop()
  checklist_version_id?: string;

  @Prop()
  checklist_version_number?: number;

  /** Whether coordinator has verified the project checklist. */
  @Prop({ default: false })
  coordinator_checklist_verified?: boolean;

  @Prop()
  coordinator_checklist_verified_at?: Date;

  @Prop()
  coordinator_checklist_verified_by?: string;

  /** Auto-generated plaque PDF path. */
  @Prop()
  plaque_pdf_path?: string;

  /** Auto-generated certificate PDF path. */
  @Prop()
  certificate_pdf_path?: string;

  /** Rating label from the scoring/proforma (e.g. 'Gold', 'Platinum'). */
  @Prop()
  rating_label?: string;

  /** Whether auto-generated cert/plaque documents have been created. */
  @Prop({ default: false })
  cert_plaque_generated?: boolean;

  @Prop()
  cert_plaque_generated_at?: Date;

  /** Plaque dispatch details captured from Add Plaque form. */
  @Prop({
    type: {
      contact_person: { type: String, default: '' },
      designation: { type: String, default: '' },
      mobile: { type: String, default: '' },
      company_name: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    default: null,
  })
  plaque_details?: {
    contact_person: string;
    designation: string;
    mobile: string;
    company_name: string;
    address: string;
  } | null;

  /** Outstanding details captured from Finance > Outstanding form. */
  @Prop({
    type: {
      outstanding_id: { type: String, default: null },
      outstanding_amount: { type: Number, default: 0 },
      date: { type: Date, default: null },
      remarks: { type: String, default: '' },
      status: { type: String, default: 'Unpaid' },
      outstanding_amt_paid: { type: Number, default: 0 },
      due_outstanding_amt: { type: Number, default: 0 },
      paid_date: { type: Date, default: null },
      paid_remark: { type: String, default: '' },
      payment_history: {
        type: [
          {
            payment_amount: { type: Number, default: 0 },
            paid_date: { type: Date, default: null },
            paid_remark: { type: String, default: '' },
            paid_total_after: { type: Number, default: 0 },
            due_amount_after: { type: Number, default: 0 },
            status_after: { type: String, default: 'Unpaid' },
            source: { type: String, default: 'due_payment' }, // due_payment | initial_paid | legacy_backfill | manual_update
            created_at: { type: Date, default: () => new Date() },
          },
        ],
        default: [],
      },
    },
    default: null,
  })
  outstanding_details?: {
    outstanding_id?: string | null;
    outstanding_amount: number;
    date: Date | null;
    remarks: string;
    status: 'Unpaid' | 'Partial' | 'Paid';
    outstanding_amt_paid?: number;
    due_outstanding_amt?: number;
    paid_date?: Date | null;
    paid_remark?: string;
    payment_history?: Array<{
      payment_amount: number;
      paid_date: Date | null;
      paid_remark: string;
      paid_total_after: number;
      due_amount_after: number;
      status_after: 'Unpaid' | 'Partial' | 'Paid';
      source: 'due_payment' | 'initial_paid' | 'legacy_backfill' | 'manual_update';
      created_at: Date;
    }>;
  } | null;

  /** Multiple outstanding invoices (new), each with independent payment history. */
  @Prop({
    type: [
      {
        outstanding_id: { type: String, required: true },
        outstanding_amount: { type: Number, default: 0 },
        date: { type: Date, default: null },
        remarks: { type: String, default: '' },
        status: { type: String, default: 'Unpaid' },
        outstanding_amt_paid: { type: Number, default: 0 },
        due_outstanding_amt: { type: Number, default: 0 },
        paid_date: { type: Date, default: null },
        paid_remark: { type: String, default: '' },
        payment_history: {
          type: [
            {
              payment_amount: { type: Number, default: 0 },
              paid_date: { type: Date, default: null },
              paid_remark: { type: String, default: '' },
              paid_total_after: { type: Number, default: 0 },
              due_amount_after: { type: Number, default: 0 },
              status_after: { type: String, default: 'Unpaid' },
              source: { type: String, default: 'due_payment' },
              created_at: { type: Date, default: () => new Date() },
            },
          ],
          default: [],
        },
      },
    ],
    default: [],
  })
  outstanding_details_list?: Array<{
    outstanding_id: string;
    outstanding_amount: number;
    date: Date | null;
    remarks: string;
    status: 'Unpaid' | 'Partial' | 'Paid';
    outstanding_amt_paid?: number;
    due_outstanding_amt?: number;
    paid_date?: Date | null;
    paid_remark?: string;
    payment_history?: Array<{
      payment_amount: number;
      paid_date: Date | null;
      paid_remark: string;
      paid_total_after: number;
      due_amount_after: number;
      status_after: 'Unpaid' | 'Partial' | 'Paid';
      source: 'due_payment' | 'initial_paid' | 'legacy_backfill' | 'manual_update';
      created_at: Date;
    }>;
  }>;
}

export const CompanyProjectSchema = SchemaFactory.createForClass(CompanyProject);
CompanyProjectSchema.index({ company_id: 1 });
CompanyProjectSchema.index({ _id: 1, company_id: 1 });
