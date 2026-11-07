import assert from "node:assert/strict";
import { test } from "node:test";
import { contrast } from "../scheme.ts";
import { STAGE } from "../themes.ts";
import { FLOOR_LOOK } from "./build.ts";
import { DAY_LINE, dayFloor, daySurface, neonSurface } from "./theme.ts";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const rgbHex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("")}`;
const unit = (n: number): [number, number, number] => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
// the neon colours the geometry is built in: a furniture body and a wall
const ITEM = 0x172238;
const WALL = 0x131d31;

test("Day floors keep their material: wood, oak, tiles and carpet are told apart (#86)", () => {
  const seen = new Set(Object.keys(FLOOR_LOOK).map((k) => dayFloor(FLOOR_LOOK[k].color)));
  assert.equal(seen.size, Object.keys(FLOOR_LOOK).length);
  assert.ok(contrast(hex(dayFloor(FLOOR_LOOK.wood.color)!), hex(dayFloor(FLOOR_LOOK.tiles.color)!)) >= 1.5);
  // any other colour is no floor
  assert.equal(dayFloor(ITEM), null);
});

test("Day items stand out from every floor and from the walls (#86)", () => {
  const item = rgbHex(daySurface(unit(ITEM)));
  for (const k of Object.keys(FLOOR_LOOK)) assert.ok(contrast(item, hex(dayFloor(FLOOR_LOOK[k].color)!)) >= 1.25, `item on ${k}`);
  assert.ok(contrast(item, rgbHex(daySurface(unit(WALL)))) >= 1.1, "item against a wall");
});

test("Day lines read clearly against the Day sky (#86)", () => {
  const sky = rgbHex(STAGE.day.day[0].map((v) => v / 255));
  assert.ok(contrast(rgbHex(DAY_LINE), sky) >= 7);
});

test("Neon lifts items a notch above the floor they stand on; signal colours and floors stay as built (#88)", () => {
  const item = rgbHex(neonSurface(unit(ITEM)));
  for (const k of Object.keys(FLOOR_LOOK)) {
    const floor = rgbHex(neonSurface(unit(FLOOR_LOOK[k].color)));
    assert.equal(floor, hex(FLOOR_LOOK[k].color), `${k} floor unchanged`);
    assert.ok(contrast(item, floor) >= 1.3, `item on ${k}`);
  }
  assert.ok(contrast(rgbHex(neonSurface(unit(WALL))), hex(FLOOR_LOOK.wood.color)) >= 1.15, "walls stand out of the floor");
  // a lit lamp's yellow is a signal colour
  assert.equal(rgbHex(neonSurface(unit(0xffd36b))), "#ffd36b");
});

// ---- the contrast standard of the looks (#194, A11Y-5) ----
// Non-text contrast needs 3:1 (WCAG 1.4.11). The pale Day fills cannot all be 3:1 against each other, so the standard is:
// every edge line reads on every fill at 3:1 (floors, lawn) or 7:1 (walls, items, ground, sky); a fill that is the only cue (the lawn on the ground) is 3:1; floors stand
// off the pale walls by 1.5:1 (wall edges carry the rest).
import { DAY_FLOOR_MAX_LUM, DAY_LAWN, dayLawn } from "./theme.ts";
import { outdoorLook } from "./outdoor.ts";

const DAY_GROUND = rgbHex(STAGE.day.day[1].map((v) => v / 255));
const DAY_SKY = rgbHex(STAGE.day.day[0].map((v) => v / 255));

test("Day edge lines read at 3:1 on the floors and the lawn and 7:1 on walls, items, the ground and the sky (#194)", () => {
  const line = rgbHex(DAY_LINE);
  const floors = [...Object.keys(FLOOR_LOOK).map((k) => hex(dayFloor(FLOOR_LOOK[k].color)!)), hex(DAY_LAWN)];
  const others = [rgbHex(daySurface(unit(WALL))), rgbHex(daySurface(unit(ITEM))), DAY_GROUND, DAY_SKY];
  for (const f of floors) assert.ok(contrast(line, f) >= 3, `line on floor ${f}: ${contrast(line, f).toFixed(2)}`);
  for (const f of others) assert.ok(contrast(line, f) >= 7, `line on ${f}: ${contrast(line, f).toFixed(2)}`);
});

test("the Day lawn stands off the Day ground at 3:1 and is told from the neon lawn tint only (#194)", () => {
  assert.ok(contrast(hex(DAY_LAWN), DAY_GROUND) >= 3, `lawn on ground ${contrast(hex(DAY_LAWN), DAY_GROUND).toFixed(2)}`);
  assert.equal(dayLawn(outdoorLook("lawn").color), DAY_LAWN);
  assert.equal(dayLawn(ITEM), null);
});

test("every Day floor stands off the Day walls by 1.5:1 (#194)", () => {
  const wall = rgbHex(daySurface(unit(WALL)));
  for (const k of Object.keys(FLOOR_LOOK)) {
    const f = hex(dayFloor(FLOOR_LOOK[k].color)!);
    assert.ok(contrast(f, wall) >= 1.5, `${k} on wall ${contrast(f, wall).toFixed(2)}`);
  }
  assert.ok(DAY_FLOOR_MAX_LUM < 0.45);
});

test("Day floors are still told apart after the lightness cap (#194)", () => {
  const seen = new Set(Object.keys(FLOOR_LOOK).map((k) => dayFloor(FLOOR_LOOK[k].color)));
  assert.equal(seen.size, Object.keys(FLOOR_LOOK).length);
});

// ---- the High contrast look (the Blueprint look) meets 7:1 for edges (#216) ----
import { BLUEPRINT_LINE, blueprintSurface } from "./theme.ts";

test("High contrast edges are 7:1 on every fill, the lawn, the ground and the sky, by day and by night (#216)", () => {
  const line = rgbHex(BLUEPRINT_LINE);
  const fills = [
    ...Object.keys(FLOOR_LOOK).map((k) => rgbHex(blueprintSurface(unit(FLOOR_LOOK[k].color)))),
    rgbHex(blueprintSurface(unit(outdoorLook("lawn").color))),
    rgbHex(blueprintSurface(unit(WALL))),
    rgbHex(blueprintSurface(unit(ITEM))),
    ...STAGE.blueprint.night.map((c) => rgbHex(c.map((v) => v / 255))),
    ...STAGE.blueprint.day.map((c) => rgbHex(c.map((v) => v / 255))),
  ];
  for (const f of fills) assert.ok(contrast(line, f) >= 7, `line on ${f}: ${contrast(line, f).toFixed(2)}`);
});

test("High contrast still tells walls from items from floors (#216)", () => {
  const wall = rgbHex(blueprintSurface(unit(WALL)));
  const item = rgbHex(blueprintSurface(unit(ITEM)));
  const brightest = rgbHex(blueprintSurface([1, 1, 1].map((v) => v * 0.3) as [number, number, number]));
  assert.notEqual(wall, rgbHex(blueprintSurface([0, 0, 0])));
  assert.ok(contrast(item, rgbHex(blueprintSurface(unit(FLOOR_LOOK.tiles.color)))) >= 1.05);
  assert.ok(contrast(brightest, rgbHex(blueprintSurface([0, 0, 0]))) >= 1.5);
});

test("signal colours keep their colour in High contrast (#216)", () => {
  assert.equal(rgbHex(blueprintSurface(unit(0xffd36b))), "#ffd36b");
});
