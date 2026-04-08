import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyAuthModule } from './company/company-auth/company-auth.module';
import { CompanyProjectsModule } from './company/company-projects/company-projects.module';
import { NotificationsModule } from './company/notifications/notifications.module';
import { FacilitatorsModule } from './company/facilitators/facilitators.module';
import { RegistrationMastersModule } from './company/registration-masters/registration-masters.module';
import { MailModule } from './mail/mail.module';
import { HelpDeskModule } from './company/help-desk/help-desk.module';
import { RoleManagementModule } from './company/role-management/role-management.module';
import { StaffManagementModule } from './company/staff-management/staff-management.module';
import { LegacyDataModule } from './company/legacy-data/legacy-data.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/greenco',
        serverSelectionTimeoutMS: 10000, // 10 seconds
        socketTimeoutMS: 45000, // 45 seconds
        connectTimeoutMS: 10000, // 10 seconds
      }),
      inject: [ConfigService],
    }),
    CompanyAuthModule,
    CompanyProjectsModule,
    NotificationsModule,
    FacilitatorsModule,
    RegistrationMastersModule,
    MailModule,
    HelpDeskModule,
    RoleManagementModule,
    StaffManagementModule,
    LegacyDataModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

