// The curved shell of a pack part (#252): a body lofted through cross-sections, for car bodies, boats, bath tubs and
// anything else a box with sloped sides cannot shape. The part gives its side view as stations `[z, bottom, top]` and,
// optionally, its plan view as `[z, width]`; between the stations both run as smooth curves (monotone cubics, so they
// never overshoot). Every cross-section is a rectangle with rounded corners (`round`), narrower at its top than at its
// bottom by `taper` (a car's tumblehome). All values are fractions of the part's box: z from its back (0) to its front
// (1), heights of its height, widths of its width. Pure geometry, no DOM; furniture.ts draws the triangles.

/** A point in local item coordinates: x across, y up, z depth (front +z). */
export type V3 = [number, number, number];

/** The fields of a shell part (packs.ts PackPart). */
export interface ShellPart {
  /** Side view: 2 to 16 stations [z, bottom, top], z not decreasing. */
  side?: [number, number, number][];
  /** Plan view: [z, width] points, the width a fraction of the part's width (default: the whole width all along). */
  plan?: [number, number][];
  /** Corner radius of the cross-sections as a fraction of their shorter side (0.01 to 0.5, default 0.25). */
  round?: number;
  /** Width at the top of a cross-section against its bottom (0.1 to 1.5, default 1): below 1 it leans in. */
  taper?: number;
}

/** "full" near the camera and on desktops; "low" on the tablet level (and for small shells). */
export type ShellDetail = "full" | "low";

/** The default side: a plain block, so a shell without stations still draws. */
const PLAIN_SIDE: [number, number, number][] = [
  [0, 0, 1],
  [1, 0, 1],
];

/**
 * A smooth curve through the points [x, y] (x not decreasing): a monotone cubic (Fritsch–Carlson) between them,
 * level beyond the ends. It passes through every point and never overshoots, so a shell stays inside its box.
 */
