import * as Location from 'expo-location';

export type CapturedLocation = {
  latitude: number;
  longitude: number;
  city: string | null;
};

export type LocationSearchResult = {
  label: string;
  latitude: number;
  longitude: number;
  city: string | null;
};

// Nominatim (OpenStreetMap) is free and needs no API key, which fits an MVP, but
// its usage policy caps this at low volume (~1 request/sec, no bulk use) — if
// this app gets real traffic, replace reverseGeocode/searchLocations with a
// proper geocoding provider (Google/Mapbox/etc.) or a self-hosted Nominatim.
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
// Nominatim rejects requests with generic/default User-Agent strings (e.g. bare
// "okhttp" on native Android). A real browser ignores this header and sends its
// own anyway (harmless, and browser UAs aren't blocked) — this only matters for
// native builds.
const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Deucey/1.0 (tennis match-making app; contact: navid.safa.ns@gmail.com)',
};

function cityFromAddress(address: Record<string, string> | undefined): string | null {
  if (!address) return null;
  return address.city ?? address.town ?? address.village ?? address.county ?? null;
}

async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
      { headers: NOMINATIM_HEADERS }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return cityFromAddress(data.address);
  } catch {
    return null; // best-effort — matching still works without a city label
  }
}

/**
 * Asks for foreground location permission and returns a one-shot device GPS fix
 * plus a best-effort city name for display (matching itself uses lat/lng, not
 * the city string).
 */
export async function captureCurrentLocation(): Promise<CapturedLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission was not granted.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const city = await reverseGeocode(position.coords.latitude, position.coords.longitude);

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    city,
  };
}

/**
 * Looks up a free-text place/address (e.g. "West Lafayette, IN") for people
 * whose device location is missing or wrong — common on desktop browsers,
 * which often fall back to inaccurate IP-based geolocation.
 */
export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  const res = await fetch(
    `${NOMINATIM_BASE}/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
    { headers: NOMINATIM_HEADERS }
  );
  if (!res.ok) throw new Error('Location search failed — try again.');
  const data = await res.json();
  return (data as any[]).map((item) => ({
    label: item.display_name as string,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    city: cityFromAddress(item.address) ?? (item.display_name as string).split(',')[0],
  }));
}

export function directionsUrl(latitude: number, longitude: number, label: string) {
  const query = encodeURIComponent(label);
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${query}`;
}
