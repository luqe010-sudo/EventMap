import { expect, it } from "vitest";
import { safeNextPath } from "../lib/navigation";

it.each(["//example.com", "/\\example.com", "/%5cexample.com", "/%2fexample.com", "https://example.com", "/account\nX", "/%", null])("rejects unsafe redirect %s", (value) => {
  expect(safeNextPath(value)).toBe("/");
});
it("preserves a local event URL and its filters", () => {
  const path = "/organizer/events/new?kiedy=weekend&cenaMax=80#opis";
  expect(safeNextPath(path)).toBe(path);
});
