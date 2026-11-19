// #1151 (NeonPlan 3D 3.4.2): a shared wall the room on the other side left out shows as left out in both rooms and
// comes back from either; "no wall" on an edge another room only partly shares leaves out just the shared part.
import assert from "node:assert/strict";
import { test } from "node:test";
import { newFloor, type Building, type Room } from "../../model.ts";
import { WallsPart } from "./walls.ts";

function rect(id: string, x0: number, z0: number, x1: number, z1: number): Room {
  return { id, name: id, area_id: null, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], floor_material: "wood" };
}

/** Just enough of the editor for the wall rows: one floor, settings, and change() copying the plan as the editor does. */
function editor(rooms: Room[]) {
  const ed = Object.create(WallsPart.prototype);
  ed._doc = { floors: [{ ...newFloor("f", "Floor", 0), rooms }], settings: { wall_exterior: 0.24, wall_interior: 0.12 } } as unknown as Building;
  ed.floor = ed._doc.floors[0];
  ed.isEditor = true;
  ed.change = (mutate: (doc: Building, floor: Building["floors"][number]) => void) => {
    const next = structuredClone(ed._doc);
    mutate(next, next.floors[0]);
    ed._doc = next;
    ed.floor = next.floors[0];
  };
  return ed;
}
const room = (ed: ReturnType<typeof editor>, id: string): Room => ed.floor.rooms.find((r: Room) => r.id === id);

test("a wall the room on the other side left out shows as left out here and comes back from here (#1151)", () => {
  // a 4 × 3 room beside a 3 × 3 one: a's edge 1 (x = 4) is b's edge 3
  const ed = editor([rect("a", 0, 0, 4, 3), rect("b", 4, 0, 7, 3)]);
  ed.setEdgeHeight(room(ed, "b"), 3, 0);
  assert.equal(ed.shownEdgeHeight(room(ed, "a"), 1), 0);
  assert.equal(ed.shownEdgeHeight(room(ed, "a"), 0), null);
  // "Full height" from room a brings the wall back in both rooms
  ed.setEdgeHeight(room(ed, "a"), 1, null);
  assert.equal(room(ed, "b").wall_heights, undefined);
  assert.equal(ed.shownEdgeHeight(room(ed, "b"), 3), null);
});

test("no wall on an edge another room only partly shares leaves out just the shared part (#1151)", () => {
  // a long room with a short one beside part of its edge: b's edge 0 lies on part of a's edge 2
  const ed = editor([rect("a", 0, 0, 6, 2), rect("b", 1, 2, 3, 4)]);
  ed.setEdgeHeight(room(ed, "b"), 0, 0);
  assert.deepEqual(room(ed, "b").wall_heights, [0, null, null, null]);
  // a's edge 2 runs from (6, 2) to (0, 2), split by b at 3 m and 5 m: only part 1 is left out
  assert.deepEqual(ed.edgeParts(room(ed, "a"), 2), [0, 3, 5]);
  assert.deepEqual(room(ed, "a").wall_heights?.[2], [null, 0, null]);
  assert.deepEqual([0, 1, 2].map((k) => ed.shownEdgeHeight(room(ed, "a"), 2, k)), [null, 0, null]);
});
