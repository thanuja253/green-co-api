/**
 * Upsert the standard coordinator directory (name + mobile) into MongoDB.
 * Emails are synthetic but unique: c{mobile}@coordinators.seed.greenco
 *
 * After running, GET /api/admin/coordinators returns label "Name - mobile".
 *
 * Usage:
 *   node scripts/seed-coordinators-directory.js
 *   node scripts/seed-coordinators-directory.js --prune
 *
 * --prune  Sets status "0" on every coordinator whose mobile is NOT in this list
 *          (and any row with no mobile), so only these nine show in GET /coordinators.
 *
 * Requires MONGODB_URI in .env (same as the API).
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/greenco_db';

/** Unique by mobile (deduped from your spec). */
const COORDINATORS = [
  ['Bhushan', '9398758947'],
  ['CII', '9299299929'],
  ['naveen', '8979879868'],
  ['prabhas', '9098876565'],
  ['RajeshQA', '8383838388'],
  ['Test', '9090909090'],
  ['test', '9658569856'],
  ['vardhan', '7383883833'],
  ['Vicky', '7383883838'],
];

const PRUNE = process.argv.includes('--prune');

async function run() {
  let client;
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    let dbName = '';
    try {
      dbName = new URL(
        MONGODB_URI.replace(/^mongodb\+srv:/i, 'mongodb:'),
      ).pathname.replace(/^\//, '').split('?')[0];
    } catch (_) {
      /* ignore */
    }
    if (!dbName) dbName = 'greenco_db';
    const db = client.db(dbName);
    const coll = db.collection('coordinators');

    const now = new Date();
    let upserted = 0;
    let modified = 0;

    for (const [name, mobileRaw] of COORDINATORS) {
      const mobile = String(mobileRaw).trim();
      const email = `c${mobile}@coordinators.seed.greenco`.toLowerCase();

      const res = await coll.updateOne(
        { mobile },
        {
          $set: {
            name: name.trim(),
            email,
            mobile,
            status: '1',
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );

      if (res.upsertedCount) upserted += 1;
      else if (res.modifiedCount) modified += 1;
    }

    if (PRUNE) {
      const keepMobiles = COORDINATORS.map(([, m]) => String(m).trim());
      const pr = await coll.updateMany(
        {
          $or: [{ mobile: { $exists: false } }, { mobile: { $nin: keepMobiles } }],
        },
        { $set: { status: '0', updatedAt: now } },
      );
      console.log(`🧹 --prune: deactivated ${pr.modifiedCount} other coordinator row(s).`);
    }

    console.log('✅ Coordinator directory seed complete.');
    console.log(`   Upserted (new): ${upserted}, updated (existing mobile): ${modified}`);
    console.log(`   Total rows in script: ${COORDINATORS.length}`);
    console.log('\n   Call GET /api/admin/coordinators — each item should show label "Name - mobile".\n');

    const sample = await coll
      .find({ mobile: { $in: COORDINATORS.map(([, m]) => String(m)) } })
      .project({ name: 1, mobile: 1, email: 1 })
      .sort({ name: 1 })
      .toArray();
    console.log('Sample from DB:', JSON.stringify(sample, null, 2));
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

run();
