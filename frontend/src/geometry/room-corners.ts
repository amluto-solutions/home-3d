// Adding and removing a room corner (#157). Everything stored per room edge (wall_heights with its per-part lists,
// wall_thickness, wall_slopes, wall_splits, the openings) is indexed by edge, so it is remapped in the same step that
// edits the corner list: one place, used by the mid-edge "+" handle and by deleting a corner.

import type { Floor, Opening, Vec2, WallHeight } from "../model.ts";
import { generateWalls } from "./walls.ts";

const EPS = 1e-3;
const mm = (v: number) => Math.round(v * 1000) / 1000;
const dist = (a: Vec2, b: Vec2) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Where the parts of every room edge start (m from points[edge]), by "room:edge": a per-part height list follows these. */
export function partStarts(floor: Floor): Map<string, number[]> {
  // the thickness does not change where an edge is cut
  const { parts } = generateWalls(floor.rooms, { exterior: 0.24, interior: 0.12 }, floor.walls ?? []);
  return new Map([...parts].map(([k, v]) => [k, [...new Set(v.map(mm))]]));
}

/** An edge's height at a distance along it: its plain height, or the part's height of a per-part list. */
function heightAt(h: WallHeight | undefined, starts: readonly number[] | undefined, at: number): number | null {
  if (!Array.isArray(h)) return h ?? null;
  const list = starts?.length ? starts : [0];
  let k = 0;
  for (let i = 0; i < list.length; i++) if (list[i] <= at + EPS) k = i;
  return h[k] ?? null;
}

/** For a new edge and a distance along it: the old edge and the distance along that one it came from. */
type Source = (edge: number, at: number) => [number, number];

/**
 * Rebuild the wall heights of every room after the corner list changed: each part of each edge takes the height
 * the old plan had at that spot (`source` says where a target-room edge came from; other rooms keep their edges).
 * A per-part list is only kept where the parts still differ; every list is a fresh array (never shared).
 */
function remapHeights(floor: Floor, before: Map<string, number[]>, old: Map<string, WallHeight[] | undefined>, roomId: string, source: Source): void {
  const after = partStarts(floor);
  for (const r of floor.rooms) {
    const hs = old.get(r.id);
    if (!hs) continue;
    const own = r.id === roomId;
    // other rooms only change where the corner cut (or stopped cutting) one of their edges
    if (!own && !hs.some((h) => Array.isArray(h))) continue;
    r.wall_heights = r.points.map((_, e) => {
      const starts = after.get(`${r.id}:${e}`) ?? [0];
      const values = starts.map((s) => {
        const [oe, os] = own ? source(e, s) : [e, s];
        return heightAt(hs[oe], before.get(`${r.id}:${oe}`), os);
      });
      return values.every((v) => v === values[0]) ? values[0] : values;
    });
  }
}

function tidySplits(list: (number[] | null)[]): (number[] | null)[] | undefined {
  const out = list.map((l) => (l && l.length ? l : null));
  return out.some((l) => l) ? out : undefined;
}

/**
 * Add a corner at `p` on edge `i` of a room (points[i] -> points[i + 1]): both halves keep the wall's height,
 * thickness and slope; split points and the per-part heights go with the half they lie on; openings too.
 */
export function insertCorner(floor: Floor, roomId: string, i: number, p: Vec2): void {
  const room = floor.rooms.find((r) => r.id === roomId);
  if (!room) return;
  const n = room.points.length;
  const a = room.points[i];
  const b = room.points[(i + 1) % n];
  const first = dist(a, p);
  const whole = dist(a, b) || 1;
  const before = partStarts(floor);
  const old = new Map(floor.rooms.map((r) => [r.id, r.wall_heights ? structuredClone(r.wall_heights) : undefined]));

  room.points.splice(i + 1, 0, p);
  if (room.wall_thickness) room.wall_thickness.splice(i + 1, 0, room.wall_thickness[i] ?? null);
  if (room.wall_slopes) {
    const sl = room.wall_slopes[i] ?? null;
    const hm = sl ? mm(sl[0] + ((sl[1] - sl[0]) * first) / whole) : 0;
    if (sl) room.wall_slopes[i] = [sl[0], hm];
    room.wall_slopes.splice(i + 1, 0, sl ? [hm, sl[1]] : null);
  }
  if (room.wall_splits) {
    const list = room.wall_splits[i] ?? [];
    const splits = room.wall_splits.slice(0, n);
    while (splits.length < n) splits.push(null);
    // a split right at the new corner is the corner now
    splits[i] = list.filter((t) => t < first - EPS);
    splits.splice(i + 1, 0, list.filter((t) => t > first + EPS).map((t) => mm(t - first)));
    room.wall_splits = tidySplits(splits);
  }
  for (const o of floor.openings) {
    if (o.room_id !== roomId || o.wall) continue;
    if (o.edge > i) o.edge += 1;
    else if (o.edge === i && o.offset > first) {
      o.edge = i + 1;
      o.offset = mm(o.offset - first);
    }
  }
  // edge i keeps its start, edge i + 1 starts at the new corner, the later edges move up by one
  remapHeights(floor, before, old, roomId, (e, s) => (e <= i ? [e, s] : e === i + 1 ? [i, s + first] : [e - 1, s]));
}

