"use client";

import { useEffect, useRef, useState } from "react";
import { knownLocations, type KnownLocation } from "@/lib/events";
import { normalizeText } from "@/lib/filters";
import { toSlug } from "@/lib/slugs";

type CityAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: KnownLocation) => void;
  onUseGPS?: () => void;
  priorityLocations?: KnownLocation[];
};

type PhotonFeature = {
  type: "Feature";
  properties: {
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
  geometry?: {
    type: "Point";
    coordinates: [number, number];
  };
};

type NominatimResult = {
  lat: string;
  lon: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    state?: string;
  };
};

const MAX_SUGGESTIONS = 8;
const PHOTON_API_URL = "https://photon.komoot.io/api";
const VOIVODESHIP_NAME_MAP: Record<string, string> = {
  "lower silesian": "dolnośląskie",
  "lower silesian voivodeship": "dolnośląskie",
  "dolnoslaskie": "dolnośląskie",
  "kuyavian pomeranian": "kujawsko-pomorskie",
  "kuyavian pomeranian voivodeship": "kujawsko-pomorskie",
  "kujawsko pomorskie": "kujawsko-pomorskie",
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
  "greater poland": "wielkopolskie",
  "greater poland voivodeship": "wielkopolskie",
  "wielkopolskie": "wielkopolskie",
  "west pomeranian": "zachodniopomorskie",
  "west pomeranian voivodeship": "zachodniopomorskie",
  "zachodniopomorskie": "zachodniopomorskie"
};

const popularCitiesList: KnownLocation[] = [
  { label: "Warszawa", aliases: ["warszawa"], slug: "warszawa", latitude: 52.2297, longitude: 21.0122 },
  { label: "Kraków", aliases: ["krakow"], slug: "krakow", latitude: 50.0647, longitude: 19.945 },
  { label: "Wrocław", aliases: ["wroclaw"], slug: "wroclaw", latitude: 51.1079, longitude: 17.0385 },
  { label: "Poznań", aliases: ["poznan"], slug: "poznan", latitude: 52.4064, longitude: 16.9252 },
  { label: "Gdańsk", aliases: ["gdansk"], slug: "gdansk", latitude: 54.352, longitude: 18.6466 },
  { label: "Łódź", aliases: ["lodz"], slug: "lodz", latitude: 51.7592, longitude: 19.456 },
  { label: "Katowice", aliases: ["katowice"], slug: "katowice", latitude: 50.2649, longitude: 19.0238 },
];

