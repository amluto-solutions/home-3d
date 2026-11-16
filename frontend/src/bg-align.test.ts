// "Align to the map" (#465): the picture is scaled, turned and moved so two corners tapped in it land on the same two
// corners of the house from the map. Pure maths, checked by where a picture point ends up.
import assert from "node:assert/strict";
import { test } from "node:test";
import { alignBackground, nearestCorner } from "./bg-align.ts";
import type { Background, Vec2 } from "./model.ts";

/** Where a point of the picture (u, v in 0 … 1 across and down) lies in the plan: the picture turns about its middle. */
function world(bg: Background, aspect: number, u: number, v: number): Vec2 {
  const w = bg.width;
  const h = w * aspect;
  const c: Vec2 = [bg.x + w / 2, bg.z + h / 2];
  const r = ((bg.rotation ?? 0) * Math.PI) / 180;
  const dx = bg.x + u * w - c[0];
  const dz = bg.z + v * h - c[1];
  return [c[0] + dx * Math.cos(r) - dz * Math.sin(r), c[1] + dx * Math.sin(r) + dz * Math.cos(r)];
}

const close = (a: Vec2, b: Vec2, eps = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < eps;

test("two corners in the picture land on the same two corners of the map's house, whatever the picture's turn", () => {
  for (const rotation of [0, 23, -140]) {
    const bg: Background = { image_id: "p", x: -3, z: 2, width: 20, opacity: 0.5, rotation };
    const aspect = 0.75;
    // two corners of the house in the picture (as tapped in the plan: where they lie now)
    const a1 = world(bg, aspect, 0.2, 0.3);
    const a2 = world(bg, aspect, 0.8, 0.3);
    // the same two corners on the map's house: 12 m apart, along z
    const b1: Vec2 = [4, 1];
    const b2: Vec2 = [4, 13];
    const next = alignBackground(bg, aspect, a1, a2, b1, b2)!;
    assert.ok(next, "aligned");
    assert.ok(close(world(next, aspect, 0.2, 0.3), b1), `the first corner lands on its own (rotation ${rotation})`);
    assert.ok(close(world(next, aspect, 0.8, 0.3), b2), `the second corner lands on its own (rotation ${rotation})`);
    assert.equal(next.image_id, "p");
    assert.equal(next.opacity, 0.5, "everything else of the picture stays");
    // 12 m between corners that were 0.6 of the width apart: the picture is 20 m wide
    assert.ok(Math.abs(next.width - 20) < 0.01, `scaled to ${next.width}`);
  }
});

test("a picture with no turn yet, taps along a wall, is turned square with the map", () => {
  const bg: Background = { image_id: "p", x: 0, z: 0, width: 10, opacity: 1 };
  const next = alignBackground(bg, 1, [1, 1], [5, 1], [10, 10], [10, 14])!;
  assert.equal(next.rotation, 90, "the wall that ran along x runs along z now");
  assert.ok(close(world(next, 1, 0.1, 0.1), [10, 10]) && close(world(next, 1, 0.5, 0.1), [10, 14]));
});

test("two taps on the same spot tell no direction and no size: nothing changes", () => {
  const bg: Background = { image_id: "p", x: 0, z: 0, width: 10, opacity: 1 };
  assert.equal(alignBackground(bg, 1, [1, 1], [1, 1.01], [3, 3], [8, 3]), null);
  assert.equal(alignBackground(bg, 1, [1, 1], [5, 1], [3, 3], [3, 3.02]), null);
});

test("the third and fourth tap snap to the map's corner within two metres, else stay where they are", () => {
  const corners: Vec2[] = [[0, 0], [12, 0], [12, 8], [0, 8]];
  assert.deepEqual(nearestCorner([11.4, 0.5], corners, 0.3), [12, 0], "at least 2 m of reach");
  assert.deepEqual(nearestCorner([6, 4], corners, 0.3), [6, 4], "far from every corner");
  assert.deepEqual(nearestCorner([13.5, 8], corners, 0.3), [12, 8]);
  assert.deepEqual(nearestCorner([14.5, 8], corners, 5), [12, 8], "a wider reach when zoomed out");
  assert.deepEqual(nearestCorner([3, 3], [], 1), [3, 3]);
});
