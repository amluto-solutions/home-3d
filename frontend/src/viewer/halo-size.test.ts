import assert from "node:assert/strict";
import { test } from "node:test";
import { haloSize, HALO_SIZE } from "./halo-size.ts";

// three.js draws a size-attenuated point `size * (height / 2) / depth` CSS pixels tall
const px = (size: number, depth: number, height: number) => (size * height) / 2 / depth;

test("close up a lamp's glow keeps its own size in metres (#89)", () => {
  assert.equal(haloSize(4, 800), HALO_SIZE);
});

test("zoomed out a small lamp's glow stays big enough to see (#89)", () => {
  // the default whole-house view: ~30 m away on an 800 px tall view – 0.9 m would be about 12 px
  const size = haloSize(30, 800);
  assert.ok(size > HALO_SIZE);
  assert.ok(px(size, 30, 800) >= 18, `glow is ${px(size, 30, 800)} px`);
});

test("the glow does not bloom into a giant disc far away (#89)", () => {
  assert.ok(haloSize(400, 300) <= 3);
});

test("a missing view height leaves the glow as it is (#89)", () => {
  assert.equal(haloSize(30, 0), HALO_SIZE);
});
