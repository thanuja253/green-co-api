import { Controller, Get, Patch, Param, Query, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { FacilitatorJwtAuthGuard } from '../facilitator-auth/guards/facilitator-jwt-auth.guard';
import { FacilitatorAccountStatusGuard } from '../facilitator-auth/guards/facilitator-account-status.guard';

@Controller('api/facilitator/notifications')
export class FacilitatorNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
  async list(
    @Request() req: { user?: { facilitatorId?: string } },
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const facilitatorId = String(req?.user?.facilitatorId || '');
    const result = await this.notificationsService.getForUser('F', facilitatorId, {
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
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
  async markAllSeen(@Request() req: { user?: { facilitatorId?: string } }) {
    const facilitatorId = String(req?.user?.facilitatorId || '');
    await this.notificationsService.markSeen('F', facilitatorId);
    return { status: 'success', message: 'All notifications marked as seen' };
  }

  @Patch(':notificationId/seen')
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
  async markOneSeen(
    @Request() req: { user?: { facilitatorId?: string } },
    @Param('notificationId') notificationId: string,
  ) {
    const facilitatorId = String(req?.user?.facilitatorId || '');
    await this.notificationsService.markSeen('F', facilitatorId, notificationId);
    return { status: 'success', message: 'Notification marked as seen' };
  }
}
