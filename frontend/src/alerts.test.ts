import assert from "node:assert/strict";
import { test } from "node:test";
import { alertColor, alertEntities, alertSources, alertText, alertTint, findAlerts, isOutage } from "./alerts.ts";
import type { OpeningEntities } from "./devices.ts";
import { emptyBuilding, newFloor, type Opening } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

function setup() {
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });
  const hass = {
    language: "en",
    areas: { kitchen: { area_id: "kitchen", name: "Kitchen" }, bath: { area_id: "bath", name: "Bathroom" } },
    entities: {
      "binary_sensor.smoke": { entity_id: "binary_sensor.smoke", area_id: "kitchen" },
      "binary_sensor.leak": { entity_id: "binary_sensor.leak", area_id: "bath" },
      "binary_sensor.window": { entity_id: "binary_sensor.window", area_id: "kitchen" },
    },
    states: {
      "binary_sensor.smoke": st("binary_sensor.smoke", "off", { device_class: "smoke", friendly_name: "Smoke alarm" }),
      "binary_sensor.leak": st("binary_sensor.leak", "off", { device_class: "moisture", friendly_name: "Leak sensor" }),
      "binary_sensor.window": st("binary_sensor.window", "on", { device_class: "window", friendly_name: "Kitchen window" }),
      "weather.home": st("weather.home", "sunny"),
      "alarm_control_panel.house": st("alarm_control_panel.house", "disarmed"),
    },
  } as unknown as HomeAssistant;
  const b = emptyBuilding();
  const floor = newFloor("ground", "Ground floor", 0);
  floor.rooms = [
    { id: "k", name: "Kitchen", area_id: "kitchen", points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "tiles" },
    { id: "b", name: "Bathroom", area_id: "bath", points: [[4, 0], [7, 0], [7, 3], [4, 3]], floor_material: "tiles" },
  ];
  const win: Opening = { id: "w", room_id: "k", edge: 0, offset: 2, width: 1.2, type: "window", sill: 0.9, height: 1.3, hinge: "left", leaves: 1, swing: "in", cover: null, contact: "binary_sensor.window", contact2: null, tilt: null };
  floor.openings = [win];
  b.floors = [floor];
  const links = new Map<string, OpeningEntities>([["w", { cover: null, contact: "binary_sensor.window", tilt: null }]]);
  return { hass, b, links };
}

test("warning sensors, the alarm and the weather are found once and watched", () => {
  const { hass, b } = setup();
  const src = alertSources(hass, b);
  assert.deepEqual(src.rooms.map((r) => [r.roomId, r.sensors]), [["k", ["binary_sensor.smoke"]], ["b", ["binary_sensor.leak"]]]);
  assert.deepEqual(src.alarms, ["alarm_control_panel.house"]);
  assert.equal(src.weather, "weather.home");
  assert.deepEqual(alertEntities(src).sort(), ["alarm_control_panel.house", "binary_sensor.leak", "binary_sensor.smoke", "weather.home"]);
});

test("smoke and water raise room warnings, a triggered alarm a house-wide one", () => {
  const { hass, b, links } = setup();
  const src = alertSources(hass, b);
  assert.deepEqual(findAlerts(hass, b, src, links), []);
  hass.states["binary_sensor.smoke"].state = "on";
  hass.states["binary_sensor.leak"].state = "on";
  hass.states["alarm_control_panel.house"].state = "triggered";
  const alerts = findAlerts(hass, b, src, links);
  assert.deepEqual(
    alerts.map((a) => [a.kind, a.roomId]),
    [["smoke", "k"], ["water", "b"], ["alarm", null]],
  );
  assert.equal(alertText(hass, b, alerts[0]), "Kitchen · Smoke: Smoke alarm");
  assert.equal(alertText(hass, b, alerts[2]), "Alarm triggered");
  // without device names only the room and the kind remain; a warning without a room keeps its text (#374)
  b.settings.alert_names = false;
  assert.equal(alertText(hass, b, alerts[0]), "Kitchen · Smoke");
  assert.equal(alertText(hass, b, alerts[2]), "Alarm triggered");
  delete b.settings.alert_names;
  hass.states["alarm_control_panel.house"].state = "pending";
  assert.equal(findAlerts(hass, b, src, links).at(-1)?.kind, "alarm_pending");
});

