// Entry point. Usage (Node 24, native TypeScript):
//   node engine/src/main.ts run [--for <seconds>]   start agents (+ control API for role all/control)
//   node engine/src/main.ts status                  print status JSON
//   node engine/src/main.ts once <jobType> [json]   enqueue one job and process the queue until idle
//   node engine/src/main.ts backup                  write a consistent SQLite backup
//   node engine/src/main.ts kill on|off [reason]    kill switch without the panel (SSH)

import path from "node:path";
import { describeConfig, loadConfig } from "./config.ts";
import { startControlServer, statusPayload } from "./control.ts";
import { backupTo, nowIso, openDb } from "./db.ts";
import { createFetcher } from "./net/fetcher.ts";
import { enqueue } from "./queue.ts";
import { agentForJob, createRuntime, registerAgents } from "./runtime.ts";
import { createServices } from "./services.ts";
import { audit, log, setMeta } from "./store.ts";

async function main(): Promise<void> {
  const [command = "run", ...args] = process.argv.slice(2);
  const config = loadConfig();
  const db = openDb(config.dbPath);
  registerAgents(db);

  if (command === "status") { console.log(JSON.stringify(statusPayload(db, config), null, 2)); return; }

  if (command === "backup") {
    const file = path.join(config.backupDir, `engine-manual-${nowIso().replace(/[:.]/g, "-").slice(0, 19)}.sqlite`);
    backupTo(db, file);
    console.log(file);
    return;
  }

  if (command === "kill") {
    const active = args[0] === "on";
    setMeta(db, "kill_switch", JSON.stringify({ active, reason: active ? args.slice(1).join(" ") || "CLI" : null, since: active ? nowIso() : null }));
    audit(db, "cli", active ? "kill.on" : "kill.off", { reason: args.slice(1).join(" ") });
    console.log(`kill switch: ${active ? "ON" : "OFF"}`);
    return;
  }

  const fetcher = createFetcher(db, config);
  const services = createServices(db, config, fetcher, { withServiceKey: config.role === "publisher" || config.role === "all" });

  if (command === "once") {
    const type = args[0];
    const agent = type ? agentForJob(type) : null;
    if (!agent) throw new Error(`Nieznany typ zadania: ${type}`);
    enqueue(db, agent.name, type, args[1] ? JSON.parse(args[1]) as Record<string, unknown> : {}, { priority: 1 });
    const runtime = createRuntime(db, { ...config, role: "all" }, fetcher, services);
    const deadline = Date.now() + Number(process.env.ENGINE_ONCE_TIMEOUT_MS ?? 300_000);
    // Only drain the queue; schedules are not triggered by `once`.
    db.prepare("UPDATE schedules SET last_enqueued_at = ? WHERE last_enqueued_at IS NULL").run(nowIso());
    // Same dispatch cadence as `run` (tick every second), until the queue is drained.
    while (Date.now() < deadline) {
      await runtime.tick();
      await new Promise(done => setTimeout(done, 1000));
      const pending = db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE (status = 'queued' AND run_after <= ?) OR status = 'running'").get(nowIso()) as { n: number };
      if (!pending.n) break;
    }
    await runtime.idle();
    console.log(JSON.stringify(statusPayload(db, config).agents.filter(item => item.runsOk || item.runsFailed), null, 2));
    return;
  }

  if (command !== "run") throw new Error(`Nieznana komenda: ${command}`);
  log(db, "info", "supervisor", `Konfiguracja: ${JSON.stringify(describeConfig(config))}`);
  // Worker/publisher containers expose only /healthz on loopback for the Docker healthcheck.
  const server = config.role === "all" || config.role === "control"
    ? startControlServer(db, config)
    : startControlServer(db, config, { healthOnly: true, host: "127.0.0.1", port: Number(process.env.ENGINE_HEALTH_PORT ?? 8787) });
  const runtime = config.role === "control" ? null : createRuntime(db, config, fetcher, services);
  runtime?.start();
  const shutdown = async (signal: string) => {
    log(db, "info", "supervisor", `Otrzymano ${signal}, zatrzymywanie.`);
    server?.close();
    await runtime?.stop();
    db.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  const forSeconds = args[0] === "--for" ? Number(args[1]) : 0;
  if (forSeconds > 0) setTimeout(() => void shutdown("timeout"), forSeconds * 1000);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
