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
import { ChangePasswordDto } from '../company-auth/dto/change-password.dto';
import { ForgotPasswordDto } from '../company-auth/dto/forgot-password.dto';
import { AssessorAccountStatusGuard } from './guards/assessor-account-status.guard';
import { AssessorJwtAuthGuard } from './guards/assessor-jwt-auth.guard';
import { OptionalAssessorAccountStatusGuard } from './guards/optional-assessor-account-status.guard';
import { OptionalAssessorJwtAuthGuard } from './guards/optional-assessor-jwt-auth.guard';
import { AssessorAuthService } from './assessor-auth.service';
import { AssessorLoginDto } from './dto/assessor-login.dto';
import { AssessorProjectsQueryDto } from './dto/assessor-projects-query.dto';

@Controller('api/assessor/auth')
export class AssessorAuthController {
  constructor(private readonly assessorAuthService: AssessorAuthService) {}

  @Post('login')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(@Body() loginDto: AssessorLoginDto) {
    return this.assessorAuthService.login(loginDto);
  }

  @Post('forgot-password')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.assessorAuthService.forgotPassword(forgotPasswordDto);
  }

  @Get('myprojects')
  @Get('companylist')
  @Get('company_data')
  @UseGuards(OptionalAssessorJwtAuthGuard, OptionalAssessorAccountStatusGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async myProjects(@Request() req: any, @Query() query: AssessorProjectsQueryDto) {
    const rawQ = (req?.query || {}) as Record<string, string | string[] | undefined>;
    const pick = (k: string) => {
      const v = rawQ[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0].trim();
      return '';
    };
    const assessorId =
      String(req?.user?.assessorId || '').trim() ||
      pick('assessor_id') ||
      pick('assessorId') ||
      pick('id');
    if (!assessorId) {
      throw new BadRequestException({
        status: 'error',
        message: 'assessor_id is required (query: assessor_id, assessorId, or id)',
      });
    }
    return this.assessorAuthService.listAssignedProjects(assessorId, query, rawQ as Record<string, unknown>);
  }

  @Post('change-password')
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
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
    @Request() req: { user: { assessorId: string } },
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.assessorAuthService.changePassword(
      req.user.assessorId,
      changePasswordDto,
    );
  }
}
