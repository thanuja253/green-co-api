import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Admin, AdminDocument } from '../schemas/admin.schema';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminForgotPasswordDto } from './dto/admin-forgot-password.dto';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { AdminProfileDto } from './dto/admin-profile.dto';
import { passwordGeneration } from '../../helpers/password.helper';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private toProfile(admin: any) {
    return {
      id: admin._id.toString(),
      name: admin.name,
      first_name: admin.first_name || '',
      last_name: admin.last_name || '',
      email: admin.email,
      phone: admin.phone || '',
      organization: admin.organization || '',
      designation: admin.designation || '',
      address: admin.address || '',
      city: admin.city || '',
      state: admin.state || '',
      pincode: admin.pincode || '',
      status: admin.status,
      role: 'admin',
    };
  }

  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultAdmin();
  }

  private async ensureDefaultAdmin() {
    const email = (process.env.ADMIN_EMAIL || 'thanujamallakuntaa@gmail.com')
      .trim()
      .toLowerCase();
    const password = (process.env.ADMIN_PASSWORD || 'cii@1234').trim();
    const name = (process.env.ADMIN_NAME || 'Admin').trim();

    if (!email || !password) {
      return;
    }

    const existingAdmin = await this.adminModel.findOne({ email }).select('+password');
    if (existingAdmin) {
      // Keep account active and name updated, but do not override password.
      // This allows changed/reset passwords to continue working.
      existingAdmin.name = name;
      existingAdmin.status = '1';
      await existingAdmin.save();
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.adminModel.create({
      name,
      email,
      password: hashedPassword,
      status: '1',
    });
  }

  async login(loginDto: AdminLoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const password = loginDto.password.trim();
    const defaultEmail = (process.env.ADMIN_EMAIL || 'thanujamallakuntaa@gmail.com')
      .trim()
      .toLowerCase();

    if (email !== defaultEmail) {
      throw new UnauthorizedException({
        status: 'error',
        message:
          'Your credentials are not valid! Please enter a valid Email and Password.',
      });
    }

    const admin = await this.adminModel
      .findOne({ email: defaultEmail })
      .select('+password');
    if (!admin) {
      throw new UnauthorizedException({
        status: 'error',
        message:
          'Your credentials are not valid! Please enter a valid Email and Password.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        status: 'error',
        message:
          'Your credentials are not valid! Please enter a valid Email and Password.',
      });
    }

    if (admin.status !== '1') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account In-Active! Please Contact Greenco Team.',
      });
    }

    const payload = {
      sub: admin._id.toString(),
      email: admin.email,
      role: 'admin',
    };

    const token = this.jwtService.sign(payload);

    return {
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        access_token: token,
        user: {
          id: admin._id.toString(),
          name: admin.name,
          email: admin.email,
          status: admin.status,
          role: 'admin',
        },
      },
    };
  }

  async forgotPassword(forgotPasswordDto: AdminForgotPasswordDto) {
    const requestedEmail = forgotPasswordDto.email.trim().toLowerCase();
    const defaultEmail = (process.env.ADMIN_EMAIL || 'thanujamallakuntaa@gmail.com')
      .trim()
      .toLowerCase();

    if (requestedEmail !== defaultEmail) {
      throw new BadRequestException({
        status: 'error',
        message: 'Validation failed',
        errors: {
          email: ['Only thanujamallakuntaa@gmail.com is allowed for forgot password.'],
        },
      });
    }

    let admin = await this.adminModel.findOne({ email: defaultEmail }).select('+password');
    if (!admin) {
      const defaultPassword = (process.env.ADMIN_PASSWORD || 'cii@1234').trim();
      admin = await this.adminModel.create({
        name: process.env.ADMIN_NAME || 'Admin',
        email: defaultEmail,
        password: await bcrypt.hash(defaultPassword, 10),
        status: '1',
      });
    }

    if (admin.status !== '1') {
      admin.status = '1';
    }

    const newPassword = passwordGeneration(12);
    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    try {
      await this.mailService.sendAdminForgotPasswordEmail(defaultEmail, newPassword);
    } catch {
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to send email. Please try again later.',
      });
    }

    return {
      status: 'success',
      message: 'Password sent to your email!',
    };
  }

  async me(userId: string) {
    const admin = await this.adminModel.findById(userId);
    if (!admin) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    return {
      status: 'success',
      data: {
        ...this.toProfile(admin),
      },
    };
  }

  async upsertProfile(userId: string, dto: AdminProfileDto) {
    const admin = await this.adminModel.findById(userId);
    if (!admin) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const emailExists = await this.adminModel.findOne({
        _id: { $ne: userId },
        email,
      });
      if (emailExists) {
        throw new BadRequestException({
          status: 'validations',
          errors: { email: ['Email is already taken'] },
        });
      }
      admin.email = email;
    }

    const firstName = dto.first_name ?? dto.firstName;
    const lastName = dto.last_name ?? dto.lastName;
    const phone = dto.phone ?? dto.mobile ?? dto.mobile_number;
    const organization = dto.organization ?? dto.organisation;

    if (firstName !== undefined) admin.first_name = firstName.trim();
    if (lastName !== undefined) admin.last_name = lastName.trim();
    if (phone !== undefined) admin.phone = phone.trim();
    if (organization !== undefined) admin.organization = organization.trim();
    if (dto.designation !== undefined) admin.designation = dto.designation.trim();
    if (dto.address !== undefined) admin.address = dto.address.trim();
    if (dto.city !== undefined) admin.city = dto.city.trim();
    if (dto.state !== undefined) admin.state = dto.state.trim();
    if (dto.pincode !== undefined) admin.pincode = dto.pincode.trim();

    if (dto.name !== undefined) {
      const raw = dto.name.trim();
      if (raw) {
        const parts = raw.split(/\s+/);
        admin.first_name = parts.shift() || admin.first_name;
        admin.last_name = parts.join(' ') || admin.last_name;
        admin.name = raw;
      }
    }

    const fullName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim();
    if (fullName) admin.name = fullName;

    await admin.save();

    return {
      status: 'success',
      message: 'Profile updated successfully',
      data: this.toProfile(admin),
    };
  }

  async changePassword(
    userId: string,
    changePasswordDto: AdminChangePasswordDto,
  ) {
    const admin = await this.adminModel.findById(userId).select('+password');
    if (!admin) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.current_password,
      admin.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException({
        status: 'error',
        message:
          'Your current password does not matches with the password you provided. Please try again.',
      });
    }

    const isSamePassword = await bcrypt.compare(
      changePasswordDto.new_password,
      admin.password,
    );

    if (isSamePassword) {
      throw new BadRequestException({
        status: 'error',
        message:
          'New Password cannot be same as your current password. Please choose a different password.',
      });
    }

    admin.password = await bcrypt.hash(changePasswordDto.new_password, 10);
    await admin.save();

    this.mailService
      .sendPasswordUpdateEmail(admin.email, admin.name || 'Admin')
      .catch((error) => {
        console.error('Error sending admin password update email:', error);
      });

    return {
      status: 'success',
      message: 'Success! Your new Password has been updated successfully.',
    };
  }
}
