import { describe, expect, it } from "vitest";
import { authorizeSpend, recordCost, setLimits } from "../src/budget.ts";
import { loadConfig } from "../src/config.ts";
import { handleControl } from "../src/control.ts";
import { openDb } from "../src/db.ts";
import { claim, complete, enqueue, fail, requeueExpired } from "../src/queue.ts";
import { createRuntime } from "../src/runtime.ts";
import { audit, killState, requestDecision } from "../src/store.ts";
import type { Services } from "../src/agents/types.ts";
import type { Fetcher } from "../src/net/fetcher.ts";

const config = loadConfig({ ENGINE_ENV: "development", ENGINE_DATA_DIR: "/nonexistent", ENGINE_BUDGET_CEILING_MONTHLY_PLN: "300", ENGINE_BUDGET_CEILING_DAILY_PLN: "20" });
const fakeFetcher: Fetcher = { get: async () => { throw new Error("network disabled in tests"); }, robotsAllows: async () => true };
const fakeServices: Services = { publicDb: null, serviceDb: null, catalog: async () => null, notify: async () => undefined, geocode: async () => null };

describe("queue", () => {
  it("deduplicates active jobs, claims by priority and requeues expired leases", () => {
    const db = openDb(":memory:");
    expect(enqueue(db, "crawler", "crawl.source", { sourceId: 1 }, { dedupeKey: "crawl:1", priority: 50 })).not.toBeNull();
    expect(enqueue(db, "crawler", "crawl.source", { sourceId: 1 }, { dedupeKey: "crawl:1" })).toBeNull();
    enqueue(db, "crawler", "crawl.due", {}, { priority: 10 });
    const first = claim(db, ["crawler"], "w1", 1000);
    expect(first?.type).toBe("crawl.due");
    const second = claim(db, ["crawler"], "w1", 1000);
    expect(second?.payload).toEqual({ sourceId: 1 });
    expect(requeueExpired(db, new Date(Date.now() + 5000))).toBe(2);
    const reclaimed = [claim(db, ["crawler"], "w2", 60_000), claim(db, ["crawler"], "w2", 60_000)];
    const again = reclaimed.find(job => job?.type === "crawl.source");
    expect(again).toBeTruthy();
    complete(db, again!.id);
    // A finished job frees its dedupe key.
    expect(enqueue(db, "crawler", "crawl.source", { sourceId: 1 }, { dedupeKey: "crawl:1" })).not.toBeNull();
  });

  it("backs off and dead-letters after max attempts or permanent errors", () => {
    const db = openDb(":memory:");
    enqueue(db, "geo", "geo.resolve", {}, { maxAttempts: 2 });
    const job = claim(db, ["geo"], "w", 1000)!;
    expect(fail(db, job, "boom")).toBe("queued");
    const retry = claim(db, ["geo"], "w", 1000, new Date(Date.now() + 3600_000))!;
    expect(retry.attempts).toBe(2);
    expect(fail(db, retry, "boom")).toBe("dead");
    enqueue(db, "geo", "geo.resolve", {});
    const other = claim(db, ["geo"], "w", 1000)!;
    expect(fail(db, other, "robots", new Date(), false)).toBe("dead");
  });
});

describe("financial controller", () => {
  it("refuses paid work above the hard limits and clamps limits to env ceilings", () => {
    const db = openDb(":memory:");
    expect(authorizeSpend(db, config, "content", 0).allowed).toBe(true);
    expect(authorizeSpend(db, config, "content", 0.01).allowed).toBe(false); // default budget is 0 PLN
    const limits = setLimits(db, config, "owner", 50, 1000);
    expect(limits.dailyPln).toBe(20);
    expect(limits.monthlyPln).toBe(300);
    recordCost(db, { agent: "content", category: "llm", provider: "test", amountPln: 19.5 });
    expect(authorizeSpend(db, config, "content", 0.4).allowed).toBe(true);
    expect(authorizeSpend(db, config, "content", 1).reason).toBe("daily_limit");
  });

  it("keeps the audit trail append-only", () => {
    const db = openDb(":memory:");
    audit(db, "owner", "test");
    expect(() => db.exec("DELETE FROM audit")).toThrow(/append-only/);
    expect(() => db.exec("UPDATE audit SET actor = 'x'")).toThrow(/append-only/);
  });
});

