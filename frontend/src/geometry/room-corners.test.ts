import assert from "node:assert/strict";
import { test } from "node:test";
import { newFloor, type Floor, type Room, type Vec2 } from "../model.ts";
import { cornerLoss, insertCorner, removeCorner } from "./room-corners.ts";
import { generateWalls } from "./walls.ts";

const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

function room(id: string, points: Vec2[], more: Partial<Room> = {}): Room {
  return { id, name: id, area_id: null, points, floor_material: "wood", ...more };
}

function floorOf(...rooms: Room[]): Floor {
  const f = newFloor("f", "Ground", 0);
  f.rooms = rooms;
  return f;
}

/** The height of the wall a room's outline has at a plan point (null: full height, undefined: no wall there). */
function wallHeightAt(floor: Floor, roomId: string, p: Vec2): number | null | undefined {
  const { walls } = generateWalls(floor.rooms, { exterior: 0.24, interior: 0.12 }, floor.walls ?? []);
  const w = walls.find((x) => {
    if (!x.sources.some((s) => s.room_id === roomId)) return false;
    const d: Vec2 = [x.b[0] - x.a[0], x.b[1] - x.a[1]];
    const l = Math.hypot(d[0], d[1]);
    const t = ((p[0] - x.a[0]) * d[0] + (p[1] - x.a[1]) * d[1]) / l;
    const off = Math.abs((p[0] - x.a[0]) * d[1] - (p[1] - x.a[1]) * d[0]) / l;
    return off < 1e-6 && t > 1e-6 && t < l - 1e-6;
  });
  return w ? (w.height ?? null) : undefined;
}

/** Plan points along the room's outline, one every half metre (corners left out). */
function samples(points: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0.25; t < l; t += 0.5) out.push([a[0] + ((b[0] - a[0]) * t) / l, a[1] + ((b[1] - a[1]) * t) / l]);
  });
  return out;
}

const heights = (floor: Floor, roomId: string, pts: Vec2[]) => pts.map((p) => wallHeightAt(floor, roomId, p));

test("adding a corner on edge 0 keeps a hand split on a later edge on that wall (#157)", () => {
  // the review's case: edge 2 is split into a 2.5 m and a 1.7 m part; a corner is added on edge 0
  const f = floorOf(room("r", rect(0, 0, 8, 6), { wall_heights: [null, null, [2.5, 1.7], null], wall_splits: [null, null, [3], null], wall_thickness: [0.3, null, 0.2, null] }));
  const along = samples(rect(0, 0, 8, 6));
  const was = heights(f, "r", along);
  insertCorner(f, "r", 0, [4, 0]);
  const r = f.rooms[0];
  assert.deepEqual(r.points, [[0, 0], [4, 0], [8, 0], [8, 6], [0, 6]]);
  assert.deepEqual(r.wall_splits, [null, null, null, [3], null]);
  assert.deepEqual(r.wall_heights, [null, null, null, [2.5, 1.7], null]);
  assert.deepEqual(r.wall_thickness, [0.3, 0.3, null, 0.2, null]);
  assert.deepEqual(heights(f, "r", along), was, "every wall is as high as before");
});

test("a corner added inside a split edge shares its splits and part heights between the halves (#157)", () => {
  const f = floorOf(room("r", rect(0, 0, 8, 6), { wall_heights: [[2.5, 1.7, 2], null, null, null], wall_splits: [[2, 6], null, null, null] }));
  const along = samples(rect(0, 0, 8, 6));
  const was = heights(f, "r", along);
  insertCorner(f, "r", 0, [4, 0]);
  const r = f.rooms[0];
  assert.deepEqual(r.wall_splits, [[2], [2], null, null, null]);
  assert.deepEqual(r.wall_heights, [[2.5, 1.7], [1.7, 2], null, null, null]);
  assert.deepEqual(heights(f, "r", along), was);
  // the halves have lists of their own: changing one leaves the other
  assert.notEqual(r.wall_heights![0], r.wall_heights![1]);
  (r.wall_heights![1] as number[])[0] = 1.2;
  assert.deepEqual(r.wall_heights![0], [2.5, 1.7]);
});

test("a corner added right on a split point replaces the split (#157)", () => {
  const f = floorOf(room("r", rect(0, 0, 8, 6), { wall_heights: [[2.5, 1.7], null, null, null], wall_splits: [[4], null, null, null] }));
  insertCorner(f, "r", 0, [4, 0]);
  assert.equal(f.rooms[0].wall_splits, undefined);
  assert.deepEqual(f.rooms[0].wall_heights, [2.5, 1.7, null, null, null]);
});

