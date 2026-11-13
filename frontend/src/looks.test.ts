// Ported from NeonPlan 3D 3.1 frontend/src/looks.test.ts (MIT, (c) 2026 Mastershort), with Home 3D's ids and English
// aliases (#435).
import assert from "node:assert/strict";
import { test } from "node:test";
import { baseOf, isOwnStyleId, newStyleId, phaseOf, resolveStyle, STYLE_IDS, styleFromText, STYLES } from "./looks.ts";
import { THEMES } from "./themes.ts";

const at = (h: number, m = 0) => new Date(2026, 10, 12, h, m);

test("every style has a unique id and a classic look underneath; the classic looks and Realistic are styles", () => {
  assert.equal(new Set(STYLES.map((s) => s.id)).size, STYLES.length);
  for (const s of STYLES) assert.ok(THEMES.includes(s.base), s.id);
  for (const t of THEMES) assert.equal(baseOf(t), t);
  assert.deepEqual(
    [...STYLE_IDS].sort(),
    ["blueprint", "cozy", "day", "evening", "focus", "model", "neon", "pastel", "realistic", "synthwave", "warm", "winter"],
  );
  assert.equal(STYLES.find((s) => s.id === "realistic")?.group, "homely");
  assert.equal(baseOf("nonsense"), "neon");
});

test("only English words in the aliases; no upstream names", () => {
  for (const s of STYLES) for (const a of s.aliases) assert.match(a, /^[a-z ]+$/, `${s.id}: ${a}`);
  const all = STYLES.flatMap((s) => s.aliases);
  for (const word of ["wohnlich", "abend", "bauplan", "modell", "pastell", "holz", "neonplan"]) assert.ok(!all.includes(word), word);
});

test("phase by the sun: day while it is up, evening after sunset until the night time, night before sunrise", () => {
  assert.equal(phaseOf(null, at(14), true), "day");
  assert.equal(phaseOf(null, at(18, 30), false), "evening");
  assert.equal(phaseOf(null, at(23, 30), false), "night");
  assert.equal(phaseOf(null, at(6), false), "night");
  assert.equal(phaseOf({ style_night_at: "22:00" }, at(22, 15), false), "night");
});

test("phase by the clock, also when the sun is unknown", () => {
  const plan = { style_switch: "time" as const, style_morning_at: "06:30", style_evening_at: "17:00", style_night_at: "22:30" };
  assert.equal(phaseOf(plan, at(6, 15), true), "night");
  assert.equal(phaseOf(plan, at(7), true), "day");
  assert.equal(phaseOf(plan, at(17, 30), true), "evening");
  assert.equal(phaseOf(plan, at(23), true), "night");
  assert.equal(phaseOf(null, at(19), null), "evening");
  // a night time after midnight, and a time that is no time
  assert.equal(phaseOf({ style_switch: "time", style_night_at: "01:00" }, at(0, 30), null), "evening");
  assert.equal(phaseOf({ style_switch: "time", style_night_at: "01:00" }, at(2), null), "night");
  assert.equal(phaseOf({ style_switch: "time", style_evening_at: "25:00" }, at(19), null), "evening");
});

test("a screen's own style; auto keeps the old sun rule; theme and an unknown choice follow HA's theme", () => {
  assert.equal(resolveStyle({ choice: "cozy", now: at(20), sunUp: false }), "cozy");
  assert.equal(resolveStyle({ choice: "auto", now: at(12), sunUp: true }), "day");
  assert.equal(resolveStyle({ choice: "auto", now: at(22), sunUp: false }), "neon");
  assert.equal(resolveStyle({ choice: "auto", now: at(22), sunUp: null }), "neon");
  assert.equal(resolveStyle({ choice: "theme", now: at(12), sunUp: true, darkMode: false }), "day");
  assert.equal(resolveStyle({ choice: "theme", now: at(12), sunUp: true, darkMode: true }), "neon");
  assert.equal(resolveStyle({ choice: "nonsense", now: at(12), sunUp: true }), "neon");
  assert.equal(resolveStyle({ choice: "nonsense", now: at(12), sunUp: true, darkMode: false }), "day");
  assert.equal(resolveStyle({ choice: null, now: at(12), sunUp: true }), "neon");
  assert.equal(resolveStyle({ choice: "realistic", now: at(12), sunUp: true }), "realistic");
});

