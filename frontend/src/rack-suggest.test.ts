// Linking rack gear (#119): pick the HA device behind a piece of gear and the status entity and the useful further
// entities come from that device (UniFi, NUT, System Monitor, Glances, Synology, QNAP, Proxmox, ESPHome). Generic ids.

import assert from "node:assert/strict";
import { test } from "node:test";
import { entityKind, fromDevice, rackDeviceOptions, suggestRackLinks } from "./rack-suggest.ts";
import type { HomeAssistant } from "./types.ts";

type E = [id: string, state: string, attrs?: Record<string, unknown>, entry?: Record<string, unknown>];

function hassOf(devices: Record<string, { name: string; manufacturer?: string; model?: string; entities: E[]; platform: string }>): HomeAssistant {
  const states: Record<string, unknown> = {};
  const entities: Record<string, unknown> = {};
  const devs: Record<string, unknown> = {};
  for (const [dev, d] of Object.entries(devices)) {
    devs[dev] = { id: dev, name: d.name, manufacturer: d.manufacturer ?? null, model: d.model ?? null };
    for (const [id, state, attributes = {}, entry = {}] of d.entities) {
      states[id] = { entity_id: id, state, attributes };
      entities[id] = { entity_id: id, device_id: dev, platform: d.platform, ...entry };
    }
  }
  return { language: "en", states, entities, devices: devs } as unknown as HomeAssistant;
}

const UPS: E[] = [
  ["sensor.ups_status", "Online", {}, { translation_key: "ups_status" }],
  ["sensor.ups_load", "23", { unit_of_measurement: "%" }],
  ["sensor.ups_battery_charge", "100", { unit_of_measurement: "%", device_class: "battery" }],
  ["sensor.ups_battery_runtime", "2400", { unit_of_measurement: "s", device_class: "duration" }, { entity_category: "diagnostic" }],
  ["sensor.ups_input_voltage", "238", { unit_of_measurement: "V", device_class: "voltage" }],
  ["switch.ups_outlet_1", "on"],
  ["button.ups_beeper_mute", "unknown"],
];
const SWITCH: E[] = [
  ["sensor.core_switch_state", "connected", { device_class: "enum" }],
  ["sensor.core_switch_temperature", "48", { unit_of_measurement: "°C", device_class: "temperature" }],
  ["sensor.core_switch_cpu_utilization", "12", { unit_of_measurement: "%" }],
  ["sensor.core_switch_memory_utilization", "40", { unit_of_measurement: "%" }],
  ["sensor.core_switch_uptime", "2026-10-01T00:00:00Z", { device_class: "timestamp" }],
  ["update.core_switch", "off"],
  ...Array.from({ length: 24 }, (_, i): E => [`switch.core_switch_port_${i + 1}_poe`, "on"]),
  ...Array.from({ length: 24 }, (_, i): E => [`sensor.core_switch_port_${i + 1}_poe_power`, "2.1", { unit_of_measurement: "W", device_class: "power" }]),
];

test("what kind of value an entity is: the kinds the rack card picks from (#119, #120)", () => {
  const hass = hassOf({ ups: { name: "UPS", entities: UPS, platform: "nut" }, sw: { name: "Core switch", entities: SWITCH, platform: "unifi" } });
  assert.equal(entityKind(hass, "sensor.ups_status"), "status");
  assert.equal(entityKind(hass, "sensor.ups_load"), "load");
  assert.equal(entityKind(hass, "sensor.ups_battery_charge"), "battery");
  assert.equal(entityKind(hass, "sensor.ups_battery_runtime"), "runtime");
  assert.equal(entityKind(hass, "sensor.core_switch_state"), "status");
  assert.equal(entityKind(hass, "sensor.core_switch_temperature"), "temperature");
  assert.equal(entityKind(hass, "sensor.core_switch_cpu_utilization"), "cpu");
  assert.equal(entityKind(hass, "sensor.core_switch_memory_utilization"), "memory");
  assert.equal(entityKind(hass, "sensor.core_switch_uptime"), "uptime");
  assert.equal(entityKind(hass, "sensor.core_switch_port_3_poe_power"), "power");
  assert.equal(entityKind(hass, "update.core_switch"), "update");
  assert.equal(entityKind(hass, "switch.ups_outlet_1"), "switch");
  assert.equal(entityKind(hass, "sensor.ups_input_voltage"), "other");
});

