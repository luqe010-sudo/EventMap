import { expect, it } from "vitest";
import {
  interpolateVenueDeckSlot, moveVenueDeckIndex, resolveVenueDeckIndex, venueDeckSlots, venueDeckSwipeDirection,
  type VenueDeckSlot
} from "../lib/event-venue-deck";

it("keeps the selected event across load-more and reordered venue results", () => {
  expect(resolveVenueDeckIndex(["a", "b", "c"], "b", 1)).toBe(1);
  expect(resolveVenueDeckIndex(["c", "a", "b", "d"], "b", 1)).toBe(2);
});

it("shows a safe neighbouring card when the selected event disappears", () => {
  expect(resolveVenueDeckIndex(["a", "c"], "b", 1)).toBe(1);
  expect(resolveVenueDeckIndex(["a"], "b", 4)).toBe(0);
  expect(resolveVenueDeckIndex([], "b", 4)).toBe(-1);
});

it("cycles both ends of the deck and handles empty results", () => {
  expect(moveVenueDeckIndex(0, -1, 3)).toBe(2);
  expect(moveVenueDeckIndex(2, 1, 3)).toBe(0);
  expect(moveVenueDeckIndex(0, 1, 1)).toBe(0);
  expect(moveVenueDeckIndex(-1, 1, 0)).toBe(-1);
});

it("allows horizontal swipes while preserving vertical and diagonal page scrolling", () => {
  expect(venueDeckSwipeDirection(-80, 12)).toBe(1);
  expect(venueDeckSwipeDirection(80, -12)).toBe(-1);
  expect(venueDeckSwipeDirection(44, 0)).toBe(0);
  expect(venueDeckSwipeDirection(70, 70)).toBe(0);
  expect(venueDeckSwipeDirection(20, 120)).toBe(0);
  expect(venueDeckSwipeDirection(50, 40)).toBe(0);
  expect(venueDeckSwipeDirection(Number.NaN, 0)).toBe(0);
});

it("places each event once with the selected card in front and neighbours on both sides", () => {
  for (const length of [3, 4, 5, 8]) {
    const ids = Array.from({ length }, (_, index) => `event-${index}`);
    for (let activeIndex = 0; activeIndex < length; activeIndex++) {
      const slots = venueDeckSlots(ids, activeIndex, 1);
      expect(slots.map(slot => slot.id)).toEqual(ids);
      expect(new Set(slots.map(slot => slot.position)).size).toBe(length);
      expect(slots.filter(slot => slot.position === 0).map(slot => slot.id)).toEqual([ids[activeIndex]]);
      expect(slots.find(slot => slot.position === -1)?.id).toBe(ids[moveVenueDeckIndex(activeIndex, -1, length)]);
      expect(slots.find(slot => slot.position === 1)?.id).toBe(ids[moveVenueDeckIndex(activeIndex, 1, length)]);
      for (const slot of slots.filter(slot => slot.position !== 0)) {
        expect(Math.sign(slot.x)).toBe(Math.sign(slot.position));
        expect(slot.angle).toBe(0);
        expect(slot.y).toBe(0);
        expect(slot.scale).toBeLessThan(1);
        expect(slot.opacity).toBeLessThan(1);
      }
    }
  }
});

it("keeps layer identities while the chosen event trades places with the previous front", () => {
  const ids = ["a", "b", "c"];
  const before = venueDeckSlots(ids, 0, 1);
  const after = venueDeckSlots(ids, 1, 1);
  expect(after.map(slot => ({ id: slot.id, index: slot.index })))
    .toEqual(before.map(slot => ({ id: slot.id, index: slot.index })));
  expect(before.find(slot => slot.id === "a")?.position).toBe(0);
  expect(after.find(slot => slot.id === "a")?.position).toBe(-1);
  expect(before.find(slot => slot.id === "b")?.position).toBe(1);
  expect(after.find(slot => slot.id === "b")?.position).toBe(0);

  const reorderedIds = ["c", "a", "b", "d"];
  const reordered = venueDeckSlots(reorderedIds, resolveVenueDeckIndex(reorderedIds, "b", 1), 1);
  expect(reordered.find(slot => slot.position === 0)?.id).toBe("b");
  expect(new Set(reordered.map(slot => slot.id))).toEqual(new Set(reorderedIds));
});

it("uses one real rear card for a pair and moves it to the side of the last interaction", () => {
  const forward = venueDeckSlots(["a", "b"], 1, 1);
  const backward = venueDeckSlots(["a", "b"], 1, -1);
  expect(forward).toHaveLength(2);
  expect(backward).toHaveLength(2);
  expect(forward.find(slot => slot.id === "b")?.position).toBe(0);
  expect(forward.find(slot => slot.id === "a")?.position).toBe(-1);
  expect(backward.find(slot => slot.id === "a")?.position).toBe(1);
});

it("bounds the painted stack while retaining all event identities in a large venue", () => {
  const ids = Array.from({ length: 20 }, (_, index) => `event-${index}`);
  for (const activeIndex of [0, 10, 19]) {
    const slots = venueDeckSlots(ids, activeIndex, 1);
    expect(slots.map(slot => slot.id)).toEqual(ids);
    const visible = slots.filter(slot => slot.visible);
    expect(visible).toHaveLength(7);
    expect(visible.filter(slot => slot.position < 0)).toHaveLength(3);
    expect(visible.filter(slot => slot.position > 0)).toHaveLength(3);
    expect(Math.max(...slots.map(slot => Math.abs(slot.x)))).toBeLessThanOrEqual(1.8);
    expect(slots.every(slot => slot.y === 0 && slot.angle === 0)).toBe(true);
  }
});

function geometry(slot: VenueDeckSlot) {
  return { x: slot.x, y: slot.y, angle: slot.angle, scale: slot.scale, opacity: slot.opacity };
}

it("moves the outgoing and incoming cards during a held gesture and clamps its progress", () => {
  const ids = ["a", "b", "c"];
  const before = venueDeckSlots(ids, 0, 1);
  const after = venueDeckSlots(ids, 1, 1);
  for (const index of [0, 1]) {
    const from = before[index];
    const to = after[index];
    const halfway = interpolateVenueDeckSlot(from, to, .5);
    expect(halfway.id).toBe(from.id);
    expect(halfway.index).toBe(from.index);
    expect(halfway.y).toBe(0);
    expect(halfway.angle).toBe(0);
    for (const field of ["x", "y", "angle", "scale", "opacity"] as const) {
      expect(halfway[field]).toBeCloseTo((from[field] + to[field]) / 2);
    }
    expect(geometry(halfway)).not.toEqual(geometry(from));
    expect(geometry(halfway)).not.toEqual(geometry(to));
    expect(geometry(interpolateVenueDeckSlot(from, to, -1))).toEqual(geometry(from));
    expect(geometry(interpolateVenueDeckSlot(from, to, 2))).toEqual(geometry(to));
  }
});

it("reveals an incoming distant preview only after the gesture starts moving it into view", () => {
  const ids = Array.from({ length: 10 }, (_, index) => `event-${index}`);
  const from = venueDeckSlots(ids, 0, 1)[4];
  const to = venueDeckSlots(ids, 1, 1)[4];
  expect(from.visible).toBe(false);
  expect(to.visible).toBe(true);
  expect(interpolateVenueDeckSlot(from, to, 0).visible).toBe(false);
  expect(interpolateVenueDeckSlot(from, to, .25).visible).toBe(true);
});
