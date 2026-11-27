import { describe, expect, it } from "vitest";
import { writeDescriptions } from "../src/content.ts";
import { eventDetailLinks, parseRss, probeSite } from "../src/extract/discover.ts";
import { parseIcs } from "../src/extract/ics.ts";
import { extractJsonLdEvents } from "../src/extract/jsonld.ts";
import { parseLocationString, priceFromText } from "../src/extract/common.ts";
import { eventKey, parseFlexibleDate, titleSimilarity } from "../src/facts.ts";
import { assessQuality, classifyCategory } from "../src/quality.ts";

const ICS = [
  "BEGIN:VCALENDAR", "VERSION:2.0",
  "BEGIN:VEVENT", "UID:abc-1", "SUMMARY:Koncert kolęd\\, wstęp wolny", "DTSTART;TZID=Europe/Warsaw:20261212T180000",
  "LOCATION:Dom Kultury\\, ul. Długa 5\\, 00-001 Warszawa", "URL:https://dk.example.pl/wydarzenia/koncert-koled",
  "DESCRIPTION:Wstęp wolny dla wszystkich", "END:VEVENT",
  "BEGIN:VEVENT", "UID:abc-2", "SUMMARY:Zajęcia cykliczne", "DTSTART:20261201T100000Z", "RRULE:FREQ=WEEKLY", "END:VEVENT",
  "BEGIN:VEVENT", "UID:abc-3", "SUMMARY:Jarmark", "DTSTART;VALUE=DATE:20260712", "DTEND;VALUE=DATE:20260713", "STATUS:CANCELLED", "END:VEVENT",
  "END:VCALENDAR"
].join("\r\n");

describe("ICS", () => {
  it("parses explicit occurrences with Warsaw time, skips recurrence rules", () => {
    const result = parseIcs(ICS, "https://dk.example.pl/kalendarz.ics");
    expect(result.skippedRecurring).toBe(1);
    expect(result.events).toHaveLength(2);
    const [concert, fair] = result.events;
    expect(concert.startAt).toBe("2026-12-12T17:00:00.000Z"); // 18:00 CET
    expect(concert.title).toBe("Koncert kolęd, wstęp wolny");
    expect(concert.venueName).toBe("Dom Kultury");
    expect(concert.address).toBe("ul. Długa 5");
    expect(concert.city).toBe("Warszawa");
    expect(concert.priceType).toBe("free");
    expect(concert.url).toBe("https://dk.example.pl/wydarzenia/koncert-koled");
    expect(fair.isAllDay).toBe(true);
    expect(fair.startAt).toBe("2026-07-11T22:00:00.000Z"); // midnight CEST
    expect(fair.endAt).toBeNull(); // exclusive one-day DTEND
    expect(fair.status).toBe("cancelled");
  });
});

