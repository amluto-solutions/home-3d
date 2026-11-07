// Robot vacuum maps on the plan (#350): the maths and the reading of a map camera's attributes, shared by the 3D
// view's overlay (vacuum-maps.ts) and the editor's alignment (components/vacuum-panel.ts). No imports: the editor
// bundle carries only `isMapCamera` from here, the rest goes with the lazy chunks.
//
// Three coordinate systems meet:
// - vacuum: the robot's own map coordinates (millimetres for Dreame and Roborock; y points up on the map);
// - image: pixels of the camera's map picture (x right, y down);
// - plan: Home 3D's metres (x right, z down the plan).
// A map camera (dreame_vacuum's camera.<name>_map, or the Xiaomi Cloud Map Extractor's camera for Roborock and other
// Xiaomi robots) publishes `calibration_points`: three or more pairs {vacuum: {x, y}, map: {x, y}} that tie vacuum
// coordinates to image pixels (dreame_vacuum works its map rotation into them). That gives vacuum -> image. Vacuum ->
// plan comes from the plan: up to three pairs of a point on the map and the same point on the plan, picked once in the
// editor and stored with the map. Image -> plan is then vacuum -> plan after image -> vacuum.

/** An affine map [a, b, c, d, e, f] (the order of SVG's and CSS's matrix()): x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = [number, number, number, number, number, number];
export type Pt = [number, number];

/** The same point on the robot's map (`v`, vacuum coordinates) and on the plan (`p`, metres): picked in the editor. */
export interface MapPair {
  v: Pt;
  p: Pt;
}

/** Where the robot (and its heading, degrees in vacuum coordinates) or its dock is, in vacuum coordinates. */
export interface VacuumSpot {
  x: number;
  y: number;
  a: number | null;
}

/** What a map camera tells: vacuum -> image (null: no usable calibration yet), the robot and the dock. */
export interface MapCamera {
  calibration: Affine | null;
  robot: VacuumSpot | null;
  dock: VacuumSpot | null;
}

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

