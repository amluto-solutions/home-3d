// Moving and resizing the floating panels (#265, #267): the clamping keeps them inside the stage, stored values are
// read defensively.
import assert from "node:assert/strict";
import { test } from "node:test";
import { clampOffset, clampSheet, clampSize, parseOffset, parseSheet, parseSize } from "./float-panel.ts";

const stage = { left: 0, top: 0, right: 1000, bottom: 600 };

test("a moved panel stays inside the stage, whatever the drag", () => {
  // a 400x300 panel that docks at (300, 250); no offset yet
  const box = { left: 300, top: 250, right: 700, bottom: 550 };
  assert.deepEqual(clampOffset({ x: 50, y: -40 }, { x: 0, y: 0 }, box, stage), { x: 50, y: -40 });
  assert.deepEqual(clampOffset({ x: -9999, y: -9999 }, { x: 0, y: 0 }, box, stage), { x: -292, y: -242 });
  assert.deepEqual(clampOffset({ x: 9999, y: 9999 }, { x: 0, y: 0 }, box, stage), { x: 292, y: 42 });
  // the same panel already moved by (100, 0): its box is measured where it stands now
  const moved = { left: 400, top: 250, right: 800, bottom: 550 };
  assert.deepEqual(clampOffset({ x: 9999, y: 0 }, { x: 100, y: 0 }, moved, stage), { x: 292, y: 0 });
});

test("a panel larger than the stage is pinned to its top left", () => {
  const box = { left: 0, top: 0, right: 1200, bottom: 800 };
  assert.deepEqual(clampOffset({ x: 300, y: 300 }, { x: 0, y: 0 }, box, stage), { x: 8, y: 8 });
});

test("sizes stay between the minimum and what the stage allows", () => {
  const min = { w: 280, h: 240 };
  assert.deepEqual(clampSize({ w: 100, h: 100 }, min, { w: 900, h: 500 }), { w: 280, h: 240 });
  assert.deepEqual(clampSize({ w: 2000, h: 2000 }, min, { w: 900, h: 500 }), { w: 900, h: 500 });
  assert.deepEqual(clampSize({ w: 400, h: 300 }, min, { w: 900, h: 500 }), { w: 400, h: 300 });
  assert.deepEqual(clampSize({ w: 400, h: 300 }, min, { w: 200, h: 100 }), { w: 280, h: 240 }, "the minimum wins on a tiny stage");
});

test("stored values that are not numbers are ignored", () => {
  assert.deepEqual(parseOffset('{"x":12,"y":-4}'), { x: 12, y: -4 });
  assert.equal(parseOffset("nope"), null);
  assert.equal(parseOffset('{"x":"1","y":2}'), null);
  assert.equal(parseOffset(null), null);
  assert.deepEqual(parseSize('{"w":400,"h":500}'), { w: 400, h: 500 });
  assert.equal(parseSize('{"w":0,"h":500}'), null);
});

test("the room sheet's height stays between 20 % and 90 % of the stage (#353)", () => {
  assert.equal(clampSheet(0.05), 0.2);
  assert.equal(clampSheet(1.4), 0.9);
  assert.equal(clampSheet(0.6123), 0.612);
  assert.equal(parseSheet("0.7"), 0.7);
  assert.equal(parseSheet("2"), 0.9);
  assert.equal(parseSheet("nope"), null);
  assert.equal(parseSheet(null), null);
  assert.equal(parseSheet("0"), null);
});
