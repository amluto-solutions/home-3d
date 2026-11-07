import assert from "node:assert/strict";
import { test } from "node:test";

test("a lamp switched by a relay takes colour and brightness from its colour entity", async () => {
  const { lightGlow } = await import("./devices.ts");
  const relay = { entity_id: "switch.relay", state: "on", attributes: {}, last_changed: "", last_updated: "", context: { id: "", user_id: null, parent_id: null } };
  const bulb = { ...relay, entity_id: "light.bulb", attributes: { brightness: 255, rgb_color: [0, 0, 255], color_mode: "rgb" } };
  const g = lightGlow(relay as never, bulb as never)!;
  assert.deepEqual(g.color, [0, 0, 1]);
  assert.equal(g.level, 1);
  // the relay off: no glow, whatever the bulb says
  assert.equal(lightGlow({ ...relay, state: "off" } as never, bulb as never), null);
  // the bulb unavailable: the relay's own (plain) glow
  assert.deepEqual(lightGlow(relay as never, { ...bulb, state: "unavailable" } as never)!.color, [1, 0.71, 0.28]);
});
import { climateReading, coverTiltButtons, isPulseDrive, isRelevant, apOnline, fanSpeed, climateModeGlow, cooktopLevel, onlyColor, appColor, carLocked, areaEntities, otherAreaEntities, roomClimateSensors, roomClimateValue, unassignedEntities, autoPlace, entityName, fridgeDoors, furnitureEntities, groupByDevice, isActive, kindOf, lightGlow, openingEntities, openingState, powerSensorsOf, primaryEntities, roomPanelEntities, windowPosition, confirmEntities, robotRoom, robotRoomSensor, roomKey, vacuumCleaning } from "./devices.ts";
import type { Floor, Opening, Room } from "./model.ts";
import { centroid, newFloor, pointInPolygon } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

/** Opening state without the "sensed" flag (tested on its own below). */
function stateOf(...args: Parameters<typeof openingState>) {
  const { sensed: _sensed, ...rest } = openingState(...args);
  return rest;
}

function hassWith(): HomeAssistant {
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });
  return {
    language: "en",
    connection: {} as HomeAssistant["connection"],
    callWS: async () => undefined as never,
    callService: async () => undefined,
    areas: { living: { area_id: "living", name: "Living room" } },
    devices: { d1: { id: "d1", area_id: "living" } },
    entities: {
      "light.ceiling": { entity_id: "light.ceiling", area_id: "living" },
      "light.floor_lamp": { entity_id: "light.floor_lamp", device_id: "d1" },
      "switch.hidden": { entity_id: "switch.hidden", area_id: "living", hidden: true },
      "switch.firmware": { entity_id: "switch.firmware", area_id: "living", entity_category: "config" },
      "sensor.temp": { entity_id: "sensor.temp", area_id: "living" },
      "sensor.signal": { entity_id: "sensor.signal", area_id: "living" },
      "cover.blind": { entity_id: "cover.blind", area_id: "living" },
      "light.kitchen": { entity_id: "light.kitchen", area_id: "kitchen" },
      "update.x": { entity_id: "update.x", area_id: "living" },
    },
    states: {
      "light.ceiling": st("light.ceiling", "on", { friendly_name: "Living room Ceiling", brightness: 128, color_mode: "color_temp", color_temp_kelvin: 2700 }),
      "light.floor_lamp": st("light.floor_lamp", "off", { friendly_name: "Floor lamp" }),
      "switch.hidden": st("switch.hidden", "on"),
      "switch.firmware": st("switch.firmware", "on"),
      "sensor.temp": st("sensor.temp", "21.5", { device_class: "temperature", friendly_name: "Temperature" }),
      "sensor.signal": st("sensor.signal", "-60", { device_class: "signal_strength" }),
      "cover.blind": st("cover.blind", "open", { friendly_name: "Shutter" }),
      "light.kitchen": st("light.kitchen", "on"),
      "update.x": st("update.x", "off"),
    },
  };
}

test("area entities include device areas and skip hidden, config and unsupported entities", () => {
  const ids = areaEntities(hassWith(), "living");
  assert.deepEqual(ids, ["light.ceiling", "light.floor_lamp", "cover.blind", "sensor.temp"]);
  assert.deepEqual(areaEntities(hassWith(), null), []);
});

test("entity names drop the area prefix", () => {
  const hass = hassWith();
  assert.equal(entityName(hass, "light.ceiling", "Living room"), "Ceiling");
  assert.equal(entityName(hass, "light.floor_lamp", "Living room"), "Floor lamp");
});

test("kinds, active states and light glow", () => {
  const hass = hassWith();
  assert.equal(kindOf("media_player.tv"), "media");
  assert.equal(kindOf("input_boolean.guest"), "switch");
  assert.equal(kindOf("automation.x"), null);
  assert.ok(isActive(hass.states["light.ceiling"]));
  assert.ok(isActive(hass.states["cover.blind"]));
  assert.ok(!isActive(hass.states["light.floor_lamp"]));
  const glow = lightGlow(hass.states["light.ceiling"])!;
  // a perceptual curve: half brightness glows at 0.2 + 0.8 * sqrt(0.5), a lamp at 10 % still clearly "on"
  assert.ok(Math.abs(glow.level - (0.2 + 0.8 * Math.sqrt(128 / 255))) < 1e-9);
  assert.ok(lightGlow({ ...hass.states["light.ceiling"], attributes: { ...hass.states["light.ceiling"].attributes, brightness: 26 } })!.level > 0.4);
  assert.ok(glow.color[0] > glow.color[2], "2700 K is warm");
  assert.equal(lightGlow(hass.states["light.floor_lamp"]), null);
});

const room: Room = { id: "r", name: "R", area_id: null, points: [[0, 0], [5, 0], [5, 4], [0, 4]], floor_material: "wood" };

test("automatic placement keeps devices inside the room, apart, and off the room label", () => {
  const ids = ["light.a", "light.b", "switch.c", "sensor.d", "cover.e"];
  const out = autoPlace(room, ids);
  assert.equal(out.length, ids.length);
  const label = centroid(room.points);
  for (const p of out) {
    assert.ok(pointInPolygon([p.x, p.z], room.points));
    // lamps hang from the ceiling and may sit above the room label; other markers keep it free
    if (!p.entity_id.startsWith("light.")) assert.ok(Math.hypot(p.x - label[0], p.z - label[1]) >= 0.69, "room label stays free");
  }
  const first = autoPlace(room, ["light.a"])[0];
  assert.ok(Math.hypot(first.x - label[0], first.z - label[1]) < 0.3, "a single ceiling light goes to the middle");
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) assert.ok(Math.hypot(out[i].x - out[j].x, out[i].z - out[j].z) > 0.8);
  }
  assert.deepEqual(autoPlace(room, ids), out, "deterministic");
});

test("automatic placement avoids markers that are already there", () => {
  const [first] = autoPlace(room, ["switch.a"]);
  const [second] = autoPlace(room, ["switch.b"], [[first.x, first.z]]);
  assert.ok(Math.hypot(first.x - second.x, first.z - second.z) > 1);
});

test("automatic placement works in a tiny room", () => {
  const tiny: Room = { ...room, points: [[0, 0], [0.8, 0], [0.8, 0.8], [0, 0.8]] };
  const out = autoPlace(tiny, ["light.a", "switch.b"]);
  assert.equal(out.length, 2);
  for (const p of out) assert.ok(pointInPolygon([p.x, p.z], tiny.points));
});

