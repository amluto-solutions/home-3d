// Lamp shades are built with a sentinel colour, so the colour of the light can be written into the
// merged lamp mesh later without rebuilding it (colour effects change several times per second).

/** Pure green: no body colour has r = b = 0, so sentinel vertices are told apart by that. */
export const SHADE_SENTINEL = 0x00ff00;

/** Shade factor per vertex: the green channel of sentinel-coloured vertices (r = b = 0), else 0. */
export function shadeFactors(colors: ArrayLike<number>): Float32Array {
  const n = colors.length / 3;
  const out = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const g = colors[v * 3 + 1];
    if (colors[v * 3] === 0 && colors[v * 3 + 2] === 0 && g > 0) out[v] = g;
  }
  return out;
}

/** Write a shade colour into a lamp's triangle range, scaled by each vertex's factor; bodies stay. */
export function recolorLamps(colors: Float32Array, factors: Float32Array, range: { start: number; end: number }, color: [number, number, number]): void {
  for (let v = range.start * 3; v < range.end * 3; v++) {
    const f = factors[v];
    if (f <= 0) continue;
    colors[v * 3] = Math.min(1, color[0] * f);
    colors[v * 3 + 1] = Math.min(1, color[1] * f);
    colors[v * 3 + 2] = Math.min(1, color[2] * f);
  }
}

// ---- the lit and unlit shade (#216) ----
// A lit shade must read against an unlit one at a glance in every look (3:1, WCAG 1.4.11). Lit shades are signal
// colours (the looks leave them as they are); unlit shades are dark in every look, so the pair holds for any light.

/** The unlit shade's neon colour per look: dark after the look's own mapping (black is mapped to the look's darkest tone). */
export const UNLIT_SHADE: Record<"neon" | "blueprint" | "day" | "realistic", number> = {
  neon: 0x1d2946,
  blueprint: 0x000000,
  day: 0x000000,
  realistic: 0x000000,
};

/** The least a lit shade's brightness drops to (a dim light still reads as lit). */
const LIT_MIN = 0.7;
/** A lit shade's least relative luminance: a deep blue or red glow is lifted towards white until it reaches it. */
export const LIT_MIN_LUMINANCE = 0.25;
const LIT_MIN_SATURATION = 0.6;
/** The least saturation a lit shade keeps (the looks leave colours above 0.45 alone). */
const LIT_SIGNAL_SATURATION = 0.52;
/** What a white or colourless light shows as: a warm white. */
const WARM: [number, number, number] = [1, 0.83, 0.42];

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
/** WCAG relative luminance of an sRGB colour given as 0–1 channels. */
export function relLuminance(c: ArrayLike<number>): number {
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

/**
 * The colour of a lit lamp shade (0–1 channels): the light's colour at `level` (0–1), kept a saturated, bright signal
 * colour (the looks' shader leaves those alone) with a relative luminance of at least {@link LIT_MIN_LUMINANCE}.
 */
export function litShade(color: ArrayLike<number>, level: number): [number, number, number] {
  const k = LIT_MIN + (1 - LIT_MIN) * Math.min(1, Math.max(0, level));
  let c = [0, 1, 2].map((i) => Math.min(1, color[i] * k));
  const mx = Math.max(...c);
  const mn = Math.min(...c);
  if (mx <= 0 || mx - mn < 0.05 * mx) {
    // a colourless light is a warm white
    c = WARM.map((v) => v * (mx > 0 ? mx : k));
  } else if ((mx - mn) / mx < LIT_MIN_SATURATION) {
    // a pale light gets the saturation of a signal colour
    const s = LIT_MIN_SATURATION / ((mx - mn) / mx);
    c = c.map((v) => Math.max(0, mx - (mx - v) * s));
  }
  // a dark glow (deep blue, red) gets brighter: at full strength, its weaker channels lifted as far as a signal colour allows
  if (relLuminance(c) < LIT_MIN_LUMINANCE) {
    const top = Math.max(...c);
    c = c.map((v) => v / top);
    const cap = 1 - LIT_SIGNAL_SATURATION;
    for (let i = 0; i < 40 && relLuminance(c) < LIT_MIN_LUMINANCE; i++) c = c.map((v) => (v >= 1 ? v : Math.min(cap, v + 0.02)));
  }
  return c as [number, number, number];
}
