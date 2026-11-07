// Staircases between floors: the way up each one in the lower floor's coordinates. Shared by the pets (fun chunk) and the
// walk (#270), so it stays free of any 3D code.
import type { Building, Vec2 } from "../model.ts";
import { itemOf } from "../pet-place.ts";

/**
 * A staircase between two floors: the way up in the lower floor's coordinates, from the foot (on the lower floor) over
 * the steps (and a landing) to where one steps off on the upper floor; heights relative to the lower floor.
 */
export interface Link {
  lower: string;
  upper: string;
  /** The steps (and landing), foot to top. */
  pts: [number, number, number][];
  /** Where one may step on below and step off above: in front, else beside (a stair often stands against a wall). */
  foot: Vec2[];
  top: Vec2[];
}

/** The way up a stair in its own coordinates (front +z is the foot, the top at the back), heights 0 … 1 of the rise. */
function stairWay(item: string, w: number, d: number): [number, number, number][] | null {
  const out = 0.35;
  if (item === "stairs_u") {
    // built-in U-stair: up the left half to the landing at the back, across, back up the right half towards the front
    const fw = (w - Math.min(0.12, w * 0.06)) / 2;
    const landing = Math.min(fw, d * 0.45);
    const xa = -w / 2 + fw / 2;
    const xb = w / 2 - fw / 2;
    const zl = -d / 2 + landing / 2;
    return [[xa, d / 2 + out, 0], [xa, d / 2, 0], [xa, zl, 0.5], [xb, zl, 0.5], [xb, d / 2 - 0.15, 1], [xb, d / 2 + out, 1]];
  }
  if (item === "u_shape" || item === "u_open_winder") return [[0.6, 1.5 + out, 0], [0.6, 1.5, 0], [0.6, -1.05, 0.5], [-0.6, -1.05, 0.5], [-0.6, 1.4, 1], [-0.6, 1.4 + out, 1]];
  if (item === "l_shape") return [[0.6, 1.3 + out, 0], [0.6, 1.3, 0], [0.6, -0.8, 0.5], [0.1, -0.8, 0.5], [-1.1, -0.8, 1], [-1.1 - out, -0.8, 1]];
  if (item === "spiral") {
    // round the post, counter-clockwise from the front
    const way: [number, number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const a = ((-90 + (i * 300) / 12) * Math.PI) / 180;
      way.push([Math.cos(a) * 0.45, Math.sin(a) * 0.45, i / 12]);
    }
    const a0 = (-90 * Math.PI) / 180;
    const a1 = (210 * Math.PI) / 180;
    return [[Math.cos(a0) * 1.0, Math.sin(a0) * 1.0, 0], ...way, [Math.cos(a1) * 1.0, Math.sin(a1) * 1.0, 1]];
  }
  if (item === "winder_bottom") {
    // on from the right side, round the inner corner over the winders, then straight up
    const zt = d / 2 - w;
    const turn: [number, number, number][] = [0.25, 0.5, 0.75].map((k) => {
      const phi = (k * Math.PI) / 2;
      return [w / 2 - Math.sin(phi) * (w / 2), zt + Math.cos(phi) * (w / 2), (k * 3) / 14];
    });
    return [[w / 2 + out, zt + w / 2, 0], [w / 2, zt + w / 2, 0], ...turn, [0, zt, 3 / 14], [0, -d / 2, 1], [0, -d / 2 - out, 1]];
  }
  if (item === "corner_bottom") {
    // up the side steps onto the landing, round the corner, straight up on the left
    const xs = -w / 2 + 0.5;
    const zl = d / 2 - 0.5;
    return [[w / 2 + out, zl, 0], [w / 2, zl, 0], [xs + 0.3, zl, 3 / 14], [xs, zl, 4 / 14], [xs, d / 2 - 1, 4 / 14], [xs, -d / 2, 1], [xs, -d / 2 - out, 1]];
  }
  if (item === "stairs" || item === "straight" || item === "straight_open" || item === "floating" || item === "space_saver") return [[0, d / 2 + out, 0], [0, d / 2, 0], [0, -d / 2, 1], [0, -d / 2 - out, 1]];
  return null;
}

/** How close a flight's top must be to the foot of the next (m across, plus half the widths) and in height (m) to join it. */
const JOIN_NEAR = 0.3;
const JOIN_HEIGHT = 0.15;

