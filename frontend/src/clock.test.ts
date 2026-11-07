// The view's clock (#232): no emoji in its controls, 12/24 hours (default follows Home Assistant), digital or analogue,
// seconds, date; every variant renders and the look is read from the device preferences.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CLOCK_LOOK, clockLookOf, clockParts, digitalText, handAngles, renderClock, type ClockEnv, type ClockLook } from "./clock.ts";
import { SETTINGS } from "./settings/registry.ts";

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}

// 14:30:45 in London (BST in June is UTC+1)
const env = (o: Partial<ClockEnv> = {}): ClockEnv => ({ now: new Date("2026-06-10T13:30:45Z"), lang: "en-GB", timeZone: "Europe/London", ...o });
const look = (o: Partial<ClockLook> = {}): ClockLook => ({ ...CLOCK_LOOK, ...o });

test("the View panel's clock row has no emoji: a drop-down of named corners and a Clock style link (#247)", () => {
  const panel = readFileSync(new URL("./panel.ts", import.meta.url), "utf8");
  const view = readFileSync(new URL("./components/view-panel.ts", import.meta.url), "utf8");
  for (const src of [panel, view]) assert.ok(!src.includes("🕐"));
  assert.ok(!panel.includes("CLOCK_ARROW"), "no corner arrows: the corners are named");
  assert.ok(view.includes(`this.openSettings("look", "clock_hours")`), "Clock style opens the clock settings");
});

test("the look comes from the device preferences and defaults to digits with the date", () => {
  assert.deepEqual(clockLookOf(() => null), CLOCK_LOOK);
  const prefs: Record<string, string> = { clock_hours: "12", clock_style: "analogue", clock_seconds: "1", clock_date: "0" };
  assert.deepEqual(clockLookOf((k) => prefs[k] ?? null), { hours: "12", analogue: true, seconds: true, date: false });
  assert.equal(clockLookOf(() => "nonsense").hours, "auto");
});

test("digits: 24 hour, 12 hour, seconds, and Auto follows Home Assistant's time format", () => {
  assert.equal(digitalText(env(), look({ hours: "24" })), "14:30");
  assert.match(digitalText(env({ lang: "en-US" }), look({ hours: "12" })), /^2:30\s?PM$/i);
  assert.equal(digitalText(env(), look({ hours: "24", seconds: true })), "14:30:45");
  assert.match(digitalText(env({ locale: { time_format: "12" } }), look()), /^2:30\s?pm$/i);
  assert.equal(digitalText(env({ locale: { time_format: "24" }, lang: "en-US" }), look()), "14:30");
  assert.equal(digitalText(env({ locale: { time_format: "language", language: "de" }, lang: "de" }), look()), "14:30");
});

test("the hands: the hour hand creeps with the minutes, the minute hand with the seconds", () => {
  assert.deepEqual(clockParts(env()), { h: 14, m: 30, s: 45 });
  const a = handAngles({ h: 14, m: 30, s: 45 });
  assert.equal(a.hour, 75);
  assert.equal(a.minute, 184.5);
  assert.equal(a.second, 270);
  assert.equal(handAngles({ h: 12, m: 0, s: 0 }).hour, 0);
});

test("every variant renders: digital/analogue x seconds x date x hours", () => {
  for (const analogue of [false, true])
    for (const seconds of [false, true])
      for (const date of [false, true])
        for (const hours of ["auto", "12", "24"] as const) {
          const html = flat(renderClock("tr", env({ lang: "en-US" }), look({ analogue, seconds, date, hours })));
          const name = JSON.stringify({ analogue, seconds, date, hours });
          assert.match(html, /fp3d-clock-tr/, name);
          assert.match(html, /role="img" aria-label=\d/, name + " is labelled");
          assert.equal(html.includes("<svg"), analogue, name);
          assert.equal(html.includes('class=s'), analogue && seconds, name + " second hand");
          assert.equal(/<span aria-hidden="true">Wed/.test(html), date, name + " date");
          if (!analogue) assert.match(html, hours === "24" ? /<b aria-hidden="true">14:30/ : /<b aria-hidden="true">(2:30|14:30)/, name);
          if (!analogue && seconds) assert.match(html, /:45/, name);
        }
});

test("Settings lists the four clock settings, kept on this device", () => {
  for (const id of ["clock_hours", "clock_style", "clock_seconds", "clock_date"]) {
    const s = SETTINGS.find((x) => x.id === id);
    assert.ok(s, id);
    assert.equal(s!.scope, "device");
  }
});
