// The rack card (#120): a glass card over a rack with a few live values from its linked gear (#119). Its default set
// is picked from the kinds of the linked entities, never "everything". Generic ids only.

import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultRackMetrics, RACK_CARD_MAX, RACK_HOTTEST, RACK_ONLINE, rackCardValues, rackMetricOptions, rackSpark, toggleRackMetric } from "./rack-card.ts";
import type { RackSlot } from "./rack.ts";
import type { HomeAssistant } from "./types.ts";

type E = [id: string, state: string, attrs?: Record<string, unknown>];

/** A Home Assistant with these devices' entities (the device id is the slot id) and slots linking them. */
function rackOf(devices: Record<string, { name?: string; status?: string; entities: E[] }>): { hass: HomeAssistant; slots: RackSlot[] } {
  const states: Record<string, unknown> = {};
  const entities: Record<string, unknown> = {};
  const slots: RackSlot[] = [];
  let u = 1;
  for (const [dev, d] of Object.entries(devices)) {
    for (const [id, state, attributes = {}] of d.entities) {
      states[id] = { entity_id: id, state, attributes };
      entities[id] = { entity_id: id, device_id: dev };
    }
    const ids = d.entities.map(([id]) => id);
    slots.push({ id: dev, type: "pack:x:gear", u: u++, name: d.name, entity: d.status ?? null, links: ids.filter((id) => id !== d.status) });
  }
  return { hass: { language: "en", states, entities } as unknown as HomeAssistant, slots };
}

const UPS: E[] = [
  ["sensor.ups_status", "OL"],
  ["sensor.ups_load", "23", { unit_of_measurement: "%" }],
  ["sensor.ups_battery_charge", "100", { unit_of_measurement: "%", device_class: "battery" }],
  ["sensor.ups_battery_runtime", "2400", { unit_of_measurement: "s", device_class: "duration" }],
  ["sensor.ups_input_voltage", "238", { unit_of_measurement: "V", device_class: "voltage" }],
];
const SWITCH: E[] = [
  ["sensor.core_switch_state", "connected", { device_class: "enum" }],
  ["sensor.core_switch_temperature", "48", { unit_of_measurement: "°C", device_class: "temperature" }],
  ["sensor.core_switch_cpu_utilization", "12", { unit_of_measurement: "%" }],
  ["sensor.core_switch_poe_power", "61.5", { unit_of_measurement: "W", device_class: "power" }],
];
const NAS: E[] = [
  ["binary_sensor.nas_status", "on", { device_class: "connectivity" }],
  ["sensor.nas_temperature", "41", { unit_of_measurement: "°C", device_class: "temperature" }],
  ["sensor.nas_volume_1_volume_used", "63.2", { unit_of_measurement: "%" }],
  ["sensor.nas_cpu_utilization", "4", { unit_of_measurement: "%" }],
];
const GATEWAY: E[] = [
  ["sensor.gateway_state", "connected", { device_class: "enum" }],
  ["sensor.gateway_lan_rx", "3.1", { unit_of_measurement: "MB/s", device_class: "data_rate" }],
  ["sensor.gateway_wan_download", "12.5", { unit_of_measurement: "MB/s", device_class: "data_rate" }],
  ["sensor.gateway_temperature", "52", { unit_of_measurement: "°C", device_class: "temperature" }],
];

test("a rack's default card values: UPS load, battery and runtime, PoE watts, hottest, online, NAS volume, one throughput (#120)", () => {
  const { hass, slots } = rackOf({
    ups: { status: "sensor.ups_status", entities: UPS },
    sw: { status: "sensor.core_switch_state", entities: SWITCH },
    nas: { status: "binary_sensor.nas_status", entities: NAS },
    gw: { status: "sensor.gateway_state", entities: GATEWAY },
  });
  assert.deepEqual(defaultRackMetrics(hass, slots), [
    "sensor.ups_load",
    "sensor.ups_battery_charge",
    "sensor.ups_battery_runtime",
    "sensor.core_switch_poe_power",
    "@hottest",
    "@online",
    "sensor.nas_volume_1_volume_used",
    "sensor.gateway_wan_download",
  ]);
});

test("the default set leaves out what the rack has nothing for, and falls back to the UPS's output watts (#120)", () => {
  const ups: E[] = [...UPS, ["sensor.ups_real_power", "180", { unit_of_measurement: "W", device_class: "power" }]];
  const server: E[] = [
    ["sensor.server_load_1m", "0.4"],
    ["sensor.server_disk_free", "22", { unit_of_measurement: "%" }],
  ];
  const { hass, slots } = rackOf({ ups: { entities: ups }, srv: { entities: server } });
  assert.deepEqual(defaultRackMetrics(hass, slots), ["sensor.ups_load", "sensor.ups_battery_charge", "sensor.ups_battery_runtime", "sensor.ups_real_power", "@online"]);
  assert.deepEqual(defaultRackMetrics(hass, slots, 2), ["sensor.ups_load", "sensor.ups_battery_charge"]);
});

test("a rack without linked gear has no default values, so no card (#120)", () => {
  const { hass } = rackOf({});
  assert.deepEqual(defaultRackMetrics(hass, [{ id: "a", type: "pack:x:gear", u: 1 }]), []);
  assert.deepEqual(defaultRackMetrics(hass, []), []);
});

