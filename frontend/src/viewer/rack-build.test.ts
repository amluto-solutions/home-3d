// Big racks stay fast (#121): the floor geometry leaves a rack's gear out and lists the rack; the viewer builds the
// gear on its own (near: detail, far: slabs), cut at the floor's cut height like the rack around it.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { BufferGeometry } from "three";
import { newFloor, type Floor, type Furniture } from "../model.ts";
import { setPacks, setPlanRecipes, type PackItem, type PlanRecipe } from "../packs.ts";
import { buildFloorGeometry, buildRackGear, FURN_OFFSET } from "./build.ts";

const NETWORK = new URL("../../../custom_components/home_3d/bundled_packs/amluto.it/network/", import.meta.url);
const read = (id: string): PackItem => JSON.parse(readFileSync(new URL(`${id}.json`, NETWORK), "utf8"));
const RACK = read("rack_floor_cabinet_42u");
const SWITCH = read("rack_switch_24_1u");
const T_RACK = "pack:amluto.it:rack_floor_cabinet_42u";
const T_SWITCH = "pack:amluto.it:rack_switch_24_1u";
const copy = (recipe: PackItem): PlanRecipe => ({ pack: "amluto.it", item: recipe.id, release: 1, hash: `sha256:${recipe.id}`, recipe });

function floorWith(slots: { id: string; type: string; u: number }[]): Floor {
  const [w, d, h] = RACK.size;
  const rack: Furniture = { id: "r", type: T_RACK, x: 2, z: 2, rotation: 0, w, d, h, variant: null, entity: null, power: null, rack: { slots } };
  return { ...newFloor("f", "Floor", 0), rooms: [{ id: "a", name: "a", area_id: null, points: [[0, 0], [4, 0], [4, 4], [0, 4]], floor_material: "wood" }], furniture: [rack] };
}

const tris = (g: BufferGeometry) => g.getAttribute("position").count / 3;

test("the floor leaves a rack's gear out of its walls geometry and lists the rack (#121)", () => {
  setPacks([]);
  setPlanRecipes({ [T_RACK]: copy(RACK), [T_SWITCH]: copy(SWITCH) });
  const slots = [{ id: "a", type: T_SWITCH, u: 3 }, { id: "b", type: T_SWITCH, u: 40 }];
  const empty = buildFloorGeometry(floorWith([]), 0.24, 0.12);
  const filled = buildFloorGeometry(floorWith(slots), 0.24, 0.12);
  assert.equal(tris(filled.walls), tris(empty.walls), "no gear in the floor's geometry");
  assert.deepEqual(filled.racks.map((r) => [r.f.id, r.base]), [["r", 0]]);
  assert.deepEqual(empty.racks, [], "an empty rack has nothing to draw on its own");
  setPlanRecipes(undefined);
});

test("a rack's gear on its own folds away above the cut height with the rack (#121)", () => {
  setPacks([]);
  setPlanRecipes({ [T_RACK]: copy(RACK), [T_SWITCH]: copy(SWITCH) });
  const floor = floorWith([{ id: "a", type: T_SWITCH, u: 3 }, { id: "b", type: T_SWITCH, u: 40 }]);
  const geo = buildFloorGeometry(floor, 0.24, 0.12);
  for (const detail of [true, false]) {
    const gear = buildRackGear(floor, geo.racks[0], detail);
    assert.ok(tris(gear.mesh) > 0 && gear.lines.getAttribute("position").count > 0);
    const p = gear.mesh.getAttribute("position");
    const f = gear.mesh.getAttribute("fold");
    let above = 0;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > floor.cut_height + 1e-6) {
        above++;
        assert.equal(f.getX(i), FURN_OFFSET, "above the cut: folds with the walls");
      }
    }
    assert.ok(above > 0, "U40 lies above the cut");
  }
  assert.ok(tris(buildRackGear(floor, geo.racks[0], false).mesh) < tris(buildRackGear(floor, geo.racks[0], true).mesh) / 2);
  setPlanRecipes(undefined);
});
