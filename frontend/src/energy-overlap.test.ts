// #43: nothing in the energy flow is counted twice. A smart plug inside a circuit (a circuit monitor's channel) keeps
// its own watts but is not added again on top of its circuit's; a battery is a source while it discharges and a load
// only while it charges, never a consumer on top of that.
import assert from "node:assert/strict";
import { test } from "node:test";
import { energySummary, findConsumers, flowSegments, isLoad, sourceMix } from "./energy.ts";
import type { Building, Room } from "./model.ts";
import { emptyBuilding, newFloor } from "./model.ts";
import { setPacks, type PackItem } from "./packs.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";

const power = (entity_id: string, w: string): HassEntity => ({ entity_id, state: w, attributes: { device_class: "power", unit_of_measurement: "W" } });

function rect(id: string, x0: number, z0: number, x1: number, z1: number): Room {
  return { id, name: id, area_id: null, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], floor_material: "wood" };
}

function hassWith(states: HassEntity[]): HomeAssistant {
  return {
    language: "en",
    connection: {} as HomeAssistant["connection"],
    callWS: async () => undefined as never,
    callService: async () => undefined,
    entities: {},
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
  };
}

/** Two rooms side by side, the meter in the west one; the kitchen circuit's meter and a plug on it in the east one. */
function house(): Building {
  const b = emptyBuilding();
  const g = { ...newFloor("g", "Ground", 0), rooms: [rect("hall", 0, 0, 4, 3), rect("kitchen", 4, 0, 8, 3)] };
  g.placements = [
    { entity_id: "sensor.kitchen_circuit_power", x: 7, z: 2, y: null },
    { entity_id: "sensor.kettle_plug_power", x: 6, z: 0.5, y: null, circuit: "sensor.kitchen_circuit_power" },
  ];
  b.floors = [g];
  b.energy = { ...b.energy, meter: { floor_id: "g", x: 0.5, z: 1.5 } };
  return b;
}

/** The piece of cable that crosses the wall between the two rooms (x = 4): it carries everything in the kitchen. */
const crossing = (segs: ReturnType<typeof flowSegments>) => segs.find((s) => s.kind === "consumer" && (s.a[0] - 4) * (s.b[0] - 4) < 0 && s.a[1] === s.b[1])!;

test("a plug inside a circuit keeps its own watts, but the cable carries the circuit's watts only once", () => {
  const hass = hassWith([power("sensor.kitchen_circuit_power", "1500"), power("sensor.kettle_plug_power", "1200")]);
  const b = house();
  const consumers = findConsumers(hass, b);
  // the plug still reports its own watts (its pin, its card)
  assert.equal(consumers.find((c) => c.powerEntity === "sensor.kettle_plug_power")!.power, 1200);
  const segs = flowSegments({ building: b, consumers, summary: energySummary(hass, b, consumers) });
  // the kitchen circuit draws 1500 W in all, the kettle's 1200 W among them
  assert.equal(crossing(segs).power, 1500);
  // the kettle's own branch carries its 1200 W
  assert.ok(segs.some((s) => s.kind === "consumer" && s.power === 1200), "the plug's own branch");
});

test("without grid and solar sensors the house total adds a plug inside a circuit only once", () => {
  const hass = hassWith([power("sensor.kitchen_circuit_power", "1500"), power("sensor.kettle_plug_power", "1200")]);
  const b = house();
  assert.equal(energySummary(hass, b, findConsumers(hass, b)).consumption, 1500);
});

/** The house with a home battery in the kitchen, hung on the meter (there is no inverter); its power sensor + = discharging. */
function withBattery(): Building {
  const b = house();
  b.floors[0].furniture.push({ id: "bat", type: "home_battery", x: 5, z: 2.5, rotation: 0, w: 0.6, d: 0.25, h: 1.1, variant: null, power: "sensor.battery_power" });
  return b;
}

test("a battery's power sensor placed on its own as well is no consumer: discharging, it is a source in the mix", () => {
  const hass = hassWith([power("sensor.kitchen_circuit_power", "1500"), power("sensor.kettle_plug_power", "1200"), power("sensor.battery_power", "900")]);
  const b = withBattery();
  b.floors[0].placements.push({ entity_id: "sensor.battery_power", x: 5, z: 2.5, y: null });
  const consumers = findConsumers(hass, b);
  assert.deepEqual(
    consumers.map((c) => c.powerEntity),
    ["sensor.kitchen_circuit_power", "sensor.kettle_plug_power"],
  );
  // no grid or solar sensor: the house uses what the battery gives
  const summary = energySummary(hass, b, consumers);
  assert.equal(summary.battery, 900);
  assert.equal(summary.consumption, 900);
  // the loads run on the battery: all green
  assert.deepEqual(sourceMix("consumer", summary), { solar: 0, battery: 1, grid: 0 });
});

const packItem = (id: string, family: string): PackItem => ({ id, name: { en: id }, size: [0.5, 0.2, 0.6], group: "energy", family, electric: true, parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "white" }] });

test("an item's own power sensor is a load only for consumers: no meter, inverter, battery or solar panel", () => {
  setPacks([{ id: "t", name: "T", publisher: "t", items: [packItem("station", "power_station"), packItem("cu", "consumer_unit"), packItem("panel", "solar_panel"), packItem("plug", "smart_plug"), packItem("hp", "heat_pump"), packItem("charger", "ev_charger")] }]);
  for (const type of ["home_battery", "pack:t:station", "meter", "pack:t:cu", "inverter", "pack:t:panel"]) assert.equal(isLoad(type), false, type);
  for (const type of ["pack:t:plug", "pack:t:hp", "wallbox", "pack:t:charger", "washer"]) assert.equal(isLoad(type), true, type);
});

test("a cable shared by loads and a battery: a discharging battery takes its watts off, a charging one adds them", () => {
  const b = withBattery();
  const run = (battery: string) => {
    const hass = hassWith([power("sensor.kitchen_circuit_power", "1500"), power("sensor.kettle_plug_power", "1200"), power("sensor.battery_power", battery)]);
    const consumers = findConsumers(hass, b);
    return flowSegments({ building: b, consumers, summary: energySummary(hass, b, consumers) });
  };
  // discharging 900 W in the kitchen: only 600 W of the kitchen's 1500 W come through the wall
  assert.equal(crossing(run("900")).power, 600);
  // the battery's own cable carries its 900 W, flowing out of the battery
  const out = run("900").filter((s) => s.kind === "battery");
  assert.ok(out.length && out.every((s) => s.power === 900));
  // charging 900 W: the kitchen and the battery both draw through the wall
  assert.equal(crossing(run("-900")).power, 2400);
});

test("source mix: a charging battery is a load on the pool, a discharging one a green share of it", () => {
  const at = (grid: number, solar: number, battery: number) => ({ grid, solar, battery, soc: null, tariff: null, consumption: null });
  // 1000 W of sun and 300 W import, 500 W into the battery: the battery is no source, the charge runs on sun and grid
  assert.deepEqual(sourceMix("consumer", at(300, 1000, -500)), { solar: 1000 / 1300, battery: 0, grid: 300 / 1300 });
  assert.deepEqual(sourceMix("battery", at(300, 1000, -500)), { solar: 1000 / 1300, battery: 0, grid: 300 / 1300 });
  // 600 W out of the battery and 200 W import at night: three quarters green
  assert.deepEqual(sourceMix("consumer", at(200, 0, 600)), { solar: 0, battery: 0.75, grid: 0.25 });
  assert.deepEqual(sourceMix("battery", at(200, 0, 600)), { solar: 0, battery: 1, grid: 0 });
});
