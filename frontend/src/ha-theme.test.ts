import assert from "node:assert/strict";
import { test } from "node:test";
import { followLook, shownAccent, shownLook, textOn, themeAccent } from "./ha-theme.ts";
import { lookOf } from "./themes.ts";
import type { HomeAssistant } from "./types.ts";

const hass = (darkMode: boolean | undefined, sun = "below_horizon") =>
  ({ themes: darkMode === undefined ? undefined : { darkMode, theme: "default" }, states: { "sun.sun": { state: sun } } }) as unknown as HomeAssistant;

test("following the HA theme: a dark theme shows neon, a light theme day", () => {
  assert.equal(shownLook("theme", hass(true)), "neon");
  assert.equal(shownLook("theme", hass(false)), "day");
});

test("a card or panel with no look of its own follows the HA theme; a look it sets still wins", () => {
  assert.equal(shownLook(lookOf(undefined), hass(false)), "day");
  assert.equal(shownLook(lookOf(null), hass(true)), "neon");
  assert.equal(shownLook(lookOf("neon"), hass(false)), "neon");
  assert.equal(shownLook(lookOf("realistic"), hass(true)), "realistic");
  assert.equal(shownLook(lookOf("day"), hass(true)), "day");
});

test("two devices with different themes each follow their own", () => {
  const look = lookOf(undefined);
  assert.equal(shownLook(look, hass(true)), "neon");
  assert.equal(shownLook(look, hass(false)), "day");
});

test("auto still goes by the sun: day above the horizon, neon below", () => {
  assert.equal(shownLook("auto", hass(true, "above_horizon")), "day");
  assert.equal(shownLook("auto", hass(false, "below_horizon")), "neon");
});

test("a theme of the user's own lends its primary colour as the accent; HA's stock theme keeps Home 3D's cyan", () => {
  const vars = (v: Record<string, string>) => (name: string) => v[name] ?? "";
  const own = { themes: { darkMode: true, theme: "Midnight" }, states: {} } as unknown as HomeAssistant;
  const stock = { themes: { darkMode: true, theme: "default" }, states: {} } as unknown as HomeAssistant;
  assert.equal(themeAccent(own, vars({ "--primary-color": " #FF9800 " })), "#ff9800");
  assert.equal(themeAccent(own, vars({ "--primary-color": "rgb(3, 169, 244)" })), "#03a9f4");
  assert.equal(themeAccent(own, vars({ "--primary-color": "#abc" })), "#aabbcc");
  assert.equal(themeAccent(stock, vars({ "--primary-color": "#03a9f4" })), null);
  // a colour we can't read is no accent
  assert.equal(themeAccent(own, vars({ "--primary-color": "var(--blue)" })), null);
  assert.equal(themeAccent(own, vars({})), null);
});

test("text on the accent stays readable: dark on a light accent, white on a dark one", () => {
  assert.equal(textOn("#37e0ff"), "#041018");
  assert.equal(textOn("#ffeb3b"), "#041018");
  assert.equal(textOn("#1a237e"), "#ffffff");
  assert.equal(textOn("#b71c1c"), "#ffffff");
});

test("the accent shown: one set on the card or panel wins; the theme's only while the look follows the theme", () => {
  const own = { themes: { darkMode: false, theme: "Sunrise" }, states: {} } as unknown as HomeAssistant;
  const read = () => "#e65100";
  assert.equal(shownAccent("theme", "#123456", own, read), "#123456");
  assert.equal(shownAccent("theme", null, own, read), "#e65100");
  assert.equal(shownAccent("neon", null, own, read), null);
  assert.equal(shownAccent("theme", "not a colour", own, read), "#e65100");
});

test("turning 'Follow Home Assistant' on follows the theme; off keeps the look it showed (#87)", () => {
  assert.equal(followLook("neon", "theme", true, hass(false)), "theme");
  // off: whatever the theme resolved to stays, so nothing jumps
  assert.equal(followLook("theme", "theme", false, hass(false)), "day");
  assert.equal(followLook("theme", "theme", false, hass(true)), "neon");
  // following the sun works the same way
  assert.equal(followLook("blueprint", "auto", true, hass(true)), "auto");
  assert.equal(followLook("auto", "auto", false, hass(true, "above_horizon")), "day");
  // switching one follow off leaves another follow alone
  assert.equal(followLook("auto", "theme", false, hass(false)), "auto");
});