test("doors and windows get the blind of their room's area; contact sensors only when linked by hand (#203)", () => {
  const hass = hassWith();
  hass.entities!["binary_sensor.f1"] = { entity_id: "binary_sensor.f1", area_id: "living" };
  hass.entities!["binary_sensor.f2"] = { entity_id: "binary_sensor.f2", area_id: "living" };
  hass.entities!["binary_sensor.door"] = { entity_id: "binary_sensor.door", area_id: "living" };
  hass.states["binary_sensor.f1"] = { entity_id: "binary_sensor.f1", state: "on", attributes: { device_class: "window" } };
  hass.states["binary_sensor.f2"] = { entity_id: "binary_sensor.f2", state: "off", attributes: { device_class: "window" } };
  hass.states["binary_sensor.door"] = { entity_id: "binary_sensor.door", state: "off", attributes: { device_class: "door" } };
  const o = (id: string, type: "door" | "window", edge: number, extra: Partial<Opening> = {}): Opening => ({
    id, room_id: "r", edge, offset: 1, width: 1, type, sill: 0.9, height: 1.3, hinge: "left", leaves: 1, swing: "in", cover: null, contact: null, contact2: null, tilt: null, ...extra,
  });
  const floor: Floor = {
    ...newFloor("f", "F", 0),
    rooms: [{ ...room, area_id: "living" }],
    openings: [o("w2", "window", 2), o("w1", "window", 0), o("d", "door", 1), o("w3", "window", 3, { cover: "none", contact: "binary_sensor.door" })],
  };
  const links = openingEntities(hass, [floor]);
  // the only blind of the area serves every window without its own choice; no sensor is handed out by position
  assert.deepEqual(links.get("w1"), { cover: "cover.blind", contact: null, tilt: null, contact2: null, tilt2: null, position: null, positionInverted: false, tiltAngle: null, tiltMax: null, tiltOffset: null, tiltInvert: false, shut: false, lock: null });
  assert.deepEqual(links.get("w2"), { cover: "cover.blind", contact: null, tilt: null, contact2: null, tilt2: null, position: null, positionInverted: false, tiltAngle: null, tiltMax: null, tiltOffset: null, tiltInvert: false, shut: false, lock: null });
  assert.deepEqual(links.get("w3"), { cover: null, contact: "binary_sensor.door", tilt: null, contact2: null, tilt2: null, position: null, positionInverted: false, tiltAngle: null, tiltMax: null, tiltOffset: null, tiltInvert: false, shut: false, lock: null });
  assert.deepEqual(links.get("d"), { cover: null, contact: null, tilt: null, contact2: null, tilt2: null, position: null, positionInverted: false, tiltAngle: null, tiltMax: null, tiltOffset: null, tiltInvert: false, shut: false, lock: null });
});

test("a position sensor drives the blind live, as a percentage or a fraction", () => {
  const hass = hassWith();
  hass.states["cover.blind"] = { entity_id: "cover.blind", state: "closing", attributes: { current_position: 100 } };
  hass.states["sensor.level"] = { entity_id: "sensor.level", state: "0.25", attributes: {} };
  const e = { cover: "cover.blind", contact: null, tilt: null, position: "sensor.level" };
  assert.equal(stateOf(hass, e).cover, 0.75);
  hass.states["sensor.level"].state = "60";
  assert.equal(stateOf(hass, e).cover, 0.4);
  assert.equal(stateOf(hass, { ...e, positionInverted: true }).cover, 0.6);
  hass.states["sensor.level"] = { entity_id: "sensor.level", state: "1", attributes: { unit_of_measurement: "%" } };
  assert.equal(stateOf(hass, e).cover, 0.99);
  // an unavailable sensor leaves the cover entity in charge (its position: fully open)
  hass.states["sensor.level"].state = "unavailable";
  assert.equal(stateOf(hass, e).cover, 0);
});

test("opening states: open, tilted and blind position", () => {
  const hass = hassWith();
  hass.states["binary_sensor.k"] = { entity_id: "binary_sensor.k", state: "on", attributes: {} };
  hass.states["binary_sensor.t"] = { entity_id: "binary_sensor.t", state: "on", attributes: {} };
  hass.states["cover.p"] = { entity_id: "cover.p", state: "open", attributes: { current_position: 25 } };
  assert.deepEqual(stateOf(hass, { cover: null, contact: "binary_sensor.k", tilt: null }), { open: 1, open2: 0, tilt: 0, tilt2: 0, cover: null });
  assert.deepEqual(stateOf(hass, { cover: "cover.p", contact: "binary_sensor.k", tilt: "binary_sensor.t" }), { open: 0, open2: 0, tilt: 1, tilt2: 0, cover: 0.75 });
  assert.deepEqual(stateOf(hass, { cover: "cover.blind", contact: null, tilt: null }), { open: 0, open2: 0, tilt: 0, tilt2: 0, cover: 0 });
});

test("garage doors use garage covers and contacts; door leaves follow their contact or stand half open", () => {
  const hass = hassWith();
  const add = (id: string, state: string, attributes: Record<string, unknown>) => {
    hass.entities![id] = { entity_id: id, area_id: "living" };
    hass.states[id] = { entity_id: id, state, attributes };
  };
  add("cover.gate_door", "open", { device_class: "garage" });
  add("binary_sensor.door", "on", { device_class: "door" });
  const o = (id: string, type: Opening["type"], edge: number): Opening => ({
    id, room_id: "r", edge, offset: 1, width: 1, type, sill: 0, height: 2, hinge: "left", leaves: 1, swing: "in", cover: null, contact: null, contact2: null, tilt: null,
  });
  const floor: Floor = { ...newFloor("f", "F", 0), rooms: [{ ...room, area_id: "living" }], openings: [o("g", "garage", 0), o("w", "window", 1), o("d", "door", 2)] };
  const links = openingEntities(hass, [floor]);
  // the garage cover goes to the garage door only; the window keeps the ordinary blind
  assert.equal(links.get("g")!.cover, "cover.gate_door");
  assert.equal(links.get("w")!.cover, "cover.blind");
  assert.equal(links.get("d")!.contact, null);
  assert.deepEqual(stateOf(hass, links.get("g")!, "garage"), { open: 0, open2: 0, tilt: 0, tilt2: 0, cover: 0 });
  hass.states["cover.gate_door"] = { entity_id: "cover.gate_door", state: "closing", attributes: { device_class: "garage" } };
  assert.equal(stateOf(hass, links.get("g")!, "garage").cover, 0.5);
  assert.equal(stateOf(hass, { ...links.get("d")!, contact: "binary_sensor.door" }, "door").open, 1);
  assert.equal(stateOf(hass, { cover: null, contact: null, tilt: null }, "door").open, 0.5);
});

test("entities are grouped by device; the entity without a name of its own is the main one", () => {
  const hass = hassWith();
  const add = (id: string, device: string, name?: string) => {
    hass.entities![id] = { entity_id: id, area_id: "living", device_id: device, ...(name ? { name } : {}) };
    hass.states[id] = { entity_id: id, state: "on", attributes: { friendly_name: name ?? "Awtrix" } };
  };
  add("light.awtrix_indicator_1", "awtrix", "Indicator 1");
  add("light.awtrix_matrix", "awtrix", "Matrix");
  add("light.awtrix", "awtrix");
  add("light.awtrix_indicator_2", "awtrix", "Indicator 2");
  const ids = areaEntities(hass, "living").filter((id) => kindOf(id) === "light");
  const groups = groupByDevice(hass, ids);
  const awtrix = groups.find((g) => g.primary === "light.awtrix")!;
  assert.deepEqual([...awtrix.others].sort(), ["light.awtrix_indicator_1", "light.awtrix_indicator_2", "light.awtrix_matrix"]);
  // entities without a device are their own group
  assert.ok(groups.some((g) => g.primary === "light.ceiling" && g.others.length === 0));
  assert.deepEqual(primaryEntities(hass, ids).length, groups.length);
});

