// A car taller than the cut height stays whole in the cut view (#242): cut at 1.15 m like a wardrobe, its glasshouse
// and roof folded away and left an open shell with its pillars standing up out of it (slabs and a post on the roof).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { newFloor, type Floor, type Furniture } from "../model.ts";
import { setPacks, setPlanRecipes, type PackItem, type PlanRecipe } from "../packs.ts";
import { buildFloorGeometry, FURN_OFFSET } from "./build.ts";

const PACKS = new URL("../../../custom_components/home_3d/bundled_packs/", import.meta.url);
const read = (path: string): PackItem => JSON.parse(readFileSync(new URL(`${path}.json`, PACKS), "utf8"));
const copy = (pack: string, recipe: PackItem): PlanRecipe => ({ pack, item: recipe.id, release: 1, hash: `sha256:${recipe.id}`, recipe });

function floorWith(type: string, item: PackItem): Floor {
  const [w, d, h] = item.size;
  const f: Furniture = { id: "i", type, x: 3, z: 3, rotation: 0, w, d, h, variant: null, entity: null, power: null };
  return { ...newFloor("f", "Floor", 0), rooms: [{ id: "a", name: "a", area_id: null, points: [[0, 0], [6, 0], [6, 6], [0, 6]], floor_material: "wood" }], furniture: [f] };
}

function folded(floor: Floor): number {
  const geo = buildFloorGeometry(floor, 0.24, 0.12);
  const f = geo.walls.getAttribute("fold");
  let n = 0;
  for (let i = 0; i < f.count; i++) if (f.getX(i) === FURN_OFFSET) n++;
  return n;
}

test("a vehicle taller than the cut height is not cut with the walls (#242)", () => {
  setPacks([]);
  const cars = ["nissan_leaf", "vw_golf", "landrover_defender_110", "ford_transit_custom"];
  setPlanRecipes(Object.fromEntries(cars.map((id) => [`pack:amluto.outdoor:${id}`, copy("amluto.outdoor", read(`amluto.outdoor/vehicle/${id}`))])));
  for (const id of cars) {
    const item = read(`amluto.outdoor/vehicle/${id}`);
    const floor = floorWith(`pack:amluto.outdoor:${id}`, item);
    assert.ok(item.size[2] > floor.cut_height + 0.05, `${id} reaches above the cut`);
    assert.equal(folded(floor), 0, `${id}: nothing folds away`);
  }
  setPlanRecipes(undefined);
});

test("a tall cabinet is still cut with the walls (#242)", () => {
  setPacks([]);
  const rack = read("amluto.it/network/rack_floor_cabinet_42u");
  setPlanRecipes({ "pack:amluto.it:rack_floor_cabinet_42u": copy("amluto.it", rack) });
  assert.ok(folded(floorWith("pack:amluto.it:rack_floor_cabinet_42u", rack)) > 0);
  setPlanRecipes(undefined);
});