const JSONLD_PAGE = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"x"},{"@type":"MusicEvent","name":"Jazz w Parku","startDate":"2026-12-05T19:30",
"endDate":"2026-12-05T22:00+01:00","description":"COPYRIGHTED TEXT MUST NOT BE USED","image":"https://x/poster.jpg",
"location":{"@type":"Place","name":"Park Miejski","address":{"@type":"PostalAddress","streetAddress":"ul. Parkowa 1","addressLocality":"Opole","postalCode":"45-001","addressCountry":"PL"},
"geo":{"@type":"GeoCoordinates","latitude":"50.67","longitude":"17.92"}},"offers":[{"@type":"Offer","price":"0","priceCurrency":"PLN"}],"url":"/wydarzenie/jazz?utm_source=fb"},
{"@type":"Event","name":"Webinar","startDate":"2026-12-06T10:00:00+01:00","eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode","location":{"@type":"VirtualLocation","url":"https://zoom"}},
{"@type":"Event","name":"Koncert odwołany","startDate":"2026-12-07T19:00:00+01:00","eventStatus":"https://schema.org/EventCancelled","location":"Filharmonia, ul. Krasińskiego 1, 45-001 Opole",
"offers":{"@type":"AggregateOffer","lowPrice":"40","highPrice":"120","priceCurrency":"PLN"}}]}
</script></head></html>`;

describe("JSON-LD", () => {
  it("extracts facts only, treats offset-less times as Warsaw and skips online events", () => {
    const { events } = extractJsonLdEvents(JSONLD_PAGE, "https://opole.example.pl/kalendarz");
    expect(events).toHaveLength(2);
    const [jazz, cancelled] = events;
    expect(jazz.startAt).toBe("2026-12-05T18:30:00.000Z");
    expect(jazz.city).toBe("Opole");
    expect(jazz.latitude).toBe(50.67);
    expect(jazz.priceType).toBe("free");
    expect(jazz.url).toBe("https://opole.example.pl/wydarzenie/jazz");
    expect(JSON.stringify(jazz)).not.toContain("COPYRIGHTED");
    expect(JSON.stringify(jazz)).not.toContain("poster.jpg");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.priceMin).toBe(40);
    expect(cancelled.priceMax).toBe(120);
    expect(cancelled.venueName).toBe("Filharmonia");
  });

  it("applies per-domain quirks (local time written as UTC, template endDate)", () => {
    const html = `<script type="application/ld+json">{"@type":"Event","name":"Koncert","startDate":"2026-12-05T20:00:00Z","endDate":"2026-12-05T23:59:00Z","location":{"@type":"Place","name":"Klub"}}</script>`;
    const [event] = extractJsonLdEvents(html, "https://club.example.pl/", { treatUtcAsLocal: true, ignoreEndDate: true }).events;
    expect(event.startAt).toBe("2026-12-05T19:00:00.000Z");
    expect(event.endAt).toBeNull();
  });
});

describe("site discovery", () => {
  it("finds same-site calendar feeds, listings and detail links", () => {
    const html = `<title>Gminny Ośrodek Kultury</title>
      <link rel="alternate" type="application/rss+xml" href="/feed/">
      <a href="/wydarzenia/">Wydarzenia</a><a href="https://www.goksample.pl/kalendarz/?ical=1">iCal</a>
      <a href="https://facebook.com/gok">FB</a><a href="/regulamin">Regulamin</a>`;
    const probe = probeSite(html, "https://goksample.pl/");
    expect(probe.icsFeeds).toEqual(["https://www.goksample.pl/kalendarz/?ical=1"]);
    expect(probe.rssFeeds).toEqual(["https://goksample.pl/feed/"]);
    expect(probe.listingPages).toContain("https://goksample.pl/wydarzenia/");
    expect(probe.termsPages).toContain("https://goksample.pl/regulamin");
    const links = eventDetailLinks(`<a href="/wydarzenia/koncert-1">a</a><a href="/wydarzenia/page/2">b</a><a href="/o-nas/zespol">c</a><a href="/wydarzenia/plakat.jpg">d</a>`, "https://goksample.pl/wydarzenia/");
    expect(links).toEqual(["https://goksample.pl/wydarzenia/koncert-1"]);
  });

  it("never treats RSS pubDate as an event date", () => {
    const items = parseRss(`<rss><channel><item><title>Festyn</title><link>https://g.pl/festyn</link><pubDate>Mon, 01 Dec 2026 10:00:00 GMT</pubDate></item></channel></rss>`, "https://g.pl/feed");
    expect(items).toEqual([{ title: "Festyn", link: "https://g.pl/festyn", startAt: null }]);
  });
});

describe("facts helpers", () => {
  it("parses dates conservatively and keeps the curated key formula", () => {
    expect(parseFlexibleDate("2026-02-30")).toBeNull();
    expect(parseFlexibleDate("2026-07-01T12:00")?.iso).toBe("2026-07-01T10:00:00.000Z");
    expect(eventKey("Koncert", "Łódź", "2026-12-01T18:00:00+01:00")).toMatch(/^[0-9a-f]{64}$/);
    expect(titleSimilarity("Koncert: Kaśka Sochacka", "Kaśka Sochacka – koncert")).toBeGreaterThanOrEqual(0.8);
    expect(titleSimilarity("Jarmark świąteczny", "Bieg Mikołajów")).toBeLessThan(0.3);
  });

  it("reads only explicit price statements and location parts", () => {
    expect(priceFromText("Wstęp wolny")).toEqual({ priceType: "free", priceMin: 0, priceMax: 0 });
    expect(priceFromText("Bilety 30 zł, ulgowe 20 zł")).toEqual({ priceType: "paid", priceMin: 20, priceMax: 30 });
    expect(priceFromText("Zapraszamy")).toEqual({ priceType: "unknown", priceMin: null, priceMax: null });
    expect(parseLocationString("Hala Sportowa, al. Sportowa 3, 33-100 Tarnów, Polska")).toEqual({ venueName: "Hala Sportowa", address: "al. Sportowa 3", city: "Tarnów", postalCode: "33-100" });
  });
});

