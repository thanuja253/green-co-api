import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  NotificationLog,
  NotificationLogSchema,
} from '../schemas/notification-log.schema';
import { Company, CompanySchema } from '../schemas/company.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AdminNotificationsController } from './admin-notifications.controller';
import { FacilitatorNotificationsController } from './facilitator-notifications.controller';
import { AssessorNotificationsController } from './assessor-notifications.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationLog.name, schema: NotificationLogSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  controllers: [
    NotificationsController,
    AdminNotificationsController,
    FacilitatorNotificationsController,
    AssessorNotificationsController,
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
