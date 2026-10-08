import type { ComponentProps, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[], refs: [] as { current: unknown }[],
  effects: [] as (() => void | (() => void))[], stateIndex: 0, refIndex: 0
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.states[index], (next: unknown) => {
      hooks.states[index] = typeof next === "function" ? next(hooks.states[index]) : next;
    }];
  },
  useRef: (initial: unknown) => hooks.refs[hooks.refIndex++] ?? (hooks.refs[hooks.refIndex - 1] = { current: initial }),
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect)
}));
vi.mock("@/components/useMobileWorkspaceAccessibility", () => ({ useMobileWorkspaceAccessibility: vi.fn() }));

import HomePage from "../components/HomePage";
import SearchPanel from "../components/SearchPanel";
import type { CategoryOption, EventItem, KnownLocation } from "../lib/events";

const categories: CategoryOption[] = [{ id: "music", name: "Koncerty", slug: "koncerty", icon: null, color: null }];
const warsaw: KnownLocation = { label: "Warszawa", slug: "warszawa", aliases: [], latitude: 52.23, longitude: 21.01 };
const krakow: KnownLocation = { label: "Kraków", slug: "krakow", aliases: [], latitude: 50.06, longitude: 19.94 };
let addListener: ReturnType<typeof vi.fn>;
let reload: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
const baseProps = { initialEvents: [], categoryOptions: categories, initialLocation: krakow, activeCityLocations: [warsaw, krakow] };

function render(props: ComponentProps<typeof HomePage> = baseProps) {
  hooks.stateIndex = 0; hooks.refIndex = 0; hooks.effects.length = 0;
  return HomePage(props);
}
function runEffects() { for (const effect of hooks.effects) effect(); }
function panel(element: ReactElement): ComponentProps<typeof SearchPanel> {
  const visit = (node: unknown): ComponentProps<typeof SearchPanel> | null => {
    if (Array.isArray(node)) { for (const child of node) { const found = visit(child); if (found) return found; } return null; }
    if (!node || typeof node !== "object" || !("type" in node) || !("props" in node)) return null;
    const current = node as ReactElement<{ children?: unknown }>;
    return current.type === SearchPanel ? current.props as ComponentProps<typeof SearchPanel> : visit(current.props.children);
  };
  const result = visit(element);
  if (!result) throw new Error("Missing search controls");
  return result;
}
async function pop(state: unknown) {
  const listener = addListener.mock.calls.find(call => call[0] === "popstate")?.[1] as ((event: PopStateEvent) => Promise<void>) | undefined;
  if (!listener) throw new Error("Missing history listener");
  await listener({ state } as PopStateEvent);
}

beforeEach(() => {
  hooks.states.length = 0; hooks.refs.length = 0;
  addListener = vi.fn(); reload = vi.fn();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [], markers: [], categoryCounts: [], totalCount: 0, page: 1, pageSize: 20, maxResults: 300, shownCount: 0, hasMore: false }) });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {
    location: { origin: "https://mapaimprez.pl", reload },
    addEventListener: addListener, removeEventListener: vi.fn(),
    matchMedia: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    history: { state: {}, replaceState: vi.fn(), pushState: vi.fn() }
  });
  vi.stubGlobal("document", { body: { style: {}, classList: { add: vi.fn(), remove: vi.fn() } } });
});
afterEach(() => vi.unstubAllGlobals());

describe("HomePage Back/Forward", () => {
  it("restores controls and fetches list, map and category counts for the earlier URL", async () => {
    render(); runEffects();
    await pop({ eventMapWorkspace: { view: "map", workspaceUrl: "/koncerty/warszawa?kiedy=custom&dataOd=2026-10-10&dataDo=2026-10-12&cena=max&cenaMax=80&radius=25&sort=nearest" } });
    fetchMock.mockClear();
    const controls = panel(render());
    expect(controls).toMatchObject({ category: "Koncerty", locationInput: "Warszawa", isAllPoland: false, locationMode: "radius", radiusKm: 25, dateFilter: "custom", customDate: "2026-10-10/2026-10-12", priceMode: "max", maxPrice: 80 });
    runEffects();
    const calls = fetchMock.mock.calls.map(call => new URL(call[0], "https://mapaimprez.pl"));
    for (const route of ["search", "markers", "category-counts"]) {
      const url = calls.find(call => call.pathname === `/api/events/${route}` && !call.searchParams.has("featured"));
      expect(url).toBeDefined();
      expect(Object.fromEntries(url!.searchParams)).toMatchObject({ categorySlug: "koncerty", citySlug: "warszawa", radius: "25", sort: "nearest", kiedy: "custom", dataOd: "2026-10-10", dataDo: "2026-10-12", cena: "max", cenaMax: "80" });
    }
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps event overlay history in its workspace and retains an event outside the loaded page", async () => {
    const event = { id: "event-a", category: "Koncerty", citySlug: "krakow", slug: "koncert", startDate: "2027-05-01T18:00:00Z", latitude: 50.06, longitude: 19.94 } as EventItem;
    fetchMock.mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () => url === "/api/events/event-a" ? { event } : { events: [], markers: [], categoryCounts: [] } }));
    render(); runEffects();
    await pop({ eventMapWorkspace: { view: "event", eventId: event.id, workspaceUrl: "/krakow", originView: "map" } });
    expect(hooks.states[0]).toBe("event");
    expect(hooks.states[3]).toBe(event.id);
    expect(hooks.states[7]).toBe(event);
    expect(panel(render())).toMatchObject({ locationInput: "Kraków", dateFilter: "all", category: "Wszystkie" });
    expect(reload).not.toHaveBeenCalled();
  });

  it("loads the server route when an older history entry cannot be reconstructed", async () => {
    render(); runEffects();
    await pop({ eventMapWorkspace: { view: "list", workspaceUrl: "/miasto-spoza-kontekstu" } });
    expect(reload).toHaveBeenCalledOnce();
  });
});
