import assert from "node:assert/strict";
import { test } from "node:test";
import { openingEntities } from "./devices.ts";
import type { Building, Floor, Opening, Room } from "./model.ts";
import { PLAN_VERSION, emptyBuilding, newFloor } from "./model.ts";
import { linkedContactIds, saveAutomaticOpeningLinks } from "./opening-links.ts";
import type { HomeAssistant } from "./types.ts";

const room: Room = { id: "r", name: "R", area_id: "lounge", points: [[0, 0], [5, 0], [5, 4], [0, 4]], floor_material: "wood" };

function hassWith(ids: Record<string, string>): HomeAssistant {
  const entities: Record<string, unknown> = {};
  const states: Record<string, unknown> = {};
  for (const [id, cls] of Object.entries(ids)) {
    entities[id] = { entity_id: id, area_id: "lounge" };
    states[id] = { entity_id: id, state: "off", attributes: { device_class: cls } };
  }
  return { language: "en", areas: { lounge: { area_id: "lounge", name: "Lounge" } }, devices: {}, entities, states } as unknown as HomeAssistant;
}

const open = (id: string, type: Opening["type"], edge: number, extra: Partial<Opening> = {}): Opening => ({
  id, room_id: "r", edge, offset: 1, width: 1, type, sill: type === "window" ? 0.9 : 0, height: 1.3, hinge: "left", leaves: 1, swing: "in", cover: null, contact: null, contact2: null, tilt: null, ...extra,
});

function home(openings: Opening[]): Building {
  const floor: Floor = { ...newFloor("f", "F", 0), rooms: [room], openings };
  return { ...emptyBuilding(), floors: [floor] };
}

const SENSORS = {
  "binary_sensor.sample_window_a": "window",
  "binary_sensor.sample_window_b": "window",
  "binary_sensor.sample_door": "door",
  "binary_sensor.sample_garage": "garage_door",
};

test("openings get no contact sensor by position any more (#203)", () => {
  const hass = hassWith(SENSORS);
  const b = home([open("w1", "window", 0), open("d", "door", 1)]);
  const links = openingEntities(hass, b.floors);
  assert.equal(links.get("w1")!.contact, null);
  assert.equal(links.get("d")!.contact, null);
  // a link made by hand still works
  b.floors[0].openings[0].contact = "binary_sensor.sample_window_b";
  assert.equal(openingEntities(hass, b.floors).get("w1")!.contact, "binary_sensor.sample_window_b");
});

test("the migration saves the pairs a home showed, and leaves hand links, none and handle windows alone (#203)", () => {
  const hass = hassWith(SENSORS);
  const b = home([
    open("w2", "window", 2),
    open("w1", "window", 0),
    open("d", "door", 1),
    open("g", "garage", 3),
    open("w3", "window", 3, { contact: "none" }),
    open("w4", "window", 3, { sensor: "handle" }),
    open("w5", "window", 3, { contact: "binary_sensor.sample_door" }),
  ]);
  const written = saveAutomaticOpeningLinks(hass, b);
  const contact = (id: string) => b.floors[0].openings.find((o) => o.id === id)!.contact;
  // in the order the openings sit on the outline, one sensor per opening, as the old matching did
  assert.equal(contact("w1"), "binary_sensor.sample_window_a");
  assert.equal(contact("w2"), "binary_sensor.sample_window_b");
  assert.equal(contact("d"), "binary_sensor.sample_door");
  assert.equal(contact("g"), "binary_sensor.sample_garage");
  assert.equal(contact("w3"), "none");
  assert.equal(contact("w4"), null);
  assert.equal(contact("w5"), "binary_sensor.sample_door");
  assert.equal(written, 4);
  assert.equal(b.opening_links_saved, true);
  // what the 3D view draws now is what the old automatic matching drew
  const links = openingEntities(hass, b.floors);
  assert.equal(links.get("w1")!.contact, "binary_sensor.sample_window_a");
  assert.equal(links.get("d")!.contact, "binary_sensor.sample_door");
  assert.equal(links.get("w4")!.contact, null);
});

test("the migration runs once: a second run changes nothing, and a link cleared later stays cleared (#203)", () => {
  const hass = hassWith(SENSORS);
  const b = home([open("w1", "window", 0), open("d", "door", 1)]);
  assert.equal(saveAutomaticOpeningLinks(hass, b), 2);
  const saved = structuredClone(b);
  assert.equal(saveAutomaticOpeningLinks(hass, b), 0);
  assert.deepEqual(b, saved);
  b.floors[0].openings[0].contact = null;
  assert.equal(saveAutomaticOpeningLinks(hass, b), 0);
  assert.equal(b.floors[0].openings[0].contact, null);
});

test("the migration waits while Home Assistant has told no entities yet (#203)", () => {
  const b = home([open("w1", "window", 0)]);
  const hass = { ...hassWith({}), states: {} } as unknown as HomeAssistant;
  assert.equal(saveAutomaticOpeningLinks(hass, b), 0);
  assert.equal(b.opening_links_saved, undefined);
  assert.equal(saveAutomaticOpeningLinks(hassWith(SENSORS), b), 1);
  assert.equal(b.opening_links_saved, true);
});

test("the migration leaves the plan version alone: it is marked by its own flag, not by a version (#203, #165)", () => {
  for (const version of [1, PLAN_VERSION]) {
    const b = { ...home([open("w1", "window", 0)]), version };
    assert.equal(saveAutomaticOpeningLinks(hassWith(SENSORS), b), 1);
    assert.equal(b.version, version);
    assert.equal(b.opening_links_saved, true);
  }
  // a plan of the current version that is not marked yet still gets its links
  const fresh = home([open("w1", "window", 0)]);
  assert.equal(fresh.version, PLAN_VERSION);
  assert.equal(saveAutomaticOpeningLinks(hassWith(SENSORS), fresh), 1);
});

test("contact and tilt binary sensors linked to openings are the ones whose pins step aside (#349)", () => {
  const ids = linkedContactIds([
    { contact: "binary_sensor.a", contact2: "binary_sensor.b", tilt: "binary_sensor.c", cover: null } as never,
    { contact: "sensor.handle", tilt: null, cover: "cover.x" } as never,
    { contact: null } as never,
  ]);
  assert.deepEqual([...ids].sort(), ["binary_sensor.a", "binary_sensor.b", "binary_sensor.c"]);
});
