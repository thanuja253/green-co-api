import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailTemplateDocument = EmailTemplate & Document;

@Schema({ timestamps: true, collection: 'email_templates' })
export class EmailTemplate {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  subject_template: string;

  @Prop({ required: true })
  body_template: string;

  /** e.g. 'rating_notification', 'general', 'certificate_dispatch' */
  @Prop({ required: true, index: true })
  template_type: string;

  @Prop({ type: [String], default: [] })
  available_placeholders: string[];

  @Prop({ default: 'active' })
  status: string;

  @Prop()
  created_by?: string;

  @Prop()
  updated_by?: string;
}

export const EmailTemplateSchema = SchemaFactory.createForClass(EmailTemplate);
EmailTemplateSchema.index({ template_type: 1, status: 1 });
