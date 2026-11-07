/**
 * Where doors and windows sit in the plan, for tapping and placing them in the editor (#62, #63).
 */
import type { FreeWall, Opening, Room, Vec2 } from "../model.ts";
import { openingHost, pointOnRoomEdge } from "./walls.ts";

/** Two openings this far apart across the wall line still count as being in the same wall (thick walls, free walls). */
const SAME_WALL = 0.3;
/** Openings may touch: overlaps smaller than this are let through. */
const TOUCH = 0.01;

/** The stretch of wall an opening fills, in plan metres: from its start to its end along the host edge. */
export function openingSpan(o: Pick<Opening, "room_id" | "edge" | "wall" | "offset" | "width">, rooms: readonly Room[], free: readonly FreeWall[]): [Vec2, Vec2] | null {
  const host = openingHost(o, rooms, free);
  if (!host) return null;
  return [pointOnRoomEdge(host.room, host.edge, o.offset - o.width / 2), pointOnRoomEdge(host.room, host.edge, o.offset + o.width / 2)];
}

/** Position along a span (0 = its start) and distance across it of a point. */
function along(span: [Vec2, Vec2], p: Vec2): { s: number; d: number; len: number } {
  const [a, b] = span;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len;
  const uz = (b[1] - a[1]) / len;
  const dx = p[0] - a[0];
  const dz = p[1] - a[1];
  return { s: dx * ux + dz * uz, d: Math.abs(dx * -uz + dz * ux), len };
}

/**
 * The existing opening a new one on `span` would run into: one in the same wall line (on either room's side of
 * a shared wall, or in a free wall along it) whose stretch overlaps it. Null when the stretch is free.
 */
export function blockingOpening(span: [Vec2, Vec2], openings: readonly Opening[], rooms: readonly Room[], free: readonly FreeWall[]): Opening | null {
  for (const o of openings) {
    const other = openingSpan(o, rooms, free);
    if (!other) continue;
    const p = along(span, other[0]);
    const q = along(span, other[1]);
    if (p.d > SAME_WALL || q.d > SAME_WALL) continue;
    const lo = Math.min(p.s, q.s);
    const hi = Math.max(p.s, q.s);
    if (lo < p.len - TOUCH && hi > TOUCH) return o;
  }
  return null;
}

/**
 * What a tap in Doors & windows mode does when the new opening it would add (on `span`) runs into another:
 * a tap inside the other one's width selects it, a tap beside it is turned down. Null: the stretch is free.
 */
export function openingTap(tap: Vec2, span: [Vec2, Vec2], openings: readonly Opening[], rooms: readonly Room[], free: readonly FreeWall[]): { select: Opening } | { blocked: Opening } | null {
  const hit = blockingOpening(span, openings, rooms, free);
  if (!hit) return null;
  const other = openingSpan(hit, rooms, free)!;
  const t = along(other, tap);
  return t.s >= 0 && t.s <= t.len && t.d <= SAME_WALL ? { select: hit } : { blocked: hit };
}

export type Compass = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

/**
 * Compass direction of the corner an opening's position is measured from (the edge's first point), seen from
 * the edge's other end; `north` is the plan's north in degrees clockwise from up (-z) (#63).
 */
export function edgeStartCorner(room: Pick<Room, "points">, edge: number, north: number): Compass {
  const a = room.points[edge];
  const b = room.points[(edge + 1) % room.points.length];
  const bearing = ((Math.atan2(a[0] - b[0], -(a[1] - b[1])) * 180) / Math.PI - north + 720) % 360;
  return (["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const)[Math.round(bearing / 45) % 8];
}
