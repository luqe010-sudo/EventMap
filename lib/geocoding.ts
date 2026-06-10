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
  name?: string;
  display_name: string;
  class?: string;
  type?: string;
  addresstype?: string;
  address?: NominatimAddress;
};

type PhotonFeature = {
  type: "Feature";
  properties: {
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
  };
  geometry?: {
    type: "Point";
    coordinates: [number, number];
  };
};

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const PHOTON_API_URL = "https://photon.komoot.io/api";
const USER_AGENT = "MapaImprez.pl/1.0 (event-location-picker)";
const MIN_QUERY_LENGTH = 3;
const MIN_CITY_QUERY_LENGTH = 1;
const MIN_ADDRESS_QUERY_LENGTH = 2;
const MAX_RESULTS = 5;
const MAX_CITY_RESULTS = 8;
const MAX_ADDRESS_RESULTS = 8;

const VOIVODESHIP_NAME_MAP: Record<string, string> = {
  "lower silesian": "dolnośląskie",
  "lower silesian voivodeship": "dolnośląskie",
  "dolnoslaskie": "dolnośląskie",
  "kuyavian pomeranian": "kujawsko-pomorskie",
  "kuyavian pomeranian voivodeship": "kujawsko-pomorskie",
  "kujawsko pomorskie": "kujawsko-pomorskie",
  "kujawsko-pomorskie": "kujawsko-pomorskie",
  "lublin": "lubelskie",
  "lublin voivodeship": "lubelskie",
  "lubelskie": "lubelskie",
  "lubusz": "lubuskie",
  "lubusz voivodeship": "lubuskie",
  "lubuskie": "lubuskie",
  "lodz": "łódzkie",
  "lodz voivodeship": "łódzkie",
  "lodzkie": "łódzkie",
  "lesser poland": "małopolskie",
  "lesser poland voivodeship": "małopolskie",
  "malopolskie": "małopolskie",
  "masovian": "mazowieckie",
  "masovian voivodeship": "mazowieckie",
  "mazowieckie": "mazowieckie",
  "opole": "opolskie",
  "opole voivodeship": "opolskie",
  "opolskie": "opolskie",
  "subcarpathian": "podkarpackie",
  "subcarpathian voivodeship": "podkarpackie",
  "podkarpackie": "podkarpackie",
  "podlaskie": "podlaskie",
  "podlaskie voivodeship": "podlaskie",
  "pomeranian": "pomorskie",
  "pomeranian voivodeship": "pomorskie",
  "pomorskie": "pomorskie",
  "silesian": "śląskie",
  "silesian voivodeship": "śląskie",
  "slaskie": "śląskie",
  "holy cross": "świętokrzyskie",
  "holy cross voivodeship": "świętokrzyskie",
  "swietokrzyskie": "świętokrzyskie",
  "warmian masurian": "warmińsko-mazurskie",
  "warmian masurian voivodeship": "warmińsko-mazurskie",
  "warminsko mazurskie": "warmińsko-mazurskie",
  "warminsko-mazurskie": "warmińsko-mazurskie",
  "greater poland": "wielkopolskie",
  "greater poland voivodeship": "wielkopolskie",
  "wielkopolskie": "wielkopolskie",
  "west pomeranian": "zachodniopomorskie",
  "west pomeranian voivodeship": "zachodniopomorskie",
  "zachodniopomorskie": "zachodniopomorskie"
};

const POPULAR_POLISH_CITIES: GeocodingResult[] = [
  createCityResult("Warszawa", 52.2297, 21.0122, "mazowieckie"),
  createCityResult("Kraków", 50.0647, 19.945, "małopolskie"),
  createCityResult("Wrocław", 51.1079, 17.0385, "dolnośląskie"),
  createCityResult("Poznań", 52.4064, 16.9252, "wielkopolskie"),
  createCityResult("Gdańsk", 54.352, 18.6466, "pomorskie"),
  createCityResult("Łódź", 51.7592, 19.456, "łódzkie"),
  createCityResult("Katowice", 50.2649, 19.0238, "śląskie"),
  createCityResult("Lublin", 51.2465, 22.5684, "lubelskie"),
  createCityResult("Szczecin", 53.4285, 14.5528, "zachodniopomorskie"),
  createCityResult("Bydgoszcz", 53.1235, 18.0084, "kujawsko-pomorskie"),
  createCityResult("Białystok", 53.1325, 23.1688, "podlaskie"),
  createCityResult("Rzeszów", 50.0412, 21.9991, "podkarpackie")
];

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

