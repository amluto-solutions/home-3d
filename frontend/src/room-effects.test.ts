import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Furniture } from "./model.ts";
import { effectSettings, itemShade, motionRooms, roomLiveSensors, shadeKind, tempShade } from "./room-effects.ts";
import type { HomeAssistant } from "./types.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, last_changed?: string) => ({ entity_id, state, attributes, last_changed });

function setup() {
  const hass = {
    language: "en",
    areas: { kitchen: { area_id: "kitchen", name: "Kitchen" }, bath: { area_id: "bath", name: "Bath" } },
    entities: {
      "binary_sensor.sink_leak": { entity_id: "binary_sensor.sink_leak", area_id: "kitchen" },
      "binary_sensor.kitchen_motion": { entity_id: "binary_sensor.kitchen_motion", area_id: "kitchen" },
      "binary_sensor.kitchen_door": { entity_id: "binary_sensor.kitchen_door", area_id: "kitchen" },
      "binary_sensor.bath_presence": { entity_id: "binary_sensor.bath_presence", area_id: "bath" },
      "binary_sensor.washer_leak": { entity_id: "binary_sensor.washer_leak", area_id: null },
    },
    states: {
      "binary_sensor.sink_leak": st("binary_sensor.sink_leak", "off", { device_class: "moisture" }),
      "binary_sensor.kitchen_motion": st("binary_sensor.kitchen_motion", "off", { device_class: "motion" }),
      "binary_sensor.kitchen_door": st("binary_sensor.kitchen_door", "off", { device_class: "door" }),
      "binary_sensor.bath_presence": st("binary_sensor.bath_presence", "off", { device_class: "occupancy" }),
      "binary_sensor.washer_leak": st("binary_sensor.washer_leak", "off", { device_class: "moisture" }),
    },
  } as unknown as HomeAssistant;
  const b = emptyBuilding();
  const floor = newFloor("g", "Ground", 0);
  floor.rooms = [
    { id: "k", name: "Kitchen", area_id: "kitchen", points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "tiles" },
    { id: "b", name: "Bath", area_id: "bath", points: [[4, 0], [7, 0], [7, 3], [4, 3]], floor_material: "tiles" },
  ];
  b.floors = [floor];
  return { hass, b, floor };
}

test("a room's leak and motion sensors come from its area", () => {
  const { hass, floor } = setup();
  const [k, bath] = floor.rooms;
  assert.deepEqual(roomLiveSensors(hass, floor, k, "leak"), ["binary_sensor.sink_leak"]);
  assert.deepEqual(roomLiveSensors(hass, floor, k, "motion"), ["binary_sensor.kitchen_motion"]);
  // occupancy and presence count as motion
  assert.deepEqual(roomLiveSensors(hass, floor, bath, "motion"), ["binary_sensor.bath_presence"]);
  assert.deepEqual(roomLiveSensors(hass, floor, bath, "leak"), []);
});

test("a room's chosen sensor replaces the automatic pick; a placed sensor counts where it stands", () => {
  const { hass, floor } = setup();
  const [k, bath] = floor.rooms;
  // the washer's leak sensor has no area but is placed in the bath
  floor.placements = [{ entity_id: "binary_sensor.washer_leak", x: 5, z: 1, y: null }];
  assert.deepEqual(roomLiveSensors(hass, floor, bath, "leak"), ["binary_sensor.washer_leak"]);
  // the kitchen's motion sensor placed in the bath lights the bath, not the kitchen
  floor.placements.push({ entity_id: "binary_sensor.kitchen_motion", x: 6, z: 2, y: null });
  assert.deepEqual(roomLiveSensors(hass, floor, k, "motion"), []);
  assert.deepEqual(roomLiveSensors(hass, floor, bath, "motion"), ["binary_sensor.bath_presence", "binary_sensor.kitchen_motion"]);
  // chosen per room: one sensor, or none at all
  bath.live = { motion: "binary_sensor.bath_presence", leak: "none" };
  assert.deepEqual(roomLiveSensors(hass, floor, bath, "motion"), ["binary_sensor.bath_presence"]);
  assert.deepEqual(roomLiveSensors(hass, floor, bath, "leak"), []);
});

test("motion lights its room for a short, configurable time after it starts", () => {
  const { hass, b } = setup();
  const t0 = Date.parse("2026-10-29T08:00:00Z");
  const at = (s: number) => t0 + s * 1000;
  hass.states["binary_sensor.kitchen_motion"] = st("binary_sensor.kitchen_motion", "on", { device_class: "motion" }, new Date(t0).toISOString());
  // 30 s by default
  assert.equal(effectSettings(b).motion_seconds, 30);
  let lit = motionRooms(hass, b, at(5));
  assert.deepEqual([...lit.rooms], ["k"]);
  // the view looks again when the light should go out
  assert.equal(lit.next, at(30));
  lit = motionRooms(hass, b, at(31));
  assert.deepEqual([...lit.rooms], []);
  assert.equal(lit.next, null);
  // a longer time from the settings; 0 switches the effect off
  b.settings.effects = { motion_seconds: 120 };
  assert.deepEqual([...motionRooms(hass, b, at(90)).rooms], ["k"]);
  b.settings.effects = { motion_seconds: 0 };
  assert.deepEqual([...motionRooms(hass, b, at(5)).rooms], []);
  // a sensor that is off lights nothing
  b.settings.effects = null;
  hass.states["binary_sensor.kitchen_motion"].state = "off";
  assert.deepEqual([...motionRooms(hass, b, at(5)).rooms], []);
});

