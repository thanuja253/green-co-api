import { Controller, Get, Patch, Param, Query, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AssessorJwtAuthGuard } from '../assessor-auth/guards/assessor-jwt-auth.guard';
import { AssessorAccountStatusGuard } from '../assessor-auth/guards/assessor-account-status.guard';

@Controller(['api/assessor/notifications', 'api/assessors/notifications'])
export class AssessorNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  async list(
    @Request() req: { user?: { assessorId?: string } },
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const assessorId = String(req?.user?.assessorId || '');
    const result = await this.notificationsService.getForUser('AS', assessorId, {
      skip: skip == null ? 0 : Number.parseInt(skip, 10),
      limit: limit == null ? 50 : Number.parseInt(limit, 10),
    });

    return {
      status: 'success',
      message: 'Notifications loaded',
      data: result,
    };
  }

  @Patch('seen')
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  async markAllSeen(@Request() req: { user?: { assessorId?: string } }) {
    const assessorId = String(req?.user?.assessorId || '');
    await this.notificationsService.markSeen('AS', assessorId);
    return { status: 'success', message: 'All notifications marked as seen' };
  }

  @Patch(':notificationId/seen')
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  async markOneSeen(
    @Request() req: { user?: { assessorId?: string } },
    @Param('notificationId') notificationId: string,
  ) {
    const assessorId = String(req?.user?.assessorId || '');
    await this.notificationsService.markSeen('AS', assessorId, notificationId);
    return { status: 'success', message: 'Notification marked as seen' };
  }
}
