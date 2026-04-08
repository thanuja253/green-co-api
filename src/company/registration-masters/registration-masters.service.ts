import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Industry, IndustryDocument } from '../schemas/industry.schema';
import { Entity, EntityDocument } from '../schemas/entity.schema';
import { Sector, SectorDocument } from '../schemas/sector.schema';
import { State, StateDocument } from '../schemas/state.schema';
import { Facilitator, FacilitatorDocument } from '../schemas/facilitator.schema';
import { AssessorGrade, AssessorGradeDocument } from '../schemas/assessor-grade.schema';
import { CreateIndustryDto } from './dto/create-industry.dto';
import { CreateStateDto } from './dto/create-state.dto';
import { CreateAssessorGradeDto } from './dto/create-assessor-grade.dto';

@Injectable()
export class RegistrationMastersService {
  constructor(
    @InjectModel(Industry.name)
    private readonly industryModel: Model<IndustryDocument>,
    @InjectModel(Entity.name)
    private readonly entityModel: Model<EntityDocument>,
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
    @InjectModel(State.name)
    private readonly stateModel: Model<StateDocument>,
    @InjectModel(Facilitator.name)
    private readonly facilitatorModel: Model<FacilitatorDocument>,
    @InjectModel(AssessorGrade.name)
    private readonly assessorGradeModel: Model<AssessorGradeDocument>,
  ) {}

  async getRegistrationMasters(): Promise<{
    status: 'success';
    message: string;
    data: {
      industries: Array<{ id: string; name: string }>;
      entities: Array<{ id: string; name: string }>;
      sectors: Array<{ id: string; name: string; group_name?: string }>;
      states: Array<{ id: string; name: string; code?: string }>;
      facilitators: Array<{ id: string; name: string }>;
    };
  }> {
    try {
      console.log('[RegistrationMasters] Fetching master data...');
      // Fetch all data - try with status filter first, fallback to all if empty
      const [industriesFiltered, entitiesFiltered, sectors, statesFiltered, facilitatorsFiltered] =
        await Promise.all([
          // Industries: try status = 1 or "1" or missing
          this.industryModel
            .find({
              $or: [
                { status: 1 },
                { status: '1' },
                { status: { $exists: false } },
              ],
            })
            .sort({ name: 1 })
            .select('_id name')
            .lean(),
          // Entities: same as industries
          this.entityModel
            .find({
              $or: [
                { status: 1 },
                { status: '1' },
                { status: { $exists: false } },
              ],
            })
            .sort({ name: 1 })
            .select('_id name')
            .lean(),
          // Sectors: no status field, return all (include group_name for GROUP / SECTOR UI)
          this.sectorModel
            .find({})
            .sort({ group_name: 1, name: 1 })
            .select('_id name group_name')
            .lean(),
          // States: same as industries/entities
          this.stateModel
            .find({
              $or: [
                { status: 1 },
                { status: '1' },
                { status: { $exists: false } },
              ],
            })
            .sort({ name: 1 })
            .select('_id name code')
            .lean(),
          // Facilitators: status = "1" or 1 or missing
          this.facilitatorModel
            .find({
              $or: [
                { status: '1' },
                { status: 1 },
                { status: { $exists: false } },
              ],
            })
            .sort({ name: 1 })
            .select('_id name')
            .lean(),
        ]);

      // If filtered results are empty, try fetching all records (fallback)
      const industries = industriesFiltered.length > 0
        ? industriesFiltered
        : await this.industryModel.find({}).sort({ name: 1 }).select('_id name').lean();
      
      const entities = entitiesFiltered.length > 0
        ? entitiesFiltered
        : await this.entityModel.find({}).sort({ name: 1 }).select('_id name').lean();
      
      const states = statesFiltered.length > 0
        ? statesFiltered
        : await this.stateModel.find({}).sort({ name: 1 }).select('_id name code').lean();
      
      const facilitators = facilitatorsFiltered.length > 0
        ? facilitatorsFiltered
        : await this.facilitatorModel.find({}).sort({ name: 1 }).select('_id name').lean();

      console.log('[RegistrationMasters] Results:', {
        industries: industries.length,
        entities: entities.length,
        sectors: sectors.length,
        states: states.length,
        facilitators: facilitators.length,
      });

      return {
        status: 'success',
        message: 'Registration masters loaded successfully',
        data: {
          industries: industries.map((i: any) => ({
            id: i._id.toString(),
            name: i.name,
          })),
          entities: entities.map((e: any) => ({
            id: e._id.toString(),
            name: e.name,
          })),
          sectors: sectors.map((s: any) => ({
            id: s._id.toString(),
            name: s.name,
            group_name: s.group_name || '',
          })),
          states: states.map((s: any) => ({
            id: s._id.toString(),
            name: s.name,
            code: s.code || undefined,
          })),
          facilitators: facilitators.map((f: any) => ({
            id: f._id.toString(),
            name: f.name,
          })),
        },
      };
    } catch (error) {
      console.error('Error loading registration masters:', error);
      // Return empty arrays instead of throwing error, so frontend can still render
      return {
        status: 'success',
        message: 'Registration masters loaded (some collections may be empty)',
        data: {
          industries: [],
          entities: [],
          sectors: [],
          states: [],
          facilitators: [],
        },
      };
    }
  }

