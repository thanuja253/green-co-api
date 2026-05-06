import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../company-auth/guards/jwt-auth.guard';
import { AccountStatusGuard } from '../company-auth/guards/account-status.guard';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { HelpDeskService } from './help-desk.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketAdminDto } from './dto/update-ticket-admin.dto';

@Controller('api/company/help-desk')
export class HelpDeskController {
  constructor(private readonly helpDeskService: HelpDeskService) {}

  /**
   * Company: raise a query (create ticket).
   * POST /api/company/help-desk
   */
  @Post()
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Request() req, @Body() dto: CreateTicketDto) {
    const ticket = await this.helpDeskService.create(req.user.userId, dto);
    return {
      status: 'success',
      message: 'Ticket raised successfully',
      data: ticket,
    };
  }

  /**
   * Company: view list of raised tickets with status and remarks.
   * GET /api/company/help-desk?status=open&limit=20&skip=0
   */
  @Get()
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async list(
    @Request() req,
    @Query('status') status?: 'open' | 'in_progress' | 'resolved' | 'closed',
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const result = await this.helpDeskService.listByCompany(req.user.userId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      status: 'success',
      message: 'Tickets loaded',
      data: result,
    };
  }

  /**
   * Admin: list all tickets (all companies). Declare before :id to avoid "admin" matching :id.
   * GET /api/company/help-desk/admin/list?status=open&company_id=xxx&limit=20&skip=0
   * TODO: Protect with AdminGuard when admin auth is available.
   */
  @Get('admin/list')
  @UseGuards(AdminJwtAuthGuard)
  async listAll(
    @Query('status') status?: 'open' | 'in_progress' | 'resolved' | 'closed',
    @Query('company_id') company_id?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const result = await this.helpDeskService.listAll({
      status,
      company_id,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      status: 'success',
      message: 'Tickets loaded',
      data: result,
    };
  }

  /**
   * Company: get one ticket by id.
   * GET /api/company/help-desk/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async getOne(@Request() req, @Param('id') id: string) {
    const ticket = await this.helpDeskService.getOneByCompany(req.user.userId, id);
    return {
      status: 'success',
      message: 'Ticket loaded',
      data: ticket,
    };
  }

  /**
   * Admin: update ticket status and/or remarks. On status = 'resolved', company receives email.
   * PATCH /api/company/help-desk/:id/admin
   * TODO: Protect with AdminGuard when admin auth is available.
   */
  @Patch(':id/admin')
  @UseGuards(AdminJwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateByAdmin(@Param('id') id: string, @Body() dto: UpdateTicketAdminDto) {
    const ticket = await this.helpDeskService.updateByAdmin(id, dto);
    return {
      status: 'success',
      message: 'Ticket updated',
      data: ticket,
    };
  }
}
