import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import type { EventAnalyticsType } from "@/lib/event-analytics-contract";

const RATE_WINDOW_MS = 60_000;
const DEDUP_WINDOW_MS = 30_000;
const processSalt = randomBytes(32);

/** Only the deployment's trusted Vercel header is used; arbitrary proxy headers are ignored. */
export function analyticsClientKey(request: Request): string {
  const address = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : null;
  if (!address || !isIP(address)) return "unidentified";
  return createHmac("sha256", processSalt).update(address).digest("hex");
}

type Bucket = { count: number; expires: number };
type Receipt = { expires: number | null; token: object };

/** Bounded, best-effort protection within a warm Node instance; not a distributed receipt store. */
export class AnalyticsIngestionGuard {
  private clients = new Map<string, Bucket>();
  private receipts = new Map<string, Receipt>();
  private global: Bucket = { count: 0, expires: 0 };

  constructor(private readonly clock = Date.now, private readonly capacity = 10_000) {}

  consume(clientKey: string): boolean {
    const now = this.clock();
    this.prune(now);
    if (this.global.expires <= now) this.global = { count: 0, expires: now + RATE_WINDOW_MS };
    if (this.global.count >= 600) return false;
    let bucket = this.clients.get(clientKey);
    if (!bucket) {
      // Do not evict live buckets: rotating identities must not bypass the cap.
      if (this.clients.size >= this.capacity) return false;
      bucket = { count: 0, expires: now + RATE_WINDOW_MS };
      this.clients.set(clientKey, bucket);
    }
    if (bucket.count >= 60) return false;
    bucket.count += 1;
    this.global.count += 1;
    return true;
  }

  reserve(eventId: string, sessionId: string, type: EventAnalyticsType):
    { kind: "reserved"; release: () => void; settle: () => void } | { kind: "duplicate" } | { kind: "full" } {
    const now = this.clock();
    this.prune(now);
    const key = `${eventId.toLowerCase()}:${sessionId.toLowerCase()}:${type}`;
    if (this.receipts.has(key)) return { kind: "duplicate" };
    if (this.receipts.size >= this.capacity) return { kind: "full" };
    const token = {};
    // A pending INSERT must not expire while its response is still awaited.
    this.receipts.set(key, { token, expires: null });
    return {
      kind: "reserved",
      release: () => { if (this.receipts.get(key)?.token === token) this.receipts.delete(key); },
      settle: () => {
        const receipt = this.receipts.get(key);
        if (receipt?.token === token && receipt.expires === null) receipt.expires = this.clock() + DEDUP_WINDOW_MS;
      }
    };
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.clients) if (bucket.expires <= now) this.clients.delete(key);
    for (const [key, receipt] of this.receipts) if (receipt.expires !== null && receipt.expires <= now) this.receipts.delete(key);
  }
}

export const analyticsIngestionGuard = new AnalyticsIngestionGuard();
