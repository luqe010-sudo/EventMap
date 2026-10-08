/** Keep a selected card when results grow or change order; fall back safely after removal. */
export function resolveVenueDeckIndex(ids: readonly string[], selectedId: string | null, previousIndex: number): number {
  if (!ids.length) return -1;
  const selectedIndex = selectedId == null ? -1 : ids.indexOf(selectedId);
  if (selectedIndex >= 0) return selectedIndex;
  return Math.min(Math.max(0, previousIndex), ids.length - 1);
}

export function moveVenueDeckIndex(index: number, direction: -1 | 1, length: number): number {
  return length > 0 ? (index + direction + length) % length : -1;
}

/** A vertical page scroll or a small tap movement must never advance the deck. */
export function venueDeckSwipeDirection(deltaX: number, deltaY: number): -1 | 0 | 1 {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return 0;
  if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return 0;
  return deltaX < 0 ? 1 : -1;
}

export type VenueDeckSlot = {
  id: string;
  index: number;
  position: number;
  x: number;
  y: number;
  angle: number;
  scale: number;
  opacity: number;
  visible: boolean;
};

/** Keep every event's layer, painting at most three previews on either side. */
export function venueDeckSlots(ids: readonly string[], activeIndex: number, direction: -1 | 1): VenueDeckSlot[] {
  return ids.map((id, index) => {
    const forward = (index - activeIndex + ids.length) % ids.length;
    let position = forward <= ids.length / 2 ? forward : forward - ids.length;
    if (ids.length === 2 && forward === 1) position = -direction;
    const side = Math.sign(position);
    const depth = Math.min(Math.abs(position), 3);
    return {
      id, index, position,
      x: side * (depth ? 1 + (depth - 1) * .4 : 0),
      y: 0,
      angle: 0,
      scale: 1 - depth * .026,
      opacity: depth ? .82 - (depth - 1) * .15 : 1,
      visible: Math.abs(position) <= 3
    };
  });
}

/** Move these same layers towards their next positions during a held gesture. */
export function interpolateVenueDeckSlot(from: VenueDeckSlot, to: VenueDeckSlot, progress: number): VenueDeckSlot {
  const amount = Math.max(0, Math.min(1, progress));
  const mix = (start: number, end: number) => start + (end - start) * amount;
  return {
    ...from,
    x: mix(from.x, to.x), y: mix(from.y, to.y), angle: mix(from.angle, to.angle),
    scale: mix(from.scale, to.scale), opacity: mix(from.opacity, to.opacity),
    visible: from.visible || (amount > 0 && to.visible)
  };
}
