import { Body, Controller, Get, Param, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreditManagementService } from './credit-management.service';
import { CreateCreditManagementDto } from './dto/create-credit-management.dto';
import { ListCreditManagementQueryDto } from './dto/list-credit-management-query.dto';

@Controller()
export class CreditManagementController {
  constructor(private readonly creditService: CreditManagementService) {}

  @Post('api/admin/scoring')
  @Post('admin/scoring')
  @Post('api/admin/credit-management')
  @Post('admin/credit-management')
  @Post('api/admin/credits')
  @Post('admin/credits')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createCredit(@Body() payload: CreateCreditManagementDto) {
    return this.creditService.createCredit(payload);
  }

  @Get('api/admin/scoring')
  @Get('admin/scoring')
  @Get('api/admin/credit-management')
  @Get('admin/credit-management')
  @Get('api/admin/credits')
  @Get('admin/credits')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listCredits(@Query() query: ListCreditManagementQueryDto) {
    return this.creditService.listCredits(query);
  }

  @Get('api/admin/scoring/:id')
  @Get('admin/scoring/:id')
  @Get('api/admin/credit-management/:id')
  @Get('admin/credit-management/:id')
  @Get('api/admin/credits/:id')
  @Get('admin/credits/:id')
  async getCredit(@Param('id') id: string) {
    return this.creditService.getCredit(id);
  }
}

