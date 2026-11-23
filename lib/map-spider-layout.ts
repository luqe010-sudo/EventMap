type ScreenPoint = { x: number; y: number };
type MapViewport = { width: number; height: number };
type ProjectedPin = ScreenPoint & { id: string };
type DisplayPin = ProjectedPin & { groupId?: string };
type SpiderGroup = { id: string; page: number; pageSize: number; pageCount: number; total: number };

const PIN_EDGE_INSET = 28;
const INNER_RING_RADIUS = 38;
const PIN_SPACING = 40;
const MAX_PAGE_SIZE = 24;
const PAGE_SIZES = [MAX_PAGE_SIZE, 16, 10, 5, 3, 2, 1];
const ROTATIONS = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4];
const FAN_OFFSETS = [
  { x: 0, y: 0 },
  { x: PIN_SPACING, y: 0 },
  { x: -PIN_SPACING, y: 0 },
  { x: 0, y: PIN_SPACING },
  { x: 0, y: -PIN_SPACING }
];

export function getMapSpiderPage(
  anchor: ScreenPoint,
  viewport: MapViewport,
  total: number,
  requestedPage: number
) {
  return layoutSpiderPage(anchor, viewport, total, requestedPage, MAX_PAGE_SIZE, 0);
}

export function getMapSpiderLayout(
  points: ProjectedPin[],
  viewport: MapViewport,
  pages: ReadonlyMap<string, number>
): { pins: DisplayPin[]; groups: SpiderGroup[] } {
  const membersByGroup = getOverlappingGroups(points);
  const pins: DisplayPin[] = [];
  const groups: SpiderGroup[] = [];
  const occupied = new Map<string, ScreenPoint[]>();

  for (const members of membersByGroup) {
    if (members.length !== 1) continue;
    pins.push(members[0]);
    reservePoint(occupied, members[0]);
  }

  for (const members of membersByGroup) {
    if (members.length < 2) continue;
    const id = members[0].id;
    const anchor = members.reduce(({ x, y }, member) => ({ x: x + member.x, y: y + member.y }), { x: 0, y: 0 });
    anchor.x /= members.length;
    anchor.y /= members.length;

    const fan = findFanPlacement(anchor, viewport, members.length, occupied);
    const page = clamp(Math.trunc(pages.get(id) ?? 0), 0, fan.pageCount - 1);
    const first = page * fan.pageSize;
    groups.push({ id, page, pageSize: fan.pageSize, pageCount: fan.pageCount, total: members.length });

    // Reserve the complete footprint even on the last page so paging cannot move neighboring fans.
    fan.points.forEach((point, index) => {
      reservePoint(occupied, point);
      const member = members[first + index];
      if (member) pins.push({ ...point, id: member.id, groupId: id });
    });
  }

  return { pins, groups };
}

function layoutSpiderPage(
  anchor: ScreenPoint,
  viewport: MapViewport,
  total: number,
  requestedPage: number,
  limit: number,
  rotation: number
) {
  if (total <= 0) return { points: [], page: 0, pageSize: 0, pageCount: 0 };

  const maxRadius = Math.min(viewport.width, viewport.height) / 2 - PIN_EDGE_INSET;
  const maxPageSize = Math.min(total, limit);
  const rings: Array<{ radius: number; capacity: number }> = [];
  let pageSize = 0;

  for (let radius = INNER_RING_RADIUS; radius <= maxRadius && pageSize < maxPageSize; radius += PIN_SPACING) {
    // An arc angle of this size leaves PIN_SPACING between neighboring centers.
    const capacity = Math.floor(Math.PI / Math.asin(PIN_SPACING / (2 * radius)));
    rings.push({ radius, capacity });
    pageSize = Math.min(maxPageSize, pageSize + capacity);
  }

  pageSize = Math.max(1, pageSize);
  const pageCount = Math.ceil(total / pageSize);
  const page = clamp(Math.trunc(requestedPage), 0, pageCount - 1);
  const outerRadius = rings.at(-1)?.radius ?? 0;
  const insetX = Math.min(viewport.width / 2, PIN_EDGE_INSET + outerRadius);
  const insetY = Math.min(viewport.height / 2, PIN_EDGE_INSET + outerRadius);
  const center = {
    x: clamp(anchor.x, insetX, viewport.width - insetX),
    y: clamp(anchor.y, insetY, viewport.height - insetY)
  };
  if (!rings.length) return { points: [center], page, pageSize, pageCount };

  const count = Math.min(pageSize, total - page * pageSize);
  const points: ScreenPoint[] = [];
  for (const [ringIndex, { radius, capacity }] of rings.entries()) {
    const ringCount = Math.min(capacity, count - points.length);
    if (ringCount === 0) break;

    const angleStep = 2 * Math.PI / ringCount;
    const startAngle = -Math.PI / 2 + rotation + (ringIndex % 2) * angleStep / 2;
    for (let index = 0; index < ringCount; index++) {
      const angle = startAngle + index * angleStep;
      points.push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
    }
  }

  return { points, page, pageSize, pageCount };
}

