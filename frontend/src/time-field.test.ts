// Time pickers instead of bare hour numbers (#225): the field follows Home Assistant's 12/24 hour setting, the bins'
// hours still load from plans saved with the old number box (no stored unit changed), durations name their unit.

import assert from "node:assert/strict";
import { test } from "node:test";
import { TimeField } from "./components/time-field.ts";
import { englishTable } from "./i18n.ts";
import { hoursToTime, minutesOf, timeOf, timeToHours, uses12Hours } from "./time-of-day.ts";
import { SETTINGS, type SettingsEnv } from "./settings/registry.ts";
import { sampleBuilding, sampleHass } from "./settings/settings.fixture.ts";

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}

function field(value: string, hour12: boolean, extra: Record<string, unknown> = {}): Record<string, any> {
  const f = new TimeField() as unknown as Record<string, any>;
  Object.assign(f, { value, hour12, label: "Glow from", ...extra });
  const changes: string[] = [];
  f.dispatchEvent = (e: CustomEvent) => (changes.push(e.detail.value), true);
  f.changes = changes;
  return f;
}

test("12/24 hours follow the profile's time format, else the language", () => {
  assert.equal(uses12Hours({ time_format: "12" }), true);
  assert.equal(uses12Hours({ time_format: "24" }, "en-US"), false);
  assert.equal(uses12Hours({ time_format: "language", language: "en-US" }), true);
  assert.equal(uses12Hours({ time_format: "language", language: "de" }), false);
  assert.equal(uses12Hours(undefined, "de"), false);
});

test("times convert both ways, the bins' hours included", () => {
  assert.equal(minutesOf("07:30"), 450);
  assert.equal(minutesOf("24:00"), null);
  assert.equal(minutesOf("x"), null);
  assert.equal(timeOf(450), "07:30");
  assert.equal(hoursToTime(14), "14:00");
  assert.equal(hoursToTime(6.5), "06:30");
  assert.equal(hoursToTime(null), "");
  assert.equal(timeToHours("14:30"), 14.5);
});

test("24-hour field: 00-23 hours, the value is the selected option", () => {
  const html = flat(field("14:30", false).render());
  assert.match(html, /aria-label=Hour/);
  assert.ok(html.includes("<option value=14 ?selected=true>14</option>"));
  assert.doesNotMatch(html, /AM/);
});

test("12-hour field: 1-12 with AM/PM; 14:30 shows as 2:30 PM; picking changes only that part", () => {
  const f = field("14:30", true);
  assert.match(flat(f.render()), /AM/);
  assert.ok(flat(f.render()).includes("<option value=2 ?selected=true>2</option>"));
  f.set("h", "11");
  assert.equal(f.changes[0], "23:30", "the PM part stays");
  const g = field("14:30", true);
  g.set("p", "am");
  assert.equal(g.changes[0], "02:30");
  const h = field("14:30", true);
  h.set("h", "12");
  assert.equal(h.changes[0], "12:30", "12 PM is noon");
  const m = field("00:10", true);
  m.set("h", "12");
  assert.equal(m.changes[0], "00:10", "12 AM is midnight");
});

test("a clearable field offers no time and a time off the minute grid is kept", () => {
  const f = field("", false, { clearable: true });
  f.set("h", "");
  assert.deepEqual(f.changes, [""]);
  assert.ok(flat(field("06:07", false).render()).includes("<option value=7 ?selected=true>07</option>"));
});

const env = (hours: Record<string, number | null> | undefined): SettingsEnv => {
  const building = sampleBuilding();
  if (hours) building.settings.household = hours;
  return { building, hass: sampleHass(), prefs: { get: () => null, set: () => undefined }, remote: {} };
};
const bin = (id: string) => SETTINGS.find((s) => s.id === id)!;

test("migration: plans saved with the old number box still load (stored hours unchanged), as a time of day", () => {
  assert.equal(bin("household.bin_from").control.kind, "hour");
  // saved by the number box: 14 and 12 are the defaults, 6 and 6.5 were typed
  assert.equal(bin("household.bin_from").read(env(undefined)), 14);
  assert.equal(bin("household.bin_until").read(env(undefined)), 12);
  assert.equal(hoursToTime(bin("household.bin_from").read(env({ bin_from: 6, bin_until: 6.5 })) as number), "06:00");
  assert.equal(hoursToTime(bin("household.bin_until").read(env({ bin_from: 6, bin_until: 6.5 })) as number), "06:30");
});

test("picking a time writes the same hours the number box wrote", () => {
  const e = env(undefined);
  const out = bin("household.bin_from").write!(e, timeToHours("07:30")!) as { settings: { household: { bin_from: number } } };
  assert.equal(out.settings.household.bin_from, 7.5);
});

test("duration settings say their unit in the label", () => {
  const en = englishTable() as Record<string, string>;
  for (const k of ["tablet_idle", "director_hold", "effects_motion_seconds", "effects_camera_seconds"]) assert.match(en[k], /second/i, k);
  for (const k of ["st_bin_from", "st_bin_until"]) assert.doesNotMatch(en[k], /hour/i, k);
});
