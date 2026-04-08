import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../../mail/mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { passwordGeneration } from '../../helpers/password.helper';

@Controller('api/admin/auth')
export class AdminAuthCompatController {
  private currentAdminPassword: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {
    this.currentAdminPassword = (process.env.ADMIN_PASSWORD || '').trim();
  }

  private getAdminEmail() {
    return (
      process.env.ADMIN_EMAIL ||
      process.env.MAIL_USERNAME ||
      'thanujamallakuntaa@gmail.com'
    )
      .trim()
      .toLowerCase();
  }

  private getAdminProfile() {
    const fullName = (process.env.ADMIN_NAME || 'Super Admin').trim();
    const [firstName, ...rest] = fullName.split(' ');
    const lastName = rest.join(' ');
    return {
      id: 'admin',
      role: 'A',
      first_name: firstName || 'Super',
      last_name: lastName || 'Admin',
      name: fullName,
      email: this.getAdminEmail(),
      phone: process.env.ADMIN_PHONE || '',
      organization: process.env.ADMIN_ORGANIZATION || 'GreenCo CII',
      designation: process.env.ADMIN_DESIGNATION || 'Super Admin',
      address: process.env.ADMIN_ADDRESS || '',
      city: process.env.ADMIN_CITY || '',
      state: process.env.ADMIN_STATE || '',
      pincode: process.env.ADMIN_PINCODE || '',
    };
  }

  @Post('login')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(@Body() loginDto: LoginDto) {
    const adminEmail = this.getAdminEmail();
    const adminPassword = this.currentAdminPassword;
    const adminName = (process.env.ADMIN_NAME || 'Admin').trim();

    if (!adminEmail || !adminPassword) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Admin account is not configured on server.',
      });
    }

    if (
      loginDto.email.trim().toLowerCase() !== adminEmail ||
      loginDto.password.trim() !== adminPassword
    ) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Your credentials are not valid! Please enter a valid Email and Password.',
      });
    }

    const token = this.jwtService.sign({
      sub: 'admin',
      email: adminEmail,
      role: 'A',
    });

    return {
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          ...this.getAdminProfile(),
          name: adminName,
          email: adminEmail,
        },
      },
    };
  }

  @Get('me')
  async me() {
    return {
      status: 'success',
      message: 'Admin profile',
      data: this.getAdminProfile(),
    };
  }

  @Post('forgotpassword')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async forgotPasswordLegacy(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.forgotPassword(forgotPasswordDto);
  }

  @Post('forgot-password')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const adminEmail = this.getAdminEmail();

    if (!adminEmail) {
      throw new BadRequestException({
        status: 'error',
        message: 'Admin account is not configured on server.',
      });
    }

    if (forgotPasswordDto.email.trim().toLowerCase() !== adminEmail) {
      throw new BadRequestException({
        status: 'error',
        message: `Forgot password is enabled only for ${adminEmail}.`,
        errors: {
          email: [
            `Forgot password is enabled only for ${adminEmail}.`,
          ],
        },
      });
    }

    const generatedPassword = passwordGeneration(12);

    try {
      await this.mailService.sendForgotPasswordEmail(adminEmail, generatedPassword);
      this.currentAdminPassword = generatedPassword;
    } catch (error) {
      const fallbackMessage = 'Failed to send email. Please try again later.';
      const details =
        error instanceof Error ? error.message : 'Unknown email service error.';

      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException({
        status: 'error',
        message:
          process.env.NODE_ENV === 'production'
            ? fallbackMessage
            : `${fallbackMessage} ${details}`,
      });
    }

    return {
      status: 'success',
      message: 'Password sent to your email!',
    };
  }

  @Post('change-password')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async changePassword(@Body() dto: AdminChangePasswordDto) {
    const adminEmail = this.getAdminEmail();
    if (dto.email.trim().toLowerCase() !== adminEmail) {
      throw new BadRequestException({
        status: 'error',
        message: `Change password is enabled only for ${adminEmail}.`,
      });
    }

    if (dto.current_password && dto.current_password.trim()) {
      if (dto.current_password.trim() !== this.currentAdminPassword) {
        throw new BadRequestException({
          status: 'error',
          message: 'Current password is incorrect.',
        });
      }
    }

    if (dto.new_password.trim() !== dto.confirmed.trim()) {
      throw new BadRequestException({
        status: 'error',
        message: 'New Password and Confirm Password does not match.',
      });
    }

    this.currentAdminPassword = dto.new_password.trim();

    return {
      status: 'success',
      message: 'Password changed successfully.',
    };
  }
}
