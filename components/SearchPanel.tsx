"use client";

import { type EventCategory } from "@/lib/events";
import { type DateFilter } from "@/lib/filters";
import CityAutocomplete from "@/components/CityAutocomplete";
import type { KnownLocation } from "@/lib/events";

type SearchPanelProps = {
  locationInput: string;
  onLocationInputChange: (value: string) => void;
  onLocationSelect: (location: KnownLocation) => void;
  onUseGPS: () => void;
  locationStatus: string;
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  customDate: string;
  onCustomDateChange: (date: string) => void;
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  category: EventCategory | "Wszystkie";
  categories: EventCategory[];
  onCategoryChange: (category: EventCategory | "Wszystkie") => void;
};

const dateOptions: Array<{ label: string; value: DateFilter; icon: string }> = [
  { label: "Dziś", value: "today", icon: "📅" },
  { label: "Jutro", value: "tomorrow", icon: "📆" },
  { label: "Weekend", value: "weekend", icon: "🎉" },
  { label: "Ten tydzień", value: "week", icon: "🗓️" },
  { label: "Wybierz datę", value: "custom", icon: "📋" }
];

export default function SearchPanel({
  locationInput,
  onLocationInputChange,
  onLocationSelect,
  onUseGPS,
  locationStatus,
  dateFilter,
  onDateFilterChange,
  customDate,
  onCustomDateChange,
  radiusKm,
  onRadiusChange,
  category,
  categories,
  onCategoryChange,
}: SearchPanelProps) {
  const customDateRange = parseCustomDateRangeValue(customDate);

  function handleCustomDateFromChange(value: string) {
    const nextTo = customDateRange.to && value && customDateRange.to < value
      ? value
      : customDateRange.to;
    onCustomDateChange(serializeCustomDateRange(value, nextTo));
  }

  function handleCustomDateToChange(value: string) {
    const nextFrom = customDateRange.from && value && customDateRange.from > value
      ? value
      : customDateRange.from;
    onCustomDateChange(serializeCustomDateRange(nextFrom, value));
  }

  return (
    <section className="searchPanel" id="search-panel" aria-label="Szukaj wydarzeń">
      {/* Top row: Location | Radius | Date | Category dropdown — all in one line */}
      <div className="searchTopRow">
        <div className="searchGroup searchGroupLoc">
          <label className="searchLabel">Lokalizacja</label>
          <div className="searchLocationControls">
            <CityAutocomplete
              value={locationInput}
              onChange={onLocationInputChange}
              onSelect={onLocationSelect}
              onUseGPS={onUseGPS}
            />
          </div>
        </div>

        <div className="searchGroup searchGroupRadius">
          <div className="searchRadiusHeader">
            <label className="searchLabel">Promień</label>
            <span className="searchRadiusValue">{radiusKm} km</span>
          </div>
          <div className="searchRadiusWrap">
            <input
              type="range"
              className="searchSlider"
              min={5}
              max={100}
              step={5}
              value={radiusKm}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, var(--brand) 0%, var(--brand) ${((radiusKm - 5) / (100 - 5)) * 100}%, rgba(0, 0, 0, 0.08) ${((radiusKm - 5) / (100 - 5)) * 100}%, rgba(0, 0, 0, 0.08) 100%)`
              }}
            />
            <div className="searchRadiusLabels">
              <span>5 km</span>
              <span>100 km</span>
            </div>
          </div>
        </div>

        <div className="searchGroup searchGroupDate">
          <label className="searchLabel">Kiedy?</label>
          <div className="searchDatePills">
            {dateOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`datePill ${dateFilter === option.value ? "datePillActive" : ""}`}
                onClick={() => onDateFilterChange(option.value)}
              >
                {option.label}
                {option.value === "custom" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          {dateFilter === "custom" && (
            <div className="dateRangeFields">
              <label className="dateRangeField">
                <span>Od</span>
                <input
                  className="searchCustomDate"
                  type="date"
                  value={customDateRange.from}
                  max={customDateRange.to || undefined}
                  onChange={(e) => handleCustomDateFromChange(e.target.value)}
                />
              </label>
              <label className="dateRangeField">
                <span>Do</span>
                <input
                  className="searchCustomDate"
                  type="date"
                  value={customDateRange.to}
                  min={customDateRange.from || undefined}
                  onChange={(e) => handleCustomDateToChange(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

      </div>

      {/* Bottom row: horizontal scrolling category pills */}
      <div className="searchCategoryRow">
        <button
          type="button"
          className={`catPill ${category === "Wszystkie" ? "catPillActive" : ""}`}
          onClick={() => onCategoryChange("Wszystkie")}
        >
          <CategoryIcon name="Wszystkie" /> Wszystkie
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`catPill ${category === cat ? "catPillActive" : ""}`}
            onClick={() => onCategoryChange(cat)}
          >
            <CategoryIcon name={cat} /> {cat}
          </button>
        ))}
      </div>

      <div className="searchSubmitRow">
        <button
          type="button"
          className="searchSubmitBtn"
          onClick={() => {
            document.getElementById("events-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          Znajdź
        </button>
      </div>
    </section>
  );
}

function parseCustomDateRangeValue(value: string) {
  const [from = "", to = ""] = value.split("/");
  return { from, to };
}

function serializeCustomDateRange(from: string, to: string) {
  if (from && to) return `${from}/${to}`;
  if (to) return `/${to}`;
  return from;
}

function CategoryIcon({ name }: { name: EventCategory | "Wszystkie" }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", "aria-hidden": true } as const;

  if (name === "Koncert") {
    return <svg {...common} className="catIcon catIconConcert"><path d="M9 18V5l10-2v13" /><circle cx="7" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>;
  }
  if (name === "Festyn") {
    return <svg {...common} className="catIcon catIconFestyn"><path d="M4 19h16L12 5 4 19Z" /><path d="M12 5v14M7 14h10" /></svg>;
  }
  if (name === "Dożynki") {
    return <svg {...common} className="catIcon catIconDozynki"><path d="M12 21V5" /><path d="M12 9C8 8 6 6 5 3c4 0 6 2 7 6ZM12 14c4-1 6-3 7-6-4 0-6 2-7 6ZM12 18c-4-1-6-3-7-6 4 0 6 2 7 6Z" /></svg>;
  }
  if (name === "Sport") {
    return <svg {...common} className="catIcon catIconSport"><circle cx="12" cy="12" r="8" /><path d="m8 6 4 4 4-4M4.5 13h5L8 18M19.5 13h-5l1.5 5" /></svg>;
  }
  if (name === "Rodzina") {
    return <svg {...common} className="catIcon catIconRodzina"><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M4 20c.7-3.8 3-6 6-6s5.3 2.2 6 6M14 19c.5-2.5 2-4 4-4 1.7 0 3 1.1 3.6 3" /></svg>;
  }
  if (name === "Targi") {
    return <svg {...common} className="catIcon catIconTargi"><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0M5 8h14" /></svg>;
  }
  if (name === "Motoryzacja") {
    return <svg {...common} className="catIcon catIconMoto"><path d="M5 15h14l-2-5H7l-2 5Z" /><path d="M7 15v3M17 15v3" /><circle cx="8" cy="18" r="2" /><circle cx="16" cy="18" r="2" /></svg>;
  }
  if (name === "Kultura") {
    return <svg {...common} className="catIcon catIconKultura"><path d="M6 5c4 0 6 2 6 5 0-3 2-5 6-5v13c-4 0-6 1.2-6 3 0-1.8-2-3-6-3V5Z" /><path d="M12 10v11" /></svg>;
  }
  if (name === "Inne") {
    return <svg {...common} className="catIcon catIconInne"><path d="M12 3v18M5 8l14 8M19 8 5 16" /></svg>;
  }

  return <svg {...common} className="catIcon catIconAll"><path d="M12 3 14.4 9.6 21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" /></svg>;
}
