/**
 * Backfill fields for PHP dashboard parity:
 * - companies.assessment_through from first companyprojects.process_type (c→cii, f→facilitator)
 * - companies without a project: default assessment_through = 'cii' (so yearly = cii + fac counts)
 * - legacydatas.level_of_certification: fix numeric/junk test values to Bronze/Silver
 * - companyactivities.activity_status from description
 *
 * Usage: node scripts/backfill-dashboard-php-parity.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const VALID_CERT_LEVELS = new Set([
  'first certified',
  'certified',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'platinum+',
  'platinum plus',
]);

function isValidCertLevel(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return false;
  if (/^\d+(\.\d+)?$/.test(s)) return false;
  return VALID_CERT_LEVELS.has(s) || /bronze|silver|gold|platinum|certified/i.test(s);
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!uri) {
    console.error('Set MONGODB_URI or DATABASE_URL');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const companies = db.collection('companies');
  const projects = db.collection('companyprojects');
  const activities = db.collection('companyactivities');
  const legacy = db.collection('legacydatas');

  const needsThrough = await companies
    .find({
      $or: [
        { assessment_through: { $exists: false } },
        { assessment_through: null },
        { assessment_through: '' },
        { assessment_through: { $nin: ['cii', 'facilitator'] } },
      ],
    })
    .project({ _id: 1, assessment_through: 1 })
    .toArray();

  let throughUpdated = 0;
  let throughDefaulted = 0;
  for (const c of needsThrough) {
    const proj = await projects.findOne({ company_id: c._id }, { sort: { createdAt: 1 } });
    let channel = 'cii';
    if (proj) {
      channel = String(proj.process_type || 'c').toLowerCase() === 'f' ? 'facilitator' : 'cii';
    } else {
      throughDefaulted += 1;
    }
    await companies.updateOne({ _id: c._id }, { $set: { assessment_through: channel } });
    throughUpdated += 1;
  }

  const legacyRows = await legacy.find({ level_of_certification: { $exists: true } }).toArray();
  const certFixLevels = ['Bronze', 'Silver', 'Gold', 'Platinum', 'First Certified', 'Certified'];
  let legacyCertFixed = 0;
  let legacyIdx = 0;
  for (const row of legacyRows) {
    if (isValidCertLevel(row.level_of_certification)) continue;
    const replacement = certFixLevels[legacyIdx % certFixLevels.length];
    legacyIdx += 1;
    await legacy.updateOne(
      { _id: row._id },
      { $set: { level_of_certification: replacement } },
    );
    legacyCertFixed += 1;
  }

  const rejectResult = await activities.updateMany(
    {
      $or: [{ activity_status: { $exists: false } }, { activity_status: null }, { activity_status: '' }],
      description: { $regex: /rejected/i },
    },
    { $set: { activity_status: 'Rejected' } },
  );

  const pendingResult = await activities.updateMany(
    {
      $or: [{ activity_status: { $exists: false } }, { activity_status: null }, { activity_status: '' }],
      description: { $not: { $regex: /rejected/i } },
    },
    { $set: { activity_status: 'Pending' } },
  );

  console.log('companies.assessment_through backfilled:', throughUpdated);
  console.log('companies defaulted to cii (no project):', throughDefaulted);
  console.log('legacy level_of_certification fixed:', legacyCertFixed);
  console.log('activities marked Rejected:', rejectResult.modifiedCount);
  console.log('activities marked Pending:', pendingResult.modifiedCount);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