test("the house plan: day, evening, night with fallbacks", () => {
  const plan = { style_day: "cozy", style_evening: "evening", style_night: "focus" };
  assert.equal(resolveStyle({ choice: "house", plan, now: at(12), sunUp: true }), "cozy");
  assert.equal(resolveStyle({ choice: "house", plan, now: at(20), sunUp: false }), "evening");
  assert.equal(resolveStyle({ choice: "house", plan, now: at(23, 30), sunUp: false }), "focus");
  // only a day style: it stays all day and night
  assert.equal(resolveStyle({ choice: "house", plan: { style_day: "warm" }, now: at(23, 30), sunUp: false }), "warm");
  // no plan at all: neon
  assert.equal(resolveStyle({ choice: "house", now: at(12), sunUp: true }), "neon");
  // a style this version doesn't know is skipped
  assert.equal(resolveStyle({ choice: "house", plan: { style_day: "cozy", style_evening: "gone" }, now: at(20), sunUp: false }), "cozy");
});

test("a card's own evening and night styles", () => {
  assert.equal(resolveStyle({ choice: "cozy", evening: "evening", now: at(12), sunUp: true }), "cozy");
  assert.equal(resolveStyle({ choice: "cozy", evening: "evening", now: at(20), sunUp: false }), "evening");
  assert.equal(resolveStyle({ choice: "cozy", evening: "evening", now: at(23, 30), sunUp: false }), "evening");
  assert.equal(resolveStyle({ choice: "cozy", evening: "evening", night: "neon", now: at(23, 30), sunUp: false }), "neon");
});

test("a helper entity and an override win; names match loosely", () => {
  assert.equal(styleFromText("Cozy Evening"), "evening");
  assert.equal(styleFromText("  architectural model "), "model");
  assert.equal(styleFromText("COSY"), "cozy");
  assert.equal(styleFromText("High-contrast"), "blueprint");
  assert.equal(styleFromText("synth"), "synthwave");
  assert.equal(styleFromText("real"), "realistic");
  assert.equal(styleFromText("nothing"), null);
  assert.equal(styleFromText(""), null);
  assert.equal(resolveStyle({ choice: "neon", entityState: "Pastel", now: at(12), sunUp: true }), "pastel");
  assert.equal(resolveStyle({ choice: "neon", entityState: "unknown", now: at(12), sunUp: true }), "neon");
  assert.equal(resolveStyle({ choice: "neon", entityState: "Pastel", override: "synthwave", now: at(12), sunUp: true }), "synthwave");
  assert.equal(resolveStyle({ choice: "neon", entityState: "Pastel", override: "gone", now: at(12), sunUp: true }), "pastel");
  // localised names come in as `names` (the style_<id> texts), umlauts folded
  assert.equal(resolveStyle({ choice: "neon", names: { cozy: ["Gemütlich"] }, entityState: "gemuetlich", now: at(12), sunUp: true }), "cozy");
});

test("own styles: listed, resolved, named by voice; gone again when the plan has none", async () => {
  const { setCustomStyles, allStyles, styleById: byId } = await import("./looks.ts");
  setCustomStyles([{ id: "my_pink", name: "Synthwave Pink", base: "neon", palette: { line: "#ff66cc", dark: "#100010", light: "#401040", hue: 0.3, lift: 0.05, contrast: 2.5 } }]);
  assert.equal(allStyles().length, STYLES.length + 1);
  assert.equal(byId("my_pink")?.group, "custom");
  assert.equal(baseOf("my_pink"), "neon");
  assert.equal(resolveStyle({ choice: "my_pink", now: at(12), sunUp: true }), "my_pink");
  assert.equal(styleFromText("synthwave pink"), "my_pink");
  // an id that does not look like an own one is not taken
  setCustomStyles([{ id: "cozy", name: "x", base: "day" } as never]);
  assert.equal(allStyles().length, STYLES.length);
  setCustomStyles(null);
  assert.equal(resolveStyle({ choice: "my_pink", now: at(12), sunUp: true }), "neon");
});