test("a camera is never folded under another entity of its device, even when every entity has a name (#517)", () => {
  const hass = hassWith();
  const add = (id: string, name: string) => {
    hass.entities![id] = { entity_id: id, area_id: "living", device_id: "unifi_cam", name };
    hass.states[id] = { entity_id: id, state: "on", attributes: { friendly_name: name } };
  };
  add("switch.indoor_status_light", "Status light");
  add("binary_sensor.indoor_motion", "Motion");
  add("camera.indoor_high_resolution_channel", "High resolution channel");
  const groups = groupByDevice(hass, ["switch.indoor_status_light", "binary_sensor.indoor_motion", "camera.indoor_high_resolution_channel"]);
  assert.ok(groups.some((g) => g.primary === "camera.indoor_high_resolution_channel"));
  // the rest of the device stays one group
  assert.equal(groups.length, 2);
});

test("furniture finds its entities in the room's area: the TV, and power sensors by device or name", () => {
  const hass = hassWith();
  const add = (id: string, state: string, attributes: Record<string, unknown>, device?: string) => {
    hass.entities![id] = { entity_id: id, area_id: "living", ...(device ? { device_id: device } : {}) };
    hass.states[id] = { entity_id: id, state, attributes };
  };
  add("media_player.soundbar", "on", { friendly_name: "Soundbar" });
  add("media_player.television", "on", { friendly_name: "Television", device_class: "tv", app_name: "Netflix" }, "d_tv");
  add("sensor.tv_power", "95", { friendly_name: "TV power", device_class: "power" }, "d_tv");
  add("sensor.fridge_power", "80", { friendly_name: "Fridge power", device_class: "power" });
  const item = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, x: 2, z: 1.5, rotation: 0, w: 1, d: 0.5, h: 0.5, variant: null, entity: null, power: null, ...extra });
  const floor: Floor = {
    ...newFloor("f", "F", 0),
    rooms: [{ ...room, area_id: "living" }],
    furniture: [item("tv", "tv_board"), item("fridge", "fridge"), item("sofa", "sofa"), item("desk", "desk", { power: "none" })],
  };
  const links = furnitureEntities(hass, [floor]);
  assert.deepEqual(links.get("tv"), { entity: "media_player.television", power: "sensor.tv_power" });
  assert.deepEqual(links.get("fridge"), { entity: null, power: "sensor.fridge_power" });
  assert.equal(links.get("sofa"), undefined);
  assert.equal(links.get("desk"), undefined);
  assert.deepEqual(appColor(hass.states["media_player.television"]), [0.9, 0.04, 0.08]);
  assert.equal(appColor({ entity_id: "media_player.x", state: "off", attributes: {} }), null);
});

test("an awning over the terrace takes the terrace area's awning cover, never a roller blind (#688)", () => {
  const hass = hassWith();
  const add = (id: string, attributes: Record<string, unknown>) => {
    hass.entities![id] = { entity_id: id, area_id: "terrace" };
    hass.states[id] = { entity_id: id, state: "closed", attributes };
  };
  add("cover.terrace_shutter", { friendly_name: "Terrace door shutter", device_class: "shutter" });
  add("cover.awning", { friendly_name: "Awning", device_class: "awning" });
  const awning = { id: "aw", type: "awning", x: 5, z: 5, rotation: 0, w: 3, d: 2.5, h: 0.22, variant: null, entity: null, power: null };
  const floor: Floor = {
    ...newFloor("f", "F", 0),
    rooms: [],
    outdoor: [{ id: "t", type: "terrace", points: [[4, 4], [8, 4], [8, 8], [4, 8]], area_id: "terrace" }] as Floor["outdoor"],
    furniture: [awning, { ...awning, id: "aw2", x: 6 }],
  };
  const links = furnitureEntities(hass, [floor]);
  assert.deepEqual(links.get("aw"), { entity: "cover.awning", power: null });
  // a second awning finds no other awning cover: it stays unlinked instead of taking the roller blind
  assert.equal(links.get("aw2"), undefined);
});

test("lamps take a light of their room, preferring one whose name fits", () => {
  const hass = hassWith();
  hass.entities!["light.floor_lamp"].area_id = "living";
  const lamp = (id: string, type: string, entity: string | null = null) => ({ id, type, x: 2, z: 1.5, rotation: 0, w: 0.4, d: 0.4, h: 1.7, variant: null, entity, power: null });
  const floor: Floor = {
    ...newFloor("f", "F", 0),
    rooms: [{ ...room, area_id: "living" }],
    furniture: [lamp("a", "lamp_floor"), lamp("b", "lamp_ceiling"), lamp("c", "lamp_table")],
  };
  const links = furnitureEntities(hass, [floor]);
  assert.equal(links.get("a")!.entity, "light.floor_lamp");
  assert.equal(links.get("b")!.entity, "light.ceiling");
  // no free light left for the third lamp
  assert.equal(links.get("c"), undefined);
});

test("double doors and French windows: the second leaf follows a contact of its own", () => {
  const hass = hassWith();
  hass.states["binary_sensor.a"] = { entity_id: "binary_sensor.a", state: "off", attributes: { device_class: "door" } };
  hass.states["binary_sensor.b"] = { entity_id: "binary_sensor.b", state: "on", attributes: { device_class: "door" } };
  const e = { cover: null, contact: "binary_sensor.a", tilt: null, contact2: "binary_sensor.b" };
  assert.deepEqual(stateOf(hass, e, "window"), { open: 0, open2: 1, tilt: 0, tilt2: 0, cover: null });
  assert.deepEqual(stateOf(hass, e, "door"), { open: 0, open2: 1, tilt: 0, tilt2: 0, cover: null });
  // without a sensor the second leaf of a double door stays shut
  assert.equal(stateOf(hass, { cover: null, contact: null, tilt: null }, "door").open2, 0);
});

test("the room panel shows what the plan shows in the room, plus picked entities", () => {
  const hass = hassWith();
  const floor: Floor = {
    ...newFloor("f", "F", 0),
    rooms: [{ ...room, area_id: "living", panel: ["sensor.signal"] }],
    placements: [{ entity_id: "cover.blind", x: 1, z: 1, y: null, mount: null }],
    furniture: [{ id: "l", type: "lamp_ceiling", x: 2, z: 2, rotation: 0, w: 0.4, d: 0.4, h: 0.1, variant: null, entity: "light.ceiling", power: null }],
  };
  const { shown, more } = roomPanelEntities(hass, floor, floor.rooms[0]);
  assert.deepEqual(shown.sort(), ["cover.blind", "light.ceiling", "sensor.signal"]);
  // the rest of the area is offered, not shown
  assert.ok(more.includes("sensor.temp"));
  assert.ok(!more.includes("light.ceiling"));
});

test("window handles with three states, HomematicIP window_state and plain contacts", () => {
  const st = (state: string, attributes: Record<string, unknown> = {}) => ({ entity_id: "x", state, attributes });
  assert.equal(windowPosition(st("on")), "open");
  assert.equal(windowPosition(st("off")), "closed");
  assert.equal(windowPosition(st("tilted")), "tilted");
  assert.equal(windowPosition(st("Closed")), "closed");
  assert.equal(windowPosition(st("on", { window_state: "TILTED" })), "tilted");
  assert.equal(windowPosition(st("unavailable")), null);
  assert.equal(windowPosition(st("42")), null);

  const hass = hassWith();
  hass.states["sensor.handle"] = { entity_id: "sensor.handle", state: "tilted", attributes: {} };
  const e = { cover: null, contact: "sensor.handle", tilt: null };
  assert.deepEqual(stateOf(hass, e, "window"), { open: 0, open2: 0, tilt: 1, tilt2: 0, cover: null });
  hass.states["sensor.handle"] = { entity_id: "sensor.handle", state: "open", attributes: {} };
  assert.equal(stateOf(hass, e, "window").open, 1);
  // a sensor that only knows "tilted or not" goes into the tilt field
  hass.states["binary_sensor.tilt"] = { entity_id: "binary_sensor.tilt", state: "on", attributes: {} };
  hass.states["binary_sensor.open"] = { entity_id: "binary_sensor.open", state: "on", attributes: {} };
  assert.deepEqual(stateOf(hass, { cover: null, contact: "binary_sensor.open", tilt: "binary_sensor.tilt" }, "window"), { open: 0, open2: 0, tilt: 1, tilt2: 0, cover: null });
});

