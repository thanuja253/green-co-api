import { Transform } from 'class-transformer';
import { Allow, IsEmail, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

/** Accept id shapes from dropdowns / legacy clients (GET coordinators returns `id`). */
function pickCoordinatorIdFromBody(obj: Record<string, unknown>): string | undefined {
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
 * Either coordinator master id (several field aliases) or both name + email
 * (lookup by email or create master, then assign).
 *
 * Note: Global ValidationPipe uses forbidNonWhitelisted — every accepted body key
 * must be declared here (including `id` from the coordinators list API).
 */
export class AssignCoordinatorDto {
  /** Whitelisted aliases merged into coordinator_id via @Transform below. */
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  coordinatorId?: string;

  /** react-select often sends { label, value }; string id also allowed */
  @IsOptional()
  @Allow()
  value?: string | Record<string, unknown>;

  @IsOptional()
  @IsString()
  selectcoordinator?: string;

  @Transform(({ obj }) => pickCoordinatorIdFromBody(obj as Record<string, unknown>))
  @IsOptional()
  @IsString()
  coordinator_id?: string;

  @ValidateIf((o) => !String(o.coordinator_id ?? '').trim())
  @IsNotEmpty({ message: 'name must be provided when coordinator_id is not set' })
  @IsString()
  name?: string;

  @ValidateIf((o) => !String(o.coordinator_id ?? '').trim())
  @IsNotEmpty({ message: 'email must be provided when coordinator_id is not set' })
  @IsEmail()
  email?: string;
}
