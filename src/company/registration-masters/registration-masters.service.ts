import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Industry, IndustryDocument } from '../schemas/industry.schema';
import { Entity, EntityDocument } from '../schemas/entity.schema';
import { Sector, SectorDocument } from '../schemas/sector.schema';
import { State, StateDocument } from '../schemas/state.schema';
import { Facilitator, FacilitatorDocument } from '../schemas/facilitator.schema';
import { Assessor, AssessorDocument } from '../schemas/assessor.schema';
import { AssessorGrade, AssessorGradeDocument } from '../schemas/assessor-grade.schema';

const INDIA_STATES_MASTER: Array<{ code: string; name: string }> = [
  { code: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CH', name: 'Chandigarh' },
  { code: 'CT', name: 'Chhattisgarh' },
  { code: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: 'DL', name: 'Delhi' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'MN', name: 'Manipur' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OR', name: 'Odisha' },
  { code: 'PY', name: 'Puducherry' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TG', name: 'Telangana' },
  { code: 'TR', name: 'Tripura' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'UT', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' },
];

const DEFAULT_SECTORS_FROM_IMAGES: string[] = [
  'AIRPORTS',
  'AIRPORTS(GENERAL V4)',
  'APPLIANCE',
  'APPLIANCE(GENERAL V4)',
  'AUTO COMPONENT',
  'AUTO COMPONENT(GENERAL V4)',
  'AUTOMOBILE',
  'AUTOMOBILE (GENERAL V4)',
  'AVIATION',
  'AVIATION (GENERAL V4)',
  'BEVERAGE',
  'BEVERAGE(GENERAL V4)',
  'BIOTECHNOLOGY',
  'BIOTECHNOLOGY(GENERAL V4)',
  'BUILDING MATERIALS',
  'BUILDING MATERIALS(GENERAL V4)',
  'CEMENT V 4',
  'CEMENT VERSION V',
  'CEMENT(GRINDING UNIT)',
  'CEMENT(GRINDING UNIT)(GENERAL V4)',
  'CEMENT(INTEGRATED UNIT)',
  'CHEMICALS',
  'CHEMICALS (GENERAL V4)',
  'CONSTRUCTION',
  'CONSTRUCTION (GENERAL V4)',
  'DEFENCE MANUFACTURING',
  'DEFENCE MANUFACTURING(GENERAL V4)',
  'DUMMY TEST',
  'EARTH MOVING',
  'EARTH MOVING (GENERAL V4)',
  'ELECTRICAL & ELECTRONICS',
  'ELECTRICAL & ELECTRONICS(GENERAL V4)',
  'ENGINEERING',
  'ENGINEERING(GENERAL V4)',
  'FETILIZER',
  'FETILIZER (GENERAL V4)',
  'FMCG',
  'FMCG (GENERAL V4)',
  'FOOD PROCESSING',
  'FOOD PROCESSING (GENERAL V4)',
  'FOUNDRY',
  'FOUNDRY (GENERAL)',
  'GLASS',
  'GLASS(GENERAL V4)',
  'HOSPITALITY & WELLNESS',
  'HOSPITALITY & WELLNESS (GENERAL V4)',
  'INDIAN RAILWAYS(PRODUCTION UNIT)',
  'INDIAN RAILWAYS(WORKSHOP)',
  'IRON & STEEL',
  'IT & ITES',
  'IT & ITES (GENERAL V4)',
  'LEATHER',
  'LEATHER (GENERAL V4)',
  'METAL',
  'MINES(OPEN CAST)',
  'MINES(UNDER GROUND)',
  'MINING',
  'MINING (GENERAL V4)',
  'NON FERROUS METALS',
  'NON FERROUS METALS (GENERAL V4)',
  'OIL & GAS(COMPRESSOR)',
  'OIL & GAS(REFINERY)',
  'OIL MARKETING(AFS NEW)',
  'OIL MARKETING COMPANY(AFS)',
  'OIL MARKETING COMPANY(LPG BP)',
  'OIL MARKETING COMPANY(PIPELINE)',
  'OIL MARKETING COMPANY(TERMINAL/DEPOTS)',
  'OTHER MANUFACTURING SECTOR',
  'PAINT',
  'PAINT(GENERAL V4)',
  'PAPER',
  'PAPER (GENERAL V4)',
  'PETROCHEMICALS',
  'PETROCHEMICALS(GENERAL V4)',
  'PETROLEUM MARKETING',
  'PETROLEUM MARKETING(GENERAL V4)',
  'PORTS & SHIPPING',
  'PORTS & SHIPPING (GENERAL V4)',
  'POWER PLANT',
  'POWER PLANT (GENERAL V4)',
  'R & D',
  'R & D(GENERAL V4)',
  'RECYLERS',
  'RENEWABLE ENERGY',
  'RENEWABLE ENERGY(GENERAL V4)',
  'RENEWABLE ENERGY(HYDRO)',
  'RENEWABLE ENERGY(SOLAR)',
  'RENEWABLE ENERGY(WIND)',
  'SERVICE SECTOR',
  'SHIPPING',
  'SHIPPING (GENERAL V4)',
  'SME ( ONLY TURN OVER LESS THAN 50 CRORE)',
  'STEEL',
  'STEEL(GENERAL V4)',
  'TEXTILE(DYEING UNIT)',
  'TEXTILE(GARMENT)',
  'TEXTILE(SPINING UNIT)',
  'TYRE',
  'TYRE (GENERAL V4)',
  'WATCHES',
  'WATCHES(GENERAL V4)',
];

@Injectable()
export class RegistrationMastersService {
  private lastRegistrationMastersCache: {
    industries: Array<{ id: string; name: string }>;
    entities: Array<{ id: string; name: string }>;
    sectors: Array<{ id: string; name: string; group_name?: string }>;
    states: Array<{ id: string; name: string; code?: string }>;
    facilitators: Array<{ id: string; name: string }>;
  } | null = null;
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
    @InjectModel(Assessor.name)
    private readonly assessorModel: Model<AssessorDocument>,
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
      const [industriesFiltered, entitiesFiltered, sectorsFiltered, statesFiltered, facilitatorsFiltered] =
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
      let industries =
        industriesFiltered.length > 0
          ? industriesFiltered
          : await this.industryModel.find({}).sort({ name: 1 }).select('_id name').lean();

      // Registration form requirement: Industry dropdown should show only
      // MANUFACTURING and SERVICE (DB-backed values).
      const requiredIndustryNames = ['MANUFACTURING', 'SERVICE'];
      const industryByLower = new Map(
        industries.map((i: any) => [String(i.name || '').trim().toLowerCase(), i]),
      );
      const missingRequiredIndustries = requiredIndustryNames.filter(
        (name) => !industryByLower.has(name.toLowerCase()),
      );
      if (missingRequiredIndustries.length > 0) {
        await this.industryModel.insertMany(
          missingRequiredIndustries.map((name) => ({ name, status: '1' })),
          { ordered: false },
        );
        industries = await this.industryModel.find({}).sort({ name: 1 }).select('_id name').lean();
      }
      const preferredOrder = new Map(requiredIndustryNames.map((n, idx) => [n.toLowerCase(), idx]));
      industries = industries
        .filter((i: any) => preferredOrder.has(String(i.name || '').trim().toLowerCase()))
        .sort(
          (a: any, b: any) =>
            (preferredOrder.get(String(a.name || '').trim().toLowerCase()) ?? 999) -
            (preferredOrder.get(String(b.name || '').trim().toLowerCase()) ?? 999),
        );
      
      let entities =
        entitiesFiltered.length > 0
          ? entitiesFiltered
          : await this.entityModel.find({}).sort({ name: 1 }).select('_id name').lean();

      // Ensure required Type of Entity master values exist in DB (for registration dropdowns).
      // This keeps frontend values DB-driven while guaranteeing baseline options.
      const defaultEntities = (
        process.env.REGISTRATION_DEFAULT_ENTITIES ||
        'PRIVATE SECTOR,PUBLIC SECTOR,INDIAN RAILWAYS,OTHER GOVERNMENT ENTERPRISE,NOT FOR PROFIT'
      )
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);

      if (defaultEntities.length > 0) {
        const existingNames = new Set(
          entities.map((e: any) => String(e.name || '').trim().toLowerCase()),
        );
        const missingDefaults = defaultEntities.filter(
          (name) => !existingNames.has(name.toLowerCase()),
        );
        if (missingDefaults.length > 0) {
          await this.entityModel.insertMany(
            missingDefaults.map((name) => ({ name, status: '1' })),
            { ordered: false },
          );
          entities = await this.entityModel
            .find({})
            .sort({ name: 1 })
            .select('_id name')
            .lean();
        }
      }

      // Keep sectors independent from industries; read from sector master data in DB.
      let sectors =
        sectorsFiltered.length > 0
          ? sectorsFiltered
          : await this.sectorModel
              .find({})
              .sort({ group_name: 1, name: 1 })
              .select('_id name group_name')
              .lean();

      // Seed sector master from provided registration screenshots when missing in DB.
      const existingSectorNames = new Set(
        (sectors as any[]).map((s) => String(s?.name || '').trim().toLowerCase()),
      );
      const missingSectors = DEFAULT_SECTORS_FROM_IMAGES.filter(
        (name) => !existingSectorNames.has(name.toLowerCase()),
      );
      if (missingSectors.length > 0) {
        await this.sectorModel.insertMany(
          missingSectors.map((name) => ({ name })),
          { ordered: false },
        );
        sectors = await this.sectorModel
          .find({})
          .sort({ group_name: 1, name: 1 })
          .select('_id name group_name')
          .lean();
      }
      
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

      const responseData = {
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
      };

      // Keep last successful payload so UI can continue to work during transient DB outages.
      this.lastRegistrationMastersCache = responseData;

      return {
        status: 'success',
        message: 'Registration masters loaded successfully',
        data: responseData,
      };
    } catch (error) {
      console.error('Error loading registration masters:', error);

      // If DB is temporarily unavailable, return last known good payload.
      if (this.lastRegistrationMastersCache) {
        return {
          status: 'success',
          message: 'Registration masters loaded from cache (database temporarily unavailable)',
          data: this.lastRegistrationMastersCache,
        };
      }

      const defaultEntities = (
        process.env.REGISTRATION_DEFAULT_ENTITIES ||
        'PRIVATE SECTOR,PUBLIC SECTOR,INDIAN RAILWAYS,OTHER GOVERNMENT ENTERPRISE,NOT FOR PROFIT'
      )
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ id: name.toLowerCase().split(/\s+/).join('_'), name }));

      const defaultStates = INDIA_STATES_MASTER.map((s) => ({
        id: s.code,
        name: s.name,
        code: s.code,
      }));

      return {
        status: 'success',
        message: 'Registration masters loaded from fallback defaults (database unavailable)',
        data: {
          industries: [],
          entities: defaultEntities,
          sectors: [],
          states: defaultStates,
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

    // Build a map from DB first so DB entries override master list details.
    const byCodeOrName = new Map<string, { id: string; name: string; code?: string }>();
    for (const s of states as any[]) {
      const entry = {
        id: s._id.toString(),
        name: s.name,
        code: s.code || undefined,
      };
      if (entry.code) byCodeOrName.set(`code:${entry.code}`, entry);
      byCodeOrName.set(`name:${entry.name.toLowerCase()}`, entry);
    }

    // Ensure full Indian list is available even if DB has only a few states.
    for (const s of INDIA_STATES_MASTER) {
      const byCode = byCodeOrName.get(`code:${s.code}`);
      const byName = byCodeOrName.get(`name:${s.name.toLowerCase()}`);
      if (!byCode && !byName) {
        byCodeOrName.set(`code:${s.code}`, {
          id: s.code,
          name: s.name,
          code: s.code,
        });
      }
    }

    const dedup = new Map<string, { id: string; name: string; code?: string }>();
    for (const v of byCodeOrName.values()) {
      const key = (v.code || v.name).toLowerCase();
      if (!dedup.has(key)) dedup.set(key, v);
    }
    const fullStates = [...dedup.values()].sort((a, b) => a.name.localeCompare(b.name));

    return {
      status: 'success',
      message: 'States loaded',
      data: {
        states: fullStates,
      },
    };
  }

  /**
   * Get all categories (industry categories) for dropdowns.
   */
  async getAllCategories(): Promise<{
    status: 'success';
    message: string;
    data: { categories: Array<{ id: string; name: string }> };
  }> {
    const industriesFiltered = await this.industryModel
      .find({
        $or: [
          { status: 1 },
          { status: '1' },
          { status: { $exists: false } },
        ],
      })
      .sort({ name: 1 })
      .select('_id name')
      .lean();
    const industries =
      industriesFiltered.length > 0
        ? industriesFiltered
        : await this.industryModel.find({}).sort({ name: 1 }).select('_id name').lean();

    return {
      status: 'success',
      message: 'Categories loaded',
      data: {
        categories: (industries as any[]).map((i) => ({
          id: i._id.toString(),
          name: i.name,
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
    const groups = [...new Set(sectorList.map((s) => s.group_name).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
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

  /**
   * Get assessor grades for dropdown.
   * Reads from DB only (master grade collection if present, else assessor records).
   */
  async getAssessorGrades(): Promise<{
    status: 'success';
    message: string;
    data: { grades: Array<{ id: string; name: string }> };
  }> {
    const gradesMap = new Map<string, { id: string; name: string }>();

    const normalize = (v: unknown): string => {
      if (typeof v === 'string') return v.trim();
      if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
      if (v && typeof v === 'object' && typeof (v as any).toString === 'function') {
        const s = (v as any).toString().trim();
        if (s && s !== '[object Object]') return s;
      }
      return '';
    };

    const tryAdd = (rawId: unknown, rawName: unknown) => {
      const name = normalize(rawName);
      if (!name) return;
      const id = normalize(rawId) || name;
      const key = name.toLowerCase();
      if (!gradesMap.has(key)) gradesMap.set(key, { id, name });
    };

    // 1) Preferred: assessor_grades master collection.
    let masterGrades = await this.assessorGradeModel
      .find({
        $or: [{ status: 1 }, { status: '1' }, { status: { $exists: false } }],
      })
      .sort({ order: 1, name: 1 })
      .select('_id name')
      .lean();

    // Auto-seed once when collection is empty so dropdown has DB-backed values.
    if (masterGrades.length === 0) {
      const defaults = (process.env.ASSESSOR_GRADES_DEFAULT ||
        'Junior Assessor,Senior Assessor,Lead Assessor')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (defaults.length > 0) {
        await this.assessorGradeModel.insertMany(
          defaults.map((name, index) => ({ name, status: '1', order: index + 1 })),
          { ordered: false },
        );
      }
      masterGrades = await this.assessorGradeModel
        .find({
          $or: [{ status: 1 }, { status: '1' }, { status: { $exists: false } }],
        })
        .sort({ order: 1, name: 1 })
        .select('_id name')
        .lean();
    }

    for (const d of masterGrades as any[]) {
      tryAdd(d._id, d.name);
    }

    // 2) Fallback: distinct values from assessor records.
    if (gradesMap.size === 0) {
      const fieldCandidates = ['assessor_grade', 'grade'];
      for (const field of fieldCandidates) {
        const values = await this.assessorModel.distinct(field, {
          [field]: { $exists: true, $nin: [null, ''] },
        } as any);
        for (const v of values) {
          tryAdd(v, v);
        }
      }
    }

    const grades = [...gradesMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    return {
      status: 'success',
      message: 'Assessor grades loaded',
      data: { grades },
    };
  }
}


