import type { ComponentProps, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  states: [] as unknown[], refs: [] as { current: unknown }[],
  effects: [] as { deps?: unknown[]; effect: () => void | (() => void); cleanup?: () => void }[],
  pending: [] as number[], stateIndex: 0, refIndex: 0, effectIndex: 0,
  maps: [] as { handlers: Record<string, (event: unknown) => unknown>; flyTo: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }[]
}));
const geocoding = vi.hoisted(() => ({ cities: vi.fn(), addresses: vi.fn(), reverse: vi.fn() }));

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.stateIndex++;
    if (!(index in harness.states)) harness.states[index] = typeof initial === "function" ? initial() : initial;
    return [harness.states[index], (next: unknown) => {
      harness.states[index] = typeof next === "function" ? next(harness.states[index]) : next;
    }];
  },
  useRef: (initial: unknown) => harness.refs[harness.refIndex++] ?? (harness.refs[harness.refIndex - 1] = { current: initial }),
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
    const index = harness.effectIndex++;
    const previous = harness.effects[index];
    if (!previous || !deps || deps.some((dep, position) => !Object.is(dep, previous.deps?.[position]))) {
      harness.effects[index] = { effect, deps, cleanup: previous?.cleanup };
      harness.pending.push(index);
    }
  }
}));
vi.mock("@/lib/geocoding", () => ({
  searchPolishCities: geocoding.cities,
  searchStreetAddress: geocoding.addresses,
  reverseGeocode: geocoding.reverse
}));
vi.mock("maplibre-gl", () => ({ default: {
  Map: class {
    handlers: Record<string, (event: unknown) => unknown> = {};
    flyTo = vi.fn(); remove = vi.fn(); addControl = vi.fn();
    constructor() { harness.maps.push(this); }
    on(name: string, handler: (event: unknown) => unknown) { this.handlers[name] = handler; }
    getZoom() { return 13; }
  },
  Marker: class {
    position = { lat: 0, lng: 0 };
    setLngLat([lng, lat]: [number, number]) { this.position = { lat, lng }; return this; }
    addTo() { return this; }
    on() { return this; }
    remove() {}
    getLngLat() { return this.position; }
  },
  NavigationControl: class {}
} }));

import LocationPickerMap from "../components/LocationPickerMap";
import type { GeocodingResult } from "../lib/geocoding";

