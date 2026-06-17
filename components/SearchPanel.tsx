"use client";

import { useEffect, useState } from "react";
import { type EventCategory, type CategoryOption } from "@/lib/events";
import { MAX_PRICE_FILTER_LIMIT, type DateFilter, type PriceFilterMode } from "@/lib/filters";
import CityAutocomplete from "@/components/CityAutocomplete";
import type { KnownLocation } from "@/lib/events";
import CategoryIcon from "@/components/CategoryIcon";

type SearchPanelProps = {
  locationInput: string;
  onLocationInputChange: (value: string) => void;
  onLocationSelect: (location: KnownLocation) => void;
  onUseGPS: () => void;
  citySuggestions?: KnownLocation[];
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
  priceMode: PriceFilterMode;
  maxPrice: number;
  onPriceModeChange: (mode: PriceFilterMode) => void;
  onMaxPriceChange: (price: number) => void;
  onSubmit?: () => void;
};

const dateOptions: Array<{ label: string; value: DateFilter }> = [
  { label: "Wszystkie", value: "all" },
  { label: "Dziś", value: "today" },
  { label: "Jutro", value: "tomorrow" },
  { label: "Weekend", value: "weekend" },
  { label: "Ten tydzień", value: "week" },
  { label: "Wybierz datę", value: "custom" }
];

