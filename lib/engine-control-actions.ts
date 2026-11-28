"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { engineCommand, EngineUnavailableError } from "@/lib/engine-control";

// Every action re-checks the admin role on the server (inside engineCommand → requireAdmin).

const PATH = "/admin/engine";

function text(formData: FormData, name: string, max = 500): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function run(path: string, body: Record<string, unknown>, notice: string): Promise<never> {
  let target = `${PATH}?notice=${encodeURIComponent(notice)}`;
  try {
    await engineCommand(path, body);
  } catch (error) {
    if (!(error instanceof EngineUnavailableError)) throw error;
    target = `${PATH}?error=${encodeURIComponent(error.message.slice(0, 200))}`;
  }
  revalidatePath(PATH);
  redirect(target);
}

export async function engineKillAction(formData: FormData) {
  const active = text(formData, "active") === "1";
  await run("/api/kill", { active, reason: text(formData, "reason", 300) || undefined }, active ? "Wyłącznik awaryjny włączony." : "Silnik wznowiony.");
}

export async function engineAgentAction(formData: FormData) {
  const name = text(formData, "agent", 40);
  const action = text(formData, "action", 10) === "resume" ? "resume" : "pause";
  if (!/^[a-z]+$/.test(name)) redirect(`${PATH}?error=${encodeURIComponent("Nieprawidłowy agent.")}`);
  await run(`/api/agents/${name}/${action}`, { reason: text(formData, "reason", 300) || "Wstrzymane z panelu" }, `Agent ${name}: ${action === "pause" ? "wstrzymany" : "wznowiony"}.`);
}

async function resolveDecision(formData: FormData, resolution: "approved" | "rejected") {
  const id = Number(text(formData, "id", 12));
  if (!Number.isSafeInteger(id) || id <= 0) redirect(`${PATH}?error=${encodeURIComponent("Nieprawidłowa decyzja.")}`);
  const rules = formData.getAll("rules").filter((value): value is string => typeof value === "string");
  await run(`/api/decisions/${id}`, { resolution, note: text(formData, "note", 2000) || undefined, ...(rules.length ? { rules } : {}) }, resolution === "approved" ? "Decyzja zatwierdzona." : "Decyzja odrzucona.");
}

// One action per button: the outcome never depends on the submitter's name/value being forwarded.
export async function engineApproveDecisionAction(formData: FormData) {
  await resolveDecision(formData, "approved");
}

export async function engineRejectDecisionAction(formData: FormData) {
  await resolveDecision(formData, "rejected");
}

/** Generic entry point kept for non-JS posts; a missing or unknown resolution is an error, never a rejection. */
export async function engineDecisionAction(formData: FormData) {
  const value = text(formData, "resolution", 10);
  if (value !== "approved" && value !== "rejected") redirect(`${PATH}?error=${encodeURIComponent("Nie rozpoznano decyzji — nic nie zapisano.")}`);
  await resolveDecision(formData, value);
}

export async function engineSourceAction(formData: FormData) {
  const id = Number(text(formData, "id", 12));
  const action = text(formData, "action", 20);
  if (!Number.isSafeInteger(id) || id <= 0 || !["pause", "resume", "retract", "autopublish", "recheck"].includes(action)) {
    redirect(`${PATH}?error=${encodeURIComponent("Nieprawidłowa operacja na źródle.")}`);
  }
  await run(`/api/sources/${id}/${action}`, { enabled: text(formData, "enabled") === "1" }, `Źródło #${id}: ${action}.`);
}

export async function engineAddSourceAction(formData: FormData) {
  const url = text(formData, "url", 2000);
  try { new URL(url); } catch { redirect(`${PATH}?error=${encodeURIComponent("Podaj pełny adres strony (https://…).")}`); }
  await run("/api/sources", { url, name: text(formData, "name", 300) || undefined, city: text(formData, "city", 120) || undefined, kind: text(formData, "kind", 40) || "organizer" }, "Źródło dodane — przejdzie weryfikację prawną.");
}

export async function engineBudgetAction(formData: FormData) {
  const dailyPln = Number(text(formData, "dailyPln", 12).replace(",", "."));
  const monthlyPln = Number(text(formData, "monthlyPln", 12).replace(",", "."));
  await run("/api/budget", { dailyPln, monthlyPln }, "Limity budżetu zapisane.");
}
