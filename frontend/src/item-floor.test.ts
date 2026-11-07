import assert from "node:assert/strict";
import { test } from "node:test";
import type { Building, Floor, Furniture } from "./model.ts";
import { moveToFloor } from "./item-floor.ts";

const item = (id: string, extra: Partial<Furniture> = {}): Furniture =>
  ({ id, type: "tv", x: 1, z: 2, rotation: 0, w: 1, d: 0.2, h: 0.6, variant: null, ...extra }) as Furniture;

const floor = (id: string, furniture: Furniture[] = []): Floor =>
  ({ id, name: id, elevation: 0, height: 2.5, cut_height: 1.2, rooms: [], openings: [], furniture, placements: [], background: null, outdoor: [], ha_floor: null }) as Floor;

const building = (...floors: Floor[]): Building => ({ floors }) as unknown as Building;

test("an item moved to another floor keeps its id, place and entity links (#73)", () => {
  const doc = building(floor("ground", [item("tv", { entity: "media_player.sample_tv", power: "sensor.sample_tv_power", name: "Big TV" }), item("sofa")]), floor("first"));
  const moved = moveToFloor(doc, "ground", ["tv"], "first");
  assert.deepEqual(moved, ["tv"]);
  assert.deepEqual(doc.floors[0].furniture.map((f) => f.id), ["sofa"]);
  const tv = doc.floors[1].furniture[0];
  assert.equal(tv.id, "tv");
  assert.equal(tv.entity, "media_player.sample_tv");
  assert.equal(tv.power, "sensor.sample_tv_power");
  assert.equal(tv.name, "Big TV");
  assert.deepEqual([tv.x, tv.z], [1, 2]);
});

test("moving a selection carries every item of it, in its order (#73)", () => {
  const doc = building(floor("ground", [item("a", { group: "k" }), item("b"), item("c", { group: "k" })]), floor("first", [item("old")]));
  moveToFloor(doc, "ground", ["a", "c"], "first");
  assert.deepEqual(doc.floors[0].furniture.map((f) => f.id), ["b"]);
  assert.deepEqual(doc.floors[1].furniture.map((f) => f.id), ["old", "a", "c"]);
  assert.equal(doc.floors[1].furniture[1].group, "k");
});

test("moving to the same floor or a floor that isn't there changes nothing (#73)", () => {
  const doc = building(floor("ground", [item("a")]), floor("first"));
  assert.deepEqual(moveToFloor(doc, "ground", ["a"], "ground"), []);
  assert.deepEqual(moveToFloor(doc, "ground", ["a"], "attic"), []);
  assert.deepEqual(moveToFloor(doc, "ground", ["nope"], "first"), []);
  assert.deepEqual(doc.floors[0].furniture.map((f) => f.id), ["a"]);
  assert.equal(doc.floors[1].furniture.length, 0);
});
