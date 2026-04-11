import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('api/admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /api/admin/notifications?skip=0&limit=50
   * List admin notifications with unread badge count.
   */
  @Get()
  @UseGuards(AdminJwtAuthGuard)
  async list(
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.notificationsService.getForType('A', {
      skip: skip != null ? parseInt(skip, 10) : 0,
      limit: limit != null ? parseInt(limit, 10) : 50,
    });
    return {
      status: 'success',
      message: 'Notifications loaded',
      data: result,
    };
  }

  /** PATCH /api/admin/notifications/seen – mark all as seen */
  @Patch('seen')
  @UseGuards(AdminJwtAuthGuard)
  async markAllSeen() {
    await this.notificationsService.markSeenByType('A');
    return { status: 'success', message: 'All notifications marked as seen' };
  }

  /** PATCH /api/admin/notifications/:notificationId/seen – mark one as seen */
  @Patch(':notificationId/seen')
  @UseGuards(AdminJwtAuthGuard)
  async markOneSeen(@Param('notificationId') notificationId: string) {
    await this.notificationsService.markSeenByType('A', notificationId);
    return { status: 'success', message: 'Notification marked as seen' };
  }
}
