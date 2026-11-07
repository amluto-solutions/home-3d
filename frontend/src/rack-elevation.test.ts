// Rack drawings without 3D (#115): the door swing in the plan and the front elevation of a rack and its gear.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { PackItem } from "./packs.ts";
import { readRackFrame, type RackFrame } from "./rack-frame.ts";
import { rackDoorSwing, rackElevation, type ElevationInput } from "./rack-elevation.ts";
import type { RackSlot } from "./rack.ts";

const NETWORK = new URL("../../custom_components/home_3d/bundled_packs/amluto.it/network/", import.meta.url);
const read = (id: string): PackItem => JSON.parse(readFileSync(new URL(`${id}.json`, NETWORK), "utf8"));
const frameOf = (id: string): RackFrame => readRackFrame(read(id))!;

test("a cabinet's door swings out of its front from the hinge on the left, as wide as the cabinet (#115)", () => {
  const swing = rackDoorSwing(frameOf("rack_wall_cabinet_9u"), 0.6, 0.45);
  assert.ok(swing);
  // the hinge at the front left corner, the open leaf straight out in front of it
  assert.deepEqual(swing.leaf, [[-0.3, 0.225], [-0.3, 0.825]]);
  // the arc from the open leaf's tip round to the closed door's tip at the front right corner
  assert.equal(swing.arc, "M-0.3 0.825A0.6 0.6 0 0 0 0.3 0.225");
});

test("an open frame or a 2-post rack has no door to swing (#115)", () => {
  assert.equal(rackDoorSwing(frameOf("rack_open_frame_22u"), 0.6, 0.6), null);
  assert.equal(rackDoorSwing({ ...frameOf("rack_floor_cabinet_42u"), door: "none" }, 0.6, 1), null);
});

const GEAR = Object.fromEntries(["rack_switch_24_1u", "rack_patch_panel_24_1u", "rack_blank_1u"].map((id) => [`pack:t.it:${id}`, read(id)]));
// a full-depth box (#114): it takes the front and the rear face
GEAR["pack:t.it:deep"] = { ...read("rack_switch_24_1u"), id: "deep", size: [0.4826, 0.35, 0.0437], rack: { u: 1, depth: "full" } };
const SWITCH = "pack:t.it:rack_switch_24_1u";
const PATCH = "pack:t.it:rack_patch_panel_24_1u";
const cabinet = (slots: RackSlot[], extra: Partial<ElevationInput> = {}): ElevationInput => ({
  frame: frameOf("rack_wall_cabinet_9u"),
  size: [0.6, 0.45, 0.5],
  slots,
  itemOf: (type) => GEAR[type],
  nameOf: (slot, item) => slot.name ?? item.name.en,
  ...extra,
});

/** The drawing's gear as the SVG lists it: slot id, name shown, and its box in drawing pixels. */
function pieces(svg: string) {
  return [...svg.matchAll(/<g class="fp3d-el-gear" data-slot="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)].map(([, id, body]) => {
    const box = /<rect class="fp3d-el-face" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(body)!;
    return { id, name: /<text[^>]*>([^<]*)<\/text>/.exec(body)?.[1] ?? null, x: +box[1], y: +box[2], w: +box[3], h: +box[4] };
  });
}

test("the elevation draws each piece of gear at its U, lower U lower down, with its own name or the item's (#115)", () => {
  const el = rackElevation(cabinet([{ id: "a", type: SWITCH, u: 1, name: "Core switch" }, { id: "b", type: PATCH, u: 3 }]));
  const [a, b] = pieces(el.svg);
  assert.equal(a.name, "Core switch");
  assert.equal(b.name, "Rack patch panel 24-port 1U");
  // one U is 24 px: two U apart, U1 below U3
  assert.ok(Math.abs(a.y - b.y - 48) < 0.5, `${a.y} ${b.y}`);
  assert.ok(a.h >= 22 && a.h <= 24, String(a.h));
  // both as wide as a 19" panel (482.6 mm) at the drawing's scale
  assert.ok(Math.abs(a.w - b.w) < 0.5 && Math.abs(a.w - 0.4826 * el.scale) < 0.5);
  assert.equal(el.height, Math.round(0.5 * el.scale + 2 * el.pad));
});

