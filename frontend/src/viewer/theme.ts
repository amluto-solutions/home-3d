// Looks of the 3D view. Geometry keeps its neon colours; a small shader patch maps them to the chosen
// look, so switching is instant and nothing has to be rebuilt. Signal colours (lit lamps, open windows,
// glowing screens) are bright and saturated and stay as they are in every look.

import { AdditiveBlending, Color, NormalBlending, Vector3, type Material } from "three";
import { THEMES, type Theme } from "../themes.ts";
import { BLUEPRINT_FILL, DAY, NEON_LIFT, blueprintSurface, daySurface, neonSurface, realisticSurface, themedSurface } from "../look-surface.ts";
import { FLOOR_LOOK, FLOOR_REAL } from "./build.ts";
import { outdoorLook } from "./outdoor.ts";

export type { Theme } from "../themes.ts";
// the surface mappings live in look-surface.ts (no three.js, #403); the tests and the lamp colours ask for them here
export { BLUEPRINT_FILL, blueprintSurface, daySurface, neonSurface, realisticSurface, themedSurface };

export interface ThemeUniform {
  value: number;
}

export function themeIndex(theme: Theme): number {
  return THEMES.indexOf(theme);
}

/** The neon look's accent (lines, cyan surfaces): the stock cyan, or a colour of the user's choice. */
export const accentUniform = { value: new Vector3(0.22, 0.88, 1) };
export const accentOnUniform = { value: 0 };

/** "#rrggbb" to the 0–1 colour the shader uses, null for anything else. */
export function parseAccent(hex: string | null | undefined): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const vec3 = (hex: number) => {
  const c = new Color(hex);
  return `vec3(${c.r.toFixed(6)}, ${c.g.toFixed(6)}, ${c.b.toFixed(6)})`;
};

/** Realistic floors (#39): each neon floor tint (exactly as built) becomes its material's own colour; -1 for any other colour. */
const FLOOR_GLSL = `vec3 fp3dFloor(vec3 c) {
${Object.entries(FLOOR_REAL)
  .map(([k, real]) => `  if (distance(c, ${vec3(FLOOR_LOOK[k].color)}) < 0.0002) return ${vec3(real)};`)
  .join("\n")}
  return vec3(-1.0);
}`;

/** The Day look (#86): surfaces lighten by their neon luminance (so slabs, walls and items keep apart), floors take
 * their material's colour, lines are dark navy. `daySurface` is the shader's mapping in TypeScript, for tests. */
export const DAY_LINE: [number, number, number] = [0.04, 0.09, 0.22];
/** Day floors: the realistic material colours, drawn a little towards the Day look's cool grey. */
const DAY_FLOOR_TINT = 0xa8b4c6;
const DAY_FLOOR_MIX = 0.25;

const mixHex = (a: number, b: number, t: number) =>
  [16, 8, 0].reduce((out, sh) => out | (Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t) << sh), 0);

/**
 * The lightest a Day floor gets (WCAG relative luminance): the Day walls are pale, so a pale floor (the tiles) melted
 * into them at 1.1:1 (#194). Under this every floor stands off the walls by at least 1.5:1.
 */
export const DAY_FLOOR_MAX_LUM = 0.4;
/** The Day lawn (#194): a mid green, dark enough to stand off the pale Day ground by 3:1 (the generic mapping made it near-white). */
export const DAY_LAWN = 0x3f7d4f;

const srgbLin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const lumOf = (hex: number) => 0.2126 * srgbLin(((hex >> 16) & 255) / 255) + 0.7152 * srgbLin(((hex >> 8) & 255) / 255) + 0.0722 * srgbLin((hex & 255) / 255);
/** A colour darkened (towards black) until its relative luminance is at most `max`. */
function capLuminance(hex: number, max: number): number {
  let out = hex;
  for (let i = 0; i < 40 && lumOf(out) > max; i++) out = mixHex(out, 0, 0.03);
  return out;
}

/** The Day floor colour for a neon floor tint (exactly as built), null for any other colour. */
export function dayFloor(neon: number): number | null {
  const k = Object.keys(FLOOR_LOOK).find((m) => FLOOR_LOOK[m].color === neon);
  return k && FLOOR_REAL[k] !== undefined ? capLuminance(mixHex(FLOOR_REAL[k], DAY_FLOOR_TINT, DAY_FLOOR_MIX), DAY_FLOOR_MAX_LUM) : null;
}

/** The Day colour of a lawn (its neon tint, exactly as built), null for any other colour. */
export function dayLawn(neon: number): number | null {
  return neon === outdoorLook("lawn").color ? DAY_LAWN : null;
}

/**
 * The High contrast look (the Blueprint look, offered as "High contrast", #88; held to 7:1 in #216): pure white lines on
 * fills kept under a relative luminance of 0.1, so every edge reads at 7:1 (WCAG AAA) on every fill, floor, lawn and sky.
 */
export const BLUEPRINT_LINE: [number, number, number] = [1, 1, 1];
const glslVec = (c: readonly number[]) => `vec3(${c.map((v) => v.toFixed(3)).join(", ")})`;