/** One drawn flight: its way (stepping-off points at both ends) from `h0` to `h1` above the lower floor. */
interface Flight {
  way: [number, number, number][];
  w: number;
  W: (x: number, z: number) => Vec2;
  h0: number;
  h1: number;
}

const flightPts = (f: Flight): [number, number, number][] =>
  f.way.map(([x, z, t]): [number, number, number] => {
    const [wx, wz] = f.W(x, z);
    return [wx, f.h0 + t * (f.h1 - f.h0), wz];
  });

/**
 * Every way up between floors (built-in stairs and the stairs pack's). A flight starts at its mount height and rises its
 * own height; flights whose top meets the foot of another (a quarter-turn stair drawn as two) join into one way, and only a
 * way from the floor that reaches at least half way up is a link, taken to the floor above. A flight that reaches nowhere (a few steps to a raised area) is left out.
 */
export function stairLinks(b: Building): Link[] {
  const floors = b.floors.filter((f) => f.rooms.some((r) => r.points.length >= 3)).sort((x, y) => x.elevation - y.elevation);
  const out: Link[] = [];
  for (let i = 0; i < floors.length - 1; i++) {
    const lower = floors[i];
    const upper = floors[i + 1];
    const rise = upper.elevation - lower.elevation;
    const flights: Flight[] = [];
    for (const f of lower.furniture) {
      const way = stairWay(itemOf(f.type), f.w, f.d);
      if (!way) continue;
      const a = (f.rotation * Math.PI) / 180;
      const m = f.mirror ? -1 : 1;
      const W = (x: number, z: number): Vec2 => [f.x + x * m * Math.cos(a) - z * Math.sin(a), f.z + x * m * Math.sin(a) + z * Math.cos(a)];
      const h0 = f.mount_y ?? 0;
      flights.push({ way, w: f.w, W, h0, h1: h0 + f.h });
    }
    // which flight carries on from which: the top of one at the foot of another, at the same height
    const next = new Map<Flight, Flight>();
    const taken = new Set<Flight>();
    for (const x of flights) {
      const t = flightPts(x);
      const top = t[t.length - 2];
      let best: Flight | null = null;
      let bestD = Infinity;
      for (const y of flights) {
        if (y === x || taken.has(y)) continue;
        const foot = flightPts(y)[1];
        const d = Math.hypot(top[0] - foot[0], top[2] - foot[2]);
        if (d <= JOIN_NEAR + (x.w + y.w) / 4 && Math.abs(x.h1 - y.h0) <= JOIN_HEIGHT && d < bestD) {
          best = y;
          bestD = d;
        }
      }
      if (best) {
        next.set(x, best);
        taken.add(best);
      }
    }
    for (const first of flights) {
      if (taken.has(first) || first.h0 > JOIN_HEIGHT) continue;
      const chain = [first];
      for (let n = next.get(first); n && !chain.includes(n); n = next.get(n)) chain.push(n);
      const last = chain[chain.length - 1];
      if (last.h1 < rise / 2) continue;
      // a way that tops out at least half way up is taken to the floor above (ends snapped), with the joins at one height
      first.h0 = 0;
      last.h1 = rise;
      for (let k = 1; k < chain.length; k++) chain[k].h0 = chain[k - 1].h1;
      const parts = chain.map(flightPts);
      // each flight's first and last points step off it; beside them, the first and last step from the side
      const side0 = first.w / 2 + 0.35;
      const side1 = last.w / 2 + 0.35;
      const z0 = first.way[1][1];
      const z1 = last.way[last.way.length - 2][1];
      const head = parts[0][0];
      const endPart = parts[parts.length - 1];
      const tail = endPart[endPart.length - 1];
      out.push({
        lower: lower.id,
        upper: upper.id,
        pts: parts.flatMap((p) => p.slice(1, -1)),
        // (beside: at the first steps, a little up the stair, where a wall in front leaves room)
        foot: [[head[0], head[2]], ...[0, -0.35, -0.7].flatMap((k) => [first.W(-side0, z0 + k), first.W(side0, z0 + k)])],
        top: [[tail[0], tail[2]], ...[0, 0.35, 0.7].flatMap((k) => [last.W(-side1, z1 + k), last.W(side1, z1 + k)])],
      });
    }
  }
  return out;
}
