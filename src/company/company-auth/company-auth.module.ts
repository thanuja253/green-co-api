import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyAuthController } from './company-auth.controller';
import { CompanyAuthService } from './company-auth.service';
import { Company, CompanySchema } from '../schemas/company.schema';
import {
  CompanyProject,
  CompanyProjectSchema,
} from '../schemas/company-project.schema';
import {
  CompanyFacilitator,
  CompanyFacilitatorSchema,
} from '../schemas/company-facilitator.schema';
import { Facilitator, FacilitatorSchema } from '../schemas/facilitator.schema';
import {
  CompanyActivity,
  CompanyActivitySchema,
} from '../schemas/company-activity.schema';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailModule } from '../../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RegistrationMastersModule } from '../registration-masters/registration-masters.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: CompanyProject.name, schema: CompanyProjectSchema },
      { name: CompanyFacilitator.name, schema: CompanyFacilitatorSchema },
      { name: Facilitator.name, schema: FacilitatorSchema },
      { name: CompanyActivity.name, schema: CompanyActivitySchema },
    ]),
    MailModule,
    NotificationsModule,
    RegistrationMastersModule,
  ],
  controllers: [CompanyAuthController],
  providers: [CompanyAuthService, JwtStrategy],
  exports: [CompanyAuthService],
})
export class CompanyAuthModule {}

