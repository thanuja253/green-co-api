import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDashboardResourceDocument = CompanyDashboardResource & Document;

@Schema({ timestamps: true, collection: 'company_dashboard_resources' })
export class CompanyDashboardResource {
  /** 'user_guide_video' | 'faq' | 'user_manual' */
  @Prop({ required: true, index: true })
  resource_type: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  /** URL for video embed or download link for PDF */
  @Prop()
  url?: string;

  /** For FAQ items */
  @Prop()
  question?: string;

  @Prop()
  answer?: string;

  @Prop({ default: 0 })
  sort_order: number;

  @Prop({ default: 'active' })
  status: string;
}

export const CompanyDashboardResourceSchema = SchemaFactory.createForClass(CompanyDashboardResource);
CompanyDashboardResourceSchema.index({ resource_type: 1, status: 1, sort_order: 1 });