/** What removing a corner would cost (#206): see `cornerLoss`. */
export interface CornerLoss {
  /** The corner lies in line with its neighbours: nothing is lost (the edges join without a trace). */
  inLine: boolean;
  /** Doors and windows on the two edges that the removal drops unless they are kept. */
  openings: Opening[];
  /** Those of them that still fit on the joined wall, at their distance along it (a subset of `openings`). */
  fit: Opening[];
  /** The edge after the corner differs in height from the one before: the joined wall takes the earlier one's. */
  height: boolean;
  /** Likewise its thickness. */
  thickness: boolean;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * What `removeCorner` would drop or change for corner `index` (#206), without changing anything: the openings on
 * the two edges, which of them fit on the joined wall (whole, inside its length, not overlapping one kept before;
 * the earlier edge's first, each at its distance along the joined wall), and whether the joined wall takes the
 * earlier edge's height or thickness over the later one's.
 */
export function cornerLoss(floor: Floor, roomId: string, index: number): CornerLoss | null {
  const room = floor.rooms.find((r) => r.id === roomId);
  if (!room || room.points.length <= 3) return null;
  const n = room.points.length;
  const prev = (index - 1 + n) % n;
  const P = room.points;
  const next = (index + 1) % n;
  const lp = dist(P[prev], P[index]);
  const inLine = lp + dist(P[index], P[next]) - dist(P[prev], P[next]) < 0.005;
  if (inLine) return { inLine, openings: [], fit: [], height: false, thickness: false };
  const onEdge = (e: number) => floor.openings.filter((o) => o.room_id === roomId && !o.wall && o.edge === e).sort((a, b) => a.offset - b.offset);
  const openings = [...onEdge(prev), ...onEdge(index)];
  const joined = dist(P[prev], P[next]);
  const fit: Opening[] = [];
  let end = 0;
  for (const o of openings) {
    const c = o.edge === index ? o.offset + lp : o.offset;
    if (c - o.width / 2 < end - EPS || c + o.width / 2 > joined + EPS) continue;
    fit.push(o);
    end = c + o.width / 2;
  }
  return {
    inLine,
    openings,
    fit,
    height: !same(room.wall_heights?.[prev], room.wall_heights?.[index]),
    thickness: !same(room.wall_thickness?.[prev], room.wall_thickness?.[index]),
  };
}

/**
 * Remove corner `index` of a room: the edge before it and the one starting there become one, which keeps the
 * earlier edge's height and thickness. A corner that lies in line with its neighbours (one a "+" made) goes
 * without a trace: the second edge's split points, part heights and openings move onto the joined edge, and a
 * split keeps two different heights apart. Otherwise the openings on both edges go, as the wall itself moves –
 * except those of `keep` (ids, from `cornerLoss(...).fit`), which stay on the joined wall at their distance along it (#206).
 */
export function removeCorner(floor: Floor, roomId: string, index: number, keep: readonly string[] = []): void {
  const room = floor.rooms.find((r) => r.id === roomId);
  if (!room || room.points.length <= 3) return;
  const n = room.points.length;
  const prev = (index - 1 + n) % n;
  const P = room.points;
  const lp = dist(P[prev], P[index]);
  const lc = dist(P[index], P[(index + 1) % n]);
  const inLine = lp + lc - dist(P[prev], P[(index + 1) % n]) < 0.005;
  const before = partStarts(floor);
  const old = new Map(floor.rooms.map((r) => [r.id, r.wall_heights ? structuredClone(r.wall_heights) : undefined]));
  const hs = old.get(roomId);
  // in line, two different heights meet at the corner: a split keeps them apart
  const keepApart = inLine && !!hs && heightAt(hs[prev], before.get(`${roomId}:${prev}`), lp - EPS) !== heightAt(hs[index], before.get(`${roomId}:${index}`), 0);

  if (room.wall_splits || keepApart) {
    const splits = (room.wall_splits ?? []).slice(0, n);
    while (splits.length < n) splits.push(null);
    const joined = [...(splits[prev] ?? []), ...(inLine ? (splits[index] ?? []).map((t) => mm(t + lp)) : []), ...(keepApart ? [mm(lp)] : [])];
    splits[prev] = [...new Set(joined)].sort((x, y) => x - y);
    splits.splice(index, 1);
    room.wall_splits = tidySplits(splits);
  }
  room.points.splice(index, 1);
  const m = room.points.length;
  const joinedEdge = (index - 1 + m) % m;
  if (room.wall_thickness) room.wall_thickness.splice(index, 1);
  if (room.wall_slopes) {
    room.wall_slopes.splice(index, 1);
    room.wall_slopes[joinedEdge] = null;
    if (room.wall_slopes.every((x) => !x)) room.wall_slopes = undefined;
  }
  floor.openings = floor.openings
    .filter((o) => o.room_id !== roomId || o.wall || inLine || (o.edge !== index && o.edge !== prev) || keep.includes(o.id))
    .map((o) => {
      if (o.room_id !== roomId || o.wall) return o;
      if (o.edge === index) return { ...o, edge: joinedEdge, offset: mm(o.offset + lp) };
      return o.edge > index ? { ...o, edge: o.edge - 1 } : o;
    });
  // the joined edge: up to the old corner from the edge before, beyond it (in line) from the removed one
  remapHeights(floor, before, old, roomId, (e, s) => {
    if (e === joinedEdge) return inLine && s >= lp - EPS ? [index, s - lp] : [prev, Math.min(s, lp)];
    return [e >= index ? e + 1 : e, s];
  });
}
