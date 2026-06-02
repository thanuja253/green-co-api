import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ChecklistVersion,
  ChecklistVersionDocument,
  ChecklistVersionStatus,
} from '../schemas/checklist-version.schema';
import { GroupManagement, GroupManagementDocument } from '../schemas/group-management.schema';
import {
  MasterChecklistSector,
  MasterChecklistSectorDocument,
} from '../schemas/master-checklist-sector.schema';
import {
  ParameterManagement,
  ParameterManagementDocument,
} from '../schemas/parameter-management.schema';
import {
  CompanyProject,
  CompanyProjectDocument,
} from '../schemas/company-project.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { Sector, SectorDocument } from '../schemas/sector.schema';
import { CreditManagement, CreditManagementDocument } from '../schemas/credit-management.schema';
import { CreateGroupChecklistVersionDto } from './dto/create-group-checklist-version.dto';
import { UpdateGroupChecklistVersionDto } from './dto/update-group-checklist-version.dto';

type AdminInfo = { sub?: string; name?: string };

@Injectable()
export class ChecklistVersioningService {
  constructor(
    @InjectModel(ChecklistVersion.name)
    private readonly versionModel: Model<ChecklistVersionDocument>,
    @InjectModel(GroupManagement.name)
    private readonly groupModel: Model<GroupManagementDocument>,
    @InjectModel(MasterChecklistSector.name)
    private readonly checklistSectorModel: Model<MasterChecklistSectorDocument>,
    @InjectModel(ParameterManagement.name)
    private readonly parameterModel: Model<ParameterManagementDocument>,
    @InjectModel(CompanyProject.name)
    private readonly projectModel: Model<CompanyProjectDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
    @InjectModel(CreditManagement.name)
    private readonly creditModel: Model<CreditManagementDocument>,
  ) {}

  private resolveGroupKey(groupId: string): string {
    return String(groupId || '').trim();
  }

  private async assertGroupExists(groupId: string) {
    const gid = this.resolveGroupKey(groupId);
    if (!Types.ObjectId.isValid(gid)) {
      throw new BadRequestException('Invalid group id');
    }
    const group = await this.groupModel.findById(gid).lean();
    if (!group) throw new NotFoundException('Group not found');
    return { group, gid };
  }

  private mapVersion(doc: any) {
    if (!doc) return null;
    const status = String(doc.status || 'draft').toLowerCase() as ChecklistVersionStatus;
    return {
      id: String(doc._id),
      group_id: doc.group_id || doc.checklist_id || '',
      version_code: doc.version_code || (doc.version != null ? `V${doc.version}` : ''),
      label: doc.label || doc.version_label || '',
      version: doc.version ?? null,
      version_label: doc.version_label || doc.label || '',
      checklist_document: doc.checklist_document || '',
      status,
      effective_from: doc.effective_from || null,
      effective_until: doc.effective_until || null,
      change_notes: doc.change_notes || '',
      created_by: doc.created_by || '',
      created_by_name: doc.created_by_name || '',
      created_at: doc.createdAt || null,
      updated_at: doc.updatedAt || null,
    };
  }

  private async nextVersionCode(groupId: string): Promise<{ code: string; number: number }> {
    const latest = await this.versionModel
      .findOne({ group_id: groupId })
      .sort({ version: -1 })
      .lean();
    const n = latest?.version != null ? Number(latest.version) + 1 : 1;
    return { code: `V${n}`, number: n };
  }

  /** Create V1 (active) when a group is created — idempotent. */
  async ensureInitialVersionForGroup(
    groupId: string,
    checklistDocument?: string,
    adminInfo?: AdminInfo,
  ) {
    const { gid, group } = await this.assertGroupExists(groupId);
    const existing = await this.versionModel
      .findOne({ group_id: gid, status: 'active' })
      .lean();
    if (existing) {
      return {
        status: 'success',
        message: 'Active checklist version already exists',
        data: this.mapVersion(existing),
      };
    }

    const any = await this.versionModel.findOne({ group_id: gid }).lean();
    if (any) {
      return {
        status: 'success',
        message: 'Checklist version already exists for group',
        data: this.mapVersion(any),
      };
    }

    const docPath = checklistDocument || (group as any).sample_document || '';
    const created = await this.versionModel.create({
      group_id: gid,
      checklist_id: gid,
      version: 1,
      version_code: 'V1',
      label: 'Version 1',
      version_label: 'Version 1',
      checklist_document: docPath,
      checklist_data: {},
      status: 'active',
      effective_from: new Date(),
      created_by: adminInfo?.sub || 'system',
      created_by_name: adminInfo?.name || 'System',
      change_notes: 'Initial version created with group',
    });

    await this.linkLegacyParametersToVersion(gid, String(created._id));

    return {
      status: 'success',
      message: 'Initial checklist version V1 created',
      data: this.mapVersion(created.toObject()),
    };
  }