test("an open window only warns while it rains", () => {
  const { hass, b, links } = setup();
  const src = alertSources(hass, b);
  assert.equal(findAlerts(hass, b, src, links).length, 0);
  hass.states["weather.home"].state = "rainy";
  const alerts = findAlerts(hass, b, src, links);
  assert.deepEqual(alerts.map((a) => [a.kind, a.roomId, a.entity]), [["window_rain", "k", "binary_sensor.window"]]);
  // a closed window is fine in the rain
  hass.states["binary_sensor.window"].state = "off";
  assert.equal(findAlerts(hass, b, src, links).length, 0);
});

test("the rain warning can be switched off on its own", () => {
  const { hass, b, links } = setup();
  hass.states["weather.home"].state = "rainy";
  b.settings.rain_warning = false;
  const alerts = findAlerts(hass, b, alertSources(hass, b), links);
  assert.equal(alerts.filter((a) => a.kind === "window_rain").length, 0);
});

test("a window may stay open in the rain; a weather station's own rain sensor decides (D328, D407)", () => {
  const { hass, b, links } = setup();
  hass.states["weather.home"].state = "rainy";
  // the window under a canopy does not warn
  for (const o of b.floors[0].openings) if (o.type === "window") o.rain_ignore = true;
  assert.equal(findAlerts(hass, b, alertSources(hass, b), links).filter((a) => a.kind === "window_rain").length, 0);
  for (const o of b.floors[0].openings) delete o.rain_ignore;
  // the station says dry although the forecast says rainy: no warning; then it rains at the house
  hass.states["sensor.rain_rate"] = { entity_id: "sensor.rain_rate", state: "0", attributes: { unit_of_measurement: "mm/h" } } as never;
  b.settings.rain_entity = "sensor.rain_rate";
  assert.equal(findAlerts(hass, b, alertSources(hass, b), links).filter((a) => a.kind === "window_rain").length, 0);
  hass.states["sensor.rain_rate"].state = "2.4";
  hass.states["weather.home"].state = "sunny";
  assert.equal(findAlerts(hass, b, alertSources(hass, b), links).filter((a) => a.kind === "window_rain").length, 1);
});

test("a power outage: grid sensors off, helpers on, a UPS on battery, a low mains voltage (#214)", () => {
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });
  assert.equal(isOutage(st("binary_sensor.grid", "off", { device_class: "power" })), true);
  assert.equal(isOutage(st("binary_sensor.grid", "on", { device_class: "power" })), false);
  assert.equal(isOutage(st("binary_sensor.power_cut", "on")), true);
  assert.equal(isOutage(st("input_boolean.power_cut", "on")), true);
  assert.equal(isOutage(st("sensor.ups_status", "OB DISCHRG")), true);
  assert.equal(isOutage(st("sensor.ups_status", "OL")), false);
  assert.equal(isOutage(st("sensor.mains_voltage", "0", { unit_of_measurement: "V" })), true);
  assert.equal(isOutage(st("sensor.mains_voltage", "231", { unit_of_measurement: "V" })), false);
  assert.equal(isOutage(st("sensor.grid_import", "0", { unit_of_measurement: "W" })), false);
  assert.equal(isOutage(st("binary_sensor.grid", "unavailable", { device_class: "power" })), false);

  const b = emptyBuilding();
  b.settings.outage_entity = "binary_sensor.grid";
  const hass = { language: "en", areas: {}, entities: {}, devices: {}, states: { "binary_sensor.grid": st("binary_sensor.grid", "off", { device_class: "power", friendly_name: "Grid" }) } } as unknown as HomeAssistant;
  const sources = alertSources(hass, b);
  assert.deepEqual(alertEntities(sources), ["binary_sensor.grid"]);
  const alerts = findAlerts(hass, b, sources, new Map());
  assert.deepEqual(alerts.map((a) => a.kind), ["power_outage"]);
  assert.equal(alertText(hass, b, alerts[0]), "Power outage: Grid");
});