test("own style ids: my_ and letters or digits; new ones have that form", () => {
  for (let i = 0; i < 20; i++) assert.ok(isOwnStyleId(newStyleId()));
  for (const v of ["my_", "my-x", "cozy", "my_a b", null, 3]) assert.equal(isOwnStyleId(v), false, String(v));
});

test("the style menu: automatic first, then neon, homely, designed (and own ones); a card's evening and night choices may be empty", async () => {
  const { styleChoices } = await import("./looks.ts");
  assert.deepEqual(styleChoices({ theme: true, auto: true, house: true }).map((g) => [g.group, g.values.length]), [["auto", 3], ["neon", 5], ["homely", 4], ["designed", 3]]);
  assert.deepEqual(styleChoices({ none: true })[0], { group: "none", values: [""] });
  assert.equal(styleChoices({}).flatMap((g) => g.values).length, STYLE_IDS.length);
});

test("an own style made from cozy keeps its settings, is clamped, and survives a save and a reload (#441)", async () => {
  const { cleanOwnStyle, ownStyleFrom, setCustomStyles, allStyles, styleById: byId, styleChoices } = await import("./looks.ts");
  const cozy = STYLES.find((s) => s.id === "cozy")!;
  const mine = ownStyleFrom(cozy, "Cosy blue");
  assert.ok(isOwnStyleId(mine.id));
  assert.equal(mine.natural, true);
  assert.equal(mine.name, "Cosy blue");
  assert.ok(!("group" in mine) && !("aliases" in mine));
  const changed = { ...mine, dim: 0.5, ao: 0.2, floors: 0.4, cutDark: false, bg: ["#102030", "#405060"] as [string, string] };
  // the plan is stored as JSON and read again: the same style comes back
  const stored = JSON.parse(JSON.stringify([changed]));
  setCustomStyles(stored);
  const back = byId(mine.id)!;
  assert.equal(back.group, "custom");
  assert.deepEqual([back.natural, back.dim, back.ao, back.floors, back.cutDark, back.bg], [true, 0.5, 0.2, 0.4, false, ["#102030", "#405060"]]);
  // in every list, and by name
  assert.ok(styleChoices({ house: true }).find((g) => g.group === "custom")?.values.includes(mine.id));
  assert.equal(styleFromText("cosy blue"), mine.id);
  assert.equal(allStyles().length, STYLES.length + 1);
  // stored data is not trusted: numbers clamped, colours checked, junk dropped, 40 at most
  const wild = cleanOwnStyle({ id: "my_w", name: "  Wild  ", base: "nope", palette: { line: "red", dark: "#000000", light: "#ffffff", hue: 9, lift: -1, contrast: 99 }, ao: 5, bg: ["x", "#ffffff"] })!;
  assert.deepEqual([wild.name, wild.base, wild.ao, wild.palette?.line, wild.palette?.hue, wild.palette?.lift, wild.palette?.contrast, wild.bg], ["Wild", "neon", 0.7, "#8a8f98", 1, 0, 4, ["#202020", "#ffffff"]]);
  assert.equal(cleanOwnStyle({ id: "my_w", name: "" }), null);
  assert.equal(cleanOwnStyle(null), null);
  setCustomStyles(Array.from({ length: 60 }, (_, i) => ({ id: `my_n${i}`, name: `n${i}`, base: "day" })));
  assert.equal(allStyles().length, STYLES.length + 40);
  // the same id twice counts once
  setCustomStyles([{ id: "my_a", name: "a", base: "day" }, { id: "my_a", name: "b", base: "day" }]);
  assert.equal(allStyles().length, STYLES.length + 1);
  setCustomStyles(null);
});
