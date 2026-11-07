import assert from "node:assert/strict";
import { test } from "node:test";
import { energySensorFor, fetchTodayKwh, wireEnds } from "./wire-ends.ts";
import { findConsumers, type Consumer } from "./energy.ts";
import { emptyBuilding, newFloor } from "./model.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({ entity_id, state, attributes });
const power = (id: string) => st(id, "100", { device_class: "power", unit_of_measurement: "W" });
const energy = (id: string, unit = "kWh") => st(id, "12.5", { device_class: "energy", unit_of_measurement: unit, state_class: "total_increasing" });

function hassWith(states: HassEntity[], devices: Record<string, string> = {}, ws: HomeAssistant["callWS"] = async () => undefined as never): HomeAssistant {
  return {
    language: "en",
    connection: {} as HomeAssistant["connection"],
    callWS: ws,
    callService: async () => undefined,
    entities: Object.fromEntries(Object.entries(devices).map(([entity_id, device_id]) => [entity_id, { entity_id, device_id }])),
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
  };
}

test("a wire end's energy sensor: the energy sensor of the same device as its power sensor", () => {
  const hass = hassWith([power("sensor.plug_power"), energy("sensor.plug_total")], { "sensor.plug_power": "d1", "sensor.plug_total": "d1" });
  assert.equal(energySensorFor(hass, "sensor.plug_power"), "sensor.plug_total");
});

test("a circuit monitor with several channels: the channel's own energy sensor, by its name", () => {
  const ids = ["sensor.cm_channel_1_power", "sensor.cm_channel_2_power"];
  const counters = ["sensor.cm_channel_1_energy", "sensor.cm_channel_2_energy", "sensor.cm_total_energy"];
  const hass = hassWith([...ids.map(power), ...counters.map((id) => energy(id))], Object.fromEntries([...ids, ...counters].map((id) => [id, "cm"])));
  assert.equal(energySensorFor(hass, "sensor.cm_channel_2_power"), "sensor.cm_channel_2_energy");
  // several counters and none named after the channel: none rather than a wrong one
  const other = hassWith([power("sensor.x_power"), energy("sensor.a_energy"), energy("sensor.b_energy")], { "sensor.x_power": "d", "sensor.a_energy": "d", "sensor.b_energy": "d" });
  assert.equal(energySensorFor(other, "sensor.x_power"), null);
});

test("a power sensor without a device (PowerCalc): the energy sensor named after it", () => {
  const hass = hassWith([power("sensor.lamp_power"), energy("sensor.lamp_energy")]);
  assert.equal(energySensorFor(hass, "sensor.lamp_power"), "sensor.lamp_energy");
  assert.equal(energySensorFor(hassWith([power("sensor.lamp_power")]), "sensor.lamp_power"), null);
});

test("an energy sensor linked on the item wins", () => {
  const hass = hassWith([power("sensor.plug_power"), energy("sensor.plug_total"), energy("sensor.other_kwh")], { "sensor.plug_power": "d1", "sensor.plug_total": "d1" });
  assert.equal(energySensorFor(hass, "sensor.plug_power", "sensor.other_kwh"), "sensor.other_kwh");
  assert.equal(energySensorFor(hass, "sensor.plug_power", "none"), null);
});

test("today's kWh: the energy sensor's change since midnight from the recorder's statistics, in kWh", async () => {
  const asked: Record<string, unknown>[] = [];
  const now = new Date(2026, 9, 29, 10, 0);
  const hass = hassWith([], {}, (async (msg: Record<string, unknown>) => {
    asked.push(msg);
    return { "sensor.plug_total": [{ start: 0, change: 0.4 }, { start: 1, change: 0.35 }, { start: 2, change: null }] };
  }) as HomeAssistant["callWS"]);
  const got = await fetchTodayKwh(hass, [{ key: "a", energy: "sensor.plug_total", power: "sensor.plug_power" }], now);
  assert.ok(Math.abs((got?.get("a") ?? 0) - 0.75) < 1e-9);
  const midnight = new Date(2026, 9, 29).toISOString();
  assert.deepEqual(asked, [{ type: "recorder/statistics_during_period", start_time: midnight, statistic_ids: ["sensor.plug_total"], period: "5minute", types: ["change"], units: { energy: "kWh" } }]);
});

test("today's kWh without an energy sensor: nothing, the power sensor's statistics are not a stand-in (#29)", async () => {
  const now = new Date(2026, 9, 29, 10, 0);
  const asked: string[][] = [];
  const hass = hassWith([], {}, (async (msg: { types: string[]; statistic_ids: string[] }) => {
    asked.push(msg.statistic_ids);
    return { "sensor.plug_total": [{ start: 0, change: 1 }] };
  }) as unknown as HomeAssistant["callWS"]);
  const got = await fetchTodayKwh(hass, [{ key: "h", energy: null, power: "sensor.heater_power" }, { key: "p", energy: "sensor.plug_total", power: "sensor.plug_power" }], now);
  assert.equal(got?.has("h"), false);
  assert.equal(got?.get("p"), 1);
  assert.deepEqual(asked, [["sensor.plug_total"]]);
  // only ends without an energy sensor: nothing is asked at all
  asked.length = 0;
  assert.deepEqual(await fetchTodayKwh(hass, [{ key: "h", energy: null, power: "sensor.heater_power" }], now), new Map());
  assert.deepEqual(asked, []);
});

test("no wire ends: nothing is asked", async () => {
  let calls = 0;
  const hass = hassWith([], {}, (async () => {
    calls++;
    return {};
  }) as HomeAssistant["callWS"]);
  assert.deepEqual(await fetchTodayKwh(hass, []), new Map());
  assert.equal(calls, 0);
});

test("a consumer with an energy sensor has a wire end with its today's kWh; one without (or set to none) has none (#29)", () => {
  const hass = hassWith([power("sensor.plug_power"), energy("sensor.plug_energy"), power("sensor.tv_power")]);
  const consumers: Consumer[] = [
    { id: "switch.plug", powerEntity: "sensor.plug_power", floorId: "f", x: 1, z: 2, power: 50 },
    { id: "media_player.tv", powerEntity: "sensor.tv_power", floorId: "f", x: 3, z: 4, power: 90, energy: "sensor.tv_kwh" },
    { id: "light.spot", powerEntity: "sensor.spot_power", floorId: "g", x: 5, z: 6, power: 5, energy: "none" },
  ];
  assert.deepEqual(wireEnds(hass, consumers), [
    { key: "sensor.plug_power", id: "switch.plug", floorId: "f", x: 1, z: 2, energy: "sensor.plug_energy", power: "sensor.plug_power" },
    { key: "sensor.tv_power", id: "media_player.tv", floorId: "f", x: 3, z: 4, energy: "sensor.tv_kwh", power: "sensor.tv_power" },
  ]);
});

test("an energy sensor linked on a placed device reaches its wire end", () => {
  const b = emptyBuilding();
  b.floors = [{ ...newFloor("f", "Ground", 0), placements: [{ entity_id: "sensor.kettle_power", x: 1, z: 1, y: null, energy: "sensor.kitchen_ring_energy" }] }];
  const hass = hassWith([power("sensor.kettle_power"), energy("sensor.kitchen_ring_energy")]);
  assert.deepEqual(wireEnds(hass, findConsumers(hass, b)).map((w) => w.energy), ["sensor.kitchen_ring_energy"]);
});
