import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ChangePasswordDto } from '../company-auth/dto/change-password.dto';
import { ForgotPasswordDto } from '../company-auth/dto/forgot-password.dto';
import { FacilitatorAuthService } from './facilitator-auth.service';
import { FacilitatorLoginDto } from './dto/facilitator-login.dto';
import { FacilitatorAccountStatusGuard } from './guards/facilitator-account-status.guard';
import { FacilitatorJwtAuthGuard } from './guards/facilitator-jwt-auth.guard';

@Controller()
export class FacilitatorAuthController {
  constructor(private readonly facilitatorAuthService: FacilitatorAuthService) {}

  @Post('api/facilitator/auth/login')
  @Post('facilitator/auth/login')
  @Post('api/facilitators/auth/login')
  @Post('facilitators/auth/login')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(@Body() loginDto: FacilitatorLoginDto) {
    return this.facilitatorAuthService.login(loginDto);
  }

  @Post('api/facilitator/auth/forgot-password')
  @Post('facilitator/auth/forgot-password')
  @Post('api/facilitators/auth/forgot-password')
  @Post('facilitators/auth/forgot-password')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.facilitatorAuthService.forgotPassword(forgotPasswordDto);
  }

  @Post('api/facilitator/auth/change-password')
  @Post('facilitator/auth/change-password')
  @Post('api/facilitators/auth/change-password')
  @Post('facilitators/auth/change-password')
  @UseGuards(FacilitatorJwtAuthGuard, FacilitatorAccountStatusGuard)
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
    @Request() req: { user: { facilitatorId: string } },
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.facilitatorAuthService.changePassword(
      req.user.facilitatorId,
      changePasswordDto,
    );
  }
}