test("removing a corner that was added again leaves the room as it was, openings included (#157)", () => {
  const f = floorOf(room("r", rect(0, 0, 8, 6), { wall_heights: [[2.5, 1.7, 2], 2.4, null, null], wall_splits: [[2, 6], null, null, null], wall_thickness: [0.3, 0.2, null, null] }));
  f.openings = [
    { id: "w1", room_id: "r", edge: 0, offset: 1, width: 0.8, type: "window", sill: 0.9, height: 1.2 },
    { id: "w2", room_id: "r", edge: 0, offset: 7, width: 0.8, type: "window", sill: 0.9, height: 1.2 },
    { id: "d", room_id: "r", edge: 2, offset: 3, width: 0.9, type: "door", sill: 0, height: 2 },
  ] as Floor["openings"];
  const before = structuredClone(f);
  insertCorner(f, "r", 0, [4, 0]);
  assert.deepEqual(
    f.openings.map((o) => [o.id, o.edge, o.offset]),
    [["w1", 0, 1], ["w2", 1, 3], ["d", 3, 3]],
  );
  removeCorner(f, "r", 1);
  assert.deepEqual(f, before);
});

test("removing a real corner moves the later edges' splits with their walls and drops the removed edge's (#157)", () => {
  // corner 1 (8, 0) goes: edges 0 and 1 become the diagonal (0, 0) → (8, 6); edge 2 (split) becomes edge 1
  const f = floorOf(room("r", rect(0, 0, 8, 6), { wall_heights: [2.2, [1, 2], [2.5, 1.7], null], wall_splits: [null, [2], [3], null], wall_thickness: [0.3, 0.2, 0.25, null] }));
  const bottom = samples([[8, 6], [0, 6]]).slice(0, -1);
  const was = heights(f, "r", bottom);
  removeCorner(f, "r", 1);
  const r = f.rooms[0];
  assert.deepEqual(r.points, [[0, 0], [8, 6], [0, 6]]);
  assert.deepEqual(r.wall_splits, [null, [3], null]);
  assert.deepEqual(r.wall_heights, [2.2, [2.5, 1.7], null]);
  assert.deepEqual(r.wall_thickness, [0.3, 0.25, null]);
  assert.deepEqual(heights(f, "r", bottom), was, "the split wall keeps its parts");
});

test("removing an in-line corner between two different heights keeps both with a split (#157)", () => {
  const f = floorOf(room("r", [[0, 0], [4, 0], [8, 0], [8, 6], [0, 6]], { wall_heights: [2.5, 1.7, null, null, null] }));
  const along = samples(rect(0, 0, 8, 6));
  const was = heights(f, "r", along);
  removeCorner(f, "r", 1);
  assert.deepEqual(f.rooms[0].wall_splits, [[4], null, null, null]);
  assert.deepEqual(f.rooms[0].wall_heights, [[2.5, 1.7], null, null, null]);
  assert.deepEqual(heights(f, "r", along), was);
});

test("removing corner 0 joins the last edge with the first (#157)", () => {
  const f = floorOf(room("r", [[4, 0], [8, 0], [8, 6], [0, 6], [0, 0]], { wall_heights: [1.7, null, [2, 2.4], null, 2.5], wall_splits: [null, null, [4], null, null] }));
  const along = samples(rect(0, 0, 8, 6));
  const was = heights(f, "r", along);
  removeCorner(f, "r", 0);
  const r = f.rooms[0];
  assert.deepEqual(r.points, [[8, 0], [8, 6], [0, 6], [0, 0]]);
  assert.deepEqual(r.wall_splits, [null, [4], null, [4]]);
  assert.deepEqual(r.wall_heights, [null, [2, 2.4], null, [2.5, 1.7]]);
  assert.deepEqual(heights(f, "r", along), was);
});

test("a corner that cuts a neighbour's wall gives the new part of its per-part list the height of the part it cut (#157)", () => {
  // the lounge's top edge is cut at x = 4 by the two rooms above; its two parts have their own heights
  const lounge = room("lounge", rect(0, 0, 8, 6), { wall_heights: [[2.5, 2], null, null, null] });
  const f = floorOf(lounge, room("a", rect(0, -3, 4, 0)), room("b", rect(4, -3, 8, 0)));
  const top = samples([[0, 0], [8, 0]]);
  const was = heights(f, "lounge", top);
  // a corner in the middle of room a's bottom edge ((4, 0) → (0, 0)) is a new cut in the lounge's top edge
  insertCorner(f, "a", 2, [2, 0]);
  assert.deepEqual(f.rooms[0].wall_heights, [[2.5, 2.5, 2], null, null, null]);
  assert.deepEqual(heights(f, "lounge", top), was);
  // and taking it away again joins those parts
  removeCorner(f, "a", 3);
  assert.deepEqual(f.rooms[0].wall_heights, [[2.5, 2], null, null, null]);
});

