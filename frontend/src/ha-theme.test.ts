import assert from "node:assert/strict";
import { test } from "node:test";
import { followLook, shownAccent, shownLook, shownStyle, textOn, themeAccent } from "./ha-theme.ts";
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

test("a style shows its own id and the chrome of its base look; the house plan follows the sun and its helper (#435)", async () => {
  const { shownStyle } = await import("./ha-theme.ts");
  const h = (sun: string, extra: Record<string, unknown> = {}) =>
    ({ themes: { darkMode: true, theme: "default" }, states: { "sun.sun": { state: sun }, ...extra } }) as unknown as HomeAssistant;
  assert.equal(shownStyle("cozy", h("above_horizon")), "cozy");
  assert.equal(shownLook("cozy", h("above_horizon")), "day");
  assert.equal(shownLook("evening", h("below_horizon")), "neon");
  assert.equal(shownLook("realistic", h("below_horizon")), "realistic");
  const plan = { style_day: "cozy", style_evening: "evening", style_entity: "input_select.sample_house_style" };
  const noon = new Date(2026, 10, 12, 12);
  const evening = new Date(2026, 10, 12, 19);
  const helper = { "input_select.sample_house_style": { state: "Pastel" } };
  assert.equal(shownStyle("house", h("above_horizon"), plan, noon), "cozy");
  assert.equal(shownStyle("house", h("below_horizon"), plan, evening), "evening");
  assert.equal(shownStyle("house", h("above_horizon", helper), plan, noon), "pastel");
  // the helper names the style of the screens that follow the plan only
  assert.equal(shownStyle("warm", h("above_horizon", helper), plan, noon), "warm");
  // an own style the plan doesn't have follows HA's theme
  assert.equal(shownStyle("my_gone", h("above_horizon")), "neon");
  // switching a follow off keeps the style it showed
  assert.equal(followLook("auto", "auto", false, h("above_horizon")), "day");
});

// #439: a style per device and per card (day, evening, night); ported from NeonPlan 3D 3.1 (MIT, (c) 2026 Mastershort)
test("a card's theme is a style id; theme_evening and theme_night switch it at sunset and at night", () => {
  const card = { evening: "evening", night: "focus" };
  const day = (h: number) => new Date(2026, 10, 12, h, 0);
  const sun = (state: string) => hass(true, state);
  assert.equal(shownStyle(lookOf("cozy"), sun("above_horizon"), null, day(14), card), "cozy");
  assert.equal(shownStyle(lookOf("cozy"), sun("below_horizon"), null, day(19), card), "evening");
  assert.equal(shownStyle(lookOf("cozy"), sun("below_horizon"), null, day(23), card), "focus");
  // no evening or night style: the day style stays all day
  assert.equal(shownStyle(lookOf("cozy"), sun("below_horizon"), null, day(19)), "cozy");
  // a style the version doesn't know is dropped
  assert.equal(shownStyle(lookOf("cozy"), sun("below_horizon"), null, day(19), { evening: "nonsense" }), "cozy");
  // the light styles give the light chrome
  assert.equal(shownLook(lookOf("model"), hass(true)), "day");
  assert.equal(shownLook(lookOf("cozy"), sun("above_horizon"), null, { evening: "evening" }), "day");
});

test("a card's helper entity names the style; the plan's helper only counts for the house look", () => {
  const h = { states: { "sun.sun": { state: "above_horizon" }, "input_select.card": { state: "Winter" }, "input_select.house": { state: "pastel" } } } as unknown as HomeAssistant;
  const plan = { style_entity: "input_select.house" };
  assert.equal(shownStyle(lookOf("neon"), h, plan, new Date(), { entity: "input_select.card" }), "winter");
  assert.equal(shownStyle(lookOf("neon"), h, plan), "neon");
  assert.equal(shownStyle(lookOf("house"), h, plan), "pastel");
  // a localised name matches when names are given
  const named = { states: { "input_select.card": { state: "Wohnlich" } } } as unknown as HomeAssistant;
  assert.equal(shownStyle(lookOf("neon"), named, null, new Date(), { entity: "input_select.card", names: { cozy: ["Wohnlich"] } }), "cozy");
});

test("a device's pick is any style id and persists as such", () => {
  for (const id of ["cozy", "winter", "pastel", "realistic", "house"]) assert.equal(lookOf(id), id);
  assert.equal(lookOf("my_ab12"), "my_ab12");
  assert.equal(lookOf("nonsense"), "theme");
});
