# DEUCEY

Find someone to play tennis with, nearby. One Expo (React Native) codebase ships to
iOS, Android, and web; Supabase (Postgres + PostGIS) handles accounts, locations,
and courts.

## ⏸ Paused here — resume checklist

Current state:

- [x] Supabase project created (ref `smtbtxtfctwyjtmgahpf`), schema + West
      Lafayette seed data loaded and verified live.
- [x] `app/.env` filled in with the real project URL + **publishable** (anon) key.
- [x] Google sign-in configured (Google Cloud Console OAuth client + Supabase
      provider) and confirmed reaching a real Google consent screen end-to-end.
- [x] Manual location entry added (`components/LocationPicker.tsx`) after
      discovering desktop browser geolocation can be wildly inaccurate (placed a
      real West Lafayette tester in Detroit, MI) — search-based fallback using
      Nominatim, same as the court-address lookups.
- [x] Nationwide court data pipeline built and run: **85,435 court facilities**
      across all 50 states + DC, compressed into `supabase/seed/us_courts.json.gz`
      (1.6MB). See "Nationwide court data" below for the important caveat on
      data quality before importing.
- [x] `schema.sql` updated: `nearby_courts()` now caps results (`max_results`,
      default 200) so dense cities don't return unbounded rows — **needs
      re-running** (it's idempotent/safe to rerun in full) before or after the
      national import.
- [ ] **Next step:** decide whether to import all 85,435 nationwide court rows
      as-is (see the tradeoff below), then run
      `SUPABASE_SECRET_KEY=... node scripts/import_us_courts.mjs` yourself
      (requires the service_role key, which stays out of my hands by design).
- [ ] Still not done: a real hands-on click-through of the full app UI on a
      phone via Expo Go (only web browser testing so far).

## How matching stays anonymous

- Real name/email live only in Supabase Auth (`auth.users`) and are never queried by
  the app's normal screens.
- `public.profiles` holds only what other players are allowed to see: a chosen
  **display name**, a self-rated skill level, and a rough **city** label.
- Exact coordinates never leave the database. The `nearby_players()` /
  `nearby_courts_for_me()` SQL functions compute distance server-side and return only
  a rounded `distance_km` — never raw lat/lng of another user.
- Players are only visible to each other while both have "available to play" turned on.

## Project layout

```
app/            Expo app (TypeScript, expo-router) — iOS, Android, web
scripts/        One-off Node scripts: smoke tests, the nationwide court import
supabase/
  schema.sql    Tables, RLS policies, and the geo-matching SQL functions
  seed/         Court data
    seed_courts.sql        West Lafayette / Lafayette, IN (23 rows, hand-reviewable)
    us_courts.json.gz      All 50 states + DC (85,435 rows, OSM-tags-only)
    national/              The pipeline that produced us_courts.json.gz
```

## 1. Create the Supabase project

1. Create a free project at https://supabase.com.
2. In the SQL editor, run `supabase/schema.sql` (enables PostGIS, creates
   `profiles`/`courts`, RLS policies, and the `nearby_courts` / `nearby_players`
   functions).
3. Then run `supabase/seed/seed_courts.sql` to load the West Lafayette / Lafayette
   court data.
4. Copy your project's URL and **publishable** (anon) key from
   **Project Settings → API**. Email confirmation is left ON by default, which is
   the right call for real users — see "Smoke-testing the backend directly" below
   for how to test without turning it off.

## 2. Configure the app

```
cd app
cp .env.example .env
# edit .env and paste your Supabase URL + anon key
npm install
```

## 3. Run it

```
npm run web       # opens in a browser
npm run ios       # requires a Mac + Xcode, or use Expo Go on your phone
npm run android   # requires Android Studio, or use Expo Go on your phone
```

The fastest way to try it on a real phone without any native build: install the
**Expo Go** app and scan the QR code that `npm run web`/`npx expo start` prints.

## Set up Google sign-in

The app already has a "Continue with Google" button (`app/lib/google-auth.ts`) —
it uses a browser-based OAuth flow that works on web, Expo Go, and native builds
with no extra native modules. Two things need to exist before it'll work, both of
which require your own accounts:

**1. Google Cloud Console**
1. Go to https://console.cloud.google.com and create a project (or reuse one).
2. **APIs & Services → OAuth consent screen** — set it up (External user type is
   fine for testing; you can leave it in "Testing" publish status while developing).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID.**
   - Application type: **Web application** (Supabase exchanges the code server-side,
     so a single Web client ID covers web *and* native — no separate iOS/Android
     client needed for this flow).
   - Under **Authorized redirect URIs**, add:
     `https://smtbtxtfctwyjtmgahpf.supabase.co/auth/v1/callback`
4. Save, then copy the generated **Client ID** and **Client Secret**.

**2. Supabase dashboard**
1. **Authentication → Sign In / Providers → Google** — enable it, paste the Client
   ID and Client Secret from above, save.
2. **Authentication → URL Configuration → Redirect URLs** — add
   `deucey://*` (covers Expo Go and native builds) and, if you're testing
   on web locally, `http://localhost:8081/*` (or whatever port `npm run web` uses).

Once both are done, tapping "Continue with Google" in the app should redirect to
Google, back to Supabase, back into the app with a session — no code changes needed.

## Smoke-testing the backend directly

Two scripts exercise the whole backend without needing the app UI — useful for
checking the database/RLS/RPCs are healthy on their own. Both only need
`app/.env` filled in (no secret key required):

```
node scripts/smoke_test.mjs you@example.com
```

Signs up a disposable `you+e2e<timestamp>@example.com` account. Because "Confirm
email" is on, this stops after sign-up with instructions to check that inbox —
click the confirmation link, then run:

```
node scripts/signin_and_test.mjs you+e2e<timestamp>@example.com
```

(using the exact address the first script printed) to sign in and finish the rest:
insert a profile at West Lafayette's coordinates, call `nearby_courts_for_me()` and
`nearby_players()`, and confirm an anonymous caller can't see anyone's profile
(RLS check).

If you ever want a single command that does the whole thing without a manual email
click, `smoke_test.mjs` also accepts the service_role ("secret") key as a
**one-time environment variable** to create an already-confirmed throwaway user via
the admin API, then deletes it afterward:

```
SUPABASE_SECRET_KEY=sb_secret_... node scripts/smoke_test.mjs you@example.com
```

Never put that key in a file, `.env`, or anywhere prefixed `EXPO_PUBLIC_` — it
grants full unrestricted database access and must never ship inside the app.

## About the West Lafayette seed court data

`supabase/seed/seed_courts.sql` was generated from OpenStreetMap (Overpass API) plus
Nominatim reverse geocoding — see `supabase/seed/import_courts.md` for how it was
built and how to regenerate it for another single city. OSM doesn't tag facility
names, so every row is marked `verified = false` with a best-effort guessed name and
`court_type` (`public` / `private` / `unknown`) based on the address (e.g. an
apartment-complex name in the address → guessed `private`). **Review these in the
Supabase table editor and correct anything you know is wrong** — especially before
relying on `court_type` for anything user-facing.

## Nationwide court data

`supabase/seed/us_courts.json.gz` covers all 50 states + DC (territories not yet
included), built by `supabase/seed/national/` — see that folder's README for the
full pipeline. The key difference from the West Lafayette pass: **no per-court
reverse geocoding** — Nominatim's usage policy explicitly forbids bulk/systematic
geocoding, so this relies only on tags OSM contributors already put on the data
(`name`, `operator`, `access`, `addr:*`, `surface`, `lit`).

**Important data-quality tradeoff before you import this:** of 85,435 total court
facilities, only about 2,400 (≈2.4%) carry a real name/operator/city tag in OSM —
the rest would import as generic "Tennis Courts" pins (`verified: false`) with
working coordinates and a directions link, but no identifying label. This is
real OSM data, not a bug — most contributors trace a court's outline from imagery
without naming it. Every row's `verified` flag preserves the distinction if you
want to treat named vs. generic pins differently in the UI later.

To load it:

1. Re-run `supabase/schema.sql` in the SQL editor (it's idempotent — safe even
   though you've run it before; this is what picks up the `nearby_courts()`
   result cap added alongside this).
2. Run the import yourself, locally, with the service_role ("secret") key as a
   one-time env var (never store it in a file — `courts` intentionally has no
   insert/update policy for anon/authenticated, so this step needs elevated
   access that stays out of my hands by design):
   ```
   SUPABASE_SECRET_KEY=sb_secret_... node scripts/import_us_courts.mjs
   ```
   It upserts in batches of 500, keyed on `(source, external_id)`, so it's safe
   to rerun (e.g. after a data refresh) without creating duplicates.

## What's built vs. what's next

Done: sign up/sign in (email+password, with required email confirmation, plus
Google OAuth), one-time onboarding (display name, skill level, location — device
GPS or manual search), nearby-courts list with directions links, opt-in
nearby-players matching, profile editing, nationwide court data pipeline (see
above).

Not built yet (natural next steps): in-app messaging between matched players,
push notifications, a map view (kept out of the MVP to avoid requiring Google Maps
API keys — `react-native-maps` can be re-added later), and a "suggest a court"
flow for users to add/correct courts themselves.
