import assert from "node:assert/strict";
import { test } from "node:test";
import { outdoorLook } from "./outdoor.ts";

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const luma = (c: number) => {
  const [r, g, b] = rgb(c);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

test("the lawn reads as green grass, not a near-black patch (#89)", () => {
  const lawn = outdoorLook("lawn");
  const [r, g, b] = rgb(lawn.color);
  assert.ok(g > r * 1.4 && g > b * 1.2, `lawn ${lawn.color.toString(16)} is not green`);
  // the old 0x0d2620 had a luma of ~29 of 255: on the navy ground it read as black
  assert.ok(luma(lawn.color) >= 45, `lawn luma ${luma(lawn.color)}`);
  assert.ok(lawn.edgeAlpha >= 0.25);
});

test("the lawn stays darker than the terrace's bright edge lines (it is the ground, not a highlight) (#89)", () => {
  assert.ok(luma(outdoorLook("lawn").color) < 90);
});

test("wild patches and hedges lift with the lawn (#89)", () => {
  assert.ok(luma(outdoorLook("wild").color) >= 40);
  assert.ok(luma(outdoorLook("hedge").color) > luma(outdoorLook("lawn").color));
});
