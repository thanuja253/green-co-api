import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CompanyWorkOrderDocument = CompanyWorkOrder & Document;

@Schema({ timestamps: true })
export class CompanyWorkOrder {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Company', required: true })
  company_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CompanyProject', required: true })
  project_id: MongooseSchema.Types.ObjectId;

  @Prop()
  wo_doc?: string;

  @Prop({ default: 0 }) // 1 = Accepted, 2 = Not Accepted, 0 = Pending (legacy CII review of company upload)
  wo_status?: number;

  /** Who uploaded the current PDF: `company` (standard) or `cii` (deprecated). */
  @Prop({ default: 'company' })
  wo_uploaded_by?: string;

  /** Company accept/reject on CII-uploaded work order: 0 = pending, 1 = accepted, 2 = rejected. */
  @Prop()
  wo_company_review_status?: number;

  @Prop()
  wo_company_review_remarks?: string;

  @Prop()
  wo_company_review_updated_at?: Date;

  @Prop()
  wo_remarks?: string;

  @Prop()
  wo_doc_status_updated_at?: Date;

  @Prop()
  wo_po_number?: string;

  @Prop()
  wo_acceptance_date?: Date;

  // ── New Work Order Flow fields ──

  /** Work Order Number submitted by the client (mandatory, unique per company). */
  @Prop()
  wo_number?: string;

  /** Work Order Date submitted by the client (must not be future). */
  @Prop()
  wo_date?: Date;

  /** Auto-generated reference number on approval: GBC/YYYY/Serial (e.g. GBC/2025/0012). */
  @Prop({ unique: true, sparse: true })
  reference_number?: string;

  /** Company name snapshot at time of work order (editable by admin). */
  @Prop()
  company_name?: string;

  /** Total service fee entered by GreenCo admin during approval (numeric, non-negative). */
  @Prop({ default: 0 })
  total_fee?: number;

  /** Registration fee entered by GreenCo admin during approval (numeric, non-negative). */
  @Prop({ default: 0 })
  registration_fee?: number;

  /** Workflow status: pending_approval | approved | rejected */
  @Prop({ default: 'pending_approval' })
  approval_status?: string;

  /** Admin user who approved/rejected. */
  @Prop()
  approved_by?: string;

  /** Admin user display name. */
  @Prop()
  approved_by_name?: string;

  @Prop()
  approved_at?: Date;

  @Prop()
  rejection_reason?: string;
}

export const CompanyWorkOrderSchema = SchemaFactory.createForClass(CompanyWorkOrder);
CompanyWorkOrderSchema.index({ company_id: 1, project_id: 1 });
CompanyWorkOrderSchema.index({ company_id: 1, project_id: 1, createdAt: -1 });
CompanyWorkOrderSchema.index({ approval_status: 1 });
CompanyWorkOrderSchema.index({ reference_number: 1 });

