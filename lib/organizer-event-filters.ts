import { addDaysToDateKey, toAppDate } from "./date-format";
import { normalizeDateInput } from "./date-range";

/** Date-only organizer filters cover complete calendar days in Warsaw. */
export function organizerEventDateBounds(filters: { dateFrom?: string; dateTo?: string }) {
  const from = normalizeDateInput(filters.dateFrom);
  const through = normalizeDateInput(filters.dateTo);
  return {
    from: from ? toAppDate(`${from}T00:00:00`).toISOString() : null,
    until: through ? toAppDate(`${addDaysToDateKey(through, 1)}T00:00:00`).toISOString() : null
  };
}
