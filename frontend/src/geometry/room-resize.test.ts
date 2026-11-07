import assert from "node:assert/strict";
import { test } from "node:test";
import { newFloor, type Floor, type Furniture, type Vec2 } from "../model.ts";
import { carryRectResize, strandedBy } from "./room-resize.ts";

const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

function item(id: string, x: number, z: number): Furniture {
  return { id, type: "bed", x, z, w: 1.4, d: 2, h: 0.5, rotation: 0 } as Furniture;
}

function floorWith(furniture: Furniture[], placements: [string, number, number][] = []): Floor {
  const f = newFloor("f", "Ground", 0);
  f.furniture = furniture;
  f.placements = placements.map(([entity_id, x, z]) => ({ entity_id, x, z, y: null }));
  return f;
}

test("items that stood in the room and are outside its new outline are stranded; the rest are not (#64)", () => {
  const floor = floorWith([item("bed", 4.5, 2), item("chair", 1, 1), item("hall", 8, 1)], [["light.sample_lounge", 4.8, 3], ["light.sample_hall", 0.5, 0.5]]);
  const out = strandedBy(floor, rect(0, 0, 5, 4), rect(0, 0, 4, 4));
  assert.deepEqual(out, { furniture: ["bed"], devices: ["light.sample_lounge"] });
});

function roomFloor(): Floor {
  const floor = floorWith([item("bed", 4.5, 2), item("chair", 1, 1), item("hall", 8, 1)], [["light.sample_lounge", 4.8, 3]]);
  floor.rooms.push({ id: "r", name: "Bedroom", area_id: null, points: rect(0, 0, 5, 4), floor_material: "wood" });
  floor.rooms.push({ id: "n", name: "Hall", area_id: null, points: rect(5, 0, 8, 4), floor_material: "wood" });
  return floor;
}

test("a rectangular room's contents follow the wall they stand nearer to, and the neighbour's shared wall moves too (#64)", () => {
  const floor = roomFloor();
  const moved = carryRectResize(floor, "r", rect(0, 0, 4, 4));
  assert.deepEqual(moved, { furniture: 1, devices: 1, walls: 1 });
  const at = (id: string) => floor.furniture.find((m) => m.id === id)!;
  assert.deepEqual([at("bed").x, at("bed").z], [3.5, 2]);
  assert.deepEqual([at("chair").x, at("hall").x], [1, 8]);
  assert.deepEqual([floor.placements[0].x, floor.placements[0].z], [3.8, 3]);
  assert.deepEqual(floor.rooms[0].points, rect(0, 0, 4, 4));
  assert.deepEqual(floor.rooms[1].points, rect(4, 0, 8, 4));
});

test("moving a rectangular room without resizing it carries everything inside but leaves the neighbours alone (#64)", () => {
  const floor = roomFloor();
  const moved = carryRectResize(floor, "r", rect(-1, 0, 4, 4));
  assert.deepEqual(moved, { furniture: 2, devices: 1, walls: 0 });
  assert.deepEqual(floor.furniture.map((m) => m.x), [3.5, 0, 8]);
  assert.deepEqual(floor.rooms[1].points, rect(5, 0, 8, 4));
});

test("fixed items stay put, and a room that is not a rectangle before and after is not carried (#64)", () => {
  const floor = roomFloor();
  floor.furniture[0].locked = true;
  assert.deepEqual(carryRectResize(floor, "r", rect(0, 0, 4, 4)), { furniture: 0, devices: 1, walls: 1 });
  assert.equal(floor.furniture[0].x, 4.5);
  const other = roomFloor();
  assert.equal(carryRectResize(other, "r", [[0, 0], [4, 0], [5, 4], [0, 4]]), null);
  assert.deepEqual(other.rooms[0].points, rect(0, 0, 5, 4));
});

test("only a neighbour wall lying along the moved side follows; a room that touches it at a corner, or runs past it, keeps its shape (#64)", () => {
  const floor = roomFloor();
  floor.rooms.push({ id: "above", name: "Porch", area_id: null, points: rect(5, -3, 8, 0), floor_material: "wood" });
  floor.rooms.push({ id: "long", name: "Landing", area_id: null, points: rect(0, 4, 2, 6), floor_material: "wood" });
  floor.rooms[1].points = rect(5, -1, 8, 4); // the hall now runs past the bedroom's corner
  floor.walls = [{ id: "w", a: [5, 2], b: [7, 2] }];
  const moved = carryRectResize(floor, "r", rect(0, 0, 4, 4));
  assert.deepEqual(floor.rooms.map((r) => r.points), [rect(0, 0, 4, 4), rect(5, -1, 8, 4), rect(5, -3, 8, 0), rect(0, 4, 2, 6)]);
  // the free wall meeting the side keeps meeting it
  assert.deepEqual(floor.walls[0].a, [4, 2]);
  assert.equal(moved?.walls, 1);
});