function heating() {
  const { hass, b } = setup();
  Object.assign(hass.entities!, {
    "climate.bath_trv": { entity_id: "climate.bath_trv", device_id: "trv1", area_id: "bath" },
    "sensor.bath_trv_temperature": { entity_id: "sensor.bath_trv_temperature", device_id: "trv1", area_id: "bath" },
    "sensor.bath_trv_battery": { entity_id: "sensor.bath_trv_battery", device_id: "trv1", area_id: "bath" },
    "water_heater.tank": { entity_id: "water_heater.tank", device_id: "hp", area_id: null },
    "sensor.hp_flow_temperature": { entity_id: "sensor.hp_flow_temperature", device_id: "hp", area_id: null },
    "sensor.hp_tank_temperature": { entity_id: "sensor.hp_tank_temperature", device_id: "hp", area_id: null },
  });
  Object.assign(hass.states, {
    "climate.bath_trv": st("climate.bath_trv", "heat", { current_temperature: 20, temperature: 21 }),
    "sensor.bath_trv_temperature": st("sensor.bath_trv_temperature", "31.5", { device_class: "temperature", unit_of_measurement: "°C" }),
    "sensor.bath_trv_battery": st("sensor.bath_trv_battery", "80", { device_class: "battery", unit_of_measurement: "%" }),
    "water_heater.tank": st("water_heater.tank", "eco", { current_temperature: 48 }),
    "sensor.hp_flow_temperature": st("sensor.hp_flow_temperature", "35", { device_class: "temperature", unit_of_measurement: "°C" }),
    "sensor.hp_tank_temperature": st("sensor.hp_tank_temperature", "122", { device_class: "temperature", unit_of_measurement: "°F" }),
  });
  const item = (type: string, extra: Partial<Furniture> = {}): Furniture => ({ id: type, type, x: 5, z: 1, rotation: 0, w: 1, d: 0.1, h: 0.6, variant: null, ...extra });
  return { hass, b, item };
}

test("temperatures shade from cold blue to warm red", () => {
  const [r0, , b0] = tempShade(18, 18, 45);
  const [r1, , b1] = tempShade(45, 18, 45);
  assert.ok(b0 > 0.8 && r0 < 0.4, "cold is blue");
  assert.ok(r1 > 0.9 && b1 < 0.2, "hot is red");
  // clamped beyond the ends; warmer is redder in between
  assert.deepEqual(tempShade(5, 18, 45), tempShade(18, 18, 45));
  assert.deepEqual(tempShade(80, 18, 45), tempShade(45, 18, 45));
  assert.ok(tempShade(35, 18, 45)[0] > tempShade(25, 18, 45)[0]);
});

test("a radiator with a temperature entity shades with it", () => {
  const { hass, b, item } = heating();
  // without a temperature entity it keeps its plain look
  assert.equal(itemShade(hass, b, item("radiator")), null);
  // the TRV's own temperature sensor is found through its thermostat's device
  const trv = itemShade(hass, b, item("radiator", { entity: "climate.bath_trv" }));
  assert.equal(trv?.celsius, 31.5);
  assert.deepEqual(trv?.color, tempShade(31.5, 18, 45));
  // a chosen sensor wins; the settings move the scale; "none" switches it off
  const chosen = itemShade(hass, b, item("radiator", { entity: "climate.bath_trv", temp_sensor: "sensor.hp_flow_temperature" }));
  assert.equal(chosen?.celsius, 35);
  b.settings.effects = { radiator_cold: 20, radiator_hot: 35 };
  assert.deepEqual(chosen && itemShade(hass, b, item("radiator", { temp_sensor: "sensor.hp_flow_temperature" }))?.color, tempShade(35, 20, 35));
  assert.equal(itemShade(hass, b, item("radiator", { entity: "climate.bath_trv", temp_sensor: "none" })), null);
  // a temperature sensor at its symbol counts too
  assert.equal(itemShade(hass, b, item("radiator", { extra: "sensor.hp_flow_temperature" }))?.celsius, 35);
  assert.equal(itemShade(hass, b, item("radiator", { extra: "sensor.bath_trv_battery" })), null);
});

test("a hot-water cylinder shows its tank temperature", () => {
  const { hass, b, item } = heating();
  const cyl = "pack:amluto.devices:hot_water_cylinder_200";
  // its water heater's temperature
  const wh = itemShade(hass, b, item(cyl, { entity: "water_heater.tank" }));
  assert.equal(wh?.celsius, 48);
  assert.equal(wh?.kind, "tank");
  assert.deepEqual(wh?.color, tempShade(48, 25, 55));
  // a tank sensor of the heat pump wins over the water heater (in °F, read as °C)
  const tank = itemShade(hass, b, item(cyl, { entity: "water_heater.tank", temp_sensor: "sensor.hp_tank_temperature" }));
  assert.equal(tank?.celsius, 50);
  assert.equal(tank?.sensor, "sensor.hp_tank_temperature");
  // with only a sensor linked, and none at all
  assert.equal(itemShade(hass, b, item(cyl, { temp_sensor: "sensor.hp_tank_temperature" }))?.celsius, 50);
  assert.equal(itemShade(hass, b, item(cyl)), null);
  // an unavailable sensor shades nothing
  hass.states["sensor.hp_tank_temperature"].state = "unavailable";
  assert.equal(itemShade(hass, b, item(cyl, { temp_sensor: "sensor.hp_tank_temperature" })), null);
  // other items never shade
  assert.equal(itemShade(hass, b, item("sofa", { temp_sensor: "sensor.hp_flow_temperature" })), null);
});

test("towel rails shade like radiators; other bathroom items don't (#140)", () => {
  for (const id of ["towel_rail_800", "heated_towel_rail_500_1200", "electric_towel_rail_500_800", "radiator_type22_600_1200"])
    assert.equal(shadeKind(`pack:amluto.devices:${id}`), "radiator", id);
  assert.equal(shadeKind("pack:amluto.kitchen-bath:towel_hook"), null);
});
