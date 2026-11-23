import { addDaysToDateKey, toAppDate } from "./date-format";
import { normalizeDateInput } from "./date-range";
import { eventStatuses } from "./event-editor";

type OrganizerEventFilterParams = Partial<Record<"status" | "dateFrom" | "dateTo", string | string[]>>;

export function normalizeOrganizerEventFilters(params: OrganizerEventFilterParams) {
  const status = firstValue(params.status);
  return {
    status: eventStatuses.find(value => value === status),
    dateFrom: normalizeDateInput(firstValue(params.dateFrom)) ?? undefined,
    dateTo: normalizeDateInput(firstValue(params.dateTo)) ?? undefined
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Date-only organizer filters cover complete calendar days in Warsaw. */
export function organizerEventDateBounds(filters: { dateFrom?: string; dateTo?: string }) {
  const from = normalizeDateInput(filters.dateFrom);
  const through = normalizeDateInput(filters.dateTo);
  return {
    from: from ? toAppDate(`${from}T00:00:00`).toISOString() : null,
    until: through ? exclusiveEndOfDay(through) : null
  };
}

function exclusiveEndOfDay(date: string) {
  // The date parser accepts four-digit years. Use the last local second for the boundary into year 10000.
  if (date === "9999-12-31") return new Date(toAppDate(`${date}T23:59:59`).getTime() + 1000).toISOString();
  return toAppDate(`${addDaysToDateKey(date, 1)}T00:00:00`).toISOString();
}
