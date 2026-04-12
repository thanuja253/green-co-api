#!/usr/bin/env node
/**
 * Verify quickview + Launch & Training against a running Nest API (not the Next port).
 *
 * Usage:
 *   API_URL=http://localhost:3001 ADMIN_JWT=eyJhbG... node scripts/check-quickview-lt.js 69da0e9dbb9acd3c0de61ed8
 *
 * Defaults: API_URL=http://localhost:3019, project id from first arg or env PROJECT_ID
 */
const https = require('https');
const http = require('http');

const projectId = process.argv[2] || process.env.PROJECT_ID;
const base = (process.env.API_URL || 'http://localhost:3019').replace(/\/$/, '');
const adminJwt = process.env.ADMIN_JWT;

if (!projectId) {
  console.error('Usage: API_URL=http://localhost:3001 ADMIN_JWT=... node scripts/check-quickview-lt.js <projectId>');
  process.exit(1);
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      { method: 'GET', headers: { Accept: 'application/json', ...headers } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, text: body.slice(0, 500) });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('API base:', base);
  console.log('Project:', projectId);

  const qvUrl = `${base}/api/company/projects/${projectId}/quickview`;
  const qv = await fetchJson(qvUrl);
  console.log('\n[quickview]', qvUrl, '→', qv.status);
  if (qv.json?.data) {
    console.log('  latest_step:', qv.json.data.latest_step);
    console.log('  next_step:', qv.json.data.next_step);
    if (qv.json.data.launch_training_program) {
      console.log(
        '  launch_training_program.sessions_count:',
        qv.json.data.launch_training_program.sessions_count,
      );
    }
  } else {
    console.log('  ', qv.text || qv.json);
  }

  const ltPaths = [`launch-training-program`, `launch-training`];
  for (const p of ltPaths) {
    const url = `${base}/api/admin/projects/${projectId}/${p}`;
    const headers = adminJwt ? { Authorization: `Bearer ${adminJwt}` } : {};
    const r = await fetchJson(url, headers);
    console.log(`\n[${p}]`, url, '→', r.status);
    if (!adminJwt && r.status === 401) {
      console.log('  (set ADMIN_JWT for admin L&T GET)');
    }
    if (r.json?.data) {
      console.log('  sessions_count:', r.json.data.sessions_count);
      console.log('  coordinator_assigned:', r.json.data.coordinator_assigned);
    } else {
      console.log('  ', r.text || r.json);
    }
  }

  console.log('\n---');
  console.log('If quickview hits the wrong host, fix Next rewrites so /api → Nest (see scripts/README.md).');
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
