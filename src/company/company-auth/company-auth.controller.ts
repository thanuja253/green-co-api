import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
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

  /**
   * GET /api/company/auth/register
   * Returns registration master data for frontend form load on the same route path.
   */
  @Get('register')
  async getRegisterMasters() {
    const masters = await this.registrationMastersService.getRegistrationMasters();
    const submitted = await this.companyAuthService.getSubmittedCompanies();
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
        submitted_companies: submitted.data,
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
  async getCompaniesList(@Query('name') name?: string) {
    return this.companyAuthService.getCompaniesList(name);
  }

  @Get('submitted-companies')
  async getSubmittedCompanies(@Query('q') q?: string) {
    return this.companyAuthService.getSubmittedCompanies(q);
  }

  /**
   * GET /api/company/auth/registered-companies
   * Returns registered companies with pagination and summary.
   */
  @Get('registered-companies')
  async getRegisteredCompanies(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.companyAuthService.getRegisteredCompanies(
      q,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  /**
   * GET /api/company/auth/register-info
   * Auth namespace endpoint for registration masters.
   */
  @Get('register-info')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Surrogate-Control', 'no-store')
  async getRegisterInfo() {
    return this.registrationMastersService.getRegistrationMasters();
  }

  /**
   * GET /api/company/auth/registration-info
   * Alias endpoint for frontend consistency.
   */
  @Get('registration-info')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Surrogate-Control', 'no-store')
  async getRegistrationInfo() {
    return this.registrationMastersService.getRegistrationMasters();
  }

  /**
   * GET /api/company/auth/registration-data
   * Full registration page data: payload defaults + masters + submitted companies.
   */
  @Get('registration-data')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Surrogate-Control', 'no-store')
  async getRegistrationData() {
    const masters = await this.registrationMastersService.getRegistrationMasters();
    const submitted = await this.companyAuthService.getSubmittedCompanies();
    return {
      status: 'success',
      message: 'Registration data loaded successfully',
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
        submitted_companies: submitted.data,
        ...masters.data,
      },
    };
  }
}

