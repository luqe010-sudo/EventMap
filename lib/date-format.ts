export const APP_TIME_ZONE = "Europe/Warsaw";

export function formatPolishDate(value: string | Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: APP_TIME_ZONE,
    ...options
  }).format(toAppDate(value));
}

export function getDateKeyInAppTimeZone(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(toAppDate(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

export function dateTimeLocalToUtcIso(value: string, timeZone = APP_TIME_ZONE) {
  if (hasExplicitTimeZone(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const date = dateTimeLocalToUtcDate(value, timeZone);
  return date ? date.toISOString() : null;
}

export function toAppDate(value: string | Date) {
  if (value instanceof Date) return value;

  const text = value.trim();
  if (!text) return new Date(Number.NaN);

  if (hasExplicitTimeZone(text)) {
    return new Date(text);
  }

  return dateTimeLocalToUtcDate(text, APP_TIME_ZONE) ?? new Date(text);
}

function dateTimeLocalToUtcDate(value: string, timeZone: string) {
  const parts = parseDateTimeLocal(value);
  if (!parts) return null;

  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  let utcDate = new Date(utcGuess - offset);

  const correctedOffset = getTimeZoneOffsetMs(utcDate, timeZone);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    utcDate = new Date(utcGuess - offset);
  }

  return utcDate;
}

function parseDateTimeLocal(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? "0"),
    minute: Number(match[5] ?? "0"),
    second: Number(match[6] ?? "0")
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).map((part) => [part.type, part.value])
  );

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
}

function hasExplicitTimeZone(value: string) {
  return /[tT\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/.test(value);
}
