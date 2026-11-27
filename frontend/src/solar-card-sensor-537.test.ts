// "This item" of the main solar card's show rule (#537): the editor names the sensor the 3D view judges, also one found
// on a device (not set by hand).

import assert from "node:assert/strict";
import { test } from "node:test";
import { mainSolarSensor } from "./energy.ts";
import { emptyBuilding, newFloor, type Building, type Furniture } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

for (const name of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${name}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = await import("./components/editor.ts");

const item = (id: string, type: string, power: string | null = null): Furniture => ({ id, type, x: 1, z: 1, rotation: 0, w: 0.5, d: 0.2, h: 0.5, variant: null, power }) as Furniture;

function plan(furniture: Furniture[], energy: Partial<Building["energy"]> = {}): Building {
  const b = emptyBuilding();
  const floor = newFloor("g", "Ground", 0);
  floor.furniture = furniture;
  b.floors = [floor];
  b.energy = { ...b.energy, ...energy };
  return b;
}

const own = (f: Furniture) => (f.power && f.power !== "none" ? f.power : null);

test("the plant's solar sensor, else an inverter's or solar panel's power sensor, else the grid meter", () => {
  const inverter = item("i1", "inverter", "sensor.inv_power");
  assert.equal(mainSolarSensor(plan([inverter], { solar: "sensor.pv", grid: "sensor.grid" }), own), "sensor.pv");
  assert.equal(mainSolarSensor(plan([inverter], { grid: "sensor.grid" }), own), "sensor.inv_power");
  assert.equal(mainSolarSensor(plan([], { grid: "sensor.grid" }), own), "sensor.grid");
  assert.equal(mainSolarSensor(plan([]), own), null);
});

test("the editor's \"This item\" takes an inverter's found sensor, as the 3D view does", () => {
  const states = {
    "switch.inverter": { entity_id: "switch.inverter", state: "on", attributes: {} },
    "sensor.inverter_power": { entity_id: "sensor.inverter_power", state: "900", attributes: { device_class: "power", unit_of_measurement: "W" } },
  };
  const entities = { "switch.inverter": { entity_id: "switch.inverter", device_id: "d1" }, "sensor.inverter_power": { entity_id: "sensor.inverter_power", device_id: "d1" } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = new Fp3dEditor() as any;
  el.hass = { language: "en", user: { is_admin: true }, states, entities, devices: {}, areas: {} } as unknown as HomeAssistant;
  el._doc = plan([{ ...item("i1", "inverter"), entity: "switch.inverter" }], { grid: "sensor.grid" });
  assert.equal(el.mainCardSensor(), "sensor.inverter_power");
});
