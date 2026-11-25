// Looks of the 3D view. Geometry keeps its neon colours; a small shader patch maps them to the chosen
// look, so switching is instant and nothing has to be rebuilt. Signal colours (lit lamps, open windows,
// glowing screens) are bright and saturated and stay as they are in every look. The homely styles (#436) are the
// exception: the house is built once in natural colours (palette.ts) and this shader only shades them.

import { AdditiveBlending, Color, NormalBlending, Vector2, Vector3, type Material } from "three";
import { THEMES, type Theme } from "../themes.ts";
import { BLUEPRINT_FILL, DAY, NEON_LIFT, PALETTE_SPREAD, blueprintSurface, daySurface, neonSurface, realisticSurface, themedSurface } from "../look-surface.ts";
import type { StyleDef } from "../looks.ts";
import { FLOOR_LOOK, FLOOR_REAL } from "./build.ts";
import { outdoorLook } from "./outdoor.ts";
import { WALL_TINT } from "./palette.ts";

export type { Theme } from "../themes.ts";
// the surface mappings live in look-surface.ts (no three.js, #403); the tests and the lamp colours ask for them here
export { BLUEPRINT_FILL, blueprintSurface, daySurface, neonSurface, realisticSurface, themedSurface };

export interface ThemeUniform {
  value: number;
  /** The style's shader numbers of this view (#436): several views on a page each keep their own. */
  style?: StyleUniforms;
  /** The zoom style of this view (#456): the second style close up. Without it (or in mode 0) nothing of it is compiled. */
  zoom?: ZoomUniforms;
}

// ---- the zoom style (#456, ported from NeonPlan 3D 3.2.0, MIT, (c) 2026 Mastershort) ----
// Close up the house blends into a second style. Its shader numbers are a second set of the style uniforms (uZs…, the
// same code as the first set, renamed), so any style can be the far one; the blend and the room it is limited to are
// uniforms too: zooming changes numbers only, never a program. The house's own colours serve both styles, except
// where one of them builds it in natural materials and the other does not: then each vertex carries the other
// palette's colour as a second colour (ZOOM_ATTRIBUTE, mode 2).

/** Most corners of the room the zoom style is limited to (the shader walks them; more are thinned out). */
export const ZOOM_POLY_MAX = 24;

/** The second colour of every vertex while the two styles build the house in different palettes (mode 2). */
export const ZOOM_ATTRIBUTE = "fp3dColor2";

export interface ZoomUniforms {
  /** What the programs carry (read when they compile): 0 nothing, 1 the blend, 2 the blend with a second colour per vertex. */
  mode: 0 | 1 | 2;
  /** How far the blend has come (0 the view's own style, 1 the zoom style). */
  uZoom: { value: number };
  /** The zoom style's look index (as uTheme). */
  uZTheme: { value: number };
  /** The zoom style's shader numbers (named uZs… in the shader). */
  near: StyleUniforms;
  /** "Only the room": its outline's corner count (0: everywhere), the outline (closed), its floor's world heights. */
  uZoomN: { value: number };
  uZoomPoly: { value: Vector2[] };
  uZoomY: { value: Vector2 };
  /** 1 when the zoom style has natural materials (the neon floor pattern fades where it shows). */
  uZoomNat: { value: number };
}

export function makeZoomUniforms(): ZoomUniforms {
  return {
    mode: 0,
    uZoom: { value: 0 },
    uZTheme: { value: 0 },
    near: makeStyleUniforms(),
    uZoomN: { value: 0 },
    uZoomPoly: { value: Array.from({ length: ZOOM_POLY_MAX + 1 }, () => new Vector2()) },
    uZoomY: { value: new Vector2(-1e9, 1e9) },
    uZoomNat: { value: 0 },
  };
}

/** The zoom uniforms as the shader names them. */
function zoomShaderUniforms(z: ZoomUniforms): Record<string, { value: unknown }> {
  const out: Record<string, { value: unknown }> = { uZoom: z.uZoom, uZTheme: z.uZTheme, uZoomN: z.uZoomN, uZoomPoly: z.uZoomPoly, uZoomY: z.uZoomY, uZoomNat: z.uZoomNat };
  for (const [k, v] of Object.entries(z.near)) out[k.replace(/^uSt/, "uZs")] = v;
  return out;
}

/**
 * GLSL: the blend at a world point – uZoom everywhere, or with a room outline only inside it (and on its walls' faces,
 * which lie on the outline) and on its floor; 0 elsewhere.
 */
