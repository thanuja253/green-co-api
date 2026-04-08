import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoleManagementController } from './role-management.controller';
import { RoleManagementService } from './role-management.service';
import { RoleManagement, RoleManagementSchema } from '../schemas/role-management.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoleManagement.name, schema: RoleManagementSchema },
    ]),
  ],
  controllers: [RoleManagementController],
  providers: [RoleManagementService],
})
export class RoleManagementModule {}