  /**
   * Get all states (for dropdowns, filters, etc.).
   * Returns active states first; falls back to all if none have status = 1.
   */
  async getAllStates(): Promise<{
    status: 'success';
    message: string;
    data: { states: Array<{ id: string; name: string; code?: string }> };
  }> {
    const statesFiltered = await this.stateModel
      .find({
        $or: [
          { status: 1 },
          { status: '1' },
          { status: { $exists: false } },
        ],
      })
      .sort({ name: 1 })
      .select('_id name code')
      .lean();
    const states =
      statesFiltered.length > 0
        ? statesFiltered
        : await this.stateModel.find({}).sort({ name: 1 }).select('_id name code').lean();
    return {
      status: 'success',
      message: 'States loaded',
      data: {
        states: (states as any[]).map((s) => ({
          id: s._id.toString(),
          name: s.name,
          code: s.code || undefined,
        })),
      },
    };
  }

  /**
   * Get distinct groups and all sectors (for Primary Data / checklist page: GROUP and SECTOR dropdowns).
   */
  async getGroupsAndSectors(): Promise<{
    status: 'success';
    message: string;
    data: { groups: string[]; sectors: Array<{ id: string; name: string; group_name: string }> };
  }> {
    const sectors = await this.sectorModel
      .find({})
      .sort({ group_name: 1, name: 1 })
      .select('_id name group_name')
      .lean();
    const sectorList = (sectors as any[]).map((s) => ({
      id: s._id.toString(),
      name: s.name,
      group_name: s.group_name || '',
    }));
    const groups = [...new Set(sectorList.map((s) => s.group_name).filter(Boolean))].sort();
    return {
      status: 'success',
      message: 'Groups and sectors',
      data: { groups, sectors: sectorList },
    };
  }

  /**
   * Get assessment submittal category tabs (GSC, IE, PSL, MS, EM, CBM, WTM, MRM, GBE).
   * Frontend uses this to render tabs and filter assessment_submittals by description/criterion.
   */
  async getAssessmentCategories(): Promise<{
    status: 'success';
    message: string;
    data: { categories: Array<{ code: string; label: string; order: number }> };
  }> {
    const categories = [
      { code: 'GSC', label: 'Green Supply Chain', order: 1 },
      { code: 'IE', label: 'Industrial Ecology', order: 2 },
      { code: 'PSL', label: 'Product Stewardship / Life Cycle', order: 3 },
      { code: 'MS', label: 'Material Stewardship', order: 4 },
      { code: 'EM', label: 'Energy Management', order: 5 },
      { code: 'CBM', label: 'Circular Business Model', order: 6 },
      { code: 'WTM', label: 'Water & Wastewater Management', order: 7 },
      { code: 'MRM', label: 'Material Resource Management', order: 8 },
      { code: 'GBE', label: 'Green Building / Infrastructure', order: 9 },
    ];
    return {
      status: 'success',
      message: 'Assessment submittal categories',
      data: { categories },
    };
  }

  async getAllAssessorGrades() {
    const grades = await this.assessorGradeModel.find({}).sort({ name: 1 }).lean();
    return {
      status: 'success',
      message: 'Assessor grades loaded',
      data: {
        grades: (grades as any[]).map((g) => ({
          id: g._id.toString(),
          name: g.name,
          status: g.status ?? 1,
        })),
      },
    };
  }

  async getActiveAssessorGrades() {
    const active = await this.assessorGradeModel
      .find({
        $or: [{ status: 1 }, { status: '1' }, { status: { $exists: false } }],
      })
      .sort({ name: 1 })
      .lean();
    const grades =
      active.length > 0
        ? active
        : await this.assessorGradeModel.find({}).sort({ name: 1 }).lean();
    return {
      status: 'success',
      message: 'Assessor grades loaded',
      data: {
        grades: (grades as any[]).map((g) => ({
          id: g._id.toString(),
          name: g.name,
          status: g.status ?? 1,
        })),
      },
    };
  }

