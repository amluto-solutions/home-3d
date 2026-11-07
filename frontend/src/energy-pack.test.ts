// Energy devices from a pack (#22): a pack inverter, battery, power station, EV charger, consumer unit, CT clamp box
// and solar panel take part in the energy flow like the built-in meter, inverter, battery and wallbox.
import assert from "node:assert/strict";
import { test } from "node:test";
import { deviceSensors, energySummary, flowSegments, meterPosition } from "./energy.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";
import { emptyBuilding, newFloor, type Building, type Furniture } from "./model.ts";
import { setPacks, type PackItem } from "./packs.ts";

const item = (id: string, family: string, extra: Partial<PackItem> = {}): PackItem => ({
  id,
  name: { en: id },
  size: [0.5, 0.2, 0.6],
  group: "energy",
  family,
  electric: true,
  parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "white" }],
  ...extra,
});

setPacks([
  {
    id: "test.energy",
    name: "Energy",
    publisher: "test",
    items: [
      item("hybrid_inverter", "inverter"),
      item("battery_9", "home_battery"),
      item("power_station", "power_station"),
      item("ev_charger", "ev_charger"),
      item("consumer_unit_10", "consumer_unit"),
      item("ct_clamp_box", "energy_monitor"),
      item("solar_panel", "solar_panel"),
      item("smart_plug", "smart_plug"),
    ],
  },
]);

const furn = (id: string, itemId: string, x: number, z: number, extra: Partial<Furniture> = {}): Furniture => ({ id, type: `pack:test.energy:${itemId}`, x, z, rotation: 0, w: 0.5, d: 0.2, h: 0.6, variant: null, ...extra });

function plan(...furniture: Furniture[]): Building {
  const b = emptyBuilding();
  const groundFloor = { ...newFloor("ground", "Ground", 0), rooms: [{ id: "a", name: "a", area_id: null, points: [[0, 0], [8, 0], [8, 4], [0, 4]] as [number, number][], floor_material: "wood" as const }] };
  groundFloor.furniture = furniture;
  b.floors = [groundFloor];
  return b;
}

test("pack energy devices bring their sensors like the built-in ones: consumer unit = grid, inverter = solar, battery and power station", () => {
  const b = plan(
    furn("cu", "consumer_unit_10", 1, 0.2, { power: "sensor.grid", export: "sensor.export" }),
    furn("inv", "hybrid_inverter", 2, 0.2, { power: "sensor.pv" }),
    furn("bat", "battery_9", 3, 0.2, { power: "sensor.bat", soc: "sensor.soc" }),
    furn("ps", "power_station", 4, 0.2, { power: "sensor.station", charge: "sensor.station_in", soc: "sensor.station_soc" }),
    furn("plug", "smart_plug", 5, 0.2, { power: "sensor.plug" }),
  );
  assert.deepEqual(deviceSensors(b), {
    grid: "sensor.grid",
    gridExport: "sensor.export",
    solar: ["sensor.pv"],
    battery: ["sensor.bat", "sensor.station"],
    charge: ["sensor.station_in"],
    batteries: [{ power: "sensor.bat", charge: null }, { power: "sensor.station", charge: "sensor.station_in" }],
    soc: ["sensor.soc", "sensor.station_soc"],
  });
  assert.deepEqual(meterPosition(b), { floor_id: "ground", x: 1, z: 0.2 });
});

test("a CT clamp box stands for the meter when there is no consumer unit", () => {
  const b = plan(furn("ct", "ct_clamp_box", 6, 0.2, { power: "sensor.grid" }));
  assert.equal(deviceSensors(b).grid, "sensor.grid");
  assert.deepEqual(meterPosition(b), { floor_id: "ground", x: 6, z: 0.2 });
});

const power = (entity_id: string, w: string): HassEntity => ({ entity_id, state: w, attributes: { device_class: "power", unit_of_measurement: "W" } });
const hassWith = (states: HassEntity[]): HomeAssistant => ({ language: "en", connection: {} as HomeAssistant["connection"], callWS: async () => undefined as never, callService: async () => undefined, entities: {}, states: Object.fromEntries(states.map((s) => [s.entity_id, s])) });

test("pack cables: solar panel → inverter → consumer unit, inverter → battery, consumer unit → EV charger", () => {
  const b = plan(
    furn("cu", "consumer_unit_10", 0.5, 0.3, { power: "sensor.grid" }),
    furn("inv", "hybrid_inverter", 7, 0.3, { power: "sensor.pv" }),
    furn("bat", "battery_9", 6, 0.3, { power: "sensor.bat" }),
    furn("pv", "solar_panel", 7.5, 3.5, { power: "sensor.panel" }),
  );
  const hass = hassWith([power("sensor.grid", "-300"), power("sensor.pv", "1200"), power("sensor.bat", "-250"), power("sensor.panel", "1200"), power("sensor.ev", "400")]);
  const consumers = [{ id: "ev", powerEntity: "sensor.ev", floorId: "ground", x: 5, z: 3.5, power: 400, wallbox: true }];
  const summary = energySummary(hass, b, consumers);
  const devicePower = new Map([["inv", 1200 - 250], ["bat", -250], ["pv", 1200]]);
  const segs = flowSegments({ building: b, consumers, summary, devicePower });
  assert.deepEqual([...new Set(segs.map((s) => s.kind))].sort(), ["battery", "export", "inverter", "solar", "wallbox"]);
  // the panel's cable starts at the panel and ends at the inverter
  const solar = segs.filter((s) => s.kind === "solar");
  assert.equal(solar[0].power, 1200);
  assert.deepEqual([solar[0].a[0], solar[0].a[2]], [7.5, 3.5]);
  assert.deepEqual([solar[solar.length - 1].b[0], solar[solar.length - 1].b[2]], [7, 0.3]);
  assert.equal(solar[0].key, "solar:pv");
  // the battery charges from the inverter
  const bat = segs.filter((s) => s.kind === "battery");
  assert.deepEqual([bat[0].a[0], bat[0].a[2]], [7, 0.3]);
  assert.equal(bat[0].power, 250);
});

test("a solar panel without an inverter feeds a power station on its floor", () => {
  const b = plan(furn("cu", "consumer_unit_10", 0.5, 0.3, { power: "sensor.grid" }), furn("ps", "power_station", 4, 2, { power: "sensor.station" }), furn("pv", "solar_panel", 7.5, 3.5));
  const hass = hassWith([power("sensor.grid", "100"), power("sensor.station", "-80")]);
  const summary = energySummary(hass, b, []);
  const segs = flowSegments({ building: b, consumers: [], summary, devicePower: new Map([["ps", -80], ["pv", 80]]) });
  const solar = segs.filter((s) => s.kind === "solar");
  assert.ok(solar.length > 0);
  assert.deepEqual([solar[solar.length - 1].b[0], solar[solar.length - 1].b[2]], [4, 2]);
  assert.equal(solar[0].power, 80);
});

test("a solar panel's own sensor adds to the sun like an inverter's", () => {
  const b = plan(furn("inv", "hybrid_inverter", 2, 0.2, { power: "sensor.pv" }), furn("pv", "solar_panel", 7, 3, { power: "sensor.shed_panel" }));
  assert.deepEqual(deviceSensors(b).solar, ["sensor.pv", "sensor.shed_panel"]);
});
