// Rings of the round pack shapes (#4) in local coordinates: a sphere, a lathe (a profile turned around the upright
// axis) and a box with rounded edges. Each is a stack of counter-clockwise rings with the same point count, from the
// bottom cap to the top cap, for pushRings (geo.ts). They stay low-poly: 12 points around (8 on small parts).

import type { Ring } from "./geo.ts";

/** Points around a round part: fewer on small ones (knobs, feet), which nobody sees as faceted. */
function around(rx: number, rz: number): number {
  return Math.max(rx, rz) < 0.05 ? 8 : 12;
}

/** An ellipse ring of `n` points around (cx, cz) at height y, counter-clockwise in (x, z). */
function ellipse(cx: number, cz: number, rx: number, rz: number, y: number, n: number): Ring {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]);
  }
  return { pts, y };
}

/** A sphere filling the box rx × rz around (cx, cz) from y0 to y1: squashed when its radii differ. */
export function sphereRings(cx: number, cz: number, rx: number, rz: number, y0: number, y1: number): Ring[] {
  const n = around(rx, rz);
  const bands = n === 8 ? 4 : 6;
  const cy = (y0 + y1) / 2;
  const ry = (y1 - y0) / 2;
  const rings: Ring[] = [];
  for (let j = 0; j <= bands; j++) {
    const lat = -Math.PI / 2 + (j / bands) * Math.PI;
    // the poles are exact points (cos(±90°) is not quite 0)
    const k = j === 0 || j === bands ? 0 : Math.cos(lat);
    rings.push(ellipse(cx, cz, rx * k, rz * k, cy + Math.sin(lat) * ry, n));
  }
  return rings;
}

/**
 * A lathe: `profile` points [radius, height] turned around the part's upright axis. The radius is a fraction of the
 * radii rx and rz (1 touches the part's box), the height a fraction from y0 to y1. A profile written from the top down
 * (clockwise seen from the side) is turned round, so the faces always point outwards.
 */
export function latheRings(cx: number, cz: number, rx: number, rz: number, y0: number, y1: number, profile: readonly (readonly number[])[]): Ring[] {
  const pts = profile.map(([r, y]) => [Math.min(1, Math.max(0, r)), Math.min(1, Math.max(0, y))] as const);
  // the profile closed along the axis, in (radius, height): counter-clockwise runs up the outside
  let area = 0;
  const loop = [[0, pts[0][1]] as const, ...pts, [0, pts[pts.length - 1][1]] as const];
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % loop.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  if (area < 0) pts.reverse();
  const n = around(rx, rz);
  return pts.map(([r, y]) => ellipse(cx, cz, rx * r, rz * r, y0 + y * (y1 - y0), n));
}

/**
 * A box from x0..x1, z0..z1, y0..y1 with all its edges rounded by `r` (metres, at most half the shortest side): a
 * smaller box grown by a ball, sampled as a rounded rectangle at three heights for each of the top and bottom edges.
 */
export function roundedBoxRings(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, r: number): Ring[] {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (z1 - z0) / 2, (y1 - y0) / 2));
  const ix0 = x0 + r;
  const ix1 = x1 - r;
  const iz0 = z0 + r;
  const iz1 = z1 - r;
  // a rounded rectangle around the inner box, its corners grown by g: four quarter circles of 3 segments each
  const ring = (g: number, y: number): Ring => {
    const pts: [number, number][] = [];
    const corners: [number, number, number][] = [
      [ix1, iz0, -90],
      [ix1, iz1, 0],
      [ix0, iz1, 90],
      [ix0, iz0, 180],
    ];
    for (const [cx, cz, a0] of corners) {
      for (let s = 0; s <= 3; s++) {
        const a = ((a0 + s * 30) * Math.PI) / 180;
        pts.push([cx + Math.cos(a) * g, cz + Math.sin(a) * g]);
      }
    }
    return { pts, y };
  };
  const rings: Ring[] = [];
  for (const deg of [0, 45, 90]) {
    const a = (deg * Math.PI) / 180;
    rings.push(ring(r * Math.sin(a), y0 + r - r * Math.cos(a)));
  }
  for (const deg of [90, 45, 0]) {
    const a = (deg * Math.PI) / 180;
    rings.push(ring(r * Math.sin(a), y1 - r + r * Math.cos(a)));
  }
  return rings;
}
