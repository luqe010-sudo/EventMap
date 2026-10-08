import { addDaysToDateKey, toAppDate } from "@/lib/date-format";
import { normalizeDateInput } from "@/lib/date-range";
import { eventStatuses } from "@/lib/event-editor";

export const ADMIN_EVENT_PAGE_SIZE = 50;
export const ADMIN_EVENT_POOL_LIMIT = 50_000;

export type AdminEventListItem = {
  id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  start_at: string;
  published_at: string | null;
  status: string | null;
  visibility: string | null;
  review_note: string | null;
  is_featured: boolean | null;
  submitted_by_organizer_id: string | null;
  category: { name: string } | null;
  location: { city: { name: string } | null } | null;
  organizer: { name: string } | null;
};

export type AdminEventListFilters = {
  q?: string;
  status?: string;
  category?: string;
  city?: string;
  organizer?: string;
  featured?: string;
  eventFrom?: string;
  eventTo?: string;
  createdFrom?: string;
  createdTo?: string;
  publishedFrom?: string;
  publishedTo?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export type AdminEventListPage = {
  events: AdminEventListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export const adminEventSortOptions = [
  { label: "Dodano", value: "created_at" },
  { label: "Edytowano", value: "updated_at" },
  { label: "Opublikowano", value: "published_at" },
  { label: "Data wydarzenia", value: "start_at" },
  { label: "Tytuł", value: "title" },
  { label: "Miasto", value: "city" },
  { label: "Kategoria", value: "category" },
  { label: "Organizator", value: "organizer" },
  { label: "Status", value: "status" }
];

const commonKeys = ["q", "category", "city", "organizer", "eventFrom", "eventTo", "createdFrom", "createdTo"] as const;
const eventOnlyKeys = ["status", "featured", "publishedFrom", "publishedTo"] as const;
const datePairs = [["eventFrom", "eventTo", "start_at"], ["createdFrom", "createdTo", "created_at"], ["publishedFrom", "publishedTo", "published_at"]] as const;

export class AdminEventFilterError extends Error {}

export function normalizeAdminEventListFilters(input: AdminEventListFilters, review = false): AdminEventListFilters {
  const result: AdminEventListFilters = {};
  for (const key of [...commonKeys, ...(!review ? eventOnlyKeys : [])]) {
    const value = typeof input[key] === "string" ? input[key]!.trim() : "";
    if (value) result[key] = value;
  }
  if (result.status && !eventStatuses.some(status => status === result.status)) delete result.status;
  if (result.featured !== "yes" && result.featured !== "no") delete result.featured;
  result.sort = adminEventSortOptions.some(option => option.value === input.sort && (!review || option.value !== "published_at")) ? input.sort : "created_at";
  result.dir = input.dir === "asc" ? "asc" : "desc";
  const page = typeof input.page === "string" && /^\d+$/.test(input.page) ? Number(input.page) : 1;
  result.page = String(Number.isSafeInteger(page) && page > 0 ? page : 1);
  return result;
}

export function parseAdminEventListFilters(params: Record<string, string | string[] | undefined>, review = false) {
  const input: AdminEventListFilters = {};
  for (const key of [...commonKeys, ...eventOnlyKeys, "sort", "dir", "page"] as const) {
    const value = params[key];
    input[key] = Array.isArray(value) ? value[0] : value;
  }
  return normalizeAdminEventListFilters(input, review);
}

export function adminEventDateBounds(filters: AdminEventListFilters) {
  const bounds: Array<{ column: string; from?: string; until?: string }> = [];
  for (const [fromKey, toKey, column] of datePairs) {
    const from = filters[fromKey];
    const to = filters[toKey];
    if ((from && !normalizeDateInput(from)) || (to && !normalizeDateInput(to))) {
      throw new AdminEventFilterError("Wpisz poprawną datę w formacie RRRR-MM-DD.");
    }
    if (from && to && from > to) throw new AdminEventFilterError("Data końcowa filtra nie może być wcześniejsza niż początkowa.");
    if (from || to) bounds.push({
      column,
      from: from ? toAppDate(`${from}T00:00:00`).toISOString() : undefined,
      until: to ? toAppDate(`${addDaysToDateKey(to, 1)}T00:00:00`).toISOString() : undefined
    });
  }
  for (const value of [filters.q, filters.category, filters.city, filters.organizer]) {
    if (value && value.length > 200) throw new AdminEventFilterError("Tekst filtra może mieć najwyżej 200 znaków.");
  }
  return bounds;
}

export function adminEventPageInfo(totalCount: number, requestedPage?: string) {
  const pageCount = Math.max(1, Math.ceil(totalCount / ADMIN_EVENT_PAGE_SIZE));
  const page = Math.min(Number(requestedPage) || 1, pageCount);
  return { totalCount, page, pageSize: ADMIN_EVENT_PAGE_SIZE, pageCount };
}

export function buildAdminEventListUrl(action: "/admin/events" | "/admin/review", filters: AdminEventListFilters, page: number) {
  const normalized = normalizeAdminEventListFilters(filters, action === "/admin/review");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(normalized)) {
    if (key !== "page" && value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  return `${action}${params.size ? `?${params}` : ""}`;
}

/** Keep punctuation literal: %, _, commas and parentheses are ordinary text. */
function searchText(value: string | null | undefined) {
  return (value ?? "").toLocaleLowerCase("pl").replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

export function needsAdminEventPool(filters: AdminEventListFilters) {
  return Boolean(filters.q || filters.category || filters.city || filters.organizer ||
    ["title", "status", "category", "city", "organizer"].includes(filters.sort ?? ""));
}

export function filterAdminEventPool(events: AdminEventListItem[], filters: AdminEventListFilters) {
  const q = searchText(filters.q);
  const category = searchText(filters.category);
  const city = searchText(filters.city);
  const organizer = searchText(filters.organizer);
  return events.filter(event => {
    if (q && ![event.title, event.status, event.category?.name, event.location?.city?.name, event.organizer?.name, event.review_note]
      .some(value => searchText(value).includes(q))) return false;
    return (!category || searchText(event.category?.name).includes(category)) &&
      (!city || searchText(event.location?.city?.name).includes(city)) &&
      (!organizer || searchText(event.organizer?.name).includes(organizer));
  });
}

export function sortAdminEventPool(events: AdminEventListItem[], filters: AdminEventListFilters) {
  const direction = filters.dir === "asc" ? 1 : -1;
  const sort = filters.sort ?? "created_at";
  function value(event: AdminEventListItem): string | null {
    if (sort === "category") return event.category?.name ?? null;
    if (sort === "city") return event.location?.city?.name ?? null;
    if (sort === "organizer") return event.organizer?.name ?? null;
    if (sort === "title" || sort === "status" || sort === "published_at" || sort === "updated_at" || sort === "start_at") return event[sort];
    return event.created_at;
  }
  return [...events].sort((first, second) => {
    const left = value(first);
    const right = value(second);
    if (left === null && right !== null) return 1;
    if (left !== null && right === null) return -1;
    const comparison = left === null || right === null ? 0 :
      ["created_at", "updated_at", "published_at", "start_at"].includes(sort)
        ? new Date(left).getTime() - new Date(right).getTime()
        : left.localeCompare(right, "pl");
    return comparison * direction || first.id.localeCompare(second.id);
  });
}
