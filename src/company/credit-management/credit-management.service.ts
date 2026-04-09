import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreditManagement, CreditManagementDocument } from '../schemas/credit-management.schema';
import { CreateCreditManagementDto } from './dto/create-credit-management.dto';
import { ListCreditManagementQueryDto } from './dto/list-credit-management-query.dto';

@Injectable()
export class CreditManagementService {
  constructor(
    @InjectModel(CreditManagement.name)
    private readonly creditModel: Model<CreditManagementDocument>,
  ) {}

  private mapRow(doc: any) {
    return {
      id: String(doc._id),
      checklist_criteria: doc.checklist_criteria || '',
      credit_main_heading: doc.credit_main_heading || '',
      credit_number: doc.credit_number || '',
      parameter: doc.parameter || '',
      max_score: doc.max_score || '',
      requirements: doc.requirements || '',
      status: String(doc.status ?? '1'),
      created_at: doc.createdAt || null,
      updated_at: doc.updatedAt || null,
    };
  }

  async createCredit(payload: CreateCreditManagementDto) {
    const checklistCriteria = String(payload?.checklist_criteria || '').trim();
    const creditMainHeading = String(payload?.credit_main_heading || '').trim();
    const creditNumber = String(payload?.credit_number || '').trim();
    const parameter = String(payload?.parameter || '').trim();
    const maxScore = String(payload?.max_score || '').trim();
    const requirements = String(payload?.requirements || '').trim();

    if (!checklistCriteria) throw new BadRequestException('checklist_criteria is required');
    if (!creditMainHeading) throw new BadRequestException('credit_main_heading is required');
    if (!creditNumber) throw new BadRequestException('credit_number is required');
    if (!parameter) throw new BadRequestException('parameter is required');
    if (!maxScore) throw new BadRequestException('max_score is required');

    const exists = await this.creditModel.findOne({ credit_number: new RegExp(`^${creditNumber}$`, 'i') }).lean();
    if (exists) throw new BadRequestException('credit_number already exists');

    const created = await this.creditModel.create({
      checklist_criteria: checklistCriteria,
      credit_main_heading: creditMainHeading,
      credit_number: creditNumber,
      parameter,
      max_score: maxScore,
      requirements: requirements || undefined,
      status: String(payload?.status || '1').trim() || '1',
    });

    return {
      status: 'success',
      message: 'Credit added successfully',
      data: this.mapRow(created.toObject()),
    };
  }

  async listCredits(query?: ListCreditManagementQueryDto) {
    const parsedPage = Number.parseInt(String(query?.page ?? '1'), 10);
    const parsedLimit = Number.parseInt(String(query?.limit ?? '10'), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

    const filter: Record<string, any> = {};
    const name = String(query?.name || '').trim();
    if (name) {
      filter.$or = [{ checklist_criteria: { $regex: name, $options: 'i' } }, { parameter: { $regex: name, $options: 'i' } }];
    }
    if (query?.checklist_criteria?.trim()) {
      filter.checklist_criteria = { $regex: query.checklist_criteria.trim(), $options: 'i' };
    }
    if (query?.credit_number?.trim()) {
      filter.credit_number = { $regex: query.credit_number.trim(), $options: 'i' };
    }
    if (query?.parameter?.trim()) {
      filter.parameter = { $regex: query.parameter.trim(), $options: 'i' };
    }
    if (query?.max_score?.trim()) {
      filter.max_score = { $regex: query.max_score.trim(), $options: 'i' };
    }
    if (query?.status?.trim() && query.status.trim().toLowerCase() !== 'all') {
      filter.status = query.status.trim();
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { checklist_criteria: { $regex: s, $options: 'i' } },
          { credit_main_heading: { $regex: s, $options: 'i' } },
          { credit_number: { $regex: s, $options: 'i' } },
          { parameter: { $regex: s, $options: 'i' } },
          { max_score: { $regex: s, $options: 'i' } },
          { requirements: { $regex: s, $options: 'i' } },
          { status: { $regex: s, $options: 'i' } },
        ],
      });
    }

    const [rows, total] = await Promise.all([
      this.creditModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cappedLimit).lean(),
      this.creditModel.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / cappedLimit));
    return {
      status: 'success',
      message: 'Credits fetched successfully',
      data: rows.map((r) => this.mapRow(r)),
      pagination: {
        page,
        limit: cappedLimit,
        total,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_prev_page: page > 1,
      },
      applied_filters: {
        name: query?.name ?? '',
        checklist_criteria: query?.checklist_criteria ?? '',
        credit_number: query?.credit_number ?? '',
        parameter: query?.parameter ?? '',
        max_score: query?.max_score ?? '',
        status: query?.status ?? '',
        search: query?.search ?? '',
      },
    };
  }

  async getCredit(id: string) {
    const row = await this.creditModel.findById(id).lean();
    if (!row) throw new NotFoundException('Credit not found');
    return {
      status: 'success',
      message: 'Credit fetched successfully',
      data: this.mapRow(row),
    };
  }
}

