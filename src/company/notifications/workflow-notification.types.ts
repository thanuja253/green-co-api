import { Types } from 'mongoose';
import { NotifyType } from '../schemas/notification-log.schema';
import { WorkflowEventType, WorkflowResponsibility } from './workflow-milestone.constants';

export interface WorkflowNotificationMeta {
  project_id?: string;
  company_id?: string;
  company_name?: string;
  project_code?: string;
  activity?: string;
  responsibility?: WorkflowResponsibility | string;
  event_type?: WorkflowEventType | string;
  shortcut_url?: string;
}

export interface CreateWorkflowNotificationInput {
  title: string;
  message: string;
  notifyType: NotifyType;
  userId?: string | Types.ObjectId | null;
  category?: string;
  meta: WorkflowNotificationMeta;
}