export async function searchPolishCities(query: string): Promise<GeocodingResult[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < MIN_CITY_QUERY_LENGTH) return [];

  const localMatches = findLocalCitySuggestions(cleanQuery);
  if (cleanQuery.length < 2) return localMatches;

  try {
    const photonResults = await searchPhotonPolishCities(cleanQuery);
    const rankedPhotonResults = rankCitySuggestions(cleanQuery, photonResults);
    const mergedResults = uniqueResults([...localMatches, ...rankedPhotonResults]).slice(0, MAX_CITY_RESULTS);
    if (mergedResults.length > 0) return mergedResults;

    const nominatimResults = await searchNominatimPolishCities(cleanQuery);
    return uniqueResults([...localMatches, ...rankCitySuggestions(cleanQuery, nominatimResults)]).slice(0, MAX_CITY_RESULTS);
  } catch {
    try {
      const nominatimResults = await searchNominatimPolishCities(cleanQuery);
      return uniqueResults([...localMatches, ...rankCitySuggestions(cleanQuery, nominatimResults)]).slice(0, MAX_CITY_RESULTS);
    } catch {
      return localMatches;
    }
  }
}

async function searchPhotonPolishCities(query: string): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    q: query,
    countrycode: "PL",
    limit: String(MAX_CITY_RESULTS * 2),
    bbox: "14.07,49,24.15,54.84"
  });
  ["city", "locality", "district"].forEach((layer) => params.append("layer", layer));

  const response = await fetch(`${PHOTON_API_URL}?${params}`, {
    headers: { "Accept-Language": "pl,en;q=0.7" }
  });
  if (!response.ok) throw new Error("Photon error");

  const data = (await response.json()) as { features?: PhotonFeature[] };
  return (data.features ?? [])
    .map(mapPhotonCityResult)
    .filter(isGeocodingResult);
}

async function searchNominatimPolishCities(query: string): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    q: `${query}, Polska`,
    format: "json",
    countrycodes: "pl",
    addressdetails: "1",
    limit: String(MAX_CITY_RESULTS),
    dedupe: "1",
    "accept-language": "pl"
  });

  const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!response.ok) throw new Error("Nominatim error");

  const results = (await response.json()) as NominatimResult[];
  return results.map(mapPolishCityResult).filter(isGeocodingResult);
}