// Removing a real corner (#206): rectangle 0..8 by 0..6, corner 1 = (8, 0). Edges 0 (0,0 -> 8,0) and 1 (8,0 -> 8,6)
// join into the diagonal (0,0) -> (8,6), 10 m long.
const opening = (id: string, edge: number, offset: number, width = 0.9): Floor["openings"][number] =>
  ({ id, room_id: "r", edge, offset, width, type: "door", sill: 0, height: 2 }) as Floor["openings"][number];

test("cornerLoss says what a real corner would cost and which openings still fit on the joined wall (#206)", () => {
  const f = floorOf(room("r", rect(0, 0, 8, 6), { wall_heights: [2.5, 2.2, null, null], wall_thickness: [0.3, 0.2, null, null] }));
  // a (edge 0, 1 m), b (edge 0, 7.8 m), d (edge 1, 1.5 m: 9.5 m along, fits), c (edge 1, 3 m: 8 + 3 = 11 m along: too far),
  // e (edge 2: not on the corner's walls)
  f.openings = [opening("a", 0, 1), opening("b", 0, 7.8), opening("c", 1, 3), opening("d", 1, 1.5), opening("e", 2, 2)];
  const loss = cornerLoss(f, "r", 1)!;
  assert.equal(loss.inLine, false);
  assert.deepEqual(loss.openings.map((o) => o.id), ["a", "b", "d", "c"]);
  assert.deepEqual(loss.fit.map((o) => o.id), ["a", "b", "d"], "c would sit 11 m along a 10 m wall");
  assert.equal(loss.height, true);
  assert.equal(loss.thickness, true);
});

test("cornerLoss: a corner in line with its neighbours costs nothing; equal heights and thicknesses are no change (#206)", () => {
  const inLine = floorOf(room("r", [[0, 0], [4, 0], [8, 0], [8, 6], [0, 6]], { wall_heights: [2.5, 1.7, null, null, null] }));
  inLine.openings = [opening("a", 0, 1)];
  assert.deepEqual(cornerLoss(inLine, "r", 1), { inLine: true, openings: [], fit: [], height: false, thickness: false });
  const same = floorOf(room("r", rect(0, 0, 8, 6), { wall_heights: [2.5, 2.5, null, null] }));
  const loss = cornerLoss(same, "r", 1)!;
  assert.equal(loss.height, false);
  assert.equal(loss.thickness, false);
  assert.equal(cornerLoss(floorOf(room("t", [[0, 0], [1, 0], [0, 1]])), "t", 0), null, "a triangle keeps its corners");
});

test("removeCorner drops the openings of a real corner unless they are kept; kept ones sit on the joined wall at their distance along it (#206)", () => {
  const make = () => {
    const f = floorOf(room("r", rect(0, 0, 8, 6)));
    f.openings = [opening("a", 0, 1), opening("d", 1, 1.5), opening("e", 2, 2)];
    return f;
  };
  const dropped = make();
  removeCorner(dropped, "r", 1);
  assert.deepEqual(dropped.openings.map((o) => o.id), ["e"], "dropped as before");
  const f = make();
  const loss = cornerLoss(f, "r", 1)!;
  assert.deepEqual(loss.fit.map((o) => o.id), ["a", "d"]);
  removeCorner(f, "r", 1, loss.fit.map((o) => o.id));
  assert.deepEqual(f.rooms[0].points, [[0, 0], [8, 6], [0, 6]]);
  // the diagonal is the new edge 0: a at 1 m from its start, d at 8 + 1.5 = 9.5 m; e (was edge 2) is edge 1 now
  assert.deepEqual(f.openings.map((o) => [o.id, o.edge, o.offset]), [["a", 0, 1], ["d", 0, 9.5], ["e", 1, 2]]);
});

test("removing corner 0 keeps the openings that fit on the joined wall too (#206)", () => {
  // corner 0 = (0, 0): the last edge (0, 6 -> 0, 0) and edge 0 (0, 0 -> 8, 0) join into (0, 6) -> (8, 0), 10 m
  const f = floorOf(room("r", rect(0, 0, 8, 6)));
  f.openings = [opening("last", 3, 5), opening("first", 0, 2), opening("far", 0, 7.9)];
  const loss = cornerLoss(f, "r", 0)!;
  assert.deepEqual(loss.fit.map((o) => o.id), ["last", "first"]);
  removeCorner(f, "r", 0, loss.fit.map((o) => o.id));
  assert.deepEqual(f.rooms[0].points, [[8, 0], [8, 6], [0, 6]]);
  assert.deepEqual(f.openings.map((o) => [o.id, o.edge, o.offset]), [["last", 2, 5], ["first", 2, 8]]);
});
