import assert from "node:assert/strict";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { forecastOf, todayEntries, dayOf } = await import("./weather-forecast.ts");
const { weatherReading } = await import("./weather-tile.ts");
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };
const { weatherIcon } = await import("../weather-icon.ts");
const { viewSetting, viewSections } = await import("../settings/view-settings.ts");

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}

const hass = (extra: Record<string, unknown> = {}) => ({
  language: "en",
  locale: { language: "en", time_format: "24" },
  states: { "weather.sample_home": { entity_id: "weather.sample_home", state: "partlycloudy", attributes: { temperature: 14.6, temperature_unit: "°C" } } },
  config: { unit_system: { temperature: "°C" }, time_zone: "UTC" },
  ...extra,
});

test("the tile reads the current temperature and condition of the weather entity (#333)", () => {
  const r = weatherReading(hass() as never, "weather.sample_home");
  assert.deepEqual({ ...r }, { temperature: 14.6, unit: "°C", condition: "partlycloudy", label: "partlycloudy" });
  assert.equal(weatherReading(hass() as never, "weather.gone"), null);
  assert.equal(weatherReading(hass({ states: { "weather.x": { entity_id: "weather.x", state: "unavailable", attributes: {} } } }) as never, "weather.x"), null);
  assert.equal(weatherIcon("rainy"), "🌦️");
  assert.equal(weatherIcon("something-new"), "🌡️");
});

test("get_forecasts answers: the entity's list, today's hours still to come, or today's day (#333)", () => {
  const answer = { response: { "weather.sample_home": { forecast: [{ datetime: "2026-11-03T08:00:00+00:00", temperature: 9 }, { datetime: "2026-11-03T13:00:00+00:00", temperature: 12 }, { datetime: "2026-11-03T14:00:00+00:00", temperature: 13 }, { datetime: "2026-11-04T01:00:00+00:00", temperature: 8 }, { nonsense: true }] } } };
  const list = forecastOf(answer, "weather.sample_home");
  assert.equal(list.length, 4, "an entry without a datetime is dropped");
  assert.deepEqual(forecastOf(answer, "weather.other"), []);
  assert.deepEqual(forecastOf(null, "weather.sample_home"), []);
  const now = Date.parse("2026-11-03T13:20:00+00:00");
  assert.deepEqual(todayEntries(list, "hourly", now, "UTC").map((e) => e.temperature), [12, 13], "past hours and tomorrow stay out, the current hour stays in");
  assert.deepEqual(todayEntries(list, "daily", now, "UTC").map((e) => e.temperature), [9], "daily: today's entry");
  // the day is the home's, not the browser's
  assert.equal(dayOf(Date.parse("2026-11-03T23:30:00+00:00"), "Pacific/Auckland"), "2026-11-04");
});

test("the clock shows the tile only when the option is on and a weather entity exists, in a row with the clock (#333)", () => {
  const el = new Fp3dView3d();
  el.hass = hass();
  el.clock = "tr";
  el.now = () => Date.parse("2026-11-03T13:20:00Z");
  assert.equal(el.clockWeather, true, "on by default (#347)");
  el.clockWeather = false;
  assert.doesNotMatch(flat(el.renderClock()), /fp3d-weather-tile|fp3d-clockrow/, "off when switched off");
  el.clockWeather = true;
  const out = flat(el.renderClock());
  assert.match(out, /<div class="fp3d-clockrow fp3d-clock-tr">/);
  assert.match(out, /<div class="fp3d-clock fp3d-clock-tr"/);
  assert.match(out, /<fp3d-weather-tile/);
  el.hass = hass({ states: {} });
  assert.doesNotMatch(flat(el.renderClock()), /fp3d-weather-tile/, "no weather entity, no tile");
  el.hass = hass();
  el.clock = "off";
  assert.equal(flat(el.renderClock()), "", "no clock, no tile");
});

test("the weather switch: a View row under the clock, on by default (#347), kept on this device (#333)", () => {
  const s = viewSetting("clock_weather")!;
  assert.equal(s.default, true);
  assert.ok(viewSections({ floors: 1, floorOpen: false, roof: false, plan2d: false, kiosk: false }).find((x) => x.id === "clock")?.rows.some((r) => r.id === "clock_weather"));
  const store = new Map<string, string>();
  const env = { building: null, hass: undefined, prefs: { get: (k: string) => store.get(k) ?? null, set: (k: string, v: string | null) => void (v === null ? store.delete(k) : store.set(k, v)) } } as never;
  assert.equal(s.read(env), true);
  s.write!(env, false as never);
  assert.equal(store.get("clock_weather"), "0", "an explicit off is kept");
  assert.equal(s.read(env), false);
  s.write!(env, true as never);
  assert.equal(store.get("clock_weather"), "1");
  // it shows only while a clock does
  store.set("clock", "tr");
  assert.equal(s.visible!(env), true);
  store.set("clock", "off");
  assert.equal(s.visible!(env), false);
});
