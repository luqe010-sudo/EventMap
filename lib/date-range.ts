import { addDaysToDateKey, getDateKeyInAppTimeZone, toAppDate } from "./date-format";
import type { DateFilter } from "./filters";

export function normalizeDateInput(value?: string) {
  const key = value?.trim();
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : null;
}

export function resolveDateRange(dateFilter: DateFilter, customDate: string, now = new Date()): { start: Date; end: Date | null } {
  let from = getDateKeyInAppTimeZone(now);
  let to: string | null = addDaysToDateKey(from, 1);

  switch (dateFilter) {
    case "all": to = null; break;
    case "tomorrow":
      from = addDaysToDateKey(from, 1);
      to = addDaysToDateKey(from, 1);
      break;
    case "week": to = addDaysToDateKey(from, 7); break;
    case "weekend": {
      const day = new Date(`${from}T00:00:00Z`).getUTCDay();
      if (day !== 0 && day !== 6) from = addDaysToDateKey(from, 6 - day);
      to = addDaysToDateKey(from, day === 0 ? 1 : 2);
      break;
    }
    case "custom": {
      const [rawFrom, rawTo] = customDate.split("/");
      const first = normalizeDateInput(rawFrom);
      const last = normalizeDateInput(rawTo);
      if (first || last) {
        const keys = [first ?? last!, last ?? first!].sort();
        from = keys[0];
        to = addDaysToDateKey(keys[1], 1);
      }
      break;
    }
  }
  return { start: toAppDate(`${from}T00:00:00`), end: to ? toAppDate(`${to}T00:00:00`) : null };
}
