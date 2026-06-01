"use client";

import { useEffect, useRef, useState } from "react";
import { knownLocations, type KnownLocation } from "@/lib/events";
import { normalizeText } from "@/lib/filters";

type CityAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: KnownLocation) => void;
  onUseGPS?: () => void;
};

const popularCitiesList: KnownLocation[] = [
  { label: "Warszawa", aliases: ["warszawa"], latitude: 52.2297, longitude: 21.0122 },
  { label: "Kraków", aliases: ["krakow"], latitude: 50.0647, longitude: 19.945 },
  { label: "Wrocław", aliases: ["wroclaw"], latitude: 51.1079, longitude: 17.0385 },
  { label: "Poznań", aliases: ["poznan"], latitude: 52.4064, longitude: 16.9252 },
  { label: "Gdańsk", aliases: ["gdansk"], latitude: 54.352, longitude: 18.6466 },
  { label: "Łódź", aliases: ["lodz"], latitude: 51.7592, longitude: 19.456 },
  { label: "Katowice", aliases: ["katowice"], latitude: 50.2649, longitude: 19.0238 },
];

export default function CityAutocomplete({ value, onChange, onSelect, onUseGPS }: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<KnownLocation[]>(popularCitiesList);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const normalizedInput = normalizeText(value);

  // Debounced Nominatim Geocoding search for all cities in Poland
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions(popularCitiesList);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            trimmed
          )}&format=json&limit=6&countrycodes=pl&addressdetails=1`,
          {
            headers: {
              "User-Agent": "EventMapPolska-WebAgent/1.0"
            }
          }
        );
        if (!response.ok) throw new Error("Nominatim error");
        const data = await response.json();

        const results = data.map((item: any) => {
          const address = item.address || {};
          const city =
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            address.suburb ||
            item.name ||
            "Miejscowość";
          const state = address.state
            ? `woj. ${address.state.replace("województwo ", "")}`
            : "";

          // Formats e.g. "Srebrna Góra (woj. dolnośląskie)"
          const label = state ? `${city} (${state})` : city;

          return {
            label,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            aliases: [normalizeText(city)]
          };
        });

        // Filter duplicates
        const uniqueResults: KnownLocation[] = [];
        const seen = new Set();
        for (const res of results) {
          if (!seen.has(res.label)) {
            seen.add(res.label);
            uniqueResults.push(res);
          }
        }

        setSuggestions(uniqueResults.length > 0 ? uniqueResults : popularCitiesList);
      } catch (err) {
        console.error("Failed to fetch coordinates", err);
        // Fallback to local static locations list
        const filtered = knownLocations
          .filter((loc) => {
            const targets = [loc.label, ...loc.aliases].map(normalizeText);
            return targets.some((t) => t.includes(normalizeText(trimmed)));
          })
          .slice(0, 6);
        setSuggestions(filtered.length > 0 ? filtered : popularCitiesList);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [value]);

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
                key={loc.label}
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
