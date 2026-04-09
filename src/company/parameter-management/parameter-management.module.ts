import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParameterManagementController } from './parameter-management.controller';
import { ParameterManagementService } from './parameter-management.service';
import { ParameterManagement, ParameterManagementSchema } from '../schemas/parameter-management.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: ParameterManagement.name, schema: ParameterManagementSchema }])],
  controllers: [ParameterManagementController],
  providers: [ParameterManagementService],
})
export class ParameterManagementModule {}