export default function CityAutocomplete({
  value,
  onChange,
  onSelect,
  onUseGPS,
  priorityLocations = []
}: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<KnownLocation[]>(popularCitiesList);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const normalizedInput = normalizeText(value);

  // Debounced Photon search-as-you-type for Polish places.
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions(popularCitiesList);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const localMatches = findLocalLocationSuggestions(trimmed, priorityLocations);
    if (localMatches.length > 0) {
      setSuggestions(localMatches);
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const photonResults = await searchPhotonLocations(trimmed);
        const rankedResults = rankLocationSuggestions(trimmed, photonResults);
        const mergedResults = mergeLocationSuggestions(localMatches, rankedResults).slice(0, MAX_SUGGESTIONS);
        setSuggestions(mergedResults.length > 0 ? mergedResults : popularCitiesList);
      } catch (err) {
        console.error("Failed to fetch Photon places", err);
        const fallbackResults = await searchFallbackLocations(trimmed, localMatches);
        setSuggestions(fallbackResults.length > 0 ? fallbackResults : popularCitiesList);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [priorityLocations, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [value]);

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  function selectLocation(location: KnownLocation) {
    onChange(location.label);
    onSelect(location);
    setIsOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) {
      if (event.key === "ArrowDown" && suggestions.length > 0) {
        setIsOpen(true);
        setHighlightIndex(0);
        event.preventDefault();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        break;
      case "Enter":
        event.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
          selectLocation(suggestions[highlightIndex]);
        } else if (suggestions.length === 1) {
          selectLocation(suggestions[0]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
    }
  }

  function highlightMatch(text: string): React.ReactNode {
    const normalized = normalizeText(text);
    const idx = normalized.indexOf(normalizedInput);
    if (idx === -1) return text;

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + normalizedInput.length);
    const after = text.slice(idx + normalizedInput.length);

    return (
      <>
        {before}
        <strong>{match}</strong>
        {after}
      </>
    );
  }

  return (
    <div className="autocompleteContainer" ref={containerRef}>
      <span className="locationBoxPin">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand)" }}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="var(--brand-light)" />
          <circle cx="12" cy="10" r="3" fill="var(--brand)" />
        </svg>
      </span>
      <input
        id="location"
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Wpisz miejscowość…"
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen && (suggestions.length > 0 || isLoading)}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls="city-suggestions"
      />
      {onUseGPS && (
        <button
          type="button"
          className="locationBoxGpsBtn"
          onClick={onUseGPS}
          title="Użyj mojej lokalizacji"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}
      {isOpen && (suggestions.length > 0 || isLoading) && (
        <ul
          id="city-suggestions"
          className="autocompleteDropdown"
          role="listbox"
          ref={listRef}
        >
          {isLoading ? (
            <li className="autocompleteLoading">Wyszukiwanie miejscowości…</li>
          ) : (
            suggestions.map((loc, idx) => (
              <li
                key={`${loc.label}-${loc.latitude}-${loc.longitude}`}
                role="option"
                aria-selected={idx === highlightIndex}
                className={`autocompleteItem ${idx === highlightIndex ? "highlighted" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectLocation(loc);
                }}
                onMouseEnter={() => setHighlightIndex(idx)}
              >
                <span className="autocompleteIcon">📍</span>
                <span className="autocompleteName">{highlightMatch(loc.label)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

async function searchPhotonLocations(query: string): Promise<KnownLocation[]> {
  const params = new URLSearchParams({
    q: query,
    countrycode: "PL",
    limit: String(MAX_SUGGESTIONS * 2),
    bbox: "14.07,49,24.15,54.84"
  });
  ["city", "locality", "district"].forEach((layer) => params.append("layer", layer));

  const response = await fetch(`${PHOTON_API_URL}?${params.toString()}`, {
    headers: {
      "Accept-Language": "pl,en;q=0.7"
    }
  });
  if (!response.ok) throw new Error("Photon error");

  const data = (await response.json()) as { features?: PhotonFeature[] };
  return (data.features ?? [])
    .map(mapPhotonFeatureToLocation)
    .filter((location): location is KnownLocation => Boolean(location));
}

async function searchFallbackLocations(query: string, localMatches: KnownLocation[]) {
  if (localMatches.length > 0) return localMatches;

  try {
    const nominatimResults = await searchNominatimLocations(query);
    return rankLocationSuggestions(query, nominatimResults);
  } catch (err) {
    console.error("Failed to fetch Nominatim places", err);
    return findLocalLocationSuggestions(query, knownLocations);
  }
}

async function searchNominatimLocations(query: string): Promise<KnownLocation[]> {
  const params = new URLSearchParams({
    q: `${query}, Polska`,
    format: "json",
    limit: String(MAX_SUGGESTIONS),
    countrycodes: "pl",
    addressdetails: "1"
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  if (!response.ok) throw new Error("Nominatim error");

  const data = (await response.json()) as NominatimResult[];
  return data
    .map(mapNominatimResultToLocation)
    .filter((location): location is KnownLocation => Boolean(location));
}

function mapPhotonFeatureToLocation(feature: PhotonFeature): KnownLocation | null {
  const coordinates = feature.geometry?.coordinates;
  const name = feature.properties.name?.trim();

  if (!name || !coordinates) {
    return null;
  }

  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const state = formatVoivodeship(feature.properties.state);
  const label = state ? `${name} (${state})` : name;
  const citySlug = toSlug(name);

  return {
    label,
    latitude,
    longitude,
    aliases: Array.from(new Set([
      citySlug,
      normalizeText(name),
      normalizeText(label),
      feature.properties.city ? normalizeText(feature.properties.city) : null,
      feature.properties.county ? normalizeText(feature.properties.county) : null
    ].filter((value): value is string => Boolean(value)))),
  };
}

function mapNominatimResultToLocation(item: NominatimResult): KnownLocation | null {
  const address = item.address || {};
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.suburb ||
    item.name;

  if (!city) return null;

  const latitude = parseFloat(item.lat);
  const longitude = parseFloat(item.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const state = formatVoivodeship(address.state);
  const label = state ? `${city} (${state})` : city;
  const citySlug = toSlug(city);

  return {
    label,
    latitude,
    longitude,
    aliases: Array.from(new Set([citySlug, normalizeText(city), normalizeText(label)].filter(Boolean))),
  };
}

function formatVoivodeship(value?: string) {
  if (!value) return "";
  const normalized = value
    .replace(/^wojew[oó]dztwo\s+/i, "")
    .replace(/\s+voivodeship$/i, "")
    .trim();
  if (!normalized) return "";

  const key = normalizeText(normalized).replace(/-/g, " ").replace(/\s+/g, " ");
  const polishName = VOIVODESHIP_NAME_MAP[key] ?? normalized;
  return `woj. ${polishName}`;
}

function findLocalLocationSuggestions(query: string, priorityLocations: KnownLocation[]) {
  const queryNorm = normalizeText(query);
  const querySlug = toSlug(query);
  const pool = mergeLocationSuggestions(priorityLocations, knownLocations, popularCitiesList);

  return pool
    .map((location) => ({ location, score: scoreLocationMatch(location, queryNorm, querySlug) }))
    .filter((item) => item.score < Number.POSITIVE_INFINITY)
    .sort((a, b) => a.score - b.score || a.location.label.localeCompare(b.location.label, "pl"))
    .map((item) => item.location)
    .slice(0, MAX_SUGGESTIONS);
}

function rankLocationSuggestions(query: string, locations: KnownLocation[]) {
  const queryNorm = normalizeText(query);
  const querySlug = toSlug(query);

  return locations
    .map((location) => ({ location, score: scoreLocationMatch(location, queryNorm, querySlug) }))
    .sort((a, b) => a.score - b.score || a.location.label.localeCompare(b.location.label, "pl"))
    .map((item) => item.location);
}

function scoreLocationMatch(location: KnownLocation, queryNorm: string, querySlug: string) {
  const targets = getLocationSearchTargets(location);

  if (targets.some((target) => target === queryNorm || target === querySlug)) return 0;
  if (targets.some((target) => target.startsWith(queryNorm) || target.startsWith(querySlug))) return 1;
  if (targets.some((target) => target.split(/[-\s]/).some((part) => part.startsWith(queryNorm) || part.startsWith(querySlug)))) return 2;
  if (targets.some((target) => target.includes(queryNorm) || target.includes(querySlug))) return 3;

  return Number.POSITIVE_INFINITY;
}

function getLocationSearchTargets(location: KnownLocation) {
  return Array.from(new Set([
    normalizeText(location.label),
    toSlug(location.label),
    location.slug,
    ...location.aliases
  ].filter((value): value is string => Boolean(value))));
}

function mergeLocationSuggestions(...groups: KnownLocation[][]) {
  const results: KnownLocation[] = [];
  const seen = new Set<string>();

  for (const location of groups.flat()) {
    const key = location.slug || toSlug(location.label) || normalizeText(location.label);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(location);
  }

  return results;
}
