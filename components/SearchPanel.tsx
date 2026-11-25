"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, Gift, Layers, Music, Search, SlidersHorizontal, Smile, Tent, Trash2, Wheat, X } from "lucide-react";
import type { CategoryOption, EventCategory, KnownLocation } from "@/lib/events";
import { PUBLIC_EVENT_QUERY_MAX_LENGTH } from "@/lib/event-search";
import { MAX_PRICE_FILTER_LIMIT, MAX_RADIUS_FILTER_LIMIT, type DateFilter, type PriceFilterMode } from "@/lib/filters";
import { toPluralCategoryName, toPluralCategorySlug, toSlug } from "@/lib/slugs";
import CityAutocomplete from "@/components/CityAutocomplete";
import CategoryIcon from "@/components/CategoryIcon";

type SearchPanelProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onShowResults: () => void;
  advancedRequest?: number;
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
};

const DATE_OPTIONS: Array<{ label: string; value: DateFilter }> = [
  { label: "Wszystkie terminy", value: "all" },
  { label: "Dziś", value: "today" },
  { label: "Jutro", value: "tomorrow" },
  { label: "Ten weekend", value: "weekend" },
  { label: "Ten tydzień", value: "week" },
  { label: "Własny zakres", value: "custom" }
];

const QUICK_CATEGORIES = [
  { slug: "koncerty", icon: Music, color: "#f25ea8" },
  { slug: "festyny", icon: Tent, color: "#ffc52e" },
  { slug: "dozynki", icon: Wheat, color: "#ffb619" },
  { slug: "sport", icon: RunningIcon, color: "#00a5ff" },
  { slug: "kultura", icon: TheaterMaskIcon, color: "#dc59f7" },
  { slug: "rodzinne", icon: Smile, color: "#ffd34a", label: "Dla dzieci" }
];

const MOBILE_FILTER_QUERY = "(max-width: 760px)";