const ZOOM_AT = `
uniform float uZoom;
uniform int uZoomN;
uniform vec2 uZoomPoly[${ZOOM_POLY_MAX + 1}];
uniform vec2 uZoomY;
uniform float uZoomNat;
varying vec3 vFp3dZW;
float fp3dZoomAt(vec3 w) {
  if (uZoomN <= 0 || uZoom <= 0.0) return uZoom;
  if (w.y < uZoomY.x || w.y > uZoomY.y) return 0.0;
  vec2 p = w.xz;
  bool inside = false;
  float d = 1e9;
  vec2 a = uZoomPoly[0];
  for (int i = 1; i <= ${ZOOM_POLY_MAX}; i++) {
    if (i > uZoomN) break;
    vec2 b = uZoomPoly[i];
    if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    d = min(d, length(p - a - ab * t));
    a = b;
  }
  return inside || d < 0.03 ? uZoom : 0.0;
}`;

/** The second set's code: the style code of the first set with its names changed. */
const zoomRenamed = (glsl: string) =>
  glsl
    .replace(/\buSt(?=[A-Z])/g, "uZs")
    .replace(/\buTheme\b/g, "uZTheme")
    .replace(/\bfp3d(Styled|StyleLight|StyleFloor|StHash|Themed)\b/g, "fp3dZ$1");

/** The world position's varying for the room mask (vertex shader). */
function zoomVertex(vertexShader: string, mode: 1 | 2): string {
  return vertexShader
    .replace("#include <common>", `#include <common>\nvarying vec3 vFp3dZW;${mode === 2 ? `\nattribute vec3 ${ZOOM_ATTRIBUTE};\nvarying vec3 vFp3dColor2;` : ""}`)
    .replace("#include <project_vertex>", `#include <project_vertex>\nvFp3dZW = (modelMatrix * vec4(transformed, 1.0)).xyz;${mode === 2 ? `\nvFp3dColor2 = ${ZOOM_ATTRIBUTE};` : ""}`);
}

/**
 * The floor pattern under a zoom style (#456): it fades where a natural zoom style shows (the room, or everywhere). Only
 * with a zoom style on; the pattern's program is the same as before otherwise. Call it last in its onBeforeCompile.
 */
export function zoomPattern(shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }, theme: ThemeUniform): void {
  const z = theme.zoom;
  if (!z?.mode) return;
  Object.assign(shader.uniforms, zoomShaderUniforms(z));
  shader.vertexShader = zoomVertex(shader.vertexShader, 1);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${ZOOM_AT}`)
    .replace("#include <opaque_fragment>", `diffuseColor *= 1.0 - fp3dZoomAt(vFp3dZW) * uZoomNat;\n#include <opaque_fragment>`);
}

/** The pattern's program key part for the zoom style. */
export const zoomKey = (theme: ThemeUniform): string => (theme.zoom?.mode ? `-z${theme.zoom.mode}` : "");

export function themeIndex(theme: Theme): number {
  return THEMES.indexOf(theme);
}

// ---- styles (#436, ported from NeonPlan 3D 3.1, MIT, (c) 2026 Mastershort) ----
// Index 3 is our Realistic look, so the styles (a colour palette, or natural materials with cheap realism: light by
// direction, darker wall feet, floor structure, an evening mood) are index 4, driven by the uniforms below. Switching
// style changes numbers only: the shader is the same program for every look.

/** Look index of the styles (a palette or natural materials with their realism): driven by the style uniforms. */
export const STYLE_LOOK = 4;

/** A fresh set of a style's shader numbers (one per view). */
export function makeStyleUniforms() {
  return {
    uStLine: { value: new Vector3(0.55, 0.57, 0.6) },
    uStDark: { value: new Vector3(0.6, 0.58, 0.55) },
    uStLight: { value: new Vector3(0.95, 0.95, 0.94) },
    uStHue: { value: 0 },
    uStLift: { value: 0.3 },
    uStContrast: { value: 3 },
    uStSignal: { value: 1 },
    uStNatural: { value: 0 },
    uStSun: { value: 0 },
    uStAO: { value: 0 },
    uStDim: { value: 0 },
    uStFloors: { value: 0 },
  };
}
export type StyleUniforms = ReturnType<typeof makeStyleUniforms>;
/** The set of views that bring none of their own. */
export const styleUniforms = makeStyleUniforms();

/** "#rrggbb" as the shader's linear colour. */
const lin3 = (v: Vector3, hex: string) => {
  const c = new Color(hex);
  v.set(c.r, c.g, c.b);
};

