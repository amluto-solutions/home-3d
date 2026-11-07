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
