import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CreditManagementController } from './credit-management.controller';
import { CreditManagementService } from './credit-management.service';
import { CreditManagement, CreditManagementSchema } from '../schemas/credit-management.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: CreditManagement.name, schema: CreditManagementSchema }])],
  controllers: [CreditManagementController],
  providers: [CreditManagementService],
})
export class CreditManagementModule {}

