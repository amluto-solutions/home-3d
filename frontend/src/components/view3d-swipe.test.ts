import assert from "node:assert/strict";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

function setup() {
  const calls: Array<{ domain: string; service: string; data: Record<string, unknown> }> = [];
  const st = (state: string, attrs: Record<string, unknown>) => ({ state, attributes: attrs, last_changed: "2026-11-19T10:00:00Z" });
  const hass = {
    language: "en",
    config: { unit_system: {} },
    states: {
      "cover.sample_blind": { entity_id: "cover.sample_blind", ...st("open", { supported_features: 4, current_position: 50 }) },
      "light.sample_lamp": { entity_id: "light.sample_lamp", ...st("on", { supported_color_modes: ["brightness"], brightness: 128 }) },
    },
    entities: {},
    callService: (domain: string, service: string, data: Record<string, unknown>) => {
      calls.push({ domain, service, data });
      return Promise.resolve();
    },
  };
  const el = new Fp3dView3d();
  el.hass = hass;
  return { el, calls, hass };
}

const positions = (calls: Array<{ data: Record<string, unknown> }>) => calls.map((c) => c.data.position);

test("a blind swiped in 3D gets one position when the finger lifts, not one per step (#483)", async () => {
  const { el, calls } = setup();
  const id = "cover.sample_blind";
  assert.equal(el.onDeviceSwipe(id, "start", 0, 10, 10), true);
  // the finger moves for a long while: a lamp would be sent every 350 ms, a blind nothing
  let t = 1000;
  const realNow = performance.now.bind(performance);
  performance.now = () => t;
  try {
    for (const dy of [-20, -50, -80, -130]) {
      t += 400;
      el.onDeviceSwipe(id, "move", dy, 10, 10 + dy);
    }
  } finally {
    performance.now = realNow;
  }
  assert.equal(calls.length, 0, "nothing while the finger moves");
  el.onDeviceSwipe(id, "end", -130, 10, -120);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].service, "set_cover_position");
  assert.equal(calls[0].data.position, 100);
  clearTimeout(el.swipeTimer);
});

test("a pan that only started on a blind and came back to where it began sends nothing (#483)", () => {
  const { el, calls } = setup();
  el.onDeviceSwipe("cover.sample_blind", "start", 0, 10, 10);
  el.onDeviceSwipe("cover.sample_blind", "move", 0, 10, 10);
  el.onDeviceSwipe("cover.sample_blind", "end", 0, 10, 10);
  assert.deepEqual(positions(calls), []);
  clearTimeout(el.swipeTimer);
});

test("a lamp still follows the finger and gets its brightness on release (#483)", () => {
  const { el, calls } = setup();
  const id = "light.sample_lamp";
  el.onDeviceSwipe(id, "start", 0, 10, 10);
  const realNow = performance.now.bind(performance);
  performance.now = () => 5000;
  try {
    el.onDeviceSwipe(id, "move", -66, 10, 10);
  } finally {
    performance.now = realNow;
  }
  assert.equal(calls.length, 1, "while moving");
  el.onDeviceSwipe(id, "end", -66, 10, 10);
  assert.equal(calls.length, 2, "on release");
  assert.equal(calls[1].service, "turn_on");
  clearTimeout(el.swipeTimer);
});

test("the wallbox reads its status by whole words: not_charging is no charging, disconnected no car (#483)", () => {
  const { el, hass } = setup();
  const text = (state: string) => {
    (hass.states as Record<string, unknown>)["sensor.sample_wallbox"] = { entity_id: "sensor.sample_wallbox", state, attributes: {}, last_changed: "2026-11-19T10:00:00Z" };
    return el.wallboxText(hass, "sensor.sample_wallbox", null) as string;
  };
  const charging = text("charging");
  const plugged = text("connected");
  assert.notEqual(charging, plugged);
  for (const raw of ["not_charging", "ready_to_charge", "charger_free", "disconnected", "unplugged"]) {
    assert.notEqual(text(raw), charging, `${raw} is no charging`);
  }
  assert.equal(text("ready_to_charge"), plugged, "ready to charge: the car is plugged in");
  assert.notEqual(text("disconnected"), plugged, "disconnected: no car");
  assert.notEqual(text("unplugged"), plugged, "unplugged: no car");
});

test("a shaky tap on a blind is a tap: nothing is sent and the device is tapped instead (#1208)", () => {
  const { el, calls } = setup();
  const id = "cover.sample_blind";
  const taps: string[] = [];
  el.onDeviceTap = (e: string) => taps.push(e);
  el.onDeviceSwipe(id, "start", 0, 10, 10);
  el.onDeviceSwipe(id, "move", -9, 10, 1);
  el.onDeviceSwipe(id, "move", 12, 10, 22);
  el.onDeviceSwipe(id, "end", 0, 10, 10);
  assert.deepEqual(positions(calls), []);
  assert.deepEqual(taps, [id]);
  assert.equal(el._swipe, null);
  // past the slack it is a swipe again and no tap
  const taps2 = taps.length;
  el.onDeviceSwipe(id, "start", 0, 10, 10);
  el.onDeviceSwipe(id, "move", -130, 10, -120);
  el.onDeviceSwipe(id, "end", 0, 10, -120);
  assert.equal(taps.length, taps2);
  assert.equal(positions(calls).length, 1);
  clearTimeout(el.swipeTimer);
});
