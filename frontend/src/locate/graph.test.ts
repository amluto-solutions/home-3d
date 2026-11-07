import assert from "node:assert/strict";
import { test } from "node:test";
import type { Room } from "../model.ts";
import { emptyBuilding, newFloor } from "../model.ts";
import { doorPairs, locateRooms, roomAt } from "./graph.ts";

function rect(id: string, name: string, x0: number): Room {
  return { id, name, area_id: `${id}_area`, points: [[x0, 0], [x0 + 4, 0], [x0 + 4, 3], [x0, 3]], floor_material: "wood" };
}

test("rooms carry their floor and area; a door joins the two rooms of its wall", () => {
  const b = emptyBuilding();
  const floor = { ...newFloor("ground", "Ground", 0), rooms: [rect("a", "Kitchen", 0), rect("b", "Hall", 4), rect("c", "Bathroom", 8)] };
  // the shared wall of a and b is a's right edge (edge 1: from [4,0] to [4,3])
  floor.openings = [{ id: "d1", room_id: "a", edge: 1, offset: 1.5, width: 0.9, height: 2.0, type: "door", sill: 0 } as never];
  b.floors = [floor];
  assert.deepEqual(
    locateRooms(b).map((r) => [r.id, r.floor, r.area_id]),
    [["a", "Ground", "a_area"], ["b", "Ground", "b_area"], ["c", "Ground", "c_area"]],
  );
  const pairs = doorPairs(b).map((p) => [...p].sort().join("-"));
  assert.deepEqual(pairs, ["a-b"]);
  assert.equal(roomAt(b, "ground", 9, 1), "c");
  assert.equal(roomAt(b, "ground", 20, 1), null);
});