  /** Map existing group-level parameter links (no version) to V1. */
  private async linkLegacyParametersToVersion(groupId: string, versionId: string) {
    await this.checklistSectorModel.updateMany(
      {
        group_id: groupId,
        $or: [
          { checklist_version_id: { $exists: false } },
          { checklist_version_id: null },
          { checklist_version_id: '' },
        ],
      },
      { $set: { checklist_version_id: versionId } },
    );
  }

  async listVersionsForGroup(groupId: string) {
    const { gid } = await this.assertGroupExists(groupId);
    const versions = await this.versionModel
      .find({ $or: [{ group_id: gid }, { checklist_id: gid }] })
      .sort({ version: 1 })
      .lean();
    return {
      status: 'success',
      message: 'Checklist versions fetched',
      data: versions.map((v) => this.mapVersion(v)),
    };
  }

  async getVersion(groupId: string, versionId: string) {
    const { gid } = await this.assertGroupExists(groupId);
    const version = await this.versionModel.findById(versionId).lean();
    if (!version) throw new NotFoundException('Checklist version not found');
    const vGroup = String(version.group_id || version.checklist_id || '');
    if (vGroup !== gid) {
      throw new NotFoundException('Checklist version does not belong to this group');
    }
    return {
      status: 'success',
      data: this.mapVersion(version),
    };
  }

  async getActiveVersionForGroup(groupId: string) {
    const { gid } = await this.assertGroupExists(groupId);
    const version = await this.versionModel
      .findOne({
        $or: [{ group_id: gid }, { checklist_id: gid }],
        status: 'active',
      })
      .sort({ version: -1 })
      .lean();
    if (!version) {
      throw new NotFoundException('No active checklist version for this group');
    }
    return {
      status: 'success',
      data: this.mapVersion(version),
    };
  }

  async createVersion(
    groupId: string,
    dto: CreateGroupChecklistVersionDto,
    adminInfo?: AdminInfo,
  ) {
    const { gid, group } = await this.assertGroupExists(groupId);

    if (dto.clone_from_version_id) {
      return this.cloneVersion(groupId, dto.clone_from_version_id, dto, adminInfo);
    }

    const { code, number } = await this.nextVersionCode(gid);
    const created = await this.versionModel.create({
      group_id: gid,
      checklist_id: gid,
      version: number,
      version_code: code,
      label: dto.label || code,
      version_label: dto.label || code,
      checklist_document: (group as any).sample_document || '',
      checklist_data: {},
      status: 'draft',
      created_by: adminInfo?.sub || 'admin',
      created_by_name: adminInfo?.name || 'Admin',
      change_notes: dto.change_notes || '',
    });

    return {
      status: 'success',
      message: `Checklist version ${code} created as draft`,
      data: this.mapVersion(created.toObject()),
    };
  }

  async cloneVersion(
    groupId: string,
    sourceVersionId: string,
    dto: CreateGroupChecklistVersionDto,
    adminInfo?: AdminInfo,
  ) {
    const { gid } = await this.assertGroupExists(groupId);
    const source = await this.versionModel.findById(sourceVersionId).lean();
    if (!source) throw new NotFoundException('Source checklist version not found');
    const srcGroup = String(source.group_id || source.checklist_id || '');
    if (srcGroup !== gid) {
      throw new BadRequestException('Source version does not belong to this group');
    }

    const { code, number } = await this.nextVersionCode(gid);
    const created = await this.versionModel.create({
      group_id: gid,
      checklist_id: gid,
      version: number,
      version_code: code,
      label: dto.label || `${source.label || source.version_label || code} (copy)`,
      version_label: dto.label || `${source.version_label || code} (copy)`,
      checklist_document: source.checklist_document || '',
      checklist_data: source.checklist_data || {},
      status: 'draft',
      created_by: adminInfo?.sub || 'admin',
      created_by_name: adminInfo?.name || 'Admin',
      change_notes: dto.change_notes || `Cloned from ${source.version_code || source.version}`,
    });

    const newVersionId = String(created._id);
    const mappings = await this.checklistSectorModel
      .find({ group_id: gid, checklist_version_id: sourceVersionId })
      .lean();

    if (mappings.length) {
      await this.checklistSectorModel.insertMany(
        mappings.map((m) => ({
          criterian_id: m.criterian_id,
          group_id: gid,
          checklist_version_id: newVersionId,
          sector_id: (m as any).sector_id,
          from_date: new Date(),
        })),
        { ordered: false },
      );
    }

    const credits = await this.creditModel
      .find({ group_id: gid, checklist_version_id: sourceVersionId })
      .lean();
    for (const c of credits) {
      const base = String(c.credit_number || '').trim();
      const suffix = `-${code}`;
      let creditNumber = base.endsWith(suffix) ? base : `${base}${suffix}`;
      let attempt = 0;
      while (await this.creditModel.exists({ credit_number: creditNumber })) {
        attempt += 1;
        creditNumber = `${base}${suffix}-${attempt}`;
      }
      await this.creditModel.create({
        checklist_criteria: c.checklist_criteria,
        credit_main_heading: c.credit_main_heading,
        credit_number: creditNumber,
        parameter: c.parameter,
        max_score: c.max_score,
        requirements: c.requirements,
        status: c.status,
        group_id: gid,
        checklist_version_id: newVersionId,
      });
    }

    return {
      status: 'success',
      message: `Version ${code} cloned from ${source.version_code || source.version}`,
      data: this.mapVersion(created.toObject()),
    };
  }