type Node = ReactElement<Record<string, unknown>>;
let props: ComponentProps<typeof LocationPickerMap>;
let tree: Node;
const saved = {
  id: "saved-warsaw", name: "Dom Kultury", address: "Marszałkowska 10", latitude: 52.23, longitude: 21.01,
  city: { name: "Warszawa" }, postal_code: "00-001", voivodeship: "mazowieckie", county: null, municipality: null
};
function result(city: string, latitude: number, longitude: number, address: string | null = null): GeocodingResult {
  return { displayName: [address, city].filter(Boolean).join(", "), city, address, latitude, longitude,
    postalCode: null, voivodeship: null, county: null, municipality: null };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("type" in value) || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function render() {
  harness.stateIndex = 0; harness.refIndex = 0; harness.effectIndex = 0;
  tree = LocationPickerMap(props) as Node;
  for (const node of nodes(tree)) {
    if (node.type === "div" && node.props.ref) (node.props.ref as { current: unknown }).current = { contains: () => false };
  }
  for (const index of harness.pending.splice(0)) {
    const effect = harness.effects[index];
    effect.cleanup?.();
    const cleanup = effect.effect();
    effect.cleanup = typeof cleanup === "function" ? cleanup : undefined;
  }
  return tree;
}
function input(name: string) {
  const node = nodes(tree).find(node => node.type === "input" && node.props.name === name);
  if (!node) throw new Error(`Missing input ${name}`);
  return node;
}
function change(name: string, value: string) {
  (input(name).props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  render();
}
function suggestionLabels() {
  return nodes(tree).filter(node => node.type === "button" && node.props.className === "locationPickerSuggestionItem")
    .map(node => node.props.children as string);
}
function choose(label: string) {
  const node = nodes(tree).find(node => node.type === "button" && node.props.children === label);
  if (!node) throw new Error(`Missing suggestion ${label}`);
  (node.props.onClick as () => void)();
  render();
}
function enterAddress() {
  (input("location_address").props.onKeyDown as (event: { key: string; preventDefault: () => void }) => void)({ key: "Enter", preventDefault: vi.fn() });
  render();
}
function mapClick(latitude: number, longitude: number) {
  harness.maps[0].handlers.click({ lngLat: { lat: latitude, lng: longitude } });
  render();
}
function showSavedLocations() {
  const node = nodes(tree).find(node => node.type === "input" && node.props.className === "locationPickerSearchInput" && !node.props.name);
  if (!node) throw new Error("Missing saved-place input");
  (node.props.onFocus as () => void)(); render();
}
async function tick() { vi.advanceTimersByTime(350); await flush(); }
async function flush() { await Promise.resolve(); await Promise.resolve(); render(); }

beforeEach(() => {
  vi.useFakeTimers();
  harness.states.length = 0; harness.refs.length = 0; harness.effects.length = 0; harness.pending.length = 0; harness.maps.length = 0;
  geocoding.cities.mockReset().mockResolvedValue([]);
  geocoding.addresses.mockReset().mockResolvedValue([]);
  geocoding.reverse.mockReset().mockResolvedValue(null);
  vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  props = { initialCity: "Wrocław", savedLocations: [saved] };
  render();
});
afterEach(() => { for (const effect of harness.effects) effect.cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("location picker request consistency", () => {
  it("keeps the newest city suggestions when provider responses arrive out of order", async () => {
    const old = deferred<GeocodingResult[]>(); const latest = deferred<GeocodingResult[]>();
    geocoding.cities.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    change("location_city", "Wro"); await tick();
    change("location_city", "War"); await tick();
    latest.resolve([result("Warszawa", 52.23, 21.01)]); await flush();
    expect(suggestionLabels()).toEqual(["Warszawa"]);
    old.resolve([result("Wrocław", 51.11, 17.04)]); await flush();
    expect(suggestionLabels()).toEqual(["Warszawa"]);
  });

  it("clears cached addresses on city change and confirms only the current address/city", async () => {
    geocoding.addresses.mockResolvedValueOnce([result("Wrocław", 51.11, 17.04, "Lipowa 10")]);
    change("location_address", "Lipowa 10"); await tick();
    expect(suggestionLabels()).toContain("Lipowa 10");
    change("location_city", "Warszawa");
    expect(suggestionLabels()).toEqual([]);
    change("location_address", "Marszałkowska 10");
    geocoding.addresses.mockResolvedValueOnce([result("Warszawa", 52.23, 21.01, "Marszałkowska 10")]);
    enterAddress(); await flush(); await tick();
    expect(geocoding.addresses.mock.calls).toEqual([["Lipowa 10", "Wrocław"], ["Marszałkowska 10", "Warszawa"]]);
    expect(input("location_city").props.value).toBe("Warszawa");
    expect(input("location_address").props.value).toBe("Marszałkowska 10");
    expect(input("location_latitude").props.value).toBe(52.23);
  });

  it("does not resurrect address suggestions from an earlier city", async () => {
    const old = deferred<GeocodingResult[]>(); geocoding.addresses.mockReturnValueOnce(old.promise);
    change("location_address", "Lipowa 10"); await tick();
    change("location_city", "Warszawa");
    old.resolve([result("Wrocław", 51.11, 17.04, "Lipowa 10")]); await flush();
    expect(suggestionLabels()).toEqual([]);
    expect(input("location_city").props.value).toBe("Warszawa");
    expect(input("location_address").props.value).toBe("");
    expect(input("location_latitude").props.value).toBe("");
  });

  it("cancels a debounced address query when the city changes", async () => {
    change("location_address", "Lipowa 10");
    change("location_city", "Warszawa"); await tick();
    expect(geocoding.addresses).not.toHaveBeenCalled();
    expect(geocoding.cities).toHaveBeenCalledWith("Warszawa");
  });

  it.each([
    { field: "location_city", first: "Wro", cleared: "", lookup: "cities" as const },
    { field: "location_address", first: "Lipowa 10", cleared: "L", lookup: "addresses" as const }
  ])("ignores an old response after $field becomes empty or too short", async ({ field, first, cleared, lookup }) => {
    const old = deferred<GeocodingResult[]>(); geocoding[lookup].mockReturnValueOnce(old.promise);
    change(field, first); await tick();
    change(field, cleared);
    old.resolve([result("Wrocław", 51.11, 17.04, "Lipowa 10")]); await flush(); await tick();
    expect(suggestionLabels()).toEqual([]);
    expect(geocoding[lookup]).toHaveBeenCalledOnce();
    expect(input(field).props.value).toBe(cleared);
    expect(nodes(tree).filter(node => node.props.className === "locationPickerSpinner")).toEqual([]);
  });

  it("keeps the last map point when reverse-geocoding replies arrive out of order", async () => {
    const old = deferred<GeocodingResult | null>(); const latest = deferred<GeocodingResult | null>();
    geocoding.reverse.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    mapClick(51.11, 17.04); mapClick(52.23, 21.01);
    latest.resolve(result("Warszawa", 52.23, 21.01, "Marszałkowska 10")); await flush();
    old.resolve(result("Wrocław", 51.11, 17.04, "Lipowa 10")); await flush();
    expect(input("location_city").props.value).toBe("Warszawa");
    expect(input("location_latitude").props.value).toBe(52.23);
    expect(input("location_longitude").props.value).toBe(21.01);
  });

  it("does not overwrite a chosen saved place with an earlier reverse lookup", async () => {
    const old = deferred<GeocodingResult | null>(); geocoding.reverse.mockReturnValueOnce(old.promise);
    mapClick(51.11, 17.04);
    showSavedLocations(); choose("Dom Kultury, Warszawa, Marszałkowska 10");
    old.resolve(result("Wrocław", 51.11, 17.04, "Lipowa 10")); await flush();
    expect(input("location_id").props.value).toBe(saved.id);
    expect(input("location_city").props.value).toBe("Warszawa");
    expect(input("location_latitude").props.value).toBe(saved.latitude);
  });

  it("clears the saved location ID immediately when choosing a map point even if reverse geocoding fails", async () => {
    showSavedLocations(); choose("Dom Kultury, Warszawa, Marszałkowska 10");
    const lookup = deferred<GeocodingResult | null>(); geocoding.reverse.mockReturnValueOnce(lookup.promise);
    mapClick(51.11, 17.04);
    expect(input("location_id").props.value).toBe("");
    expect(input("location_latitude").props.value).toBe(51.11);
    expect(input("location_city").props.value).toBe("");
    expect(input("location_address").props.value).toBe("");
    expect(input("location_postal_code").props.value).toBe("");
    expect(input("location_voivodeship").props.value).toBe("");
    expect(input("location_name").props.value).toBe(saved.name);
    lookup.resolve(null); await flush();
    expect(input("location_id").props.value).toBe("");
    expect(input("location_longitude").props.value).toBe(17.04);
    expect(input("location_city").props.value).toBe("");
    expect(input("location_address").props.value).toBe("");
    expect(nodes(tree).find(node => node.props.role === "status")?.props.children).toEqual([
      " ", "Nie udało się ustalić adresu tego punktu. Wyszukaj miasto i adres lub wybierz znane miejsce."
    ]);
  });

  it("ignores a confirmation response after the user edits the address again", async () => {
    const old = deferred<GeocodingResult[]>(); geocoding.addresses.mockReturnValueOnce(old.promise);
    change("location_address", "Lipowa 10"); enterAddress();
    change("location_address", "Polna 20");
    old.resolve([result("Wrocław", 51.11, 17.04, "Lipowa 10")]); await flush();
    expect(input("location_address").props.value).toBe("Polna 20");
    expect(input("location_latitude").props.value).toBe("");
    expect(suggestionLabels()).toEqual([]);
  });

  it("preserves a manual administrative correction made while reverse geocoding is pending", async () => {
    props = { ...props, showAdministrativeFields: true }; render();
    const lookup = deferred<GeocodingResult | null>(); geocoding.reverse.mockReturnValueOnce(lookup.promise);
    mapClick(51.11, 17.04);
    change("location_postal_code", "50-001");
    lookup.resolve({ ...result("Wrocław", 51.11, 17.04, "Lipowa 10"), postalCode: "50-999" }); await flush();
    expect(input("location_postal_code").props.value).toBe("50-001");
    expect(input("location_latitude").props.value).toBe(51.11);
  });

  it("uses corrected administrative fields instead of silently reusing a saved-place ID", () => {
    props = { ...props, showAdministrativeFields: true }; render();
    showSavedLocations(); choose("Dom Kultury, Warszawa, Marszałkowska 10");
    change("location_postal_code", "00-002");
    expect(input("location_id").props.value).toBe("");
    expect(input("location_postal_code").props.value).toBe("00-002");
    expect(input("location_latitude").props.value).toBe(saved.latitude);
  });

  it("invalidates suggestions when a saved place is chosen during a city search", async () => {
    const old = deferred<GeocodingResult[]>(); geocoding.cities.mockReturnValueOnce(old.promise);
    change("location_city", "Wro"); await tick();
    showSavedLocations(); choose("Dom Kultury, Warszawa, Marszałkowska 10");
    old.resolve([result("Wrocław", 51.11, 17.04)]); await flush();
    expect(suggestionLabels()).toEqual([]);
    expect(input("location_id").props.value).toBe(saved.id);
  });

  it("does not restore an old address search after a saved place is chosen", async () => {
    const old = deferred<GeocodingResult[]>(); geocoding.addresses.mockReturnValueOnce(old.promise);
    change("location_address", "Lipowa 10"); await tick();
    showSavedLocations(); choose("Dom Kultury, Warszawa, Marszałkowska 10");
    old.resolve([result("Wrocław", 51.11, 17.04, "Lipowa 10")]); await flush();
    expect(suggestionLabels()).toEqual([]);
    expect(input("location_id").props.value).toBe(saved.id);
    expect(input("location_city").props.value).toBe("Warszawa");
    expect(input("location_address").props.value).toBe(saved.address);
  });

  it("ignores responses after unmount and removes the map", async () => {
    const lookup = deferred<GeocodingResult | null>(); geocoding.reverse.mockReturnValueOnce(lookup.promise);
    mapClick(51.11, 17.04);
    for (const effect of harness.effects) { effect.cleanup?.(); effect.cleanup = undefined; }
    const before = [...harness.states];
    lookup.resolve(result("Wrocław", 51.11, 17.04, "Lipowa 10")); await Promise.resolve(); await Promise.resolve();
    expect(harness.states).toEqual(before);
    expect(harness.maps[0].remove).toHaveBeenCalledOnce();
  });
});