test("each leaf of a double window has its own kind of sensor", () => {
  const hass = hassWith();
  // left: a handle sensor that reports tilted; right: a plain contact that is open
  hass.states["sensor.handle_left"] = { entity_id: "sensor.handle_left", state: "tilted", attributes: {} };
  hass.states["binary_sensor.right"] = { entity_id: "binary_sensor.right", state: "on", attributes: {} };
  const e = { cover: null, contact: "sensor.handle_left", tilt: null, contact2: "binary_sensor.right", tilt2: null };
  assert.deepEqual(stateOf(hass, e, "window"), { open: 0, open2: 1, tilt: 1, tilt2: 0, cover: null });
  // the second leaf tilts with a handle sensor too
  hass.states["sensor.handle_right"] = { entity_id: "sensor.handle_right", state: "Tilted", attributes: {} };
  assert.equal(stateOf(hass, { ...e, contact2: "sensor.handle_right" }, "window").tilt2, 1);
});

test("area and power lookups are cached per registry and refreshed when the registry changes", () => {
  const hass = hassWith();
  hass.entities!["sensor.power"] = { entity_id: "sensor.power", device_id: "d1" };
  hass.states["sensor.power"] = { entity_id: "sensor.power", state: "12", attributes: { device_class: "power" } };
  const first = areaEntities(hass, "living");
  // the same registry gives the same list (no scan, no new array)
  assert.equal(areaEntities(hass, "living"), first);
  assert.deepEqual(powerSensorsOf(hass, "d1"), ["sensor.power"]);
  // Home Assistant replaces the registry object when an entity is added
  hass.entities = { ...hass.entities, "light.new": { entity_id: "light.new", area_id: "living" } };
  hass.states = { ...hass.states, "light.new": { entity_id: "light.new", state: "off", attributes: {} } };
  assert.ok(areaEntities(hass, "living").includes("light.new"));
  // a state that appears for a known entity (the registry object stays) is picked up as well
  hass.entities = { ...hass.entities, "light.late": { entity_id: "light.late", area_id: "living" } };
  hass.states = { ...hass.states };
  assert.ok(!areaEntities(hass, "living").includes("light.late"));
  hass.states = { ...hass.states, "light.late": { entity_id: "light.late", state: "on", attributes: {} } };
  assert.ok(areaEntities(hass, "living").includes("light.late"));
});

test("smart fridge doors follow their door sensors ('on' or 'open'; none/unset = closed)", () => {
  const hass = hassWith();
  hass.states["binary_sensor.freezer"] = { entity_id: "binary_sensor.freezer", state: "on", attributes: {} };
  hass.states["binary_sensor.fridge"] = { entity_id: "binary_sensor.fridge", state: "off", attributes: {} };
  const floor = {
    ...newFloor("f", "F", 0),
    furniture: [
      { id: "a", type: "fridge_smart", x: 1, z: 1, rotation: 0, w: 0.9, d: 0.7, h: 1.8, variant: null, door_left: "binary_sensor.freezer", door_right: "binary_sensor.fridge" },
      { id: "b", type: "fridge_smart", x: 3, z: 1, rotation: 0, w: 0.9, d: 0.7, h: 1.8, variant: null, door_right: "none" },
      { id: "c", type: "fridge", x: 5, z: 1, rotation: 0, w: 0.6, d: 0.6, h: 1.8, variant: null },
    ],
  };
  assert.deepEqual(
    [...fridgeDoors(hass, [floor])],
    [
      ["a", { left: true, right: false }],
      ["b", { left: false, right: false }],
    ],
  );
});

test("meters and air sensors are offered, battery and signal sensors are not", () => {
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });
  const ids = ["sensor.gasmeter_value", "sensor.water_meter_value", "sensor.old_meter", "sensor.lux", "sensor.battery", "sensor.text"];
  const hass = {
    ...hassWith(),
    entities: Object.fromEntries(ids.map((id) => [id, { entity_id: id, area_id: "cellar" }])),
    states: {
      "sensor.gasmeter_value": st("sensor.gasmeter_value", "1234.567", { device_class: "gas", unit_of_measurement: "m³" }),
      "sensor.water_meter_value": st("sensor.water_meter_value", "456.7", { device_class: "water", unit_of_measurement: "m³" }),
      "sensor.old_meter": st("sensor.old_meter", "99.1", { unit_of_measurement: "m³" }),
      "sensor.lux": st("sensor.lux", "320", { device_class: "illuminance", unit_of_measurement: "lx" }),
      "sensor.battery": st("sensor.battery", "80", { device_class: "battery", unit_of_measurement: "%" }),
      "sensor.text": st("sensor.text", "ok"),
    },
  } as HomeAssistant;
  assert.deepEqual(areaEntities(hass, "cellar").sort(), ["sensor.gasmeter_value", "sensor.lux", "sensor.old_meter", "sensor.water_meter_value"]);
});

test("an opening state knows whether a sensor reports it", () => {
  const hass = {
    states: {
      "binary_sensor.wc": { entity_id: "binary_sensor.wc", state: "off", attributes: { device_class: "door" } },
      "cover.gate_door": { entity_id: "cover.gate_door", state: "closed", attributes: {} },
    },
  } as unknown as HomeAssistant;
  const none = { cover: null, contact: null, tilt: null, contact2: null, tilt2: null };
  assert.equal(openingState(hass, { ...none, contact: "binary_sensor.wc" }, "door").sensed, true);
  assert.equal(openingState(hass, none, "door").sensed, false);
  assert.equal(openingState(hass, none, "window").sensed, false);
  assert.equal(openingState(hass, { ...none, cover: "cover.gate_door" }, "garage").sensed, true);
});

test("a gate on a sliding door moves the leaf and draws no blind; a roller shutter on a door stays a blind (#544)", () => {
  const hass = {
    states: {
      "cover.gate": { entity_id: "cover.gate", state: "open", attributes: { device_class: "gate", current_position: 40 } },
      "cover.shutter": { entity_id: "cover.shutter", state: "open", attributes: { device_class: "shutter", current_position: 40 } },
    },
  } as unknown as HomeAssistant;
  const none = { cover: null, contact: null, tilt: null, contact2: null, tilt2: null };
  const gate = openingState(hass, { ...none, cover: "cover.gate" }, "door");
  assert.equal(gate.cover, null);
  assert.ok(Math.abs(gate.open - 0.4) < 1e-9);
  const shutter = openingState(hass, { ...none, cover: "cover.shutter" }, "door");
  assert.ok(Math.abs((shutter.cover ?? 0) - 0.6) < 1e-9);
});

test("a garage door reads its contact like a door, and an inverted contact flips open and closed (#329)", () => {
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });
  const hass = {
    states: {
      "binary_sensor.gate": st("binary_sensor.gate", "on", { device_class: "garage_door" }),
      "sensor.gate_text": st("sensor.gate_text", "open"),
      "binary_sensor.door": st("binary_sensor.door", "off", { device_class: "door" }),
    },
  } as unknown as HomeAssistant;
  const none = { cover: null, contact: null, tilt: null, contact2: null, tilt2: null };
  assert.equal(openingState(hass, { ...none, contact: "binary_sensor.gate" }, "garage").cover, 0);
  assert.equal(openingState(hass, { ...none, contact: "sensor.gate_text" }, "garage").cover, 0);
  assert.equal(openingState(hass, { ...none, contact: "binary_sensor.gate", contactInvert: true }, "garage").cover, 1);
  assert.equal(openingState(hass, none, "garage").cover, 1);
  assert.equal(openingState(hass, none, "garage").sensed, false);
  assert.equal(openingState(hass, { ...none, contact: "binary_sensor.door" }, "door").open, 0);
  assert.equal(openingState(hass, { ...none, contact: "binary_sensor.door", contactInvert: true }, "door").open, 1);
  assert.equal(openingState(hass, { ...none, contact: "binary_sensor.door", contactInvert: true }, "window").open, 1);
});

