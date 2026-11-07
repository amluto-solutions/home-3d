// CAD-style snap guides (#143): where a door or window on a wall, or an item on the plan, wants to land while it is
// placed or dragged. Pure maths: candidates in, the best snap and the guide lines to draw out. The editor (2D) and
// the 3D furnishing drag share it.
//
// Priority: explicit targets (a wall's middle and ends, equal spacing, set distances from a corner, a room's centre
// lines) beat alignment with other items' edges and centres, which beat the grid. The grid is the caller's: an axis
// that snapped to nothing here is rounded to the grid as before, so the two never fight.

import type { Furniture, Room, Vec2 } from "../model.ts";
import { furnitureFootprint } from "../model.ts";

/** How close (screen pixels) the pointer must come to a guide before it snaps. */
export const SNAP_GUIDE_PX = 8;

/** Set distances (metres) from a wall's end to the near side of a door or window that it snaps to. */
export const CORNER_GAPS: readonly number[] = [0.1, 0.5, 1];

/** Alignment guides only come from items whose extent is within this many metres of the dragged item. */
export const ALIGN_REACH = 4;

/** A pixel tolerance in metres at the plan's zoom (`scale` = pixels per metre). */
export function snapTolerance(scale: number, px = SNAP_GUIDE_PX): number {
  return px / Math.max(1e-6, scale);
}

export type GuideKind = "mid" | "end" | "equal" | "corner" | "room" | "centre" | "edge";

/** A line to draw while snapped, in plan metres; `value` is the distance a label shows ("= 0.60 m"). */
export interface Guide {
  a: Vec2;
  b: Vec2;
  kind: GuideKind;
  value?: number;
  /** the axis the snap fixed: "x"/"z" for alignment, "wall" along a wall */
  axis: "x" | "z" | "wall";
}

// ------------------------------------------------------------------------------------- along a wall

/** Another door or window on the same wall: its centre (offset from the wall's start) and width. */
export interface Span {
  offset: number;
  width: number;
}

/** Where a door or window snapped to on its wall: the centre offset and what to draw (positions along the wall). */
export interface WallSnap {
  offset: number;
  kind: "mid" | "end" | "equal" | "corner";
  /** the equal gap or the distance from the corner, for the label */
  value?: number;
  /** stretches along the wall to draw as dimension lines (each labelled with `value`) */
  spans: [number, number][];
  /** a point along the wall to mark with a short cross line (the middle, the end), or null */
  tick: number | null;
}

const RANK: Record<WallSnap["kind"], number> = { mid: 0, equal: 1, end: 2, corner: 3 };

/**
 * The best explicit target for an opening `width` wide whose centre is dragged to `raw` (metres from the wall's
 * start) on a wall `len` long, with `others` on the same wall. Targets: the wall's middle, flush with either end,
 * `gaps` from either end, centred between its neighbours, and the gap of the neighbouring pair repeated. Only
 * targets within `tol` of `raw` count; the nearest wins (ties by kind: mid, equal, end, corner). Null: none near.
 */
