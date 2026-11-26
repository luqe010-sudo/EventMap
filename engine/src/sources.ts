// Source registry helpers shared by agents and the control API.

import { type Db, nowIso } from "./db.ts";

export type SourceStatus =
  | "discovered" | "probing" | "legal_review" | "needs_owner" | "approved" | "blocked" | "active"
  | "paused" | "failing" | "no_integration" | "retracted";

export type SourceRow = {
  id: number; url: string; domain: string; name: string | null; kind: string; integration_type: string; feed_url: string | null;
  status: SourceStatus; legal_rule: string | null; legal_basis: string | null; legal_notes: string | null; legal_evidence: string | null;
  legal_reviewed_at: string | null; voivodeship: string | null; county: string | null; municipality: string | null; teryt: string | null;
  city: string | null; wikidata_id: string | null; discovered_via: string | null; crawl_interval_ms: number; next_crawl_at: string | null;
  last_crawl_at: string | null; last_success_at: string | null; consecutive_failures: number; last_error: string | null;
  etag: string | null; last_modified: string | null; content_hash: string | null; events_found_total: number; events_valid_total: number;
  events_published_total: number; last_yield: number | null; best_yield: number; autopublish: number; priority: number;
  created_at: string; updated_at: string;
};

export const VOIVODESHIP_BY_TERC: Record<string, string> = {
  "02": "dolnośląskie", "04": "kujawsko-pomorskie", "06": "lubelskie", "08": "lubuskie", "10": "łódzkie", "12": "małopolskie",
  "14": "mazowieckie", "16": "opolskie", "18": "podkarpackie", "20": "podlaskie", "22": "pomorskie", "24": "śląskie",
  "26": "świętokrzyskie", "28": "warmińsko-mazurskie", "30": "wielkopolskie", "32": "zachodniopomorskie"
};

export const VOIVODESHIPS = Object.values(VOIVODESHIP_BY_TERC);

export function homepageOf(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!/^https?:$/.test(url.protocol)) return null;
    return `${url.protocol}//${url.host.toLowerCase()}/`;
  } catch { return null; }
}

export function domainOf(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

export type NewSource = {
  url: string; name?: string | null; kind?: string; voivodeship?: string | null; county?: string | null; municipality?: string | null;
  teryt?: string | null; city?: string | null; wikidataId?: string | null; discoveredVia: string; priority?: number;
};

/** Registers a source once per homepage. Returns the id and whether it is new. */
export function registerSource(db: Db, input: NewSource): { id: number; created: boolean } | null {
  const url = homepageOf(input.url);
  if (!url) return null;
  const existing = db.prepare("SELECT id FROM sources WHERE url = ? OR (domain = ? AND kind = ?)").get(url, domainOf(url), input.kind ?? "organizer") as { id: number } | undefined;
  if (existing) {
    db.prepare(`UPDATE sources SET voivodeship = COALESCE(voivodeship, ?), teryt = COALESCE(teryt, ?), city = COALESCE(city, ?),
      wikidata_id = COALESCE(wikidata_id, ?), name = COALESCE(name, ?), updated_at = ? WHERE id = ?`)
      .run(input.voivodeship ?? null, input.teryt ?? null, input.city ?? null, input.wikidataId ?? null, input.name ?? null, nowIso(), existing.id);
    return { id: existing.id, created: false };
  }
  const now = nowIso();
  const result = db.prepare(`INSERT INTO sources (url, domain, name, kind, voivodeship, county, municipality, teryt, city, wikidata_id, discovered_via, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(url, domainOf(url), input.name ?? null, input.kind ?? "organizer", input.voivodeship ?? null, input.county ?? null, input.municipality ?? null,
      input.teryt ?? null, input.city ?? null, input.wikidataId ?? null, input.discoveredVia, input.priority ?? 100, now, now);
  return { id: Number(result.lastInsertRowid), created: true };
}

export function getSource(db: Db, id: number): SourceRow | null {
  return (db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as unknown as SourceRow | undefined) ?? null;
}

export function updateSource(db: Db, id: number, patch: Partial<Omit<SourceRow, "id" | "created_at">>): void {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (!entries.length) return;
  const sets = entries.map(([key]) => `${key} = ?`).join(", ");
  db.prepare(`UPDATE sources SET ${sets}, updated_at = ? WHERE id = ?`).run(...entries.map(([, value]) => value as string | number | null), nowIso(), id);
}

export function sourceCounts(db: Db): Record<string, number> {
  const rows = db.prepare("SELECT status, COUNT(*) AS n FROM sources GROUP BY status").all() as Array<{ status: string; n: number }>;
  return Object.fromEntries(rows.map(row => [row.status, row.n]));
}
