// The house's shadow on the ground: every wall and roof face is laid down along the sun's rays onto the lawn. The
// union of those flat shapes is the shadow; it is drawn once into a small texture (overlaps do not darken twice)
// and only again when the sun has moved a little – no shadow maps, nothing per frame, light enough for tablets.

import type { Building, Vec2 } from "../model.ts";
import type { PlacedSurroundings } from "../surroundings.ts";
import type { RoofGeometry } from "./roof.ts";
import { triangulate } from "./geo.ts";

/** A shadow longer than this is left at this length (a low sun would stretch it over the whole plot). */
export const SHADOW_REACH = 40;

/**
 * The house's shadow as flat triangles (x, z per corner, six numbers a triangle) on the ground at height `ground`,
 * for a sun `elevation` degrees high whose light comes from the plan direction `toSun` (unit, x right, z down).
 */
export function houseShadow(b: Building, roofs: readonly RoofGeometry[], toSun: [number, number], elevation: number, ground: number): number[] {
  const out: number[] = [];
  if (elevation <= 0) return out;
  const reach = 1 / Math.tan((elevation * Math.PI) / 180);
  // a point at height y lands this far away from the sun
  const land = (x: number, y: number, z: number): [number, number] => {
    const d = Math.min(SHADOW_REACH, Math.max(0, y - ground) * reach);
    return [x - toSun[0] * d, z - toSun[1] * d];
  };
  const tri = (a: [number, number], b2: [number, number], c: [number, number]) => out.push(a[0], a[1], b2[0], b2[1], c[0], c[1]);
  for (const floor of b.floors) {
    for (const room of floor.rooms) {
      if (room.outdoor || room.points.length < 3) continue;
      const top = floor.elevation + (room.ceiling_height ?? floor.height);
      if (top <= ground) continue;
      const base = Math.max(ground, floor.elevation);
      const lo = room.points.map(([x, z]) => land(x, base, z));
      const hi = room.points.map(([x, z]) => land(x, top, z));
      for (const [i, j, k] of triangulate(room.points)) {
        tri(lo[i], lo[j], lo[k]);
        tri(hi[i], hi[j], hi[k]);
      }
      // each wall sweeps a band between where its foot and its top land
      for (let i = 0; i < room.points.length; i++) {
        const j = (i + 1) % room.points.length;
        tri(lo[i], lo[j], hi[j]);
        tri(lo[i], hi[j], hi[i]);
      }
    }
  }
  for (const roof of roofs) {
    const y0 = roof.floor.elevation + roof.base;
    const p = roof.solid.p;
    for (let i = 0; i + 8 < p.length; i += 9) {
      tri(land(p[i], y0 + p[i + 1], p[i + 2]), land(p[i + 3], y0 + p[i + 4], p[i + 5]), land(p[i + 6], y0 + p[i + 7], p[i + 8]));
    }
  }
  return out;
}

/** The box around the triangles (x0, z0, x1, z1), or null without any. */
export function shadowBox(tris: readonly number[]): [number, number, number, number] | null {
  if (!tris.length) return null;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < tris.length; i += 2) {
    x0 = Math.min(x0, tris[i]);
    x1 = Math.max(x1, tris[i]);
    z0 = Math.min(z0, tris[i + 1]);
    z1 = Math.max(z1, tris[i + 1]);
  }
  return [x0, z0, x1, z1];
}

/**
 * The shadows of plain blocks (the neighbours' houses from the map, #463): each stands on the ground and is `h` tall
 * above it, laid down along the sun's rays like the house (the same triangles, so overlaps do not darken twice).
 * Ported from NeonPlan 3D 3.3.0 (MIT, Mastershort).
 */
export function blockShadows(blocks: readonly { p: readonly Vec2[]; h: number }[], toSun: [number, number], elevation: number): number[] {
  const out: number[] = [];
  if (elevation <= 0) return out;
  const reach = 1 / Math.tan((elevation * Math.PI) / 180);
  for (const b of blocks) {
    if (b.p.length < 3 || b.h <= 0) continue;
    const d = Math.min(SHADOW_REACH, b.h * reach);
    const ring = b.p as Vec2[];
    const hi = ring.map(([x, z]) => [x - toSun[0] * d, z - toSun[1] * d] as Vec2);
    for (const [i, j, k] of triangulate(ring)) {
      out.push(ring[i][0], ring[i][1], ring[j][0], ring[j][1], ring[k][0], ring[k][1]);
      out.push(hi[i][0], hi[i][1], hi[j][0], hi[j][1], hi[k][0], hi[k][1]);
    }
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      out.push(ring[i][0], ring[i][1], ring[j][0], ring[j][1], hi[j][0], hi[j][1]);
      out.push(ring[i][0], ring[i][1], hi[j][0], hi[j][1], hi[i][0], hi[i][1]);
    }
  }
  return out;
}

/** How far beyond the house's own shadow the neighbours' shadows are drawn (m, #463). */
export const AROUND_SHADOW = 30;

/**
 * Adds the shadows of the neighbours' houses from the map to the house's (#463): only of those near the house, and only
 * as far as AROUND_SHADOW beyond its own shadow, where the shadow's picture is (so it keeps its sharpness for the
 * house's own shadow); none in the flat outlines mode. `rise`: how high the map's ground lies above the lawn the
 * shadow falls on. Returns the box of what is drawn.
 */
export function neighbourShadows(
  tris: number[],
  box: [number, number, number, number],
  around: PlacedSurroundings | null,
  toSun: [number, number],
  elevation: number,
  rise: number,
): [number, number, number, number] {
  if (!around?.buildings.length || around.flat) return box;
  const R = AROUND_SHADOW;
  const region: [number, number, number, number] = [box[0] - R, box[1] - R, box[2] + R, box[3] + R];
  const near = (p: Vec2) => p[0] > region[0] - R && p[0] < region[2] + R && p[1] > region[1] - R && p[1] < region[3] + R;
  const extra = blockShadows(
    around.buildings.filter((bd) => bd.p.some(near)).map((bd) => ({ p: bd.p, h: Math.max(0.1, rise + Math.max(1, bd.h)) })),
    toSun,
    elevation,
  );
  if (!extra.length) return box;
  for (const v of extra) tris.push(v);
  const all = shadowBox(tris)!;
  return [Math.max(all[0], region[0]), Math.max(all[1], region[1]), Math.min(all[2], region[2]), Math.min(all[3], region[3])];
}