export function monotoneCurve(points: readonly (readonly number[])[]): (x: number) => number {
  // repeated x values: the last one wins (a step), which the curve takes as a very steep stretch
  const pts: [number, number][] = [];
  for (const [x, y] of points) {
    if (pts.length && x <= pts[pts.length - 1][0] + 1e-6) pts[pts.length - 1] = [Math.max(x, pts[pts.length - 1][0]), y];
    else pts.push([x, y]);
  }
  const n = pts.length;
  if (n === 0) return () => 1;
  if (n === 1) return () => pts[0][1];
  const delta: number[] = [];
  for (let i = 0; i + 1 < n; i++) delta.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const m: number[] = [delta[0]];
  for (let i = 1; i + 1 < n; i++) m.push(delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2);
  m.push(delta[n - 2]);
  for (let i = 0; i + 1 < n; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * delta[i];
      m[i + 1] = t * b * delta[i];
    }
  }
  return (x: number) => {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0;
    while (i + 2 < n && x > pts[i + 1][0]) i++;
    const h = pts[i + 1][0] - pts[i][0];
    const t = (x - pts[i][0]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * pts[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * pts[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** The shell's curves in the part's fractions: bottom, top and width along z, and where it starts and ends. */
export interface ShellCurves {
  z0: number;
  z1: number;
  bottom: (z: number) => number;
  top: (z: number) => number;
  width: (z: number) => number;
  /** The z of every station of the side and the plan within z0..z1, sorted. */
  stations: number[];
}

export function shellCurves(p: ShellPart): ShellCurves {
  const side = p.side?.length && p.side.length >= 2 ? p.side : PLAIN_SIDE;
  const bottom = monotoneCurve(side.map(([z, b]) => [z, b]));
  const top = monotoneCurve(side.map(([z, , t]) => [z, t]));
  const width = p.plan?.length ? monotoneCurve(p.plan) : () => 1;
  const z0 = clamp01(side[0][0]);
  const z1 = clamp01(Math.max(z0, side[side.length - 1][0]));
  const zs = new Set<number>([z0, z1]);
  for (const [z] of [...side, ...(p.plan ?? [])]) if (z > z0 && z < z1) zs.add(z);
  return {
    z0,
    z1,
    bottom: (z) => clamp01(bottom(z)),
    top: (z) => clamp01(Math.max(bottom(z), top(z))),
    width: (z) => clamp01(width(z)),
    stations: [...zs].sort((a, b) => a - b),
  };
}

/**
 * The z values the shell is cut at: its stations, and on "full" more between them, at most `step` apart (default a
 * sixteenth of the shell).
 */
export function shellStations(c: ShellCurves, detail: ShellDetail, step = (c.z1 - c.z0) / 16): number[] {
  const out: number[] = [];
  for (let i = 0; i < c.stations.length; i++) {
    const z = c.stations[i];
    out.push(z);
    const next = c.stations[i + 1];
    if (next === undefined || detail === "low") continue;
    const k = Math.ceil((next - z) / step - 1e-6);
    for (let j = 1; j < k; j++) out.push(z + ((next - z) * j) / k);
  }
  return out;
}

/** The width factor at a height t (0 bottom .. 1 top) of a cross-section: the widest is 1. */
function taperAt(taper: number, t: number): number {
  const lo = taper > 1 ? 1 / taper : 1;
  const hi = taper > 1 ? 1 : taper;
  return lo + (hi - lo) * t;
}

/**
 * The cross-section at z (in the part's fractions) as points (x, y) around its outline, in metres from the part's
 * centre line and the item's floor; `half` is the part's half width, y0/h the part's bottom and height. 12 points
 * (each corner a quarter circle of 2 segments) on "full", 8 (a chamfer) on "low".
 */
function section(p: ShellPart, c: ShellCurves, z: number, half: number, y0: number, h: number, detail: ShellDetail): [number, number][] {
  const yb = y0 + c.bottom(z) * h;
  const yt = y0 + c.top(z) * h;
  const hw = c.width(z) * half;
  const taper = p.taper ?? 1;
  const r = Math.min(hw, (yt - yb) / 2, Math.max(0, Math.min(0.5, p.round ?? 0.25)) * Math.min(2 * hw, yt - yb));
  const seg = detail === "low" ? 1 : 2;
  const pts: [number, number][] = [];
  // counter-clockwise seen from the front (+z): right bottom, right top, left top, left bottom
  const corners: [number, number, number][] = [
    [hw - r, yb + r, -90],
    [hw - r, yt - r, 0],
    [-hw + r, yt - r, 90],
    [-hw + r, yb + r, 180],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let s = 0; s <= seg; s++) {
      const a = ((a0 + (s * 90) / seg) * Math.PI) / 180;
      const y = cy + Math.sin(a) * r;
      const t = yt - yb > 1e-9 ? (y - yb) / (yt - yb) : 0;
      pts.push([(cx + Math.cos(a) * r) * taperAt(taper, t), y]);
    }
  }
  return pts;
}

/** A shell's rings in item metres: one per station, each the same number of points, from its back to its front. */
export interface ShellBox {
  /** Centre of the part across and in depth, metres. */
  cx: number;
  cz: number;
  /** Width, depth and the bottom and height of the part, metres. */
  w: number;
  d: number;
  y0: number;
  h: number;
}

export function shellRings(p: ShellPart, box: ShellBox, detail: ShellDetail): { z: number; pts: V3[] }[] {
  const c = shellCurves(p);
  // a small shell (a toy, a mirror) is cut coarsely whatever the level: nobody sees its facets
  const level: ShellDetail = Math.max(box.w, box.d, box.h) < 0.3 ? "low" : detail;
  // on "full" about 16 cuts along the shell, but none closer than 15 cm (a pillar's slice needs none between its ends)
  const span = c.z1 - c.z0;
  return shellStations(c, level, Math.max(span / 16, 0.15 / Math.max(1e-6, box.d))).map((zf) => {
    const z = box.cz + (zf - 0.5) * box.d;
    return { z, pts: section(p, c, zf, box.w / 2, box.y0, box.h, level).map(([x, y]): V3 => [box.cx + x, y, z]) };
  });
}

/**
 * The shell as triangles with their faces outwards (counter-clockwise seen from outside): bands between the rings
 * and a flat cap at each end. Degenerate triangles (an end that closes to a line) are left out.
 */
export function shellTriangles(p: ShellPart, box: ShellBox, detail: ShellDetail): [V3, V3, V3][] {
  const rings = shellRings(p, box, detail);
  const out: [V3, V3, V3][] = [];
  const add = (a: V3, b: V3, c: V3, out3: V3) => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (Math.hypot(nx, ny, nz) < 1e-10) return;
    out.push(nx * out3[0] + ny * out3[1] + nz * out3[2] < 0 ? [a, c, b] : [a, b, c]);
  };
  const centre = (pts: V3[]): V3 => {
    const n = pts.length;
    return [pts.reduce((s, q) => s + q[0], 0) / n, pts.reduce((s, q) => s + q[1], 0) / n, pts[0][2]];
  };
  for (let j = 0; j + 1 < rings.length; j++) {
    const A = rings[j].pts;
    const B = rings[j + 1].pts;
    const ca = centre(A);
    const cb = centre(B);
    const n = A.length;
    for (let i = 0; i < n; i++) {
      const a0 = A[i];
      const a1 = A[(i + 1) % n];
      const b0 = B[i];
      const b1 = B[(i + 1) % n];
      // outwards: from the centre line to the middle of the quad
      const mx = (a0[0] + a1[0] + b0[0] + b1[0]) / 4 - (ca[0] + cb[0]) / 2;
      const my = (a0[1] + a1[1] + b0[1] + b1[1]) / 4 - (ca[1] + cb[1]) / 2;
      const o: V3 = [mx, my, 0];
      add(a0, b0, b1, o);
      add(a0, b1, a1, o);
    }
  }
  const cap = (pts: V3[], dir: number) => {
    const c = centre(pts);
    for (let i = 0; i < pts.length; i++) add(c, pts[i], pts[(i + 1) % pts.length], [0, 0, dir]);
  };
  if (rings.length) {
    cap(rings[0].pts, -1);
    cap(rings[rings.length - 1].pts, 1);
  }
  return out;
}

/**
 * How far the shell reaches across at depth z and height y (both in the part's fractions), in metres from its centre
 * line, for a part box `w` wide and `h` high (metres: the corners are rounded in metres); null where the shell is not
 * (before its first station, above its top). The full-detail outline, for checks such as "no pillar stands out".
 */
export function shellHalfWidth(p: ShellPart, z: number, y: number, w: number, h: number): number | null {
  const c = shellCurves(p);
  if (z < c.z0 - 1e-9 || z > c.z1 + 1e-9) return null;
  const pts = section(p, c, z, w / 2, 0, h, "full");
  const at = y * h;
  let reach: number | null = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if ((a[1] - at) * (b[1] - at) > 0 || a[1] === b[1]) continue;
    const x = a[0] + ((b[0] - a[0]) * (at - a[1])) / (b[1] - a[1]);
    reach = Math.max(reach ?? 0, Math.abs(x));
  }
  return reach;
}
