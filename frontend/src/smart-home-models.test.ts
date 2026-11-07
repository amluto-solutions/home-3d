// Smart-home models, batch 1 (#79): the amluto.devices pack's sensor and switch markers, wall thermostat,
// video doorbell, outdoor wall light, combi boiler, smart water meter and smoke/CO alarm.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { mainLinkAccepts } from "./furniture-links.ts";
import { buildIndex, filterEntries, type LibraryEntry } from "./library-index.ts";
import { isCameraItem, isElectric, isThermostatItem, setPacks, type FurniturePack, type PackItem } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

const FOLDER = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs/amluto.devices", import.meta.url));
const files: string[] = [];
for (const dir of readdirSync(FOLDER)) {
  if (statSync(join(FOLDER, dir)).isDirectory()) for (const f of readdirSync(join(FOLDER, dir))) files.push(join(FOLDER, dir, f));
}
const items = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as PackItem);
const pack = { ...JSON.parse(readFileSync(join(FOLDER, "pack.json"), "utf8")), bundled: true, items } as FurniturePack;
const type = (id: string) => `pack:${pack.id}:${id}`;
const hass = { states: {}, entities: {} } as unknown as HomeAssistant;
const index = (): LibraryEntry[] => buildIndex({ packs: [pack], basics: [], language: "en", basicName: (t) => t, basicNameEn: (t) => t, kindName: (k) => k, size: () => [1, 1, 1] });
const off = { query: "", room: null, electric: false, light: false, outdoor: false };

const BATCH_1 = [
  "entity_sensor_marker", "entity_sensor_marker_surface", "entity_switch_marker_1g", "entity_switch_marker_2g",
  "thermostat_round", "thermostat_display", "video_doorbell", "video_doorbell_wide",
  "outdoor_wall_light_lantern", "outdoor_wall_light_bulkhead", "outdoor_wall_light_pir",
  "combi_boiler", "combi_boiler_floor", "water_meter_smart", "water_meter_boundary_box",
  "smoke_co_alarm", "smoke_alarm", "heat_alarm",
];

test("every batch 1 device exists, is electric, stays under 20 KB and is found with the chips off", () => {
  const all = index();
  for (const id of BATCH_1) {
    const item = items.find((i) => i.id === id);
    assert.ok(item, `${id} is in the devices pack`);
    assert.ok(item.electric || item.light, `${id} links an entity`);
    const file = files.find((f) => f.endsWith(`${id}.json`))!;
    assert.ok(statSync(file).size < 20 * 1024, `${id} is under 20 KB`);
    assert.ok(filterEntries(all, off).some((e) => e.type === type(id)), `${id} shows with the chips off`);
    assert.ok(filterEntries(all, { ...off, query: item.name.en! }).some((e) => e.type === type(id)), `${id} is found by its name`);
    assert.ok(filterEntries(all, { ...off, electric: true }).some((e) => e.type === type(id)), `${id} shows under Electric`);
  }
});

test("'Lights up' keeps the outdoor wall lights and hides the devices that give no light", () => {
  const lit = filterEntries(index(), { ...off, light: true }).map((e) => e.type);
  for (const id of BATCH_1) assert.equal(lit.includes(type(id)), id.startsWith("outdoor_wall_light"), `${id} under Lights up`);
  // with Outdoor on, the outdoor wall lights and the boundary box show
  const out = filterEntries(index(), { ...off, outdoor: true }).map((e) => e.type);
  assert.ok(out.includes(type("outdoor_wall_light_lantern")));
  assert.ok(out.includes(type("water_meter_boundary_box")));
  assert.ok(!out.includes(type("thermostat_round")));
});

test("UK words find the devices", () => {
  const all = index();
  const find = (q: string) => filterEntries(all, { ...off, query: q }).map((e) => e.type);
  assert.ok(find("bulkhead").includes(type("outdoor_wall_light_bulkhead")));
  assert.ok(find("stop tap").includes(type("water_meter_boundary_box")) || find("stopcock").includes(type("water_meter_boundary_box")));
  assert.ok(find("combi").includes(type("combi_boiler")));
  assert.ok(find("hive").includes(type("thermostat_round")));
  assert.ok(find("ring").includes(type("video_doorbell")));
  assert.ok(find("carbon monoxide").includes(type("smoke_co_alarm")));
});

test("entity links: markers take anything, thermostats climate, doorbells cameras, the rest their own kind", () => {
  setPacks([pack]);
  for (const id of ["entity_sensor_marker", "entity_sensor_marker_surface", "entity_switch_marker_1g", "entity_switch_marker_2g"]) {
    for (const e of ["sensor.a", "binary_sensor.a", "switch.a", "light.a", "climate.a", "cover.a", "camera.a", "lock.a", "input_boolean.a", "media_player.a"]) {
      assert.equal(mainLinkAccepts(hass, type(id), e), true, `${id} takes ${e}`);
    }
  }
  for (const id of ["thermostat_round", "thermostat_display"]) {
    assert.equal(isThermostatItem(type(id)), true);
    assert.equal(mainLinkAccepts(hass, type(id), "climate.a"), true);
    assert.equal(mainLinkAccepts(hass, type(id), "sensor.a"), false);
  }
  for (const id of ["video_doorbell", "video_doorbell_wide"]) {
    assert.equal(isCameraItem(type(id)), true);
    assert.equal(mainLinkAccepts(hass, type(id), "camera.a"), true);
  }
  for (const id of ["combi_boiler", "combi_boiler_floor"]) {
    assert.equal(mainLinkAccepts(hass, type(id), "water_heater.a"), true);
    assert.equal(mainLinkAccepts(hass, type(id), "climate.a"), true);
  }
  for (const id of ["water_meter_smart", "water_meter_boundary_box"]) {
    assert.equal(mainLinkAccepts(hass, type(id), "sensor.water_total"), true);
    assert.equal(mainLinkAccepts(hass, type(id), "light.a"), false);
  }
  for (const id of ["smoke_co_alarm", "smoke_alarm", "heat_alarm"]) {
    assert.equal(mainLinkAccepts(hass, type(id), "binary_sensor.a"), true);
    assert.equal(mainLinkAccepts(hass, type(id), "light.a"), false);
  }
  for (const id of ["outdoor_wall_light_lantern", "outdoor_wall_light_bulkhead", "outdoor_wall_light_pir"]) {
    assert.equal(mainLinkAccepts(hass, type(id), "light.a"), true);
    assert.equal(mainLinkAccepts(hass, type(id), "switch.a"), true);
    assert.equal(isElectric(type(id)), true);
  }
  setPacks([]);
});

test("a water meter is no power meter in the energy flow", async () => {
  const { energyRole } = await import("./packs.ts");
  setPacks([pack]);
  assert.equal(energyRole(type("water_meter_smart")), null);
  assert.equal(energyRole(type("water_meter_boundary_box")), null);
  setPacks([]);
});
