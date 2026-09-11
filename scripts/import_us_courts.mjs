// Bulk-loads supabase/seed/us_courts.json into the live `courts` table.
// The courts table only allows writes from service_role (RLS has no
// insert/update policy for anon/authenticated — reads are public, writes
// aren't), so this needs the secret key. Run it yourself, locally:
//
//   SUPABASE_SECRET_KEY=sb_secret_... node scripts/import_us_courts.mjs
//
// Never put that key in a file, .env, or anywhere prefixed EXPO_PUBLIC_ — it
// grants full unrestricted database access. Passing it as a one-time env var
// on a command you run yourself is fine; it's specifically pasting it into a
// command *for someone else to run on your behalf* that's the risk.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv(new URL('../app/.env', import.meta.url));
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL) {
  console.error('Missing app/.env — copy app/.env.example and fill it in first.');
  process.exit(1);
}
if (!SECRET_KEY) {
  console.error('Set SUPABASE_SECRET_KEY as an env var (service_role key from Project Settings → API).');
  process.exit(1);
}

const compressed = readFileSync(new URL('../supabase/seed/us_courts.json.gz', import.meta.url));
const rows = JSON.parse(gunzipSync(compressed).toString('utf8'));
console.log(`${rows.length} court rows to upsert`);

const BATCH_SIZE = 500;

function toDbRow(r) {
  return {
    name: r.name,
    address: r.address,
    location: `SRID=4326;POINT(${r.longitude} ${r.latitude})`,
    court_type: r.court_type,
    surface: r.surface,
    num_courts: r.num_courts,
    lit: r.lit,
    verified: r.verified,
    source: r.source,
    external_id: r.external_id,
  };
}

let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE).map(toDbRow);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/courts?on_conflict=source,external_id`, {
    method: 'POST',
    headers: {
      apikey: SECRET_KEY,
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Batch ${i}-${i + batch.length} FAILED: ${res.status} ${text.slice(0, 500)}`);
    continue;
  }
  inserted += batch.length;
  console.log(`  upserted ${inserted}/${rows.length}`);
}

console.log('Done.');
