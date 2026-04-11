/**
 * Registration form may arrive as flat multipart, nested JSON, or camelCase (React).
 * Coalesce into snake_case keys used by the API and MongoDB registration_info.
 */

const CAMEL_TO_SNAKE: readonly [string, string][] = [
  ['industryId', 'industry_id'],
  ['entityId', 'entity_id'],
  ['sectorId', 'sector_id'],
  ['stateId', 'state_id'],
  ['plantAddress', 'plant_address'],
  ['plantPincode', 'plant_pincode'],
  ['billingAddress', 'billing_address'],
  ['billingPincode', 'billing_pincode'],
  ['isSez', 'is_sez'],
  ['employeesCount', 'employees_count'],
  ['permanentEmployees', 'permanent_employees'],
  ['contractEmployees', 'contract_employees'],
  ['totalArea', 'total_area'],
  ['plantHeadName', 'plant_head_name'],
  ['plantHeadDesignation', 'plant_head_designation'],
  ['plantHeadEmail', 'plant_head_email'],
  ['plantHeadMobile', 'plant_head_mobile'],
  ['panNumber', 'pan_number'],
  ['gstinNo', 'gstin_no'],
  ['tanNo', 'tan_no'],
  ['cinNumber', 'cin_number'],
  ['registrationNumber', 'registration_number'],
  ['contactPersonName', 'contact_person_name'],
  ['contactPersonEmail', 'contact_person_email'],
  ['contactPersonMobile', 'contact_person_mobile'],
  ['productsServices', 'products_services'],
  ['productsManufactured', 'products_services'],
  ['plantContactNo', 'plant_contact_no'],
  ['contactNumber', 'contact_number'],
];

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

/** Copy camelCase values into snake_case when snake is empty (mutates obj). */
export function coalesceRegistrationSnakeCase(obj: Record<string, any>): void {
  if (!obj || typeof obj !== 'object') return;
  for (const [camel, snake] of CAMEL_TO_SNAKE) {
    if (!isEmptyValue(obj[snake])) continue;
    if (!isEmptyValue(obj[camel])) {
      obj[snake] = obj[camel];
    }
  }
}

/** True when the camelCase slot is unset / blank (booleans: only undefined/null count as empty). */
function registrationCamelSlotEmpty(obj: Record<string, any>, camel: string): boolean {
  const c = obj[camel];
  if (c === undefined || c === null) return true;
  if (typeof c === 'string' && c.trim() === '') return true;
  return false;
}

/**
 * GET response: many React forms bind `plantHeadName` while DB/API use `plant_head_name`.
 * Fill camelCase from snake_case when camel is still empty (mutates obj).
 */
export function mirrorRegistrationSnakeToCamel(obj: Record<string, any>): void {
  if (!obj || typeof obj !== 'object') return;
  for (const [camel, snake] of CAMEL_TO_SNAKE) {
    if (registrationCamelSlotEmpty(obj, camel) && !isEmptyValue(obj[snake])) {
      obj[camel] = obj[snake];
    }
  }
  if (registrationCamelSlotEmpty(obj, 'companyName') && !isEmptyValue(obj.company_name)) {
    obj.companyName = obj.company_name;
  }
  if (registrationCamelSlotEmpty(obj, 'companyEmail') && !isEmptyValue(obj.company_email)) {
    obj.companyEmail = obj.company_email;
  }
  if (
    registrationCamelSlotEmpty(obj, 'isSez') &&
    obj.is_sez !== undefined &&
    obj.is_sez !== null
  ) {
    obj.isSez = Boolean(obj.is_sez);
  }
}

/**
 * Merge nested objects often sent by admin/SPA: registration_info, payload, data.
 * Mutates a shallow copy; returns merged flat body (file placeholders may remain).
 */
