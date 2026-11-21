// The neighbourhood from OpenStreetMap in 3D (#463, see ../surroundings.ts): the neighbours' houses as blocks of their
// height with soft edges, streets, paths, railways and streams as flat ribbons, parks, woods and water as flat areas,
// single trees as small stacked crowns. It is built once, as a mesh of its own that the viewer hangs into the ground
// floor's group with the floor's materials (so every style colours it); nothing moves, nothing is drawn per frame, and
// an edit of the house does not build it again.
// Ported from NeonPlan 3D 3.4.1 (MIT, Mastershort).

import { Color, type BufferGeometry } from "three";
import type { Vec2 } from "../model.ts";
import { signedArea } from "../model.ts";
import type { PlacedSurroundings } from "../surroundings.ts";
import { gableHouse } from "../surround-roof.ts";
import { ALWAYS, GeoBuffer, LineBuffer, pushPrism, shade, triangulate } from "./geo.ts";
import { palette } from "./palette.ts";

/** The colours: the neon ones (the looks and palette styles recolour them in the shader) and the homely styles' ones. */
const LOOK = palette(
  {
    side: 0x111730,
    top: 0x18213d,
    edge: 0x5b7cff,
    edgeAlpha: 0.38,
    road: 0x121827,
    path: 0x19213a,
    rail: 0x22182e,
    water: 0x0b3a5a,
    green: 0x0d2620,
    wood: 0x0a1f18,
    trunk: 0x2a2238,
    crown: 0x16402f,
    crownEdge: 0x3de0a0,
    crownAlpha: 0.22,
  },
  {
    side: 0xe4dfd7,
    top: 0xd3cdc4,
    edge: 0x5b7cff,
    edgeAlpha: 0.08,
    road: 0x8f8d89,
    path: 0xc9c1b3,
    rail: 0x8a7f74,
    water: 0x7fb6d6,
    green: 0x9cc083,
    wood: 0x7aa265,
    trunk: 0x7a5a3e,
    crown: 0x5f8f4e,
    crownEdge: 0x3de0a0,
    crownAlpha: 0.05,
  },
);

/**
 * How far below the ground each flat layer lies (m). Centimetres apart, the areas lowest, then wood, water, paths and
 * streets on top: millimetres apart they flickered against each other from afar (the depth buffer cannot tell them
 * apart at 100 m). Below the ground nothing of the house covers them, and the garden drawn in the plan lies above.
 */
export const AREA_Y = { green: -0.12, wood: -0.1, water: -0.08 } as const;
export const WAY_Y = { water: -0.065, path: -0.05, rail: -0.04, road: -0.025 } as const;
/** The outline of a neighbour's house in the flat mode: its floor, and its edge just above it. */
export const FLAT_Y = -0.012;
/** The deepest layer (the lawn of the realistic look lies below it when there is a map). */
export const DEEPEST = Math.min(...Object.values(AREA_Y), ...Object.values(WAY_Y), FLAT_Y);

/** How many map pieces are drawn between two pauses (the floor is modelled in slices, slices.ts). */
const STEP = 48;

const ccw = (p: Vec2[]): Vec2[] => (signedArea(p) >= 0 ? p : [...p].reverse());

/** A flat polygon at height y, facing up (no sides). */
function flat(buf: GeoBuffer, poly: Vec2[], y: number, color: Color): void {
  if (poly.length < 3) return;
  const ring = ccw(poly);
  // wound like a prism's top (a, c, b): facing up
  for (const [i, j, k] of triangulate(ring)) buf.tri([ring[i][0], y, ring[i][1]], [ring[k][0], y, ring[k][1]], [ring[j][0], y, ring[j][1]], color, color, color, undefined, ALWAYS);
}

/** A regular polygon around a point (n corners, radius r). */
function disc(c: Vec2, r: number, n = 8): Vec2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r] as Vec2;
  });
}

/** A line of width w as a flat ribbon: a quad per segment and a disc at each bend, so bends have no gaps. */
function ribbon(buf: GeoBuffer, pts: Vec2[], w: number, y: number, color: Color): void {
  const h = w / 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-3) continue;
    const nx = (-(bz - az) / len) * h;
    const nz = ((bx - ax) / len) * h;
    flat(buf, [[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]], y, color);
  }
  for (let i = 1; i + 1 < pts.length; i++) flat(buf, disc(pts[i], h, 8), y, color);
}