const DAY_FLOOR_GLSL = `vec3 fp3dDayFloor(vec3 c) {
${Object.keys(FLOOR_REAL)
  .map((k) => `  if (distance(c, ${vec3(FLOOR_LOOK[k].color)}) < 0.0002) return ${vec3(dayFloor(FLOOR_LOOK[k].color)!)};`)
  .join("\n")}
  return vec3(-1.0);
}`;

const DAY_LAWN_GLSL = `vec3 fp3dDayLawn(vec3 c) {
  if (distance(c, ${vec3(outdoorLook("lawn").color)}) < 0.0002) return ${vec3(DAY_LAWN)};
  return vec3(-1.0);
}`;

const GLSL = `
uniform int uTheme;
uniform vec3 uAccent;
uniform int uAccentOn;
// the realistic look: how much a signal colour lights itself (lit lamps, open windows, screens glow in the light)
float fp3dGlow = 0.0;
${FLOOR_GLSL}
${DAY_FLOOR_GLSL}
${DAY_LAWN_GLSL}
vec3 fp3dThemed(vec3 c, bool line) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = mx > 0.0 ? (mx - mn) / mx : 0.0;
  if (uTheme == 0) {
    // an own accent: every line and every cyan surface takes it, as bright as it was
    if (uAccentOn == 1 && (line || (sat > 0.35 && c.r < c.g * 0.8 && c.b > c.g * 0.85 && c.g > c.b * 0.6))) return uAccent * mx;
    // a notch more light on walls and items than on the floors (#88); signal colours and lines as built
    if (line || (mx > 0.45 && sat > 0.45)) return c;
    float lift = dot(c, vec3(0.299, 0.587, 0.114));
    return c * (1.0 + clamp((lift - ${NEON_LIFT.from}) * ${NEON_LIFT.gain.toFixed(1)}, 0.0, ${NEON_LIFT.max}));
  }
  // signal colours keep their colour
  if (!line && mx > 0.45 && sat > 0.45) return c;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  if (uTheme == 3) {
    // realistic (#39): the lights do the shading; surfaces get light, warm colours, edges are faint dark lines and
    // bright signal colours glow. The neon's navy cast is taken out of the hue, so its navy surfaces turn neutral
    // while a green lawn or a brown floor keeps some of its colour.
    if (line) return vec3(0.08, 0.09, 0.11);
    vec3 floorTint = fp3dFloor(c);
    if (floorTint.r >= 0.0) return floorTint;
    if (mx > 0.45 && sat > 0.45) {
      fp3dGlow = smoothstep(0.85, 1.0, mx) * 0.9;
      return c;
    }
    vec3 hue = (c / max(mx, 0.001)) / vec3(0.21, 0.4, 1.0);
    hue /= max(hue.r, max(hue.g, hue.b));
    vec3 g = vec3(clamp(0.3 + l * 3.2, 0.0, 0.86)) * vec3(1.0, 0.97, 0.93);
    return mix(g, g * hue, 0.5);
  }
  if (uTheme == 1) {
    // high contrast (#216): pure white lines on dark blue fills, 7:1 on every one
    if (line) return ${glslVec(BLUEPRINT_LINE)};
    return mix(${glslVec(BLUEPRINT_FILL.lo)}, ${glslVec(BLUEPRINT_FILL.hi)}, clamp(l * 5.0, 0.0, 1.0));
  }
  // day (#86): dark navy lines; floors in their material's colour; other surfaces lighten by their neon luminance,
  // spread wide so slabs, walls and items stand apart, with a little of their hue
  if (line) return vec3(${DAY_LINE.join(", ")}) * clamp(mx * 1.6, 0.75, 1.0);
  vec3 dayFloor = fp3dDayFloor(c);
  if (dayFloor.r >= 0.0) return dayFloor;
  vec3 dayLawn = fp3dDayLawn(c);
  if (dayLawn.r >= 0.0) return dayLawn;
  vec3 g = vec3(clamp(${DAY.base.toFixed(3)} + l * ${DAY.gain.toFixed(3)}, 0.0, ${DAY.max.toFixed(3)}));
  return mix(g, g * (c / max(mx, 0.001)), ${DAY.hue.toFixed(3)});
}
`;

/**
 * Maps a material's colours to the look in `uniform` (0 neon, 1 blueprint, 2 day, 3 realistic). Composes with an
 * existing onBeforeCompile (e.g. the fold patch). `line`: edges are mapped as lines.
 */
export function themed<T extends Material>(material: T, uniform: ThemeUniform, line = false): T {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.uniforms.uTheme = uniform;
    shader.uniforms.uAccent = accentUniform;
    shader.uniforms.uAccentOn = accentOnUniform;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GLSL}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\n  diffuseColor.rgb = fp3dThemed(diffuseColor.rgb, ${line ? "true" : "false"});${line ? "\n  if (uTheme == 3) diffuseColor.a *= 0.22;" : ""}`,
      );
  };
  material.customProgramCacheKey = () => `${key()}-themed-${line ? "l" : "s"}`;
  // the realistic look gives themed surfaces a lit twin (realism.ts); lines stay as they are
  material.userData.fp3dThemed = line ? "line" : "surface";
  return material;
}

/** Additive glow disappears on light backgrounds: in the day and realistic looks, lines are drawn normally. */
export function lineBlending(theme: Theme): typeof AdditiveBlending | typeof NormalBlending {
  return theme === "day" || theme === "realistic" ? NormalBlending : AdditiveBlending;
}
