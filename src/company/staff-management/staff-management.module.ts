import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffManagementController } from './staff-management.controller';
import { StaffManagementService } from './staff-management.service';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { RoleManagement, RoleManagementSchema } from '../schemas/role-management.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Staff.name, schema: StaffSchema },
      { name: RoleManagement.name, schema: RoleManagementSchema },
    ]),
  ],
  controllers: [StaffManagementController],
  providers: [StaffManagementService],
})
export class StaffManagementModule {}

