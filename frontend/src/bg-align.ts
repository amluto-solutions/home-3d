// Laying the floor-plan picture onto the map (#465, "Align to the map"): two corners tapped in the picture and the same
// two on the house from the map. The picture is scaled, turned and moved so the first stretch lands on the second.
// Pure maths, no DOM. Ported from NeonPlan 3D 3.3.0 (MIT, Mastershort).

import type { Background, Vec2 } from "./model.ts";

/** Shortest stretch (m) between two taps that still tells a direction and a size. */
export const MIN_STRETCH = 0.05;

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * The picture `bg` (its image `aspect` = height / width) placed so the stretch a1→a2 (two points in the picture, as
 * tapped in the plan) lands on the stretch b1→b2 (the same two corners on the house from the map): scaled by the ratio
 * of the lengths, turned by the difference of the directions, the first corner on the first corner. A similarity, so
 * the picture keeps its proportions. Null when either stretch is too short to mean anything.
 */
export function alignBackground(bg: Background, aspect: number, a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Background | null {
  const la = Math.hypot(a2[0] - a1[0], a2[1] - a1[1]);
  const lb = Math.hypot(b2[0] - b1[0], b2[1] - b1[1]);
  if (la < MIN_STRETCH || lb < MIN_STRETCH) return null;
  const k = lb / la;
  const t = Math.atan2(b2[1] - b1[1], b2[0] - b1[0]) - Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
  // the picture's middle goes along: c' = b1 + k R(t) (c - a1)
  const h = bg.width * aspect;
  const dx = bg.x + bg.width / 2 - a1[0];
  const dz = bg.z + h / 2 - a1[1];
  const cx = b1[0] + k * (dx * Math.cos(t) - dz * Math.sin(t));
  const cz = b1[1] + k * (dx * Math.sin(t) + dz * Math.cos(t));
  const rot = (bg.rotation ?? 0) + (t * 180) / Math.PI;
  const w = bg.width * k;
  return { ...bg, width: round2(w), rotation: round2(((((rot + 180) % 360) + 360) % 360) - 180), x: round2(cx - w / 2), z: round2(cz - (h * k) / 2) };
}

/** The corner of the map nearest to `p` within `reach` metres (at least 2 m), else `p` itself. */
export function nearestCorner(p: Vec2, corners: readonly Vec2[], reach: number): Vec2 {
  let best = p;
  let d = Math.max(2, reach);
  for (const q of corners) {
    const e = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (e < d) {
      d = e;
      best = q;
    }
  }
  return best;
}
