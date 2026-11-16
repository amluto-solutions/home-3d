import assert from "node:assert/strict";
import { test } from "node:test";
import { CustomBlending, OneFactor, OneMinusDstColorFactor } from "three";
import { coneLook, coneMaterial } from "./cone-material.ts";

test("light cones write premultiplied colour with an alpha of their own, so light over nothing shows (#1114)", () => {
  const m = coneMaterial(false);
  assert.equal(m.blending, CustomBlending);
  // the alpha is added, never zeroed: a colour with alpha 0 is dropped by desktop Chrome
  assert.equal(m.blendSrcAlpha, OneFactor);
  assert.equal(m.blendDstAlpha, OneFactor);
  assert.equal(m.blendSrc, OneFactor);
  assert.equal(m.blendDst, OneFactor);
  const shader = { fragmentShader: "void main() {\n#include <dithering_fragment>\n}" };
  m.onBeforeCompile?.(shader as never, null as never);
  assert.match(shader.fragmentShader, /gl_FragColor = vec4\(gl_FragColor\.rgb \* gl_FragColor\.a, max\(max\(gl_FragColor\.r, gl_FragColor\.g\), gl_FragColor\.b\) \* gl_FragColor\.a\)/);
  // one program for every cone material
  assert.equal(m.customProgramCacheKey?.(), coneMaterial(true).customProgramCacheKey?.());
});

test("on natural materials the cones brighten like a screen, so a light floor does not burn to white (#1115)", () => {
  const m = coneMaterial(true);
  assert.equal(m.blendSrc, OneMinusDstColorFactor);
  assert.equal(m.blendDst, OneFactor);
  // a style change switches the blending without a new material
  coneLook(m, false);
  assert.equal(m.blendSrc, OneFactor);
  coneLook(m, true);
  assert.equal(m.blendSrc, OneMinusDstColorFactor);
});
