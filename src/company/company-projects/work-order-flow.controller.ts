import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../company-auth/guards/jwt-auth.guard';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { WorkOrderFlowService } from './work-order-flow.service';
import { SubmitWorkOrderDto } from './dto/submit-work-order.dto';
import { AdminApproveWorkOrderDto } from './dto/admin-approve-work-order.dto';

@Controller()
export class WorkOrderFlowController {
  constructor(private readonly workOrderFlowService: WorkOrderFlowService) {}

  // ── Client APIs ──

  @Post('api/company/projects/:projectId/work-orders/submit')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async submitWorkOrder(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Body() dto: SubmitWorkOrderDto,
  ) {
    const companyId = req.user?.sub || req.user?.id;
    return this.workOrderFlowService.submitWorkOrder(companyId, projectId, dto);
  }

  @Get('api/company/work-orders')
  @UseGuards(JwtAuthGuard)
  async getMyWorkOrders(@Request() req: any) {
    const companyId = req.user?.sub || req.user?.id;
    return this.workOrderFlowService.getWorkOrdersByCompany(companyId);
  }

  @Get('api/company/work-orders/:workOrderId')
  @UseGuards(JwtAuthGuard)
  async getWorkOrderDetail(
    @Param('workOrderId') workOrderId: string,
    @Request() req: any,
  ) {
    const companyId = req.user?.sub || req.user?.id;
    return this.workOrderFlowService.getWorkOrderDetail(workOrderId, companyId);
  }

  // ── Admin APIs ──

  @Get('api/admin/work-orders/pending')
  @UseGuards(AdminJwtAuthGuard)
  async getPendingWorkOrders() {
    return this.workOrderFlowService.getPendingWorkOrders();
  }

  @Get('api/admin/work-orders/:workOrderId')
  @UseGuards(AdminJwtAuthGuard)
  async getAdminWorkOrderDetail(@Param('workOrderId') workOrderId: string) {
    return this.workOrderFlowService.getWorkOrderDetail(workOrderId);
  }

  @Put('api/admin/work-orders/:workOrderId/review')
  @UseGuards(AdminJwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async reviewWorkOrder(
    @Param('workOrderId') workOrderId: string,
    @Request() req: any,
    @Body() dto: AdminApproveWorkOrderDto,
  ) {
    const adminInfo = req.admin || {};
    return this.workOrderFlowService.adminApproveWorkOrder(workOrderId, dto, adminInfo);
  }
}