test("picking a UPS's HA device links its status and its useful values, no buttons (#119)", () => {
  const hass = hassOf({ ups: { name: "Rack UPS", entities: UPS, platform: "nut" } });
  const got = fromDevice(hass, "ups");
  assert.equal(got.entity, "sensor.ups_status");
  assert.equal(got.name, "Rack UPS");
  assert.deepEqual(got.links.slice(0, 3), ["sensor.ups_load", "sensor.ups_battery_charge", "sensor.ups_battery_runtime"]);
  assert.ok(!got.links.includes("button.ups_beeper_mute"));
  assert.ok(!got.links.includes("sensor.ups_status"));
});

test("a 24-port switch: its own values first, at most 8, no per-port entities (#119)", () => {
  const hass = hassOf({ sw: { name: "Core switch", entities: SWITCH, platform: "unifi" } });
  const got = fromDevice(hass, "sw");
  assert.equal(got.entity, "sensor.core_switch_state");
  assert.ok(got.links.length <= 8);
  assert.ok(got.links.every((id) => !/port_\d/.test(id)), got.links.join());
  assert.deepEqual(got.links.slice(0, 3), ["sensor.core_switch_temperature", "sensor.core_switch_cpu_utilization", "sensor.core_switch_memory_utilization"]);
});

test("a status binary sensor (ESPHome, Proxmox) or a tracker is the status; a device without one has none (#119)", () => {
  const hass = hassOf({
    esp: { name: "Rack fan controller", platform: "esphome", entities: [["sensor.fan_controller_rssi", "-60", { unit_of_measurement: "dBm" }], ["binary_sensor.fan_controller_status", "on", { device_class: "connectivity" }]] },
    vm: { name: "Hypervisor", platform: "proxmoxve", entities: [["sensor.hypervisor_cpu", "4", { unit_of_measurement: "%" }], ["binary_sensor.hypervisor_status", "on", { device_class: "running" }]] },
    pi: { name: "Pi", platform: "systemmonitor", entities: [["sensor.pi_processor_use", "4", { unit_of_measurement: "%" }], ["sensor.pi_memory_use_percent", "30", { unit_of_measurement: "%" }]] },
  });
  assert.equal(fromDevice(hass, "esp").entity, "binary_sensor.fan_controller_status");
  assert.equal(fromDevice(hass, "vm").entity, "binary_sensor.hypervisor_status");
  const pi = fromDevice(hass, "pi");
  assert.equal(pi.entity, null);
  assert.deepEqual(pi.links, ["sensor.pi_processor_use", "sensor.pi_memory_use_percent"]);
});

test("suggestions come from the devices of what the slot already links, without what it has (#119)", () => {
  const hass = hassOf({ ups: { name: "Rack UPS", entities: UPS, platform: "nut" }, sw: { name: "Core switch", entities: SWITCH, platform: "unifi" } });
  const got = suggestRackLinks(hass, { entity: "sensor.ups_status", links: ["sensor.ups_load"] });
  assert.equal(got[0], "sensor.ups_battery_charge");
  assert.ok(!got.includes("sensor.ups_load") && !got.includes("sensor.ups_status"));
  assert.ok(got.every((id) => id.includes("ups")));
  assert.deepEqual(suggestRackLinks(hass, { entity: null, links: [] }), []);
  // a slot linked to one switch port's PoE switch: that device's own values are offered, ports last
  const sw = suggestRackLinks(hass, { entity: "switch.core_switch_port_1_poe" }, 40);
  assert.equal(sw[0], "sensor.core_switch_state");
});

test("the devices offered for gear: rack-ish integrations first, named with maker and model (#119)", () => {
  const hass = hassOf({
    lamp: { name: "Desk lamp", platform: "hue", entities: [["light.desk", "on"]] },
    ups: { name: "Rack UPS", manufacturer: "APC", model: "SMT1500", entities: UPS, platform: "nut" },
    empty: { name: "Nothing", platform: "unifi", entities: [] },
  });
  const opts = rackDeviceOptions(hass);
  assert.deepEqual(opts.map((o) => o.id), ["ups", "lamp"]);
  assert.equal(opts[0].label, "Rack UPS · APC SMT1500");
});
