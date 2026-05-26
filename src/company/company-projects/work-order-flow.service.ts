import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CompanyWorkOrder, CompanyWorkOrderDocument } from '../schemas/company-workorder.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CompanyProject, CompanyProjectDocument } from '../schemas/company-project.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WorkOrderFlowService {
  constructor(
    @InjectModel(CompanyWorkOrder.name) private readonly workOrderModel: Model<CompanyWorkOrderDocument>,
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyProject.name) private readonly projectModel: Model<CompanyProjectDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async submitWorkOrder(
    companyId: string,
    projectId: string,
    dto: { wo_number: string; wo_date: string },
  ) {
    const woDate = new Date(dto.wo_date);
    if (woDate > new Date()) {
      throw new BadRequestException('Work Order Date cannot be a future date');
    }

    const existing = await this.workOrderModel.findOne({
      company_id: new Types.ObjectId(companyId),
      wo_number: dto.wo_number,
    });
    if (existing) {
      throw new BadRequestException('Work Order Number must be unique per client');
    }

    const company = await this.companyModel.findById(companyId).lean();
    if (!company) throw new NotFoundException('Company not found');

    const workOrder = await this.workOrderModel.create({
      company_id: new Types.ObjectId(companyId),
      project_id: new Types.ObjectId(projectId),
      wo_number: dto.wo_number,
      wo_date: woDate,
      company_name: company.name,
      approval_status: 'pending_approval',
    });

    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    await this.notificationsService.logWorkflowStepForProject(
      {
        company_name: company.name,
        company_id: companyId,
        project_id: projectId,
        activity: 'New Work Order Submitted',
        responsibility: 'CII',
        shortcut_url: `${frontendBase}/admin/work-orders/${workOrder._id}`,
      },
      'step_pending',
      { company: true, admin: true },
    );

    return {
      status: 'success',
      message: 'Work Order submitted successfully. Pending approval.',
      data: this.mapWorkOrder(workOrder),
    };
  }

  async getWorkOrdersByCompany(companyId: string) {
    const orders = await this.workOrderModel
      .find({ company_id: new Types.ObjectId(companyId) })
      .sort({ createdAt: -1 })
      .lean();

    return {
      status: 'success',
      message: 'Work orders retrieved',
      data: orders.map((o) => this.mapWorkOrder(o)),
    };
  }

  async getWorkOrderDetail(workOrderId: string, companyId?: string) {
    const filter: any = { _id: new Types.ObjectId(workOrderId) };
    if (companyId) filter.company_id = new Types.ObjectId(companyId);

    const order = await this.workOrderModel.findOne(filter).lean();
    if (!order) throw new NotFoundException('Work Order not found');

    return {
      status: 'success',
      message: 'Work order detail',
      data: this.mapWorkOrder(order),
    };
  }

  async getPendingWorkOrders() {
    const orders = await this.workOrderModel
      .find({ approval_status: 'pending_approval' })
      .sort({ createdAt: -1 })
      .lean();

    return {
      status: 'success',
      message: 'Pending work orders',
      data: orders.map((o) => this.mapWorkOrder(o)),
    };
  }

  async adminApproveWorkOrder(
    workOrderId: string,
    dto: {
      action: 'approved' | 'rejected';
      wo_number?: string;
      wo_date?: string;
      company_name?: string;
      total_fee?: number;
      registration_fee?: number;
      rejection_reason?: string;
    },
    adminInfo: { sub?: string; name?: string; employee_code?: string },
  ) {
    const order = await this.workOrderModel.findById(workOrderId);
    if (!order) throw new NotFoundException('Work Order not found');
    if (order.approval_status !== 'pending_approval') {
      throw new BadRequestException('Work Order has already been processed');
    }

    if (dto.action === 'approved') {
      if (dto.company_name !== undefined && !dto.company_name?.trim()) {
        throw new BadRequestException('Company Name cannot be left blank');
      }
      if (dto.total_fee === undefined || dto.total_fee < 0) {
        throw new BadRequestException('Total Fee is mandatory and must be non-negative');
      }
      if (dto.registration_fee === undefined || dto.registration_fee < 0) {
        throw new BadRequestException('Registration Fee is mandatory and must be non-negative');
      }

      const refNumber = await this.generateReferenceNumber();

      order.reference_number = refNumber;
      if (dto.wo_number) order.wo_number = dto.wo_number;
      if (dto.wo_date) order.wo_date = new Date(dto.wo_date);
      if (dto.company_name) order.company_name = dto.company_name;
      order.total_fee = dto.total_fee;
      order.registration_fee = dto.registration_fee;
      order.approval_status = 'approved';
      order.wo_status = 1;
      order.approved_by = adminInfo.sub || adminInfo.employee_code || 'admin';
      order.approved_by_name = adminInfo.name || 'Admin';
      order.approved_at = new Date();
    } else {
      order.approval_status = 'rejected';
      order.wo_status = 2;
      order.rejection_reason = dto.rejection_reason || '';
      order.approved_by = adminInfo.sub || adminInfo.employee_code || 'admin';
      order.approved_by_name = adminInfo.name || 'Admin';
      order.approved_at = new Date();
    }
    order.wo_doc_status_updated_at = new Date();
    await order.save();

    const orderCompanyId = String(order.company_id);
    const orderProjectId = String(order.project_id);
    const company = await this.companyModel.findById(orderCompanyId).lean();
    const companyName = order.company_name || company?.name || 'Company';
    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

    await this.notificationsService.logWorkflowStepForProject(
      {
        company_name: companyName,
        company_id: orderCompanyId,
        project_id: orderProjectId,
        activity: dto.action === 'approved'
          ? `Work Order Approved (Ref: ${order.reference_number})`
          : 'Work Order Rejected',
        responsibility: 'CII',
        shortcut_url: `${frontendBase}/admin/work-orders/${workOrderId}`,
      },
      dto.action === 'approved' ? 'step_completed' : 'rejected',
      { company: true, admin: true },
    );

    return {
      status: 'success',
      message: dto.action === 'approved'
        ? 'Work Order approved successfully'
        : 'Work Order rejected',
      data: this.mapWorkOrder(order.toObject()),
    };
  }

  private async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `GBC/${year}/`;

    const latest = await this.workOrderModel
      .findOne({ reference_number: { $regex: `^${prefix}` } })
      .sort({ reference_number: -1 })
      .lean();

    let serial = 1;
    if (latest?.reference_number) {
      const parts = latest.reference_number.split('/');
      const lastSerial = Number.parseInt(parts[2], 10);
      if (!Number.isNaN(lastSerial)) serial = lastSerial + 1;
    }

    return `${prefix}${String(serial).padStart(4, '0')}`;
  }

  private mapWorkOrder(wo: any) {
    const isApproved = wo.approval_status === 'approved';
    return {
      id: String(wo._id),
      company_id: String(wo.company_id),
      project_id: String(wo.project_id),
      wo_number: wo.wo_number || null,
      wo_date: wo.wo_date || null,
      reference_number: isApproved ? (wo.reference_number || null) : null,
      company_name: wo.company_name || null,
      total_fee: isApproved ? (wo.total_fee ?? null) : null,
      registration_fee: isApproved ? (wo.registration_fee ?? null) : null,
      approval_status: wo.approval_status || 'pending_approval',
      wo_status: wo.wo_status ?? 0,
      approved_by_name: wo.approved_by_name || null,
      approved_at: wo.approved_at || null,
      rejection_reason: wo.rejection_reason || null,
      wo_doc: wo.wo_doc || null,
      created_at: wo.createdAt || null,
      updated_at: wo.updatedAt || null,
    };
  }
}