export default function SearchPanel({
  locationInput,
  onLocationInputChange,
  onLocationSelect,
  onUseGPS,
  citySuggestions,
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
  priceMode,
  maxPrice,
  onPriceModeChange,
  onMaxPriceChange,
  onSubmit,
}: SearchPanelProps) {
  const customDateRange = parseCustomDateRangeValue(customDate);
  const [radiusInput, setRadiusInput] = useState(String(radiusKm));
  const [maxPriceInput, setMaxPriceInput] = useState(String(maxPrice));
  const priceProgress = (maxPrice / MAX_PRICE_FILTER_LIMIT) * 100;
  const radiusProgress = ((radiusKm - 5) / (100 - 5)) * 100;

  useEffect(() => {
    setRadiusInput(String(radiusKm));
  }, [radiusKm]);

  useEffect(() => {
    setMaxPriceInput(String(maxPrice));
  }, [maxPrice]);

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

  function handleMaxPriceInputChange(value: string) {
    setMaxPriceInput(value);
    onPriceModeChange("max");

    if (!value.trim()) return;

    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      onMaxPriceChange(parsed);
    }
  }

  function handleRadiusInputChange(value: string) {
    setRadiusInput(value);

    if (!value.trim()) return;

    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      onRadiusChange(parsed);
    }
  }

  /* ── Active filters ── */
  const activeFilters: Array<{ key: string; label: string; onClear: () => void }> = [];
  if (locationInput.trim()) {
    activeFilters.push({ key: "loc", label: `📍 ${locationInput}`, onClear: () => onLocationInputChange("") });
  }
  if (!isAllPoland) {
    activeFilters.push({ key: "radius", label: `↔ ${radiusKm} km`, onClear: onAllPolandSelect });
  }
  if (dateFilter !== "all") {
    const dateLabel = dateOptions.find(d => d.value === dateFilter)?.label || dateFilter;
    activeFilters.push({ key: "date", label: `📅 ${dateLabel}`, onClear: () => onDateFilterChange("all") });
  }
  if (priceMode === "free") {
    activeFilters.push({ key: "price", label: "💰 Za darmo", onClear: () => onPriceModeChange("all") });
  } else if (priceMode === "max") {
    activeFilters.push({ key: "price", label: `💰 do ${maxPrice} zł`, onClear: () => onPriceModeChange("all") });
  }
  if (category !== "Wszystkie") {
    activeFilters.push({ key: "cat", label: `🏷 ${category}`, onClear: () => onCategoryChange("Wszystkie") });
  }

  function handleClearAllFilters() {
    onLocationInputChange("");
    onAllPolandSelect();
    onDateFilterChange("all");
    onPriceModeChange("all");
    onCategoryChange("Wszystkie");
  }

  return (
    <section className="searchPanel" id="search-panel" aria-label="Szukaj wydarzeń">
      {/* Top row: Lokalizacja | Promień | Kiedy? | Cena | Znajdź */}
      <div className="searchTopRow">
        <div className="searchSection searchSectionLoc">
          <div className="searchSectionHeader">
            <label className="searchLabel">Lokalizacja</label>
          </div>
          <div className="searchLocationControls">
            <CityAutocomplete
              value={locationInput}
              onChange={onLocationInputChange}
              onSelect={onLocationSelect}
              onUseGPS={onUseGPS}
              priorityLocations={citySuggestions}
            />
          </div>
        </div>

        <div className="searchSection searchSectionRadius">
          <div className="searchSectionHeader">
            <label className="searchLabel">Promień</label>
            <div className="searchCapsule">
              <button
                type="button"
                className={`capsuleItem ${isAllPoland ? "capsuleItemActive" : ""}`}
                onClick={onAllPolandSelect}
              >
                Cała Polska
              </button>
              <span className={`capsuleText ${!isAllPoland ? "capsuleTextActive" : ""}`}>
                {isAllPoland ? "bez limitu" : `${radiusKm} km`}
              </span>
            </div>
          </div>
          <div className="searchRadiusWrap">
            <input
              type="range"
              className="searchSlider"
              aria-label="Promień wyszukiwania w kilometrach"
              min={5}
              max={100}
              step={5}
              value={radiusKm}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, var(--brand) 0%, var(--brand) ${isAllPoland ? 100 : radiusProgress}%, rgba(0, 0, 0, 0.08) ${isAllPoland ? 100 : radiusProgress}%, rgba(0, 0, 0, 0.08) 100%)`
              }}
            />
            <label className="searchInlineInputLabel searchRadiusInputLabel">
              <span>do</span>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                value={radiusInput}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => {
                  if (!radiusInput.trim()) setRadiusInput(String(radiusKm));
                }}
                onChange={(e) => handleRadiusInputChange(e.target.value)}
              />
              <span>km</span>
            </label>
            <div className="searchRadiusLabels">
              <span>5 km</span>
              <span>100 km</span>
            </div>
          </div>
        </div>

        <div className="searchSection searchSectionDate">
          <div className="searchSectionHeader">
            <label className="searchLabel">Kiedy?</label>
          </div>
          <div className="searchDatePills searchCapsule">
            {dateOptions.map((option) => {
              const isActive = dateFilter === option.value;
              const isCustom = option.value === "custom";
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`capsuleItem ${isActive ? "capsuleItemActive" : ""}`}
                  onClick={() => onDateFilterChange(option.value)}
                  title={option.label}
                  aria-label={option.label}
                >
                  {isCustom ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="calendarIcon">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  ) : (
                    option.label
                  )}
                </button>
              );
            })}
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

        <div className="searchSection searchSectionPrice">
          <div className="searchSectionHeader">
            <label className="searchLabel">Cena</label>
            <div className="searchCapsule">
              <button
                type="button"
                className={`capsuleItem ${priceMode === "free" ? "capsuleItemActive" : ""}`}
                onClick={() => onPriceModeChange("free")}
              >
                Za darmo
              </button>
              <button
                type="button"
                className={`capsuleItem ${priceMode === "all" ? "capsuleItemActive" : ""}`}
                onClick={() => onPriceModeChange("all")}
              >
                Bez limitu
              </button>
              <span className={`capsuleText ${priceMode === "max" ? "capsuleTextActive" : ""}`}>
                {priceMode === "free" ? "darmowe" : priceMode === "all" ? "bez limitu" : `${maxPrice} zł`}
              </span>
            </div>
          </div>
          <div className="searchPriceWrap">
            <input
              type="range"
              className="searchSlider searchPriceSlider"
              min={0}
              max={MAX_PRICE_FILTER_LIMIT}
              step={10}
              value={maxPrice}
              onChange={(e) => {
                onPriceModeChange("max");
                onMaxPriceChange(Number(e.target.value));
              }}
              style={{
                background: `linear-gradient(to right, var(--brand) 0%, var(--brand) ${priceProgress}%, rgba(0, 0, 0, 0.08) ${priceProgress}%, rgba(0, 0, 0, 0.08) 100%)`
              }}
              aria-label="Cena maksymalna"
            />
            <label className="searchInlineInputLabel searchPriceInputLabel">
              <span>do</span>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                value={maxPriceInput}
                onFocus={(e) => {
                  onPriceModeChange("max");
                  e.currentTarget.select();
                }}
                onBlur={() => {
                  if (!maxPriceInput.trim()) setMaxPriceInput(String(maxPrice));
                }}
                onChange={(e) => handleMaxPriceInputChange(e.target.value)}
              />
              <span>zł</span>
            </label>
            <div className="searchPriceLabels">
              <span>0 zł</span>
              <span>{MAX_PRICE_FILTER_LIMIT} zł</span>
            </div>
          </div>
        </div>

      </div>

      {/* Category pills */}
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

      {/* Active filters bar */}
      <div className="searchActiveFilters">
        <span className="searchActiveFiltersLabel">Aktywne filtry:</span>
        <div className="searchActiveFiltersBox">
          {activeFilters.length > 0 ? (
            <div className="searchActiveFilterChips">
              {activeFilters.map((f) => (
                <span key={f.key} className="searchActiveFilterChip">
                  {f.label}
                  <button type="button" className="searchActiveFilterChipX" onClick={f.onClear} aria-label={`Usuń filtr ${f.label}`}>✕</button>
                </span>
              ))}
            </div>
          ) : (
            <span className="searchActiveFiltersEmpty">Brak aktywnych filtrów</span>
          )}
        </div>
        <div className="searchActiveFiltersActions">
          <button type="button" className="searchActiveFiltersClear" onClick={handleClearAllFilters}>
            🗑 Wyczyść wszystko
          </button>
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Znajdź
          </button>
        </div>
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

function getPriceLabel(priceMode: PriceFilterMode, maxPrice: number) {
  if (priceMode === "free") return "tylko darmowe";
  if (priceMode === "all") return "bez limitu";
  return `do ${maxPrice} zł`;
}
