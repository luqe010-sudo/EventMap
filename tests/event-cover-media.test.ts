import { describe, expect, it } from "vitest";
import { getEventCoverPhoto } from "@/lib/event-cover-media";
import media from "@/data/media/editorial-photos.json";
import fs from "node:fs";
import { createHash } from "node:crypto";

describe("contextual event photographs", () => {
  it("uses factual themes without assigning an instrument to every concert", () => {
    expect(getEventCoverPhoto({ title: "Szydełkiem i włóczką" })?.id).toBe("craft");
    expect(getEventCoverPhoto({ title: "BOTO JAM: Zaduszki Jazzowe" })?.id).toBe("jazz");
    expect(getEventCoverPhoto({ title: "LEGO Build the Change: Ochrona ptaków" })?.id).toBe("birds");
    expect(getEventCoverPhoto({ title: "LEGO Build the Change: Żaby" })?.id).toBe("blocks");
    expect(getEventCoverPhoto({ title: "Acid Drinkers", categorySlug: "koncerty" })).toBeUndefined();
  });

  it("matches Polish choir words without mistaking Croatia for a choir", () => {
    expect(getEventCoverPhoto({ title: "Polska – Chorwacja: kwalifikacje MŚ", categorySlug: "mecze" })).toBeUndefined();
    expect(getEventCoverPhoto({ title: "Polski Chór Kameralny" })?.id).toBe("piano");
    expect(getEventCoverPhoto({ title: "Warsztaty chóralne" })?.id).toBe("piano");
  });

  it("ships every photo locally with traceable authorship, license and checked bytes", () => {
    expect(media.photos).toHaveLength(8);
    for (const photo of media.photos) {
      expect(photo.author).toBeTruthy();
      expect(photo.source).toMatch(/^https:\/\/(unsplash\.com|www\.pexels\.com)\/photos?\//);
      expect(photo.license_url).toMatch(/^https:\/\/(unsplash\.com|www\.pexels\.com)\/license\/?$/);
      expect(photo.url).toMatch(/^\/images\/editorial\/[a-z-]+\.jpg$/);
      const bytes = fs.readFileSync(`public${photo.url}`);
      expect(bytes.length).toBeLessThan(500_000);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(photo.sha256);
    }
  });
});