  async createAssessorGrade(dto: CreateAssessorGradeDto) {
    const name = dto.name.trim().toUpperCase();
    const existing = await this.assessorGradeModel.findOne({ name }).lean();
    if (existing) {
      return {
        status: 'success',
        message: 'Assessor grade already exists',
        data: {
          id: (existing as any)._id.toString(),
          name: (existing as any).name,
          status: (existing as any).status ?? 1,
        },
      };
    }
    const grade = await this.assessorGradeModel.create({
      name,
      status: dto.status ?? 1,
    });
    return {
      status: 'success',
      message: 'Assessor grade created successfully',
      data: {
        id: grade._id.toString(),
        name: grade.name,
        status: grade.status,
      },
    };
  }

  async createAssessorGradesBulk(items: CreateAssessorGradeDto[]) {
    const inserted: any[] = [];
    const skipped: string[] = [];
    for (const item of items || []) {
      const name = (item.name || '').trim().toUpperCase();
      if (!name) continue;
      const existing = await this.assessorGradeModel.findOne({ name }).lean();
      if (existing) {
        skipped.push(name);
        continue;
      }
      const row = await this.assessorGradeModel.create({
        name,
        status: item.status ?? 1,
      });
      inserted.push({
        id: row._id.toString(),
        name: row.name,
        status: row.status,
      });
    }
    return {
      status: 'success',
      message: 'Assessor grades bulk processed',
      data: {
        inserted_count: inserted.length,
        skipped_count: skipped.length,
        inserted,
        skipped,
      },
    };
  }

  async getAllIndustries() {
    const industries = await this.industryModel.find({}).sort({ name: 1 }).lean();
    return {
      status: 'success',
      message: 'Industries loaded',
      data: {
        industries: (industries as any[]).map((i) => ({
          id: i._id.toString(),
          name: i.name,
          status: i.status ?? 1,
        })),
      },
    };
  }

  async createIndustry(dto: CreateIndustryDto) {
    const name = dto.name.trim();
    const existing = await this.industryModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
    if (existing) {
      return {
        status: 'success',
        message: 'Industry already exists',
        data: {
          id: (existing as any)._id.toString(),
          name: (existing as any).name,
          status: (existing as any).status ?? 1,
        },
      };
    }

    const industry = await this.industryModel.create({
      name,
      status: dto.status ?? 1,
    });

    return {
      status: 'success',
      message: 'Industry created successfully',
      data: {
        id: industry._id.toString(),
        name: industry.name,
        status: industry.status,
      },
    };
  }

  async createIndustriesBulk(items: CreateIndustryDto[]) {
    const inserted: any[] = [];
    const skipped: string[] = [];

    for (const item of items || []) {
      const name = (item.name || '').trim();
      if (!name) continue;
      const existing = await this.industryModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
      if (existing) {
        skipped.push(name);
        continue;
      }
      const row = await this.industryModel.create({
        name,
        status: item.status ?? 1,
      });
      inserted.push({
        id: row._id.toString(),
        name: row.name,
        status: row.status,
      });
    }

    return {
      status: 'success',
      message: 'Industries bulk processed',
      data: {
        inserted_count: inserted.length,
        skipped_count: skipped.length,
        inserted,
        skipped,
      },
    };
  }

  async getAllStatesMaster() {
    const states = await this.stateModel.find({}).sort({ name: 1 }).lean();
    return {
      status: 'success',
      message: 'States loaded',
      data: {
        states: (states as any[]).map((s) => ({
          id: s._id.toString(),
          name: s.name,
          code: s.code || '',
          status: s.status ?? 1,
        })),
      },
    };
  }

  async createState(dto: CreateStateDto) {
    const name = dto.name.trim();
    const existing = await this.stateModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
    if (existing) {
      return {
        status: 'success',
        message: 'State already exists',
        data: {
          id: (existing as any)._id.toString(),
          name: (existing as any).name,
          code: (existing as any).code || '',
          status: (existing as any).status ?? 1,
        },
      };
    }

    const state = await this.stateModel.create({
      name,
      code: dto.code?.trim() || undefined,
      status: dto.status ?? 1,
    });

    return {
      status: 'success',
      message: 'State created successfully',
      data: {
        id: state._id.toString(),
        name: state.name,
        code: state.code || '',
        status: state.status,
      },
    };
  }

  async createStatesBulk(items: CreateStateDto[]) {
    const inserted: any[] = [];
    const skipped: string[] = [];

    for (const item of items || []) {
      const name = (item.name || '').trim();
      if (!name) continue;
      const existing = await this.stateModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
      if (existing) {
        skipped.push(name);
        continue;
      }
      const row = await this.stateModel.create({
        name,
        code: item.code?.trim() || undefined,
        status: item.status ?? 1,
      });
      inserted.push({
        id: row._id.toString(),
        name: row.name,
        code: row.code || '',
        status: row.status,
      });
    }

    return {
      status: 'success',
      message: 'States bulk processed',
      data: {
        inserted_count: inserted.length,
        skipped_count: skipped.length,
        inserted,
        skipped,
      },
    };
  }
}


