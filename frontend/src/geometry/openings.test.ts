import assert from "node:assert/strict";
import { test } from "node:test";
import type { Opening, Room } from "../model.ts";
import { blockingOpening, edgeStartCorner } from "./openings.ts";

const room = (id: string, points: [number, number][]) => ({ id, name: id, area_id: null, points }) as unknown as Room;
const opening = (id: string, room_id: string, edge: number, offset: number, width: number) => ({ id, room_id, edge, offset, width }) as unknown as Opening;

// a hall above a kitchen, sharing the wall z = 0; the kitchen runs the other way round, so its edge 3 is that wall seen from (4, 0)
const hall = room("hall", [[0, 0], [4, 0], [4, 3], [0, 3]]);
const kitchen = room("kitchen", [[0, 0], [0, -3], [4, -3], [4, 0]]);

test("a door kept by the room on the other side of a shared wall still blocks a new one there (#62)", () => {
  const door = opening("d", "kitchen", 3, 1, 0.9); // centre 1 m from (4, 0): x = 3
  assert.equal(blockingOpening([[2.6, 0], [3.4, 0]], [door], [hall, kitchen], [])?.id, "d");
  // beside it (the door ends at x = 2.55) the wall is free; just touching is fine
  assert.equal(blockingOpening([[1.6, 0], [2.55, 0]], [door], [hall, kitchen], []), null);
});

test("a window in a parallel wall elsewhere in the room does not block (#62)", () => {
  const window = opening("w", "hall", 2, 2, 1.2); // north wall z = 3
  assert.equal(blockingOpening([[1.4, 0], [2.6, 0]], [window], [hall, kitchen], []), null);
});

test("the corner an opening is measured from is named by compass direction, with the plan's north (#63)", () => {
  // north is up (-z) by default: the hall's edge 0 runs west to east, so it is measured from its west corner
  assert.equal(edgeStartCorner(hall, 0, 0), "w");
  assert.equal(edgeStartCorner(hall, 1, 0), "n");
  assert.equal(edgeStartCorner(kitchen, 3, 0), "e");
  // north pointing right (+x): the same west end is now the south corner
  assert.equal(edgeStartCorner(hall, 0, 90), "s");
});
