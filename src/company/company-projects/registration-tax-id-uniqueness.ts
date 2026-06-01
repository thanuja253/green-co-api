import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import type { CompanyProjectDocument } from '../schemas/company-project.schema';

export type RegistrationTaxIdField = 'pan' | 'gstin' | 'tan';

const PAN_KEYS = ['pan_number', 'pan_no', 'pan'] as const;
const GSTIN_KEYS = ['gstin', 'gstin_no'] as const;
const TAN_KEYS = ['tan_no', 'tan'] as const;

export function normalizeRegistrationTaxId(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function taxIdRegex(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value)}$`, 'i');
}

function buildRegistrationInfoOr(keys: readonly string[], value: string): Record<string, RegExp>[] {
  return keys.map((key) => ({ [`registration_info.${key}`]: taxIdRegex(value) }));
}

export type RegistrationTaxIdConflict = {
  field: RegistrationTaxIdField;
  message: string;
  errorKey: string;
};

/**
 * PAN / GSTIN / TAN must be unique across companies (other projects with a different company_id).
 * Same company may reuse identifiers on recertification or additional projects.
 */
export async function findRegistrationTaxIdConflicts(
  projectModel: Model<CompanyProjectDocument>,
  options: {
    excludeProjectId: string;
    excludeCompanyId: string;
    pan?: string;
    gstin?: string;
    tan?: string;
  },
): Promise<RegistrationTaxIdConflict[]> {
  const excludeProjectId = String(options.excludeProjectId || '').trim();
  const excludeCompanyId = String(options.excludeCompanyId || '').trim();
  if (!excludeProjectId || !Types.ObjectId.isValid(excludeProjectId)) {
    return [];
  }

  const baseFilter: Record<string, unknown> = {
    _id: { $ne: new Types.ObjectId(excludeProjectId) },
  };
  if (excludeCompanyId && Types.ObjectId.isValid(excludeCompanyId)) {
    baseFilter.company_id = { $ne: new Types.ObjectId(excludeCompanyId) };
  }

  const checks: Array<{
    field: RegistrationTaxIdField;
    value: string;
    keys: readonly string[];
    errorKey: string;
    label: string;
  }> = [
    {
      field: 'pan',
      value: normalizeRegistrationTaxId(options.pan),
      keys: PAN_KEYS,
      errorKey: 'pan_no',
      label: 'PAN',
    },
    {
      field: 'gstin',
      value: normalizeRegistrationTaxId(options.gstin),
      keys: GSTIN_KEYS,
      errorKey: 'gstin_no',
      label: 'GSTIN',
    },
    {
      field: 'tan',
      value: normalizeRegistrationTaxId(options.tan),
      keys: TAN_KEYS,
      errorKey: 'tan_no',
      label: 'TAN',
    },
  ];

  const conflicts: RegistrationTaxIdConflict[] = [];

  for (const check of checks) {
    if (!check.value) continue;
    const existing = await projectModel
      .findOne({
        ...baseFilter,
        $or: buildRegistrationInfoOr(check.keys, check.value),
      })
      .select('_id company_id')
      .lean();
    if (existing) {
      conflicts.push({
        field: check.field,
        message: `${check.label} already exists`,
        errorKey: check.errorKey,
      });
    }
  }

  return conflicts;
}

export function throwIfRegistrationTaxIdConflicts(conflicts: RegistrationTaxIdConflict[]): void {
  if (!conflicts.length) return;
  const errors: Record<string, string> = {};
  for (const c of conflicts) {
    errors[c.errorKey] = c.message;
  }
  throw new BadRequestException({
    status: 'error',
    message: conflicts.map((c) => c.message).join('. '),
    errors,
  });
}

export function extractRegistrationTaxIdsFromDto(dto: Record<string, unknown>): {
  pan?: string;
  gstin?: string;
  tan?: string;
} {
  const pan =
    dto.pan_number ?? dto.pan_no ?? dto.pan ?? dto.panNumber;
  const gstin = dto.gstin ?? dto.gstin_no ?? dto.gstinNo;
  const tan = dto.tan_no ?? dto.tan ?? dto.tanNo;
  return {
    pan: pan != null && String(pan).trim() ? String(pan) : undefined,
    gstin: gstin != null && String(gstin).trim() ? String(gstin) : undefined,
    tan: tan != null && String(tan).trim() ? String(tan) : undefined,
  };
}
