import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { passwordGeneration } from '../../helpers/password.helper';
import { MailService } from '../../mail/mail.service';
import { ChangePasswordDto } from '../company-auth/dto/change-password.dto';
import { ForgotPasswordDto } from '../company-auth/dto/forgot-password.dto';
import { CompanyFacilitator, CompanyFacilitatorDocument } from '../schemas/company-facilitator.schema';
import { Facilitator, FacilitatorDocument } from '../schemas/facilitator.schema';
import { FacilitatorLoginDto } from './dto/facilitator-login.dto';

@Injectable()
export class FacilitatorAuthService {
  constructor(
    @InjectModel(Facilitator.name) private facilitatorModel: Model<FacilitatorDocument>,
    @InjectModel(CompanyFacilitator.name)
    private companyFacilitatorModel: Model<CompanyFacilitatorDocument>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async login(loginDto: FacilitatorLoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const password = loginDto.password.trim();

    const facilitator = await this.facilitatorModel.findOne({ email }).select('+password');

    if (!facilitator) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'No Account Found! Please enter a valid Email.',
      });
    }

    if (!facilitator.password) {
      throw new BadRequestException({
        status: 'error',
        message:
          'No password is set for this account. Ask an administrator to enable credentials or reset access.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, facilitator.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        status: 'error',
        message:
          'Your credentials are not valid! Please enter a valid Email and Password.',
      });
    }

    if (String(facilitator.status || '') !== '1') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account In-Active! Please Contact Greenco Team.',
      });
    }

    const payload = {
      sub: facilitator._id.toString(),
      email: facilitator.email,
      role: 'FACILITATOR',
    };

    const token = this.jwtService.sign(payload);
    const assignments = await this.companyFacilitatorModel
      .find({ facilitator_id: facilitator._id })
      .select('project_id company_id')
      .lean();

    return {
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: facilitator._id.toString(),
          name: facilitator.name,
          email: facilitator.email,
          mobile: facilitator.mobile || '',
          status: facilitator.status,
          approval_status: facilitator.approval_status || 'Pending',
          profile_status: facilitator.profile_status || 'Incomplete',
        },
        assignments: assignments.map((a) => ({
          project_id: String(a.project_id),
          company_id: String(a.company_id),
        })),
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const email = forgotPasswordDto.email.trim().toLowerCase();
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const facilitator =
      (await this.facilitatorModel.findOne({ email })) ||
      (await this.facilitatorModel.findOne({ email: { $regex: `^${escapedEmail}$`, $options: 'i' } }));

    if (!facilitator) {
      // Keep response generic to avoid false negatives caused by email casing/data inconsistencies.
      return {
        status: 'success',
        message: 'If an account exists, password reset details will be sent to your email.',
      };
    }

    if (String(facilitator.status || '') !== '1') {
      throw new BadRequestException({
        status: 'errors',
        errors: {
          email: ['Account In-Active! Please Contact Greenco Team.'],
        },
      });
    }

    const newPassword = passwordGeneration(12);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    facilitator.password = hashedPassword;
    await facilitator.save();

    try {
      await this.mailService.sendFacilitatorPasswordResetEmail(
        facilitator.email,
        facilitator.name,
        newPassword,
      );
    } catch (error) {
      console.error('Error sending facilitator forgot password email:', error);
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

  async changePassword(facilitatorId: string, changePasswordDto: ChangePasswordDto) {
    const facilitator = await this.facilitatorModel.findById(facilitatorId).select('+password');

    if (!facilitator) {
      throw new NotFoundException({
        status: 'error',
        message: 'Facilitator not found',
      });
    }

    if (!facilitator.password) {
      throw new BadRequestException({
        status: 'error',
        message:
          'No password is set for this account. Ask an administrator to enable credentials.',
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.current_password,
      facilitator.password,
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
      facilitator.password,
    );

    if (isSamePassword) {
      throw new BadRequestException({
        status: 'error',
        message:
          'New Password cannot be same as your current password. Please choose a different password.',
      });
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.new_password, 10);
    facilitator.password = hashedPassword;
    await facilitator.save();

    this.mailService
      .sendFacilitatorPasswordUpdateEmail(facilitator.email, facilitator.name)
      .catch((error) => {
        console.error('Error sending facilitator password update email:', error);
      });

    return {
      status: 'success',
      message: 'Success! Your new Password has been updated successfully.',
    };
  }
}
