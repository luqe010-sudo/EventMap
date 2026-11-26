// The engine's own operational memory. It lives in a single SQLite file (WAL) on
// the VPS volume, separate from production Supabase, so the engine never needs
// new tables in the application database. Backups are taken with VACUUM INTO.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export type Db = DatabaseSync;

const MIGRATIONS: string[] = [
  // v1 — core schema
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);

  CREATE TABLE agents (
    name TEXT PRIMARY KEY,
    paused INTEGER NOT NULL DEFAULT 0,
    paused_reason TEXT,
    paused_by TEXT,
    last_heartbeat TEXT,
    last_run_at TEXT,
    last_error TEXT,
    runs_ok INTEGER NOT NULL DEFAULT 0,
    runs_failed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    agent TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','dead','cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    run_after TEXT NOT NULL,
    lease_until TEXT,
    locked_by TEXT,
    dedupe_key TEXT,
    last_error TEXT,
    result TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE INDEX jobs_claim ON jobs (status, run_after, priority);
  CREATE INDEX jobs_agent ON jobs (agent, status);
  CREATE UNIQUE INDEX jobs_dedupe_active ON jobs (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued','running');

  CREATE TABLE schedules (
    job_type TEXT PRIMARY KEY,
    agent TEXT NOT NULL,
    every_ms INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_enqueued_at TEXT
  );

  CREATE TABLE sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    name TEXT,
    kind TEXT NOT NULL DEFAULT 'organizer',
    integration_type TEXT NOT NULL DEFAULT 'unknown',
    feed_url TEXT,
    status TEXT NOT NULL DEFAULT 'discovered',
    legal_rule TEXT,
    legal_basis TEXT,
    legal_notes TEXT,
    legal_evidence TEXT,
    legal_reviewed_at TEXT,
    voivodeship TEXT,
    county TEXT,
    municipality TEXT,
    teryt TEXT,
    city TEXT,
    wikidata_id TEXT,
    discovered_via TEXT,
    crawl_interval_ms INTEGER NOT NULL DEFAULT 86400000,
    next_crawl_at TEXT,
    last_crawl_at TEXT,
    last_success_at TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    etag TEXT,
    last_modified TEXT,
    content_hash TEXT,
    events_found_total INTEGER NOT NULL DEFAULT 0,
    events_valid_total INTEGER NOT NULL DEFAULT 0,
    events_published_total INTEGER NOT NULL DEFAULT 0,
    last_yield INTEGER,
    best_yield INTEGER NOT NULL DEFAULT 0,
    autopublish INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX sources_status ON sources (status, next_crawl_at);
  CREATE INDEX sources_domain ON sources (domain);
  CREATE INDEX sources_region ON sources (voivodeship);

  CREATE TABLE raw_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id),
    url TEXT NOT NULL,
    content_type TEXT,
    content_hash TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    body TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new'
  );
  CREATE INDEX raw_items_source ON raw_items (source_id, fetched_at);

  CREATE TABLE pages (
    url TEXT PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES sources(id),
    last_fetched_at TEXT NOT NULL,
    content_hash TEXT,
    events_found INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX pages_source ON pages (source_id);

  CREATE TABLE candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id),
    external_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    facts TEXT NOT NULL,
    status TEXT NOT NULL,
    quality_score REAL,
    quality_issues TEXT,
    category_slug TEXT,
    city_id TEXT,
    city_name TEXT,
    voivodeship TEXT,
    short_description TEXT,
    description TEXT,
    supabase_event_id TEXT,
    supabase_updated_at TEXT,
    published_at TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (source_id, external_id)
  );
  CREATE INDEX candidates_status ON candidates (status);
  CREATE INDEX candidates_fingerprint ON candidates (fingerprint);

  CREATE TABLE provenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL REFERENCES candidates(id),
    source_id INTEGER NOT NULL REFERENCES sources(id),
    raw_item_id INTEGER REFERENCES raw_items(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    content_hash TEXT,
    legal_rule TEXT,
    observed_at TEXT NOT NULL
  );
  CREATE INDEX provenance_candidate ON provenance (candidate_id);
  CREATE INDEX provenance_source ON provenance (source_id);

  CREATE TABLE geocode_cache (
    query TEXT PRIMARY KEY,
    latitude REAL,
    longitude REAL,
    display_name TEXT,
    provider TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected','expired')),
    resolution_note TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX decisions_open ON decisions (kind, subject_type, subject_id) WHERE status = 'open';

  CREATE TABLE memory (
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (scope, key)
  );

  CREATE TABLE incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    agent TEXT,
    source_id INTEGER,
    severity TEXT NOT NULL DEFAULT 'warning',
    message TEXT NOT NULL,
    diagnosis TEXT,
    remediation TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE INDEX incidents_status ON incidents (status, created_at);

  CREATE TABLE costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    day TEXT NOT NULL,
    month TEXT NOT NULL,
    agent TEXT NOT NULL,
    category TEXT NOT NULL,
    provider TEXT NOT NULL,
    amount_pln REAL NOT NULL,
    units REAL NOT NULL DEFAULT 0,
    note TEXT
  );
  CREATE INDEX costs_day ON costs (day);
  CREATE INDEX costs_month ON costs (month);

  CREATE TABLE activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    level TEXT NOT NULL,
    agent TEXT,
    message TEXT NOT NULL,
    data TEXT
  );
  CREATE INDEX activity_at ON activity (at);

  CREATE TABLE audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT
  );

  CREATE TABLE reports (
    day TEXT PRIMARY KEY,
    markdown TEXT NOT NULL,
    metrics TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE coverage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    computed_at TEXT NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE metrics_daily (
    day TEXT NOT NULL,
    key TEXT NOT NULL,
    value REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (day, key)
  );

  -- The audit trail of owner/control actions must never be silently erased.
  CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END;
  CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END;
  `,
  // v2 — hash of the facts as extracted from the source. Later stages (geo) enrich
  // `facts`, so change detection must compare against the source observation.
  `
  ALTER TABLE candidates ADD COLUMN source_hash TEXT;
  `
];

export function openDb(file: string): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000; PRAGMA synchronous = NORMAL;");
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT version FROM schema_version").get() as { version: number } | undefined;
  let version = row?.version ?? 0;
  if (!row) db.prepare("INSERT INTO schema_version (version) VALUES (0)").run();
  while (version < MIGRATIONS.length) {
    tx(db, () => {
      db.exec(MIGRATIONS[version]);
      db.prepare("UPDATE schema_version SET version = ?").run(version + 1);
    });
    version += 1;
  }
}

export function tx<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

export function json<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

/** Consistent online backup without stopping writers. */
export function backupTo(db: Db, file: string): void {
  mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  db.prepare("VACUUM INTO ?").run(file);
}
