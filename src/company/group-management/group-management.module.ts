import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupManagementController } from './group-management.controller';
import { GroupManagementService } from './group-management.service';
import { GroupManagement, GroupManagementSchema } from '../schemas/group-management.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: GroupManagement.name, schema: GroupManagementSchema }])],
  controllers: [GroupManagementController],
  providers: [GroupManagementService],
})
export class GroupManagementModule {}

