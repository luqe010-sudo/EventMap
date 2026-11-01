import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ permanentRedirect: vi.fn((url: string) => { throw new Error(url); }) }));
import { redirectLowercasePath } from "../lib/canonical-path";
import { permanentRedirect } from "next/navigation";

it("redirects mixed case before querying the database and preserves repeated query values", () => {
  expect(() => redirectLowercasePath(["Koncerty", "Wroclaw", "Modestep-Live"], { kiedy: "today", tag: ["a", "b"] })).toThrow("/koncerty/wroclaw/modestep-live?kiedy=today&tag=a&tag=b");
  expect(permanentRedirect).toHaveBeenCalledTimes(1);
});
it("leaves canonical lowercase paths untouched", () => {
  vi.mocked(permanentRedirect).mockClear();
  redirectLowercasePath(["koncerty", "wroclaw"], {});
  expect(permanentRedirect).not.toHaveBeenCalled();
});