export function apply(m: Affine, p: Pt): Pt {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

/** Only the linear part (for a direction). */
export function applyDir(m: Affine, d: Pt): Pt {
  return [m[0] * d[0] + m[2] * d[1], m[1] * d[0] + m[3] * d[1]];
}

/** `outer` after `inner`: compose(outer, inner)(p) = outer(inner(p)). */
export function compose(outer: Affine, inner: Affine): Affine {
  const [a, b, c, d, e, f] = outer;
  const [A, B, C, D, E, F] = inner;
  return [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
}

export const det = (m: Affine): number => m[0] * m[3] - m[1] * m[2];

/** The inverse map; null when it squashes the plane (no inverse). */
export function invert(m: Affine): Affine | null {
  const k = det(m);
  if (!Number.isFinite(k) || Math.abs(k) < 1e-12) return null;
  const [a, b, c, d, e, f] = m;
  return [d / k, -b / k, -c / k, a / k, (c * f - d * e) / k, (b * e - a * f) / k];
}

/** The affine map taking three points onto three others; null when the first three lie on a line. */
export function affineFrom3(src: readonly Pt[], dst: readonly Pt[]): Affine | null {
  const [[x1, y1], [x2, y2], [x3, y3]] = src;
  const k = x1 * (y2 - y3) - y1 * (x2 - x3) + (x2 * y3 - x3 * y2);
  const span = Math.max(Math.abs(x1 - x2), Math.abs(x1 - x3), Math.abs(y1 - y2), Math.abs(y1 - y3), 1e-9);
  // nearly on a line (relative to how far apart they are): no trustworthy map
  if (!Number.isFinite(k) || Math.abs(k) < span * span * 1e-6) return null;
  const solve = (u1: number, u2: number, u3: number): [number, number, number] => [
    (u1 * (y2 - y3) - y1 * (u2 - u3) + (u2 * y3 - u3 * y2)) / k,
    (x1 * (u2 - u3) - u1 * (x2 - x3) + (x2 * u3 - x3 * u2)) / k,
    (x1 * (y2 * u3 - y3 * u2) - y1 * (x2 * u3 - x3 * u2) + u1 * (x2 * y3 - x3 * y2)) / k,
  ];
  const [a, c, e] = solve(dst[0][0], dst[1][0], dst[2][0]);
  const [b, d, f] = solve(dst[0][1], dst[1][1], dst[2][1]);
  return [a, b, c, d, e, f];
}

/**
 * The turn, uniform scale and shift taking two points onto two others; `mirror`: with a flip (the y axis turned over
 * first). Null when the two points are (nearly) the same.
 */
export function similarityFrom2(src: readonly Pt[], dst: readonly Pt[], mirror: boolean): Affine | null {
  const s = mirror ? src.map(([x, y]): Pt => [x, -y]) : src;
  const dx = s[1][0] - s[0][0];
  const dy = s[1][1] - s[0][1];
  const n = dx * dx + dy * dy;
  if (!(n > 1e-12)) return null;
  const ux = dst[1][0] - dst[0][0];
  const uy = dst[1][1] - dst[0][1];
  // as complex numbers: w = α·z + β
  const ar = (ux * dx + uy * dy) / n;
  const ai = (uy * dx - ux * dy) / n;
  const sim: Affine = [ar, ai, -ai, ar, dst[0][0] - (ar * s[0][0] - ai * s[0][1]), dst[0][1] - (ai * s[0][0] + ar * s[0][1])];
  return mirror ? compose(sim, [1, 0, 0, -1, 0, 0]) : sim;
}

/** vacuum -> image from a camera's `calibration_points` ({vacuum: {x, y}, map: {x, y}}, the first three); null if unusable. */
export function readCalibration(points: unknown): Affine | null {
  if (!Array.isArray(points) || points.length < 3) return null;
  const pt = (o: unknown): Pt | null => {
    const r = o as { x?: unknown; y?: unknown } | null;
    const x = Number(r?.x);
    const y = Number(r?.y);
    return r && Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  };
  const src: Pt[] = [];
  const dst: Pt[] = [];
  for (const p of points as { vacuum?: unknown; map?: unknown }[]) {
    const v = pt(p?.vacuum);
    const m = pt(p?.map);
    if (!v || !m) return null;
    src.push(v);
    dst.push(m);
  }
  return affineFrom3(src.slice(0, 3), dst.slice(0, 3));
}

/** A position attribute ({x, y, a}); null when it is missing or not numbers. */
export function readSpot(o: unknown): VacuumSpot | null {
  const r = o as { x?: unknown; y?: unknown; a?: unknown } | null | undefined;
  if (!r || typeof r !== "object") return null;
  const x = Number(r.x);
  const y = Number(r.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const a = r.a == null ? Number.NaN : Number(r.a);
  return { x, y, a: Number.isFinite(a) ? a : null };
}

/**
 * A map camera's attributes: dreame_vacuum (calibration_points, vacuum_position, charger_position) or the Xiaomi
 * Cloud Map Extractor (calibration_points, vacuum_position, charger).
 */
export function readMapCamera(attrs: Record<string, unknown> | undefined): MapCamera {
  const a = attrs ?? {};
  return { calibration: readCalibration(a.calibration_points), robot: readSpot(a.vacuum_position), dock: readSpot(a.charger_position ?? a.charger) };
}

/** A camera entity with a robot vacuum's map (it publishes calibration points). */
export function isMapCamera(id: string, attrs: Record<string, unknown> | undefined): boolean {
  return id.startsWith("camera.") && Array.isArray(attrs?.calibration_points);
}

/**
 * Vacuum -> plan from the picked pairs (the last three count). None: the picture upright, at its true size (the robots
 * count millimetres), its middle on `centre`. One: the same, shifted so that pair matches. Two: turned, scaled and
 * shifted (flipped as the calibration flips, so the picture is never shown mirrored). Three: an affine map through all
 * three (two that lie on a line with the third fall back to the first two).
 * `cal`: vacuum -> image, `size`: the picture's size in pixels.
 */
export function vacuumToPlan(cal: Affine, size: Pt, pairs: readonly MapPair[], centre: Pt, mmPerUnit = 1): Affine {
  const used = pairs.slice(-3);
  if (used.length >= 3) {
    const m = affineFrom3(used.map((p) => p.v), used.map((p) => p.p));
    if (m) return m;
  }
  if (used.length >= 2) {
    const two = used.slice(-2);
    const m = similarityFrom2(two.map((p) => p.v), two.map((p) => p.p), det(cal) < 0);
    if (m) return m;
  }
  // image -> plan: upright, metres per pixel from the calibration's scale (px per vacuum unit)
  const k = (mmPerUnit / 1000) / Math.sqrt(Math.abs(det(cal)) || 1);
  const base = compose([k, 0, 0, k, 0, 0], cal);
  if (used.length) {
    const at = apply(base, used[used.length - 1].v);
    const p = used[used.length - 1].p;
    return compose([1, 0, 0, 1, p[0] - at[0], p[1] - at[1]], base);
  }
  return compose([k, 0, 0, k, centre[0] - (k * size[0]) / 2, centre[1] - (k * size[1]) / 2], cal);
}

/** Image -> plan: where the picture's pixels lie on the plan (null without a usable calibration). */
export function imageToPlan(cal: Affine | null, size: Pt, pairs: readonly MapPair[], centre: Pt): Affine | null {
  const inv = cal && invert(cal);
  return cal && inv ? compose(vacuumToPlan(cal, size, pairs, centre), inv) : null;
}

/** A robot's or dock's place on the plan and its heading there (radians from +x towards +z; null: none reported). */
export function spotOnPlan(vp: Affine, s: VacuumSpot): { at: Pt; heading: number | null } {
  const at = apply(vp, [s.x, s.y]);
  if (s.a == null) return { at, heading: null };
  const r = (s.a * Math.PI) / 180;
  const d = applyDir(vp, [Math.cos(r), Math.sin(r)]);
  return { at, heading: Math.atan2(d[1], d[0]) };
}

/** The middle of a floor's rooms (where an unaligned map starts); the origin for a floor without rooms. */
export function floorCentre(rooms: readonly { points: readonly Pt[] }[]): Pt {
  const pts = rooms.flatMap((r) => r.points);
  if (!pts.length) return [0, 0];
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

/** The camera's picture through Home Assistant's camera proxy, signed in (an <img> cannot send the token). */
export async function fetchMapImage(hass: { fetchWithAuth?: (path: string, init?: RequestInit) => Promise<Response> } | undefined, camera: string, token?: unknown): Promise<Blob> {
  const path = `/api/camera_proxy/${camera}`;
  const res = hass?.fetchWithAuth ? await hass.fetchWithAuth(path) : await fetch(`${path}?token=${encodeURIComponent(String(token ?? ""))}`);
  if (!res.ok) throw new Error(`map ${camera}: ${res.status}`);
  return res.blob();
}
