import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FacilitatorsController } from './facilitators.controller';
import { FacilitatorsService } from './facilitators.service';
import { Facilitator, FacilitatorSchema } from '../schemas/facilitator.schema';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [
    MailModule,
    MongooseModule.forFeature([
      { name: Facilitator.name, schema: FacilitatorSchema },
    ]),
  ],
  controllers: [FacilitatorsController],
  providers: [FacilitatorsService],
})
export class FacilitatorsModule {}