export async function searchStreetAddress(
  query: string,
  city: string
): Promise<GeocodingResult[]> {
  const cleanQuery = query
    .replace(/\bul\.\s*/gi, "")
    .replace(/\bulica\s*/gi, "")
    .trim();
  const cleanCity = city.trim();

  if (cleanQuery.length < MIN_ADDRESS_QUERY_LENGTH || cleanCity.length < 2) return [];

  const includeHouseNumber = hasHouseNumberQuery(cleanQuery);

  try {
    const photonResults = await searchPhotonStreetAddresses(cleanQuery, cleanCity, includeHouseNumber);
    const rankedPhotonResults = uniqueAddressResults(rankAddressSuggestions(cleanQuery, photonResults));
    const exactPhotonResults = includeHouseNumber
      ? rankedPhotonResults.filter((result) => hasHouseNumberQuery(result.address ?? ""))
      : rankedPhotonResults;

    if (exactPhotonResults.length > 0) {
      return exactPhotonResults.slice(0, MAX_ADDRESS_RESULTS);
    }

    if (cleanQuery.length < MIN_QUERY_LENGTH) {
      return rankedPhotonResults.slice(0, MAX_ADDRESS_RESULTS);
    }

    const nominatimResults = await searchNominatimStreetAddresses(cleanQuery, cleanCity, includeHouseNumber);
    const rankedNominatimResults = rankAddressSuggestions(cleanQuery, nominatimResults);
    const exactNominatimResults = includeHouseNumber
      ? rankedNominatimResults.filter((result) => hasHouseNumberQuery(result.address ?? ""))
      : rankedNominatimResults;

    return uniqueAddressResults([
      ...exactNominatimResults,
      ...rankedPhotonResults,
      ...rankedNominatimResults
    ]).slice(0, MAX_ADDRESS_RESULTS);
  } catch {
    try {
      const nominatimResults = await searchNominatimStreetAddresses(cleanQuery, cleanCity, includeHouseNumber);
      const rankedNominatimResults = rankAddressSuggestions(cleanQuery, nominatimResults);
      const exactNominatimResults = includeHouseNumber
        ? rankedNominatimResults.filter((result) => hasHouseNumberQuery(result.address ?? ""))
        : rankedNominatimResults;
      return uniqueAddressResults([...exactNominatimResults, ...rankedNominatimResults]).slice(0, MAX_ADDRESS_RESULTS);
    } catch {
      return [];
    }
  }
}

async function searchPhotonStreetAddresses(
  query: string,
  city: string,
  includeHouseNumber: boolean
): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    q: `${query}, ${city}`,
    countrycode: "PL",
    limit: String(MAX_ADDRESS_RESULTS * 2),
    bbox: "14.07,49,24.15,54.84"
  });
  const layers = includeHouseNumber ? ["street", "house"] : ["street"];
  layers.forEach((layer) => params.append("layer", layer));

  const response = await fetch(`${PHOTON_API_URL}?${params}`, {
    headers: { "Accept-Language": "pl,en;q=0.7" }
  });
  if (!response.ok) throw new Error("Photon error");

  const data = (await response.json()) as { features?: PhotonFeature[] };
  return (data.features ?? [])
    .map((feature) => mapPhotonAddressResult(feature, city, includeHouseNumber))
    .filter(isGeocodingResult);
}

async function searchNominatimStreetAddresses(
  query: string,
  city: string,
  includeHouseNumber: boolean
): Promise<GeocodingResult[]> {
  const structuredParams = new URLSearchParams({
    street: query,
    city,
    country: "Polska",
    format: "json",
    countrycodes: "pl",
    addressdetails: "1",
    limit: String(MAX_ADDRESS_RESULTS),
    dedupe: "1",
    "accept-language": "pl"
  });
  const freeformParams = new URLSearchParams({
    q: `${query}, ${city}, Polska`,
    format: "json",
    countrycodes: "pl",
    addressdetails: "1",
    limit: String(MAX_ADDRESS_RESULTS),
    dedupe: "1",
    "accept-language": "pl"
  });

  const responses = await Promise.allSettled([
    fetchNominatimResults(structuredParams),
    fetchNominatimResults(freeformParams)
  ]);
  const results = responses.flatMap((response) => response.status === "fulfilled" ? response.value : []);
  if (!results.length) throw new Error("Nominatim error");

  return results
    .filter((result) => isResultInCity(result, city))
    .map((result) => mapNominatimStreetAddressResult(result, includeHouseNumber))
    .filter((result) => Boolean(result.address));
}

async function fetchNominatimResults(params: URLSearchParams) {
  const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!response.ok) throw new Error("Nominatim error");
  return (await response.json()) as NominatimResult[];
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
  const city = getResultCity(addr, true);
  const address = getResultAddress(addr);
  const voivodeship = formatVoivodeship(addr?.state);

  return {
    displayName: result.display_name,
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
    city,
    address,
    postalCode: addr?.postcode ?? null,
    voivodeship: voivodeship || null,
    county: formatAdministrativeName(addr?.county) || null,
    municipality: formatAdministrativeName(addr?.municipality) || null
  };
}

