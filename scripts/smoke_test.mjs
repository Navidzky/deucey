// One-shot smoke test of the live Supabase backend: creates a disposable test
// account, completes onboarding, exercises both matching RPCs, and confirms RLS
// hides profiles from anonymous callers — then deletes the test account.
//
// Usage:
//   node scripts/smoke_test.mjs you@example.com
//
// By default this signs up normally, which means it'll stop early if "Confirm
// email" is on (the account needs a real click-through before it has a session)
// — that's expected; the message below tells you what to do.
//
// To fully exercise the backend WITHOUT touching your project's email
// confirmation setting, pass the service_role ("secret") key as an env var —
// never as a file, never committed:
//   SUPABASE_SECRET_KEY=sb_secret_... node scripts/smoke_test.mjs you@example.com
// This uses the admin API to create an already-confirmed throwaway user, tests
// against it, then deletes it. Get the key from Supabase → Project Settings →
// API → service_role, and never paste it into app/.env or any EXPO_PUBLIC_* var
// — those ship inside the client bundle that anyone can read.
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
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY; // transient only, never persisted

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing app/.env — copy app/.env.example and fill it in first.');
  process.exit(1);
}

const baseEmail = process.argv[2];
if (!baseEmail || !baseEmail.includes('@')) {
  console.error('Usage: node scripts/smoke_test.mjs you@example.com');
  process.exit(1);
}
const [local, domain] = baseEmail.split('@');
const testEmail = `${local}+e2e${Date.now()}@${domain}`;
const testPassword = 'TestPassword123!';

async function call(path, { apikey = ANON_KEY, ...opts } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { apikey, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

let accessToken, userId;

if (SECRET_KEY) {
  console.log('1. (admin) Create pre-confirmed test user:', testEmail);
  const created = await call('/auth/v1/admin/users', {
    apikey: SECRET_KEY,
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET_KEY}` },
    body: JSON.stringify({ email: testEmail, password: testPassword, email_confirm: true }),
  });
  if (created.status >= 300) {
    console.log('  FAILED', created.status, JSON.stringify(created.body));
    process.exit(1);
  }
  userId = created.body.id;
  console.log('  created', userId);

  console.log('\n2. Sign in as the test user');
  const signIn = await call('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  accessToken = signIn.body.access_token;
  console.log('  status', signIn.status, 'has access_token?', !!accessToken);
} else {
  console.log('1. Sign up:', testEmail, '(no SUPABASE_SECRET_KEY set — using the public flow)');
  const signUp = await call('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  accessToken = signUp.body.access_token;
  userId = signUp.body.user?.id ?? signUp.body.id;
  console.log('  status', signUp.status, 'has access_token?', !!accessToken);

  if (!accessToken) {
    console.log('  FULL BODY:', JSON.stringify(signUp.body));
    console.log(
      '\nNo access token — "Confirm email" is on (expected/intended for real users), so this ' +
        'account needs a real confirmation click before it has a session.\n' +
        'To fully exercise the backend anyway, rerun with:\n' +
        '  SUPABASE_SECRET_KEY=sb_secret_... node scripts/smoke_test.mjs ' + baseEmail
    );
    process.exit(0);
  }
}

const authHeaders = { Authorization: `Bearer ${accessToken}` };

console.log('\n3. Insert profile (onboarding) at West Lafayette coords');
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

console.log('\n4. nearby_courts_for_me()');
const courts = await call('/rest/v1/rpc/nearby_courts_for_me', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({}),
});
console.log('  status', courts.status, 'count:', Array.isArray(courts.body) ? courts.body.length : courts.body);
if (Array.isArray(courts.body)) console.log('  closest:', courts.body[0]?.name, courts.body[0]?.distance_km?.toFixed(2), 'km');

console.log('\n5. nearby_players() — expect empty unless you have another opted-in test profile');
const players = await call('/rest/v1/rpc/nearby_players', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({}),
});
console.log('  status', players.status, JSON.stringify(players.body));

console.log('\n6. Confirm this profile is invisible to an anonymous caller (RLS check)');
const anonProfiles = await call('/rest/v1/profiles?select=*');
console.log('  status', anonProfiles.status, 'rows visible to anon:', Array.isArray(anonProfiles.body) ? anonProfiles.body.length : anonProfiles.body);

if (SECRET_KEY) {
  console.log('\n7. (admin) Delete the test user — leaves your project clean');
  const del = await call(`/auth/v1/admin/users/${userId}`, {
    apikey: SECRET_KEY,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${SECRET_KEY}` },
  });
  console.log('  status', del.status, del.status < 300 ? 'deleted.' : JSON.stringify(del.body));
} else {
  console.log('\nDone. Test user id (delete later via Supabase dashboard → Authentication if you want a clean project):', userId);
}
