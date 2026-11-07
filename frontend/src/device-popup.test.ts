// The device popup (#272 lights, #271 robot vacuums, #284 cameras) and the TV cards (#281).
import assert from "node:assert/strict";
import { test } from "node:test";
import { durationText, lightControls, popupKind, popupPosition, stillUrl, vacuumAreas, vacuumBusy, vacuumControls, vacuumRun } from "./device-popup-model.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({ entity_id, state, attributes, last_changed: "", last_updated: "", context: { id: "" } }) as unknown as HassEntity;

test("which entities open a popup", () => {
  assert.equal(popupKind("light.sample_lounge"), "light");
  assert.equal(popupKind("vacuum.sample_robot"), "vacuum");
  assert.equal(popupKind("camera.sample_door"), "camera");
  assert.equal(popupKind("switch.sample_plug"), null);
});

test("a light offers only the modes it supports (#272)", () => {
  const onoff = lightControls(st("light.a", "on", { supported_color_modes: ["onoff"] }));
  assert.deepEqual([onoff.dim, onoff.temp, onoff.color], [false, null, false]);
  const white = lightControls(st("light.b", "on", { supported_color_modes: ["color_temp"], brightness: 128, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500, color_temp_kelvin: 3000 }));
  assert.deepEqual([white.dim, white.temp, white.color, white.pct, white.kelvin], [true, { min: 2200, max: 6500 }, false, 50, 3000]);
  const colour = lightControls(st("light.c", "on", { supported_color_modes: ["hs", "color_temp"], brightness: 255, hs_color: [120, 80] }));
  assert.deepEqual([colour.dim, colour.color, colour.temp !== null, colour.pct, colour.hue], [true, true, true, 100, 120]);
  const off = lightControls(st("light.d", "off", { supported_color_modes: ["brightness"] }));
  assert.deepEqual([off.on, off.pct], [false, 0]);
});

test("a robot vacuum shows only the buttons its features serve (#271)", () => {
  // start 8192 + pause 4 + return home 16 + locate 512
  const basic = vacuumControls(st("vacuum.a", "docked", { supported_features: 8192 + 4 + 16 + 512 }));
  assert.deepEqual(basic, { start: "start", pause: true, stop: false, home: true, locate: true, cleanArea: false });
  const old = vacuumControls(st("vacuum.b", "docked", { supported_features: 1 + 8 }));
  assert.deepEqual([old.start, old.stop, old.home, old.locate], ["turn_on", true, false, false]);
  assert.equal(vacuumControls(st("vacuum.c", "docked", { supported_features: 8192 + 16384 })).cleanArea, true);
  assert.equal(vacuumBusy("cleaning"), true);
  assert.equal(vacuumBusy("docked"), false);
});

test("the last run comes from the vacuum's attributes, else from sensors of its device (#271)", () => {
  const fromAttrs = { states: { "vacuum.a": st("vacuum.a", "docked", { battery_level: 87.4, cleaned_area: 23.46, cleaning_time: 42, last_clean_start: "2026-11-01T10:00:00+00:00" }) }, entities: {} } as unknown as HomeAssistant;
  const run = vacuumRun(fromAttrs, fromAttrs.states["vacuum.a"]);
  assert.deepEqual([run.battery, run.area, run.seconds, run.when], [87, "23.5 m²", 2520, "2026-11-01T10:00:00.000Z"]);
  const hass = {
    states: {
      "vacuum.a": st("vacuum.a", "docked"),
      "sensor.a_last_clean_area": st("sensor.a_last_clean_area", "12", { unit_of_measurement: "m²" }),
      "sensor.a_cleaning_time": st("sensor.a_cleaning_time", "30", { unit_of_measurement: "min" }),
      "sensor.a_battery": st("sensor.a_battery", "55", { device_class: "battery" }),
      "sensor.other": st("sensor.other_cleaning_time", "99"),
    },
    entities: {
      "vacuum.a": { device_id: "d1" },
      "sensor.a_last_clean_area": { device_id: "d1" },
      "sensor.a_cleaning_time": { device_id: "d1" },
      "sensor.a_battery": { device_id: "d1" },
      "sensor.other": { device_id: "d2" },
    },
  } as unknown as HomeAssistant;
  const run2 = vacuumRun(hass, hass.states["vacuum.a"]);
  assert.deepEqual([run2.battery, run2.area, run2.seconds, run2.when], [55, "12 m²", 1800, null]);
  assert.equal(durationText(2520), "42 min");
  assert.equal(durationText(3900), "1 h 5 min");
  assert.equal(durationText(30), "30 s");
});

test("rooms to clean are the areas in the vacuum's area mapping (#271)", () => {
  const hass = { areas: { kitchen: { name: "Kitchen" }, hall: { name: "Hall" } } } as unknown as HomeAssistant;
  assert.deepEqual(vacuumAreas(hass, { vacuum: { area_mapping: { kitchen: [1], hall: [2, 3], empty: [] } } }), [["hall", "Hall"], ["kitchen", "Kitchen"]]);
  assert.deepEqual(vacuumAreas(hass, null), []);
});

test("the popup stays inside the stage, above the pin when there is room (#272)", () => {
  assert.deepEqual(popupPosition(400, 400, 200, 100, 800, 600), { left: 300, top: 282 });
  // near the top it opens below the pin; near the edges it is pulled in
  assert.equal(popupPosition(400, 20, 200, 100, 800, 600).top, 38);
  assert.equal(popupPosition(5, 400, 200, 100, 800, 600).left, 8);
  assert.equal(popupPosition(795, 400, 200, 100, 800, 600).left, 592);
});

test("a camera's still gets a changing query so it refreshes (#284)", () => {
  assert.equal(stillUrl(st("camera.a", "idle", { entity_picture: "/api/camera_proxy/camera.a?token=t" }), 3), "/api/camera_proxy/camera.a?token=t&fp3d=3");
  assert.equal(stillUrl(st("camera.a", "idle", { entity_picture: "data:image/png;base64,AA" }), 3), "data:image/png;base64,AA");
  assert.equal(stillUrl(st("camera.a", "idle"), 3), null);
});

test("the popup element lives in a chunk of its own and draws a light's controls (#272)", async () => {
  const { Fp3dDevicePopup } = await import("./components/device-popup.ts");
  const hass = { language: "en", states: { "light.a": st("light.a", "on", { supported_color_modes: ["hs", "color_temp"], brightness: 200, friendly_name: "Lamp" }) } } as unknown as HomeAssistant;
  const el = new (Fp3dDevicePopup as unknown as { new (): Record<string, any> })();
  el.hass = hass;
  el.entity = "light.a";
  const text = flat(el.render());
  assert.match(text, /Lamp/);
  assert.match(text, /type="range"/);
  assert.match(text, /dp-kelvin/);
  assert.match(text, /dp-hue/);
  // a light that only switches shows no sliders
  el.hass = { language: "en", states: { "light.a": st("light.a", "on", { supported_color_modes: ["onoff"] }) } };
  assert.doesNotMatch(flat(el.render()), /type="range"/);
});

/** Every string and value of a lit template, flattened into one text. */
function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}
