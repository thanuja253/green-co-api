import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoleManagementController } from './role-management.controller';
import { RoleManagementService } from './role-management.service';
import { RoleManagement, RoleManagementSchema } from '../schemas/role-management.schema';
import { Permission, PermissionSchema } from '../schemas/permission.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoleManagement.name, schema: RoleManagementSchema },
      { name: Permission.name, schema: PermissionSchema },
    ]),
  ],
  controllers: [RoleManagementController],
  providers: [RoleManagementService],
  exports: [RoleManagementService, MongooseModule],
})
export class RoleManagementModule {}
