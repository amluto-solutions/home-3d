// Bins on the move (#142): a bin marked out is drawn at its kerb spot and glides there (and back) when the view may
// animate; while it is due out and still in, a dashed line on the ground points from it to the spot.

import type { Vec2 } from "../model.ts";

/** How long a bin takes to its kerb spot or back (ms). */
export const BIN_GLIDE_MS = 1100;

export interface BinGlide {
  from: Vec2;
  to: Vec2;
  /** 0 … 1 */
  t: number;
}

/** Where a gliding bin is now (eased in and out). */
export function glidePos(g: BinGlide): Vec2 {
  const t = Math.max(0, Math.min(1, g.t));
  const e = t * t * (3 - 2 * t);
  return [g.from[0] + (g.to[0] - g.from[0]) * e, g.from[1] + (g.to[1] - g.from[1]) * e];
}

const same = (a: Vec2, b: Vec2) => Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3;

/**
 * The glides after the drawn spots changed from `prev` to `next` (bin id -> kerb spot; a bin not listed stands at
 * `home`). A bin whose drawn place changed glides from where it is now (mid-glide too) to its new place; without
 * `animate` (reduced motion, the tablet level, the first look at a home) nothing glides: bins jump. A bin no longer
 * in `home` (deleted, another home) drops its glide.
 */
export function binGlides(prev: ReadonlyMap<string, Vec2>, next: ReadonlyMap<string, Vec2>, home: ReadonlyMap<string, Vec2>, current: ReadonlyMap<string, BinGlide>, animate: boolean): Map<string, BinGlide> {
  const out = new Map<string, BinGlide>();
  if (!animate) return out;
  for (const id of new Set([...prev.keys(), ...next.keys(), ...current.keys()])) {
    const h = home.get(id);
    if (!h) continue;
    const to = next.get(id) ?? h;
    const g = current.get(id);
    if (g && g.t < 1 && same(g.to, to)) {
      out.set(id, g);
      continue;
    }
    const from = g && g.t < 1 ? glidePos(g) : (prev.get(id) ?? h);
    if (!same(from, to)) out.set(id, { from, to, t: 0 });
  }
  return out;
}

/**
 * The dashes of a "take me out" cue from `from` to `to`: starting `skip` m out (the bin's edge), stopping `head` m
 * short of the spot (where the arrow head goes). Each dash is [start, end].
 */
export function cueDashes(from: Vec2, to: Vec2, skip = 0, head = 0.3, dash = 0.3, gap = 0.2): [Vec2, Vec2][] {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const end = len - head;
  if (end <= skip) return [];
  const at = (s: number): Vec2 => [from[0] + (dx * s) / len, from[1] + (dz * s) / len];
  const out: [Vec2, Vec2][] = [];
  for (let s = skip; s < end; s += dash + gap) out.push([at(s), at(Math.min(end, s + dash))]);
  return out;
}