test("the household feature (built in) warns when a fridge door stands open too long", async () => {
  const { setPacks } = await import("./packs.ts");
  const open = new Date(Date.now() - 5 * 60_000).toISOString();
  const hass = {
    language: "en",
    states: { "binary_sensor.fridge_door": { entity_id: "binary_sensor.fridge_door", state: "on", attributes: { friendly_name: "Fridge door" }, last_changed: open } },
    entities: {},
  } as unknown as HomeAssistant;
  const b = emptyBuilding();
  const floor = newFloor("ground", "Ground floor", 0);
  floor.rooms = [{ id: "k", name: "Kitchen", area_id: null, points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "tiles" }];
  floor.furniture = [{ id: "f1", type: "fridge", x: 1, z: 1, rotation: 0, w: 0.6, d: 0.65, h: 1.8, variant: null, door_left: "binary_sensor.fridge_door" }];
  b.floors = [floor];
  setPacks([]);
  const sources = alertSources(hass, b);
  assert.ok(alertEntities(sources).includes("binary_sensor.fridge_door"));
  const alerts = findAlerts(hass, b, sources, new Map());
  assert.deepEqual(alerts.map((a) => [a.kind, a.roomId]), [["fridge_door", "k"]]);
  assert.equal(alertText(hass, b, alerts[0]), "Kitchen · Fridge open: Fridge door");
  setPacks([]);
});

test("a contact unavailable for 10 minutes warns only when switched on; a short gap passes", () => {
  const { hass, b, links } = setup();
  const src = alertSources(hass, b);
  const windowState = hass.states["binary_sensor.window"] as { state: string; last_changed?: string };
  windowState.state = "unavailable";
  windowState.last_changed = new Date(Date.now() - 30 * 60_000).toISOString();
  // off by default: nothing changes for anyone who has not switched it on
  assert.equal(findAlerts(hass, b, src, links).length, 0);
  b.settings.alert_unavailable = true;
  assert.deepEqual(findAlerts(hass, b, src, links).map((a) => [a.kind, a.roomId, a.entity]), [["contact_unavailable", "k", "binary_sensor.window"]]);
  // a restart of Home Assistant: unavailable for a minute is no warning
  windowState.last_changed = new Date(Date.now() - 60_000).toISOString();
  assert.equal(findAlerts(hass, b, src, links).length, 0);
});

test("a wet leak sensor turns its room red until it is dry, wherever it is placed or chosen (#10)", () => {
  const { hass, b, links } = setup();
  const [k, bath] = b.floors[0].rooms;
  // the bath's leak sensor placed in the kitchen (under the sink) warns there
  b.floors[0].placements = [{ entity_id: "binary_sensor.leak", x: 1, z: 1, y: null }];
  hass.states["binary_sensor.leak"].state = "on";
  let alerts = findAlerts(hass, b, alertSources(hass, b), links);
  assert.deepEqual(alerts.map((a) => [a.kind, a.roomId]), [["water", "k"]]);
  // the room's floor turns red; the water alert's own colour stays blue
  const [r, g, bl] = alertTint(alerts[0]);
  assert.ok(r > 0.8 && g < 0.3 && bl < 0.3, "red");
  const [wr, , wb] = alertColor(alerts[0]);
  assert.ok(wb > 0.8 && wr < 0.4, "blue");
  // every other warning tints its room in its own colour
  assert.deepEqual(alertTint({ kind: "window_rain" }), alertColor({ kind: "window_rain" }));
  // the room may name its leak sensor, or have none
  b.floors[0].placements = [];
  k.live = { leak: "binary_sensor.leak" };
  bath.live = { leak: "none" };
  alerts = findAlerts(hass, b, alertSources(hass, b), links);
  assert.deepEqual(alerts.map((a) => [a.kind, a.roomId]), [["water", "k"]]);
  hass.states["binary_sensor.leak"].state = "off";
  assert.deepEqual(findAlerts(hass, b, alertSources(hass, b), links), []);
});
