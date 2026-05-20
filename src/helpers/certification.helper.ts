/**
 * Certification level from percentage score (GreenCo Scoreband / View Certificate).
 * Ranges: Certified ≥35–45%, Bronze 45–55%, Silver 55–65%, Gold 65–75%, Platinum 75–85%, Platinum+ ≥85%.
 * Matches Laravel app/helpers/helpers.php getCertificationType().
 */
export function getCertificationType(percentage: number): string {
  if (percentage >= 85) return 'Platinum+';
  if (percentage >= 75) return 'Platinum';
  if (percentage >= 65) return 'Gold';
  if (percentage >= 55) return 'Silver';
  if (percentage >= 45) return 'Bronze';
  if (percentage >= 35) return 'Certified';
  return 'Below Certified';
}

/** Certification bands for UI (LEVEL vs percentage range). */
export const CERTIFICATION_BANDS = [
  { level: 'Certified', range: '≥35–45%', min: 35, max: 45 },
  { level: 'Bronze', range: '45–55%', min: 45, max: 55 },
  { level: 'Silver', range: '55–65%', min: 55, max: 65 },
  { level: 'Gold', range: '65–75%', min: 65, max: 75 },
  { level: 'Platinum', range: '75–85%', min: 75, max: 85 },
  { level: 'Platinum+', range: '≥85%', min: 85, max: 100 },
] as const;

/** PHP dashboard chart order (legacy_data + certification_data). */
export const CERTIFICATION_CHART_ORDER = [
  'First Certified',
  'Certified',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Platinum+',
] as const;

const CERT_LABEL_ALIASES: Record<string, (typeof CERTIFICATION_CHART_ORDER)[number]> = {
  'first certified': 'First Certified',
  certified: 'Certified',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  'platinum+': 'Platinum+',
  'platinum plus': 'Platinum+',
};

/**
 * Map raw DB label to a canonical certification level for charts.
 * Returns null for invalid/test values (e.g. "23", "gijnj") so they are not shown as rating names.
 */
export function normalizeCertificationLevelLabel(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  const lower = s.toLowerCase().replace(/\s+/g, ' ');
  const alias = CERT_LABEL_ALIASES[lower];
  if (alias) return alias;

  for (const level of CERTIFICATION_CHART_ORDER) {
    if (level.toLowerCase() === lower) return level;
  }

  // Numeric-only strings are activity ids / junk, not rating names (e.g. "23").
  if (/^\d+(\.\d+)?$/.test(s)) return null;

  // Score percentage stored as label by mistake (35–100 → band name).
  const asNum = Number(s);
  if (Number.isFinite(asNum) && asNum >= 35 && asNum <= 100) {
    const band = getCertificationType(asNum);
    return band === 'Below Certified' ? null : band;
  }

  return null;
}

export function sortCertificationChartItems<T extends { level: string }>(items: T[]): T[] {
  const orderIndex = new Map(CERTIFICATION_CHART_ORDER.map((l, i) => [l, i]));
  return [...items].sort((a, b) => {
    const ai = orderIndex.get(a.level as (typeof CERTIFICATION_CHART_ORDER)[number]) ?? 999;
    const bi = orderIndex.get(b.level as (typeof CERTIFICATION_CHART_ORDER)[number]) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.level.localeCompare(b.level);
  });
}
