// Rack gear linked to Home Assistant (#119): a slot's status entity and further links drive its status LED (green
// online, amber warning, red offline) in 3D, in the front view and in the rack sheet. Generic entity ids only.

import assert from "node:assert/strict";
import { test } from "node:test";
import { rackLedStates, slotEntities, slotStatus } from "./rack-links.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({ entity_id, state, attributes });
const hassOf = (...states: HassEntity[]): HomeAssistant => ({ language: "en", states: Object.fromEntries(states.map((s) => [s.entity_id, s])) }) as unknown as HomeAssistant;

test("a slot without links has no status: no LED (#119)", () => {
  const hass = hassOf();
  assert.equal(slotStatus(hass, { id: "a", type: "t", u: 1 }), null);
  assert.equal(slotStatus(hass, { id: "a", type: "t", u: 1, entity: null, links: [] }), null);
});

test("a connectivity sensor: on is online, off is offline, unavailable is offline, unknown a warning (#119)", () => {
  const slot = { id: "a", type: "t", u: 1, entity: "binary_sensor.switch_status" };
  const as = (state: string) => slotStatus(hassOf(st("binary_sensor.switch_status", state, { device_class: "connectivity" })), slot);
  assert.equal(as("on"), "online");
  assert.equal(as("off"), "offline");
  assert.equal(as("unavailable"), "offline");
  assert.equal(as("unknown"), "warning");
  // the entity is gone from Home Assistant
  assert.equal(slotStatus(hassOf(), slot), "offline");
});

test("a problem sensor is the other way round: on is a warning (#119)", () => {
  const slot = { id: "a", type: "t", u: 1, entity: "binary_sensor.nas_problem" };
  assert.equal(slotStatus(hassOf(st(slot.entity, "on", { device_class: "problem" })), slot), "warning");
  assert.equal(slotStatus(hassOf(st(slot.entity, "off", { device_class: "problem" })), slot), "online");
});

test("trackers, switches and plain sensors (#119)", () => {
  const one = (s: HassEntity) => slotStatus(hassOf(s), { id: "a", type: "t", u: 1, entity: s.entity_id });
  assert.equal(one(st("device_tracker.mini_pc", "home")), "online");
  assert.equal(one(st("device_tracker.mini_pc", "not_home")), "offline");
  assert.equal(one(st("switch.pdu_outlet_1", "on")), "online");
  assert.equal(one(st("switch.pdu_outlet_1", "off")), "offline");
  // a measured value: it reports, so the device is up
  assert.equal(one(st("sensor.server_cpu", "12.5", { unit_of_measurement: "%" })), "online");
});

test("status texts: UPS (NUT) and other integrations' words (#119)", () => {
  const one = (state: string) => slotStatus(hassOf(st("sensor.ups_status", state)), { id: "a", type: "t", u: 1, entity: "sensor.ups_status" });
  assert.equal(one("Online"), "online");
  assert.equal(one("OL CHRG"), "online");
  assert.equal(one("Online Battery Charging"), "online");
  assert.equal(one("On Battery"), "warning");
  assert.equal(one("OB DISCHRG"), "warning");
  assert.equal(one("Low Battery"), "warning");
  assert.equal(one("running"), "online");
  assert.equal(one("stopped"), "offline");
  assert.equal(one("disconnected"), "offline");
  assert.equal(one("error"), "warning");
});

test("a further link that is unavailable or reports a problem makes an online device amber (#119)", () => {
  const slot = { id: "a", type: "t", u: 1, entity: "binary_sensor.nas_status", links: ["sensor.nas_temperature", "binary_sensor.nas_drive_problem"] };
  const online = st("binary_sensor.nas_status", "on", { device_class: "connectivity" });
  const temp = st("sensor.nas_temperature", "41");
  const ok = st("binary_sensor.nas_drive_problem", "off", { device_class: "problem" });
  assert.equal(slotStatus(hassOf(online, temp, ok), slot), "online");
  assert.equal(slotStatus(hassOf(online, st("sensor.nas_temperature", "unavailable"), ok), slot), "warning");
  assert.equal(slotStatus(hassOf(online, temp, st("binary_sensor.nas_drive_problem", "on", { device_class: "problem" })), slot), "warning");
  // a link that is not in HA's states (disabled by default) says nothing
  assert.equal(slotStatus(hassOf(online, ok), slot), "online");
  // red stays red
  assert.equal(slotStatus(hassOf(st("binary_sensor.nas_status", "off", { device_class: "connectivity" }), st("sensor.nas_temperature", "unavailable")), slot), "offline");
});

test("links without a status entity: all gone is offline, some gone a warning (#119)", () => {
  const slot = { id: "a", type: "t", u: 1, links: ["sensor.pi_cpu", "sensor.pi_memory"] };
  assert.equal(slotStatus(hassOf(st("sensor.pi_cpu", "5"), st("sensor.pi_memory", "40")), slot), "online");
  assert.equal(slotStatus(hassOf(st("sensor.pi_cpu", "unavailable"), st("sensor.pi_memory", "40")), slot), "warning");
  assert.equal(slotStatus(hassOf(st("sensor.pi_cpu", "unavailable"), st("sensor.pi_memory", "unavailable")), slot), "offline");
  // none of them in HA at all: nothing to tell
  assert.equal(slotStatus(hassOf(), slot), null);
});

test("a slot's entities: the status entity first, then the links, each once (#119)", () => {
  assert.deepEqual(slotEntities({ id: "a", type: "t", u: 1, entity: "sensor.a", links: ["sensor.b", "sensor.a", "sensor.c"] }), ["sensor.a", "sensor.b", "sensor.c"]);
  assert.deepEqual(slotEntities({ id: "a", type: "t", u: 1 }), []);
});

test("the LED states of a plan: one per linked slot, keyed rack id / slot id (#119)", () => {
  const hass = hassOf(st("switch.port_1", "on"), st("switch.port_2", "off"));
  const floors = [
    {
      furniture: [
        { id: "r1", rack: { slots: [{ id: "s1", type: "t", u: 1, entity: "switch.port_1" }, { id: "s2", type: "t", u: 2 }] } },
        { id: "sofa" },
        { id: "r2", rack: { slots: [{ id: "s1", type: "t", u: 1, entity: "switch.port_2" }] } },
      ],
    },
  ];
  assert.deepEqual([...rackLedStates(hass, floors as never)], [
    ["r1/s1", "online"],
    ["r2/s1", "offline"],
  ]);
});

test("the links cap is the backend's (#119)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../custom_components/home_3d/racks.py", import.meta.url), "utf8");
  const { RACK_MAX_LINKS } = await import("./rack-links.ts");
  assert.equal(RACK_MAX_LINKS, Number(/^RACK_MAX_LINKS = (\d+)$/m.exec(src)?.[1]));
});
