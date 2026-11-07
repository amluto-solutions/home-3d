// Incremental 3D after an edit (#131): a floor rebuilt after one item moved draws the other items from the last
// build's copy instead of modelling them again, and the result is exactly what a build from scratch gives.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BufferGeometry } from "three";
import { newFloor, type Floor, type Furniture } from "../model.ts";
import { setPacks } from "../packs.ts";
import { buildFloorGeometry, clearFurnitureCache, furnitureCacheStats, keepFurnitureOf } from "./build.ts";
import { setLightLook } from "./furniture.ts";

const item = (id: string, type: string, x: number, z: number, w: number, d: number, h: number, extra: Partial<Furniture> = {}): Furniture => ({ id, type, x, z, rotation: 0, w, d, h, variant: null, entity: null, power: null, ...extra });

function floor(furniture: Furniture[]): Floor {
  return {
    ...newFloor("f", "Floor", 0),
    rooms: [{ id: "a", name: "a", area_id: null, points: [[0, 0], [6, 0], [6, 5], [0, 5]], floor_material: "wood" }],
    furniture,
  };
}

const ITEMS = [
  item("sofa", "sofa", 2, 2, 2, 0.9, 0.8, { colors: { fabric: "#aa3311" } }),
  item("bed", "bed", 4, 3, 1.6, 2, 0.5, { rotation: 90 }),
  item("wardrobe", "wardrobe", 1, 4.6, 1.2, 0.6, 2.2, { mirror: true }),
  item("socket", "wall_socket", 3, 0.1, 0.08, 0.02, 0.08),
  item("table", "table", 4.5, 1, 1.2, 0.8, 0.75),
];

const arrays = (g: BufferGeometry) => Object.fromEntries(Object.entries(g.attributes).map(([k, a]) => [k, Array.from(a.array as Float32Array)]));
const same = (a: ReturnType<typeof buildFloorGeometry>, b: ReturnType<typeof buildFloorGeometry>) => {
  for (const k of ["walls", "lines", "shadow", "floor", "water"] as const) assert.deepEqual(arrays(a[k]), arrays(b[k]), k);
  assert.deepEqual(a.furnitureTris, b.furnitureTris);
  assert.deepEqual(a.racks, b.racks);
};

test("a floor rebuilt after one item moved equals a build from scratch, the other items drawn from the last build (#131)", () => {
  setPacks([]);
  clearFurnitureCache();
  buildFloorGeometry(floor(ITEMS), 0.24, 0.12);
  const moved = ITEMS.map((f) => (f.id === "bed" ? { ...f, x: f.x - 0.3 } : f));
  const before = furnitureCacheStats();
  const again = buildFloorGeometry(floor(moved), 0.24, 0.12);
  const after = furnitureCacheStats();
  assert.equal(after.hits - before.hits, ITEMS.length - 1, "only the moved item is modelled again");
  assert.equal(after.misses - before.misses, 1);
  clearFurnitureCache();
  same(again, buildFloorGeometry(floor(moved), 0.24, 0.12));
});

test("other packs or a cleared cache model every item again; a new look draws as from scratch (#131)", () => {
  setPacks([]);
  clearFurnitureCache();
  const plan = floor(ITEMS);
  buildFloorGeometry(plan, 0.24, 0.12);
  setLightLook(true);
  const light = buildFloorGeometry(plan, 0.24, 0.12);
  setLightLook(false);
  clearFurnitureCache();
  setLightLook(true);
  same(light, buildFloorGeometry(plan, 0.24, 0.12));
  setLightLook(false);
  buildFloorGeometry(plan, 0.24, 0.12);
  const s = furnitureCacheStats();
  setPacks([]);
  buildFloorGeometry(plan, 0.24, 0.12);
  assert.equal(furnitureCacheStats().misses - s.misses, ITEMS.length, "packs changed: recipes may have");
});

test("the same items at another cut height or on another floor are modelled for it (#131)", () => {
  setPacks([]);
  clearFurnitureCache();
  const plan = floor(ITEMS);
  buildFloorGeometry(plan, 0.24, 0.12);
  const low = { ...plan, cut_height: 0.6 };
  const cut = buildFloorGeometry(low, 0.24, 0.12);
  clearFurnitureCache();
  same(cut, buildFloorGeometry(low, 0.24, 0.12));
  // a second floor with the same items keeps its own copy: switching between them never mixes them up
  const other = { ...plan, id: "g" };
  buildFloorGeometry(plan, 0.24, 0.12);
  buildFloorGeometry(other, 0.24, 0.12);
  const s = furnitureCacheStats();
  buildFloorGeometry(plan, 0.24, 0.12);
  assert.equal(furnitureCacheStats().hits - s.hits, ITEMS.length);
});

test("the items of floors that are gone are forgotten (#131)", () => {
  setPacks([]);
  clearFurnitureCache();
  const plan = floor(ITEMS);
  buildFloorGeometry(plan, 0.24, 0.12);
  keepFurnitureOf(["other"]);
  const s = furnitureCacheStats();
  buildFloorGeometry(plan, 0.24, 0.12);
  assert.equal(furnitureCacheStats().misses - s.misses, ITEMS.length);
  keepFurnitureOf(["f"]);
  buildFloorGeometry(plan, 0.24, 0.12);
  assert.equal(furnitureCacheStats().hits - s.hits, ITEMS.length);
});

test("a look switch models again only the items in colours of their own, and only the first time (#131)", () => {
  setPacks([]);
  clearFurnitureCache();
  const plan = floor(ITEMS);
  buildFloorGeometry(plan, 0.24, 0.12);
  const s = furnitureCacheStats();
  setLightLook(true);
  buildFloorGeometry(plan, 0.24, 0.12);
  assert.equal(furnitureCacheStats().misses - s.misses, 1, "the sofa in its own fabric colour");
  setLightLook(false);
  buildFloorGeometry(plan, 0.24, 0.12);
  setLightLook(true);
  buildFloorGeometry(plan, 0.24, 0.12);
  setLightLook(false);
  assert.equal(furnitureCacheStats().misses - s.misses, 1, "back and forth: both looks are kept");
  assert.equal(furnitureCacheStats().hits - s.hits, 3 * ITEMS.length - 1);
});