test("room climate skips device temperatures, honours a chosen sensor and placed sensors", () => {
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });
  const temp = (id: string, v: string, name: string) => st(id, v, { device_class: "temperature", unit_of_measurement: "°C", friendly_name: name });
  const hass = {
    language: "en",
    areas: { utility: { area_id: "utility", name: "Utility" } },
    devices: { printer: { id: "printer", area_id: "utility" }, pump: { id: "pump", area_id: "utility" }, thermo: { id: "thermo", area_id: "utility" } },
    entities: {
      "sensor.printer_nozzle": { entity_id: "sensor.printer_nozzle", device_id: "printer" },
      "button.printer_pause": { entity_id: "button.printer_pause", device_id: "printer" },
      "sensor.hp_flow": { entity_id: "sensor.hp_flow", device_id: "pump" },
      "climate.hp": { entity_id: "climate.hp", device_id: "pump" },
      "sensor.utility_temperature": { entity_id: "sensor.utility_temperature", device_id: "thermo" },
      "sensor.hall_temp": { entity_id: "sensor.hall_temp" },
      "light.group": { entity_id: "light.group" },
    },
    states: {
      "sensor.printer_nozzle": temp("sensor.printer_nozzle", "215", "Printer nozzle"),
      "button.printer_pause": st("button.printer_pause", "unknown"),
      "sensor.hp_flow": temp("sensor.hp_flow", "45", "Heat pump flow"),
      "climate.hp": st("climate.hp", "heat"),
      "sensor.utility_temperature": temp("sensor.utility_temperature", "19.5", "Utility temperature"),
      "sensor.hall_temp": temp("sensor.hall_temp", "21", "Hall"),
      "light.group": st("light.group", "on"),
    },
  } as unknown as HomeAssistant;
  const room: Room = { id: "r", name: "Utility", area_id: "utility", points: [[0, 0], [3, 0], [3, 3], [0, 3]], floor_material: "tiles" };
  const floor = { ...newFloor("ground", "Ground floor", 0), rooms: [room] };
  assert.deepEqual(roomClimateSensors(hass, floor, room, "temperature"), ["sensor.utility_temperature"]);
  assert.equal(roomClimateValue(hass, floor, room, "temperature"), 19.5);
  // a sensor without an area placed in the room counts too
  floor.placements = [{ entity_id: "sensor.hall_temp", x: 1, z: 1, y: null }];
  assert.equal(roomClimateValue(hass, floor, room, "temperature"), 20.25);
  // a chosen sensor wins, "none" shows no value
  assert.deepEqual(roomClimateSensors(hass, floor, { ...room, climate: { temperature: "sensor.hall_temp" } }, "temperature"), ["sensor.hall_temp"]);
  assert.equal(roomClimateValue(hass, floor, { ...room, climate: { temperature: "none" } }, "temperature"), null);
  // entities without an area can be placed from their own list; other areas are listed by name
  assert.deepEqual(unassignedEntities(hass), ["light.group", "sensor.hall_temp"]);
  assert.deepEqual(otherAreaEntities(hass, "kitchen").map((a) => a.name), ["Utility"]);
  assert.deepEqual(otherAreaEntities(hass, "utility"), []);
});

test("a robot vacuum's current room is found on its device and matched by room or area name", () => {
  const hass = {
    language: "en",
    areas: { kitchen: { area_id: "kitchen", name: "Kitchen" } },
    entities: {
      "vacuum.robo": { entity_id: "vacuum.robo", device_id: "d1" },
      "sensor.robo_battery": { entity_id: "sensor.robo_battery", device_id: "d1" },
      "sensor.robo_room": { entity_id: "sensor.robo_room", device_id: "d1", translation_key: "current_room" },
    },
    states: {
      "vacuum.robo": { entity_id: "vacuum.robo", state: "cleaning", attributes: {} },
      "sensor.robo_room": { entity_id: "sensor.robo_room", state: "KITCHEN", attributes: {} },
    },
  } as unknown as HomeAssistant;
  assert.equal(robotRoomSensor(hass, "vacuum.robo", null), "sensor.robo_room");
  assert.equal(robotRoomSensor(hass, "vacuum.robo", "none"), null);
  const rooms = [
    { id: "a", name: "Living room", area_id: "living" },
    { id: "b", name: "Cooking", area_id: "kitchen" },
    { id: "c", name: "Guest bath", area_id: null },
  ];
  // "KITCHEN" matches the area name "Kitchen"
  assert.equal(robotRoom(hass, rooms, "vacuum.robo", "sensor.robo_room")?.id, "b");
  hass.states["sensor.robo_room"].state = "guest_bath";
  assert.equal(robotRoom(hass, rooms, "vacuum.robo", "sensor.robo_room")?.id, "c");
  hass.states["sensor.robo_room"].state = "Cellar";
  assert.equal(robotRoom(hass, rooms, "vacuum.robo", "sensor.robo_room"), null);
  // the sensor names no room of the plan: what the vacuum itself says counts (#470)
  hass.states["vacuum.robo"].attributes.current_room = "Living room";
  assert.equal(robotRoom(hass, rooms, "vacuum.robo", "sensor.robo_room")?.id, "a");
  assert.equal(roomKey("Salle à manger"), roomKey("salle_a_manger"));
  // integrations that report their own cleaning states
  for (const s of ["cleaning", "room_cleaning", "segment_cleaning", "Sweeping", "mopping"]) assert.equal(vacuumCleaning(s), true, s);
  for (const s of ["docked", "returning", "idle", undefined]) assert.equal(vacuumCleaning(s), false, String(s));
});

test("a window marked 'ask first' puts its blind on the confirm list", () => {
  const hass = hassWith();
  const o = (id: string, extra: Partial<Opening> = {}): Opening => ({
    id, room_id: "r", edge: 0, offset: 1, width: 1, type: "window", sill: 0.9, height: 1.3, hinge: "left", leaves: 1, swing: "in", cover: "cover.blind", contact: null, contact2: null, tilt: null, ...extra,
  });
  const floor: Floor = { ...newFloor("f", "F", 0), rooms: [{ ...room, area_id: "living" }], openings: [o("w1")] };
  assert.equal(confirmEntities(hass, [floor]).has("cover.blind"), false);
  floor.openings = [o("w1", { confirm: true })];
  assert.equal(confirmEntities(hass, [floor]).has("cover.blind"), true);
});

test("an access point is online, offline or unknown by what its status entity says (D582)", () => {
  const st = (state: string) => ({ entity_id: "binary_sensor.ap", state, attributes: {} }) as unknown as Parameters<typeof apOnline>[0];
  for (const s of ["on", "connected", "online", "home", "12"]) assert.equal(apOnline(st(s)), true, s);
  for (const s of ["off", "disconnected", "not_home", "unavailable"]) assert.equal(apOnline(st(s)), false, s);
  assert.equal(apOnline(st("unknown")), null);
  assert.equal(apOnline(undefined), null);
});

test("a ceiling fan's blades turn with its percentage, at a middle speed without one, not at all when off", () => {
  const st = (state: string, attributes: Record<string, unknown> = {}) => ({ entity_id: "fan.ceiling", state, attributes }) as unknown as Parameters<typeof fanSpeed>[0];
  assert.equal(fanSpeed(st("on", { percentage: 33 })), 0.33);
  assert.equal(fanSpeed(st("on")), 0.6);
  assert.equal(fanSpeed(st("on", { percentage: 250 })), 1);
  assert.equal(fanSpeed(st("off", { percentage: 66 })), 0);
  assert.equal(fanSpeed(undefined), 0);
});

