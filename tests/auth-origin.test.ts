import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
import { getRequestOrigin } from "../lib/auth-origin";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("NODE_ENV", "test");
  mocks.headers.mockResolvedValue(new Headers({ host: "localhost:3000" }));
});
afterEach(() => vi.unstubAllEnvs());

describe("Auth origin", () => {
  it("uses configured origin even if request headers name another host", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://mapaimprez.pl/some/path");
    mocks.headers.mockResolvedValue(new Headers({ origin: "https://evil.invalid" }));
    expect(await getRequestOrigin()).toBe("https://mapaimprez.pl");
    expect(mocks.headers).not.toHaveBeenCalled();
  });
  it.each(["javascript:alert(1)", "https://name:secret@host.invalid", "broken"])
    ("rejects invalid configured origin %s without falling back", async (value) => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
      await expect(getRequestOrigin()).rejects.toThrow("poprawnym");
    });
  it("requires explicit origin in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(getRequestOrigin()).rejects.toThrow("wymagane");
    expect(mocks.headers).not.toHaveBeenCalled();
  });
  it("supports localhost during development", async () => {
    expect(await getRequestOrigin()).toBe("http://localhost:3000");
    mocks.headers.mockResolvedValue(new Headers({ host: "127.0.0.1:3000" }));
    expect(await getRequestOrigin()).toBe("http://127.0.0.1:3000");
  });
});
