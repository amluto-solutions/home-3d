import assert from "node:assert/strict";
import { test } from "node:test";
import { mainLinkAccepts, isThermostatItem, isCameraItem, isTvLike, linkField } from "./furniture-links.ts";
import { isElectric, setPacks, type FurniturePack } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

const part = { shape: "box" as const, x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "white" };
const PACK: FurniturePack = {
  id: "demo.heat",
  name: "Demo",
  publisher: "Demo",
  items: [
    { id: "radiator_trv_600", name: { en: "Radiator with TRV" }, size: [0.7, 0.1, 0.6], family: "radiator_trv", tags: ["radiator", "trv"], mount: "wall", parts: [part] },
    { id: "radiator_valve_smart", name: { en: "Smart valve" }, size: [0.05, 0.05, 0.1], family: "radiator_valve", tags: ["trv", "thermostat"], parts: [part] },
    { id: "wall_camera", name: { en: "Door camera" }, size: [0.05, 0.03, 0.14], family: "door_camera", tags: ["security camera", "camera"], electric: true, parts: [part] },
    { id: "plain_shelf", name: { en: "Shelf" }, size: [1, 0.3, 1], parts: [part] },
  ],
};
const TRV = "pack:demo.heat:radiator_trv_600";
const VALVE = "pack:demo.heat:radiator_valve_smart";
const CAM = "pack:demo.heat:wall_camera";
const SHELF = "pack:demo.heat:plain_shelf";

const hass = { states: {}, entities: {} } as unknown as HomeAssistant;

test("a pack radiator with a TRV and a smart valve are thermostat items that link like a radiator (#81)", () => {
  setPacks([PACK]);
  assert.equal(isThermostatItem(TRV), true);
  assert.equal(isThermostatItem(VALVE), true);
  assert.equal(isThermostatItem("radiator"), true);
  assert.equal(isThermostatItem(SHELF), false);
  // they get the Device link field like the built-in radiator
  assert.equal(isElectric(TRV), true);
  assert.equal(isElectric(VALVE), true);
  assert.equal(isElectric(SHELF), false);
  // and that field offers thermostats only
  assert.equal(mainLinkAccepts(hass, TRV, "climate.sample_lounge"), true);
  assert.equal(mainLinkAccepts(hass, VALVE, "climate.sample_lounge"), true);
  assert.equal(mainLinkAccepts(hass, TRV, "sensor.sample_temperature"), false);
  setPacks([]);
});

test("a camera item's device field offers camera entities, not only switches (#81)", () => {
  setPacks([PACK]);
  assert.equal(isCameraItem(CAM), true);
  assert.equal(isCameraItem(TRV), false);
  assert.equal(mainLinkAccepts(hass, CAM, "camera.sample_door"), true);
  assert.equal(mainLinkAccepts(hass, CAM, "switch.sample_plug"), true);
  // other items still do not list cameras
  assert.equal(mainLinkAccepts(hass, "fridge", "camera.sample_door"), false);
  setPacks([]);
});

test("the built-in radiator and air conditioner keep their climate-only link (#81)", () => {
  assert.equal(mainLinkAccepts(hass, "radiator", "climate.sample_lounge"), true);
  assert.equal(mainLinkAccepts(hass, "radiator", "switch.sample_plug"), false);
  assert.equal(mainLinkAccepts(hass, "ac_unit", "climate.sample_lounge"), true);
  assert.equal(mainLinkAccepts(hass, "lamp_floor", "light.sample_lamp"), true);
  assert.equal(mainLinkAccepts(hass, "lamp_floor", "climate.sample_lounge"), false);
});

test("a pack TRV radiator finds the thermostat of its room, a camera item the room's camera (#81)", async () => {
  const { furnitureEntities } = await import("./devices.ts");
  const { newFloor } = await import("./model.ts");
  setPacks([PACK]);
  const states: Record<string, unknown> = {};
  const entities: Record<string, unknown> = {};
  const add = (id: string, state: string, attributes: Record<string, unknown> = {}) => {
    entities[id] = { entity_id: id, area_id: "area_a" };
    states[id] = { entity_id: id, state, attributes };
  };
  add("climate.sample_radiator", "heat", { friendly_name: "Radiator", hvac_action: "idle" });
  add("camera.sample_door", "idle", { friendly_name: "Door" });
  add("switch.sample_door_status_light", "on", { friendly_name: "Door status light" });
  const h = { states, entities, devices: {}, areas: { area_a: { area_id: "area_a", name: "A" } } } as unknown as HomeAssistant;
  const item = (id: string, type: string) => ({ id, type, x: 1, z: 1, rotation: 0, w: 0.5, d: 0.1, h: 0.5, variant: null, entity: null, power: null });
  const floor = {
    ...newFloor("f", "F", 0),
    rooms: [{ id: "r", name: "A", points: [[0, 0], [4, 0], [4, 4], [0, 4]] as [number, number][], area_id: "area_a" }],
    furniture: [item("trv", TRV), item("cam", CAM)],
  };
  const links = furnitureEntities(h, [floor as never]);
  assert.equal(links.get("trv")?.entity, "climate.sample_radiator");
  assert.equal(links.get("cam")?.entity, "camera.sample_door");
  setPacks([]);
});

