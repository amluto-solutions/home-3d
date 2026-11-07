import assert from "node:assert/strict";
import { test } from "node:test";
import { recolorLamps, shadeFactors } from "./lamp-colors.ts";

test("sentinel vertices become shade factors, body vertices stay at 0", () => {
  // two triangles: a shaded side (factor 0.7), a top (factor 1), a body vertex and a dark body vertex
  const colors = [0, 0.7, 0, 0, 1, 0, 0.16, 0.22, 0.38, 0, 0, 0, 0.04, 0.1, 0.2, 0, 0.55, 0];
  const f = shadeFactors(colors);
  assert.deepEqual([...f].map((v) => Math.round(v * 100) / 100), [0.7, 1, 0, 0, 0, 0.55]);
});

test("recolouring writes the light's colour times the factor into the lamp's range only", () => {
  const colors = new Float32Array([0, 0.5, 0, 0, 1, 0, 0.1, 0.1, 0.1, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const factors = shadeFactors(colors);
  // range in triangles: the first triangle (vertices 0..2) belongs to the lamp, the second to another
  recolorLamps(colors, factors, { start: 0, end: 1 }, [1, 0.5, 0.2]);
  assert.deepEqual([...colors.slice(0, 3)].map((v) => Math.round(v * 100) / 100), [0.5, 0.25, 0.1]);
  assert.deepEqual([...colors.slice(3, 6)].map((v) => Math.round(v * 100) / 100), [1, 0.5, 0.2]);
  // the body vertex keeps its colour
  assert.deepEqual([...colors.slice(6, 9)].map((v) => Math.round(v * 100) / 100), [0.1, 0.1, 0.1]);
  // the other lamp is untouched
  assert.deepEqual([...colors.slice(9, 12)], [0, 1, 0]);
  // channels never exceed 1
  recolorLamps(colors, factors, { start: 1, end: 2 }, [1.5, 1.2, 1]);
  assert.deepEqual([...colors.slice(9, 12)], [1, 1, 1]);
});

// ---- a lit lamp reads against an unlit one in every look (#216) ----
import { contrast } from "../scheme.ts";
import { litShade, LIT_MIN_LUMINANCE, relLuminance, UNLIT_SHADE } from "./lamp-colors.ts";
import { themedSurface, type Theme } from "./theme.ts";
import { THEMES } from "../themes.ts";

const hexOf = (c: ArrayLike<number>) => `#${[0, 1, 2].map((i) => Math.round(Math.min(1, Math.max(0, c[i])) * 255).toString(16).padStart(2, "0")).join("")}`;
const unit = (n: number): [number, number, number] => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const LIGHTS: [string, number[]][] = [
  ["warm white", [1, 0.83, 0.42]],
  ["white", [1, 1, 1]],
  ["cool white", [0.8, 0.9, 1]],
  ["blue", [0, 0, 1]],
  ["red", [1, 0, 0]],
  ["green", [0, 1, 0]],
  ["orange", [1, 0.5, 0]],
  ["violet", [0.5, 0, 1]],
];

for (const theme of THEMES as Theme[]) {
  test(`${theme}: every lit shade stands off the unlit one by 3:1, dimmest and brightest (#216)`, () => {
    const unlit = hexOf(themedSurface(theme, unit(UNLIT_SHADE[theme])));
    for (const [name, color] of LIGHTS) {
      for (const level of [0, 0.5, 1]) {
        const lit = litShade(color, level);
        const shown = hexOf(themedSurface(theme, lit));
        assert.ok(contrast(shown, unlit) >= 3, `${name} at ${level} on ${theme}: ${contrast(shown, unlit).toFixed(2)}`);
      }
    }
  });
}

test("a lit shade is a signal colour the looks leave as it is, whatever the light's colour and level (#216)", () => {
  for (const [name, color] of LIGHTS) {
    for (const level of [0, 1]) {
      const lit = litShade(color, level);
      const mx = Math.max(...lit);
      // the side faces of a lamp are 0.7 of the top: still a signal colour there
      assert.ok(mx * 0.7 > 0.45, `${name} bright enough`);
      assert.ok((mx - Math.min(...lit)) / mx > 0.45, `${name} saturated enough`);
      assert.ok(relLuminance(lit) >= LIT_MIN_LUMINANCE - 0.005, `${name} luminance ${relLuminance(lit).toFixed(2)}`);
    }
  }
});

test("a brighter light shows a brighter shade (#216)", () => {
  const dim = litShade([1, 0.83, 0.42], 0);
  const full = litShade([1, 0.83, 0.42], 1);
  assert.ok(relLuminance(full) > relLuminance(dim));
});
