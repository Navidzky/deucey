#!/usr/bin/env python3
"""Fetch every OSM sport=tennis element per US state via Overpass, one state at
a time (resumable — skips states whose raw file already exists), with a polite
delay between requests. Saves raw per-state JSON for build_us_courts.py to
cluster. Raw dumps land in ./us_courts_raw/ next to this script (gitignored —
~150MB combined, regenerate rather than commit)."""
import json
import time
import urllib.request
import urllib.parse
import urllib.error
import os

STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC",
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SCRIPT_DIR, "us_courts_raw")
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def build_query(state_code):
    return f"""
[out:json][timeout:180];
area["ISO3166-2"="US-{state_code}"]["admin_level"="4"]->.searchArea;
(
  node["sport"="tennis"](area.searchArea);
  way["sport"="tennis"](area.searchArea);
  relation["sport"="tennis"](area.searchArea);
);
out tags center;
""".strip()

def fetch_state(state_code, retries=3):
    query = build_query(state_code)
    body = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(OVERPASS_URL, data=body, headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Deucey-dev/1.0 (tennis match-making app; contact: navid.safa.ns@gmail.com)",
    })
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=200) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body_text = e.read().decode(errors="replace")[:300]
            print(f"  HTTP {e.code} on attempt {attempt} for {state_code}: {body_text}", flush=True)
            if e.code == 429 or e.code == 504:
                time.sleep(15 * attempt)
                continue
            raise
        except Exception as e:
            print(f"  error on attempt {attempt} for {state_code}: {e}", flush=True)
            time.sleep(10 * attempt)
    raise RuntimeError(f"Failed to fetch {state_code} after {retries} attempts")

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for state in STATES:
        out_path = os.path.join(OUT_DIR, f"{state}.json")
        if os.path.exists(out_path):
            print(f"skip {state} (already fetched)", flush=True)
            continue
        print(f"fetching {state} ...", flush=True)
        t0 = time.time()
        try:
            data = fetch_state(state)
        except Exception as e:
            print(f"FAILED {state}: {e}", flush=True)
            continue
        with open(out_path, "w") as f:
            json.dump(data, f)
        n = len(data.get("elements", []))
        print(f"  {state}: {n} elements in {time.time()-t0:.1f}s", flush=True)
        time.sleep(3)  # be polite to the shared public Overpass instance

if __name__ == "__main__":
    main()