describe("control API and supervisor", () => {
  it("kill switch stops dispatching and pause stops one agent", async () => {
    const db = openDb(":memory:");
    const runtime = createRuntime(db, { ...config, role: "all", killFile: "/nonexistent/KILL" }, fakeFetcher, fakeServices);
    db.prepare("UPDATE schedules SET enabled = 0").run();
    handleControl(db, config, { method: "POST", path: "/api/kill", query: new URLSearchParams(), body: { active: true, reason: "test" }, actor: "owner" });
    expect(killState(db).active).toBe(true);
    enqueue(db, "supervisor", "supervisor.housekeeping", {});
    await runtime.tick();
    await runtime.idle();
    expect((db.prepare("SELECT status FROM jobs").get() as { status: string }).status).toBe("queued");

    handleControl(db, config, { method: "POST", path: "/api/kill", query: new URLSearchParams(), body: { active: false }, actor: "owner" });
    handleControl(db, config, { method: "POST", path: "/api/agents/supervisor/pause", query: new URLSearchParams(), body: { reason: "test" }, actor: "owner" });
    await runtime.tick();
    await runtime.idle();
    expect((db.prepare("SELECT status FROM jobs").get() as { status: string }).status).toBe("queued");

    handleControl(db, config, { method: "POST", path: "/api/agents/supervisor/resume", query: new URLSearchParams(), body: {}, actor: "owner" });
    await runtime.tick();
    await runtime.idle();
    expect((db.prepare("SELECT status FROM jobs").get() as { status: string }).status).toBe("done");
    const actions = (db.prepare("SELECT action FROM audit ORDER BY id").all() as Array<{ action: string }>).map(row => row.action);
    expect(actions).toEqual(["kill.on", "kill.off", "agent.pause", "agent.resume"]);
  });

  it("approving the legal rule set records the approved rules for the current version", () => {
    const db = openDb(":memory:");
    const id = requestDecision(db, "legal_ruleset", "rules", "v", "Zatwierdź", {});
    const response = handleControl(db, config, { method: "POST", path: `/api/decisions/${id}`, query: new URLSearchParams(), body: { resolution: "approved", rules: ["L5_organizer_own_channel", "bogus"] }, actor: "owner" });
    expect(response.status).toBe(200);
    const meta = JSON.parse((db.prepare("SELECT value FROM meta WHERE key = 'legal_rules'").get() as { value: string }).value);
    expect(meta.approved).toEqual(["L5_organizer_own_channel"]);
  });
});

describe("config", () => {
  it("defaults to publication off and refuses publish in development", () => {
    expect(loadConfig({}).publishMode).toBe("off");
    expect(() => loadConfig({ ENGINE_PUBLISH_MODE: "publish" })).toThrow();
    expect(loadConfig({ ENGINE_ENV: "production", ENGINE_PUBLISH_MODE: "publish" }).publishMode).toBe("publish");
    expect(loadConfig({ ENGINE_CONTROL_TOKEN: "short" }).controlToken).toBeNull();
  });
});

describe("owner can revisit a decision", () => {
  it("recheck after an owner verdict opens a new owner decision instead of re-applying the old one", async () => {
    const { registerSource, getSource } = await import("../src/sources.ts");
    const db = openDb(":memory:");
    const { id } = registerSource(db, { url: "https://krakow.example.pl", discoveredVia: "test" })!;
    const decision = requestDecision(db, "source_approval", "source", String(id), "Źródło", { url: "https://krakow.example.pl/" });
    const control = (path: string, body: Record<string, unknown> = {}) => handleControl(db, config, { method: "POST", path, query: new URLSearchParams(), body, actor: "owner" });
    control(`/api/decisions/${decision}`, { resolution: "rejected" });
    expect(getSource(db, id)?.status).toBe("blocked");
    control(`/api/sources/${id}/recheck`);
    expect(getSource(db, id)?.status).toBe("needs_owner");
    const open = db.prepare("SELECT id, title FROM decisions WHERE status = 'open'").all() as Array<{ id: number; title: string }>;
    expect(open).toHaveLength(1);
    expect(open[0].title).toContain("poprzednio: odrzucone");
    control(`/api/decisions/${open[0].id}`, { resolution: "approved" });
    expect(getSource(db, id)?.status).toBe("approved");
  });

  it("rejects a decision call without an explicit resolution", () => {
    const db = openDb(":memory:");
    const decision = requestDecision(db, "legal_ruleset", "rules", "v", "Zatwierdź", {});
    const response = handleControl(db, config, { method: "POST", path: `/api/decisions/${decision}`, query: new URLSearchParams(), body: {}, actor: "owner" });
    expect(response.status).toBe(400);
    expect((db.prepare("SELECT status FROM decisions WHERE id = ?").get(decision) as { status: string }).status).toBe("open");
  });
});

describe("publisher write lock", () => {
  it("runs writes one at a time even when started in parallel, and keeps going after a failure", async () => {
    const { withWriteLock } = await import("../src/agents/pipeline.ts");
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    const task = (name: string, fail = false) => withWriteLock(async () => {
      active += 1; maxActive = Math.max(maxActive, active);
      await new Promise(done => setTimeout(done, 5));
      order.push(name); active -= 1;
      if (fail) throw new Error("boom");
      return name;
    });
    const results = await Promise.allSettled([task("a"), task("b", true), task("c")]);
    expect(maxActive).toBe(1);
    expect(order).toEqual(["a", "b", "c"]);
    expect(results.map(result => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });
});