export function snapOnWall(raw: number, width: number, len: number, others: readonly Span[], tol: number, gaps: readonly number[] = CORNER_GAPS): WallSnap | null {
  const half = width / 2;
  const lo = half - 1e-6;
  const hi = len - half + 1e-6;
  let best: WallSnap | null = null;
  let bestD = tol;
  const offer = (offset: number, kind: WallSnap["kind"], spans: [number, number][], tick: number | null, value?: number) => {
    if (offset < lo || offset > hi) return;
    const d = Math.abs(offset - raw);
    if (d > bestD + 1e-9) return;
    if (best && Math.abs(d - bestD) <= 1e-9 && RANK[best.kind] <= RANK[kind]) return;
    bestD = d;
    best = { offset, kind, spans, tick, ...(value !== undefined ? { value } : {}) };
  };
  // cheap ones first; the lists below are only built when they can be near
  offer(len / 2, "mid", [], len / 2);
  offer(half, "end", [], 0);
  offer(len - half, "end", [], len);
  for (const g of gaps) {
    offer(g + half, "corner", [[0, g]], null, g);
    offer(len - g - half, "corner", [[len - g, len]], null, g);
  }
  if (others.length) {
    // neighbours as [left side, right side], in order along the wall; the wall's ends bound the row
    const row = others.map((o) => [o.offset - o.width / 2, o.offset + o.width / 2] as [number, number]).sort((p, q) => p[0] - q[0]);
    let i = 0;
    while (i < row.length && row[i][0] + row[i][1] < 2 * raw) i++;
    const left = i > 0 ? row[i - 1] : null;
    const right = i < row.length ? row[i] : null;
    const l = left ? left[1] : 0;
    const r = right ? right[0] : len;
    // centred between its neighbours (between the wall's two ends that is just "mid")
    if (left || right) {
      const gap = (r - l - width) / 2;
      const c = (l + r) / 2;
      if (gap > 0.01) offer(c, "equal", [[l, c - half], [c + half, r]], null, gap);
    }
    // the gap of the pair to the left repeated on the right of the left neighbour …
    if (left) {
      const before = i > 1 ? row[i - 2][1] : 0;
      const gap = left[0] - before;
      const c = left[1] + gap + half;
      if (gap > 0.01 && c + half <= r + 1e-6) offer(c, "equal", [[before, left[0]], [left[1], c - half]], null, gap);
    }
    // … and the same to the right
    if (right) {
      const after = i + 1 < row.length ? row[i + 1][0] : len;
      const gap = after - right[1];
      const c = right[0] - gap - half;
      if (gap > 0.01 && c - half >= l - 1e-6) offer(c, "equal", [[c + half, right[0]], [right[1], after]], null, gap);
    }
  }
  return best;
}

/**
 * The guide lines of a wall snap on the wall a -> b: dimension lines for the spans, `lift` metres off the wall,
 * and a cross line at the tick.
 */
export function wallGuides(a: Vec2, b: Vec2, snap: WallSnap, lift: number): Guide[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const u: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n: Vec2 = [-u[1], u[0]];
  const at = (s: number, k: number): Vec2 => [a[0] + u[0] * s + n[0] * k, a[1] + u[1] * s + n[1] * k];
  const out: Guide[] = snap.spans.map(([s0, s1]) => ({ a: at(s0, lift), b: at(s1, lift), kind: snap.kind, axis: "wall" as const, ...(snap.value !== undefined ? { value: snap.value } : {}) }));
  if (snap.tick !== null) out.push({ a: at(snap.tick, -lift * 1.5), b: at(snap.tick, lift * 1.5), kind: snap.kind, axis: "wall" });
  return out;
}

// ------------------------------------------------------------------------------------- on the plan

/** A line to align with: x = v (in `xs`) or z = v (in `zs`), drawn from `from` to `to` along the other axis. */
export interface AlignLine {
  v: number;
  kind: "room" | "centre" | "edge";
  from: number;
  to: number;
}

/** The lines items align with, per axis. Built once per drag (the others don't move), read on every move. */
export interface AlignLines {
  xs: AlignLine[];
  zs: AlignLine[];
}

/** An item's box on the plan (turned items: the box around their footprint). */
export interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export function itemBox(f: Pick<Furniture, "x" | "z" | "w" | "d" | "rotation">): Box {
  const pts = furnitureFootprint(f as Furniture);
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [x, z] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return { x0, x1, z0, z1 };
}

