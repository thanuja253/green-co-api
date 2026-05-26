import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NotificationLog,
  NotificationLogDocument,
  NotifyType,
} from '../schemas/notification-log.schema';
import {
  CreateWorkflowNotificationInput,
  WorkflowNotificationMeta,
} from './workflow-notification.types';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(NotificationLog.name)
    private readonly notificationModel: Model<NotificationLogDocument>,
  ) {}

  /**
   * Create an in-app notification (matches Laravel __notification_log).
   * Pass meta for workflow rows (company_name, project_id, activity, etc.).
   */
  async create(
    title: string,
    content: string,
    notifyType: NotifyType,
    userId?: string | Types.ObjectId | null,
    category?: string,
    meta?: WorkflowNotificationMeta,
  ): Promise<NotificationLogDocument> {
    return this.notificationModel.create(this.buildDocFields(title, content, notifyType, userId, category, meta));
  }

  async createWorkflow(input: CreateWorkflowNotificationInput): Promise<NotificationLogDocument> {
    return this.create(
      input.title,
      input.message,
      input.notifyType,
      input.userId,
      input.category ?? 'update',
      input.meta,
    );
  }

  /**
   * Laravel-style: Company {name}: {activity}
   */
  async logWorkflowStep(
    notifyType: NotifyType,
    meta: WorkflowNotificationMeta & { company_name: string; activity: string },
    eventType: string,
    userId?: string | Types.ObjectId | null,
  ): Promise<NotificationLogDocument> {
    const companyName = meta.company_name.trim() || 'Company';
    const activity = meta.activity.trim();
    const title =
      eventType === 'step_completed' || eventType === 'rejected'
        ? `${companyName}: ${activity}`
        : activity;
    const message = `${companyName}: ${activity}`;
    return this.createWorkflow({
      title,
      message,
      notifyType,
      userId,
      category: 'update',
      meta: { ...meta, event_type: eventType },
    });
  }

  /**
   * Notify admin + company (+ optional facilitator) for one workflow event.
   */
  async logWorkflowStepForProject(
    meta: WorkflowNotificationMeta & {
      company_name: string;
      company_id: string;
      project_id: string;
      activity: string;
      responsibility?: string;
    },
    eventType: string,
    options?: {
      company?: boolean;
      admin?: boolean;
      facilitatorId?: string | null;
      coordinatorId?: string | null;
      assessorIds?: string[];
    },
  ): Promise<void> {
    const opts = {
      company: true,
      admin: true,
      ...options,
    };
    const tasks: Promise<unknown>[] = [];
    if (opts.admin) {
      tasks.push(
        this.logWorkflowStep('A', meta, eventType, null).catch((e) =>
          console.error('[Workflow notification] Admin failed:', e?.message || e),
        ),
      );
    }
    if (opts.company && meta.company_id) {
      tasks.push(
        this.logWorkflowStep('C', meta, eventType, meta.company_id).catch((e) =>
          console.error('[Workflow notification] Company failed:', e?.message || e),
        ),
      );
    }
    if (opts.facilitatorId) {
      tasks.push(
        this.logWorkflowStep('F', meta, eventType, opts.facilitatorId).catch((e) =>
          console.error('[Workflow notification] Facilitator failed:', e?.message || e),
        ),
      );
    }
    if (opts.coordinatorId) {
      tasks.push(
        this.logWorkflowStep('CO', meta, eventType, opts.coordinatorId).catch((e) =>
          console.error('[Workflow notification] Coordinator failed:', e?.message || e),
        ),
      );
    }
    for (const aid of opts.assessorIds || []) {
      if (!aid) continue;
      tasks.push(
        this.logWorkflowStep('AS', meta, eventType, aid).catch((e) =>
          console.error('[Workflow notification] Assessor failed:', e?.message || e),
        ),
      );
    }
    await Promise.all(tasks);
  }

  async getForUser(
    notifyType: NotifyType,
    userId: string,
    options?: { limit?: number; skip?: number },
  ): Promise<{ notifications: any[]; notificationsCount: number }> {
    const limit = options?.limit ?? 50;
    const skip = options?.skip ?? 0;
    const uid = new Types.ObjectId(userId);
    const filter = { notify_type: notifyType, user_id: uid };

    const [notifications, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments({
        ...filter,
        seen: false,
      }),
    ]);

    return {
      notifications: this.mapNotifications(notifications),
      notificationsCount: unreadCount,
    };
  }

  async getForType(
    notifyType: NotifyType,
    options?: { limit?: number; skip?: number },
  ): Promise<{ notifications: any[]; notificationsCount: number }> {
    const limit = options?.limit ?? 50;
    const skip = options?.skip ?? 0;
    const filter = { notify_type: notifyType };

    const [notifications, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments({
        ...filter,
        seen: false,
      }),
    ]);

    return {
      notifications: this.mapNotifications(notifications),
      notificationsCount: unreadCount,
    };
  }

  async markSeen(
    notifyType: NotifyType,
    userId: string,
    notificationId?: string,
  ): Promise<void> {
    const filter: any = { notify_type: notifyType, user_id: new Types.ObjectId(userId) };
    if (notificationId) {
      filter._id = new Types.ObjectId(notificationId);
    }
    await this.notificationModel.updateMany(filter, { $set: { seen: true } });
  }

  async markSeenByType(
    notifyType: NotifyType,
    notificationId?: string,
  ): Promise<void> {
    const filter: any = { notify_type: notifyType };
    if (notificationId) {
      filter._id = new Types.ObjectId(notificationId);
    }
    await this.notificationModel.updateMany(filter, { $set: { seen: true } });
  }

  private buildDocFields(
    title: string,
    content: string,
    notifyType: NotifyType,
    userId?: string | Types.ObjectId | null,
    category?: string,
    meta?: WorkflowNotificationMeta,
  ) {
    return {
      title,
      content: content ?? '',
      notify_type: notifyType,
      user_id:
        userId == null
          ? undefined
          : typeof userId === 'string'
            ? new Types.ObjectId(userId)
            : userId,
      seen: false,
      ...(category != null && { category }),
      ...(meta?.project_id && {
        project_id: new Types.ObjectId(meta.project_id),
      }),
      ...(meta?.company_id && {
        company_id: new Types.ObjectId(meta.company_id),
      }),
      ...(meta?.company_name != null && { company_name: meta.company_name }),
      ...(meta?.project_code != null && { project_code: meta.project_code }),
      ...(meta?.activity != null && { activity: meta.activity }),
      ...(meta?.responsibility != null && { responsibility: meta.responsibility }),
      ...(meta?.event_type != null && { event_type: meta.event_type }),
      ...(meta?.shortcut_url != null && { shortcut_url: meta.shortcut_url }),
    };
  }

  private mapNotifications(notifications: any[]): any[] {
    return notifications.map((n: any) => {
      const seen = !!n.seen;
      const content = n.content ?? '';
      return {
        id: n._id.toString(),
        title: n.title,
        message: content,
        ...(content !== '' && { content }),
        seen,
        is_seen: seen,
        created_at:
          n.createdAt instanceof Date
            ? n.createdAt.toISOString()
            : typeof n.createdAt === 'string'
              ? n.createdAt
              : n.createdAt,
        ...(n.project_id != null && { project_id: String(n.project_id) }),
        ...(n.company_id != null && { company_id: String(n.company_id) }),
        ...(n.company_name != null && { company_name: n.company_name }),
        ...(n.project_code != null && { project_code: n.project_code }),
        ...(n.activity != null && { activity: n.activity }),
        ...(n.responsibility != null && { responsibility: n.responsibility }),
        ...(n.event_type != null && { event_type: n.event_type }),
        ...(n.category != null && { display_category: n.category }),
        ...(n.shortcut_url != null && { shortcut_url: n.shortcut_url }),
      };
    });
  }
}
