# Nationwide court data pipeline

Same idea as the West Lafayette pass (`supabase/seed/import_courts.md`), scaled to
all 50 states + DC, with one deliberate difference: **no per-court reverse
geocoding**. Nominatim's usage policy forbids bulk/systematic geocoding, so this
pipeline relies entirely on tags OSM contributors already put on the court
data itself (`name`, `operator`, `access`, `addr:*`, `surface`, `lit`).

## Steps

```
python3 fetch_us_courts.py   # ~51 Overpass queries (one per state + DC), resumable
python3 build_us_courts.py   # clusters + labels -> ../us_courts.json.gz
node ../../../scripts/import_us_courts.mjs   # upserts into the live `courts` table
```

1. **`fetch_us_courts.py`** — queries Overpass for every `sport=tennis`
   node/way/relation inside each state's OSM boundary. Retries with backoff on
   429/504 (the shared public Overpass instance rate-limits under load — this
   is normal, not a failure). Raw per-state JSON lands in `./us_courts_raw/`
   (gitignored, ~150MB combined) — safe to delete and rerun; already-fetched
   states are skipped.

2. **`build_us_courts.py`** — merges nearby elements into single facilities
   using grid-based clustering (round coordinates to a ~200m cell, O(n) instead
   of pairwise distance comparison — necessary at ~200k raw elements). For each
   cluster: picks `name` > `operator` > `addr:city` > a generic "Tennis Courts"
   label, sets `court_type` from OSM's own `access` tag when present, and
   compresses the result to `../us_courts.json.gz`.

3. **`scripts/import_us_courts.mjs`** (repo root `scripts/`) — batch-upserts
   the compressed file into Supabase. Requires the service_role key as a
   one-time env var, since the `courts` table intentionally has no
   insert/update policy for anon/authenticated.

## Known data-quality tradeoff

As of the run that produced the current `us_courts.json.gz`: **85,435 court
facilities nationally, but only ~2,400 (≈2.4%) carry a real OSM `name`,
`operator`, or `addr:city` tag** — the rest import as generic "Tennis Courts"
pins (`verified: false`) with working coordinates/directions but no
identifying label. This is a real characteristic of OSM's tennis-court
tagging, not a bug in the pipeline: most contributors trace a court's outline
from imagery without adding a name. Every row's `verified` column preserves
this distinction so the UI can treat named vs. generic pins differently later
if that becomes worth doing (e.g. a "verified" badge, or filtering to named-only
in dense areas).

To regenerate for a data refresh or to add territories (PR, GU, VI, AS, MP —
excluded from the initial pass), add their ISO3166-2 codes to `STATES` in
`fetch_us_courts.py` and rerun both scripts.
