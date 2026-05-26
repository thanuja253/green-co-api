import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

/** Module codes: A = Admin, C = Company, F = Facilitator, CO = Coordinator, AS = Assessor */
export type NotifyType = 'A' | 'C' | 'F' | 'CO' | 'AS';

/** Display category for frontend Type column / icon: ticket, message, team, update, etc. */
export type NotificationCategory = 'ticket' | 'message' | 'team' | 'update' | string;

export type NotificationLogDocument = NotificationLog & Document;

@Schema({ timestamps: true, collection: 'notifications' })
export class NotificationLog {
  @Prop({ required: true })
  title: string;

  @Prop({ required: false })
  content?: string;

  @Prop({ required: true })
  notify_type: NotifyType;

  /** Optional display category for frontend (e.g. ticket, message, team, update). Returned as notify_type in API. */
  @Prop({ required: false })
  category?: NotificationCategory;

  /** Optional for Admin (A) when broadcast; otherwise user_id of Company/Facilitator/Coordinator/Assessor */
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  user_id?: MongooseSchema.Types.ObjectId;

  @Prop({ default: false })
  seen: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  project_id?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  company_id?: MongooseSchema.Types.ObjectId;

  @Prop({ required: false })
  company_name?: string;

  @Prop({ required: false })
  project_code?: string;

  /** Same label as Quick View latest/next step activity. */
  @Prop({ required: false })
  activity?: string;

  @Prop({ required: false })
  responsibility?: string;

  @Prop({ required: false })
  event_type?: string;

  /** Shortcut URL for admins to navigate directly to the referenced page/task. */
  @Prop({ required: false })
  shortcut_url?: string;
}

export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);
NotificationLogSchema.index({ notify_type: 1, user_id: 1 });
NotificationLogSchema.index({ user_id: 1, seen: 1, createdAt: -1 });
NotificationLogSchema.index({ notify_type: 1, project_id: 1, createdAt: -1 });
NotificationLogSchema.index({ company_id: 1, createdAt: -1 });
