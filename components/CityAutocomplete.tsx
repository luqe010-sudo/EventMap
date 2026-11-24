"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LocateFixed, MapPin } from "lucide-react";
import { knownLocations, type KnownLocation } from "@/lib/events";
import { normalizeText } from "@/lib/filters";
import { toSlug } from "@/lib/slugs";
import { isPhotonSettlement, uniqueSuggestionsByLabel } from "@/lib/location-suggestions";

type CityAutocompleteProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: KnownLocation) => void;
  onUseGPS?: () => void;
  onAllPolandSelect?: () => void;
  priorityLocations?: KnownLocation[];
  placeholder?: string;
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

const MAX_SUGGESTIONS = 8;
const NO_PRIORITY_LOCATIONS: KnownLocation[] = [];
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
  "podlachian": "podlaskie",
  "podlachian voivodeship": "podlaskie",
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
  id = "location",
  value,
  onChange,
  onSelect,
  onUseGPS,
  onAllPolandSelect,
  priorityLocations = NO_PRIORITY_LOCATIONS,
  placeholder = "Wpisz miejscowość…"
}: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<KnownLocation[]>(popularCitiesList);
  const [isLoading, setIsLoading] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const suggestionsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const normalizedInput = normalizeText(value);

  // Debounced Photon search-as-you-type for Polish places.
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = value.trim();
    setSearchUnavailable(false);
    if (trimmed.length < 2) {
      setSuggestions(uniqueSuggestionsByLabel([...popularCitiesList, ...priorityLocations]).slice(0, MAX_SUGGESTIONS));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    const localMatches = findLocalLocationSuggestions(trimmed, priorityLocations);
    setSuggestions(localMatches);

    const delayDebounce = setTimeout(async () => {
      try {
        const photonResults = await searchPhotonLocations(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        const rankedResults = rankLocationSuggestions(trimmed, photonResults);
        const mergedResults = uniqueSuggestionsByLabel(mergeLocationSuggestions(localMatches, rankedResults)).slice(0, MAX_SUGGESTIONS);
        setSuggestions(mergedResults);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch Photon places", err);
        setSearchUnavailable(true);
        setSuggestions(localMatches);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 350);

    return () => { clearTimeout(delayDebounce); controller.abort(); };
  }, [isOpen, priorityLocations, value]);

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (!isOpen) return;
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [isOpen, value]);

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
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      return;
    }
    if (event.key === "Enter" && isOpen) event.preventDefault();
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
    }
  }

  function highlightMatch(text: string): React.ReactNode {
    if (!normalizedInput) return text;
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

  const useLocation = () => {
    inputRef.current?.focus();
    onUseGPS?.();
    setIsOpen(false);
  };

  return (
    <div
      className="autocompleteContainer"
      ref={containerRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <span className="locationBoxPin" aria-hidden="true"><MapPin size={20} /></span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-label="Miejscowość"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls={isOpen ? suggestionsId : undefined}
        aria-activedescendant={isOpen && highlightIndex >= 0 && highlightIndex < suggestions.length ? `${suggestionsId}-${highlightIndex}` : undefined}
      />
      {onAllPolandSelect ? (
        <button
          type="button"
          className="locationBoxDropdownBtn"
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
            } else {
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
          aria-expanded={isOpen}
          aria-controls={isOpen ? suggestionsId : undefined}
          aria-label="Pokaż opcje lokalizacji"
        >
          <ChevronDown size={19} aria-hidden="true" />
        </button>
      ) : onUseGPS ? (
        <button
          type="button"
          className="locationBoxGpsBtn"
          onClick={useLocation}
          title="Użyj mojej lokalizacji"
          aria-label="Użyj mojej lokalizacji"
        >
          <LocateFixed size={18} aria-hidden="true" />
        </button>
      ) : null}
      {isOpen && (
        <div className="autocompleteDropdown">
          {onAllPolandSelect ? (
            <div className="autocompleteActions">
              <button
                type="button"
                className="autocompleteAction"
                onClick={() => {
                  inputRef.current?.focus();
                  onAllPolandSelect();
                  setIsOpen(false);
                }}
              >
                <MapPin size={16} aria-hidden="true" /> Cała Polska
              </button>
              {onUseGPS ? (
                <button type="button" className="autocompleteAction" onClick={useLocation}>
                  <LocateFixed size={16} aria-hidden="true" /> Moja lokalizacja
                </button>
              ) : null}
            </div>
          ) : null}
          {suggestions.length === 0 ? (
            <p className="autocompleteLoading" role="status">
              {isLoading ? "Wyszukiwanie miejscowości…" : searchUnavailable ? "Podpowiedzi są chwilowo niedostępne." : "Nie znaleziono miejscowości. Spróbuj pełnej nazwy."}
            </p>
          ) : null}
          <ul className="autocompleteSuggestions" id={suggestionsId} role="listbox" aria-label="Podpowiedzi miejscowości" aria-busy={isLoading} ref={listRef}>
            {suggestions.map((location, index) => (
              <li
                key={`${location.label}-${location.latitude}-${location.longitude}`}
                role="option"
                id={`${suggestionsId}-${index}`}
                aria-selected={index === highlightIndex}
                className={`autocompleteItem${index === highlightIndex ? " highlighted" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectLocation(location)}
                onMouseEnter={() => setHighlightIndex(index)}
              >
                <span className="autocompleteIcon" aria-hidden="true">📍</span>
                <span className="autocompleteName">{highlightMatch(location.label)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

async function searchPhotonLocations(query: string, signal: AbortSignal): Promise<KnownLocation[]> {
  const params = new URLSearchParams({
    q: query,
    countrycode: "PL",
    limit: String(MAX_SUGGESTIONS * 2),
    bbox: "14.07,49,24.15,54.84"
  });
  ["city", "locality"].forEach((layer) => params.append("layer", layer));

  const response = await fetch(`${PHOTON_API_URL}?${params.toString()}`, {
    signal,
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

function mapPhotonFeatureToLocation(feature: PhotonFeature): KnownLocation | null {
  const coordinates = feature.geometry?.coordinates;
  const name = feature.properties.name?.trim();

  if (!name || !coordinates || !isPhotonSettlement(feature.properties)) {
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
