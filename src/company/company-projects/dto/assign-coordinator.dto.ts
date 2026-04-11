import { Transform } from 'class-transformer';
import { Allow, IsOptional, IsString } from 'class-validator';

/** Accept id shapes from dropdowns / legacy clients (GET coordinators returns `id`). */
export function pickCoordinatorIdFromBody(obj: Record<string, unknown>): string | undefined {
  const rawValue = obj.value;
  let valueStr: string | undefined;
  if (rawValue != null && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const v = (rawValue as { value?: unknown }).value;
    if (v != null && String(v).trim()) valueStr = String(v).trim();
  }
  const candidates = [
    obj.coordinator_id,
    obj.id,
    obj.coordinatorId,
    obj.coordinator,
    obj.selectedCoordinator,
    obj.select_coordinator,
    valueStr ?? (typeof rawValue === 'string' || typeof rawValue === 'number' ? String(rawValue).trim() : undefined),
    obj.selectcoordinator,
  ];
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const s = String(c).trim();
    if (s && s !== '[object Object]') return s;
  }
  return undefined;
}

/**
 * Body is lenient: ids may be string or number; name/email are not validated here
 * (global forbidNonWhitelisted still requires declared keys — use @Allow for extras).
 */
export class AssignCoordinatorDto {
  @IsOptional()
  @Allow()
  id?: unknown;

  @IsOptional()
  @Allow()
  coordinatorId?: unknown;

  @IsOptional()
  @Allow()
  coordinator?: unknown;

  @IsOptional()
  @Allow()
  selectedCoordinator?: unknown;

  @IsOptional()
  @Allow()
  select_coordinator?: unknown;

  /** react-select often sends { label, value }; string id also allowed */
  @IsOptional()
  @Allow()
  value?: string | Record<string, unknown>;

  @IsOptional()
  @Allow()
  selectcoordinator?: unknown;

  @Transform(({ obj }) => pickCoordinatorIdFromBody(obj as Record<string, unknown>))
  @IsOptional()
  @IsString()
  coordinator_id?: string;

  @IsOptional()
  @Allow()
  name?: unknown;

  @IsOptional()
  @Allow()
  email?: unknown;

  /** Ignored; whitelisted so UI may send dropdown label text */
  @IsOptional()
  @Allow()
  label?: unknown;

  @IsOptional()
  @Allow()
  display?: unknown;
}
