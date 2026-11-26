import { cleanText } from "../facts.ts";

/** "Venue, ul. Street 1, 00-000 City" → parts. Conservative: unknown parts stay null. */
export function parseLocationString(raw: string): { venueName: string | null; address: string | null; city: string | null; postalCode: string | null } {
  const text = cleanText(raw, 400);
  if (!text) return { venueName: null, address: null, city: null, postalCode: null };
  const parts = text.split(/\s*[,;]\s*/).filter(Boolean);
  let postalCode: string | null = null;
  let city: string | null = null;
  for (let i = parts.length - 1; i >= 0; i--) {
    const match = /(\d{2}-\d{3})\s+(.+)$/.exec(parts[i]);
    if (match) {
      postalCode = match[1];
      city = match[2].trim();
      parts.splice(i, 1);
      break;
    }
  }
  if (parts.length && /^(polska|poland)$/i.test(parts[parts.length - 1])) parts.pop();
  const streetIndex = parts.findIndex(part => /\b(ul\.|al\.|pl\.|os\.|ulica|aleja|plac)\s|\d+[a-z]?(\/\d+)?$/i.test(part));
  let venueName: string | null = null;
  let address: string | null = null;
  if (streetIndex >= 0) {
    address = parts[streetIndex];
    venueName = parts.slice(0, streetIndex).join(", ") || null;
    if (!city && parts.length > streetIndex + 1) city = parts[parts.length - 1];
  } else {
    venueName = parts[0] ?? null;
    if (!city && parts.length > 1) city = parts[parts.length - 1];
  }
  return { venueName, address, city, postalCode };
}

/** Recognises only explicit statements. "Bezpłatne" → free, "20 zł" → paid with amounts; otherwise unknown. */
export function priceFromText(text: string): { priceType: "free" | "paid" | "unknown"; priceMin: number | null; priceMax: number | null } {
  const lower = text.toLocaleLowerCase("pl-PL");
  if (/(wst[eę]p\s+(wolny|bezp[lł]atny)|bezp[lł]atn(y|e|a)\s+wst[eę]p|wydarzenie\s+bezp[lł]atne|free entry|wst[eę]p:\s*bezp[lł]atny)/.test(lower)
    && !/\d+\s*(z[lł]|pln)/.test(lower)) {
    return { priceType: "free", priceMin: 0, priceMax: 0 };
  }
  const amounts = [...lower.matchAll(/(\d{1,4}(?:[.,]\d{2})?)\s*(?:z[lł]|pln)(?![a-ząćęłńóśźż])/g)].map(match => Number(match[1].replace(",", ".")))
    .filter(value => Number.isFinite(value) && value > 0 && value < 10000);
  if (amounts.length) return { priceType: "paid", priceMin: Math.min(...amounts), priceMax: Math.max(...amounts) };
  return { priceType: "unknown", priceMin: null, priceMax: null };
}

export function sameSite(a: URL, b: URL): boolean {
  const base = (host: string) => host.replace(/^www\./, "").split(".").slice(-2).join(".");
  return base(a.hostname) === base(b.hostname);
}

export function extractLinks(html: string, pageUrl: string): Array<{ href: string; text: string; rel: string | null; type: string | null }> {
  const links: Array<{ href: string; text: string; rel: string | null; type: string | null }> = [];
  const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  const value = (match: RegExpExecArray | null) => match ? (match[2] ?? match[3] ?? match[4] ?? "") : null;
  const push = (tag: string, text: string) => {
    const href = value(attr(tag, "href"));
    if (!href || /^(javascript:|mailto:|tel:|#)/i.test(href)) return;
    let absolute: string;
    try { absolute = new URL(href.replace(/^webcal:/i, "https:"), pageUrl).toString(); } catch { return; }
    links.push({ href: absolute, text: cleanText(text, 120) ?? "", rel: value(attr(tag, "rel")), type: value(attr(tag, "type")) });
  };
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) push(match[1], "");
  // Anchor text stops at the next anchor so an unclosed <a> cannot swallow its neighbours.
  for (const match of html.matchAll(/<a\b([^>]*)>((?:(?!<a\b)[\s\S]){0,2000}?)<\/a>/gi)) push(match[1], match[2]);
  return links;
}
