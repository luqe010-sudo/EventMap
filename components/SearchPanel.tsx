"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { CalendarDays, ChevronDown, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { type EventCategory, type CategoryOption, type KnownLocation } from "@/lib/events";
import { MAX_PRICE_FILTER_LIMIT, MAX_RADIUS_FILTER_LIMIT, type DateFilter, type PriceFilterMode } from "@/lib/filters";
import CityAutocomplete from "@/components/CityAutocomplete";
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
  locationMode: "city" | "radius";
  canSearchCity: boolean;
  hasLocationCenter: boolean;
  onLocationModeChange: (mode: "city" | "radius") => void;
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

const dateOptions: Array<{ label: string; shortLabel: string; value: DateFilter }> = [
  { label: "Wszystkie terminy", shortLabel: "Wszystkie", value: "all" },
  { label: "Dziś", shortLabel: "Dziś", value: "today" },
  { label: "Jutro", shortLabel: "Jutro", value: "tomorrow" },
  { label: "Najbliższy weekend", shortLabel: "Weekend", value: "weekend" },
  { label: "Ten tydzień", shortLabel: "Ten tydzień", value: "week" },
  { label: "Własny termin", shortLabel: "Własny termin", value: "custom" }
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
  locationMode,
  canSearchCity,
  hasLocationCenter,
  onLocationModeChange,
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const controlsId = useId();
  const [radiusInput, setRadiusInput] = useState(String(radiusKm));
  const [maxPriceInput, setMaxPriceInput] = useState(String(maxPrice));
  const isNearby = !isAllPoland && locationMode === "radius" && hasLocationCenter;
  const additionalFilterCount = Number(isNearby) + Number(priceMode !== "all") + Number(category !== "Wszystkie");
  const canAdjustRadius = !isAllPoland && hasLocationCenter;
  const hasLocationFeedback = !/^(Szukam |Przeglądasz |Pokazuję |Używam )/.test(locationStatus);

  useEffect(() => { setRadiusInput(String(radiusKm)); }, [radiusKm]);
  useEffect(() => { setMaxPriceInput(String(maxPrice)); }, [maxPrice]);

  function handleCustomDateFromChange(value: string) {
    const nextTo = customDateRange.to && value && customDateRange.to < value ? value : customDateRange.to;
    onCustomDateChange(serializeCustomDateRange(value, nextTo));
  }

  function handleCustomDateToChange(value: string) {
    const nextFrom = customDateRange.from && value && customDateRange.from > value ? value : customDateRange.from;
    onCustomDateChange(serializeCustomDateRange(nextFrom, value));
  }

  function handleMaxPriceInputChange(value: string) {
    setMaxPriceInput(value);
    onPriceModeChange("max");
    if (!value.trim()) return;
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) onMaxPriceChange(parsed);
  }

  function handleRadiusInputChange(value: string) {
    setRadiusInput(value);
    if (!value.trim()) return;
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) onRadiusChange(parsed);
  }

  const activeFilters: Array<{ key: string; label: string; clearLabel: string; onClear: () => void }> = [];
  if (!isAllPoland && locationInput.trim()) {
    activeFilters.push({
      key: "location",
      label: `${locationInput}${isNearby ? ` + ${radiusKm} km` : ""}`,
      clearLabel: "Usuń lokalizację i szukaj w całej Polsce",
      onClear: onAllPolandSelect
    });
  }
  if (dateFilter !== "all") {
    const dateLabel = dateFilter === "custom" && customDate
      ? formatDateRangeSummary(customDateRange.from, customDateRange.to)
      : dateOptions.find((option) => option.value === dateFilter)?.label ?? "Własny termin";
    activeFilters.push({ key: "date", label: dateLabel, clearLabel: "Usuń filtr terminu", onClear: () => onDateFilterChange("all") });
  }
  if (priceMode !== "all") {
    activeFilters.push({ key: "price", label: priceMode === "free" ? "Bezpłatne" : `Do ${maxPrice} zł`, clearLabel: "Usuń filtr ceny", onClear: () => onPriceModeChange("all") });
  }
  if (category !== "Wszystkie") {
    activeFilters.push({ key: "category", label: category, clearLabel: "Usuń filtr kategorii", onClear: () => onCategoryChange("Wszystkie") });
  }

  function handleClearAllFilters() {
    onLocationInputChange("");
    onAllPolandSelect();
    onDateFilterChange("all");
    onPriceModeChange("all");
    onCategoryChange("Wszystkie");
  }

  function handleSubmit() {
    if (onSubmit) onSubmit();
    else document.getElementById("events-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="discoverySearch" id="search-panel" aria-labelledby={`${controlsId}-heading`} data-advanced-open={advancedOpen}>
      <h2 className="discoverySearchHeading" id={`${controlsId}-heading`}>Znajdź wydarzenia</h2>

      <div className="discoverySearchControls">
        <div className="discoverySearchField discoverySearchLocation">
          <label className="discoverySearchLabel" htmlFor="location">Lokalizacja</label>
          <CityAutocomplete value={locationInput} onChange={onLocationInputChange} onSelect={onLocationSelect} onUseGPS={onUseGPS} priorityLocations={citySuggestions} />
          <p className={`discoverySearchStatus${hasLocationFeedback ? "" : " discoverySearchStatusQuiet"}`} role="status">{locationStatus}</p>
        </div>

        <div className="discoverySearchField discoverySearchDate" role="group" aria-labelledby={`${controlsId}-date-label`}>
          <span className="discoverySearchLabel" id={`${controlsId}-date-label`}>Kiedy?</span>
          <div className="discoverySearchSegments discoverySearchDateOptions">
            {dateOptions.map((option) => (
              <button type="button" key={option.value} aria-label={option.label} aria-pressed={dateFilter === option.value} onClick={() => onDateFilterChange(option.value)} title={option.value === "custom" ? option.label : undefined}>
                {option.value === "custom" ? <CalendarDays size={16} aria-hidden="true" /> : option.shortLabel}
              </button>
            ))}
          </div>
          {dateFilter === "custom" ? (
            <div className="discoverySearchDateRange">
              <label><span>Od</span><input type="date" value={customDateRange.from} max={customDateRange.to || undefined} onInput={(event) => handleCustomDateFromChange(event.currentTarget.value)} onChange={(event) => handleCustomDateFromChange(event.target.value)} /></label>
              <label><span>Do</span><input type="date" value={customDateRange.to} min={customDateRange.from || undefined} onInput={(event) => handleCustomDateToChange(event.currentTarget.value)} onChange={(event) => handleCustomDateToChange(event.target.value)} /></label>
            </div>
          ) : null}
        </div>

        <button type="button" className="discoverySearchToggle" aria-expanded={advancedOpen} aria-controls={`${controlsId}-advanced`} onClick={() => setAdvancedOpen(!advancedOpen)}>
          <SlidersHorizontal size={17} aria-hidden="true" />
          Filtry
          {additionalFilterCount > 0 ? <span className="discoverySearchFilterCount" aria-label={`Liczba aktywnych filtrów: ${additionalFilterCount}`}>{additionalFilterCount}</span> : null}
          <ChevronDown size={16} aria-hidden="true" />
        </button>

        <div className="discoverySearchAdvanced" id={`${controlsId}-advanced`}>
          <div className="discoverySearchField discoverySearchRadius" role="group" aria-labelledby={`${controlsId}-radius-label`}>
            <div className="discoverySearchFieldHeader">
              <span className="discoverySearchLabel" id={`${controlsId}-radius-label`}>Promień</span>
              <div className="discoverySearchSegments discoverySearchScope" role="group" aria-label="Obszar wyszukiwania">
                {!isAllPoland && canSearchCity ? <button type="button" aria-pressed={locationMode === "city"} onClick={() => onLocationModeChange("city")}>W mieście</button> : null}
                {!isAllPoland ? <button type="button" aria-pressed={locationMode === "radius"} disabled={!hasLocationCenter} onClick={() => onLocationModeChange("radius")}>W okolicy</button> : null}
                <button type="button" aria-pressed={isAllPoland} onClick={onAllPolandSelect}>Cała Polska</button>
              </div>
            </div>
            <div className="discoverySearchRangeRow">
              <input
                id={`${controlsId}-radius`} type="range" className="discoverySearchSlider" min={5} max={MAX_RADIUS_FILTER_LIMIT} step={5} value={radiusKm} disabled={!canAdjustRadius}
                onChange={(event) => onRadiusChange(Number(event.target.value))}
                style={{ "--discovery-range-progress": `${((radiusKm - 5) / (MAX_RADIUS_FILTER_LIMIT - 5)) * 100}%` } as CSSProperties}
                aria-label="Promień wyszukiwania w kilometrach" aria-valuetext={`${radiusKm} kilometrów`} aria-describedby={`${controlsId}-radius-help`}
              />
              <label className="discoverySearchNumber">
                <span>do</span>
                <input type="text" inputMode="decimal" value={radiusInput} aria-label="Promień w kilometrach" disabled={!canAdjustRadius}
                  onFocus={(event) => event.currentTarget.select()}
                  onBlur={() => { if (!radiusInput.trim()) setRadiusInput(String(radiusKm)); }}
                  onChange={(event) => handleRadiusInputChange(event.target.value)} />
                <span>km</span>
              </label>
            </div>
            <div className="discoverySearchRangeBounds"><span>5 km</span><span>{MAX_RADIUS_FILTER_LIMIT} km</span></div>
            <p className="discoverySearchHelp" id={`${controlsId}-radius-help`}>
              {isAllPoland ? "Wybierz miejscowość, aby ustawić promień." : !hasLocationCenter ? "Brak współrzędnych — dostępne wyszukiwanie w mieście." : locationMode === "city" ? "Zmień promień, aby szukać także w okolicy." : "Odległość od wybranej lokalizacji."}
            </p>
          </div>

          <div className="discoverySearchField discoverySearchPrice" role="group" aria-labelledby={`${controlsId}-price-label`}>
            <div className="discoverySearchFieldHeader">
              <span className="discoverySearchLabel" id={`${controlsId}-price-label`}>Cena</span>
              <div className="discoverySearchSegments discoverySearchPriceOptions" role="group" aria-label="Cena biletu">
                <button type="button" aria-pressed={priceMode === "free"} onClick={() => onPriceModeChange("free")}>Za darmo</button>
                <button type="button" aria-pressed={priceMode === "max"} onClick={() => onPriceModeChange("max")}>Do kwoty</button>
                <button type="button" aria-pressed={priceMode === "all"} onClick={() => onPriceModeChange("all")}>Bez limitu</button>
              </div>
            </div>
            <div className="discoverySearchRangeRow">
              <input type="range" className="discoverySearchSlider" min={0} max={MAX_PRICE_FILTER_LIMIT} step={10} value={maxPrice} disabled={priceMode !== "max"}
                onChange={(event) => onMaxPriceChange(Number(event.target.value))}
                style={{ "--discovery-range-progress": `${(maxPrice / MAX_PRICE_FILTER_LIMIT) * 100}%` } as CSSProperties}
                aria-label="Cena maksymalna" aria-valuetext={`${maxPrice} złotych`} />
              <label className="discoverySearchNumber">
                <span>do</span>
                <input type="text" inputMode="decimal" value={maxPriceInput} aria-label="Maksymalna cena w złotych" disabled={priceMode !== "max"}
                  onFocus={(event) => event.currentTarget.select()}
                  onBlur={() => { if (!maxPriceInput.trim()) setMaxPriceInput(String(maxPrice)); }}
                  onChange={(event) => handleMaxPriceInputChange(event.target.value)} />
                <span>zł</span>
              </label>
            </div>
            <div className="discoverySearchRangeBounds"><span>0 zł</span><span>{MAX_PRICE_FILTER_LIMIT} zł</span></div>
          </div>

          <fieldset className="discoverySearchCategories">
            <legend>Kategoria</legend>
            <div className="discoverySearchCategoryOptions" role="group" aria-label="Kategoria wydarzenia">
              <button type="button" aria-pressed={category === "Wszystkie"} onClick={() => onCategoryChange("Wszystkie")} style={{ "--discovery-category-color": "var(--brand)" } as CSSProperties}>
                <CategoryIcon iconName="Compass" size={17} color="var(--discovery-category-color)" />Wszystkie
              </button>
              {categories.map((option) => (
                <button type="button" key={option.id} aria-pressed={category === option.name} onClick={() => onCategoryChange(option.name)} style={{ "--discovery-category-color": option.color || "var(--brand)" } as CSSProperties}>
                  <CategoryIcon iconName={option.icon} size={17} color="var(--discovery-category-color)" />{option.name}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="discoverySearchFooter">
        <div className="discoverySearchSummary" aria-label="Wybrane filtry">
          <span className="discoverySearchSummaryLabel">Aktywne filtry:</span>
          <div className="discoverySearchSummaryItems">
            {activeFilters.length > 0 ? activeFilters.map((filter) => (
              <button type="button" key={filter.key} className="discoverySearchChip" onClick={filter.onClear} aria-label={filter.clearLabel}><span>{filter.label}</span><X size={14} aria-hidden="true" /></button>
            )) : <span className="discoverySearchSummaryEmpty">Brak aktywnych filtrów</span>}
          </div>
        </div>
        <div className="discoverySearchActions">
          <button type="button" className="discoverySearchClear" onClick={handleClearAllFilters} disabled={activeFilters.length === 0}><Trash2 size={15} aria-hidden="true" />Wyczyść wszystko</button>
          <button type="button" className="discoverySearchSubmit" onClick={handleSubmit}><Search size={18} aria-hidden="true" />Znajdź</button>
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

function formatDateRangeSummary(from: string, to: string) {
  const format = (value: string) => {
    const [year, month, day] = value.split("-");
    return `${day}.${month}.${year}`;
  };
  if (from && to) return from === to ? format(from) : `${format(from)} – ${format(to)}`;
  if (from) return `Od ${format(from)}`;
  if (to) return `Do ${format(to)}`;
  return "Własny termin";
}