export default function SearchPanel({
  query,
  onQueryChange,
  onShowResults,
  advancedRequest = 0,
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
  onMaxPriceChange
}: SearchPanelProps) {
  const id = useId();
  const [advancedMode, setAdvancedMode] = useState<"inline" | "sheet" | null>(null);
  const handledRequest = useRef(0);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [radiusInput, setRadiusInput] = useState(String(radiusKm));
  const [maxPriceInput, setMaxPriceInput] = useState(String(maxPrice));
  const [dateFrom = "", dateTo = ""] = customDate.split("/");
  const isNearby = !isAllPoland && locationMode === "radius" && hasLocationCenter;
  const canAdjustRadius = !isAllPoland && hasLocationCenter;
  const hasLocationFeedback = !/^(Szukam |Przeglądasz |Pokazuję |Używam )/.test(locationStatus);
  const categoriesBySlug = new Map(categories.map((option) => [categorySlug(option), option]));
  const quickCategories = QUICK_CATEGORIES.flatMap((shortcut) => {
    const option = categoriesBySlug.get(shortcut.slug);
    return option ? [{ ...shortcut, option }] : [];
  });
  const hasSecondaryCategory = category !== "Wszystkie" && !quickCategories.some(({ option }) => option.name === category);
  const additionalFilterCount = Number(isNearby) + Number(priceMode !== "all") + Number(hasSecondaryCategory);
  const dateRangeLabel = formatDateRangeLabel(dateFrom, dateTo);
  const isAdvancedOpen = advancedMode !== null;
  const advancedId = `${id}-advanced`;

  useEffect(() => { setRadiusInput(String(radiusKm)); }, [radiusKm]);
  useEffect(() => { setMaxPriceInput(String(maxPrice)); }, [maxPrice]);

  useEffect(() => {
    if (!advancedRequest || handledRequest.current === advancedRequest) return;
    handledRequest.current = advancedRequest;
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAdvancedMode("sheet");
  }, [advancedRequest]);

  useEffect(() => {
    if (advancedMode === "inline") {
      closeRef.current?.focus({ preventScroll: true });
    }
    if (advancedMode !== "sheet") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [advancedMode]);

  function openAdvancedFilters(trigger: HTMLElement) {
    if (advancedMode) {
      closeAdvancedFilters();
      return;
    }
    triggerRef.current = trigger;
    setAdvancedMode(window.matchMedia(MOBILE_FILTER_QUERY).matches ? "sheet" : "inline");
  }

  function closeAdvancedFilters() {
    dialogRef.current?.close();
    setAdvancedMode(null);
    triggerRef.current?.focus({ preventScroll: true });
    triggerRef.current = null;
  }

  function changeDate(filter: DateFilter) {
    onDateFilterChange(filter);
    if (filter !== "custom") onCustomDateChange("");
  }

  const activeFilters = [
    query.trim() ? { key: "query", label: query.trim(), clear: () => onQueryChange("") } : null,
    !isAllPoland ? { key: "location", label: isNearby ? `${locationInput} + ${radiusKm} km` : locationInput, clear: onAllPolandSelect } : null,
    dateFilter !== "all" ? { key: "date", label: dateRangeLabel || DATE_OPTIONS.find(({ value }) => value === dateFilter)?.label, clear: () => changeDate("all") } : null,
    priceMode !== "all" ? { key: "price", label: priceMode === "free" ? "Za darmo" : `Do ${maxPrice} zł`, clear: () => onPriceModeChange("all") } : null,
    category !== "Wszystkie" ? { key: "category", label: toPluralCategoryName(category), clear: () => onCategoryChange("Wszystkie") } : null
  ];

  function clearFilters() {
    onQueryChange("");
    onLocationInputChange("");
    onAllPolandSelect();
    changeDate("all");
    onPriceModeChange("all");
    onCategoryChange("Wszystkie");
  }

  function updateDateRange(from: string, to: string) {
    onCustomDateChange(to ? `${from}/${to}` : from);
  }

  function renderLocation(inputId: string) {
    return (
      <CityAutocomplete
        id={inputId}
        value={locationInput}
        onChange={onLocationInputChange}
        onSelect={onLocationSelect}
        onUseGPS={onUseGPS}
        onAllPolandSelect={onAllPolandSelect}
        priorityLocations={citySuggestions}
        placeholder={isAllPoland ? "Cała Polska" : "Wpisz miejscowość…"}
      />
    );
  }

  function renderDatePicker(inputId: string, compact = false) {
    return (
      <div className="discoverySearchDatePicker">
        <CalendarDays size={20} aria-hidden="true" />
        <span className="discoverySearchDateLabel" aria-hidden="true">{dateOptionLabel(dateFilter, compact)}</span>
        <select id={inputId} value={dateFilter} onChange={(event) => {
          const next = event.target.value as DateFilter;
          changeDate(next);
          if (compact && next === "custom" && !isAdvancedOpen) openAdvancedFilters(event.currentTarget);
        }}>
          {DATE_OPTIONS.map(({ value }) => (
            <option key={value} value={value}>{dateOptionLabel(value, compact)}</option>
          ))}
        </select>
        <ChevronDown size={17} aria-hidden="true" />
      </div>
    );
  }

  function dateOptionLabel(value: DateFilter, compact: boolean) {
    if (compact && value === "all") return "Wybierz datę";
    if (compact && value === "custom" && dateRangeLabel) return dateRangeLabel;
    return DATE_OPTIONS.find((option) => option.value === value)?.label ?? "";
  }

  function renderCategory(option?: CategoryOption, quick = false) {
    const shortcut = option ? QUICK_CATEGORIES.find(({ slug }) => slug === categorySlug(option)) : null;
    const Icon = option ? shortcut?.icon : Layers;
    const name = option?.name ?? "Wszystkie";
    const selected = category === name;
    const label = option ? (quick && shortcut?.label) || toPluralCategoryName(name) : name;
    return (
      <button
        type="button"
        key={option?.id ?? "all"}
        className={quick && (!option || shortcut?.slug === "rodzinne") ? "discoverySearchDesktopShortcut" : undefined}
        aria-pressed={selected}
        onClick={() => onCategoryChange(selected ? "Wszystkie" : name)}
        style={categoryColor(shortcut?.color ?? option?.color ?? "var(--brand)")}
      >
        {Icon ? <Icon size={21} aria-hidden="true" /> : <CategoryIcon iconName={option?.icon} size={21} />}
        <span>{label}</span>
      </button>
    );
  }

  const locationFeedback = (
    <p className={`discoverySearchStatus${hasLocationFeedback ? "" : " discoverySearchVisuallyHidden"}`} role="status">{locationStatus}</p>
  );

  const advancedContents = (
    <>
      <div className="discoveryFilterHeader">
        <h2 id={`${id}-filter-heading`}>Filtry wydarzeń</h2>
        <button ref={closeRef} type="button" className="discoveryFilterClose" aria-label="Zamknij filtry" onClick={closeAdvancedFilters}><X size={21} aria-hidden="true" /></button>
      </div>

      {activeFilters.some(Boolean) ? (
        <div className="discoveryFilterChips" role="group" aria-label="Aktywne filtry">
          {activeFilters.map((filter) => filter?.label ? (
            <button key={filter.key} type="button" aria-label={`Usuń filtr ${filter.label}`} onClick={filter.clear}>
              <span>{filter.label}</span> <X size={14} aria-hidden="true" />
            </button>
          ) : null)}
        </div>
      ) : null}

      <div className="discoverySearchAdvanced">
        {advancedMode === "sheet" ? (
          <div className="discoverySearchField discoveryFilterLocation">
            <label className="discoverySearchLabel" htmlFor={`${id}-sheet-location`}>Lokalizacja</label>
            {renderLocation(`${id}-sheet-location`)}
            {locationFeedback}
          </div>
        ) : null}

        <fieldset className="discoveryFilterCategories">
          <legend>Kategoria</legend>
          <div className="discoverySearchCategoryOptions">
            {renderCategory()}
            {categories.map((option) => renderCategory(option))}
          </div>
        </fieldset>

        <div className="discoverySearchField discoveryFilterDates">
          <label className="discoverySearchLabel" htmlFor={`${id}-date-range`}>Termin</label>
          {renderDatePicker(`${id}-date-range`)}
          {dateFilter === "custom" ? (
            <div className="discoverySearchDateRange">
              <label>
                <span>Od</span>
                <input type="date" value={dateFrom} onChange={(event) => {
                  const value = event.target.value;
                  updateDateRange(value, dateTo && value > dateTo ? value : dateTo);
                }} />
              </label>
              <label>
                <span>Do</span>
                <input type="date" value={dateTo} onChange={(event) => {
                  const value = event.target.value;
                  updateDateRange(dateFrom && value && value < dateFrom ? value : dateFrom, value);
                }} />
              </label>
            </div>
          ) : null}
        </div>

        <fieldset className="discoverySearchField discoveryFilterRadius">
          <legend>Promień</legend>
          <div className="discoverySearchSegments" role="group" aria-label="Obszar wyszukiwania">
            {!isAllPoland && canSearchCity ? <button type="button" aria-pressed={locationMode === "city"} onClick={() => onLocationModeChange("city")}>W mieście</button> : null}
            {!isAllPoland ? <button type="button" aria-pressed={locationMode === "radius"} disabled={!hasLocationCenter} onClick={() => onLocationModeChange("radius")}>W okolicy</button> : null}
            <button type="button" aria-pressed={isAllPoland} onClick={onAllPolandSelect}>Cała Polska</button>
          </div>
          <div className="discoverySearchRangeRow">
            <input
              type="range" className="discoverySearchSlider" min={5} max={MAX_RADIUS_FILTER_LIMIT} step={1} value={radiusKm} disabled={!canAdjustRadius}
              onChange={(event) => onRadiusChange(Number(event.target.value))}
              style={{ "--discovery-range-progress": `${((radiusKm - 5) / (MAX_RADIUS_FILTER_LIMIT - 5)) * 100}%` } as CSSProperties}
              aria-label="Promień wyszukiwania" aria-valuetext={`${radiusKm} km`} aria-describedby={`${id}-radius-help`}
            />
            <label className="discoverySearchNumber">
              <input type="text" inputMode="numeric" value={radiusInput} aria-label="Promień w kilometrach" disabled={!canAdjustRadius}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={() => setRadiusInput(String(radiusKm))}
                onChange={(event) => {
                  const value = event.target.value;
                  setRadiusInput(value);
                  if (isWithinRange(value, 5, MAX_RADIUS_FILTER_LIMIT)) onRadiusChange(Number(value));
                }} />
              <span>km</span>
            </label>
          </div>
          <p className="discoverySearchHelp" id={`${id}-radius-help`}>
            {isAllPoland ? "Wybierz miejscowość, aby ustawić promień." : !hasLocationCenter ? "Lokalizacja bez współrzędnych. Możesz szukać w mieście." : "Odległość od wybranej lokalizacji."}
          </p>
        </fieldset>

        <fieldset className="discoverySearchField discoveryFilterPrice">
          <legend>Cena</legend>
          <div className="discoverySearchSegments" role="group" aria-label="Cena biletu">
            <button type="button" aria-pressed={priceMode === "all"} onClick={() => onPriceModeChange("all")}>Bez limitu</button>
            <button type="button" aria-pressed={priceMode === "free"} onClick={() => onPriceModeChange("free")}>Za darmo</button>
            <button type="button" aria-pressed={priceMode === "max"} onClick={() => onPriceModeChange("max")}>Do kwoty</button>
          </div>
          {priceMode === "max" ? (
            <div className="discoverySearchRangeRow">
              <input
                type="range" className="discoverySearchSlider" min={0} max={MAX_PRICE_FILTER_LIMIT} step={1} value={maxPrice}
                onChange={(event) => onMaxPriceChange(Number(event.target.value))}
                style={{ "--discovery-range-progress": `${(maxPrice / MAX_PRICE_FILTER_LIMIT) * 100}%` } as CSSProperties}
                aria-label="Maksymalna cena biletu" aria-valuetext={`${maxPrice} zł`}
              />
              <label className="discoverySearchNumber">
                <input type="text" inputMode="numeric" value={maxPriceInput} aria-label="Maksymalna cena w złotych"
                  onFocus={(event) => event.currentTarget.select()}
                  onBlur={() => setMaxPriceInput(String(maxPrice))}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMaxPriceInput(value);
                    if (isWithinRange(value, 0, MAX_PRICE_FILTER_LIMIT)) onMaxPriceChange(Number(value));
                  }} />
                <span>zł</span>
              </label>
            </div>
          ) : null}
        </fieldset>
      </div>

      <div className="discoveryFilterFooter">
        <button type="button" className="discoverySearchClear" onClick={clearFilters} disabled={!activeFilters.some(Boolean)}><Trash2 size={16} aria-hidden="true" />Wyczyść filtry</button>
        <button type="button" className="discoveryFilterDone" onClick={closeAdvancedFilters}>Gotowe</button>
      </div>
    </>
  );

  return (
    <section className="discoverySearch" id="search-panel" aria-labelledby={`${id}-heading`}>
      <h2 className="discoverySearchVisuallyHidden" id={`${id}-heading`}>Znajdź wydarzenia</h2>

      <form className="discoverySearchControls" onSubmit={(event) => {
        event.preventDefault();
        onShowResults();
      }}>
        <div className="discoverySearchField discoverySearchLocation">
          <label className="discoverySearchVisuallyHidden" htmlFor={`${id}-location`}>Lokalizacja</label>
          {renderLocation(`${id}-location`)}
          {locationFeedback}
        </div>

        <div className="discoverySearchField discoverySearchKeyword">
          <label className="discoverySearchVisuallyHidden" htmlFor={`${id}-query`}>Szukaj wydarzeń</label>
          <div className="discoverySearchKeywordInput">
            <Search size={21} aria-hidden="true" />
            <input id={`${id}-query`} type="search" maxLength={PUBLIC_EVENT_QUERY_MAX_LENGTH} placeholder="Szukaj wydarzeń, np. „jarmark”, „koncert”, „festiwal”…" value={query} onChange={(event) => onQueryChange(event.target.value)} />
            <button
              type="button" className="discoverySearchToggle" aria-label={additionalFilterCount ? `Filtry zaawansowane (${additionalFilterCount})` : "Filtry zaawansowane"}
              aria-expanded={isAdvancedOpen} aria-haspopup={advancedMode === "sheet" ? "dialog" : undefined} aria-controls={isAdvancedOpen ? advancedId : undefined}
              onClick={(event) => openAdvancedFilters(event.currentTarget)}
            >
              <SlidersHorizontal size={20} aria-hidden="true" />
              {additionalFilterCount > 0 ? <span className="discoverySearchFilterCount" aria-hidden="true">{additionalFilterCount}</span> : null}
            </button>
          </div>
        </div>

        <div className="discoverySearchField discoverySearchDate">
          <label className="discoverySearchVisuallyHidden" htmlFor={`${id}-date`}>Termin</label>
          {renderDatePicker(`${id}-date`, true)}
        </div>

        <button type="submit" className="discoverySearchSubmit"><Search size={20} aria-hidden="true" /> Szukaj</button>
      </form>

      <fieldset className="discoverySearchCategories">
        <legend className="discoverySearchVisuallyHidden">Szybkie filtry</legend>
        <div className="discoverySearchCategoryOptions">
          {renderCategory(undefined, true)}
          {quickCategories.map(({ option }) => renderCategory(option, true))}
          <button type="button" className="discoverySearchDesktopShortcut" aria-pressed={priceMode === "free"} onClick={() => onPriceModeChange(priceMode === "free" ? "all" : "free")} style={categoryColor("#22e0a0")}>
            <Gift size={21} aria-hidden="true" /><span>Za darmo</span>
          </button>
          <button type="button" className="discoverySearchDesktopShortcut" aria-pressed={dateFilter === "weekend"} onClick={() => changeDate(dateFilter === "weekend" ? "all" : "weekend")} style={categoryColor("#35aafd")}>
            <CalendarDays size={21} aria-hidden="true" /><span>Na weekend</span>
          </button>
          <button
            type="button" className="discoverySearchMore" aria-expanded={isAdvancedOpen} aria-haspopup="dialog" aria-controls={isAdvancedOpen ? advancedId : undefined}
            onClick={(event) => openAdvancedFilters(event.currentTarget)} style={categoryColor("var(--ink-secondary)")}
          >
            <MoreCategoriesIcon size={21} /><span>Więcej</span>
            {additionalFilterCount > 0 ? <span className="discoverySearchFilterCount" aria-hidden="true">{additionalFilterCount}</span> : null}
          </button>
        </div>
      </fieldset>

      {advancedMode === "inline" ? (
        <div
          className="discoveryFilterPanel discoveryFilterInline" id={advancedId} role="region" aria-labelledby={`${id}-filter-heading`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeAdvancedFilters();
            }
          }}
        >
          {advancedContents}
        </div>
      ) : null}
      {advancedMode === "sheet" ? createPortal(
        <dialog
          ref={dialogRef}
          className="discoveryFilterPanel discoveryFilterDialog"
          id={advancedId}
          aria-labelledby={`${id}-filter-heading`}
          onCancel={(event) => {
            event.preventDefault();
            closeAdvancedFilters();
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeAdvancedFilters();
          }}
        >
          {advancedContents}
        </dialog>,
        document.body
      ) : null}
    </section>
  );
}

