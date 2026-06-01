import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyAuthModule } from './company/company-auth/company-auth.module';
import { AssessorAuthModule } from './company/assessor-auth/assessor-auth.module';
import { FacilitatorAuthModule } from './company/facilitator-auth/facilitator-auth.module';
import { CompanyProjectsModule } from './company/company-projects/company-projects.module';
import { NotificationsModule } from './company/notifications/notifications.module';
import { FacilitatorsModule } from './company/facilitators/facilitators.module';
import { RegistrationMastersModule } from './company/registration-masters/registration-masters.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { HelpDeskModule } from './company/help-desk/help-desk.module';
import { RoleManagementModule } from './company/role-management/role-management.module';
import { StaffManagementModule } from './company/staff-management/staff-management.module';
import { LegacyDataModule } from './company/legacy-data/legacy-data.module';
import { GroupManagementModule } from './company/group-management/group-management.module';
import { SectorManagementModule } from './company/sector-management/sector-management.module';
import { ParameterManagementModule } from './company/parameter-management/parameter-management.module';
import { CreditManagementModule } from './company/credit-management/credit-management.module';
import { AssessmentChecklistDocumentsModule } from './company/assessment-checklist-documents/assessment-checklist-documents.module';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';

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
    AssessorAuthModule,
    FacilitatorAuthModule,
    ScheduleModule.forRoot(),
    CompanyProjectsModule,
    NotificationsModule,
    FacilitatorsModule,
    RegistrationMastersModule,
    MailModule,
    StorageModule,
    HelpDeskModule,
    RoleManagementModule,
    StaffManagementModule,
    LegacyDataModule,
    GroupManagementModule,
    SectorManagementModule,
    ParameterManagementModule,
    CreditManagementModule,
    AssessmentChecklistDocumentsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

