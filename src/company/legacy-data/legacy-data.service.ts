import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { LegacyData, LegacyDataDocument } from '../schemas/legacy-data.schema';
import { Sector, SectorDocument } from '../schemas/sector.schema';
import { CreateLegacyDataDto } from './dto/create-legacy-data.dto';
import { ListLegacyDataQueryDto } from './dto/list-legacy-data-query.dto';
import { ImportLegacyDataDto } from './dto/import-legacy-data.dto';

@Injectable()
export class LegacyDataService {
  private lastAutoSeedAttemptAt = 0;

  constructor(
    @InjectModel(LegacyData.name) private readonly legacyDataModel: Model<LegacyDataDocument>,
    @InjectModel(Sector.name) private readonly sectorModel: Model<SectorDocument>,
  ) {}

  private mapRow(row: any) {
    return {
      id: row._id?.toString?.() || row._id,
      company_name: row.company_name || '',
      level_of_certification: row.level_of_certification || '',
      date_of_award: row.date_of_award || '',
      expiry_date: row.expiry_date || '',
      sector_id: row.sector_id || '',
      sector: row.sector || '',
      email: row.email || '',
      phone_no: row.phone_no || '',
      created_by: row.created_by || null,
      updated_by: row.updated_by || null,
      created_at: row.createdAt || null,
      updated_at: row.updatedAt || null,
      deleted_at: row.deleted_at || null,
    };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const next = line[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result.map((s) => s.trim());
  }

  private normalizeValue(value: unknown): string {
    const str = String(value ?? '').trim();
    if (!str || str.toUpperCase() === 'NULL') return '';
    return str;
  }

  async createLegacyData(dto: CreateLegacyDataDto) {
    const companyName = (dto.company_name || '').trim();
    if (!companyName) {
      throw new BadRequestException({
        status: 'validations',
        errors: { company_name: ['company_name is required.'] },
      });
    }

    const phoneNo = (dto.phone_no || dto.phone_number || '').trim();
    const sectorId = (dto.sector_id || '').trim();
    let sectorName = (dto.sector || '').trim();
    if (sectorId && !sectorName) {
      const sector = await this.sectorModel.findById(sectorId).lean();
      if (sector) sectorName = sector.name || '';
    }

    const created = await this.legacyDataModel.create({
      company_name: companyName,
      level_of_certification: (dto.level_of_certification || '').trim(),
      date_of_award: (dto.date_of_award || dto.year || '').trim(),
      expiry_date: (dto.expiry_date || '').trim(),
      sector_id: sectorId,
      sector: sectorName,
      email: (dto.email || '').trim().toLowerCase(),
      phone_no: phoneNo,
      created_by: process.env.ADMIN_EMAIL || null,
      updated_by: process.env.ADMIN_EMAIL || null,
      deleted_at: null,
    });

    return {
      status: 'success',
      message: 'Legacy data added successfully',
      data: this.mapRow(created.toObject()),
    };
  }

  async listLegacyData(query?: ListLegacyDataQueryDto) {
    await this.autoSeedFromCsvIfEmpty();

    const parsedPage = Number.parseInt(String(query?.page ?? '1'), 10);
    const parsedLimit = Number.parseInt(String(query?.limit ?? '10'), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

    const filter: Record<string, any> = { $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }] };
    if (query?.company_name?.trim()) {
      filter.company_name = { $regex: query.company_name.trim(), $options: 'i' };
    }
    if (query?.level_of_certification?.trim() && query.level_of_certification !== 'All') {
      filter.level_of_certification = query.level_of_certification.trim();
    }
    if (query?.sector?.trim() && query.sector !== 'All') {
      filter.sector = { $regex: query.sector.trim(), $options: 'i' };
    }
    const phone = query?.phone_no?.trim() || query?.phone_number?.trim();
    if (phone) {
      filter.phone_no = { $regex: phone, $options: 'i' };
    }
    if (query?.email?.trim()) {
      filter.email = { $regex: query.email.trim(), $options: 'i' };
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { company_name: { $regex: s, $options: 'i' } },
            { level_of_certification: { $regex: s, $options: 'i' } },
            { sector: { $regex: s, $options: 'i' } },
            { email: { $regex: s, $options: 'i' } },
            { phone_no: { $regex: s, $options: 'i' } },
          ],
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.legacyDataModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cappedLimit).lean(),
      this.legacyDataModel.countDocuments(filter),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / cappedLimit));

    return {
      status: 'success',
      message: 'Legacy data fetched successfully',
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
        company_name: query?.company_name ?? '',
        level_of_certification: query?.level_of_certification ?? '',
        sector: query?.sector ?? '',
        phone_no: query?.phone_no ?? query?.phone_number ?? '',
        email: query?.email ?? '',
        search: query?.search ?? '',
      },
    };
  }

  async getLegacyDataById(id: string) {
    const row = await this.legacyDataModel.findById(id).lean();
    if (!row) {
      throw new NotFoundException({ status: 'error', message: 'Legacy data not found' });
    }
    return {
      status: 'success',
      message: 'Legacy data fetched successfully',
      data: this.mapRow(row),
    };
  }

  async importLegacyData(dto: ImportLegacyDataDto) {
    const rowsFromJson = Array.isArray(dto.rows) ? dto.rows : [];
    let parsedRows: Array<Record<string, any>> = rowsFromJson;

    if (!parsedRows.length && dto.csv_text?.trim()) {
      const lines = dto.csv_text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => !!l);
      if (lines.length < 2) {
        throw new BadRequestException({ status: 'error', message: 'CSV content is empty or invalid.' });
      }
      const headers = this.parseCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''));
      parsedRows = lines.slice(1).map((line) => {
        const cells = this.parseCsvLine(line);
        const row: Record<string, any> = {};
        headers.forEach((h, idx) => {
          row[h] = (cells[idx] || '').replace(/^"|"$/g, '');
        });
        return row;
      });
    }

    if (!parsedRows.length) {
      throw new BadRequestException({
        status: 'error',
        message: 'Provide either rows[] or csv_text for import.',
      });
    }

    const ops = parsedRows
      .map((row) => {
        const companyName = this.normalizeValue(row.company_name);
        if (!companyName) return null;
        const dateOfAward = this.normalizeValue(row.date_of_award);
        const expiryDate = this.normalizeValue(row.expiry_date);
        const sectorId = this.normalizeValue(row.sector_id);
        return {
          updateOne: {
            filter: {
              company_name: companyName,
              date_of_award: dateOfAward,
              expiry_date: expiryDate,
              sector_id: sectorId,
            },
            update: {
              $set: {
                company_name: companyName,
                level_of_certification: this.normalizeValue(row.level_of_certification),
                date_of_award: dateOfAward,
                expiry_date: expiryDate,
                sector_id: sectorId,
                sector: this.normalizeValue(row.sector),
                email: this.normalizeValue(row.email).toLowerCase(),
                phone_no: this.normalizeValue(row.phone_no),
                created_by: this.normalizeValue(row.created_by) || (process.env.ADMIN_EMAIL || ''),
                updated_by: process.env.ADMIN_EMAIL || this.normalizeValue(row.updated_by),
                deleted_at: null,
              },
            },
            upsert: true,
          },
        };
      })
      .filter(Boolean) as any[];

    if (!ops.length) {
      throw new BadRequestException({ status: 'error', message: 'No valid rows found for import.' });
    }

    const result = await this.legacyDataModel.bulkWrite(ops, { ordered: false });
    return {
      status: 'success',
      message: 'Legacy data imported successfully',
      data: {
        processed: parsedRows.length,
        upserted: result.upsertedCount ?? 0,
        modified: result.modifiedCount ?? 0,
        matched: result.matchedCount ?? 0,
      },
    };
  }

  private async autoSeedFromCsvIfEmpty() {
    const total = await this.legacyDataModel.countDocuments({
      $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
    });
    if (total > 0) return;

    const now = Date.now();
    // Avoid hammering disk/parsing on every request when file is missing/misconfigured.
    if (now - this.lastAutoSeedAttemptAt < 15000) return;
    this.lastAutoSeedAttemptAt = now;

    const configuredPath = (process.env.LEGACY_DATA_CSV_PATH || '').trim();
    if (!configuredPath) return;

    const resolvedPath = configuredPath.startsWith('/')
      ? configuredPath
      : join(process.cwd(), configuredPath);

    if (!fs.existsSync(resolvedPath)) return;

    const csvText = fs.readFileSync(resolvedPath, 'utf8');
    if (!csvText.trim()) return;

    await this.importLegacyData({ csv_text: csvText });
  }
}

