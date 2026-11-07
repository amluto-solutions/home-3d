// A new home's floors are built one per frame (#131): the floor in view first, then the others from near to far.

import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Building } from "../model.ts";
import { buildOrder } from "./floor-order.ts";

function house(): Building {
  const b = emptyBuilding();
  const room = { id: "r", name: "r", area_id: null, points: [[0, 0], [4, 0], [4, 4], [0, 4]] as [number, number][], floor_material: "wood" };
  b.floors = [
    { ...newFloor("loft", "Loft", 5.5), rooms: [room] },
    { ...newFloor("cellar", "Cellar", -2.75), rooms: [room] },
    { ...newFloor("ground", "Ground", 0), rooms: [room] },
    { ...newFloor("upper", "Upper", 2.75), rooms: [room] },
  ];
  return b;
}

test("the open floor is built first, then the others from the nearest (#131)", () => {
  assert.deepEqual(buildOrder(house(), "upper"), ["upper", "loft", "ground", "cellar"]);
  assert.deepEqual(buildOrder(house(), "cellar"), ["cellar", "ground", "upper", "loft"]);
});

test("the whole house starts from the ground floor (#131)", () => {
  assert.deepEqual(buildOrder(house(), null), ["ground", "upper", "cellar", "loft"]);
  assert.deepEqual(buildOrder(house(), "gone"), ["ground", "upper", "cellar", "loft"], "an unknown floor counts as none");
});
