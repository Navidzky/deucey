#!/usr/bin/env python3
"""Turn the raw per-state Overpass dumps (./us_courts_raw/*.json, produced by
fetch_us_courts.py) into a deduplicated national court list, using ONLY tags
already present in OSM (name/operator/access/addr:*/surface/lit) — no
per-court geocoding, to respect Nominatim's bulk-use policy.

Clustering is grid-based (round to a ~200m cell) rather than pairwise distance,
so it stays O(n) even for big states — an accepted approximation at this scale
(a facility whose footprint straddles a cell boundary may occasionally split
into two rows).

Writes ../us_courts.json.gz, which scripts/import_us_courts.mjs loads.
"""
import json
import glob
import gzip
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(SCRIPT_DIR, "us_courts_raw")
OUT_PATH = os.path.join(SCRIPT_DIR, "..", "us_courts.json.gz")

GRID_DEG = 0.002  # ~200m — matches the ~250m proximity merge used for the West Lafayette pass

def grid_key(lat, lon):
    return (round(lat / GRID_DEG), round(lon / GRID_DEG))

def surface_from(tags_list):
    surfaces = {t.get("surface") for t in tags_list if t.get("surface")}
    if "paved" in surfaces or "asphalt" in surfaces or "concrete" in surfaces:
        return "hard"
    if "clay" in surfaces:
        return "clay"
    if "grass" in surfaces:
        return "grass"
    return "unknown"

def access_from(tags_list):
    accesses = {t.get("access") for t in tags_list if t.get("access")}
    if accesses & {"private", "customers", "permit", "permissive"}:
        return "private"
    if accesses & {"public", "yes"}:
        return "public"
    return "unknown"

def addr_from(tags):
    parts = [tags.get(k) for k in ("addr:housenumber", "addr:street") if tags.get(k)]
    street = " ".join(parts) if parts else None
    bits = [b for b in [street, tags.get("addr:city"), tags.get("addr:state"), tags.get("addr:postcode")] if b]
    return ", ".join(bits) if bits else None

def main():
    state_files = sorted(glob.glob(os.path.join(RAW_DIR, "*.json")))
    print(f"{len(state_files)} state files found")

    clusters = {}  # grid_key -> list of element dicts, tagged with state
    for path in state_files:
        state = os.path.splitext(os.path.basename(path))[0]
        with open(path) as f:
            data = json.load(f)
        for el in data.get("elements", []):
            center = el.get("center", el)
            lat, lon = center.get("lat"), center.get("lon")
            if lat is None or lon is None:
                continue
            el["_state"] = state
            key = grid_key(lat, lon)
            clusters.setdefault(key, []).append(el)

    print(f"{sum(len(v) for v in clusters.values())} raw elements -> {len(clusters)} grid clusters")

    rows = []
    for key, members in clusters.items():
        lats = [m.get("center", m)["lat"] for m in members]
        lons = [m.get("center", m)["lon"] for m in members]
        clat, clon = sum(lats) / len(lats), sum(lons) / len(lons)
        tags_list = [m.get("tags", {}) for m in members]

        name = next((t["name"] for t in tags_list if t.get("name")), None)
        operator = next((t["operator"] for t in tags_list if t.get("operator")), None)
        city = next((t["addr:city"] for t in tags_list if t.get("addr:city")), None)
        state = members[0]["_state"]
        address = next((addr_from(t) for t in tags_list if addr_from(t)), None)

        if name:
            label = name
        elif operator:
            label = f"Tennis Courts – {operator}"
        elif city:
            label = f"Tennis Courts – {city}, {state}"
        else:
            label = "Tennis Courts"

        min_id = min(m["id"] for m in members)
        first_type = next(m["type"] for m in members if m["id"] == min_id)

        rows.append({
            "name": label,
            "address": address,
            "city": city,
            "state": state,
            "latitude": clat,
            "longitude": clon,
            "court_type": access_from(tags_list),
            "surface": surface_from(tags_list),
            "num_courts": len(members),
            "lit": any(t.get("lit") == "yes" for t in tags_list),
            "verified": bool(name),  # a real OSM name tag is a much stronger signal than an address-keyword guess
            "source": "openstreetmap",
            "external_id": f"us-{state}-{first_type}-{min_id}",
        })

    with gzip.open(OUT_PATH, "wt") as f:
        json.dump(rows, f)

    named = sum(1 for r in rows if r["name"] != "Tennis Courts")
    print(f"{len(rows)} total court facilities, {named} with a real name/operator/city label, {len(rows) - named} generic")
    print(f"wrote {OUT_PATH}")

if __name__ == "__main__":
    main()
