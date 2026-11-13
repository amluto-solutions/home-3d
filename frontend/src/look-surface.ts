// Where the 3D view's colours end up in each look (#403): the neon colour of every colour role, and the shaders' mapping
// of a neon surface colour into a look, in plain TypeScript. viewer/theme.ts builds the shaders from these numbers and
// viewer/furniture.ts draws with the role colours; the editor shows a role's colour in the look without three.js.

import type { Theme } from "./themes.ts";

/** The neon colour of each role (and a lighter top for some), as the models are built; the looks map them in the shaders. */
export const ROLE_NEON = {
  body: 0x172238,
  bodyTop: 0x1d2b47,
  fabric: 0x1a2644,
  fabricTop: 0x22325a,
  cushion: 0x243661,
  wood: 0x19233c,
  woodTop: 0x202d4b,
  white: 0x1d2946,
  whiteTop: 0x26375e,
  metal: 0x2a3a60,
  dark: 0x0b111f,
  glass: 0x1c3a52,
  plant: 0x12302e,
  plantTop: 0x1a4540,
  pot: 0x1d2640,
  accent: 0x2b8fb3,
  paint: 0x2a4a78,
};

/**
 * The role colours the homely styles build with (#436, from NeonPlan 3D 3.1, MIT, (c) 2026 Mastershort): light bodies,
 * blue-grey fabric, wood, white, metal, glass, green plants. Real colours: the styles' shader only shades them.
 */
export const ROLE_NATURAL: typeof ROLE_NEON = {
  body: 0xe8e3db,
  bodyTop: 0xf2efe9,
  fabric: 0x8e97a5,
  fabricTop: 0xa4acb9,
  cushion: 0xb4bbc5,
  wood: 0xa67a52,
  woodTop: 0xbd9067,
  white: 0xedebe7,
  whiteTop: 0xf8f7f4,
  metal: 0x9da3ab,
  dark: 0x40454d,
  glass: 0xa9cfe0,
  plant: 0x4b8a49,
  plantTop: 0x66a861,
  pot: 0xcdbfae,
  accent: 0x2b8fb3,
  paint: 0x7f93ad,
};

/** Hex "#rrggbb" to 0–1 channels (black for anything else). */
const rgbOf = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", ""), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * A neon surface colour (0–1, linear as the shader sees it) in a palette style (#436): spread between the palette's dark
 * and light by its brightness (on a perceptual scale, so the dark neon tones still spread apart), with some of its
 * hue. The shader's mapping (viewer/theme.ts), before the style's light; signal colours stay when the style keeps them.
 */
export function paletteSurface(p: { dark: string; light: string; hue: number; lift: number; contrast: number }, c: [number, number, number], signal = true): [number, number, number] {
  if (signal && isSignal(c)) return c;
  const mx = Math.max(...c);
  const t = Math.min(1, Math.max(0, p.lift + Math.sqrt(Math.max(0, lumaOf(c))) * p.contrast * PALETTE_SPREAD));
  const dark = rgbOf(p.dark).map(srgbToLinear);
  const light = rgbOf(p.light).map(srgbToLinear);
  return dark.map((d, i) => {
    const g = d + (light[i] - d) * t;
    return g * (1 - p.hue) + g * (c[i] / Math.max(mx, 0.001)) * p.hue;
  }) as [number, number, number];
}

/** How far a palette's contrast spreads the neon brightness (its square root, 0–0.3 for the house's surfaces). */
export const PALETTE_SPREAD = 0.5;

const srgbToLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

/** The Day look's surface mapping (#86). */
export const DAY = { base: 0.22, gain: 5.8, max: 0.97, hue: 0.12 };

/** A neon surface colour (0–1) in the Day look: the shader's mapping. */
export function daySurface(c: [number, number, number]): [number, number, number] {
  const mx = Math.max(...c);
  const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const g = Math.min(DAY.max, Math.max(0, DAY.base + l * DAY.gain));
  return c.map((v) => g * (1 - DAY.hue) + g * (v / Math.max(mx, 0.001)) * DAY.hue) as [number, number, number];
}

/** Neon's contrast lift (#88): surfaces brighter than the floors (walls, then items) are lifted a notch, floors and
 * slabs stay as built, signal colours and lines are left alone. `neonSurface` is the shader's mapping, for tests. */
export const NEON_LIFT = { from: 0.105, gain: 54, max: 0.4 };

export function neonSurface(c: [number, number, number]): [number, number, number] {
  const mx = Math.max(...c);
  const mn = Math.min(...c);
  const sat = mx > 0 ? (mx - mn) / mx : 0;
  if (mx > 0.45 && sat > 0.45) return c;
  const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const k = 1 + Math.min(NEON_LIFT.max, Math.max(0, (l - NEON_LIFT.from) * NEON_LIFT.gain));
  return c.map((v) => v * k) as [number, number, number];
}

export const BLUEPRINT_FILL = { lo: [0.02, 0.06, 0.16], hi: [0.12, 0.28, 0.52] } as const;
const isSignal = (c: readonly number[]) => {
  const mx = Math.max(...c);
  const mn = Math.min(...c);
  return mx > 0.45 && (mx - mn) / mx > 0.45;
};
const lumaOf = (c: readonly number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/** A neon surface colour (0–1) in the High contrast look: the shader's mapping (signal colours stay). */
export function blueprintSurface(c: [number, number, number]): [number, number, number] {
  if (isSignal(c)) return c;
  const t = Math.min(1, Math.max(0, lumaOf(c) * 5));
  return BLUEPRINT_FILL.lo.map((lo, i) => lo + (BLUEPRINT_FILL.hi[i] - lo) * t) as [number, number, number];
}

/** A neon surface colour (0–1) in the Realistic look, off the floors: the shader's mapping (signal colours stay). */
export function realisticSurface(c: [number, number, number]): [number, number, number] {
  if (isSignal(c)) return c;
  const mx = Math.max(...c);
  const g = Math.min(0.86, Math.max(0, 0.3 + lumaOf(c) * 3.2));
  const base = [g, g * 0.97, g * 0.93];
  const hue = c.map((v, i) => v / Math.max(mx, 0.001) / [0.21, 0.4, 1.0][i]);
  const hm = Math.max(...hue, 1e-9);
  return base.map((b, i) => b * 0.5 + b * (hue[i] / hm) * 0.5) as [number, number, number];
}

/** Where a surface colour ends up in a look (0–1 in and out), floors and lines aside: what the contrast tests hold to the standard. */
export function themedSurface(theme: Theme, c: [number, number, number]): [number, number, number] {
  if (theme === "day") return isSignal(c) ? c : daySurface(c);
  if (theme === "blueprint") return blueprintSurface(c);
  if (theme === "realistic") return realisticSurface(c);
  return neonSurface(c);
}

/** A role's colour as the 3D view shows it in a look (#403), "#rrggbb": what an item part without a colour of its own has. */
export function roleInLook(role: string, look: Theme): string | null {
  const neon = (ROLE_NEON as Record<string, number>)[role];
  if (neon === undefined) return null;
  const c = themedSurface(look, [((neon >> 16) & 255) / 255, ((neon >> 8) & 255) / 255, (neon & 255) / 255]);
  return `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("")}`;
}