export function mergeNestedRegistrationBody(body: Record<string, any>): Record<string, any> {
  if (!body || typeof body !== 'object') return {};
  const b = { ...body };
  const nestedSources = [b.registration_info, b.payload, b.data].filter(
    (x) => x && typeof x === 'object' && !Array.isArray(x),
  ) as Record<string, any>[];
  for (const n of nestedSources) {
    Object.assign(b, n);
  }
  delete b.registration_info;
  delete b.payload;
  delete b.data;
  return b;
}

/** Accept ObjectId/stringified JSON/plain object shapes from Mongo. */
export function parseRegistrationInfoRaw(raw: unknown): Record<string, any> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return {};
    try {
      const p = JSON.parse(t);
      return p && typeof p === 'object' && !Array.isArray(p) ? { ...p } : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    try {
      return JSON.parse(JSON.stringify(raw)) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Read path: Mongo may still hold `{ payload: {...} }` / `{ registration_info: {...} }` from older clients.
 * Lift nested form fields to the top level so GET registration-info matches save/flatten behavior.
 */
export function flattenStoredRegistrationInfo(input: Record<string, any>): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  let cur: Record<string, any> = { ...input };
  for (let depth = 0; depth < 8; depth++) {
    const nests = [
      cur.payload,
      cur.registration_info,
      cur.data,
      cur.form,
      cur.form_data,
      cur.formData,
      cur.values,
      cur.registration,
      cur.registrationData,
    ].filter((x) => x && typeof x === 'object' && !Array.isArray(x)) as Record<string, any>[];
    if (!nests.length) break;
    const {
      payload: _p,
      registration_info: _r,
      data: _d,
      form: _f,
      form_data: _fd,
      formData: _fD,
      values: _v,
      registration: _rg,
      registrationData: _rD,
      ...rest
    } = cur;
    cur = { ...rest };
    for (const n of nests) {
      Object.assign(cur, n);
    }
  }
  return cur;
}

/** Parse + flatten + camel→snake (single read-path normalizer). */
export function normalizeRegistrationInfoFromDb(raw: unknown): Record<string, any> {
  const obj = parseRegistrationInfoRaw(raw);
  const flat = flattenStoredRegistrationInfo(obj);
  coalesceRegistrationSnakeCase(flat);
  return flat;
}

export function registrationInfoFillScore(raw: unknown): number {
  return countFilledRegistrationFields(normalizeRegistrationInfoFromDb(raw));
}

/** Count non-empty keys in registration_info (for choosing the best project). */
export function countFilledRegistrationFields(ri: Record<string, any> | null | undefined): number {
  if (!ri || typeof ri !== 'object') return 0;
  let n = 0;
  for (const [k, v] of Object.entries(ri)) {
    if (k.startsWith('_')) continue;
    if (isEmptyValue(v)) continue;
    if (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0) {
      continue;
    }
    n++;
  }
  return n;
}

/**
 * When the URL id is a company_id, multiple projects may exist (e.g. recertification).
 * Prefer the project that actually has registration data / profile_update.
 */
function launchTrainingScore(p: any): number {
  if (!p) return 0;
  const doc = !!(p.launch_training_document && String(p.launch_training_document).trim());
  const sess =
    Array.isArray(p.launch_training_sessions) &&
    p.launch_training_sessions.some((s: any) => s && String(s.document_path || '').trim());
  return doc || sess ? 1 : 0;
}

export function pickBestProjectForRegistration(projects: any[]): any | null {
  if (!projects?.length) return null;
  return [...projects].sort((a, b) => {
    const la = launchTrainingScore(a);
    const lb = launchTrainingScore(b);
    if (la !== lb) return lb - la;
    const na = Number(a?.next_activities_id || 0);
    const nb = Number(b?.next_activities_id || 0);
    if (na !== nb) return nb - na;
    const pua = a.profile_update === 1 ? 1 : 0;
    const pub = b.profile_update === 1 ? 1 : 0;
    if (pua !== pub) return pub - pua;
    const fa = registrationInfoFillScore(a.registration_info);
    const fb = registrationInfoFillScore(b.registration_info);
    if (fa !== fb) return fb - fa;
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  })[0];
}
