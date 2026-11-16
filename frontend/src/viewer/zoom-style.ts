// The zoom style (#456, ported from NeonPlan 3D 3.2.0, MIT, (c) 2026 Mastershort): far away the house keeps the
// screen's style, zoomed in it blends into a second one, without a rebuild while zooming. The shader part lives in
// theme.ts (a second set of style uniforms, the blend and the room outline); this file holds the viewer's pure parts:
// how far the blend has come at a camera distance, the glide after the camera, the room outline for the shader, the
// second colour of a twin geometry. No Lit; three.js only for the geometry types.

import { BufferGeometry, Float32BufferAttribute } from "three";
import type { StyleDef } from "../looks.ts";
import type { Vec2 } from "../model.ts";
import { applyStyleUniforms, STYLE_LOOK, themeIndex, ZOOM_ATTRIBUTE, ZOOM_POLY_MAX, type ZoomUniforms } from "./theme.ts";

export { ZOOM_LATE_DEFAULT, zoomLateOf, type ZoomScope } from "../zoom-pref.ts";

/**
 * The camera distance in house radii where the blend starts and where it is full, from how late it sets in (0 early:
 * from about an opened floor on; 1 late: only close up in a room). The house view stands at about 1, a floor at
 * about 0.9, a room at 0.25–0.45.
 */
export function zoomRange(late: number): { far: number; near: number } {
  const s = Math.min(1, Math.max(0, late));
  const far = 0.9 - 0.5 * s;
  return { far, near: Math.max(0.12, far - 0.4) };
}

/** How far the blend should be at a camera distance (in house radii): 0 … 1, eased. */
export function zoomTarget(r: number, late: number): number {
  const { far, near } = zoomRange(late);
  const k = Math.min(1, Math.max(0, (far - r) / (far - near)));
  return k * k * (3 - 2 * k);
}

/** How slowly the colours follow the camera (ms): a quick flight into a room still turns over a second or so. */
export const ZOOM_TAU = 450;

/** One frame of the glide from `now` towards `want` (dt in ms); it lands on `want` when close. */
export function zoomGlide(now: number, want: number, dt: number): number {
  const d = want - now;
  return Math.abs(d) < 0.003 ? want : now + d * (1 - Math.exp(-Math.max(0, dt) / ZOOM_TAU));
}

/**
 * Whether a zoom style can show over a screen's style: not Realistic on either side (its lit twins are materials of
 * their own), and not the style shown anyway. The usable zoom style, else null.
 */
export function zoomUsable(far: StyleDef, near: StyleDef | null | undefined): StyleDef | null {
  if (!near || near.base === "realistic" || far.base === "realistic") return null;
  return JSON.stringify(near) === JSON.stringify(far) ? null : near;
}

/** The look index a style runs under (the classic looks their own, palettes and natural materials the styles'). */
export function lookIndexOf(s: StyleDef): number {
  return s.palette || s.natural ? STYLE_LOOK : themeIndex(s.base);
}

/** Puts the zoom style's numbers into its uniforms (no program changes). */
export function applyZoomStyle(z: ZoomUniforms, near: StyleDef): void {
  applyStyleUniforms(near, z.near);
  z.uZTheme.value = lookIndexOf(near);
  z.uZoomNat.value = near.natural ? 1 : 0;
}

/** Puts a room's outline into the shader (thinned to the corners it walks), or none: the blend applies everywhere. */
export function writeZoomMask(z: ZoomUniforms, points: readonly Vec2[] | null): void {
  if (!points || points.length < 3) {
    z.uZoomN.value = 0;
    return;
  }
  let pts = points;
  if (pts.length > ZOOM_POLY_MAX) {
    const step = pts.length / ZOOM_POLY_MAX;
    pts = Array.from({ length: ZOOM_POLY_MAX }, (_, i) => points[Math.floor(i * step)]);
  }
  pts.forEach((p, i) => z.uZoomPoly.value[i].set(p[0], p[1]));
  z.uZoomPoly.value[pts.length].set(pts[0][0], pts[0][1]);
  z.uZoomN.value = pts.length;
}

/** The world heights of the masked room's floor (floors move when they fan out). */
export function writeZoomLevel(z: ZoomUniforms, y: number, height: number): void {
  z.uZoomY.value.set(y - 0.01, y + height + 0.01);
}

/**
 * Gives every geometry in `own` the colours of its twin in `twin` as the second colour (found by the same key, or the
 * same place in a list), when both have as many vertices; one without a twin gets its own colours (the zoom style then
 * shades them as they are).
 */
export function pairColors(own: unknown, twin: unknown, depth = 0): void {
  if (!own || typeof own !== "object" || depth > 3) return;
  if (own instanceof BufferGeometry) {
    const a = own.getAttribute("color");
    const b = twin instanceof BufferGeometry ? twin.getAttribute("color") : undefined;
    const pa = own.getAttribute("position");
    const pb = twin instanceof BufferGeometry ? twin.getAttribute("position") : undefined;
    const paired = !!(b && pa && pb && pa.count === pb.count);
    const src = paired ? b : a;
    if (!src) return;
    // a twin's colours stay; an own colour is linked again each time (ensureZoomColors) when the colours are replaced
    own.userData.fp3dZoomTwin = paired;
    if (src.itemSize === 3) own.setAttribute(ZOOM_ATTRIBUTE, src);
    else {
      const arr = src.array as ArrayLike<number>;
      const out = new Float32Array(src.count * 3);
      for (let i = 0; i < src.count; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = arr[i * src.itemSize + k];
      own.setAttribute(ZOOM_ATTRIBUTE, new Float32BufferAttribute(out, 3));
    }
    return;
  }
  const other = twin && typeof twin === "object" ? (twin as Record<string, unknown>) : {};
  if (Array.isArray(own)) {
    own.forEach((x, i) => pairColors(x, Array.isArray(twin) ? twin[i] : undefined, depth + 1));
    return;
  }
  for (const key of Object.keys(own)) pairColors((own as Record<string, unknown>)[key], other[key], depth + 1);
}

/**
 * A floor's room tops in its twin's colours (the selection and the heatmap recolour them in both, viewer3d
 * applyHighlight): kept on the floor geometry when the twin has as many rooms.
 */
export function pairRoomColors(own: unknown, twin: unknown): void {
  type Tops = { floor?: BufferGeometry; roomTris?: { color: number }[] } | null;
  const o = own as Tops;
  const t = twin as Tops;
  if (!o?.floor || !o.roomTris || !t?.roomTris || t.roomTris.length !== o.roomTris.length || !o.floor.userData.fp3dZoomTwin) return;
  o.floor.userData.fp3dZoomRoomColors = t.roomTris.map((r) => r.color);
}

/**
 * A mesh's geometry built without a twin gets its own colours as the second colour (linked, so colours written in
 * place follow; linked again when the colour attribute is replaced).
 */
export function ensureZoomColors(geo: BufferGeometry | undefined): void {
  if (!geo || geo.userData.fp3dZoomTwin) return;
  const color = geo.getAttribute("color");
  const second = geo.getAttribute(ZOOM_ATTRIBUTE);
  if (!color || second === color || (second && color.itemSize !== 3)) return;
  pairColors(geo, null);
}
