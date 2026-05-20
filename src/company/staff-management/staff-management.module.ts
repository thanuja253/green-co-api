import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffManagementController } from './staff-management.controller';
import { StaffManagementService } from './staff-management.service';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { RoleManagement, RoleManagementSchema } from '../schemas/role-management.schema';
import { RoleManagementModule } from '../role-management/role-management.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Staff.name, schema: StaffSchema },
      { name: RoleManagement.name, schema: RoleManagementSchema },
    ]),
    RoleManagementModule,
    MailModule,
  ],
  controllers: [StaffManagementController],
  providers: [StaffManagementService],
})
export class StaffManagementModule {}