function mapNominatimStreetAddressResult(
  result: NominatimResult,
  includeHouseNumber: boolean
): GeocodingResult {
  const mapped = mapNominatimResult(result);
  if (!mapped.address || includeHouseNumber) return mapped;

  const streetOnly = removeTrailingHouseNumber(mapped.address);
  return {
    ...mapped,
    displayName: [streetOnly, mapped.city, mapped.voivodeship].filter(Boolean).join(", "),
    address: streetOnly
  };
}

function mapPolishCityResult(result: NominatimResult): GeocodingResult | null {
  const addr = result.address;
  const city = getResultCity(addr, true) ?? addr?.municipality ?? result.name ?? null;
  if (!city) return null;

  const latitude = parseFloat(result.lat);
  const longitude = parseFloat(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const voivodeship = formatVoivodeship(addr?.state);
  const county = formatAdministrativeName(addr?.county);
  const municipality = formatAdministrativeName(addr?.municipality);
  const suffix = [county, voivodeship].filter(Boolean).join(", ");
  return {
    displayName: suffix ? `${city}, ${suffix}` : city,
    latitude,
    longitude,
    city,
    address: null,
    postalCode: null,
    voivodeship: voivodeship || null,
    county: county || null,
    municipality: municipality || null
  };
}

function mapPhotonCityResult(feature: PhotonFeature): GeocodingResult | null {
  const coordinates = feature.geometry?.coordinates;
  const name = feature.properties.name?.trim();
  if (!name || !coordinates || feature.properties.countrycode !== "PL") return null;

  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const voivodeship = formatVoivodeship(feature.properties.state);
  return {
    displayName: [name, voivodeship].filter(Boolean).join(", "),
    latitude,
    longitude,
    city: name,
    address: null,
    postalCode: null,
    voivodeship: voivodeship || null,
    county: null,
    municipality: null
  };
}

function mapPhotonAddressResult(
  feature: PhotonFeature,
  expectedCity: string,
  includeHouseNumber: boolean
): GeocodingResult | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || feature.properties.countrycode !== "PL") return null;

  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const resultCity = feature.properties.city?.trim() || expectedCity;
  if (feature.properties.city && normalizeSearchText(feature.properties.city) !== normalizeSearchText(expectedCity)) {
    return null;
  }

  const street = feature.properties.street?.trim() || feature.properties.name?.trim();
  const houseNumber = feature.properties.housenumber?.trim();
  const address = includeHouseNumber
    ? [street, houseNumber].filter(Boolean).join(" ")
    : removeTrailingHouseNumber(street ?? "");
  if (!address) return null;

  const voivodeship = formatVoivodeship(feature.properties.state);
  return {
    displayName: [address, resultCity, voivodeship].filter(Boolean).join(", "),
    latitude,
    longitude,
    city: resultCity,
    address,
    postalCode: feature.properties.postcode ?? null,
    voivodeship: voivodeship || null,
    county: null,
    municipality: null
  };
}

function getResultCity(addr: NominatimAddress | undefined, includeVillage: boolean) {
  return addr?.city ?? addr?.town ?? (includeVillage ? addr?.village ?? addr?.hamlet : null) ?? null;
}

function getResultAddress(addr: NominatimAddress | undefined) {
  if (!addr?.road) return null;
  return addr.house_number ? `${addr.road} ${addr.house_number}` : addr.road;
}

function hasHouseNumberQuery(query: string) {
  return /\d/.test(query);
}

function removeTrailingHouseNumber(value: string) {
  return value.replace(/\s+\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?$/, "").trim();
}

function isResultInCity(result: NominatimResult, city: string) {
  const resultCity = getResultCity(result.address, true);
  if (!resultCity) return true;
  return normalizeSearchText(resultCity) === normalizeSearchText(city);
}

function isGeocodingResult(result: GeocodingResult | null): result is GeocodingResult {
  return Boolean(result);
}