function categorySlug(option: CategoryOption) {
  return toPluralCategorySlug(option.slug || toSlug(option.name));
}

function MoreCategoriesIcon({ size = 21 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="6.5" cy="6.5" r="3.4" /><circle cx="17.5" cy="6.5" r="3.4" /><circle cx="6.5" cy="17.5" r="3.4" /><circle cx="17.5" cy="17.5" r="3.4" /></svg>;
}

function TheaterMaskIcon({ size = 21 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 4.8c5-1.9 10-1.9 15 0v6.9c0 4.7-3.2 8-7.5 9.3-4.3-1.3-7.5-4.6-7.5-9.3V4.8Z" /><path d="M7.7 9.9c.9-.8 2.2-.9 3.1-.1M13.2 9.8c.9-.8 2.2-.7 3.1.1M8.9 15.7c1.8-1.5 4.4-1.5 6.2 0" /></svg>;
}

function RunningIcon({ size = 21 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="16.5" cy="3.5" r="2" /><path d="m8 9 4-3 4 5 4-1M12 6l-2 7 4 3-2 5M10 13l-4 4H2M5 7h3M3 11h3" /></svg>;
}

function categoryColor(color: string) {
  return { "--search-category-color": color } as CSSProperties;
}

function isWithinRange(value: string, min: number, max: number) {
  const parsed = Number(value);
  return /^\d+$/.test(value) && parsed >= min && parsed <= max;
}

function formatDateRangeLabel(from: string, to: string) {
  const dateLabel = (value: string) => value.split("-").slice(1).reverse().join(".");
  if (from && to && from !== to) return `${dateLabel(from)}–${dateLabel(to)}`;
  if (from) return to ? dateLabel(from) : `Od ${dateLabel(from)}`;
  return to ? `Do ${dateLabel(to)}` : "";
}