test("a wall switch marked 'ask first' puts every gang's entity on the confirm list", () => {
  const hass = hassWith();
  const sw = { id: "ws", type: "wall_switch", x: 1, z: 0, rotation: 0, w: 0.156, d: 0.012, h: 0.085, variant: null, gangs: [{ entity: "light.hall" }, { entity: "switch.garden" }], confirm: true };
  const floor: Floor = { ...newFloor("f", "F", 0), furniture: [sw] };
  const out = confirmEntities(hass, [floor]);
  assert.ok(out.has("light.hall") && out.has("switch.garden"));
  floor.furniture = [{ ...sw, confirm: false }];
  assert.equal(confirmEntities(hass, [floor]).has("light.hall"), false);
});

test("a status sensor (a 3D printer) counts as active while it prints", () => {
  const st = (state: string, dc = "enum") => ({ entity_id: "sensor.printer_status", state, attributes: { device_class: dc } });
  assert.equal(isActive(st("running")), true);
  assert.equal(isActive(st("prepare")), true);
  assert.equal(isActive(st("idle")), false);
  assert.equal(isActive(st("finish")), false);
  // an ordinary sensor is never "active"
  assert.equal(isActive(st("running", "temperature")), false);
});

test("an entity without a registry entry (a USB camera from YAML) is offered as unassigned", () => {
  const hass = {
    language: "en",
    entities: { "light.a": { entity_id: "light.a", area_id: null } },
    states: {
      "light.a": { entity_id: "light.a", state: "on", attributes: {} },
      "camera.usb_camera_1": { entity_id: "camera.usb_camera_1", state: "idle", attributes: { friendly_name: "USB Camera 1" } },
      "sun.sun": { entity_id: "sun.sun", state: "above_horizon", attributes: {} },
    },
  } as unknown as HomeAssistant;
  const ids = unassignedEntities(hass);
  assert.ok(ids.includes("camera.usb_camera_1"));
  assert.ok(ids.includes("light.a"));
  assert.ok(!ids.includes("sun.sun"));
});

test("a tilt angle sensor tilts the sash as far as it reports, with max, offset and sign", () => {
  const hass = { states: { "sensor.angle": { entity_id: "sensor.angle", state: "7.5", attributes: {} } } } as unknown as HomeAssistant;
  const base = { cover: null, contact: null, tilt: null, tiltAngle: "sensor.angle" };
  assert.equal(openingState(hass, { ...base, tiltMax: 15 }, "window").tilt, 0.5);
  // an offset the sensor reports while closed, and the other sign
  assert.equal(openingState(hass, { ...base, tiltMax: 10, tiltOffset: 2.5 }, "window").tilt, 0.5);
  assert.equal(openingState(hass, { ...base, tiltMax: 15, tiltInvert: true }, "window").tilt, 0);
  // below a small threshold the window counts as closed; the angle makes the state "sensed"
  hass.states["sensor.angle"] = { entity_id: "sensor.angle", state: "0.5", attributes: {} };
  const s = openingState(hass, { ...base, tiltMax: 15 }, "window");
  assert.equal(s.tilt, 0);
  assert.equal(s.sensed, true);
});

test("a door with a roller shutter shows the blind at the cover's position", () => {
  const hass = hassWith();
  hass.states["cover.front_door"] = { entity_id: "cover.front_door", state: "open", attributes: { current_position: 30, device_class: "shutter" } } as HomeAssistant["states"][string];
  const st = openingState(hass, { cover: "cover.front_door", contact: null, tilt: null }, "door");
  assert.ok(Math.abs((st.cover ?? -1) - 0.7) < 1e-9, `closed fraction ${st.cover}`);
  assert.ok(st.sensed);
  // without a cover a door has no blind
  assert.equal(openingState(hass, { cover: null, contact: null, tilt: null }, "door").cover, null);
});

test("a favourite is called by its domain (#145)", async () => {
  const { favoriteCall } = await import("./devices.ts");
  assert.deepEqual(favoriteCall("scene.party"), ["scene", "turn_on"]);
  assert.deepEqual(favoriteCall("button.doorbell"), ["button", "press"]);
  assert.deepEqual(favoriteCall("switch.irrigation"), ["homeassistant", "toggle"]);
});

test("own buttons call a service or fire the DOM event browser_mod listens for (D143)", async () => {
  const { runButton } = await import("./devices.ts");
  const calls: unknown[][] = [];
  const hass = { callService: (...a: unknown[]) => (calls.push(a), Promise.resolve()) } as unknown as HomeAssistant;
  const el = new EventTarget() as unknown as HTMLElement;
  const events: { type: string; detail: unknown }[] = [];
  for (const type of ["ll-custom", "hass-more-info"]) el.addEventListener(type, (e) => events.push({ type, detail: (e as CustomEvent).detail }));
  runButton(hass, el, { action: "service", target: "script.turn_on", data: { entity_id: "script.party" } }, (e) => e);
  // no toast from Home Assistant on top of ours (#243)
  assert.deepEqual(calls, [["script", "turn_on", { entity_id: "script.party" }, undefined, false]]);
  const popup = { browser_mod: { service: "browser_mod.popup", data: { title: "Blinds" } } };
  runButton(hass, el, { action: "fire_dom_event", data: popup }, (e) => e);
  runButton(hass, el, { action: "more_info", target: "cover.living_room" }, (e) => e);
  assert.deepEqual(events, [
    { type: "ll-custom", detail: popup },
    { type: "hass-more-info", detail: { entityId: "cover.living_room" } },
  ]);
});

test("a desk's monitor does not take the room's smart speaker, a placed device stays its own", async () => {
  const { furnitureEntities } = await import("./devices.ts");
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });
  const hass = {
    language: "en",
    states: { "media_player.echo_show_office": st("media_player.echo_show_office", "playing", { friendly_name: "Echo Show Office" }) },
    entities: { "media_player.echo_show_office": { entity_id: "media_player.echo_show_office", area_id: "office" } },
    devices: {},
    areas: { office: { area_id: "office", name: "Office" } },
  } as unknown as HomeAssistant;
  const room = { id: "r", name: "Office", area_id: "office", points: [[0, 0], [4, 0], [4, 3], [0, 3]] as [number, number][], floor_material: "wood" as const };
  const desk = { id: "d", type: "desk", x: 2, z: 1, w: 1.4, d: 0.7, h: 0.75, rotation: 0, variant: null };
  const tv = { id: "t", type: "tv_wall", x: 1, z: 0.1, w: 1.2, d: 0.08, h: 0.7, rotation: 0, variant: null };
  // the desk alone: no media player by chance
  const one = furnitureEntities(hass, [{ ...newFloor("ground", "Ground floor", 0), rooms: [room], furniture: [desk] }]);
  assert.equal(one.get("d")?.entity ?? null, null);
  // a TV takes the room's player, unless that player is placed as a device of its own
  const two = furnitureEntities(hass, [{ ...newFloor("ground", "Ground floor", 0), rooms: [room], furniture: [tv] }]);
  assert.equal(two.get("t")?.entity, "media_player.echo_show_office");
  const placed = furnitureEntities(hass, [{ ...newFloor("ground", "Ground floor", 0), rooms: [room], furniture: [tv], placements: [{ entity_id: "media_player.echo_show_office", x: 3.8, z: 2.8, y: null }] }]);
  assert.equal(placed.get("t")?.entity ?? null, null);
});

