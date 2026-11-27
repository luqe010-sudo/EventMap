// Classic-code discovery of integration points on an organiser's website:
// calendar feeds, RSS feeds, event listing pages and event detail links.

import { cleanText, decodeEntities, parseFlexibleDate } from "../facts.ts";
import { extractLinks, sameSite } from "./common.ts";
import { extractJsonLdBlocks } from "./jsonld.ts";
import { looksLikeTribe, tribeEndpoint } from "./tribe.ts";

export type SiteProbe = {
  icsFeeds: string[];
  rssFeeds: string[];
  listingPages: string[];
  hasJsonLdEvents: boolean;
  /** WordPress "The Events Calendar" REST endpoint, if the site uses the plugin. */
  tribeApi: string | null;
  title: string | null;
  termsPages: string[];
};

const LISTING_WORDS = /(wydarzen|imprez|kalendarz|repertuar|program|agenda|events?|koncert|spektakl|kultura|afisz|co-sie-dzieje|zapowiedz|harmonogram)/i;
const TERMS_WORDS = /(regulamin|polityka|terms|warunki|prawa-autorskie|copyright|nota-prawna|informacje-prawne)/i;

export function probeSite(html: string, pageUrl: string): SiteProbe {
  const base = new URL(pageUrl);
  const links = extractLinks(html, pageUrl);
  const ics = new Set<string>();
  const rss = new Set<string>();
  const listing = new Set<string>();
  const terms = new Set<string>();
  for (const link of links) {
    let url: URL;
    try { url = new URL(link.href); } catch { continue; }
    if (!sameSite(url, base)) continue;
    const type = (link.type ?? "").toLowerCase();
    const href = url.toString();
    if (type.includes("text/calendar") || /\.ics(\?|$)/i.test(url.pathname + url.search) || /[?&](ical|outlook-ical)=/i.test(url.search) || /\/ical\/?$/i.test(url.pathname)) ics.add(href);
    else if ((link.rel ?? "").includes("alternate") && /(rss|atom)\+xml/.test(type)) rss.add(href);
    else if (LISTING_WORDS.test(url.pathname) || LISTING_WORDS.test(link.text)) {
      if (url.pathname.split("/").filter(Boolean).length <= 2) listing.add(href);
    }
    if (TERMS_WORDS.test(url.pathname) || TERMS_WORDS.test(link.text)) terms.add(href);
  }
  const hasJsonLdEvents = extractJsonLdBlocks(html).some(block => JSON.stringify(block).match(/"@type"\s*:\s*"[A-Za-z]*Event"/));
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  // Most specific listing pages first ("wydarzenia", "kalendarz", "repertuar" beat "kultura", "program").
  const rank = (href: string) => /(wydarzen|kalendarz|repertuar|events?|imprez|afisz)/i.test(new URL(href).pathname) ? 0 : 1;
  return {
    icsFeeds: [...ics].slice(0, 5),
    rssFeeds: [...rss].slice(0, 5),
    listingPages: [...listing].sort((a, b) => rank(a) - rank(b)).slice(0, 8),
    hasJsonLdEvents,
    tribeApi: looksLikeTribe(html) ? tribeEndpoint(pageUrl) : null,
    title: titleMatch ? cleanText(titleMatch[1], 200) : null,
    termsPages: [...terms].slice(0, 5)
  };
}

const DETAIL_HINT = /(wydarzeni|wydarzenie|event|impreza|imprezy|repertuar|spektakl|koncert|seans|wystawa|program|kalendarz)/i;

/** Links on a listing page that look like individual event pages on the same site. */
export function eventDetailLinks(html: string, pageUrl: string, limit = 40): string[] {
  const base = new URL(pageUrl);
  const out = new Set<string>();
  for (const link of extractLinks(html, pageUrl)) {
    let url: URL;
    try { url = new URL(link.href); } catch { continue; }
    if (!sameSite(url, base) || url.toString() === base.toString()) continue;
    if (/\.(jpg|jpeg|png|gif|webp|pdf|docx?|xlsx?|zip|mp4|mp3)$/i.test(url.pathname)) continue;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) continue;
    if (!DETAIL_HINT.test(url.pathname)) continue;
    if (/(page|strona)\/?\d+|[?&](page|paged|strona)=/i.test(url.pathname + url.search)) continue;
    url.hash = "";
    out.add(url.toString());
    if (out.size >= limit) break;
  }
  return [...out];
}

export type RssItem = { title: string; link: string; startAt: string | null };

/** RSS pubDate is a publication date, never an event date; only ev:startdate counts. */
export function parseRss(xml: string, feedUrl: string): RssItem[] {
  const items: RssItem[] = [];
  for (const match of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const block = match[0];
    const tag = (name: string) => {
      const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i").exec(block);
      return m ? decodeEntities(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "")).trim() : null;
    };
    const title = cleanText(tag("title") ?? "", 300);
    let link = tag("link");
    if (!link) link = /<link\b[^>]*href=["']([^"']+)["']/i.exec(block)?.[1] ?? null;
    if (!title || !link) continue;
    let absolute: string;
    try { absolute = new URL(link, feedUrl).toString(); } catch { continue; }
    const start = parseFlexibleDate(tag("ev:startdate") ?? tag("ev:startDate") ?? undefined);
    items.push({ title, link: absolute, startAt: start?.iso ?? null });
  }
  return items.slice(0, 200);
}
