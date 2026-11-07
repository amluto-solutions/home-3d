// Incremental 3D after an edit (#131): the viewer rebuilds only the floors whose drawing can have changed. A floor's
// key changes with anything drawn on it and with what other floors lend it (stairs cut its slab, rooms shape the roof
// and the earth); an item on another floor leaves it alone.

import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Building, type Furniture } from "../model.ts";
import { floorKeys } from "./floor-keys.ts";

const item = (id: string, type: string, x: number): Furniture => ({ id, type, x, z: 1, rotation: 0, w: 1, d: 1, h: 1, variant: null, entity: null, power: null });

function house(): Building {
  const b = emptyBuilding();
  const room = (id: string) => ({ id, name: id, area_id: null, points: [[0, 0], [5, 0], [5, 4], [0, 4]] as [number, number][], floor_material: "wood" });
  b.floors = [
    { ...newFloor("g", "Ground", 0), rooms: [room("a")], furniture: [item("sofa", "sofa", 1), item("st", "stairs", 3)] },
    { ...newFloor("u", "Upper", 2.75), rooms: [room("b")], furniture: [item("bed", "bed", 2)] },
  ];
  return b;
}

const keysOf = (b: Building, extra = "") => floorKeys(b, extra);

test("moving an item changes only its own floor's key (#131)", () => {
  const b = house();
  const before = keysOf(b);
  const after = structuredClone(b);
  after.floors[0].furniture[0].x += 0.5;
  const now = keysOf(after);
  assert.notEqual(now.get("g"), before.get("g"));
  assert.equal(now.get("u"), before.get("u"));
  assert.deepEqual(keysOf(structuredClone(b)), before, "a copy of the same plan keeps every key");
});

test("stairs, rooms, floor heights and the building's settings change every floor's key (#131)", () => {
  const b = house();
  const before = keysOf(b);
  const edits: ((x: Building) => void)[] = [
    (x) => (x.floors[0].furniture[1].x += 0.2), // the stair cuts the slab above
    (x) => (x.floors[0].rooms[0].points[1][0] = 6), // rooms shape the roof and the earth
    (x) => (x.floors[0].height = 2.6),
    (x) => (x.settings.wall_exterior = 0.3),
  ];
  for (const edit of edits) {
    const x = structuredClone(b);
    edit(x);
    const now = keysOf(x);
    assert.notEqual(now.get("u"), before.get("u"), String(edit));
  }
  assert.notEqual(keysOf(b, "packs 2").get("u"), before.get("u"), "what the viewer adds (packs, parked cars)");
});

test("what the viewer adds for one floor changes only its key (#131: the look for a floor with own colours)", () => {
  const b = house();
  const before = keysOf(b);
  const now = floorKeys(b, "", (f) => (f.id === "g" ? "light" : ""));
  assert.notEqual(now.get("g"), before.get("g"));
  assert.equal(now.get("u"), before.get("u"));
});
