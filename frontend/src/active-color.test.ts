import test from "node:test";
import assert from "node:assert/strict";
import { alarmTriggered } from "./devices.ts";
import type { HassEntity } from "./types.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes }) as unknown as HassEntity;

test("alarmTriggered: smoke and CO sensors on, alarm panels triggered (#289)", () => {
  assert.equal(alarmTriggered(st("binary_sensor.sample_smoke", "on", { device_class: "smoke" })), true);
  assert.equal(alarmTriggered(st("binary_sensor.sample_smoke", "off", { device_class: "smoke" })), false);
  assert.equal(alarmTriggered(st("binary_sensor.sample_door", "on", { device_class: "door" })), false);
  assert.equal(alarmTriggered(st("alarm_control_panel.sample", "triggered")), true);
  assert.equal(alarmTriggered(st("alarm_control_panel.sample", "armed_home")), false);
  assert.equal(alarmTriggered(undefined), false);
});
