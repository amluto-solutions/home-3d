// A 3D sync of a large plan (#393): what does not change between state updates is worked out once – the weather and
// locating sensors among all states, each item's base height and room, a pack item's energy role and plant look – and
// worked out again as soon as what it depends on changes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { idsWhere } from "./state-index.ts";
import { roomHolding, newFloor, type Floor, type Furniture } from "./model.ts";
import { energyRole, mountBase, setPacks } from "./packs.ts";
import { weatherEntity } from "./weather.ts";
import { EDITOR_SENSOR_SYNC_MS, EDITOR_SYNC_MS } from "./viewer/pace.ts";
import type { HomeAssistant } from "./types.ts";

const st = (id: string, state = "1", attributes: Record<string, unknown> = {}) => ({ entity_id: id, state, attributes });
const hassOf = (states: Record<string, ReturnType<typeof st>>, entities: object = {}) => ({ states, entities }) as unknown as HomeAssistant;

test("ids picked out of all states are kept while the entities stay, and found again when one comes or the registry changes", () => {
  const entities = {};
  const h1 = hassOf({ "weather.sample_home": st("weather.sample_home", "sunny"), "sensor.sample_power": st("sensor.sample_power") }, entities);
  let calls = 0;
  const test1 = (id: string) => (calls++, id.startsWith("weather."));
  assert.deepEqual(idsWhere(h1, "t", test1), ["weather.sample_home"]);
  const n = calls;
  // a new value of a sensor: a new states object with the same entities, nothing looked through again
  const h2 = hassOf({ ...h1.states, "sensor.sample_power": st("sensor.sample_power", "2") }, entities);
  assert.deepEqual(idsWhere(h2, "t", test1), ["weather.sample_home"]);
  assert.equal(calls, n);
  // an entity came: found again
  const h3 = hassOf({ ...h2.states, "weather.sample_away": st("weather.sample_away") }, entities);
  assert.deepEqual(idsWhere(h3, "t", test1), ["weather.sample_home", "weather.sample_away"]);
  assert.equal(weatherEntity(h3), "weather.sample_away");
  // the registry changed: found again
  assert.deepEqual(idsWhere(hassOf(h1.states, {}), "t", test1), ["weather.sample_home"]);
});

const item = (extra: Partial<Furniture> = {}): Furniture => ({ id: "i", type: "lamp_wall", x: 1, z: 1, rotation: 0, w: 0.2, d: 0.2, h: 0.3, variant: null, entity: null, power: null, ...extra });

test("an item's base height is kept per floor and item, and follows the item's own fields and new packs", () => {
  const floor: Floor = { ...newFloor("f", "F", 0), rooms: [{ id: "a", name: "a", area_id: null, points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "wood" }] };
  const f = item();
  const y = mountBase(floor, f);
  assert.equal(mountBase(floor, f), y);
  // set by hand (the wall view lifts it in place): the new height, not the kept one
  f.mount_y = 2.1;
  assert.equal(mountBase(floor, f), 2.1);
  f.mount_y = null;
  assert.equal(mountBase(floor, f), y);
  setPacks([]);
  assert.equal(mountBase(floor, f), y);
  assert.equal(energyRole("meter"), "meter");
  assert.equal(energyRole("sofa"), null);
});

test("the room holding a point is kept per floor; new rooms find it again", () => {
  const room = (id: string, x0: number) => ({ id, name: id, area_id: null, points: [[x0, 0], [x0 + 4, 0], [x0 + 4, 3], [x0, 3]] as [number, number][], floor_material: "wood" as const });
  const floor = { ...newFloor("f", "F", 0), rooms: [room("a", 0), room("b", 4)] };
  assert.equal(roomHolding(floor, 5, 1)?.id, "b");
  assert.equal(roomHolding(floor, 5, 1)?.id, "b");
  assert.equal(roomHolding(floor, 9, 1), undefined);
  floor.rooms = [room("c", 4)];
  assert.equal(roomHolding(floor, 5, 1)?.id, "c");
});

test("beside the editor measured values alone show at most every 2 s, a switch or lamp within 1 s", () => {
  assert.ok(EDITOR_SENSOR_SYNC_MS > EDITOR_SYNC_MS && EDITOR_SENSOR_SYNC_MS <= 2000);
});
