// Financial Controller core. Paid operations must ask `authorizeSpend` first.
// Limits are hard: when the daily or monthly limit would be exceeded the call is
// refused and only paid work stops; free work (own crawling, parsing) continues.
// Agents cannot change limits: only control.ts (owner via panel) can, and even
// then values are clamped to the ceilings from environment configuration.

import type { EngineConfig } from "./config.ts";
import { type Db, nowIso } from "./db.ts";
import { audit, log, warsawDay } from "./store.ts";

export type BudgetLimits = { dailyPln: number; monthlyPln: number; updatedAt: string | null; updatedBy: string | null };

export type SpendCategory = "api" | "llm" | "geocode" | "infra" | "search";

export function warsawMonth(date: Date = new Date()): string {
  return warsawDay(date).slice(0, 7);
}

export function getLimits(db: Db, config: EngineConfig): BudgetLimits {
  const row = db.prepare("SELECT value, updated_at FROM meta WHERE key = 'budget'").get() as { value: string; updated_at: string } | undefined;
  if (!row) return { dailyPln: config.defaultBudgetDailyPln, monthlyPln: config.defaultBudgetMonthlyPln, updatedAt: null, updatedBy: null };
  const parsed = JSON.parse(row.value) as { dailyPln: number; monthlyPln: number; updatedBy: string };
  return {
    dailyPln: Math.min(parsed.dailyPln, config.budgetCeilingDailyPln),
    monthlyPln: Math.min(parsed.monthlyPln, config.budgetCeilingMonthlyPln),
    updatedAt: row.updated_at,
    updatedBy: parsed.updatedBy
  };
}

/** Owner-only. Called from the control API after admin authentication. */
export function setLimits(db: Db, config: EngineConfig, actor: string, dailyPln: number, monthlyPln: number): BudgetLimits {
  if (![dailyPln, monthlyPln].every(value => Number.isFinite(value) && value >= 0)) throw new Error("Limity muszą być nieujemnymi liczbami.");
  const daily = Math.min(dailyPln, config.budgetCeilingDailyPln);
  const monthly = Math.min(monthlyPln, config.budgetCeilingMonthlyPln);
  db.prepare("INSERT INTO meta (key, value, updated_at) VALUES ('budget', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(JSON.stringify({ dailyPln: daily, monthlyPln: monthly, updatedBy: actor }), nowIso());
  audit(db, actor, "budget.set", { requested: { dailyPln, monthlyPln }, applied: { daily, monthly } });
  return getLimits(db, config);
}

export function spent(db: Db, now: Date = new Date()): { day: number; month: number } {
  const day = db.prepare("SELECT COALESCE(SUM(amount_pln), 0) AS total FROM costs WHERE day = ? AND category != 'infra'").get(warsawDay(now)) as { total: number };
  const month = db.prepare("SELECT COALESCE(SUM(amount_pln), 0) AS total FROM costs WHERE month = ? AND category != 'infra'").get(warsawMonth(now)) as { total: number };
  return { day: day.total, month: month.total };
}

export type SpendDecision = { allowed: boolean; reason: string | null };

export function authorizeSpend(db: Db, config: EngineConfig, agent: string, estimatePln: number, now: Date = new Date()): SpendDecision {
  if (!(estimatePln >= 0)) return { allowed: false, reason: "Nieprawidłowy szacunek kosztu." };
  if (estimatePln === 0) return { allowed: true, reason: null };
  const limits = getLimits(db, config);
  const used = spent(db, now);
  if (used.day + estimatePln > limits.dailyPln) {
    log(db, "warn", agent, `Limit dzienny osiągnięty: ${used.day.toFixed(2)} / ${limits.dailyPln} PLN. Płatna operacja wstrzymana.`);
    return { allowed: false, reason: "daily_limit" };
  }
  if (used.month + estimatePln > limits.monthlyPln) {
    log(db, "warn", agent, `Limit miesięczny osiągnięty: ${used.month.toFixed(2)} / ${limits.monthlyPln} PLN. Płatna operacja wstrzymana.`);
    return { allowed: false, reason: "monthly_limit" };
  }
  return { allowed: true, reason: null };
}

export function recordCost(db: Db, input: { agent: string; category: SpendCategory; provider: string; amountPln: number; units?: number; note?: string; at?: Date }): void {
  const at = input.at ?? new Date();
  db.prepare("INSERT INTO costs (at, day, month, agent, category, provider, amount_pln, units, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(at.toISOString(), warsawDay(at), warsawMonth(at), input.agent, input.category, input.provider, input.amountPln, input.units ?? 0, input.note ?? null);
}

export type CostSummary = {
  limits: BudgetLimits; ceilings: { dailyPln: number; monthlyPln: number };
  today: number; month: number; infraMonthPln: number;
  byProvider: Array<{ provider: string; category: string; amount: number; units: number }>;
  publishedThisMonth: number; costPerPublishedEvent: number | null;
};

export function costSummary(db: Db, config: EngineConfig, now: Date = new Date()): CostSummary {
  const month = warsawMonth(now);
  const used = spent(db, now);
  const byProvider = db.prepare("SELECT provider, category, SUM(amount_pln) AS amount, SUM(units) AS units FROM costs WHERE month = ? GROUP BY provider, category ORDER BY amount DESC")
    .all(month) as Array<{ provider: string; category: string; amount: number; units: number }>;
  const published = db.prepare("SELECT COALESCE(SUM(value), 0) AS total FROM metrics_daily WHERE day LIKE ? AND key = 'events_published'")
    .get(`${month}-%`) as { total: number };
  // Infrastructure is a fixed monthly cost (VPS); it is part of the unit cost.
  const total = used.month + config.infraMonthlyPln;
  return {
    limits: getLimits(db, config),
    ceilings: { dailyPln: config.budgetCeilingDailyPln, monthlyPln: config.budgetCeilingMonthlyPln },
    today: used.day,
    month: used.month,
    infraMonthPln: config.infraMonthlyPln,
    byProvider,
    publishedThisMonth: published.total,
    costPerPublishedEvent: published.total > 0 ? total / published.total : null
  };
}
