import assert from "node:assert/strict";
import { test } from "node:test";
import { CARD_CONTROLS, showsPlan2d } from "./card-config.ts";

test("a card starts in 2D when its view says so; the 2D/3D switch on the card wins until it goes back home", () => {
  assert.equal(showsPlan2d({ type: "custom:home-3d-card" }, null), false);
  assert.equal(showsPlan2d({ type: "custom:home-3d-card", view: "2d" }, null), true);
  assert.equal(showsPlan2d({ type: "custom:home-3d-card", view: "2d" }, false), false);
  assert.equal(showsPlan2d({ type: "custom:home-3d-card" }, true), true);
});

test("the card's switches include the 2D/3D switch", () => {
  assert.ok(CARD_CONTROLS.includes("view"));
});

test("the card's look is a style id with evening and night styles and a helper entity (#439)", async () => {
  const { lookOf } = await import("./themes.ts");
  const c: import("./card-config.ts").CardConfig = { type: "custom:home-3d-card", theme: "cozy", theme_evening: "evening", theme_night: "focus", style_entity: "input_select.sample_style" };
  assert.equal(lookOf(c.theme), "cozy");
  assert.equal(lookOf(c.theme_evening), "evening");
  assert.equal(lookOf(c.theme_night), "focus");
});
