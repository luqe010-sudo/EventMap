import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseServerClient: vi.fn() }));

import { createSupabaseServerClient } from "../lib/supabase";
import { getEventBySlug } from "../lib/events";

const from = vi.fn();
const event = {
  id: "event-1", title: "Yamato – The Drummers of Japan", slug: "Yamato-The-Drummers-of-Japan",
  start_at: "2026-11-29T18:00:00Z", end_at: null, price_type: "paid", price_min: 100, price_max: 100,
  currency: "PLN", status: "published", visibility: "public", is_cancelled: false,
  category: null, location: null, organizer: null, sources: []
};

function query(result: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: vi.fn(), eq: vi.fn(), or: vi.fn(), ilike: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(),
    returns: vi.fn().mockResolvedValue(result)
  };
  for (const method of [builder.select, builder.eq, builder.or, builder.ilike, builder.limit, builder.maybeSingle]) {
    method.mockReturnValue(builder);
  }
  return builder;
}

function expectPublicQuery(builder: ReturnType<typeof query>) {
  expect(builder.eq).toHaveBeenCalledWith("status", "published");
  expect(builder.eq).toHaveBeenCalledWith("visibility", "public");
  expect(builder.or).toHaveBeenCalledWith("is_cancelled.is.null,is_cancelled.eq.false");
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createSupabaseServerClient).mockReturnValue({ from } as unknown as ReturnType<typeof createSupabaseServerClient>);
});

it("prefers an exact public slug and keeps the original imported slug", async () => {
  const exact = query({ data: event, error: null });
  from.mockReturnValueOnce(exact);
  expect(await getEventBySlug(event.slug)).toMatchObject({ id: event.id, slug: event.slug });
  expect(exact.eq).toHaveBeenCalledWith("slug", event.slug);
  expectPublicQuery(exact);
  expect(from).toHaveBeenCalledExactlyOnceWith("events");
  expect(exact.ilike).not.toHaveBeenCalled();
});

it("resolves a lowercase public URL to the mixed-case imported slug", async () => {
  const exact = query({ data: null, error: null });
  const fallback = query({ data: [event], error: null });
  from.mockReturnValueOnce(exact).mockReturnValueOnce(fallback);
  expect(await getEventBySlug("yamato-the-drummers-of-japan")).toMatchObject({ id: event.id, slug: event.slug });
  expect(fallback.ilike).toHaveBeenCalledWith("slug", "yamato-the-drummers-of-japan");
  expect(fallback.limit).toHaveBeenCalledWith(2);
  expectPublicQuery(exact);
  expectPublicQuery(fallback);
});

it("escapes LIKE wildcards and backslashes so a slug cannot match other event names", async () => {
  const exact = query({ data: null, error: null });
  const fallback = query({ data: [], error: null });
  from.mockReturnValueOnce(exact).mockReturnValueOnce(fallback);
  expect(await getEventBySlug("festival%_\\2026")).toBeNull();
  expect(fallback.ilike).toHaveBeenCalledWith("slug", "festival\\%\\_\\\\2026");
});

it("returns no event when neither public query finds the slug", async () => {
  const exact = query({ data: null, error: null });
  const fallback = query({ data: [], error: null });
  from.mockReturnValueOnce(exact).mockReturnValueOnce(fallback);
  expect(await getEventBySlug("missing")).toBeNull();
  expectPublicQuery(exact);
  expectPublicQuery(fallback);
});

it("rejects an ambiguous case-insensitive match instead of picking an arbitrary event", async () => {
  from.mockReturnValueOnce(query({ data: null, error: null }))
    .mockReturnValueOnce(query({ data: [event, { ...event, id: "event-2", slug: event.slug.toUpperCase() }], error: null }));
  await expect(getEventBySlug(event.slug.toLowerCase())).rejects.toThrow("niejednoznaczny slug");
});

it("propagates an exact lookup failure without trying a broader fallback", async () => {
  from.mockReturnValueOnce(query({ data: null, error: { message: "Unavailable" } }));
  await expect(getEventBySlug("yamato")).rejects.toThrow("Unavailable");
  expect(from).toHaveBeenCalledTimes(1);
});

it("propagates a failed fallback instead of reporting a missing event", async () => {
  from.mockReturnValueOnce(query({ data: null, error: null }))
    .mockReturnValueOnce(query({ data: null, error: { message: "Fallback unavailable" } }));
  await expect(getEventBySlug("yamato")).rejects.toThrow("Fallback unavailable");
});
