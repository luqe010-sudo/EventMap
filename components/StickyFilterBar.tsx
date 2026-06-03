"use client";

import { categoryEmojis, type EventCategory } from "@/lib/events";
import { formatPolishDate } from "@/lib/date-format";
import { type DateFilter } from "@/lib/filters";

type StickyFilterBarProps = {
  visible: boolean;
  locationLabel: string;
  dateFilter: DateFilter;
  customDate?: string;
  radiusKm: number;
  isAllPoland: boolean;
  category: EventCategory | "Wszystkie";
  onScrollToSearch: () => void;
};

const dateLabels: Record<DateFilter, string> = {
  today: "Dziś",
  tomorrow: "Jutro",
  weekend: "Weekend",
  week: "Ten tydzień",
  custom: "Wybrana data",
  all: "Wszystkie"
};

export default function StickyFilterBar({
  visible,
  locationLabel,
  dateFilter,
  customDate = "",
  radiusKm,
  isAllPoland,
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
          <span className="stickyFilterValue">{getDateFilterLabel(dateFilter, customDate)}</span>
        </button>
        <span className="stickyFilterDivider" />
        <button className="stickyFilterChip" onClick={onScrollToSearch} type="button">
          <span className="stickyFilterIcon">📏</span>
          <span className="stickyFilterValue">{isAllPoland ? "Cała Polska" : `${radiusKm} km`}</span>
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

function getDateFilterLabel(dateFilter: DateFilter, customDate: string) {
  if (dateFilter !== "custom") return dateLabels[dateFilter];

  const [from = "", to = ""] = customDate.split("/");
  if (from && to) return `${formatShortDate(from)} - ${formatShortDate(to)}`;
  if (from) return formatShortDate(from);
  if (to) return `do ${formatShortDate(to)}`;
  return dateLabels.custom;
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return formatPolishDate(date, {
    day: "2-digit",
    month: "2-digit"
  });
}