test("the card's values: entities with their number and unit, the hottest temperature and the devices online (#120)", () => {
  const { hass, slots } = rackOf({
    ups: { status: "sensor.ups_status", entities: UPS },
    sw: { status: "sensor.core_switch_state", entities: SWITCH },
    nas: { status: "binary_sensor.nas_status", entities: NAS },
  });
  (hass.states as Record<string, { state: string }>)["binary_sensor.nas_status"].state = "off";
  const values = rackCardValues(hass, slots, ["sensor.ups_load", "@hottest", "@online", "sensor.ups_status"]);
  assert.deepEqual(
    values.map((v) => [v.key, v.kind, v.slot, v.value, v.of ?? null, v.unit, v.text, v.ids, v.agg]),
    [
      ["sensor.ups_load", "load", "ups", 23, null, "%", "23", ["sensor.ups_load"], "one"],
      ["@hottest", "temperature", "sw", 48, null, "°C", "48", ["sensor.core_switch_temperature", "sensor.nas_temperature"], "max"],
      ["@online", "status", null, 2, 3, "", "2/3", [], "one"],
      ["sensor.ups_status", "status", "ups", null, null, "", "OL", [], "one"],
    ],
  );
});

test("the card shows the default set without a pick, nothing for an empty pick, and skips values no longer linked (#120)", () => {
  const { hass, slots } = rackOf({ ups: { status: "sensor.ups_status", entities: UPS } });
  assert.deepEqual(rackCardValues(hass, slots, null).map((v) => v.key), ["sensor.ups_load", "sensor.ups_battery_charge", "sensor.ups_battery_runtime", "@online"]);
  assert.deepEqual(rackCardValues(hass, slots, []), []);
  assert.deepEqual(rackCardValues(hass, slots, ["sensor.gone", "@hottest", "sensor.ups_load"]).map((v) => v.key), ["sensor.ups_load"]);
  const many = ["sensor.ups_status", "sensor.ups_load", "sensor.ups_battery_charge", "sensor.ups_battery_runtime", "sensor.ups_input_voltage", "@online", "@online", "sensor.ups_load"];
  assert.deepEqual(rackCardValues(hass, slots, many).map((v) => v.key), ["sensor.ups_status", "sensor.ups_load", "sensor.ups_battery_charge", "sensor.ups_battery_runtime", "sensor.ups_input_voltage", "@online"]);
});

test("an unavailable value has no number (#120)", () => {
  const { hass, slots } = rackOf({ ups: { entities: UPS } });
  (hass.states as Record<string, { state: string }>)["sensor.ups_load"].state = "unavailable";
  const [load] = rackCardValues(hass, slots, ["sensor.ups_load"]);
  assert.equal(load.value, null);
  assert.equal(load.text, "unavailable");
});

test("a value's sparkline from the recorder's means: one sensor as it is, the hottest at each time across sensors (#120)", () => {
  const rows = {
    "sensor.a": [{ start: 3000, mean: 40 }, { start: 1000, mean: 41 }, { start: 2000, mean: null }],
    "sensor.b": [{ start: "1970-01-01T00:00:01.000Z", mean: 39 }, { start: 2000, mean: 44 }, { start: 3000, mean: 38 }],
  };
  assert.deepEqual(rackSpark(rows, { ids: ["sensor.a"], agg: "one" }), [41, 40]);
  assert.deepEqual(rackSpark(rows, { ids: ["sensor.a", "sensor.b"], agg: "max" }), [41, 44, 40]);
  assert.deepEqual(rackSpark(rows, { ids: ["sensor.none"], agg: "one" }), []);
  assert.deepEqual(rackSpark(null, { ids: ["sensor.a"], agg: "one" }), []);
});

test("the editor's choice of values: the rack's own figures, then each device's values grouped and ordered by kind (#120)", () => {
  const { hass, slots } = rackOf({
    ups: { name: "UPS", status: "sensor.ups_status", entities: [...UPS, ["update.ups_firmware", "off"], ["switch.ups_beeper", "on"]] },
    sw: { name: "Core switch", status: "sensor.core_switch_state", entities: SWITCH },
    blank: { entities: [] },
  });
  const groups = rackMetricOptions(hass, slots, (s) => s.name ?? "?");
  assert.deepEqual(
    groups.map((g) => [g.slot, g.name, g.options.map((o) => `${o.kind}:${o.key}`)]),
    [
      [null, null, ["status:@online", "temperature:@hottest"]],
      ["ups", "UPS", ["status:sensor.ups_status", "load:sensor.ups_load", "battery:sensor.ups_battery_charge", "runtime:sensor.ups_battery_runtime", "other:sensor.ups_input_voltage"]],
      ["sw", "Core switch", ["status:sensor.core_switch_state", "power:sensor.core_switch_poe_power", "temperature:sensor.core_switch_temperature", "cpu:sensor.core_switch_cpu_utilization"]],
    ],
  );
});

test("ticking a value starts from the default set, keeps the order and stops at the cap (#120)", () => {
  const defaults = ["a", "b"];
  assert.deepEqual(toggleRackMetric(null, defaults, "c"), ["a", "b", "c"]);
  assert.deepEqual(toggleRackMetric(undefined, defaults, "a"), ["b"]);
  assert.deepEqual(toggleRackMetric(["b"], defaults, "b"), []);
  assert.deepEqual(toggleRackMetric(["1", "2", "3"], defaults, "4", 3), ["1", "2", "3"]);
});

test("the card's cap and rack figures are the backend's (#120)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../custom_components/home_3d/racks.py", import.meta.url), "utf8");
  assert.equal(Number(/^RACK_CARD_MAX = (\d+)/m.exec(src)?.[1]), RACK_CARD_MAX);
  assert.ok(src.includes(`vol.In(["${RACK_HOTTEST}", "${RACK_ONLINE}"])`));
});