/** Puts a style's numbers into the shader: no recompiling, it shows with the next frame. */
export function applyStyleUniforms(s: StyleDef, u: StyleUniforms = styleUniforms): void {
  const p = s.palette;
  if (p) {
    lin3(u.uStLine.value, p.line);
    lin3(u.uStDark.value, p.dark);
    lin3(u.uStLight.value, p.light);
    u.uStHue.value = p.hue;
    u.uStLift.value = p.lift;
    u.uStContrast.value = p.contrast * PALETTE_SPREAD;
  } else lin3(u.uStLine.value, s.base === "neon" ? "#4a4e56" : "#8d9198"); // natural materials: soft grey edges
  u.uStSignal.value = s.signal === false ? 0 : 1;
  u.uStNatural.value = s.natural ? 1 : 0;
  // kept with the style; the shader takes light by direction from the geometry's own shading (no derivatives)
  u.uStSun.value = s.sun ?? 0;
  u.uStAO.value = s.ao ?? 0;
  u.uStDim.value = s.natural ? (s.dim ?? 0) : 0;
  u.uStFloors.value = s.natural ? (s.floors ?? 0) : 0;
}

/** Where a floor lies in the world, per material (for the darker wall feet and the floor structure); -1000: none. */
export function floorLevelUniform(material: Material): { value: number } {
  const ud = material.userData as { fp3dFloorY?: { value: number } };
  return (ud.fp3dFloorY ??= { value: -1000 });
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

/**
 * The floors' structure (#436): only the floor material's program carries it (it is the costly part to compile: the
 * other surfaces get a stub that leaves them as they are).
 */
const FLOOR_STRUCTURE = `
float fp3dStHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// floors get their structure from the position alone: planks, tile joints or a fine grain, faded out with the
// distance so nothing shimmers from afar
float fp3dStyleFloor(vec3 c) {
  if (uStFloors <= 0.0 || uFloorY < -999.0 || abs(vFp3dStW.y - uFloorY) > 0.008) return 1.0;
  vec2 p = vFp3dStW.xz;
  float fade = (1.0 - smoothstep(12.0, 40.0, vFp3dStZ)) * uStFloors;
  if (fade <= 0.0) return 1.0;
  float mx = max(c.r, max(c.g, c.b));
  float sat = mx > 0.0 ? (mx - min(c.r, min(c.g, c.b))) / mx : 0.0;
  float k;
  if (c.r - c.b > 0.16 && sat > 0.2) {
    float w = 0.19;
    float L = 1.4;
    float row = floor(p.x / w);
    float off = fp3dStHash(vec2(row, 3.1)) * L;
    float seed = fp3dStHash(vec2(row, floor((p.y + off) / L)));
    float fx = fract(p.x / w) * w;
    float fz = fract((p.y + off) / L) * L;
    float seam = smoothstep(0.0, 0.006, min(fx, w - fx)) * smoothstep(0.0, 0.006, min(fz, L - fz));
    float grain = 0.965 + 0.035 * sin(p.y * 38.0 + seed * 25.0 + sin(p.x * 11.0 + seed * 6.0) * 2.5);
    k = (0.9 + 0.17 * seed) * grain * mix(0.78, 1.0, seam);
  } else if (sat < 0.12 && mx > 0.55) {
    float s = 0.6;
    vec2 f = fract(p / s) * s;
    float seam = smoothstep(0.0, 0.006, min(min(f.x, s - f.x), min(f.y, s - f.y)));
    k = (0.96 + 0.07 * fp3dStHash(floor(p / s))) * mix(0.72, 1.0, seam);
  } else {
    k = 0.965 + 0.05 * fp3dStHash(floor(p / 0.03));
  }
  return mix(1.0, k, fade);
}
`;
const NO_FLOOR_STRUCTURE = "float fp3dStyleFloor(vec3 c) { return 1.0; }";

/** Darker feet of walls and cabinets (#436): the floors' and walls' programs only (they carry the world position). */
const WALL_FEET = `
// darker feet of walls and cabinets: from a centimetre above the floor up to 45 cm (the floor itself stays)
float fp3dStyleLight() {
  float dy = vFp3dStW.y - uFloorY;
  if (uStAO <= 0.0 || uFloorY < -999.0 || dy < 0.01) return 1.0;
  return 1.0 - uStAO * (1.0 - smoothstep(0.01, 0.45, dy));
}`;
const NO_WALL_FEET = "float fp3dStyleLight() { return 1.0; }";

/** Where a material stands in the house (#436): 0 anything, 1 the walls with the items (wall feet), 2 the floors (and their structure). */
export type StyleLevel = 0 | 1 | 2;

/** The styles' shader code for surfaces (#436): lines take only their style colour, so their programs stay small. */
const STYLE_SURFACE = `
// No screen-space derivatives here (upstream takes the face's normal from them): on Chrome's Windows drivers they
// doubled the time the house's shaders take to compile. The geometry's colours already carry the light by direction
// (geo.ts shades each side by the way it faces), so the styles add the wall feet and the floor structure by height –
// only in the floors' and walls' programs, which alone carry the world position: every other one stays small.
__FP3D_LEVEL__
// the styles (#436): a palette over the neon colours, or the natural materials the house was built with, shaded
vec3 fp3dStyled(vec3 c, bool line, float mx, float sat, bool tint) {
  // written without branches (selects only): the house's programs compile faster so
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float k = fp3dStyleLight();
  // natural materials: neon leftovers the natural palette does not reach (devices, small parts) turn a neutral grey -
  // not on the walls: they have no leftovers, and a wall painted dark blue turned grey, or grey where it is shaded (#522);
  // shaded, with the floors' structure; in the evening the house dims warm
#ifdef FP3D_WALL
  vec3 cc = c;
#else
  vec3 cc = (!tint && mx < 0.2 && c.b > c.r * 2.0 && c.b > c.g * 1.5) ? vec3(0.32 + l * 1.4) : c;
#endif
  vec3 nat = cc * (k * fp3dStyleFloor(cc)) * mix(vec3(1.0), vec3(0.62, 0.52, 0.42), uStDim) * (1.0 - 0.75 * uStDim);
  // a palette: dark to light by the neon brightness, with some of its hue
  vec3 g = mix(uStDark, uStLight, clamp(uStLift + sqrt(l) * uStContrast, 0.0, 1.0));
  vec3 pal = mix(g, g * (c / max(mx, 0.001)), uStHue) * k;
  // lit lamps (their shade is a signal colour, lamp-colors.ts litShade), screens and open windows keep their colour,
  // unshaded and undimmed (upstream marks lit shades per vertex for this, #1071) – but not the green of plants
  bool signal = mx > 0.45 && sat > 0.45 && !(c.g > c.r * 1.25 && c.g > c.b * 1.25) && !tint && (uStNatural == 1 || uStSignal == 1);
  return signal ? c : uStNatural == 1 ? nat : pal;
}
`;
const STYLE_LINE = `vec3 fp3dStyled(vec3 c, bool line, float mx, float sat, bool tint) { return uStLine * clamp(mx * 1.4, 0.55, 1.0); }`;

const GLSL = `
uniform int uTheme;
uniform vec3 uAccent;
uniform int uAccentOn;
// the realistic look: how much a signal colour lights itself (lit lamps, open windows, screens glow in the light)
float fp3dGlow = 0.0;
${FLOOR_GLSL}
${DAY_FLOOR_GLSL}
${DAY_LAWN_GLSL}
__FP3D_LOOK__`;

/** The style uniforms' declarations (the zoom style declares them a second time, renamed). */
const ST_DECL = `uniform vec3 uStLine;
uniform vec3 uStDark;
uniform vec3 uStLight;
uniform float uStHue;
uniform float uStLift;
uniform float uStContrast;
uniform int uStSignal;
uniform int uStNatural;
uniform float uStAO;
uniform float uStDim;
uniform float uStFloors;`;

/** Mapping a colour to a look: the look index in uTheme, a style's numbers in uSt… (the zoom style has its own copy). */
const THEMED_FN = `vec3 fp3dThemed(vec3 c, bool line) {
  // a wall colour (#437, geo.ts pushPrism) is marked by its offset: take it off; the natural styles and Realistic let it through
  bool tint = !line && c.r > ${WALL_TINT - 0.5};
  if (tint) c -= vec3(${WALL_TINT.toFixed(1)});
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = mx > 0.0 ? (mx - mn) / mx : 0.0;
  if (uTheme == ${STYLE_LOOK}) return fp3dStyled(c, line, mx, sat, tint);
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
    // the walls' own shading and the lights darken it: a notch up, like the floors' colours
    if (tint) return min(c * 1.3, vec3(1.0));
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
 * Maps a material's colours to the look in `uniform` (0 neon, 1 blueprint, 2 day, 3 realistic, 4 a style). Composes with an
 * existing onBeforeCompile (e.g. the fold patch). `line`: edges are mapped as lines. `level`: the floors' (2) and the walls'
 * (1) materials, the only ones with the styles' wall feet and floor structure (#436).
 */
export function themed<T extends Material>(material: T, uniform: ThemeUniform, line = false, level: StyleLevel = 0): T {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.uniforms.uTheme = uniform;
    shader.uniforms.uAccent = accentUniform;
    shader.uniforms.uAccentOn = accentOnUniform;
    Object.assign(shader.uniforms, uniform.style ?? styleUniforms);
    const placed = !line && level > 0;
    if (placed) {
      shader.uniforms.uFloorY = floorLevelUniform(material);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vFp3dStW;\nvarying float vFp3dStZ;`)
        .replace("#include <project_vertex>", `#include <project_vertex>\nvFp3dStW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvFp3dStZ = -mvPosition.z;`);
    }
    const levelDecl = placed ? `uniform float uFloorY;\nvarying vec3 vFp3dStW;\nvarying float vFp3dStZ;\n` : "";
    const levelFns = placed ? `${WALL_FEET}\n${level === 2 ? FLOOR_STRUCTURE : NO_FLOOR_STRUCTURE}` : `${NO_WALL_FEET}\n${NO_FLOOR_STRUCTURE}`;
    const styled = (fns: string) => (line ? STYLE_LINE : STYLE_SURFACE.replace("__FP3D_LEVEL__", fns));
    const look = `${ST_DECL}\n${styled(levelDecl + levelFns)}\n${THEMED_FN}`;
    const l = line ? "true" : "false";
    const z = uniform.zoom;
    if (!z?.mode) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${GLSL.replace("__FP3D_LOOK__", look)}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>\n  diffuseColor.rgb = fp3dThemed(diffuseColor.rgb, ${l});${line ? "\n  if (uTheme == 3) diffuseColor.a *= 0.22;\n  if (uTheme == 4 && uStNatural == 1) diffuseColor.a *= 0.6;" : ""}`,
        );
      return;
    }
    // the zoom style (#456): both styles' mappings, blended by the uniform (one branch for the whole frame while the
    // blend is at an end; both only while it runs, or along the room's outline)
    Object.assign(shader.uniforms, zoomShaderUniforms(z));
    shader.vertexShader = zoomVertex(shader.vertexShader, z.mode);
    const near = zoomRenamed(`uniform int uTheme;\n${ST_DECL}\n${styled(levelFns)}\n${THEMED_FN}`);
    const nearIn = z.mode === 2 ? "fp3dBase * vFp3dColor2" : "fp3dIn";
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GLSL.replace("__FP3D_LOOK__", look)}\n${near}\n${ZOOM_AT}${z.mode === 2 ? "\nvarying vec3 vFp3dColor2;" : ""}`)
      .replace(
        "#include <color_fragment>",
        `${z.mode === 2 ? "vec3 fp3dBase = diffuseColor.rgb;\n" : ""}#include <color_fragment>
  float fp3dM = fp3dZoomAt(vFp3dZW);
  vec3 fp3dIn = diffuseColor.rgb;
  if (fp3dM < 1.0) diffuseColor.rgb = fp3dThemed(fp3dIn, ${l});
  if (fp3dM > 0.0) {
    vec3 fp3dNear = fp3dZThemed(${nearIn}, ${l});
    diffuseColor.rgb = fp3dM >= 1.0 ? fp3dNear : mix(diffuseColor.rgb, fp3dNear, fp3dM);
  }${line ? "\n  diffuseColor.a *= mix((uTheme == 3 ? 0.22 : 1.0) * (uTheme == 4 && uStNatural == 1 ? 0.6 : 1.0), uZTheme == 4 && uZsNatural == 1 ? 0.6 : 1.0, fp3dM);" : ""}`,
      );
  };
  material.customProgramCacheKey = () => `${key()}-themed-${line ? "l" : "s"}${line ? "" : level || ""}${zoomKey(uniform)}`;
  // the realistic look gives themed surfaces a lit twin (realism.ts); lines stay as they are
  material.userData.fp3dThemed = line ? "line" : "surface";
  return material;
}

/** Additive glow disappears on light backgrounds: in the day and realistic looks and on natural materials, lines are drawn normally. */
export function lineBlending(theme: Theme, natural = false): typeof AdditiveBlending | typeof NormalBlending {
  return natural || theme === "day" || theme === "realistic" ? NormalBlending : AdditiveBlending;
}
