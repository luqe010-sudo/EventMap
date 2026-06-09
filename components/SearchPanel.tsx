"use client";

import { type EventCategory, type CategoryOption } from "@/lib/events";
import { type DateFilter } from "@/lib/filters";
import CityAutocomplete from "@/components/CityAutocomplete";
import type { KnownLocation } from "@/lib/events";
import CategoryIcon from "@/components/CategoryIcon";

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
  isAllPoland: boolean;
  onRadiusChange: (radius: number) => void;
  onAllPolandSelect: () => void;
  category: EventCategory | "Wszystkie";
  categories: CategoryOption[];
  onCategoryChange: (category: EventCategory | "Wszystkie") => void;
  onSubmit?: () => void;
};

const dateOptions: Array<{ label: string; value: DateFilter; icon: string }> = [
  { label: "Wszystkie", value: "all", icon: "🌍" },
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
  isAllPoland,
  onRadiusChange,
  onAllPolandSelect,
  category,
  categories,
  onCategoryChange,
  onSubmit,
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
            <div className="searchRadiusActions">
              <button
                type="button"
                className={`searchScopeButton ${isAllPoland ? "searchScopeButtonActive" : ""}`}
                aria-pressed={isAllPoland}
                onClick={onAllPolandSelect}
              >
                Cała Polska
              </button>
              <span className="searchRadiusValue">{isAllPoland ? "bez limitu" : `${radiusKm} km`}</span>
            </div>
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
                background: `linear-gradient(to right, var(--brand) 0%, var(--brand) ${isAllPoland ? 100 : ((radiusKm - 5) / (100 - 5)) * 100}%, rgba(0, 0, 0, 0.08) ${isAllPoland ? 100 : ((radiusKm - 5) / (100 - 5)) * 100}%, rgba(0, 0, 0, 0.08) 100%)`
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

      {/* Bottom row: wrapped category pills */}
      <div className="searchCategoryRow">
        <button
          type="button"
          className={`catPill ${category === "Wszystkie" ? "catPillActive" : ""}`}
          style={
            category === "Wszystkie"
              ? {
                  color: "var(--brand)",
                  borderColor: "color-mix(in srgb, var(--brand) 30%, white)",
                  background: "color-mix(in srgb, var(--brand) 10%, white)",
                }
              : undefined
          }
          onClick={() => onCategoryChange("Wszystkie")}
        >
          <CategoryIcon iconName="Compass" size={17} color="var(--brand)" /> Wszystkie
        </button>
        {categories.map((cat) => {
          const isActive = category === cat.name;
          const catColor = cat.color || "var(--brand)";
          return (
            <button
              key={cat.id}
              type="button"
              className={`catPill ${isActive ? "catPillActive" : ""}`}
              style={
                isActive
                  ? {
                      color: catColor,
                      borderColor: `color-mix(in srgb, ${catColor} 30%, white)`,
                      background: `color-mix(in srgb, ${catColor} 10%, white)`,
                    }
                  : undefined
              }
              onClick={() => onCategoryChange(cat.name)}
            >
              <CategoryIcon iconName={cat.icon} size={17} color={catColor} /> {cat.name}
            </button>
          );
        })}
      </div>

      <div className="searchSubmitRow">
        <button
          type="button"
          className="searchSubmitBtn"
          onClick={() => {
            if (onSubmit) {
              onSubmit();
            } else {
              document.getElementById("events-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
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


