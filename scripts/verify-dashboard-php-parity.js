/**
 * Dashboard PHP parity report (Nest vs internal consistency).
 *
 * Usage:
 *   node scripts/verify-dashboard-php-parity.js [year]
 *   node scripts/verify-dashboard-php-parity.js 2026 --php-json path/to/php-export.json
 *
 * Optional --php-json: object with same keys as printed `api` block for diff.
 */
require('dotenv').config();

const YEAR = Number.parseInt(process.argv[2] || '2026', 10);

function parsePhpJsonArg() {
  const idx = process.argv.indexOf('--php-json');
  if (idx === -1) return null;
  const p = process.argv[idx + 1];
  if (!p) return null;
  return require(require('path').resolve(p));
}

function diffKeys(api, php, prefix = '') {
  const mismatches = [];
  const keys = new Set([...Object.keys(api || {}), ...Object.keys(php || {})]);
  for (const k of [...keys].sort()) {
    const a = api[k];
    const b = php[k];
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      mismatches.push(...diffKeys(a, b, path));
      continue;
    }
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na !== nb) mismatches.push({ path, api: na, php: nb, delta: na - nb });
    } else if (String(a) !== String(b)) {
      mismatches.push({ path, api: a, php: b });
    }
  }
  return mismatches;
}

async function main() {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const {
    AdminGreencoDashboardService,
  } = require('../dist/company/company-projects/admin-greenco-dashboard.service');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const svc = app.get(AdminGreencoDashboardService);

  const [dashboard, overview, certDist, registration, enrollment] = await Promise.all([
    svc.getGreencoStatusDashboard({ year: YEAR }),
    svc.getCompanyStatusOverview({ year: YEAR }),
    svc.getCertificationDistribution({ year: YEAR }),
    svc.getRegistrationSummary({ year: YEAR }),
    svc.getEnrollmentSummary({ year: YEAR }),
  ]);

  const d = dashboard.data || {};
  const rows = overview.data?.rows || [];
  const dataRows = rows.filter((r) => r.row_key !== 'grand_total');
  const grand = rows.find((r) => r.row_key === 'grand_total');

  const sumCu = dataRows.reduce((s, r) => s + Number(r.total_cu || 0), 0);
  const sumCi = dataRows.reduce((s, r) => s + Number(r.total_ci || 0), 0);
  const checks = [];

  if (grand && sumCu !== grand.total_cu) {
    checks.push({
      check: 'grand_total.total_cu === sum(row total_cu)',
      ok: false,
      expected: sumCu,
      actual: grand.total_cu,
    });
  } else {
    checks.push({ check: 'grand_total.total_cu === sum(row total_cu)', ok: true });
  }

  if (grand && sumCi !== grand.total_ci) {
    checks.push({
      check: 'grand_total.total_ci === sum(row total_ci)',
      ok: false,
      expected: sumCi,
      actual: grand.total_ci,
    });
  } else {
    checks.push({ check: 'grand_total.total_ci === sum(row total_ci)', ok: true });
  }

  if (Number(d.grand_total_current) !== Number(grand?.total_cu)) {
    checks.push({
      check: 'dashboard.grand_total_current === overview.grand_total_current',
      ok: false,
      dashboard: d.grand_total_current,
      overview: grand?.total_cu,
    });
  } else {
    checks.push({
      check: 'dashboard.grand_total_current === overview.grand_total_current',
      ok: true,
    });
  }

  const reg = registration.data || {};
  const enr = enrollment.data || {};
  const regChecks = [];
  const enrChecks = [];
  if (Number(d.cii_company) !== Number(reg.cii_company)) {
    regChecks.push({ check: 'dashboard vs registration-summary cii_company', ok: false });
  } else {
    regChecks.push({ check: 'dashboard vs registration-summary cii_company', ok: true });
  }
  if (Number(d.total_companies) !== Number(reg.total_companies)) {
    regChecks.push({ check: 'dashboard vs registration-summary total_companies', ok: false });
  } else {
    regChecks.push({ check: 'dashboard vs registration-summary total_companies', ok: true });
  }
  if (
    Number(reg.cii_company) + Number(reg.facilitator_company) >
    Number(reg.yearly_registered_companies)
  ) {
    regChecks.push({
      check: 'cii + facilitator <= yearly_registered',
      ok: false,
      cii: reg.cii_company,
      fac: reg.facilitator_company,
      yearly: reg.yearly_registered_companies,
    });
  } else {
    regChecks.push({ check: 'cii + facilitator <= yearly_registered', ok: true });
  }

  if (
    Number(enr.yearly_only_registered_companies) !==
    Number(enr.yearly_registered_companies) - Number(enr.yearly_enrolled_companies)
  ) {
    enrChecks.push({
      check: 'only_registered = yearly_registered - enrolled',
      ok: false,
      only: enr.yearly_only_registered_companies,
      expected: Number(enr.yearly_registered_companies) - Number(enr.yearly_enrolled_companies),
    });
  } else {
    enrChecks.push({ check: 'only_registered = yearly_registered - enrolled', ok: true });
  }
  if (Number(d.yearly_enrolled_companies) !== Number(enr.yearly_enrolled_companies)) {
    enrChecks.push({ check: 'dashboard vs enrollment-summary enrolled', ok: false });
  } else {
    enrChecks.push({ check: 'dashboard vs enrollment-summary enrolled', ok: true });
  }

  const api = {
    year: YEAR,
    registration_cards: reg,
    enrollment_cards: enr,
    cii_company: d.cii_company,
    facilitator_company: d.facilitator_company,
    yearly_registered_companies: d.yearly_registered_companies,
    total_companies: d.total_companies,
    inactive_companies: d.inactive_companies,
    yearly_enrolled_companies: d.yearly_enrolled_companies,
    yearly_only_registered_companies: d.yearly_only_registered_companies,
    yearly_ratted_companies: d.yearly_ratted_companies,
    grand_total_current: d.grand_total_current,
    grand_total_carry: d.grand_total_carry,
    certification_chart_total: certDist.data?.total,
    status_table: Object.fromEntries(
      dataRows.map((r) => [
        r.row_key,
        { ci_ci: r.ci_ci, ci_cu: r.ci_cu, fac_ci: r.fac_ci, fac_cu: r.fac_cu, total_ci: r.total_ci, total_cu: r.total_cu },
      ]),
    ),
    status_table_grand_total: grand
      ? { ci_ci: grand.ci_ci, ci_cu: grand.ci_cu, fac_ci: grand.fac_ci, fac_cu: grand.fac_cu, total_ci: grand.total_ci, total_cu: grand.total_cu }
      : null,
  };

  const php = parsePhpJsonArg();
  const phpDiff = php ? diffKeys(api, php) : null;

  console.log(
    JSON.stringify(
      { api, internal_checks: checks, registration_checks: regChecks, enrollment_checks: enrChecks, php_diff: phpDiff },
      null,
      2,
    ),
  );

  const failed =
    checks.some((c) => !c.ok) ||
    regChecks.some((c) => !c.ok) ||
    enrChecks.some((c) => !c.ok) ||
    (phpDiff && phpDiff.length > 0);
  await app.close();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
