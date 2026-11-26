// Polite, defensive HTTP client used by every agent that touches the internet.
// - honours robots.txt (cached 24 h; unreachable robots => treat as disallowed)
// - per-host minimum interval and Crawl-delay, 429 Retry-After backoff
// - never sends cookies, credentials or owner data; generic User-Agent
// - refuses private/loopback addresses (SSRF), non-HTTP schemes and odd ports
// - caps response size and time; never retries around 401/403/CAPTCHA
// Fetched content is untrusted data. Nothing here interprets it as instructions.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { EngineConfig } from "../config.ts";
import type { Db } from "../db.ts";
import { recall, remember } from "../store.ts";
import { crawlDelaySeconds, isAllowed, parseRobots, type RobotsRules } from "./robots.ts";

export type FetchResult = {
  ok: boolean;
  status: number;
  url: string;
  contentType: string | null;
  body: string;
  bytes: number;
  notModified: boolean;
  etag: string | null;
  lastModified: string | null;
};

export class FetchRefused extends Error {
  readonly code: "robots" | "blocked_address" | "bad_url" | "access_denied" | "rate_limited" | "too_large" | "captcha";
  constructor(code: FetchRefused["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export type Fetcher = {
  get(url: string, options?: { etag?: string | null; lastModified?: string | null; accept?: string; skipRobots?: boolean }): Promise<FetchResult>;
  robotsAllows(url: string): Promise<boolean>;
};

type Deps = { fetchImpl?: typeof fetch; resolve?: (host: string) => Promise<string[]>; sleep?: (ms: number) => Promise<void>; now?: () => number };

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224 || (a === 198 && (b === 18 || b === 19));
  }
  const lower = address.toLowerCase();
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80") || lower.startsWith("ff");
}

export function validatePublicUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new FetchRefused("bad_url", `Nieprawidłowy URL: ${raw.slice(0, 200)}`); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchRefused("bad_url", "Dozwolone tylko http/https.");
  if (url.username || url.password) throw new FetchRefused("bad_url", "URL z danymi logowania jest niedozwolony.");
  if (url.port && !["80", "443"].includes(url.port)) throw new FetchRefused("bad_url", "Niestandardowy port jest niedozwolony.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) {
    throw new FetchRefused("blocked_address", "Adres lokalny jest niedozwolony.");
  }
  if (isIP(host.replace(/^\[|\]$/g, "")) && isPrivateAddress(host.replace(/^\[|\]$/g, ""))) throw new FetchRefused("blocked_address", "Adres prywatny jest niedozwolony.");
  url.hash = "";
  return url;
}

const CAPTCHA_MARKERS = [/g-recaptcha/i, /hcaptcha/i, /cf-challenge/i, /challenge-platform/i, /captcha-delivery/i, /Attention Required! \| Cloudflare/i];

export function looksLikeChallenge(status: number, body: string): boolean {
  if (status === 403 || status === 503 || status === 429) return CAPTCHA_MARKERS.some(marker => marker.test(body.slice(0, 20000)));
  return body.length < 30000 && CAPTCHA_MARKERS.some(marker => marker.test(body)) && !/<script[^>]+application\/ld\+json/i.test(body);
}

