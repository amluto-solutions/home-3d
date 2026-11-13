import assert from "node:assert/strict";
import { test } from "node:test";
import { floorPictureKey } from "./floor-sig.ts";

test("a tilt-only change of a cover changes the floor picture key (#453)", () => {
  const a = floorPictureKey([], [["w1", { open: 0, cover: 1, slats: 0.2 }]]);
  const b = floorPictureKey([], [["w1", { open: 0, cover: 1, slats: 0.8 }]]);
  assert.notEqual(a, b);
});

test("the same state gives the same key; no slats reads as a dash", () => {
  const key = () => floorPictureKey([{ id: "light.sample_lounge", glow: { level: 1, color: [1, 0.5, 0.2] } }], [["w1", { open: 0, cover: null }]]);
  assert.equal(key(), key());
  assert.match(key(), /w1:0:-:-$/);
});