test("the elevation numbers every U on both rails in the rack's own numbering (#115)", () => {
  const el = rackElevation(cabinet([], { frame: { ...frameOf("rack_wall_cabinet_9u"), desc: true, startU: 1 } }));
  const left = [...el.svg.matchAll(/<text class="fp3d-el-u fp3d-el-u-l" x="[\d.]+" y="([\d.]+)"[^>]*>(\d+)<\/text>/g)].map(([, y, n]) => [+y, +n]);
  const right = [...el.svg.matchAll(/<text class="fp3d-el-u fp3d-el-u-r"[^>]*>(\d+)<\/text>/g)].map(([, n]) => +n);
  assert.equal(left.length, 9);
  assert.equal(right.length, 9);
  // numbered from the top down: the topmost row (smallest y) is 1
  left.sort((p, q) => p[0] - q[0]);
  assert.deepEqual(left.map(([, n]) => n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("the elevation is readable on a wall tablet: 1U at least 24 px, names at least 13 px, a 10-inch rack drawn bigger (#115)", () => {
  const el = rackElevation(cabinet([{ id: "a", type: SWITCH, u: 1 }]));
  assert.ok(el.scale * 0.04445 >= 24);
  for (const [, size] of el.svg.matchAll(/font-size="([\d.]+)"/g)) assert.ok(+size >= 13, size);
  const ten = rackElevation({ ...cabinet([]), frame: frameOf("rack_wall_cabinet_10in_6u"), size: read("rack_wall_cabinet_10in_6u").size });
  // a 10" panel is narrow: the drawing grows so a name still fits across it
  assert.ok(0.254 * ten.scale >= 220, String(ten.scale));
});

test("the elevation shows the front face: gear on the rear face waits for the rear view; unknown or misfit gear is left out (#115)", () => {
  const slots = [
    { id: "f", type: SWITCH, u: 1 },
    { id: "r", type: SWITCH, u: 2, face: "rear", col: 0 },
    { id: "both", type: "pack:t.it:deep", u: 4 },
    { id: "gone", type: "pack:t.it:missing", u: 5 },
    { id: "high", type: SWITCH, u: 10 },
  ] as RackSlot[];
  assert.deepEqual(pieces(rackElevation(cabinet(slots)).svg).map((p) => p.id), ["f", "both"]);
  assert.deepEqual(pieces(rackElevation(cabinet(slots, { face: "rear" })).svg).map((p) => p.id), ["r", "both"]);
});

test("the elevation escapes names, is labelled with its title and counts the U its gear uses (#115)", () => {
  const el = rackElevation(cabinet([{ id: "a", type: SWITCH, u: 1, name: 'Switch <"lab"> & co' }], { title: "Hall rack" }));
  assert.ok(el.svg.includes("Switch &lt;&quot;lab&quot;&gt; &amp; co"));
  assert.ok(!el.svg.includes('<"lab">'));
  assert.match(el.svg, /^<svg [^>]*role="img"[^>]*aria-label="Hall rack"/);
  assert.equal(el.used, 1);
  assert.equal(el.pieces, 1);
});

test("each piece is drawn from its item's parts, front parts last, in colours of their roles (#115)", () => {
  const el = rackElevation(cabinet([{ id: "a", type: SWITCH, u: 1 }]));
  const body = /<g class="fp3d-el-gear" data-slot="a"[^>]*>([\s\S]*?)<\/g>/.exec(el.svg)![1];
  // the switch has 10 parts: all of them, plus the face outline
  assert.equal((body.match(/<rect class="fp3d-el-part/g) ?? []).length, 10);
  // its accent LEDs are in the accent colour
  assert.match(body, /fp3d-el-part" [^>]*fill="#2bb3e0"/);
});

test("linked gear shows its status LED in the front view, in the status colour; unlinked gear none (#119)", () => {
  const slots: RackSlot[] = [
    { id: "a", type: SWITCH, u: 2, entity: "binary_sensor.switch_status" },
    { id: "b", type: PATCH, u: 4 },
    { id: "c", type: SWITCH, u: 6, entity: "binary_sensor.other" },
  ];
  const status = new Map([["a", "online" as const], ["c", "offline" as const]]);
  const { svg } = rackElevation(cabinet(slots, { statusOf: (s) => status.get(s.id) ?? null }));
  const leds = [...svg.matchAll(/<rect class="fp3d-el-led fp3d-el-led-(\w+)"[^>]*data-slot="([^"]+)"[^>]*fill="([^"]+)"/g)].map(([, st, id, fill]) => [id, st, fill]);
  assert.deepEqual(leds, [
    ["a", "online", "#2ecc71"],
    ["c", "offline", "#ff3b30"],
  ]);
  // the LED is inside its gear's group, so a tap on it is a tap on the gear
  assert.match(svg, /<g class="fp3d-el-gear" data-slot="a"[^>]*>(?:(?!<\/g>)[\s\S])*fp3d-el-led/);
  // without statuses nothing changes
  assert.doesNotMatch(rackElevation(cabinet(slots)).svg, /fp3d-el-led/);
});

test("each piece of gear comes with its box in drawing pixels, its slot and its full name, for tooltips over a picture of the drawing (#130)", () => {
  const el = rackElevation(cabinet([{ id: "a", type: SWITCH, u: 1, name: "Core switch with a name too long to show across it in full" }, { id: "b", type: PATCH, u: 3 }]));
  const drawn = pieces(el.svg);
  assert.deepEqual(
    el.gear.map((g) => [g.slot, g.title]),
    [["a", "Core switch with a name too long to show across it in full"], ["b", "Rack patch panel 24-port 1U"]],
  );
  for (const [i, g] of el.gear.entries()) assert.deepEqual([g.x, g.y, g.w, g.h], [drawn[i].x, drawn[i].y, drawn[i].w, drawn[i].h]);
  assert.equal(el.label, "Rack");
});
