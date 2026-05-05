import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../../mail/mail.module';
import { Assessor, AssessorSchema } from '../schemas/assessor.schema';
import {
  CompanyAssessor,
  CompanyAssessorSchema,
} from '../schemas/company-assessor.schema';
import { Company, CompanySchema } from '../schemas/company.schema';
import { CompanyProject, CompanyProjectSchema } from '../schemas/company-project.schema';
import { AssessorAccountStatusGuard } from './guards/assessor-account-status.guard';
import { OptionalAssessorAccountStatusGuard } from './guards/optional-assessor-account-status.guard';
import { AssessorJwtStrategy } from './strategies/assessor-jwt.strategy';
import { AssessorAuthController } from './assessor-auth.controller';
import { AssessorAuthService } from './assessor-auth.service';
import { AssessorProfileController } from './assessor-profile.controller';
import { AssessorProfileService } from './assessor-profile.service';

@Module({
  imports: [
    PassportModule,
    MailModule,
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
      { name: Assessor.name, schema: AssessorSchema },
      { name: CompanyAssessor.name, schema: CompanyAssessorSchema },
      { name: Company.name, schema: CompanySchema },
      { name: CompanyProject.name, schema: CompanyProjectSchema },
    ]),
  ],
  controllers: [AssessorAuthController, AssessorProfileController],
  providers: [
    AssessorAuthService,
    AssessorProfileService,
    AssessorJwtStrategy,
    AssessorAccountStatusGuard,
    OptionalAssessorAccountStatusGuard,
  ],
  exports: [AssessorAuthService],
})
export class AssessorAuthModule {}
