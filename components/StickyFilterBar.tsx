"use client";

import { categoryEmojis, type EventCategory } from "@/lib/events";
import { type DateFilter } from "@/lib/filters";

type StickyFilterBarProps = {
  visible: boolean;
  locationLabel: string;
  dateFilter: DateFilter;
  radiusKm: number;
  category: EventCategory | "Wszystkie";
  onScrollToSearch: () => void;
};

const dateLabels: Record<DateFilter, string> = {
  today: "Dziś",
  tomorrow: "Jutro",
  weekend: "Weekend",
  week: "Ten tydzień",
  custom: "Wybrana data"
};

export default function StickyFilterBar({
  visible,
  locationLabel,
  dateFilter,
  radiusKm,
  category,
  onScrollToSearch
}: StickyFilterBarProps) {
  return (
    <div className={`stickyFilterBar ${visible ? "stickyFilterBarVisible" : ""}`}>
      <div className="stickyFilterBarInner">
        <button className="stickyFilterChip" onClick={onScrollToSearch} type="button">
          <span className="stickyFilterIcon">📍</span>
          <span className="stickyFilterValue">{locationLabel}</span>
        </button>
        <span className="stickyFilterDivider" />
        <button className="stickyFilterChip" onClick={onScrollToSearch} type="button">
          <span className="stickyFilterIcon">📅</span>
          <span className="stickyFilterValue">{dateLabels[dateFilter]}</span>
        </button>
        <span className="stickyFilterDivider" />
        <button className="stickyFilterChip" onClick={onScrollToSearch} type="button">
          <span className="stickyFilterIcon">📏</span>
          <span className="stickyFilterValue">{radiusKm} km</span>
        </button>
        <span className="stickyFilterDivider" />
        <button className="stickyFilterChip" onClick={onScrollToSearch} type="button">
          <span className="stickyFilterIcon">🏷️</span>
          <span className="stickyFilterValue">
            {category === "Wszystkie" ? "Wszystkie" : `${categoryEmojis[category] ?? ""} ${category}`.trim()}
          </span>
        </button>
      </div>
    </div>
  );
}
