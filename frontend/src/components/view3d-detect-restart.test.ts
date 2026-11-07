import assert from "node:assert/strict";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

const NOW = Date.parse("2026-11-02T11:20:00Z");

function hass(motion: string, changedSecondsAgo: number): Record<string, any> {
  const st = (state: string, attrs: Record<string, unknown> = {}) => ({ state, attributes: attrs, last_changed: new Date(NOW - changedSecondsAgo * 1000).toISOString() });
  return {
    language: "en",
    locale: { language: "en", time_format: "24" },
    config: { unit_system: {} },
    states: { "camera.sample_drive": st("idle"), "binary_sensor.sample_drive_motion": st(motion, { device_class: "motion" }) },
    entities: { "camera.sample_drive": { entity_id: "camera.sample_drive", device_id: "d1" }, "binary_sensor.sample_drive_motion": { entity_id: "binary_sensor.sample_drive_motion", device_id: "d1" } },
  };
}

const cam = [{ id: "camera.sample_drive", model: "camera", floorId: "f", roomId: null, x: 0, z: 0, rotation: 0 }];

test("a restart is no detection: a motion sensor back to off gets no lingering pin (#299)", () => {
  const el = new Fp3dView3d();
  el.now = () => NOW;
  // just after a restart: off, changed 30 s ago, never seen on by this page
  assert.equal(el.detectionPins(hass("off", 30), cam).length, 0);
});

test("a detection this page saw still lingers for a while after the sensor drops back (#299)", () => {
  const el = new Fp3dView3d();
  el.now = () => NOW;
  assert.equal(el.detectionPins(hass("on", 5), cam).length, 1);
  assert.equal(el.detectionPins(hass("off", 30), cam).length, 1, "lingers");
  assert.equal(el.detectionPins(hass("off", 200), cam).length, 0, "gone after the linger time");
});
