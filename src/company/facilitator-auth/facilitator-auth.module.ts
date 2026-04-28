import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../../mail/mail.module';
import { CompanyFacilitator, CompanyFacilitatorSchema } from '../schemas/company-facilitator.schema';
import { Facilitator, FacilitatorSchema } from '../schemas/facilitator.schema';
import { FacilitatorAuthController } from './facilitator-auth.controller';
import { FacilitatorAuthService } from './facilitator-auth.service';
import { FacilitatorProfileController } from './facilitator-profile.controller';
import { FacilitatorProfileService } from './facilitator-profile.service';
import { FacilitatorAccountStatusGuard } from './guards/facilitator-account-status.guard';
import { FacilitatorJwtStrategy } from './strategies/facilitator-jwt.strategy';

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
      { name: Facilitator.name, schema: FacilitatorSchema },
      { name: CompanyFacilitator.name, schema: CompanyFacilitatorSchema },
    ]),
  ],
  controllers: [FacilitatorAuthController, FacilitatorProfileController],
  providers: [
    FacilitatorAuthService,
    FacilitatorProfileService,
    FacilitatorJwtStrategy,
    FacilitatorAccountStatusGuard,
  ],
  exports: [FacilitatorAuthService],
})
export class FacilitatorAuthModule {}
