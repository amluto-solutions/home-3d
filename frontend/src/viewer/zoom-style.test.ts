import assert from "node:assert/strict";
import { test } from "node:test";
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, MeshBasicMaterial } from "three";
import { setCustomStyles, styleById } from "../looks.ts";
import { ZOOM_LATE_DEFAULT, zoomChoices, zoomLateOf, zoomStyleOk } from "../zoom-pref.ts";
import { makeStyleUniforms, makeZoomUniforms, STYLE_LOOK, themed, themeIndex, ZOOM_ATTRIBUTE, ZOOM_POLY_MAX, zoomPattern, type ThemeUniform } from "./theme.ts";
import { applyZoomStyle, ensureZoomColors, pairColors, pairRoomColors, writeZoomMask, zoomGlide, zoomRange, zoomTarget, zoomUsable } from "./zoom-style.ts";

/** What the shader patch makes of a material: its onBeforeCompile run over the stock chunks' placeholders. */
function compiled(uniform: ThemeUniform, line = false, level: 0 | 1 | 2 = 1) {
  const m = themed(line ? new LineBasicMaterial({ vertexColors: true }) : new MeshBasicMaterial({ vertexColors: true }), uniform, line, line ? 0 : level);
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: "#include <common>\nvoid main() {\n#include <project_vertex>\n}", fragmentShader: "#include <common>\nvoid main() {\n#include <color_fragment>\n}" };
  m.onBeforeCompile(shader as never, null as never);
  return { m, shader };
}

test("without a zoom style the programs are exactly as before: same code, same key (#456)", () => {
  for (const [line, level] of [[false, 0], [false, 1], [false, 2], [true, 0]] as const) {
    const plain = compiled({ value: 0, style: makeStyleUniforms() }, line, level);
    const off = compiled({ value: 0, style: makeStyleUniforms(), zoom: makeZoomUniforms() }, line, level);
    assert.equal(off.shader.fragmentShader, plain.shader.fragmentShader);
    assert.equal(off.shader.vertexShader, plain.shader.vertexShader);
    assert.equal(off.m.customProgramCacheKey(), plain.m.customProgramCacheKey());
    assert.doesNotMatch(off.shader.fragmentShader, /uZoom|fp3dZ/);
  }
});

test("a zoom style compiles a second, renamed set of the style code and blends by a uniform (#456)", () => {
  const u: ThemeUniform = { value: 0, style: makeStyleUniforms(), zoom: makeZoomUniforms() };
  const off = compiled(u).m.customProgramCacheKey();
  u.zoom!.mode = 1;
  const { m, shader } = compiled(u);
  assert.notEqual(m.customProgramCacheKey(), off);
  const f = shader.fragmentShader;
  // both mappings, each with its own numbers
  assert.match(f, /vec3 fp3dThemed\(vec3 c, bool line\)/);
  assert.match(f, /vec3 fp3dZThemed\(vec3 c, bool line\)/);
  assert.match(f, /uZTheme == 4\) return fp3dZStyled/);
  assert.match(f, /uniform vec3 uZsDark;/);
  // declared once only (the floor level, the varyings): a second declaration would not compile
  assert.equal(f.match(/uniform float uFloorY;/g)?.length, 1);
  assert.equal(f.match(/uniform vec3 uStDark;/g)?.length, 1);
  assert.equal(f.match(/uniform int uTheme;/g)?.length, 1);
  // the blend and the room outline are uniforms; zooming changes numbers only
  assert.match(f, /float fp3dM = fp3dZoomAt\(vFp3dZW\);/);
  assert.match(f, new RegExp(`uniform vec2 uZoomPoly\\[${ZOOM_POLY_MAX + 1}\\]`));
  assert.equal(shader.uniforms.uZoom, u.zoom!.uZoom);
  assert.equal(shader.uniforms.uZsDark, u.zoom!.near.uStDark);
  assert.equal(shader.uniforms.uStDark, u.style!.uStDark);
  assert.match(shader.vertexShader, /vFp3dZW = \(modelMatrix \* vec4\(transformed, 1\.0\)\)\.xyz;/);
  // only mode 2 reads a second colour per vertex
  assert.doesNotMatch(shader.vertexShader, new RegExp(ZOOM_ATTRIBUTE));
  u.zoom!.mode = 2;
  const two = compiled(u);
  assert.match(two.shader.vertexShader, new RegExp(`attribute vec3 ${ZOOM_ATTRIBUTE};`));
  assert.match(two.shader.fragmentShader, /fp3dZThemed\(fp3dBase \* vFp3dColor2, false\)/);
  // lines fade like the style they show
  const line = compiled(u, true).shader.fragmentShader;
  assert.match(line, /diffuseColor\.a \*= mix\(/);
  assert.match(line, /vec3 fp3dZStyled\(vec3 c, bool line, float mx, float sat, bool tint\) \{ return uZsLine/);
});

test("the floor pattern fades under a natural zoom style only while one is on (#456)", () => {
  const u: ThemeUniform = { value: 0, zoom: makeZoomUniforms() };
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: "#include <common>\n#include <project_vertex>", fragmentShader: "#include <common>\n#include <opaque_fragment>" };
  zoomPattern(shader, u);
  assert.doesNotMatch(shader.fragmentShader, /uZoom/);
  u.zoom!.mode = 1;
  zoomPattern(shader, u);
  assert.match(shader.fragmentShader, /diffuseColor \*= 1\.0 - fp3dZoomAt\(vFp3dZW\) \* uZoomNat;/);
});

