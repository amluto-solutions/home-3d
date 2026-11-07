// #415 (WORD-3): the car section links one Home Assistant device, lists the readings found with their values, and has
// one "Add a reading" menu for the rest. No "Not found" rows, no seven "Automatic (none found)" pickers; the plan keeps
// the keys it stored before (a vehicle's entity, car.device and the car.* roles).

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { setPacks, type FurniturePack } from "../packs.ts";
import { carDeviceOptions, deviceSeed } from "../car-device.ts";
import { panelUi, resetFolds } from "./editor/item-sections.ts";
import { makeEditor, square } from "./editor-harness.ts";

const PACK: FurniturePack = {
  id: "demo.cars",
  name: "Cars",
  publisher: "Demo",
  items: [{ id: "leaf", name: { en: "Demo Leaf" }, size: [1.8, 4.5, 1.5], vehicle: true, electric: true, parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0.2, h: 0.4, color: "paint" }] }],
} as unknown as FurniturePack;
setPacks([PACK]);

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

const st = (id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id: id, state, attributes: { friendly_name: id, ...attributes } });

/** Two cars: "Sample car" with four readings (charge, range, charging, cable), "Bare car" with only its tracker. */
function hass() {
  const states = {
    "sensor.sample_car_battery": st("sensor.sample_car_battery", "78", { device_class: "battery", unit_of_measurement: "%" }),
    "sensor.sample_car_range": st("sensor.sample_car_range", "212", { unit_of_measurement: "km" }),
    "sensor.sample_car_charge_power": st("sensor.sample_car_charge_power", "3.6", { unit_of_measurement: "kW" }),
    "binary_sensor.sample_car_plug": st("binary_sensor.sample_car_plug", "on", { device_class: "plug" }),
    "device_tracker.bare_car": st("device_tracker.bare_car", "home"),
    "sensor.sample_lounge_temperature": st("sensor.sample_lounge_temperature", "20.5", { unit_of_measurement: "°C" }),
  };
  const on = (device: string, ...ids: string[]) => ids.map((id) => [id, { entity_id: id, device_id: device }] as const);
  return {
    states,
    entities: Object.fromEntries([
      ...on("dev_sample", "sensor.sample_car_battery", "sensor.sample_car_range", "sensor.sample_car_charge_power", "binary_sensor.sample_car_plug"),
      ...on("dev_bare", "device_tracker.bare_car"),
      ...on("dev_lounge", "sensor.sample_lounge_temperature"),
    ]),
    devices: { dev_sample: { id: "dev_sample", name: "Sample car" }, dev_bare: { id: "dev_bare", name: "Bare car" }, dev_lounge: { id: "dev_lounge", name: "Lounge sensor" } },
    areas: {},
    user: { is_admin: true },
    language: "en",
    locale: { language: "en" },
  };
}

const car = (extra: Partial<Furniture> = {}): Furniture => ({ id: "c", type: "pack:demo.cars:leaf", x: 2, z: 2, rotation: 0, w: 1.8, d: 4.5, h: 1.5, variant: null, ...extra }) as Furniture;

async function editorWith(f: Furniture) {
  resetFolds();
  const ed = await makeEditor([{ ...square("r", 0, 0, 6, 6), name: "Garage" }], [f]);
  ed.packs = [PACK];
  ed.hass = hass();
  ed.selectItem("furniture", f.id);
  return ed;
}
const carSection = (form: string) => form.slice(form.indexOf("fp3d-car-main"), form.indexOf("data-fold=appearance"));

test("the Car device picker offers car-like devices by name, not entities (#415)", () => {
  const h = hass() as never;
  assert.deepEqual(carDeviceOptions(h).map((o) => o.label), ["Bare car", "Sample car"], "a room sensor is no car");
  // the entity kept for a device: the one stored when it is on it, else the battery, else the tracker
  assert.equal(deviceSeed(h, "dev_sample", "sensor.sample_car_range"), "sensor.sample_car_range");
  assert.equal(deviceSeed(h, "dev_sample", "device_tracker.bare_car"), "sensor.sample_car_battery");
  assert.equal(deviceSeed(h, "dev_bare"), "device_tracker.bare_car");
  assert.equal(deviceSeed(h, "dev_none"), null);
});