  async updateVersion(
    groupId: string,
    versionId: string,
    dto: UpdateGroupChecklistVersionDto,
  ) {
    const { gid } = await this.assertGroupExists(groupId);
    const existing = await this.versionModel.findById(versionId);
    if (!existing) throw new NotFoundException('Checklist version not found');
    if (String(existing.group_id || existing.checklist_id) !== gid) {
      throw new NotFoundException('Checklist version does not belong to this group');
    }
    if (String(existing.status).toLowerCase() !== 'draft') {
      throw new BadRequestException('Only draft versions can be edited. Clone or create a new version.');
    }

    if (dto.label !== undefined) {
      existing.label = dto.label;
      existing.version_label = dto.label;
    }
    if (dto.change_notes !== undefined) existing.change_notes = dto.change_notes;
    if (dto.checklist_document !== undefined) existing.checklist_document = dto.checklist_document;
    await existing.save();

    return {
      status: 'success',
      message: 'Checklist version updated',
      data: this.mapVersion(existing.toObject()),
    };
  }

  async activateVersion(groupId: string, versionId: string) {
    const { gid } = await this.assertGroupExists(groupId);
    const target = await this.versionModel.findById(versionId);
    if (!target) throw new NotFoundException('Checklist version not found');
    if (String(target.group_id || target.checklist_id) !== gid) {
      throw new NotFoundException('Checklist version does not belong to this group');
    }
    if (String(target.status).toLowerCase() === 'active') {
      return {
        status: 'success',
        message: 'Version is already active',
        data: this.mapVersion(target.toObject()),
      };
    }
    if (String(target.status).toLowerCase() !== 'draft') {
      throw new BadRequestException('Only draft versions can be activated');
    }

    const now = new Date();
    await this.versionModel.updateMany(
      {
        $or: [{ group_id: gid }, { checklist_id: gid }],
        status: 'active',
        _id: { $ne: target._id },
      },
      { $set: { status: 'archived', effective_until: now } },
    );

    target.status = 'active';
    target.effective_from = now;
    target.effective_until = undefined;
    await target.save();

    return {
      status: 'success',
      message: `${target.version_code || target.version} is now the active checklist version`,
      data: this.mapVersion(target.toObject()),
    };
  }

  async archiveVersion(groupId: string, versionId: string) {
    const { gid } = await this.assertGroupExists(groupId);
    const version = await this.versionModel.findById(versionId);
    if (!version) throw new NotFoundException('Checklist version not found');
    if (String(version.group_id || version.checklist_id) !== gid) {
      throw new NotFoundException('Checklist version does not belong to this group');
    }
    if (String(version.status).toLowerCase() === 'active') {
      throw new BadRequestException(
        'Cannot archive the active version. Activate another version first.',
      );
    }

    version.status = 'archived';
    version.effective_until = new Date();
    await version.save();

    return {
      status: 'success',
      message: 'Checklist version archived',
      data: this.mapVersion(version.toObject()),
    };
  }

  async listVersionParameters(groupId: string, versionId: string) {
    const { gid } = await this.assertGroupExists(groupId);
    await this.getVersion(groupId, versionId);

    const links = await this.checklistSectorModel
      .find({ group_id: gid, checklist_version_id: versionId })
      .lean();
    const criteriaIds = [...new Set(links.map((l) => String(l.criterian_id)))];
    const parameters = criteriaIds.length
      ? await this.parameterModel.find({ _id: { $in: criteriaIds } }).lean()
      : [];

    return {
      status: 'success',
      message: 'Version parameters fetched',
      data: {
        version_id: versionId,
        group_id: gid,
        parameters: parameters.map((p) => ({
          id: String(p._id),
          name: p.name,
          short_name: p.short_name,
          status: p.status,
        })),
        links_count: links.length,
      },
    };
  }

