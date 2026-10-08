import { toAppDate } from "./date-format";

export function eventOverlapsWindow(start: string, end: string | null | undefined, from: Date, to: Date | null) {
  const startDate = toAppDate(start);
  const endDate = end ? toAppDate(end) : null;
  return (startDate >= from || (endDate !== null && endDate > from)) && (to === null || startDate < to);
}

/** Upcoming starts OR events still in progress; do not invent a missing end. */
export function publicDateLowerBoundExpression(from: string) {
  const iso = toAppDate(from).toISOString();
  return `start_at.gte.${iso},end_at.gt.${iso}`;
}
