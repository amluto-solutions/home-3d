import assert from "node:assert/strict";
import { test } from "node:test";
import type { BufferGeometry } from "three";
import type { Floor, Furniture, Room } from "../model.ts";
import { newFloor } from "../model.ts";
import { buildFloorGeometry, clearFurnitureCache, floorGeometrySteps, furnitureCacheStats, hashText, primeStoredPieces, takeCollected } from "./build.ts";
import { buildLightSurface, lightSurfaceSteps } from "./lighting.ts";
import { runAll } from "./slices.ts";

const rect = (id: string, x0: number, z0: number, x1: number, z1: number): Room => ({ id, name: id, area_id: null, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], floor_material: "wood" });
const item = (id: string, type: string, x: number, z: number): Furniture => ({ id, type, x, z, rotation: 0, w: 1, d: 0.6, h: 0.8, variant: null });

function home(): Floor {
  return { ...newFloor("steps", "Floor", 0), rooms: [rect("a", 0, 0, 4, 3), rect("b", 4, 0, 7, 3)], openings: [], furniture: [item("t", "table", 1, 1), item("s", "sofa", 5, 1.5), item("t2", "table", 2.5, 2)] };
}

const arrays = (g: BufferGeometry) => Object.fromEntries(Object.entries(g.attributes).map(([k, a]) => [k, Array.from(a.array as ArrayLike<number>)]));

test("a floor modelled in steps is the same as one built at once, and stops after each item (run 6 speed)", () => {
  clearFurnitureCache();
  const once = buildFloorGeometry(home(), 0.24, 0.12);
  clearFurnitureCache();
  const it = floorGeometrySteps(home(), 0.24, 0.12);
  let stops = 0;
  let r = it.next();
  while (!r.done) {
    stops++;
    r = it.next();
  }
  // the parts, the walls, the three items and the buffers: well more than one stop
  assert.ok(stops >= 3 + 4, `${stops} stops`);
  assert.deepEqual(arrays(r.value.walls), arrays(once.walls));
  assert.deepEqual(arrays(r.value.floor), arrays(once.floor));
  assert.deepEqual(arrays(r.value.lines), arrays(once.lines));
  assert.deepEqual(r.value.furnitureTris, once.furnitureTris);
});

test("a light surface made in steps is the same as one made at once", () => {
  const f = home();
  const geo = buildFloorGeometry(f, 0.24, 0.12);
  const once = buildLightSurface(f, geo.walls2d, geo.wallBuckets, geo.openings, 0.25, geo.holes);
  const steps = runAll(lightSurfaceSteps(f, geo.walls2d, geo.wallBuckets, geo.openings, 0.25, geo.holes));
  assert.deepEqual(Array.from(steps.pos), Array.from(once.pos));
  assert.deepEqual(Array.from(steps.room), Array.from(once.room));
  assert.deepEqual(steps.blockers, once.blockers);
});

test("pieces kept from an earlier load draw the same floor without modelling the items again", () => {
  clearFurnitureCache();
  // the first load: nothing kept yet, everything modelled and collected
  primeStoredPieces("steps", null);
  const first = buildFloorGeometry(home(), 0.24, 0.12);
  const collected = takeCollected("steps");
  assert.ok(collected?.fresh);
  assert.equal(collected?.pieces.size, 3);
  // the next load (a new page: no pieces in memory) takes them from the record
  clearFurnitureCache();
  const before = furnitureCacheStats();
  primeStoredPieces("steps", { pieces: collected!.pieces, light: null });
  const again = buildFloorGeometry(home(), 0.24, 0.12);
  const after = furnitureCacheStats();
  assert.equal(after.misses - before.misses, 0, "nothing modelled");
  assert.equal(after.hits - before.hits, 3);
  assert.equal(takeCollected("steps")?.fresh, false);
  assert.deepEqual(arrays(again.walls), arrays(first.walls));
  assert.deepEqual(arrays(again.lines), arrays(first.lines));
  assert.deepEqual(arrays(again.shadow), arrays(first.shadow));
  // a moved item is not taken from the record
  clearFurnitureCache();
  const moved = home();
  moved.furniture[1] = { ...moved.furniture[1], x: 5.5 };
  primeStoredPieces("steps", { pieces: collected!.pieces, light: null });
  const m0 = furnitureCacheStats().misses;
  buildFloorGeometry(moved, 0.24, 0.12);
  assert.equal(furnitureCacheStats().misses - m0, 1);
  assert.equal(takeCollected("steps")?.fresh, true);
});

test("a build that was not primed collects nothing (edits after the load)", () => {
  clearFurnitureCache();
  buildFloorGeometry(home(), 0.24, 0.12);
  assert.equal(takeCollected("steps"), null);
});

test("hashText is stable and tells texts apart", () => {
  assert.equal(hashText("pack:sofa"), hashText("pack:sofa"));
  assert.notEqual(hashText("pack:sofa"), hashText("pack:sofb"));
});
