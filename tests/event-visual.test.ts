import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import EventVisual from "../components/EventVisual";

const event = {
  title: "Rodzinny poranek <razem>", main_image_url: null, startDate: "2026-11-07T10:00:00Z",
  city: "Łódź", category: "Rodzinne", categorySlug: "rodzinne", is_all_day: false
};

it("missing artwork renders event facts immediately without an empty or unrelated image request", () => {
  const html = renderToStaticMarkup(createElement(EventVisual, { event }));
  expect(html).toContain("eventVisual--cover");
  expect(html).toContain("Rodzinny poranek &lt;razem&gt;");
  expect(html).toContain("7 lis 2026");
  expect(html).toContain("11:00");
  expect(html).toContain("Łódź");
  expect(html).not.toContain("<img");
  expect(html).toContain('aria-hidden="true"');
});

it("a real source is preserved and the presentation identifies it as event artwork", () => {
  const html = renderToStaticMarkup(createElement(EventVisual, {
    event: { ...event, main_image_url: "  https://example.org/official-poster.jpg  " }, decorative: false
  }));
  expect(html).toContain("eventVisual--image");
  expect(html).toContain('src="https://example.org/official-poster.jpg"');
  expect(html).toContain('role="img" aria-label="Grafika wydarzenia:');
  expect(html).not.toContain("eventVisualCover");
});

it("whitespace artwork is absent and unknown categories still receive a factual cover", () => {
  const html = renderToStaticMarkup(createElement(EventVisual, {
    event: { ...event, main_image_url: "  ", categorySlug: "nowa-kategoria" }, decorative: false, variant: "detail"
  }));
  expect(html).toContain("eventVisual--detail eventVisual--cover");
  expect(html).toContain('role="img"');
  expect(html).toContain("Rodzinny poranek &lt;razem&gt;. 7 lis 2026, 11:00. Łódź.");
  expect(html).not.toContain("<img");
});

it("all-day events never invent a midnight start in the cover", () => {
  const html = renderToStaticMarkup(createElement(EventVisual, { event: { ...event, is_all_day: true } }));
  expect(html).toContain("Cały dzień");
  expect(html).not.toContain("11:00");
});

it("thematic photos are local and explicitly illustrative, with a plain credit on details", () => {
  const html = renderToStaticMarkup(createElement(EventVisual, {
    event: { ...event, title: "Szydełkiem i włóczką" }, decorative: false, variant: "detail"
  }));
  expect(html).toContain("eventVisual--photo");
  expect(html).toContain('src="/images/editorial/craft.jpg"');
  expect(html).toContain("Zdjęcie ilustracyjne");
  expect(html).toContain("Fot. Kelly Sikkema · Unsplash");
  expect(html).toContain('width="1200" height="800"');
  expect(html).not.toContain("<a");
  expect(html).not.toContain('src="https://');
});

it("an existing uploaded image takes precedence over a thematic photo", () => {
  const html = renderToStaticMarkup(createElement(EventVisual, {
    event: { ...event, title: "Szydełkiem i włóczką", main_image_url: "https://example.org/craft-poster.jpg" }
  }));
  expect(html).toContain('src="https://example.org/craft-poster.jpg"');
  expect(html).not.toContain("/images/editorial/");
  expect(html).not.toContain("Zdjęcie ilustracyjne");
});
