import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../../mail/mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
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
          id: 'admin',
          name: adminName,
          email: adminEmail,
          role: 'A',
        },
      },
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
        status: 'errors',
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
}
