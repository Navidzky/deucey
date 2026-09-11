// Continues the smoke test for an account that's already been created via
// smoke_test.mjs and confirmed by clicking the email link. Signs in (public
// anon key only, no secret key needed) and runs the same profile/RPC checks.
//
// Usage:
//   node scripts/signin_and_test.mjs navid.safa.ns+e2e1788450841048@gmail.com
import { readFileSync } from 'node:fs';

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
const ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const TEST_PASSWORD = 'TestPassword123!';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/signin_and_test.mjs <the exact e2e test email>');
  process.exit(1);
}

async function call(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

console.log('1. Sign in:', email);
const signIn = await call('/auth/v1/token?grant_type=password', {
  method: 'POST',
  body: JSON.stringify({ email, password: TEST_PASSWORD }),
});
const accessToken = signIn.body.access_token;
const userId = signIn.body.user?.id;
console.log('  status', signIn.status, 'has access_token?', !!accessToken);
if (!accessToken) {
  console.log('  FULL BODY:', JSON.stringify(signIn.body));
  console.log('\nStill no session — make sure you clicked the confirmation link in that email.');
  process.exit(0);
}

const authHeaders = { Authorization: `Bearer ${accessToken}` };

console.log('\n2. Insert profile (onboarding) at West Lafayette coords');
const upsert = await call('/rest/v1/profiles', {
  method: 'POST',
  headers: { ...authHeaders, Prefer: 'return=representation' },
  body: JSON.stringify({
    id: userId,
    handle: `E2ETester${Date.now() % 100000}`,
    skill_level: 4.0,
    city: 'West Lafayette',
    is_looking_for_match: true,
    home_location: 'SRID=4326;POINT(-86.9212 40.4237)',
  }),
});
console.log('  status', upsert.status, JSON.stringify(upsert.body).slice(0, 300));

console.log('\n3. nearby_courts_for_me()');
const courts = await call('/rest/v1/rpc/nearby_courts_for_me', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({}),
});
console.log('  status', courts.status, 'count:', Array.isArray(courts.body) ? courts.body.length : courts.body);
if (Array.isArray(courts.body)) console.log('  closest:', courts.body[0]?.name, courts.body[0]?.distance_km?.toFixed(2), 'km');

console.log('\n4. nearby_players()');
const players = await call('/rest/v1/rpc/nearby_players', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({}),
});
console.log('  status', players.status, JSON.stringify(players.body));

console.log('\n5. Confirm this profile is invisible to an anonymous caller (RLS check)');
const anonProfiles = await call('/rest/v1/profiles?select=*');
console.log('  status', anonProfiles.status, 'rows visible to anon:', Array.isArray(anonProfiles.body) ? anonProfiles.body.length : anonProfiles.body);

console.log('\nDone. Test user id (delete via Supabase dashboard → Authentication if you want a clean project):', userId);