test("the blend sets in later with a later setting and is full close up; it glides after the camera (#456)", () => {
  const early = zoomRange(0);
  const late = zoomRange(1);
  assert.ok(late.far < early.far && late.near <= early.near);
  // the house view stays as it is, a room close up is fully in the zoom style
  for (const s of [0, 0.5, 0.7, 1]) {
    assert.equal(zoomTarget(1, s), 0);
    assert.equal(zoomTarget(0.05, s), 1);
  }
  assert.ok(zoomTarget(0.4, 0.2) > zoomTarget(0.4, 0.8));
  let m = 0;
  for (let i = 0; i < 3; i++) m = zoomGlide(m, 1, 16);
  assert.ok(m > 0 && m < 0.2, `after three frames ${m}`);
  for (let i = 0; i < 400; i++) m = zoomGlide(m, 1, 16);
  assert.equal(m, 1);
});

test("Realistic is never a zoom style nor under one; the same style is none (#456)", () => {
  const neon = styleById("neon")!;
  assert.equal(zoomUsable(neon, styleById("realistic")), null);
  assert.equal(zoomUsable(styleById("realistic")!, styleById("cozy")), null);
  assert.equal(zoomUsable(neon, styleById("neon")), null);
  assert.equal(zoomUsable(neon, styleById("synthwave"))?.id, "synthwave");
  assert.equal(zoomUsable(styleById("cozy")!, styleById("day"))?.id, "day");
  const u = makeZoomUniforms();
  applyZoomStyle(u, styleById("cozy")!);
  assert.equal(u.uZTheme.value, STYLE_LOOK);
  assert.equal(u.near.uStNatural.value, 1);
  assert.equal(u.uZoomNat.value, 1);
  applyZoomStyle(u, styleById("day")!);
  assert.equal(u.uZTheme.value, themeIndex("day"));
  assert.equal(u.uZoomNat.value, 0);
});

test("the room outline goes into the shader closed and thinned; none: everywhere (#456)", () => {
  const u = makeZoomUniforms();
  writeZoomMask(u, [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3],
  ]);
  assert.equal(u.uZoomN.value, 4);
  assert.deepEqual(u.uZoomPoly.value[4].toArray(), [0, 0]);
  const round = Array.from({ length: 100 }, (_, i) => [Math.cos(i / 16), Math.sin(i / 16)] as [number, number]);
  writeZoomMask(u, round);
  assert.equal(u.uZoomN.value, ZOOM_POLY_MAX);
  writeZoomMask(u, null);
  assert.equal(u.uZoomN.value, 0);
});

test("a twin's colours become the second colour where the vertices match; others keep their own (#456)", () => {
  const geo = (n: number, c: number) => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(new Array(n * 3).fill(0), 3));
    g.setAttribute("color", new Float32BufferAttribute(new Array(n * 3).fill(c), 3));
    return g;
  };
  const own = { floor: geo(3, 0.1), walls: geo(6, 0.1), lines: geo(2, 0.1), roomTris: [{ color: 0x112233 }] };
  const twin = { floor: geo(3, 0.8), walls: geo(5, 0.8), lines: geo(2, 0.8), roomTris: [{ color: 0xaabbcc }] };
  pairColors(own, twin);
  pairRoomColors(own, twin);
  assert.equal(own.floor.getAttribute(ZOOM_ATTRIBUTE), twin.floor.getAttribute("color"));
  assert.equal(own.lines.getAttribute(ZOOM_ATTRIBUTE), twin.lines.getAttribute("color"));
  // other vertices (a model drawn differently): its own colours
  assert.equal(own.walls.getAttribute(ZOOM_ATTRIBUTE), own.walls.getAttribute("color"));
  assert.deepEqual(own.floor.userData.fp3dZoomRoomColors, [0xaabbcc]);
  // a mesh built without a twin links its own colours, again when they are replaced
  const lamp = geo(3, 0.5);
  ensureZoomColors(lamp);
  assert.equal(lamp.getAttribute(ZOOM_ATTRIBUTE), lamp.getAttribute("color"));
  lamp.setAttribute("color", new Float32BufferAttribute(new Array(9).fill(0.2), 3));
  ensureZoomColors(lamp);
  assert.equal(lamp.getAttribute(ZOOM_ATTRIBUTE), lamp.getAttribute("color"));
  // a twin's colours stay
  ensureZoomColors(own.floor);
  assert.equal(own.floor.getAttribute(ZOOM_ATTRIBUTE), twin.floor.getAttribute("color"));
});

test("the zoom style's settings: late by default, any style but Realistic, own ones and the house's plan (#456)", () => {
  assert.equal(zoomLateOf(undefined), ZOOM_LATE_DEFAULT / 100);
  assert.equal(zoomLateOf("20"), 0.2);
  assert.equal(zoomLateOf(250), 1);
  assert.equal(zoomLateOf("x"), ZOOM_LATE_DEFAULT / 100);
  assert.ok(ZOOM_LATE_DEFAULT > 50);
  setCustomStyles([{ id: "my_abc", name: "Mine", base: "neon", palette: { line: "#ffffff", dark: "#000000", light: "#333333", hue: 0, lift: 0.1, contrast: 2 } }]);
  try {
    const values = zoomChoices().flatMap((g) => g.values);
    assert.equal(values[0], "");
    assert.ok(values.includes("house") && values.includes("cozy") && values.includes("my_abc") && values.includes("neon"));
    assert.ok(!values.includes("realistic") && !values.includes("theme") && !values.includes("auto"));
    assert.ok(zoomStyleOk("house") && zoomStyleOk("my_abc") && zoomStyleOk("synthwave"));
    assert.ok(!zoomStyleOk("realistic") && !zoomStyleOk("") && !zoomStyleOk("nonsense"));
  } finally {
    setCustomStyles([]);
  }
});