/** Half the size of an item's box (what the centre is offset by to reach an edge). */
export function halfSize(f: Pick<Furniture, "x" | "z" | "w" | "d" | "rotation">): Vec2 {
  const b = itemBox(f);
  return [(b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2];
}

/** Alignment lines from other items' boxes (edges and centres) and the rooms' centre lines. */
export function alignLines(items: readonly Box[], rooms: readonly Pick<Room, "points">[]): AlignLines {
  const xs: AlignLine[] = [];
  const zs: AlignLine[] = [];
  for (const b of items) {
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    xs.push({ v: cx, kind: "centre", from: b.z0, to: b.z1 }, { v: b.x0, kind: "edge", from: b.z0, to: b.z1 }, { v: b.x1, kind: "edge", from: b.z0, to: b.z1 });
    zs.push({ v: cz, kind: "centre", from: b.x0, to: b.x1 }, { v: b.z0, kind: "edge", from: b.x0, to: b.x1 }, { v: b.z1, kind: "edge", from: b.x0, to: b.x1 });
  }
  for (const r of rooms) {
    if (r.points.length < 3) continue;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const [x, z] of r.points) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    xs.push({ v: (x0 + x1) / 2, kind: "room", from: z0, to: z1 });
    zs.push({ v: (z0 + z1) / 2, kind: "room", from: x0, to: x1 });
  }
  return { xs, zs };
}

/** One axis's snap: the centre's new value and the line it took. */
export interface AxisSnap {
  v: number;
  line: AlignLine;
}

/**
 * The best line for one axis of a box centred at `c` with half size `half`, whose extent on the other axis is
 * [o0, o1]. Room centre lines (explicit targets) take the centre and beat item lines; item centres take the centre,
 * item edges take either edge. Lines further than `reach` from the box on the other axis are skipped (only guides
 * near the pointer count). No allocation unless something snaps.
 */
export function snapAxis(c: number, half: number, o0: number, o1: number, lines: readonly AlignLine[], tol: number, reach = ALIGN_REACH): AxisSnap | null {
  let best: AlignLine | null = null;
  let bestV = 0;
  let bestD = tol;
  let bestRank = 2;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.from - o1 > reach || o0 - line.to > reach) continue;
    const rank = line.kind === "room" ? 0 : 1;
    if (rank > bestRank) continue;
    // a room's centre line only for an item standing in that room (its centre within the room on the other axis)
    if (rank === 0 && ((o0 + o1) / 2 < line.from || (o0 + o1) / 2 > line.to)) continue;
    let v: number;
    let d: number;
    if (line.kind === "edge") {
      const dl = Math.abs(c - half - line.v);
      const dr = Math.abs(c + half - line.v);
      v = dl <= dr ? line.v + half : line.v - half;
      d = Math.min(dl, dr);
    } else {
      v = line.v;
      d = Math.abs(c - line.v);
    }
    if (d > tol) continue;
    if (rank === bestRank && d >= bestD) continue;
    best = line;
    bestV = v;
    bestD = d;
    bestRank = rank;
  }
  return best ? { v: bestV, line: best } : null;
}

/** A point snap: the new centre, which axes snapped, and the guides to draw. */
export interface PointSnap {
  p: Vec2;
  x: boolean;
  z: boolean;
  guides: Guide[];
}

const NO_GUIDES: Guide[] = [];

/** Snap an item's centre `p` (box half size `half`) to the alignment lines, each axis on its own. */
export function snapPoint(p: Vec2, half: Vec2, lines: AlignLines, tol: number, reach = ALIGN_REACH): PointSnap {
  const [hx, hz] = half;
  const sx = snapAxis(p[0], hx, p[1] - hz, p[1] + hz, lines.xs, tol, reach);
  const sz = snapAxis(p[1], hz, p[0] - hx, p[0] + hx, lines.zs, tol, reach);
  if (!sx && !sz) return { p, x: false, z: false, guides: NO_GUIDES };
  const x = sx ? sx.v : p[0];
  const z = sz ? sz.v : p[1];
  const guides: Guide[] = [];
  if (sx) {
    // along the line from the guide's source to the item, through both
    const v = sx.line.kind === "edge" ? sx.line.v : x;
    guides.push({ a: [v, Math.min(sx.line.from, z - hz)], b: [v, Math.max(sx.line.to, z + hz)], kind: sx.line.kind, axis: "x" });
  }
  if (sz) {
    const v = sz.line.kind === "edge" ? sz.line.v : z;
    guides.push({ a: [Math.min(sz.line.from, x - hx), v], b: [Math.max(sz.line.to, x + hx), v], kind: sz.line.kind, axis: "z" });
  }
  return { p: [x, z], x: !!sx, z: !!sz, guides };
}
