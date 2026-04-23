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
  @UseGuards(AssessorJwtAuthGuard, AssessorAccountStatusGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async myProjects(
    @Request() req: { user: { assessorId: string }; query?: Record<string, unknown> },
    @Query() query: AssessorProjectsQueryDto,
  ) {
    return this.assessorAuthService.listAssignedProjects(
      req.user.assessorId,
      query,
      req.query || {},
    );
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