test("a car with four readings shows four values, a badge and Add a reading for the rest (#415)", async () => {
  const ed = await editorWith(car({ entity: "sensor.sample_car_battery" }));
  const form = carSection(flat(ed.renderFurnitureForm(ed.furnitureItem)));
  assert.match(form, /4 readings/);
  assert.match(form, /Car device\s*<fp3d-entity-picker/);
  assert.match(form, /\.value=dev_sample/, "the picker shows the device, not an entity");
  assert.equal((form.match(/<fp3d-entity-picker/g) ?? []).length, 1, "one picker");
  assert.equal((form.match(/class="fp3d-found-row"/g) ?? []).length, 4);
  for (const v of [/<dd[^>]*>78\s?%/, /<dd[^>]*>212\s?km/, /<dd[^>]*>3\.6\s?kW/]) assert.match(form, v);
  assert.doesNotMatch(form, /Not found|of 7 found|Automatic \(none found\)|Another entity of the car|any entity of the car/);
  // Add a reading lists the three missing ones
  const add = form.slice(form.indexOf("fp3d-car-add"));
  assert.match(add, /Add a reading/);
  for (const r of ["Location", "Lock", "Climate"]) assert.match(add, new RegExp(`<option value=\\w+[^>]*>${r}`), r);
  assert.doesNotMatch(add, /<option value=soc/, "a found reading is not offered again");
});

test("a car with no readings shows one picker and Add a reading, nothing else (#415)", async () => {
  const ed = await editorWith(car({ entity: null }));
  const form = carSection(flat(ed.renderFurnitureForm(ed.furnitureItem)));
  assert.equal((form.match(/<fp3d-entity-picker/g) ?? []).length, 1);
  assert.match(form, /\.value=none/);
  assert.doesNotMatch(form, /fp3d-found|readings|Change what was found|Not found/);
  assert.match(form, /Add a reading/);
  assert.equal((form.match(/<option value=(soc|range|charging|plugged|tracker|lock|climate)/g) ?? []).length, 7);
});

test("choosing a reading opens its picker; picking stores the same car role key as before (#415)", async () => {
  const ed = await editorWith(car({ entity: "sensor.sample_car_battery" }));
  panelUi(ed, "c").adding = "lock";
  const form = carSection(flat(ed.renderFurnitureForm(ed.furnitureItem)));
  assert.equal((form.match(/<fp3d-entity-picker/g) ?? []).length, 2, "the device and the reading being added");
  assert.match(form, /Lock\s*<fp3d-entity-picker/);
  // a found reading cannot be "added": the menu forgets it
  panelUi(ed, "c").adding = "soc";
  assert.equal((carSection(flat(ed.renderFurnitureForm(ed.furnitureItem))).match(/<fp3d-entity-picker/g) ?? []).length, 1);
});

test("choosing a device stores one of its entities as before; None clears it (#415)", async () => {
  const ed = await editorWith(car({ entity: "sensor.sample_car_battery", car: { device: "sensor.sample_car_range" } }));
  const picker = (ed.carDevicePicker(ed.furnitureItem, true, []) as { values: unknown[] }).values;
  const change = picker.find((v) => typeof v === "function") as (e: unknown) => void;
  change({ stopPropagation() {}, detail: { value: "dev_bare" } });
  assert.equal(ed.furnitureItem.entity, "device_tracker.bare_car");
  assert.equal(ed.furnitureItem.car?.device ?? null, null, "the older second entity steps aside");
  // a parking spot keeps the car in car.device
  const spot = await editorWith({ ...car(), type: "parking" } as Furniture);
  const spotPicker = (spot.carDevicePicker(spot.furnitureItem, false, []) as { values: unknown[] }).values;
  (spotPicker.find((v) => typeof v === "function") as (e: unknown) => void)({ stopPropagation() {}, detail: { value: "dev_sample" } });
  assert.equal(spot.furnitureItem.car?.device, "sensor.sample_car_battery");
  (spotPicker.find((v) => typeof v === "function") as (e: unknown) => void)({ stopPropagation() {}, detail: { value: "none" } });
  assert.equal(spot.furnitureItem.car?.device ?? null, null);
});

test("a car linked to an entity without a device keeps the entity picker (#415)", async () => {
  const ed = await editorWith(car({ entity: "sensor.unregistered_car" }));
  const form = carSection(flat(ed.renderFurnitureForm(ed.furnitureItem)));
  assert.match(form, /\.value=sensor\.unregistered_car/);
});
