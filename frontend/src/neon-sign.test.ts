import assert from "node:assert/strict";
import { test } from "node:test";
import type { HassEntity, HomeAssistant } from "./types.ts";
import { neonSignPicture, SIGN_DEFAULT, SIGN_FONTS, signFont, signLight, signLines } from "./neon-sign.ts";
import { builtinBase, ELECTRIC_FURNITURE, FURNITURE_GROUPS, FURNITURE_SIZE, FURNITURE_TYPES } from "./model.ts";
import { itemProfile } from "./item-profile.ts";
import { linkField, mainLinkAccepts } from "./furniture-links.ts";
import { typeOfItem } from "./object-types.ts";
import type { Furniture } from "./model.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({ entity_id, state, attributes, last_changed: "", last_updated: "", context: { id: "" } }) as HassEntity;

test("a sign's text is one or two lines of at most 40 characters, split with | or a line break", () => {
  assert.deepEqual(signLines("Home|Sweet Home"), ["Home", "Sweet Home"]);
  assert.deepEqual(signLines("a\nb\nc"), ["a", "b"]);
  assert.deepEqual(signLines(" Open | | "), ["Open"]);
  assert.deepEqual(signLines("x".repeat(60)), ["x".repeat(40)]);
  assert.deepEqual(signLines(""), ["Neon"]);
  assert.deepEqual(signLines(null), ["Neon"]);
});

test("a sign's font is one of the short list; anything else is the script font", () => {
  assert.deepEqual([...SIGN_FONTS], ["script", "sans", "block", "serif"]);
  assert.equal(signFont({ sign_font: "block" }), "block");
  assert.equal(signFont({ sign_font: "comic" }), "script");
  assert.equal(signFont({ sign_font: null }), "script");
  assert.equal(signFont(undefined), "script");
});

test("a sign with nothing linked always glows in its own colour (hot pink without one)", () => {
  const own = signLight({ sign_color: "#00ff00" }, undefined, false);
  assert.deepEqual(own, { on: true, color: [0, 1, 0], level: 1 });
  const dflt = signLight({}, undefined, false);
  assert.equal(dflt.on, true);
  assert.deepEqual(dflt.color.map((v) => Math.round(v * 255)), [255, 63, 180]);
  assert.equal(SIGN_DEFAULT, "#ff3fb4");
});

test("a linked sign glows while its light or switch is on, in a coloured light's colour, else in its own", () => {
  const f = { sign_color: "#0000ff" };
  assert.equal(signLight(f, undefined, true).on, false, "a linked entity that is missing");
  assert.equal(signLight(f, st("light.sample_lounge", "off"), true).on, false);
  assert.equal(signLight(f, st("light.sample_lounge", "unavailable"), true).on, false);
  const coloured = signLight(f, st("light.sample_lounge", "on", { color_mode: "rgb", rgb_color: [255, 0, 0], brightness: 255 }), true);
  assert.deepEqual(coloured.color, [1, 0, 0]);
  assert.equal(coloured.on, true);
  const white = signLight(f, st("light.sample_lounge", "on", { color_mode: "color_temp", rgb_color: [255, 200, 120], brightness: 128 }), true);
  assert.deepEqual(white.color, [0, 0, 1], "a white light keeps the sign's colour");
  assert.ok(white.level > 0.2 && white.level < 1, "and its brightness");
  assert.deepEqual(signLight(f, st("switch.sample_sign", "on"), true), { on: true, color: [0, 0, 1], level: 1 });
  assert.equal(signLight(f, st("switch.sample_sign", "off"), true).on, false);
});

test("the sign's picture needs a canvas: none where there is none (node), and it is no work per frame", () => {
  assert.equal(neonSignPicture(["Neon"], [1, 0, 1], true, 1, 2.8), null);
});

test("a neon sign is a built-in decoration: sized, hung, electric, linked to lights and switches", () => {
  assert.ok((FURNITURE_TYPES as readonly string[]).includes("neon_sign"));
  assert.ok(FURNITURE_GROUPS.living.includes("neon_sign"));
  assert.deepEqual(FURNITURE_SIZE.neon_sign, [0.9, 0.03, 0.32]);
  assert.ok(Math.abs(builtinBase({ type: "neon_sign", h: 0.32 }) - 1.44) < 1e-9);
  assert.ok(ELECTRIC_FURNITURE.has("neon_sign"));
  assert.deepEqual(linkField("neon_sign").domains, ["light", "switch", "input_boolean"]);
  const hass = { states: {} } as unknown as HomeAssistant;
  assert.equal(mainLinkAccepts(hass, "neon_sign", "light.sample_lounge"), true);
  assert.equal(mainLinkAccepts(hass, "neon_sign", "switch.sample_sign"), true);
  assert.equal(mainLinkAccepts(hass, "neon_sign", "media_player.sample_tv"), false);
  assert.equal(typeOfItem({ type: "neon_sign" } as Furniture), "decor");
  const p = itemProfile("neon_sign");
  assert.equal(p.main, "device");
  assert.equal(p.consumable, false, "no filter or service to track");
  assert.equal(p.glow, false);
});
