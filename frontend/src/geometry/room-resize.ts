// What happens to a room's contents when its outline changes (#64).
import { bounds, isAxisRect, pointInPolygon, type Floor, type Vec2 } from "../model.ts";

/** Items (by id) and HA devices (by entity id) on the floor. */
export interface Contents {
  furniture: string[];
  devices: string[];
}

/** Items and devices whose centre stood inside `before` and is outside `after`: left behind by a resize. */
export function strandedBy(floor: Floor, before: readonly Vec2[], after: readonly Vec2[]): Contents {
  const left = (p: Vec2) => pointInPolygon(p, before) && !pointInPolygon(p, after);
  return {
    furniture: floor.furniture.filter((m) => left([m.x, m.z])).map((m) => m.id),
    devices: floor.placements.filter((pl) => left([pl.x, pl.z])).map((pl) => pl.entity_id),
  };
}

/** How much a carried resize moved: items, devices and neighbouring walls (rooms and free walls). */
export interface Carried {
  furniture: number;
  devices: number;
  walls: number;
}

const EPS = 1e-6;
const mm = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Give room `roomId` the outline `after` and carry its contents along (#64, rectangles only). Per axis, a move of
 * both sides by the same step carries everything inside by that step; otherwise each item and device follows the
 * side it stands nearer to, and the walls of neighbouring rooms and free walls lying on a moved side move with it.
 * Fixed items stay. Returns null (and changes nothing) unless the room is an axis-aligned rectangle before and after.
 */
export function carryRectResize(floor: Floor, roomId: string, after: readonly Vec2[]): Carried | null {
  const room = floor.rooms.find((r) => r.id === roomId);
  if (!room || !isAxisRect(room.points) || !isAxisRect(after)) return null;
  const was = bounds(room.points);
  const now = bounds(after);
  const inside = (p: Vec2) => p[0] >= was.x0 - EPS && p[0] <= was.x1 + EPS && p[1] >= was.z0 - EPS && p[1] <= was.z1 + EPS;
  const axes = [
    { lo: was.x0, hi: was.x1, dlo: now.x0 - was.x0, dhi: now.x1 - was.x1, span: [was.z0, was.z1] },
    { lo: was.z0, hi: was.z1, dlo: now.z0 - was.z0, dhi: now.z1 - was.z1, span: [was.x0, was.x1] },
  ] as const;
  const step = (p: Vec2): Vec2 =>
    axes.map((a, i) => mm(p[i] + (Math.abs(a.dlo - a.dhi) < EPS || p[i] - a.lo <= a.hi - p[i] ? a.dlo : a.dhi))) as Vec2;
  const carried: Carried = { furniture: 0, devices: 0, walls: 0 };
  for (const m of floor.furniture) {
    if (m.locked || !inside([m.x, m.z])) continue;
    const [x, z] = step([m.x, m.z]);
    if (x === m.x && z === m.z) continue;
    Object.assign(m, { x, z });
    carried.furniture++;
  }
  for (const pl of floor.placements) {
    if (pl.locked || !inside([pl.x, pl.z])) continue;
    const [x, z] = step([pl.x, pl.z]);
    if (x === pl.x && z === pl.z) continue;
    Object.assign(pl, { x, z });
    carried.devices++;
  }
  // a point of a neighbour on a side that moved (a resize, not a move) goes with that side
  const onSide = (p: Vec2): Vec2 | null => {
    for (let i = 0; i < 2; i++) {
      const a = axes[i];
      if (Math.abs(a.dlo - a.dhi) < EPS) continue;
      const along = p[1 - i];
      if (along < a.span[0] - EPS || along > a.span[1] + EPS) continue;
      for (const [side, d] of [[a.lo, a.dlo], [a.hi, a.dhi]] as const) {
        if (Math.abs(d) < EPS || Math.abs(p[i] - side) > EPS) continue;
        const q = [...p] as Vec2;
        q[i] = mm(p[i] + d);
        return q;
      }
    }
    return null;
  };
  // a neighbour room follows only where one of its edges lies along a moved side, within the side's length
  for (const r of floor.rooms) {
    if (r.id === roomId) continue;
    const next = r.points.map((p) => [...p] as Vec2);
    let hit = false;
    r.points.forEach((p, k) => {
      const q = r.points[(k + 1) % r.points.length];
      const [mp, mq] = [onSide(p), onSide(q)];
      if (!mp || !mq || Math.hypot(p[0] - q[0], p[1] - q[1]) < EPS || Math.abs(mp[0] - p[0] - (mq[0] - q[0])) > EPS || Math.abs(mp[1] - p[1] - (mq[1] - q[1])) > EPS) return;
      next[k] = mp;
      next[(k + 1) % r.points.length] = mq;
      hit = true;
    });
    if (hit) {
      r.points = next;
      carried.walls++;
    }
  }
  for (const w of floor.walls ?? []) {
    const a = onSide(w.a);
    const b = onSide(w.b);
    if (a) w.a = a;
    if (b) w.b = b;
    if (a || b) carried.walls++;
  }
  room.points = after.map((p) => [...p] as Vec2);
  return carried;
}

/** What the editor remembers after an outline edit of a room, for its "moved with the room" and "now outside" note. */
export interface ResizeNote<Doc = unknown> {
  roomId: string;
  /** The room's outline before the first of a run of edits. */
  before: Vec2[];
  /** The document the note describes (the note is stale once it changes). */
  doc: Doc;
  /** The document before the edit. */
  base: Doc;
  /** What a carried resize moved (null: outline only). */
  carried: Carried | null;
  /** The same edit as outline only, offered instead of the carried one. */
  outline: Doc | null;
  /** Items and devices that stood inside `before` and are outside now. */
  stranded: Contents;
}
