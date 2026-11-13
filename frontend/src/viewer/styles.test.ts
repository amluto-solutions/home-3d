import assert from "node:assert/strict";
import { test } from "node:test";
import { MeshBasicMaterial, NormalBlending, AdditiveBlending } from "three";
import { contrast } from "../scheme.ts";
import { ROLE_NATURAL, ROLE_NEON, paletteSurface } from "../look-surface.ts";
import { STYLES, styleById } from "../looks.ts";
import { THEMES } from "../themes.ts";
import { FLOOR_LOOK, FLOOR_REAL, NEON } from "./build.ts";
import { furnitureLook } from "./furniture.ts";
import { litShade } from "./lamp-colors.ts";
import { naturalPalette, palette, paletteKey, setNaturalPalette } from "./palette.ts";
import { applyStyleUniforms, lineBlending, makeStyleUniforms, STYLE_LOOK, themed, themeIndex, type ThemeUniform } from "./theme.ts";

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const unitLin = (n: number): [number, number, number] => [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)) * 255).toString(16).padStart(2, "0")).join("")}`;

/** What the shader patch makes of a material: its onBeforeCompile run over the stock chunks' placeholders. */
function patched(uniform: ThemeUniform, line = false) {
  // a wall: it carries the world position the wall feet need
  const m = themed(new MeshBasicMaterial({ vertexColors: true }), uniform, line, 1);
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: "#include <common>\nvoid main() {\n#include <project_vertex>\n}", fragmentShader: "#include <common>\nvoid main() {\n#include <color_fragment>\n}" };
  m.onBeforeCompile(shader as never, null as never);
  return { m, shader };
}

test("Every built-in style has a look index the shader knows; the styles are index 4, after our Realistic (#436)", () => {
  assert.equal(STYLE_LOOK, THEMES.length);
  assert.equal(themeIndex("realistic"), 3);
  for (const s of STYLES) {
    const index = s.palette || s.natural ? STYLE_LOOK : themeIndex(s.base);
    assert.ok(index >= 0 && index <= STYLE_LOOK, s.id);
    // the classic looks and Realistic keep their own index: Realistic stays as it was
    if (["neon", "blueprint", "day", "realistic"].includes(s.id)) assert.equal(index, themeIndex(s.id as never), s.id);
  }
});

test("A style is shader numbers only: one program for every style, each view with numbers of its own (#436)", () => {
  const a: ThemeUniform = { value: 0, style: makeStyleUniforms() };
  const b: ThemeUniform = { value: 0, style: makeStyleUniforms() };
  const pa = patched(a);
  const pb = patched(b);
  const key = pa.m.customProgramCacheKey();
  applyStyleUniforms(styleById("cozy")!, a.style);
  applyStyleUniforms(styleById("synthwave")!, b.style);
  a.value = b.value = STYLE_LOOK;
  // the program does not change with the style …
  assert.equal(pa.m.customProgramCacheKey(), key);
  assert.equal(pb.m.customProgramCacheKey(), key);
  // … and each view's shader reads its own numbers
  assert.equal(pa.shader.uniforms.uStNatural, a.style!.uStNatural);
  assert.equal(pb.shader.uniforms.uStNatural, b.style!.uStNatural);
  assert.equal(a.style!.uStNatural.value, 1);
  assert.equal(b.style!.uStNatural.value, 0);
  assert.ok(a.style!.uStDim.value === 0 && styleById("evening")!.dim! > 0);
  // the world position the cheap realism needs comes from the vertex shader
  assert.match(pa.shader.vertexShader, /vFp3dStW = \(modelMatrix \* vec4\(transformed, 1\.0\)\)\.xyz;/);
  assert.match(pa.shader.fragmentShader, new RegExp(`uTheme == ${STYLE_LOOK}\\) return fp3dStyled`));
  // the realistic look's branch is still there as it was
  assert.match(pa.shader.fragmentShader, /if \(uTheme == 3\) \{/);
});

test("Natural styles' numbers: the evening dims, the floors get their structure; palettes switch both off (#436)", () => {
  const u = makeStyleUniforms();
  applyStyleUniforms(styleById("evening")!, u);
  assert.ok(u.uStDim.value > 0.5 && u.uStFloors.value === 1 && u.uStSun.value > 0 && u.uStAO.value > 0);
  applyStyleUniforms(styleById("model")!, u);
  assert.equal(u.uStNatural.value, 0);
  assert.equal(u.uStDim.value, 0);
  assert.equal(u.uStFloors.value, 0);
});

test("Lines are drawn normally on natural materials and in the light looks, added in neon (#436)", () => {
  assert.equal(lineBlending("neon", true), NormalBlending);
  assert.equal(lineBlending("neon"), AdditiveBlending);
  assert.equal(lineBlending("day"), NormalBlending);
});

test("The natural palette builds with real colours while it is on, and every cache keys on it (#436)", () => {
  try {
    assert.equal(naturalPalette(), false);
    const neonWall = NEON.wall;
    const neonLook = furnitureLook();
    setNaturalPalette(true, 0x34373d);
    assert.notEqual(NEON.wall, neonWall);
    assert.equal(NEON.wallTop, 0x34373d);
    for (const k of Object.keys(FLOOR_REAL)) assert.equal(FLOOR_LOOK[k].color, FLOOR_REAL[k], k);
    assert.notEqual(paletteKey(), "");
    assert.notEqual(furnitureLook(), neonLook);
    setNaturalPalette(true, null);
    assert.equal(NEON.wallTop, 0xf7f5f1);
    const p = palette({ a: 1 }, { a: 2 });
    assert.equal(p.a, 2);
    setNaturalPalette(false);
    assert.equal(p.a, 1);
    assert.equal(NEON.wall, neonWall);
    assert.equal(paletteKey(), "");
  } finally {
    setNaturalPalette(false);
  }
});

test("Natural furniture has a colour for every role, and the roles stay apart (#436)", () => {
  assert.deepEqual(Object.keys(ROLE_NATURAL).sort(), Object.keys(ROLE_NEON).sort());
  const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
  // wood and fabric read against the light walls
  assert.ok(contrast(hex(ROLE_NATURAL.wood), "#f0ede8") >= 2.5);
  assert.ok(contrast(hex(ROLE_NATURAL.fabric), "#f0ede8") >= 2.5);
});

test("Palette styles spread the neon colours: items stand off the walls, light palettes stay light, dark ones dark (#436)", () => {
  const wall = unitLin(0x131d31);
  const metal = unitLin(ROLE_NEON.metal);
  // brighter neon stays brighter in every palette (the light ones are light on purpose and stand apart by a little,
  // the light by direction does the rest)
  for (const s of STYLES.filter((x) => x.palette)) {
    const w = toHex(paletteSurface(s.palette!, wall));
    const m = toHex(paletteSurface(s.palette!, metal));
    assert.ok(contrast(m, "#000000") > contrast(w, "#000000") && contrast(w, m) >= 1.03, `${s.id}: metal against a wall ${contrast(w, m).toFixed(2)}`);
  }
  const lum = (h: string) => contrast(h, "#000000");
  assert.ok(lum(toHex(paletteSurface(styleById("model")!.palette!, wall))) > 10);
  assert.ok(lum(toHex(paletteSurface(styleById("focus")!.palette!, wall))) < 2);
  // a lit lamp keeps its colour
  assert.deepEqual(paletteSurface(styleById("model")!.palette!, [1, 0.6, 0.1]), [1, 0.6, 0.1]);
});

test("Lit lamp shades are signal colours, so the homely styles draw them unshaded and undimmed, even a warm white (#436, upstream #1071)", () => {
  for (const [color, level] of [[[1, 1, 1], 1], [[1, 0.9, 0.7], 0.3], [[0.2, 0.3, 1], 0.6]] as const) {
    const c = litShade(color, level);
    const mx = Math.max(...c);
    const sat = (mx - Math.min(...c)) / mx;
    assert.ok(mx > 0.45 && sat > 0.45, `${color} at ${level}`);
    // and not the green of plants, which the styles shade like any surface
    assert.ok(!(c[1] > c[0] * 1.25 && c[1] > c[2] * 1.25), `${color} reads as a plant`);
  }
});

test("Floor structure is compiled into the floors' program only; the other surfaces get a stub (#436)", () => {
  const u: ThemeUniform = { value: 0, style: makeStyleUniforms() };
  const floor = themed(new MeshBasicMaterial({ vertexColors: true }), u, false, 2);
  const wall = themed(new MeshBasicMaterial({ vertexColors: true }), u, false, 1);
  const other = themed(new MeshBasicMaterial({ vertexColors: true }), u);
  const run = (m: MeshBasicMaterial) => {
    const shader = { uniforms: {}, vertexShader: "#include <common>\n#include <project_vertex>", fragmentShader: "#include <common>\n#include <color_fragment>" };
    m.onBeforeCompile(shader as never, null as never);
    return shader.fragmentShader;
  };
  assert.match(run(floor), /float w = 0\.19/);
  assert.doesNotMatch(run(wall), /float w = 0\.19/);
  assert.match(run(wall), /smoothstep\(0\.01, 0\.45, dy\)/);
  // anything else carries no world position: its program stays small
  assert.doesNotMatch(run(other), /vFp3dStW|uFloorY/);
  assert.equal(new Set([floor, wall, other].map((m) => m.customProgramCacheKey())).size, 3);
  // no screen-space derivatives in the styles' code: they doubled the compile time of the house's shaders
  assert.doesNotMatch(run(floor), /dFdx|fwidth/);
});
