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
  wo_remarks?: string; // Remarks/reason if work order is rejected

  @Prop()
  wo_doc_status_updated_at?: Date;

  /** Purchase order number (admin, after work order accepted). */
  @Prop()
  wo_po_number?: string;

  /** Date of acceptance as entered by admin (not future; default suggested = status update time). */
  @Prop()
  wo_acceptance_date?: Date;
}

export const CompanyWorkOrderSchema = SchemaFactory.createForClass(CompanyWorkOrder);
CompanyWorkOrderSchema.index({ company_id: 1, project_id: 1 });
CompanyWorkOrderSchema.index({ company_id: 1, project_id: 1, createdAt: -1 });

