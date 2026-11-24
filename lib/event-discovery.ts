import type { EventCategory } from "./events";
import { isFreeEvent } from "./events";
import type { DateFilter, PriceFilterMode } from "./filters";
import type { EventWithDistance } from "./event-groups";
import { resolveDateRange } from "./date-range";
import { eventOverlapsWindow } from "./event-dates";
import { listSeasons, resolveSeasonEdition } from "./seasons";
import { toPluralCategorySlug, toSlug } from "./slugs";

export type DiscoverySection = {
  id: string;
  title: string;
  events: EventWithDistance[];
  filters?: { dateFilter?: DateFilter; category?: EventCategory; priceMode?: PriceFilterMode };
  href?: string;
};

type DiscoveryOptions = {
  dateFilter?: DateFilter;
  category?: EventCategory | "Wszystkie";
  priceMode?: PriceFilterMode;
  now?: Date;
  locationLabel?: string;
  /** Events already shown above the shelves, e.g. in the recommended carousel. */
  shownEventIds?: Iterable<string>;
};

/** Ideas drawn from the already filtered, loaded results; not an inventory or popularity ranking. */
export function buildDiscoverySections(items: EventWithDistance[], options: DiscoveryOptions = {}): DiscoverySection[] {
  const now = options.now ?? new Date();
  const events = [...new Map(items.map((item) => [item.event.id, item])).values()]
    .filter(({ event }) => eventOverlapsWindow(event.startDate, event.end_at, now, null));
  const sections: DiscoverySection[] = [];
  const shown = new Set(options.shownEventIds ?? []);
  const categorySlug = options.category && options.category !== "Wszystkie"
    ? toPluralCategorySlug(toSlug(options.category))
    : undefined;

  function add(id: string, title: string, matches: (item: EventWithDistance) => boolean,
    navigation: Pick<DiscoverySection, "filters" | "href"> = {}, keepRepeated = false) {
    if (sections.length >= 5) return;
    const matching = events.filter(matches);
    // Fresh events lead each shelf; a shelf that would only repeat earlier cards is skipped.
    const fresh = matching.filter(({ event }) => !shown.has(event.id));
    if (!matching.length || (!fresh.length && !keepRepeated)) return;
    const ordered = [...fresh, ...matching.filter(({ event }) => shown.has(event.id))];
    let selection = ordered;
    if (id === "weekend") {
      const categories = new Set<string>();
      const leads = ordered.filter(({ event }) => {
        const group = toPluralCategorySlug(event.categorySlug);
        if (categories.has(group)) return false;
        categories.add(group);
        return true;
      });
      const leadEvents = new Set(leads);
      selection = [...leads, ...ordered.filter((item) => !leadEvents.has(item))];
    }
    const selected = selection.slice(0, 6);
    for (const { event } of selected) shown.add(event.id);
    sections.push({ id, title, events: selected, ...navigation });
  }

  if (options.dateFilter !== "weekend") {
    const weekend = resolveDateRange("weekend", "", now);
    const from = new Date(Math.max(now.getTime(), weekend.start.getTime()));
    add("weekend", "W ten weekend", ({ event }) =>
      eventOverlapsWindow(event.startDate, event.end_at, from, weekend.end), { filters: { dateFilter: "weekend" } }, true);
  }

  if (options.locationLabel) {
    add("nearby", "W Twojej okolicy", () => true, { filters: {} });
  }

  // A keyword match must also belong to the current edition's date window.
  for (const season of listSeasons()) {
    const edition = resolveSeasonEdition(season, now);
    const from = new Date(Math.max(now.getTime(), edition.start.getTime()));
    const matches = ({ event }: EventWithDistance) => season.matches(event)
      && eventOverlapsWindow(event.startDate, event.end_at, from, edition.end);
    if (events.some(matches)) {
      add(season.slug, season.linkLabel, matches, { href: `/${season.slug}` });
      break;
    }
  }

  if (categorySlug !== "koncerty") {
    add("concerts", "Najbliższe koncerty", ({ event }) =>
      toPluralCategorySlug(event.categorySlug) === "koncerty", { filters: { category: "Koncerty" } });
  }
  if (options.priceMode !== "free") {
    add("free", "Wydarzenia za darmo", ({ event }) => isFreeEvent(event), { filters: { priceMode: "free" } });
  }
  if (categorySlug !== "rodzinne") {
    add("family", "Gdzie wybrać się z dziećmi?", ({ event }) =>
      toPluralCategorySlug(event.categorySlug) === "rodzinne", { filters: { category: "Rodzinne" } });
  }

  return sections;
}