export function createFetcher(db: Db, config: EngineConfig, deps: Deps = {}): Fetcher {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const resolve = deps.resolve ?? (async (host: string) => (await lookup(host, { all: true })).map(entry => entry.address));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(done => setTimeout(done, ms)));
  const now = deps.now ?? (() => Date.now());
  const nextSlot = new Map<string, number>();
  const robotsMemo = new Map<string, { rules: RobotsRules | "deny"; at: number }>();

  async function assertPublicHost(url: URL): Promise<void> {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [host] : await resolve(host);
    if (!addresses.length || addresses.some(isPrivateAddress)) throw new FetchRefused("blocked_address", `Host ${host} wskazuje adres prywatny.`);
  }

  async function waitForSlot(host: string, delayMs: number): Promise<void> {
    const at = now();
    const slot = Math.max(at, nextSlot.get(host) ?? 0);
    nextSlot.set(host, slot + delayMs);
    if (slot > at) await sleep(slot - at);
  }

  async function readCapped(response: Response): Promise<{ text: string; bytes: number }> {
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > config.fetchMaxBytes) throw new FetchRefused("too_large", `Odpowiedź przekracza ${config.fetchMaxBytes} B.`);
    if (!response.body) return { text: "", bytes: 0 };
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > config.fetchMaxBytes) {
        await reader.cancel();
        throw new FetchRefused("too_large", `Odpowiedź przekracza ${config.fetchMaxBytes} B.`);
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    const charset = /charset=([\w-]+)/i.exec(response.headers.get("content-type") ?? "")?.[1]?.toLowerCase();
    let text: string;
    try { text = new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8").decode(buffer); }
    catch { text = new TextDecoder("utf-8").decode(buffer); }
    return { text, bytes };
  }

  async function rawGet(url: URL, headers: Record<string, string>): Promise<{ response: Response; finalUrl: URL }> {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      await assertPublicHost(current);
      await waitForSlot(current.host, config.hostMinIntervalMs);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(current, { headers: { "user-agent": config.userAgent, "accept-language": "pl,en;q=0.5", ...headers }, redirect: "manual", signal: controller.signal });
      } finally { clearTimeout(timer); }
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        current = validatePublicUrl(new URL(response.headers.get("location") as string, current).toString());
        continue;
      }
      return { response, finalUrl: current };
    }
    throw new FetchRefused("bad_url", "Zbyt wiele przekierowań.");
  }

  async function robotsFor(url: URL): Promise<RobotsRules | "deny"> {
    const origin = url.origin;
    const memo = robotsMemo.get(origin);
    if (memo && now() - memo.at < 24 * 3600_000) return memo.rules;
    const stored = recall<{ text: string | null; deny: boolean; at: number } | null>(db, "robots", origin, null);
    if (stored && now() - stored.at < 24 * 3600_000) {
      const rules = stored.deny ? "deny" as const : parseRobots(stored.text ?? "");
      robotsMemo.set(origin, { rules, at: stored.at });
      return rules;
    }
    let rules: RobotsRules | "deny";
    let text: string | null = null;
    try {
      const { response } = await rawGet(new URL("/robots.txt", origin), { accept: "text/plain" });
      if (response.status >= 500) rules = "deny"; // RFC 9309: unreachable => complete disallow
      else if (response.status >= 400) rules = parseRobots(""); // missing => allow all
      else { text = (await readCapped(response)).text.slice(0, 500_000); rules = parseRobots(text); }
    } catch (error) {
      if (error instanceof FetchRefused && error.code === "blocked_address") throw error;
      rules = "deny";
    }
    robotsMemo.set(origin, { rules, at: now() });
    remember(db, "robots", origin, { text, deny: rules === "deny", at: now() });
    return rules;
  }

  async function robotsAllows(raw: string): Promise<boolean> {
    const url = validatePublicUrl(raw);
    const rules = await robotsFor(url);
    return rules !== "deny" && isAllowed(rules, config.userAgent, url.pathname + url.search);
  }

  return {
    robotsAllows,
    async get(raw, options = {}) {
      const url = validatePublicUrl(raw);
      if (!options.skipRobots) {
        const rules = await robotsFor(url);
        if (rules === "deny" || !isAllowed(rules, config.userAgent, url.pathname + url.search)) {
          throw new FetchRefused("robots", `robots.txt nie pozwala pobrać ${url.pathname}`);
        }
        const delay = crawlDelaySeconds(rules, config.userAgent);
        if (delay && delay * 1000 > config.hostMinIntervalMs) await waitForSlot(url.host, Math.min(delay, 120) * 1000 - config.hostMinIntervalMs);
      }
      const headers: Record<string, string> = { accept: options.accept ?? "text/html,application/xhtml+xml,application/ld+json,text/calendar,application/rss+xml,application/xml;q=0.9,*/*;q=0.5" };
      if (options.etag) headers["if-none-match"] = options.etag;
      if (options.lastModified) headers["if-modified-since"] = options.lastModified;
      const { response, finalUrl } = await rawGet(url, headers);
      const base = {
        status: response.status, url: finalUrl.toString(), contentType: response.headers.get("content-type"),
        etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified")
      };
      if (response.status === 304) return { ...base, ok: true, body: "", bytes: 0, notModified: true };
      if (response.status === 429) {
        const retry = Number(response.headers.get("retry-after") ?? "600");
        nextSlot.set(finalUrl.host, now() + Math.min(Number.isFinite(retry) ? retry : 600, 86400) * 1000);
        throw new FetchRefused("rate_limited", `Host ${finalUrl.host} ograniczył liczbę żądań (429).`);
      }
      const { text, bytes } = await readCapped(response);
      if (looksLikeChallenge(response.status, text)) throw new FetchRefused("captcha", `Host ${finalUrl.host} wymaga weryfikacji (CAPTCHA/challenge) — nie obchodzimy.`);
      if (response.status === 401 || response.status === 403) throw new FetchRefused("access_denied", `Brak dostępu (${response.status}) — nie obchodzimy.`);
      return { ...base, ok: response.ok, body: text, bytes, notModified: false };
    }
  };
}