/** The neighbourhood as one floor's buffers draw it: its triangles and its edges, standing on `ground`. */
export function* surroundingsSteps(buf: GeoBuffer, lines: LineBuffer, s: PlacedSurroundings, ground: number): Generator<void, void, void> {
  const L = LOOK;
  let n = 0;
  const pause = () => ++n % STEP === 0;
  for (const a of s.areas) {
    flat(buf, a.p, ground + AREA_Y[a.k], new Color(L[a.k]));
    if (pause()) yield;
  }
  for (const w of s.ways) {
    ribbon(buf, w.p, Math.max(0.6, w.w), ground + WAY_Y[w.k], new Color(L[w.k]));
    if (pause()) yield;
  }
  const edge = shade(L.edge, L.edgeAlpha);
  for (const b of s.buildings) {
    if (b.p.length < 3) continue;
    const poly = ccw(b.p);
    if (s.flat) {
      // only the outline on the ground: a faint floor and a brighter edge (no blocks, no shadows)
      const outline = shade(L.edge, Math.min(1, L.edgeAlpha * 1.8));
      flat(buf, poly, ground + FLAT_Y, new Color(L.top));
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        lines.seg([p[0], ground + FLAT_Y / 2, p[1]], [q[0], ground + FLAT_Y / 2, q[1]], outline, ALWAYS);
      }
    } else {
      const gable = s.roofs ? gableHouse(poly, b.h) : null;
      if (gable) {
        // one piece per slope: walls up to the eaves and into the gables, the slope as its top
        const roofY = (x: number, z: number) => ground + gable.height(x, z);
        for (const half of gable.halves) {
          pushPrism(buf, half, ground, roofY, L.side, L.top, { aoFrom: ground, skipSide: (p, q) => gable.onRidge(p) && gable.onRidge(q) });
          for (let i = 0; i < half.length; i++) {
            const p = half[i];
            const q = half[(i + 1) % half.length];
            lines.seg([p[0], roofY(p[0], p[1]), p[1]], [q[0], roofY(q[0], q[1]), q[1]], edge, ALWAYS);
            if (!gable.onRidge(p)) lines.seg([p[0], ground, p[1]], [p[0], roofY(p[0], p[1]), p[1]], edge, ALWAYS);
          }
        }
        if (pause()) yield;
        continue;
      }
      const top = ground + Math.max(1, b.h);
      pushPrism(buf, poly, ground, top, L.side, L.top, { aoFrom: ground });
      // the edges: the outline at the top and the corners down to the ground
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        lines.seg([p[0], top, p[1]], [q[0], top, q[1]], edge, ALWAYS);
        lines.seg([p[0], ground, p[1]], [p[0], top, p[1]], edge, ALWAYS);
      }
    }
    if (pause()) yield;
  }
  const crownEdge = shade(L.crownEdge, L.crownAlpha);
  for (const t of s.trees) {
    pushPrism(buf, disc(t, 0.18, 6), ground, ground + 1.8, L.trunk, L.trunk, { aoFrom: ground });
    // three stacked crowns, the widest at the bottom
    for (const [r, y0, y1] of [
      [1.8, 1.6, 3.0],
      [1.3, 3.0, 4.1],
      [0.7, 4.1, 4.9],
    ] as const) {
      const ring = disc(t, r, 8);
      pushPrism(buf, ring, ground + y0, ground + y1, L.crown, L.crown, { aoFrom: ground });
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        const q = ring[(i + 1) % ring.length];
        lines.seg([p[0], ground + y1, p[1]], [q[0], ground + y1, q[1]], crownEdge, ALWAYS);
      }
    }
    if (pause()) yield;
  }
}

/**
 * The neighbourhood's geometry, standing on `ground` (the ground floor's ground, in its coordinates): its triangles and
 * its edges, drawn in steps (the viewer runs them in short slices, slices.ts) and kept by the viewer until the map,
 * the north, the hidden houses or the palette change – an edit of the house never draws it again.
 */
export function* surroundingsGeometry(s: PlacedSurroundings, ground: number): Generator<void, { solid: BufferGeometry; lines: BufferGeometry }, void> {
  const buf = new GeoBuffer();
  const lines = new LineBuffer();
  yield* surroundingsSteps(buf, lines, s, ground);
  yield;
  const solid = buf.geometry();
  yield;
  return { solid, lines: lines.geometry() };
}
