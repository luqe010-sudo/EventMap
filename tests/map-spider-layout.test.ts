import { describe, expect, it } from "vitest";
import { getMapSpiderLayout, getMapSpiderPage } from "@/lib/map-spider-layout";

describe("map spider layout", () => {
  it("keeps pins separated and inside the viewport when an overlap is near a corner", () => {
    const viewport = { width: 320, height: 420 };
    const { points } = getMapSpiderPage({ x: 8, y: 412 }, viewport, 24, 0);

    expect(points).toHaveLength(24);
    points.forEach((point, index) => {
      expect(point.x).toBeGreaterThanOrEqual(28 - 1e-8);
      expect(point.x).toBeLessThanOrEqual(viewport.width - 28 + 1e-8);
      expect(point.y).toBeGreaterThanOrEqual(28 - 1e-8);
      expect(point.y).toBeLessThanOrEqual(viewport.height - 28 + 1e-8);
      for (const other of points.slice(index + 1)) {
        expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThanOrEqual(40 - 1e-8);
      }
    });
  });

  it("keeps a consistent page size and clamps the requested page", () => {
    const viewport = { width: 560, height: 380 };
    const anchor = { x: 280, y: 190 };
    const first = getMapSpiderPage(anchor, viewport, 52, -1);
    const last = getMapSpiderPage(anchor, viewport, 52, 99);

    expect(first).toMatchObject({ page: 0, pageSize: 24, pageCount: 3 });
    expect(last).toMatchObject({ page: 2, pageSize: 24, pageCount: 3 });
    expect(first.points).toHaveLength(24);
    expect(last.points).toHaveLength(4);
  });

  it("uses fewer points per page in small map panels", () => {
    const anchor = { x: 0, y: 0 };
    const compact = getMapSpiderPage(anchor, { width: 240, height: 260 }, 52, 0);
    const tiny = getMapSpiderPage(anchor, { width: 42, height: 100 }, 3, 1);

    expect(compact).toMatchObject({ pageSize: 17, pageCount: 4 });
    expect(compact.points).toHaveLength(17);
    expect(tiny).toEqual({ points: [{ x: 21, y: 28 }], page: 1, pageSize: 1, pageCount: 3 });
    expect(getMapSpiderPage(anchor, { width: 240, height: 260 }, 0, 0))
      .toEqual({ points: [], page: 0, pageSize: 0, pageCount: 0 });
  });

  it("fans out nearby groups without moving unrelated pins", () => {
    const single = { id: "single", x: 111, y: 77 };
    const points = [
      { id: "a3", x: 138, y: 120 },
      { id: "a1", x: 96, y: 120 },
      { id: "a2", x: 100, y: 120 },
      { id: "b2", x: 195, y: 120 },
      { id: "b1", x: 195, y: 120 },
      single
    ];
    const layout = getMapSpiderLayout(points, { width: 300, height: 260 }, new Map());

    expect(layout.pins).toContainEqual(single);
    expect(layout.pins).toHaveLength(points.length);
    expect(layout.groups).toEqual([
      { id: "a1", total: 3, page: 0, pageSize: 3, pageCount: 1 },
      { id: "b1", total: 2, page: 0, pageSize: 2, pageCount: 1 }
    ]);
    layout.pins.forEach((point, index) => {
      for (const other of layout.pins.slice(index + 1)) {
        expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThanOrEqual(40 - 1e-8);
      }
    });
  });

  it("reuses the same slots when paging and returns each member exactly once", () => {
    const points = Array.from({ length: 35 }, (_, index) => ({ id: `pin${index.toString().padStart(2, "0")}`, x: 190, y: 180 }));
    const viewport = { width: 380, height: 360 };
    const first = getMapSpiderLayout(points, viewport, new Map());
    const second = getMapSpiderLayout([...points].reverse(), viewport, new Map([["pin00", 1]]));

    expect(first.groups).toEqual([{ id: "pin00", total: 35, page: 0, pageSize: 24, pageCount: 2 }]);
    expect(second.groups).toEqual([{ id: "pin00", total: 35, page: 1, pageSize: 24, pageCount: 2 }]);
    expect(second.pins.map(({ x, y }) => ({ x, y }))).toEqual(first.pins.slice(0, 11).map(({ x, y }) => ({ x, y })));
    expect([...first.pins, ...second.pins].map(({ id }) => id)).toEqual(points.map(({ id }) => id));
  });
});
