import { Controller, Get, Patch, Query, Request, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../company-auth/guards/jwt-auth.guard';
import { AccountStatusGuard } from '../company-auth/guards/account-status.guard';
import { NotificationsService } from './notifications.service';

@Controller('api/company/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /api/company/notifications?skip=0&limit=50
   * List in-app notifications for the logged-in company.
   * Response: data.notifications[], data.notificationsCount (unread).
   */
  @Get()
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async list(
    @Request() req,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.notificationsService.getForUser('C', req.user.userId, {
      skip: skip != null ? parseInt(skip, 10) : 0,
      limit: limit != null ? parseInt(limit, 10) : 50,
    });
    return {
      status: 'success',
      message: 'Notifications loaded',
      data: result,
    };
  }

  @Patch('seen')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async markAllSeen(@Request() req) {
    await this.notificationsService.markSeen('C', req.user.userId);
    return { status: 'success', message: 'All notifications marked as seen' };
  }

  /** PATCH /api/company/notifications/:notificationId/seen – mark one as seen */
  @Patch(':notificationId/seen')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async markOneSeen(@Request() req, @Param('notificationId') notificationId: string) {
    await this.notificationsService.markSeen('C', req.user.userId, notificationId);
    return { status: 'success', message: 'Notification marked as seen' };
  }
}
