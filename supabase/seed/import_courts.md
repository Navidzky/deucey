# Regenerating court seed data for another city

`seed_courts.sql` was built in three steps, all from free/open sources (no API key
needed):

1. **Pull raw court geometry from OpenStreetMap** via the Overpass API — query
   `sport=tennis` nodes/ways/relations inside a bounding box:

   ```
   https://overpass-api.de/api/interpreter?data=[out:json];
     (node["sport"="tennis"](minlat,minlon,maxlat,maxlon);
      way["sport"="tennis"](minlat,minlon,maxlat,maxlon);
      relation["sport"="tennis"](minlat,minlon,maxlat,maxlon);)
     ;out tags center;
   ```

   Saved as `west_lafayette_courts_raw.json`. Individual courts in the same complex
   are usually mapped as separate adjacent ways, so this returns far more elements
   than there are physical locations.

2. **Cluster** the raw elements: any two points within ~250m are treated as one
   facility (this is what turns e.g. 11 adjacent single-court ways into one
   "13 courts" row). Also aggregates each cluster's `surface`/`lit` OSM tags.

3. **Reverse-geocode** each cluster's centroid via Nominatim
   (`https://nominatim.openstreetmap.org/reverse`, rate-limited to 1 request/sec,
   requires a `User-Agent` per their usage policy) to get a real street address,
   since OSM tennis courts are almost never tagged with a facility `name`. A simple
   keyword heuristic (apartment/farms/village/estates/etc. in the address, or a
   Purdue zip/campus match) guesses `court_type`; everything else is left
   `'unknown'`. Saved as `court_clusters_geocoded.json`.

`seed_courts.sql` is generated from those two JSON files. To redo this for a
different city/region, change the bounding box in step 1, rerun steps 2–3, and
regenerate the SQL — every row is inserted with `verified = false` so a human
reviews it before it's trusted.