test("a hub device for a whole house (MQTT): room sensors count, power sensors stay in their area (#243)", async () => {
  const { powerSensorFor } = await import("./energy.ts");
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });
  const hass = {
    language: "en",
    areas: { living: { area_id: "living", name: "Living" }, kitchen: { area_id: "kitchen", name: "Kitchen" } },
    devices: { hub: { id: "hub", area_id: null } },
    entities: {
      "light.living": { entity_id: "light.living", device_id: "hub", area_id: "living" },
      "switch.kitchen": { entity_id: "switch.kitchen", device_id: "hub", area_id: "kitchen" },
      "sensor.living_temp": { entity_id: "sensor.living_temp", device_id: "hub", area_id: "living" },
      "sensor.kitchen_power": { entity_id: "sensor.kitchen_power", device_id: "hub", area_id: "kitchen" },
    },
    states: {
      "light.living": st("light.living", "on"),
      "switch.kitchen": st("switch.kitchen", "on"),
      "sensor.living_temp": st("sensor.living_temp", "21.5", { device_class: "temperature", unit_of_measurement: "°C" }),
      "sensor.kitchen_power": st("sensor.kitchen_power", "120", { device_class: "power", unit_of_measurement: "W" }),
    },
  } as unknown as HomeAssistant;
  const room: Room = { id: "r", name: "Living", area_id: "living", points: [[0, 0], [3, 0], [3, 3], [0, 3]], floor_material: "wood" };
  const floor = { ...newFloor("ground", "Ground floor", 0), rooms: [room] };
  // the hub also has lights and switches, yet its room thermometer is the room's temperature
  assert.deepEqual(roomClimateSensors(hass, floor, room, "temperature"), ["sensor.living_temp"]);
  // the kitchen meter belongs to the kitchen switch, not to the living room light
  assert.equal(powerSensorFor(hass, "switch.kitchen"), "sensor.kitchen_power");
  assert.equal(powerSensorFor(hass, "light.living"), null);
});

test("carLocked reads locks, lock binary sensors, text sensors and switches (#369)", () => {
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes }) as never;
  assert.equal(carLocked(st("lock.car", "locked")), true);
  assert.equal(carLocked(st("lock.car", "unlocked")), false);
  // a binary_sensor of class lock is "on" while unlocked, as in Home Assistant
  assert.equal(carLocked(st("binary_sensor.car_doors", "on", { device_class: "lock" })), false);
  assert.equal(carLocked(st("binary_sensor.car_doors", "off", { device_class: "lock" })), true);
  // BMW reports the door lock state as text
  assert.equal(carLocked(st("sensor.118i_door_lock_state", "LOCKED")), true);
  assert.equal(carLocked(st("sensor.118i_door_lock_state", "SECURED")), true);
  assert.equal(carLocked(st("sensor.118i_door_lock_state", "UNLOCKED")), false);
  assert.equal(carLocked(st("sensor.118i_door_lock_state", "SELECTIVE_LOCKED")), false);
  assert.equal(carLocked(st("sensor.118i_door_lock_state", "unknown")), null);
  assert.equal(carLocked(st("input_boolean.car_locked", "on")), true);
});

test("a door in a free wall outside every room follows the contact chosen for it (#367)", () => {
  const hass = hassWith();
  hass.states["binary_sensor.front_door"] = { entity_id: "binary_sensor.front_door", state: "on", attributes: { device_class: "door" } };
  const door: Opening = {
    id: "d1", room_id: "wall1", wall: "wall1", edge: 0, offset: 1, width: 1, type: "door", sill: 0, height: 2.05, hinge: "left", leaves: 1, swing: "in",
    cover: null, contact: "binary_sensor.front_door", contact2: null, tilt: null,
  };
  const floor: Floor = { ...newFloor("f", "F", 0), openings: [door], walls: [{ id: "wall1", a: [0, 0], b: [4, 0], thickness: null, height: null }] };
  const links = openingEntities(hass, [floor]);
  assert.equal(links.get("d1")?.contact, "binary_sensor.front_door");
  assert.equal(openingState(hass, links.get("d1")!, "door").open, 1);
});

test("a room without a temperature sensor takes its thermostat's current temperature and humidity (#478)", () => {
  const hass = {
    language: "en",
    config: { unit_system: { temperature: "°C" } },
    areas: { bathroom: { area_id: "bathroom", name: "Bathroom" } },
    devices: { d: { id: "d", area_id: "bathroom" } },
    entities: { "climate.bathroom": { entity_id: "climate.bathroom", device_id: "d" } },
    states: { "climate.bathroom": { entity_id: "climate.bathroom", state: "heat", attributes: { current_temperature: 21.5, current_humidity: 58, friendly_name: "Bathroom thermostat" } } },
  } as unknown as HomeAssistant;
  const room: Room = { id: "r", name: "Bathroom", area_id: "bathroom", points: [[0, 0], [3, 0], [3, 3], [0, 3]], floor_material: "tiles" };
  const floor = { ...newFloor("ground", "Ground floor", 0), rooms: [room] };
  assert.deepEqual(roomClimateSensors(hass, floor, room, "temperature"), ["climate.bathroom"]);
  assert.equal(roomClimateValue(hass, floor, room, "temperature"), 21.5);
  assert.equal(roomClimateValue(hass, floor, room, "humidity"), 58);
  assert.deepEqual(roomClimateSensors(hass, floor, room, "co2"), []);
  // chosen by hand works the same
  assert.equal(roomClimateValue(hass, floor, { ...room, area_id: null, climate: { temperature: "climate.bathroom" } }, "temperature"), 21.5);
});

test("a cooktop glows while it runs, faintly when ready, not when inactive (customer mail)", () => {
  const s = (state: string) => ({ entity_id: "sensor.hob_operation_state", state, attributes: { device_class: "enum" } });
  assert.equal(cooktopLevel(s("run"), false), 1);
  assert.equal(cooktopLevel(s("ready"), false), 0.3);
  assert.equal(cooktopLevel(s("inactive"), false), 0);
  // a cooktop behind a power plug: power over the threshold counts as cooking
  assert.equal(cooktopLevel(undefined, true), 1);
  assert.ok(isActive(s("run")));
});

test("an air conditioner glows in the colour of its mode, dimmer while idle", () => {
  const c = (state: string, hvac_action?: string) => ({ entity_id: "climate.aircon", state, attributes: hvac_action ? { hvac_action } : {} });
  assert.equal(climateModeGlow(c("off")), null);
  const heat = climateModeGlow(c("heat", "heating"))!;
  assert.ok(heat.color[0] > heat.color[2] && heat.level === 1);
  const cool = climateModeGlow(c("cool", "idle"))!;
  assert.ok(cool.color[2] > cool.color[0] && cool.level < 1);
  const auto = climateModeGlow(c("heat_cool", "cooling"))!;
  assert.ok(auto.color[1] > auto.color[0] && auto.color[1] > auto.color[2]);
});

test("a lamp with one colour only glows for that colour (customer mail: yellow = water)", () => {
  const g = (color: [number, number, number]) => ({ color, level: 1 });
  assert.ok(onlyColor(g([1, 0.85, 0]), "#ffd400"));
  assert.equal(onlyColor(g([1, 0, 0]), "#ffd400"), null);
  assert.equal(onlyColor(g([0, 0.3, 1]), "#ffd400"), null);
  assert.equal(onlyColor(g([1, 0.95, 0.9]), "#ffd400"), null);
  assert.ok(onlyColor(g([1, 0, 0]), null));
});

test("water values of a pool count as sensors: pH by its class, redox and salt by their units (D600)", () => {
  const hass = {
    states: {
      "sensor.pool_ph": { entity_id: "sensor.pool_ph", state: "7.2", attributes: { device_class: "ph" } },
      "sensor.pool_redox": { entity_id: "sensor.pool_redox", state: "720", attributes: { unit_of_measurement: "mV" } },
      "sensor.pool_salt": { entity_id: "sensor.pool_salt", state: "3200", attributes: { unit_of_measurement: "mg/L" } },
      "sensor.pool_firmware": { entity_id: "sensor.pool_firmware", state: "1.2", attributes: {} },
    },
    entities: {},
  } as unknown as Parameters<typeof isRelevant>[0];
  assert.equal(isRelevant(hass, "sensor.pool_ph"), true);
  assert.equal(isRelevant(hass, "sensor.pool_redox"), true);
  assert.equal(isRelevant(hass, "sensor.pool_salt"), true);
  assert.equal(isRelevant(hass, "sensor.pool_firmware"), false);
});

