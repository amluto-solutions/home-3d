// One name per thing (#246, the menus redesign #219). The redesign found one preference under three names and
// "Settings" meaning four different places. These rules hold the English texts to the agreed words: Settings is only
// the Settings tab, the device look is Appearance, the device pins are Device icons, and the 3D view's menu is View.
// A new text that brings an old name back fails here.
import assert from "node:assert/strict";
import { test } from "node:test";
import { englishTable } from "./i18n.ts";
import { audienceOf, SECTIONS } from "./settings/registry.ts";

const en = englishTable() as Record<string, string>;

/** The agreed name of each thing, by the text keys that name it. */
const NAMES: Record<string, string[]> = {
  Settings: ["settings", "st_title"],
  Appearance: ["theme", "st_sec_look", "st_card_look", "st_card_look"],
  "Device icons": ["markers", "st_card_markers"],
  View: ["view_btn", "view_menu"],
  "Screen and controls": ["st_sec_screen"],
};

test("each thing has its one agreed name (#246)", () => {
  for (const [name, keys] of Object.entries(NAMES)) for (const k of keys) assert.equal(en[k], name, k);
});

test("the retired names are gone from the English texts (#246)", () => {
  const retired = ["Look", "Markers", "Look & display", "Markers and controls", "Symbol size", "Keep view", "3D lock", "Controls on the left", "Controls on the right"];
  const hits = Object.entries(en).filter(([, v]) => retired.includes(v));
  assert.deepEqual(hits, []);
});

test("“Settings” on its own names only the Settings tab; nothing else is called a settings menu or sheet (#246)", () => {
  const settingsOnly = Object.entries(en)
    .filter(([, v]) => v === "Settings" || v === "⚙ Settings")
    .map(([k]) => k)
    .sort();
  assert.deepEqual(settingsOnly, ["settings", "st_title"]);
  // "More view settings" (#247) is the drawing's link from the View panel to Settings › Appearance, not a place of its own
  const bad = Object.entries(en).filter(([k, v]) => k !== "view_more_settings" && /\bView settings\b|\bview settings\b|⚙ menu|⚙ tab/.test(v));
  assert.deepEqual(bad, []);
});

test("device pins are “device icons” in every text, never “markers” (#246)", () => {
  const bad = Object.entries(en).filter(([, v]) => /\bmarkers?\b/i.test(v));
  assert.deepEqual(bad, []);
});

test("the device look is “Appearance”: no text names a setting “Look” (#246)", () => {
  // “look” as a verb (look around, look through) and an item's own look stay plain English
  const bad = Object.entries(en).filter(([, v]) => /(^|[(,.:] )Look\b(?! (through|around|at))|\b(the|a|its) (look|look's)\b(?! (around|through|at|white))|\b(neon|day|light|dark|realistic) look\b/i.test(v));
  const allowed = new Set(["upd_intro", "pack_remove_confirm", "ie_delete_confirm"]);
  assert.deepEqual(bad.filter(([k]) => !allowed.has(k)), []);
});

test("the Settings page's This device side has Appearance and Screen and controls (#246, #248)", () => {
  const device = SECTIONS.filter((s) => audienceOf(s) === "device").map((s) => en[s.title]);
  assert.ok(device.includes("Appearance"));
  assert.ok(device.includes("Screen and controls"));
});
