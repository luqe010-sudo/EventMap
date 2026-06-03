/**
 * Client-side geocoding via Nominatim (OpenStreetMap).
 *
 * Usage policy: max 1 req/s, proper User-Agent, no bulk requests.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

export type GeocodingResult = {
  displayName: string;
  latitude: number;
  longitude: number;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  voivodeship: string | null;
  county: string | null;
  municipality: string | null;
};

type NominatimAddress = {
  road?: string;
  house_number?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  state?: string;
  postcode?: string;
  county?: string;
  municipality?: string;
  suburb?: string;
};

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "MapaImprez.pl/1.0 (event-location-picker)";
const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 5;

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < MIN_QUERY_LENGTH) return [];

  // Polish address optimization: "ul." and "ulica" prefixes often confuse Nominatim.
  const cleanQuery = query
    .replace(/\bul\.\s*/gi, "")
    .replace(/\bulica\s*/gi, "")
    .trim();

  if (cleanQuery.length < MIN_QUERY_LENGTH) return [];

  const params = new URLSearchParams({
    q: cleanQuery,
    format: "json",
    countrycodes: "pl",
    addressdetails: "1",
    limit: String(MAX_RESULTS),
    "accept-language": "pl"
  });

  try {
    const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { "User-Agent": USER_AGENT }
    });
    if (!response.ok) return [];

    const results = (await response.json()) as NominatimResult[];
    return results.map(mapNominatimResult);
  } catch {
    return [];
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: "json",
    addressdetails: "1",
    "accept-language": "pl"
  });

  try {
    const response = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { "User-Agent": USER_AGENT }
    });
    if (!response.ok) return null;

    const result = (await response.json()) as NominatimResult;
    if (!result.lat || !result.lon) return null;
    return mapNominatimResult(result);
  } catch {
    return null;
  }
}

function mapNominatimResult(result: NominatimResult): GeocodingResult {
  const addr = result.address;
  const city =
    addr?.city ?? addr?.town ?? addr?.village ?? addr?.hamlet ?? null;

  let address: string | null = null;
  if (addr?.road) {
    address = addr.house_number
      ? `${addr.road} ${addr.house_number}`
      : addr.road;
  }

  return {
    displayName: result.display_name,
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
    city,
    address,
    postalCode: addr?.postcode ?? null,
    voivodeship: addr?.state ?? null,
    county: addr?.county ?? null,
    municipality: addr?.municipality ?? null
  };
}
