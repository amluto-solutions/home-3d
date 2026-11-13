import assert from "node:assert/strict";
import { test } from "node:test";
import { lookOf, THEMES } from "./themes.ts";

test("realistic is a look beside neon, chosen per card and in the panel", () => {
  assert.ok(THEMES.includes("realistic"));
  assert.equal(lookOf("realistic"), "realistic");
  assert.equal(lookOf("auto"), "auto");
  assert.equal(lookOf("neon"), "neon");
  assert.equal(lookOf("theme"), "theme");
  // a look this version does not know, or none, follows the HA theme (#38)
  assert.equal(lookOf("cartoon"), "theme");
  assert.equal(lookOf(null), "theme");
  assert.equal(lookOf(undefined), "theme");
});

test("every style, the house plan and an own style's id are kept; anything else still follows the HA theme (#435)", () => {
  for (const id of ["cozy", "evening", "winter", "focus", "synthwave", "model", "pastel", "warm", "blueprint", "day"]) assert.equal(lookOf(id), id);
  assert.equal(lookOf("house"), "house");
  assert.equal(lookOf("my_ab12cd"), "my_ab12cd");
  for (const v of ["my_", "my-pink", "synth ", "Cozy", "neonplan", "{}"]) assert.equal(lookOf(v), "theme", v);
});

test("the HA-theme choice says which looks it switches between, not a light/dark scheme it only half applies (#85)", async () => {
  const { translate } = await import("./i18n.ts");
  const en = translate({ language: "en" } as never, "theme_theme");
  assert.match(en, /Day/);
  assert.match(en, /Neon/);
  assert.doesNotMatch(en, /light\/dark/);
});

test("the Blueprint look is offered as 'High contrast' (#88)", async () => {
  const { translate } = await import("./i18n.ts");
  assert.equal(translate({ language: "en" } as never, "theme_blueprint"), "High contrast");
});
