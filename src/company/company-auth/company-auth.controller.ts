import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { CompanyAuthService } from './company-auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AccountStatusGuard } from './guards/account-status.guard';
import { RegistrationMastersService } from '../registration-masters/registration-masters.service';

@Controller('api/company/auth')
export class CompanyAuthController {
  constructor(
    private readonly companyAuthService: CompanyAuthService,
    private readonly registrationMastersService: RegistrationMastersService,
  ) {}

  @Post('register')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        const errors: Record<string, string[]> = {};

        validationErrors.forEach((error) => {
          if (error.constraints) {
            errors[error.property] = Object.values(error.constraints);
          }
        });

        return new BadRequestException({
          status: 'error',
          message: 'Validation failed',
          errors,
        });
      },
    }),
  )
  async register(@Body() registerDto: RegisterDto) {
    return this.companyAuthService.register(registerDto);
  }

  @Get('register')
  async getRegisterInfo() {
    const masters = await this.registrationMastersService.getRegistrationMasters();
    return {
      status: 'success',
      message: 'Registration form data',
      data: {
        payload: {
          email: '',
          company_name: '',
          mobileno: '',
          assessment: 'cii',
          selectfacilitator: '',
        },
        assessment_options: [
          { id: 'cii', name: 'cii' },
          { id: 'facilitator', name: 'facilitator' },
        ],
        ...masters.data,
      },
    };
  }

  @Post('login')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(@Body() loginDto: LoginDto) {
    return this.companyAuthService.login(loginDto);
  }

  @Post('forgot-password')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.companyAuthService.forgotPassword(forgotPasswordDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        const errors: Record<string, string[]> = {};

        validationErrors.forEach((error) => {
          if (error.constraints) {
            errors[error.property] = Object.values(error.constraints);
          }
        });

        return new BadRequestException({
          status: 'error',
          message: 'Validation failed.',
          errors,
        });
      },
    }),
  )
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.companyAuthService.changePassword(
      req.user.userId,
      changePasswordDto,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout() {
    return {
      status: 'success',
      message: 'Thank you. You have been succesfully logged out',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getCurrentUser(@Request() req) {
    return this.companyAuthService.getCurrentUser(req.user.userId);
  }

  @Get('companies-list')
  @Get('submitted-companies')
  @Get('submitted_companies')
  async getCompaniesList(@Query('name') name?: string) {
    return this.companyAuthService.getCompaniesList(name);
  }
}