test("a redox probe that reports as a voltage in mV counts, a mains voltage does not (#814)", () => {
  const hass = {
    states: {
      "sensor.pool_orp": { entity_id: "sensor.pool_orp", state: "690", attributes: { device_class: "voltage", unit_of_measurement: "mV" } },
      "sensor.mains": { entity_id: "sensor.mains", state: "231", attributes: { device_class: "voltage", unit_of_measurement: "V" } },
    },
    entities: {},
  } as unknown as Parameters<typeof isRelevant>[0];
  assert.equal(isRelevant(hass, "sensor.pool_orp"), true);
  assert.equal(isRelevant(hass, "sensor.mains"), false);
});

test("a door with a smart lock and no drive gets no roller shutter, and glows while unlocked (#682)", () => {
  const hass = hassWith();
  hass.states["lock.front_door"] = { entity_id: "lock.front_door", state: "unlocked", attributes: {} } as HomeAssistant["states"][string];
  hass.states["sensor.level"] = { entity_id: "sensor.level", state: "40", attributes: { unit_of_measurement: "%" } } as HomeAssistant["states"][string];
  const o: Opening = { id: "d", room_id: "r", edge: 0, offset: 1, width: 1, type: "door", sill: 0, height: 2, hinge: "left", leaves: 1, swing: "in", cover: "none", contact: "none", contact2: null, tilt: null, lock: "lock.front_door", position: "sensor.level" };
  const floor: Floor = { ...newFloor("f", "F", 0), rooms: [room], openings: [o] };
  const link = openingEntities(hass, [floor]).get("d")!;
  // a blind's position sensor left behind without a blind lowers nothing
  assert.equal(link.position, null);
  const st = openingState(hass, link, "door");
  assert.equal(st.cover, null);
  assert.equal(st.unlocked, true);
  hass.states["lock.front_door"] = { ...hass.states["lock.front_door"], state: "locked" };
  assert.equal(openingState(hass, link, "door").unlocked, undefined);
  // the lock follows its own state, whatever the contact says; a door without a lock is unchanged
  assert.equal(openingState(hass, { ...link, lock: null }, "door").unlocked, undefined);
  // with a blind, its position sensor still counts
  hass.states["cover.door_shutter"] = { entity_id: "cover.door_shutter", state: "open", attributes: { device_class: "shutter" } } as HomeAssistant["states"][string];
  const withBlind = openingEntities(hass, [{ ...floor, openings: [{ ...o, cover: "cover.door_shutter" }] }]).get("d")!;
  assert.equal(withBlind.position, "sensor.level");
});

test("a garage door driven by a pulse switch or button shows its contact, not the switch (#677)", () => {
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });
  const hass = {
    states: {
      "switch.gate_pulse": st("switch.gate_pulse", "off"),
      "button.gate": st("button.gate", "2026-10-21T08:00:00Z"),
      "binary_sensor.gate": st("binary_sensor.gate", "on", { device_class: "garage_door" }),
      "binary_sensor.gate_closed": st("binary_sensor.gate_closed", "off", { device_class: "garage_door" }),
    },
  } as unknown as HomeAssistant;
  const none = { cover: null, contact: null, tilt: null, contact2: null, tilt2: null };
  // the switch is off again after its pulse, the contact says open: open
  const open = openingState(hass, { ...none, cover: "switch.gate_pulse", contact: "binary_sensor.gate" }, "garage");
  assert.equal(open.cover, 0);
  assert.equal(open.sensed, true);
  assert.equal(openingState(hass, { ...none, cover: "switch.gate_pulse", contact: "binary_sensor.gate_closed" }, "garage").cover, 1);
  assert.equal(openingState(hass, { ...none, cover: "button.gate", contact: "binary_sensor.gate" }, "garage").cover, 0);
  // without a contact the door cannot be known: closed, not sensed
  const blind = openingState(hass, { ...none, cover: "switch.gate_pulse" }, "garage");
  assert.equal(blind.cover, 1);
  assert.equal(blind.sensed, false);
  // older plans with the switch as the contact: on is open, as before
  hass.states["switch.gate_pulse"] = st("switch.gate_pulse", "on") as HomeAssistant["states"][string];
  assert.equal(openingState(hass, { ...none, contact: "switch.gate_pulse" }, "garage").cover, 0);
  assert.equal(isPulseDrive("switch.gate_pulse"), true);
  assert.equal(isPulseDrive("input_button.tor"), true);
  assert.equal(isPulseDrive("cover.gate_door"), false);
});

test("slat buttons only for covers with slats: a KNX roller shutter announcing tilt features gets none (#704)", () => {
  const cover = (attributes: Record<string, unknown>) => ({ entity_id: "cover.x", state: "open", attributes, last_changed: "", last_updated: "" }) as Parameters<typeof coverTiltButtons>[0];
  assert.equal(coverTiltButtons(cover({ device_class: "shutter", supported_features: 127, current_position: 100 })), false);
  assert.equal(coverTiltButtons(cover({ device_class: "blind", supported_features: 255, current_tilt_position: 100 })), true);
  // a shutter that really reports a tilt position keeps its buttons; a cover without a class keeps them too
  assert.equal(coverTiltButtons(cover({ device_class: "shutter", supported_features: 127, current_tilt_position: 40 })), true);
  assert.equal(coverTiltButtons(cover({ supported_features: 48 })), true);
  assert.equal(coverTiltButtons(cover({ device_class: "blind", supported_features: 15 })), false);
});

test("a thermostat without a reading or a sensor with an empty state is no 0 degrees (#199)", () => {
  const hass = {
    config: { unit_system: { temperature: "°C" } },
    states: {
      "climate.a": { entity_id: "climate.a", state: "heat", attributes: { current_temperature: null, current_humidity: null } },
      "climate.b": { entity_id: "climate.b", state: "heat", attributes: { current_temperature: 21.5, current_humidity: 40 } },
      "climate.c": { entity_id: "climate.c", state: "heat", attributes: {} },
      "sensor.e": { entity_id: "sensor.e", state: "", attributes: { unit_of_measurement: "°C" } },
      "sensor.f": { entity_id: "sensor.f", state: " ", attributes: {} },
      "sensor.g": { entity_id: "sensor.g", state: "0", attributes: { unit_of_measurement: "°C" } },
    },
  } as unknown as HomeAssistant;
  assert.ok(Number.isNaN(climateReading(hass, "climate.a", "temperature")));
  assert.ok(Number.isNaN(climateReading(hass, "climate.a", "humidity")));
  assert.ok(Number.isNaN(climateReading(hass, "climate.c", "temperature")));
  assert.equal(climateReading(hass, "climate.b", "temperature"), 21.5);
  assert.equal(climateReading(hass, "climate.b", "humidity"), 40);
  assert.ok(Number.isNaN(climateReading(hass, "sensor.e", "temperature")));
  assert.ok(Number.isNaN(climateReading(hass, "sensor.f", "humidity")));
  // a real zero is still a reading
  assert.equal(climateReading(hass, "sensor.g", "temperature"), 0);
  // and a room with only a blank chosen thermostat shows no value
  const room: Room = { id: "r", name: "R", area_id: null, points: [[0, 0], [3, 0], [3, 3], [0, 3]], floor_material: "wood", climate: { temperature: "climate.a" } };
  assert.equal(roomClimateValue(hass, { ...newFloor("ground", "Ground floor", 0), rooms: [room] }, room, "temperature"), null);
});
