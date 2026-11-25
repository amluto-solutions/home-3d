import assert from "node:assert/strict";
import { test } from "node:test";
import { CARD_CONTROLS, cardStartView, screenUpright, showsPlan2d } from "./card-config.ts";

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

test("a card may have a start view of its own for a screen held upright (#520)", () => {
  const wide = { theta: 0.8, phi: 1, radius: 20 };
  const tall = { theta: 2.4, phi: 1, radius: 24 };
  // without the upright one nothing changes: the same view either way, and the plan's without any
  assert.equal(cardStartView({ start_view: wide }, false), wide);
  assert.equal(cardStartView({ start_view: wide }, true), wide);
  assert.equal(cardStartView({}, true), null);
  assert.equal(cardStartView(null, true), null);
  // with it: the upright one while upright, else the usual one (or the plan's)
  assert.equal(cardStartView({ start_view: wide, start_view_portrait: tall }, true), tall);
  assert.equal(cardStartView({ start_view: wide, start_view_portrait: tall }, false), wide);
  assert.equal(cardStartView({ start_view_portrait: tall }, false), null);
});

test("upright is what the screen says, else the screen's own shape", () => {
  assert.equal(screenUpright({ orientation: { type: "portrait-primary" }, width: 1280, height: 800 }), true);
  assert.equal(screenUpright({ orientation: { type: "landscape-secondary" }, width: 800, height: 1280 }), false);
  assert.equal(screenUpright({ width: 800, height: 1280 }), true);
  assert.equal(screenUpright({ width: 1280, height: 800 }), false);
  assert.equal(screenUpright(null), false);
});