test("a thermostat that does not report hvac_action counts as heating while below its target in heat mode (#81)", async () => {
  const { isActive } = await import("./devices.ts");
  const st = (state: string, attributes: Record<string, unknown>) => ({ entity_id: "climate.sample_trv", state, attributes }) as never;
  assert.equal(isActive(st("heat", { temperature: 21, current_temperature: 19 })), true);
  assert.equal(isActive(st("heat", { temperature: 19, current_temperature: 21 })), false);
  assert.equal(isActive(st("off", { temperature: 21, current_temperature: 19 })), false);
  // a reported action still wins
  assert.equal(isActive(st("heat", { temperature: 21, current_temperature: 19, hvac_action: "idle" })), false);
  assert.equal(isActive(st("heat", { hvac_action: "heating" })), true);
});

// Household custom items as people make them in the item editor (#132): no family, the kind lives in the tags; a
// thermostat's and a boiler's display are screen parts, which made them look like TVs.
const screen = { ...part, screen: true, glow: true, w: 0.8, h: 0.8 };
const OWN: FurniturePack = {
  id: "household.custom",
  name: "Your own items",
  publisher: "You",
  items: [
    { id: "wall_thermostat", name: { en: "Smart wall thermostat" }, size: [0.09, 0.03, 0.09], tags: ["thermostat", "heating control", "climate"], electric: true, mount: "wall", parts: [part, screen] },
    { id: "combi_gas_boiler", name: { en: "Combi gas boiler" }, size: [0.4, 0.35, 0.7], tags: ["boiler", "combi", "gas boiler", "central heating", "hot water"], electric: true, mount: "wall", parts: [part, screen] },
    { id: "smoke_co_alarm", name: { en: "Smoke and CO alarm" }, size: [0.12, 0.12, 0.04], tags: ["smoke alarm", "co alarm", "carbon monoxide", "detector"], electric: true, mount: "ceiling", parts: [part] },
    { id: "smart_water_meter", name: { en: "Smart water meter" }, size: [0.18, 0.12, 0.2], tags: ["water meter", "smart meter", "water"], electric: true, mount: "wall", parts: [part, screen] },
    { id: "hatchback", name: { en: "Electric hatchback" }, size: [1.8, 4.5, 1.5], tags: ["electric car", "ev"], electric: true, vehicle: true, parts: [part] },
    { id: "wall_tv", name: { en: "Wall TV" }, size: [1.2, 0.05, 0.7], tags: ["tv"], electric: true, parts: [part, screen] },
  ],
};
const own = (id: string) => `pack:household.custom:${id}`;

test("a household thermostat and boiler get a heating link with thermostats, not the TV field (#132)", () => {
  setPacks([OWN]);
  assert.equal(linkField(own("wall_thermostat")).label, "furn_entity_climate");
  assert.equal(mainLinkAccepts(hass, own("wall_thermostat"), "climate.sample_hall"), true);
  assert.equal(mainLinkAccepts(hass, own("wall_thermostat"), "media_player.sample_tv"), false);
  assert.equal(linkField(own("combi_gas_boiler")).label, "furn_entity_heater");
  assert.equal(mainLinkAccepts(hass, own("combi_gas_boiler"), "climate.sample_heating"), true);
  assert.equal(mainLinkAccepts(hass, own("combi_gas_boiler"), "water_heater.sample_hot_water"), true);
  assert.deepEqual(linkField(own("combi_gas_boiler")).domains.slice(0, 2), ["climate", "water_heater"]);
  assert.equal(isTvLike(own("wall_thermostat")), false);
  assert.equal(isTvLike(own("combi_gas_boiler")), false);
  // a real TV is still one
  assert.equal(linkField(own("wall_tv")).label, "furn_entity_tv");
  setPacks([]);
});

test("a household smoke alarm and water meter get a sensor link, a car a car link (#132)", () => {
  setPacks([OWN]);
  const alarmHass = { states: { "binary_sensor.sample_smoke": { entity_id: "binary_sensor.sample_smoke", state: "off", attributes: {} } }, entities: {} } as unknown as HomeAssistant;
  assert.equal(linkField(own("smoke_co_alarm")).label, "furn_entity_sensor");
  assert.equal(mainLinkAccepts(alarmHass, own("smoke_co_alarm"), "binary_sensor.sample_smoke"), true);
  assert.equal(linkField(own("smart_water_meter")).label, "furn_entity_sensor");
  assert.equal(mainLinkAccepts(hass, own("smart_water_meter"), "sensor.sample_water_total"), true);
  assert.deepEqual(linkField(own("smart_water_meter")).domains, ["sensor", "binary_sensor"]);
  assert.equal(linkField(own("hatchback")).label, "furn_entity_car");
  assert.equal(mainLinkAccepts(hass, own("hatchback"), "device_tracker.sample_car"), true);
  assert.equal(mainLinkAccepts(hass, own("hatchback"), "sensor.sample_car_battery"), true);
  // a plain item keeps the generic Device field
  assert.equal(linkField("fridge").label, "furn_entity");
  setPacks([]);
});