function getOverlappingGroups(points: ProjectedPin[]) {
  const ordered = [...points].sort((first, second) => first.id.localeCompare(second.id));
  const parents = ordered.map((_, index) => index);
  const cells = new Map<string, number[]>();
  const positions = new Map<string, number>();
  const cellSize = PIN_SPACING / 2;

  function root(index: number) {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  }

  ordered.forEach((point, index) => {
    const positionKey = gridKey(point.x, point.y);
    const exactMatch = positions.get(positionKey);
    if (exactMatch !== undefined) {
      parents[index] = root(exactMatch);
      return;
    }
    positions.set(positionKey, index);

    const { x, y } = gridCell(point, cellSize);
    for (let column = x - 2; column <= x + 2; column++) {
      for (let row = y - 2; row <= y + 2; row++) {
        const neighbors = cells.get(gridKey(column, row));
        if (!neighbors || root(neighbors[0]) === root(index)) continue;
        // Every point in one cell overlaps, so a single match joins the entire cell.
        if ((column === x && row === y) || neighbors.some(other => overlaps(point, ordered[other]))) {
          parents[root(index)] = root(neighbors[0]);
        }
      }
    }

    const key = gridKey(x, y);
    const cell = cells.get(key);
    if (cell) cell.push(index);
    else cells.set(key, [index]);
  });

  const groups = new Map<number, ProjectedPin[]>();
  ordered.forEach((point, index) => {
    const groupId = root(index);
    const group = groups.get(groupId);
    if (group) group.push(point);
    else groups.set(groupId, [point]);
  });
  return [...groups.values()];
}

function findFanPlacement(
  anchor: ScreenPoint,
  viewport: MapViewport,
  total: number,
  occupied: Map<string, ScreenPoint[]>
) {
  let tried = total + 1;
  for (const cap of PAGE_SIZES) {
    const limit = Math.min(cap, total);
    if (limit >= tried) continue;
    tried = limit;
    for (const offset of FAN_OFFSETS) {
      const center = { x: anchor.x + offset.x, y: anchor.y + offset.y };
      for (const rotation of ROTATIONS) {
        const fan = layoutSpiderPage(center, viewport, total, 0, limit, rotation);
        if (fan.points.every(point => !hasOccupiedNeighbor(occupied, point))) return fan;
      }
    }
  }
  return layoutSpiderPage(anchor, viewport, total, 0, 1, 0);
}

function hasOccupiedNeighbor(occupied: Map<string, ScreenPoint[]>, point: ScreenPoint) {
  const { x, y } = gridCell(point, PIN_SPACING);
  for (let column = x - 1; column <= x + 1; column++) {
    for (let row = y - 1; row <= y + 1; row++) {
      if (occupied.get(gridKey(column, row))?.some(other => overlaps(point, other))) return true;
    }
  }
  return false;
}

function reservePoint(occupied: Map<string, ScreenPoint[]>, point: ScreenPoint) {
  const { x, y } = gridCell(point, PIN_SPACING);
  const key = gridKey(x, y);
  const bucket = occupied.get(key);
  if (bucket) bucket.push(point);
  else occupied.set(key, [point]);
}

function overlaps(first: ScreenPoint, second: ScreenPoint) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2 < PIN_SPACING ** 2;
}

function gridCell(point: ScreenPoint, size: number) {
  return { x: Math.floor(point.x / size), y: Math.floor(point.y / size) };
}

function gridKey(x: number, y: number) {
  return `${x}:${y}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