describe("quality and content", () => {
  const base = {
    externalId: "1", title: "Koncert kolęd", startAt: "2026-12-12T17:00:00.000Z", endAt: null, isAllDay: false, venueName: "Dom Kultury",
    address: "ul. Długa 5", city: "Warszawa", postalCode: null, latitude: 52.23, longitude: 21.01, priceType: "free" as const, priceMin: 0, priceMax: 0,
    currency: "PLN", url: "https://dk.example.pl/k", status: "scheduled" as const, organizerName: null, keywords: [], method: "ics" as const
  };
  const now = new Date("2026-11-26T12:00:00Z");

  it("scores a clean structured event at 1 and blocks unusable ones", () => {
    expect(assessQuality(base, { cityId: "c", categorySlug: "koncerty", now })).toEqual({ score: 1, issues: [] });
    const bad = assessQuality({ ...base, latitude: 40, startAt: "2026-11-25T10:00:00Z", status: "cancelled" }, { cityId: null, categorySlug: null, now });
    expect(bad.score).toBe(0);
    expect(bad.issues.filter(issue => issue.blocking).map(issue => issue.code)).toEqual(expect.arrayContaining(["start_past", "status_cancelled", "city_unresolved", "coords_missing", "category_unresolved"]));
    expect(assessQuality({ ...base, startAt: "2026-12-12T23:00:00.000Z" }, { cityId: "c", categorySlug: "koncerty", now }).issues[0].code).toBe("midnight_start");
  });

  it("classifies categories with rules limited to existing slugs", () => {
    const slugs = new Set(["koncerty", "mecze", "targi", "rodzinne", "inne"]);
    expect(classifyCategory({ ...base, title: "Mecz Wisła – Ruch, I liga" }, slugs)).toBe("mecze");
    expect(classifyCategory({ ...base, title: "Jarmark Bożonarodzeniowy" }, slugs)).toBe("targi");
    expect(classifyCategory({ ...base, title: "Spotkanie" }, slugs)).toBe("inne");
    expect(classifyCategory({ ...base, title: "Teatrzyk dla dzieci" }, new Set(["koncerty"]))).toBeNull();
  });

  it("writes Polish descriptions from facts only", () => {
    const text = writeDescriptions(base, "koncerty", "Warszawa");
    expect(text.long).toContain("Koncert „Koncert kolęd” odbędzie się w sobotę, 12 grudnia 2026 r., o godz. 18:00.");
    expect(text.long).toContain("Wstęp wolny.");
    expect(text.short).toBe("Koncert: sobota, 12 grudnia 2026, godz. 18:00, Dom Kultury, ul. Długa 5, Warszawa. Wstęp wolny.");
  });
});

describe("The Events Calendar REST API", () => {
  it("reads structured facts with venue coordinates and follows pagination", async () => {
    const { parseTribe, looksLikeTribe, tribeEndpoint } = await import("../src/extract/tribe.ts");
    const body = JSON.stringify({
      events: [
        { id: 7, title: "Koncert &#8211; Kolędy", url: "https://gok.example.pl/wydarzenie/koledy/", all_day: false,
          utc_start_date: "2026-12-20 17:00:00", utc_end_date: "2026-12-20 19:00:00", description: "<p>NIE KOPIOWAĆ</p>", image: { url: "x.jpg" },
          cost_details: { values: ["0"] }, venue: { venue: "GOK", address: "ul. Szkolna 2", city: "Przykładowo", zip: "33-100", country: "Polska", geo_lat: 50.01, geo_lng: 20.98 },
          categories: [{ name: "Koncerty" }] },
        { id: 8, title: "Online", url: "https://gok.example.pl/x/", utc_start_date: "2026-12-21 17:00:00", venue: { country: "Germany" } }
      ],
      next_rest_url: "https://gok.example.pl/wp-json/tribe/events/v1/events?page=2"
    });
    const result = parseTribe(body);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ title: "Koncert – Kolędy", startAt: "2026-12-20T17:00:00.000Z", endAt: "2026-12-20T19:00:00.000Z", priceType: "free", latitude: 50.01, city: "Przykładowo", method: "json_api" });
    expect(JSON.stringify(result.events[0])).not.toContain("KOPIOWA");
    expect(result.nextPage).toContain("page=2");
    expect(looksLikeTribe('<link rel="https://api.w.org/" href="https://gok.example.pl/wp-json/"><div class="tribe-events-calendar">')).toBe(true);
    expect(tribeEndpoint("https://gok.example.pl/kalendarz/")).toBe("https://gok.example.pl/wp-json/tribe/events/v1/events?per_page=50&start_date=now");
  });
});
