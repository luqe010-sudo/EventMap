import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";
import { openDb } from "../src/db.ts";
import { evaluateSource, findProhibitions, isBlockedDomain, type LegalObservation } from "../src/legal/policy.ts";
import { createFetcher, FetchRefused, isPrivateAddress, looksLikeChallenge, validatePublicUrl } from "../src/net/fetcher.ts";
import { isAllowed, parseRobots } from "../src/net/robots.ts";

const base: LegalObservation = {
  domain: "gok.example.pl", kind: "institution", integration: "ics", robotsAllowsHome: true, robotsAllowsFeed: true,
  tdmReserved: false, termsTexts: [], pageText: "", isPublicSector: false, ownerDecision: null
};
const all = new Set(["L4_open_license", "L5_organizer_own_channel", "L6_public_sector"]);

describe("legal policy", () => {
  it("blocks by default until the owner approves the rule set", () => {
    const pending = evaluateSource(base, new Set());
    expect(pending.outcome).toBe("needs_owner");
    expect(pending.wouldApproveBy).toBe("L5_organizer_own_channel");
    expect(evaluateSource(base, all).outcome).toBe("approved");
  });

  it("always blocks ticket sellers, aggregators and social networks", () => {
    expect(isBlockedDomain("www.biletyna.pl")).toBe(true);
    expect(isBlockedDomain("m.facebook.com")).toBe(true);
    expect(evaluateSource({ ...base, domain: "ebilet.pl" }, all)).toMatchObject({ outcome: "blocked", rule: "L0_blocklist" });
  });

  it("respects robots.txt, TDM reservation and prohibitive terms", () => {
    expect(evaluateSource({ ...base, robotsAllowsFeed: false }, all)).toMatchObject({ outcome: "blocked", rule: "L2_robots" });
    expect(evaluateSource({ ...base, tdmReserved: true }, all)).toMatchObject({ outcome: "needs_owner", rule: "L3_terms" });
    const terms = ["§5. Zabrania się kopiowania treści serwisu bez zgody."];
    expect(findProhibitions(terms)).toHaveLength(1);
    expect(evaluateSource({ ...base, termsTexts: terms }, all)).toMatchObject({ outcome: "needs_owner", rule: "L3_terms" });
  });

  it("recognises open licences but not NC/ND variants; unknown channels need the owner", () => {
    expect(evaluateSource({ ...base, kind: "unknown", integration: "unknown", pageText: "Dane: CC BY 4.0" }, all)).toMatchObject({ outcome: "approved", rule: "L4_open_license", license: "CC-BY-4.0" });
    expect(evaluateSource({ ...base, kind: "unknown", integration: "unknown", pageText: "CC BY-NC 4.0" }, all).outcome).toBe("needs_owner");
    expect(evaluateSource({ ...base, ownerDecision: "rejected" }, all)).toMatchObject({ outcome: "blocked", rule: "L1_owner" });
  });
});

describe("robots.txt", () => {
  const rules = parseRobots(["User-agent: *", "Disallow: /admin", "Allow: /admin/public", "Disallow: /*.pdf$", "", "User-agent: MapaImprezBot", "Disallow: /private"].join("\n"));
  it("uses the specific group and the longest match", () => {
    expect(isAllowed(rules, "MapaImprezBot/1.0 (+https://mapaimprez.pl/bot)", "/admin")).toBe(true); // specific group wins
    expect(isAllowed(rules, "MapaImprezBot/1.0", "/private/x")).toBe(false);
    expect(isAllowed(rules, "OtherBot", "/admin/x")).toBe(false);
    expect(isAllowed(rules, "OtherBot", "/admin/public/x")).toBe(true);
    expect(isAllowed(rules, "OtherBot", "/files/a.pdf")).toBe(false);
  });
});

describe("fetcher safety", () => {
  it("rejects private addresses, credentials and odd ports", () => {
    for (const address of ["10.0.0.1", "127.0.0.1", "192.168.1.1", "172.20.0.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
    expect(isPrivateAddress("51.83.1.1")).toBe(false);
    expect(() => validatePublicUrl("http://localhost/x")).toThrow(FetchRefused);
    expect(() => validatePublicUrl("https://user:pw@example.pl/")).toThrow(FetchRefused);
    expect(() => validatePublicUrl("https://example.pl:8080/")).toThrow(FetchRefused);
    expect(() => validatePublicUrl("file:///etc/passwd")).toThrow(FetchRefused);
  });

  it("detects CAPTCHA challenges", () => {
    expect(looksLikeChallenge(403, "<div class=\"g-recaptcha\"></div>")).toBe(true);
    expect(looksLikeChallenge(200, "<html>normal page</html>")).toBe(false);
  });

  it("honours robots.txt, refuses DNS to private ranges and never retries around 403", async () => {
    const config = { ...loadConfig({}), hostMinIntervalMs: 1000 };
    const calls: string[] = [];
    const fetchImpl = (async (input: URL | string | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /tajne", { status: 200 });
      if (url.includes("/zablokowane")) return new Response("forbidden", { status: 403 });
      return new Response("<html>ok</html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8", etag: "\"v1\"" } });
    }) as typeof fetch;
    const fetcher = createFetcher(openDb(":memory:"), config, { fetchImpl, resolve: async host => host === "evil.example.pl" ? ["10.1.2.3"] : ["51.83.1.1"], sleep: async () => undefined });
    await expect(fetcher.get("https://ok.example.pl/tajne/x")).rejects.toMatchObject({ code: "robots" });
    const ok = await fetcher.get("https://ok.example.pl/wydarzenia");
    expect(ok.body).toContain("ok");
    expect(ok.etag).toBe("\"v1\"");
    await expect(fetcher.get("https://ok.example.pl/zablokowane")).rejects.toMatchObject({ code: "access_denied" });
    await expect(fetcher.get("https://evil.example.pl/")).rejects.toMatchObject({ code: "blocked_address" });
    expect(calls.filter(url => url.endsWith("/robots.txt"))).toHaveLength(1); // cached
    expect(calls.some(url => url.includes("/tajne"))).toBe(false);
  });
});