function uniqueResults(results: GeocodingResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = [
      normalizeSearchText(result.city ?? ""),
      normalizeSearchText(result.address ?? ""),
      result.latitude.toFixed(5),
      result.longitude.toFixed(5)
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueAddressResults(results: GeocodingResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = [
      normalizeSearchText(result.city ?? ""),
      normalizeSearchText(result.address ?? result.displayName)
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findLocalCitySuggestions(query: string) {
  const normalizedQuery = normalizeSearchText(query);
  return rankCitySuggestions(query, POPULAR_POLISH_CITIES)
    .filter((result) => {
      const targets = getCitySearchTargets(result);
      return targets.some((target) => target.startsWith(normalizedQuery));
    })
    .slice(0, MAX_CITY_RESULTS);
}

function rankCitySuggestions(query: string, results: GeocodingResult[]) {
  const normalizedQuery = normalizeSearchText(query);
  return [...results]
    .map((result) => ({ result, score: scoreCitySuggestion(result, normalizedQuery) }))
    .filter((item) => item.score < Number.POSITIVE_INFINITY)
    .sort((a, b) => a.score - b.score || (a.result.city ?? a.result.displayName).localeCompare(b.result.city ?? b.result.displayName, "pl"))
    .map((item) => item.result);
}

function scoreCitySuggestion(result: GeocodingResult, normalizedQuery: string) {
  const targets = getCitySearchTargets(result);
  if (targets.some((target) => target === normalizedQuery)) return 0;
  if (targets.some((target) => target.startsWith(normalizedQuery))) return 1;
  if (targets.some((target) => target.split(/[-\s]/).some((part) => part.startsWith(normalizedQuery)))) return 2;
  if (targets.some((target) => target.includes(normalizedQuery))) return 3;
  return Number.POSITIVE_INFINITY;
}

function rankAddressSuggestions(query: string, results: GeocodingResult[]) {
  const normalizedQuery = normalizeSearchText(query);
  return [...results]
    .map((result) => ({ result, score: scoreAddressSuggestion(result, normalizedQuery) }))
    .filter((item) => item.score < Number.POSITIVE_INFINITY)
    .sort((a, b) => a.score - b.score || (a.result.address ?? a.result.displayName).localeCompare(b.result.address ?? b.result.displayName, "pl"))
    .map((item) => item.result);
}

function scoreAddressSuggestion(result: GeocodingResult, normalizedQuery: string) {
  const targets = Array.from(new Set([
    result.address,
    result.displayName
  ].filter((value): value is string => Boolean(value)).map(normalizeSearchText)));

  if (targets.some((target) => target === normalizedQuery)) return 0;
  if (targets.some((target) => target.startsWith(normalizedQuery))) return 1;
  if (targets.some((target) => target.split(/[-\s]/).some((part) => part.startsWith(normalizedQuery)))) return 2;
  if (targets.some((target) => target.includes(normalizedQuery))) return 3;
  return Number.POSITIVE_INFINITY;
}

function getCitySearchTargets(result: GeocodingResult) {
  return Array.from(new Set([
    result.city,
    result.displayName,
    result.voivodeship,
    result.county
  ].filter((value): value is string => Boolean(value)).map(normalizeSearchText)));
}

function createCityResult(city: string, latitude: number, longitude: number, voivodeship: string): GeocodingResult {
  return {
    displayName: `${city}, ${voivodeship}`,
    latitude,
    longitude,
    city,
    address: null,
    postalCode: null,
    voivodeship,
    county: null,
    municipality: null
  };
}

function formatAdministrativeName(value?: string) {
  if (!value) return "";
  return value
    .replace(/^wojew[oó]dztwo\s+/i, "")
    .replace(/\s+voivodeship$/i, "")
    .replace(/\s+county$/i, "")
    .replace(/^county\s+/i, "")
    .trim();
}

function formatVoivodeship(value?: string) {
  const normalized = formatAdministrativeName(value);
  if (!normalized) return "";
  const key = normalizeSearchText(normalized).replace(/-/g, " ").replace(/\s+/g, " ");
  return VOIVODESHIP_NAME_MAP[key] ?? normalized;
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