  async listVersionCredits(groupId: string, versionId: string) {
    const { gid } = await this.assertGroupExists(groupId);
    await this.getVersion(groupId, versionId);

    const credits = await this.creditModel
      .find({ group_id: gid, checklist_version_id: versionId })
      .sort({ createdAt: -1 })
      .lean();

    return {
      status: 'success',
      data: credits.map((c) => ({
        id: String(c._id),
        checklist_criteria: c.checklist_criteria,
        credit_main_heading: c.credit_main_heading,
        credit_number: c.credit_number,
        parameter: c.parameter,
        max_score: c.max_score,
        requirements: c.requirements,
        status: c.status,
      })),
    };
  }

  /** Assign group's active version to project and lock (SOW pinning). */
  async pinActiveVersionToProject(projectId: string, force = false) {
    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');

    if ((project as any).version_locked && (project as any).checklist_version_id && !force) {
      throw new BadRequestException({
        status: 'error',
        message: 'Checklist version is locked for this project',
        code: 'VERSION_LOCKED',
        checklist_version_id: (project as any).checklist_version_id,
      });
    }

    const company = await this.companyModel
      .findById((project as any).company_id)
      .select('mst_sector_id')
      .lean();
    const sectorId = company?.mst_sector_id;
    let groupId: string | null = null;
    if (sectorId) {
      const sector = await this.sectorModel.findById(sectorId).select('group_name').lean();
      const groupName = sector?.group_name;
      if (groupName) {
        const group = await this.groupModel
          .findOne({ name: new RegExp(`^${String(groupName).trim()}$`, 'i') })
          .lean();
        if (group) groupId = String((group as any)._id);
      }
    }

    if (!groupId) {
      throw new BadRequestException(
        'Could not resolve group for project. Ensure company sector has group_name.',
      );
    }

    const active = await this.getActiveVersionForGroup(groupId);
    const version = active.data;

    (project as any).checklist_version_id = version.id;
    (project as any).checklist_version_number = version.version;
    (project as any).version_locked = true;
    await project.save();

    return {
      status: 'success',
      message: 'Active checklist version assigned and locked',
      data: {
        project_id: projectId,
        group_id: groupId,
        checklist_version_id: version.id,
        version_code: version.version_code,
        version_locked: true,
      },
    };
  }

  async getProjectChecklistVersion(projectId: string) {
    const project = await this.projectModel.findById(projectId).lean();
    if (!project) throw new NotFoundException('Project not found');
    const versionId = (project as any).checklist_version_id;
    if (!versionId) {
      return {
        status: 'success',
        data: {
          project_id: projectId,
          checklist_version_id: null,
          version_locked: !!(project as any).version_locked,
          version: null,
        },
      };
    }
    const version = await this.versionModel.findById(versionId).lean();
    return {
      status: 'success',
      data: {
        project_id: projectId,
        checklist_version_id: versionId,
        version_locked: !!(project as any).version_locked,
        version: version ? this.mapVersion(version) : null,
      },
    };
  }

  /** SOW migration: V1 per group + backfill projects. */
  async runBackfillMigration() {
    const groups = await this.groupModel.find({}).lean();
    let versionsCreated = 0;
    let projectsUpdated = 0;

    for (const g of groups) {
      const gid = String(g._id);
      const res = await this.ensureInitialVersionForGroup(gid, (g as any).sample_document);
      if (res.message.includes('V1 created') || res.message.includes('Initial')) {
        versionsCreated += 1;
      }
      const activeId = res.data.id;

      const sectors = await this.sectorModel
        .find({ group_name: (g as any).name })
        .select('_id')
        .lean();
      const sectorIds = sectors.map((s) => (s as any)._id);
      if (!sectorIds.length) continue;

      const companies = await this.companyModel
        .find({ mst_sector_id: { $in: sectorIds } })
        .select('_id')
        .lean();
      const companyIds = companies.map((c) => (c as any)._id);

      const result = await this.projectModel.updateMany(
        {
          company_id: { $in: companyIds },
          $or: [
            { checklist_version_id: { $exists: false } },
            { checklist_version_id: null },
            { checklist_version_id: '' },
          ],
        },
        {
          $set: {
            checklist_version_id: activeId,
            checklist_version_number: 1,
            version_locked: true,
          },
        },
      );
      projectsUpdated += result.modifiedCount || 0;
    }

    return {
      status: 'success',
      message: 'Checklist version backfill completed',
      data: {
        groups_processed: groups.length,
        versions_ensured: versionsCreated,
        projects_backfilled: projectsUpdated,
      },
    };
  }
}
