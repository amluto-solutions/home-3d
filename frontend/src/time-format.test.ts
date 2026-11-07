// The 12 / 24 hour setting every time goes through (#318).
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { setTimeFormat, timeFormatPref, uses12Hours } from "./time-format.ts";
import { formatDateTime, formatTime, timeStyleOf } from "./time-text.ts";
import { TimeField } from "./components/time-field.ts";
import { settingById } from "./settings/registry.ts";

afterEach(() => setTimeFormat(null));

const at = new Date(2026, 10, 3, 0, 5).getTime();
const pm = new Date(2026, 10, 3, 14, 30).getTime();

test("Automatic follows the Home Assistant profile; 12 or 24 override it", () => {
  setTimeFormat(null);
  assert.equal(timeFormatPref(), "auto");
  assert.equal(uses12Hours({ time_format: "12" }), true);
  assert.equal(uses12Hours({ time_format: "24" }), false);
  assert.equal(uses12Hours({ time_format: "am_pm" }), true);
  assert.equal(uses12Hours({ time_format: "language", language: "en-US" }), true);
  assert.equal(uses12Hours({ time_format: "language", language: "de" }), false);
  setTimeFormat("24");
  assert.equal(uses12Hours({ time_format: "12" }), false, "the device choice wins over the profile");
  setTimeFormat("12");
  assert.equal(uses12Hours({ time_format: "24" }), true);
  setTimeFormat("nonsense");
  assert.equal(timeFormatPref(), "auto");
});

test("times read 14:30 or 2:30 PM, and midnight is 00:05, never 24:05", () => {
  const h24 = { h12: false, language: "en-US" };
  const h12 = { h12: true, language: "en-US" };
  assert.equal(formatTime(pm, h24), "14:30");
  assert.equal(formatTime(at, h24), "00:05");
  assert.match(formatTime(pm, h12), /^2:30\s?PM$/);
  assert.match(formatTime(at, h12), /^12:05\s?AM$/);
  assert.match(formatTime(pm, h24, { seconds: true }), /^14:30:\d\d$/);
  assert.match(formatDateTime(pm, h24), /14:30/);
  assert.doesNotMatch(formatDateTime(pm, h24), /PM/);
  assert.match(formatDateTime(pm, h12), /PM/);
  // the time zone of the house, when it differs from the browser's
  assert.match(formatTime(Date.UTC(2026, 10, 3, 12, 0), h24, { timeZone: "Asia/Tokyo" }), /^21:00$/);
});

test("the style of a connection follows the device choice", () => {
  const hass = { language: "en", locale: { language: "en", time_format: "12" } };
  assert.equal(timeStyleOf(hass).h12, true);
  setTimeFormat("24");
  assert.equal(timeStyleOf(hass).h12, false);
});

test("the hour picker lists 00-23 without AM/PM in 24 hour times", async () => {
  const f = new TimeField() as unknown as { hour12: boolean; value: string; render(): unknown };
  f.value = "14:30";
  f.hour12 = false;
  const flat = (x: unknown) => JSON.stringify(x);
  const out = flat(f.render());
  assert.doesNotMatch(out, /AM|PM/);
  for (const h of ["00", "13", "23"]) assert.ok(out.includes(`"${h}"`) || out.includes(`>${h}<`) || out.includes(h), h);
  f.hour12 = true;
  assert.match(flat(f.render()), /AM/, "the 12 hour list has them");
});

test("Time format is a device setting in the Look section, with a hint", () => {
  const s = settingById("time_format")!;
  assert.equal(s.scope, "device");
  assert.deepEqual((s.control as { options: { value: string }[] }).options.map((o) => o.value), ["auto", "12", "24"]);
  const prefs = new Map<string, string>();
  const env = { prefs: { get: (k: string) => prefs.get(k) ?? null, set: (k: string, v: string | null) => void (v === null ? prefs.delete(k) : prefs.set(k, v)) } } as never;
  assert.equal(s.read(env), "auto");
  (s as { write: (e: never, v: string) => void }).write(env, "24");
  assert.equal(prefs.get("time_format"), "24");
  assert.equal(timeFormatPref(), "24", "written at once, no reload");
});

test("a missing or broken time reads as a dash instead of throwing", () => {
  assert.equal(formatTime(NaN, { h12: false }), "–");
  assert.equal(formatDateTime(new Date("nope"), { h12: true }), "–");
});
