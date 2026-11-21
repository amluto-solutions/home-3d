// Some rooms on their own (#500, ported from NeonPlan 3D 4.0.0, MIT, Mastershort; our own tests): the plan cut down to
// them – shared walls, doors of hidden rooms, roof sections, the map – and the ids a card's `rooms` may hold.
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Building, type Opening, type RoofSection, type Room, type Vec2 } from "./model.ts";
import { floorsOfRooms, roomsOnly, shownRoomIds } from "./rooms-filter.ts";

const room = (id: string, points: Vec2[]): Room => ({ id, name: id, area_id: null, points }) as unknown as Room;
const door = (id: string, room_id: string, edge: number, offset: number): Opening =>
  ({ id, room_id, edge, offset, width: 0.9, type: "door", sill: 0, height: 2, hinge: "left", swing: "in" }) as unknown as Opening;

/** Two rooms side by side on the ground floor (a shared wall at x = 4), one room upstairs, a flat roof. */
function house(): Building {
  const b = emptyBuilding();
  const g = newFloor("g", "Ground", 0);
  g.rooms = [
    room("kids", [[0, 0], [4, 0], [4, 3], [0, 3]]),
    room("hall", [[4, 0], [8, 0], [8, 3], [4, 3]]),
  ];
  // the hall's door into the kids' room, on the hall's edge 3 (4,3) → (4,0), 1.5 m along
  g.openings = [door("d_kids", "hall", 3, 1.5), door("d_front", "hall", 0, 2)];
  g.furniture = [{ id: "bed", x: 1, z: 1 } as never, { id: "sofa", x: 6, z: 1 } as never];
  g.placements = [{ entity_id: "light.sample_kids", x: 2, z: 2 } as never, { entity_id: "light.sample_hall", x: 6, z: 2 } as never];
  g.outdoor = [{ id: "lawn", type: "lawn", points: [[0, 4], [8, 4], [8, 8], [0, 8]] } as never];
  g.walls = [{ id: "w_kids", a: [1, 1.5], b: [3, 1.5] }, { id: "w_hall", a: [5, 1.5], b: [7, 1.5] }];
  g.openings.push({ ...door("d_wall", "kids", 0, 1), wall: "w_kids" }, { ...door("d_wall2", "hall", 0, 1), wall: "w_hall" });
  const u = newFloor("u", "Upper", 2.75);
  u.rooms = [room("attic", [[0, 0], [8, 0], [8, 3], [0, 3]])];
  b.floors = [g, u];
  b.settings = { ...b.settings, roof: { ...b.settings.roof, type: "flat" }, surroundings: { on: true, buildings: [] } as never };
  return b;
}

test("shownRoomIds keeps the rooms and outdoor areas the plan has, once each, and ignores anything else", () => {
  const b = house();
  assert.deepEqual(shownRoomIds(b, ["kids", "gone", "lawn", "kids", 3]), ["kids", "lawn"]);
  assert.deepEqual(shownRoomIds(b, "kids"), [], "a string, not a list");
  assert.deepEqual(shownRoomIds(b, undefined), []);
  assert.deepEqual(shownRoomIds(null, ["kids"]), []);
  assert.deepEqual(floorsOfRooms(b, ["kids", "attic"]), ["g", "u"]);
  assert.deepEqual(floorsOfRooms(b, ["lawn"]), ["g"]);
});

test("roomsOnly keeps the room, what stands in it, its free walls and its doors; the others go", () => {
  const b = house();
  const cut = roomsOnly(b, ["kids"]);
  assert.deepEqual(cut.floors.map((f) => f.id), ["g"], "the floor without a shown room is left out");
  const g = cut.floors[0];
  assert.deepEqual(g.rooms.map((r) => r.id), ["kids"]);
  assert.deepEqual(g.furniture.map((m) => m.id), ["bed"]);
  assert.deepEqual(g.placements.map((p) => p.entity_id), ["light.sample_kids"], "only its devices are synced");
  assert.deepEqual(g.walls?.map((w) => w.id), ["w_kids"]);
  assert.deepEqual(g.outdoor, []);
  assert.ok(g.openings.some((o) => o.id === "d_wall"), "a door in a kept free wall stays");
  assert.ok(!g.openings.some((o) => o.id === "d_wall2" || o.id === "d_front"));
  assert.equal(b.floors[0].rooms.length, 2, "the plan itself is not changed");
  assert.equal(cut.settings.surroundings, null, "no map around some rooms");
  assert.ok(b.settings.surroundings, "the plan keeps its map");
});

test("a wall shared with a hidden room keeps the inner wall's thickness; the neighbour's door in it is filed under the shown room", () => {
  const b = house();
  const g = roomsOnly(b, ["kids"]).floors[0];
  const kids = g.rooms[0];
  // the kids' edge 1 runs (4,0) → (4,3): the wall shared with the hall
  assert.equal(kids.wall_thickness?.[1], b.settings.wall_interior);
  assert.equal(kids.wall_thickness?.[0], null, "an outer wall keeps the plan's");
  const d = g.openings.find((o) => o.id === "d_kids")!;
  assert.equal(d.room_id, "kids");
  assert.equal(d.edge, 1);
  assert.ok(Math.abs(d.offset - 1.5) < 1e-9, `offset ${d.offset}`);
  assert.equal(d.hinge, "right", "seen from the other side");
  assert.equal(d.swing, "out");
  // an own thickness is kept
  b.floors[0].rooms[0].wall_thickness = [null, 0.3, null, null];
  assert.equal(roomsOnly(b, ["kids"]).floors[0].rooms[0].wall_thickness?.[1], 0.3);
});

test("the flat or gable roof stays only over the whole top floor", () => {
  const b = house();
  assert.equal(roomsOnly(b, ["kids"]).settings.roof.type, "none", "without the top floor");
  assert.equal(roomsOnly(b, ["attic"]).settings.roof.type, "flat", "the whole top floor");
  const two = house();
  two.floors[1].rooms.push(room("bath", [[8, 0], [10, 0], [10, 3], [8, 3]]));
  assert.equal(roomsOnly(two, ["attic"]).settings.roof.type, "none", "only part of the top floor: no shrunken roof");
  assert.equal(roomsOnly(two, ["attic", "bath"]).settings.roof.type, "flat");
});

test("a roof of sections keeps the sections over the floors shown, a dormer with its section", () => {
  const b = house();
  const sec = (id: string, base: number, x0: number, x1: number, dormer = false): RoofSection =>
    ({ id, x0, z0: 0, x1, z1: 3, base, axis: "x", shape: "gable", eave_a: 0, eave_b: 0, pitch_a: 35, pitch_b: 35, dormer }) as unknown as RoofSection;
  // over the upper floor's attic, a dormer on it, and a lean-to over the ground floor's hall
  const top = sec("top", 5.5, 0, 8);
  const dormer = sec("dormer", 5.5, 3, 4, true);
  const low = sec("low", 2.5, 4, 8);
  b.settings.roof = { ...b.settings.roof, type: "custom", sections: [top, dormer, low] };
  const attic = roomsOnly(b, ["attic"]).settings.roof;
  assert.equal(attic.type, "custom");
  assert.deepEqual(attic.sections?.map((s) => s.id), ["top", "dormer"]);
  const ground = roomsOnly(b, ["hall"]).settings.roof;
  assert.deepEqual(ground.sections?.map((s) => s.id), ["low"]);
  const all = roomsOnly(b, ["hall", "kids", "attic"]);
  assert.equal(all.settings.roof, b.settings.roof, "every section shown: the roof object stays");
});
