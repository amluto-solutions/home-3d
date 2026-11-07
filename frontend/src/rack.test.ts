// Rack contents (#113): rack-mount gear fitted into whole-U positions of a placed rack, saved on it as `rack.slots`.
// The placement rules are pure (rack.ts); the backend checks the same ones (custom_components/home_3d/racks.py).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { PackItem } from "./packs.ts";
import { FRONT_INSET, REAR_INSET, rackLayout, readRackFrame } from "./rack-frame.ts";
import { addSlot, rackTapSlot, SHELF_TRAY, packGearOf, packLooseOf, rackMisfits, rackSpace, rackTotals, rackContents, rackGearProblems, readRackGear, rackLedSpot, rackSlotAt, RACK_GEAR_DEPTHS, RACK_GEAR_WIDTHS, RACK_MAX_SLOTS, moveSlot, removeSlot, type GearOf, type LooseOf, type RackSlot, type RackSpace } from "./rack.ts";

/** A 9U 19" rack 0.4 m deep. */
const SPACE: RackSpace = { u: 9, width: 19, mountDepth: 0.4 };

/** 1U switch and blanking plate, a 2U UPS, a 10" panel and a deep server. */
const gearOf: GearOf = (type) =>
  ({
    switch: { gear: { u: 1, width: "full", depth: "half", inch: 19 }, depth: 0.25 },
    blank: { gear: { u: 1, width: "full", depth: "half", inch: 19 }, depth: 0.01 },
    ups: { gear: { u: 2, width: "full", depth: "full", inch: 19 }, depth: 0.38 },
    mini: { gear: { u: 1, width: "full", depth: "half", inch: 10 }, depth: 0.1 },
    server: { gear: { u: 1, width: "full", depth: "full", inch: 19 }, depth: 0.7 },
  } as Record<string, ReturnType<GearOf>>)[type] ?? null;

const slot = (id: string, type: string, u: number): RackSlot => ({ id, type, u });

test("gear goes into a free U and its slot is kept in order from the bottom (#113)", () => {
  const one = addSlot(SPACE, [], slot("a", "ups", 3), gearOf);
  assert.equal(one.ok, true);
  const two = addSlot(SPACE, one.slots, slot("b", "switch", 1), gearOf);
  assert.equal(two.ok, true);
  assert.deepEqual(two.slots, [slot("b", "switch", 1), slot("a", "ups", 3)]);
});

test("gear that would overlap other gear is refused, naming what it hits and where (#113)", () => {
  const slots = [slot("a", "ups", 3)];
  // the 2U UPS takes U3 and U4: a switch at U4 hits it
  const hit = addSlot(SPACE, slots, slot("b", "switch", 4), gearOf);
  assert.equal(hit.ok, false);
  assert.equal(hit.why, "overlap");
  assert.deepEqual(hit.clash, ["a"]);
  assert.deepEqual(hit.units, [4]);
  assert.equal(hit.slots, slots, "the slots stay as they were");
  // a UPS at U2 takes U2 and U3: hits it too
  assert.equal(addSlot(SPACE, slots, slot("c", "ups", 2), gearOf).why, "overlap");
  // just below and just above are free
  assert.equal(addSlot(SPACE, slots, slot("d", "switch", 2), gearOf).ok, true);
  assert.equal(addSlot(SPACE, slots, slot("e", "switch", 5), gearOf).ok, true);
});

test("gear must fit inside the rack: no U below the first or above the top, nothing deeper than the rails, the rack's width (#113)", () => {
  assert.equal(addSlot(SPACE, [], slot("a", "switch", 0), gearOf).why, "outside");
  assert.equal(addSlot(SPACE, [], slot("a", "switch", 9), gearOf).ok, true);
  assert.equal(addSlot(SPACE, [], slot("a", "ups", 9), gearOf).why, "outside", "a 2U box at the top U sticks out");
  assert.equal(addSlot(SPACE, [], slot("a", "switch", 2.5), gearOf).why, "outside", "whole U only");
  assert.equal(addSlot(SPACE, [], slot("a", "server", 1), gearOf).why, "too_deep");
  assert.equal(addSlot(SPACE, [], slot("a", "mini", 1), gearOf).why, "wrong_width");
  assert.equal(addSlot(SPACE, [], slot("a", "sofa", 1), gearOf).why, "not_gear");
});

test("moving gear checks the new place against everything but itself (#113)", () => {
  const slots = [slot("a", "ups", 3), slot("b", "switch", 6)];
  // one U down overlaps only its own old place: fine
  const down = moveSlot(SPACE, slots, "a", 2, gearOf);
  assert.equal(down.ok, true);
  assert.deepEqual(down.slots, [slot("a", "ups", 2), slot("b", "switch", 6)]);
  // onto the switch: refused
  const onto = moveSlot(SPACE, slots, "a", 5, gearOf);
  assert.equal(onto.ok, false);
  assert.deepEqual(onto.clash, ["b"]);
  assert.equal(moveSlot(SPACE, slots, "nope", 1, gearOf).ok, false);
});

test("deleting gear frees its U (#113)", () => {
  const slots = [slot("a", "ups", 3), slot("b", "switch", 6)];
  assert.deepEqual(removeSlot(slots, "a"), [slot("b", "switch", 6)]);
  assert.equal(addSlot(SPACE, removeSlot(slots, "a"), slot("c", "switch", 4), gearOf).ok, true);
});

const PACKS_PY = readFileSync(new URL("../../custom_components/home_3d/packs.py", import.meta.url), "utf8");
const RACKS_PY = readFileSync(new URL("../../custom_components/home_3d/racks.py", import.meta.url), "utf8");
function py(src: string, name: string): unknown {
  const line = src.match(new RegExp(`^${name} = (.*)$`, "m"));
  assert.ok(line, `the backend names ${name}`);
  return JSON.parse(line[1]);
}

test("the gear lists are the ones the backend checks (#113)", () => {
  assert.deepEqual(RACK_GEAR_WIDTHS, py(PACKS_PY, "RACK_GEAR_WIDTHS"));
  assert.deepEqual(RACK_GEAR_DEPTHS, py(PACKS_PY, "RACK_GEAR_DEPTHS"));
  assert.equal(RACK_MAX_SLOTS, py(RACKS_PY, "RACK_MAX_SLOTS"));
  assert.equal(SHELF_TRAY, py(RACKS_PY, "SHELF_TRAY"), "#114");
});

const SWITCH: PackItem = {
  id: "rack_switch_24_1u",
  name: { en: "Switch 24-port 1U" },
  size: [0.4826, 0.25, 0.0437],
  parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "dark" }],
  rack: { u: 1 },
};

test("a gear spec reads with its defaults; one that breaks the rules makes no gear (#113)", () => {
  assert.deepEqual(readRackGear(SWITCH), { u: 1, width: "full", depth: "half", inch: 19, shelf: false });
  assert.equal(readRackGear({ ...SWITCH, rack: undefined }), null);
  for (const bad of [{ u: 1.5 }, { u: 61 }, { u: -1 }, { u: 1, width: "quarter" }, { u: 1, depth: "deep" }, { u: 1, inch: 23 }, { u: 1, colour: "red" }])
    assert.equal(readRackGear({ ...SWITCH, rack: bad as never }), null, JSON.stringify(bad));
  assert.deepEqual(rackGearProblems({ rack: { u: 1, width: "quarter" } as never }).map((p) => p.field), ["width"]);
});

test("a pack item is gear by its spec, with its depth from its size (#113)", () => {
  const items: Record<string, PackItem> = { "pack:t:switch": SWITCH, "pack:t:sofa": { ...SWITCH, rack: undefined } };
  const of = packGearOf((t) => items[t]);
  assert.deepEqual(of("pack:t:switch"), { gear: { u: 1, width: "full", depth: "half", inch: 19, shelf: false }, depth: 0.25, size: SWITCH.size, watts: null, electric: false });
  assert.equal(of("pack:t:sofa"), null);
  assert.equal(of("pack:t:gone"), null);
});

const CABINET: PackItem = {
  id: "wall_cabinet_9u",
  name: { en: "Wall cabinet 9U" },
  size: [0.6, 0.45, 0.5],
  mount: "wall",
  parts: [],
  rack_frame: { u: 9, form: "wall_cabinet", door: "glass" },
};

test("gear in a rack is drawn on the front rails at its U, as wide as the panels, up to its own depth (#113)", () => {
  const at = rackLayout(readRackFrame(CABINET)!, 0.6, 0.45, 0.5);
  const items: Record<string, PackItem> = { sw: SWITCH, ups: { ...SWITCH, size: [0.4826, 0.38, 0.088], rack: { u: 2, depth: "full" } } };
  const got = rackContents(at, [slot("a", "sw", 1), slot("b", "ups", 3), slot("c", "gone", 6), slot("d", "ups", 9)], (t) => items[t]);
  assert.deepEqual(got.map((g) => g.slot.id), ["a", "b"], "unknown gear and gear that no longer fits are left out");
  const [sw, ups] = got;
  assert.equal(sw.item, SWITCH);
  // U1 starts at the bottom of the U space; a 43.7 mm box sits in the middle of its 44.45 mm
  assert.ok(Math.abs(sw.y - (at.units[0].y0 + (0.04445 - 0.0437) / 2)) < 1e-9);
  assert.equal(sw.h, 0.0437);
  assert.equal(sw.w, 0.4826);
  assert.equal(sw.d, 0.25);
  assert.equal(sw.x, 0);
  // its front panel just in front of the rails' face
  assert.ok(Math.abs(sw.z + sw.d / 2 - (at.front + 0.003)) < 1e-9);
  assert.ok(Math.abs(ups.y - (at.units[2].y0 + (2 * 0.04445 - 0.088) / 2)) < 1e-9);
});

// ------------------------------------------------------------------------------------------------ #114

/** Half- and third-width gear, rear-mountable and 0U PDUs, a shelf and loose gear for it. */
const gear114: GearOf = (type) =>
  ({
    switch: { gear: { u: 1, width: "full", depth: "half", inch: 19, shelf: false }, depth: 0.25, watts: 20 },
    ups: { gear: { u: 2, width: "full", depth: "full", inch: 19, shelf: false }, depth: 0.38, watts: 30 },
    half: { gear: { u: 1, width: "half", depth: "half", inch: 19, shelf: false }, depth: 0.2, watts: 10 },
    third: { gear: { u: 1, width: "third", depth: "half", inch: 19, shelf: false }, depth: 0.2 },
    pdu: { gear: { u: 0, width: "full", depth: "half", inch: 19, shelf: false }, depth: 0.05, size: [0.05, 0.05, 0.35] },
    shelf: { gear: { u: 2, width: "full", depth: "half", inch: 19, shelf: true }, depth: 0.3, size: [0.4826, 0.3, 0.004] },
    halfshelf: { gear: { u: 1, width: "half", depth: "half", inch: 19, shelf: true }, depth: 0.2, size: [0.22, 0.2, 0.004] },
  } as Record<string, ReturnType<GearOf>>)[type] ?? null;

const at = (id: string, type: string, u: number, extra: Partial<RackSlot> = {}): RackSlot => ({ id, type, u, ...extra });

test("half-width gear goes side by side in one U, a column each; a third takes a third (#114)", () => {
  const two = [at("a", "half", 3, { col: 0 }), at("b", "half", 3, { col: 1 })];
  assert.equal(addSlot(SPACE, [two[0]], two[1], gear114).ok, true, "two halves share U3");
  const same = addSlot(SPACE, [two[0]], at("c", "half", 3, { col: 0 }), gear114);
  assert.equal(same.why, "overlap");
  assert.deepEqual(same.clash, ["a"]);
  assert.deepEqual(addSlot(SPACE, two, at("d", "switch", 3), gear114).clash, ["a", "b"], "full width hits both halves");
  assert.equal(addSlot(SPACE, [], at("e", "half", 1, { col: 2 }), gear114).why, "outside", "a half has columns 0 and 1");
  assert.equal(addSlot(SPACE, [], at("e", "third", 1, { col: 2 }), gear114).ok, true, "a third has columns 0 to 2");
  assert.equal(addSlot(SPACE, [], at("e", "switch", 1, { col: 1 }), gear114).why, "outside", "full width has one column");
  // a third in the middle covers part of either half; the right-hand third only the right half
  assert.deepEqual(addSlot(SPACE, two, at("f", "third", 3, { col: 1 }), gear114).clash, ["a", "b"]);
  assert.deepEqual(addSlot(SPACE, [two[0]], at("g", "third", 3, { col: 2 }), gear114).ok, true);
  assert.equal(addSlot(SPACE, [], at("h", "half", 1), gear114).ok, true, "no column = the first");
});

test("gear goes on the front or the rear face; full-depth gear blocks both; a 2-post rack has no rear (#114)", () => {
  const front = at("a", "switch", 2);
  const rear = at("b", "switch", 2, { face: "rear" });
  assert.equal(addSlot(SPACE, [front], rear, gear114).ok, true, "front and rear of one U are two places");
  assert.equal(addSlot(SPACE, [rear], at("c", "switch", 2, { face: "rear" }), gear114).why, "overlap");
  // a full-depth UPS takes U2-U3 front and rear, whichever face it is put on
  const ups = addSlot(SPACE, [front], at("u", "ups", 2, { face: "rear" }), gear114);
  assert.equal(ups.why, "overlap");
  assert.deepEqual(ups.clash, ["a"]);
  assert.deepEqual(addSlot(SPACE, [at("u", "ups", 4)], at("d", "switch", 5, { face: "rear" }), gear114).clash, ["u"]);
  // a 2-post rack holds gear on its posts, front only
  const twoPost: RackSpace = { ...SPACE, rear: false };
  assert.equal(addSlot(twoPost, [], rear, gear114).why, "no_rear");
  assert.equal(addSlot(twoPost, [], front, gear114).ok, true);
});

test("0U gear (a vertical PDU) goes in a side lane, left or right, as many U long as it is tall (#114)", () => {
  // 350 mm tall: 8 U (7.9 rounded up)
  const pdu = addSlot(SPACE, [at("s", "switch", 1), at("b", "ups", 3)], at("p", "pdu", 1, { col: 0 }), gear114);
  assert.equal(pdu.ok, true, "beside the gear, not in its way");
  assert.deepEqual(pdu.units, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(addSlot(SPACE, [], at("p", "pdu", 3), gear114).why, "outside", "U3 to U10 sticks out of 9U");
  assert.equal(addSlot(SPACE, [], at("p", "pdu", 1, { col: 2 }), gear114).why, "outside", "lanes 0 and 1 only");
  const left = [at("p", "pdu", 1, { col: 0 })];
  assert.deepEqual(addSlot(SPACE, left, at("q", "pdu", 2, { col: 0 }), gear114).clash, ["p"]);
  assert.equal(addSlot(SPACE, left, at("q", "pdu", 2, { col: 1 }), gear114).ok, true, "the other lane");
  assert.equal(addSlot(SPACE, left, at("q", "pdu", 2, { col: 0, face: "rear" }), gear114).ok, true, "the lane at the rear");
  // a lane narrower than the PDU (a 10-inch mini rack's sides)
  assert.equal(addSlot({ ...SPACE, lane: 0.03 }, [], at("p", "pdu", 1), gear114).why, "no_lane");
});

/** Loose gear (no rack spec) as it stands on a shelf: a hub, a mini PC, a NAS too tall for a 2U shelf. */
const loose114: LooseOf = (type) =>
  ({
    hub: { size: [0.09, 0.09, 0.026], watts: 3 },
    minipc: { size: [0.18, 0.18, 0.035], watts: 15 },
    nas: { size: [0.2, 0.22, 0.166] },
    deep: { size: [0.1, 0.35, 0.03] },
  } as Record<string, ReturnType<LooseOf>>)[type] ?? null;

test("a shelf carries loose gear side by side on its top, no taller than its U and no deeper than itself (#114)", () => {
  const shelf = at("sh", "shelf", 2);
  const put = (slots: RackSlot[], s: RackSlot, space = SPACE) => addSlot(space, slots, s, gear114, loose114);
  // on the shelf: its slot takes the shelf's U whatever it was given
  const hub = put([shelf], at("h", "hub", 7, { on: "sh" }));
  assert.equal(hub.ok, true);
  assert.equal(hub.slots.find((s) => s.id === "h")!.u, 2);
  assert.deepEqual(hub.units, [2, 3]);
  // loose gear is not in the way of rack gear, nor rack gear of it (the shelf is)
  assert.deepEqual(put(hub.slots, at("x", "switch", 3)).clash, ["sh"]);
  // side by side until the shelf's width (450 mm between the rails) is used up
  let slots = hub.slots;
  for (const id of ["m1", "m2"]) slots = put(slots, at(id, "minipc", 2, { on: "sh" })).slots;
  assert.equal(slots.length, 4);
  const full = put(slots, at("h2", "hub", 2, { on: "sh" }));
  assert.equal(full.why, "shelf_full");
  assert.deepEqual(full.clash, ["h", "m1", "m2"]);
  // a 2U shelf has 2 x 44.45 mm less its tray (4 mm) above it; the NAS is 166 mm
  assert.equal(put([shelf], at("n", "nas", 2, { on: "sh" })).why, "too_tall");
  assert.equal(put([shelf], at("d", "deep", 2, { on: "sh" })).why, "too_deep", "the shelf is 300 mm deep");
  assert.equal(put([shelf], at("d", "hub", 2, { on: "nope" })).why, "no_shelf");
  assert.equal(put([shelf, at("s", "switch", 5)], at("d", "hub", 5, { on: "s" })).why, "no_shelf", "a switch is no shelf");
  assert.equal(put([shelf], at("d", "sofa", 2, { on: "sh" })).why, "not_loose");
  // a half-width shelf has half the room
  const half = [at("hs", "halfshelf", 1)];
  assert.equal(put(half, at("m", "minipc", 1, { on: "hs" })).ok, true);
  assert.equal(put([...half, at("h", "hub", 1, { on: "hs" })], at("h2", "hub", 1, { on: "hs" })).ok, true);
  assert.equal(put([...half, at("m", "minipc", 1, { on: "hs" })], at("h", "hub", 1, { on: "hs" })).why, "shelf_full");
});

test("moving a shelf takes its loose gear along; deleting it takes it out too (#114)", () => {
  const slots = [at("sh", "shelf", 2), at("h", "hub", 2, { on: "sh" }), at("s", "switch", 8)];
  const up = moveSlot(SPACE, slots, "sh", 5, gear114, loose114);
  assert.equal(up.ok, true);
  assert.deepEqual(up.slots.map((s) => [s.id, s.u]), [["sh", 5], ["h", 5], ["s", 8]]);
  assert.deepEqual(removeSlot(slots, "sh").map((s) => s.id), ["s"]);
});

test("a shelf is gear with `shelf: true`, at least 1U; an item's estimated watts come with it (#114)", () => {
  assert.equal(readRackGear({ rack: { u: 1, shelf: true } })?.shelf, true);
  for (const bad of [{ u: 0, shelf: true }, { u: 1, shelf: "yes" }]) assert.equal(readRackGear({ rack: bad as never }), null, JSON.stringify(bad));
  const items: Record<string, PackItem> = {
    "pack:t:switch": { ...SWITCH, watts: 18 },
    "pack:t:hub": { ...SWITCH, id: "hub", size: [0.09, 0.09, 0.026], rack: undefined, watts: 3 },
    "pack:t:rack": CABINET,
  };
  assert.equal(packGearOf((t) => items[t])("pack:t:switch")?.watts, 18);
  const loose = packLooseOf((t) => items[t]);
  assert.deepEqual(loose("pack:t:hub"), { size: [0.09, 0.09, 0.026], watts: 3, electric: false });
  assert.deepEqual(loose("pack:t:switch"), { size: SWITCH.size, watts: 18, electric: false }, "rack gear may stand on a shelf too");
  assert.equal(loose("pack:t:rack"), null, "a rack does not");
  assert.equal(loose("pack:t:gone"), null);
});

test("a rack's totals: U used and free (on either face and on each), and estimated watts (#114)", () => {
  const slots = [
    at("s", "switch", 1), // 20 W
    at("r", "switch", 1, { face: "rear" }), // 20 W
    at("u", "ups", 3), // U3-U4 both faces, 30 W
    at("a", "half", 6, { col: 0 }), // 10 W
    at("b", "half", 6, { col: 1 }), // 10 W
    at("p", "pdu", 1), // in the lane: no U
    at("sh", "shelf", 8), // U8-U9
    at("h", "hub", 8, { on: "sh" }), // 3 W on the shelf
    at("n", "nas", 8, { on: "sh" }), // electric, no watts given
  ];
  const elec: LooseOf = (t) => (t === "nas" ? { size: [0.2, 0.2, 0.08], watts: null, electric: true } : loose114(t));
  const pduGear: GearOf = (t) => (t === "pdu" ? { ...gear114(t)!, electric: true } : gear114(t));
  assert.deepEqual(rackTotals(SPACE, slots, pduGear, elec), { used: 6, free: 3, front: 6, rear: 3, watts: 93, unknown: 2 });
  assert.deepEqual(rackTotals(SPACE, [], gear114, loose114), { used: 0, free: 9, front: 0, rear: 0, watts: 0, unknown: 0 });
});

test("after the rack frame changes, the gear stays and what no longer fits is named, with why (#114)", () => {
  const slots = [at("s", "switch", 1), at("r", "switch", 2, { face: "rear" }), at("u", "ups", 5), at("sh", "shelf", 7), at("h", "hub", 7, { on: "sh" })];
  assert.deepEqual(rackMisfits(SPACE, slots, gear114, loose114), [], "all fit the 9U rack");
  // a 6U 2-post rack: the shelf (U7-U8) sticks out, the rear switch has no rails
  assert.deepEqual(rackMisfits({ u: 6, width: 19, mountDepth: 0.4, rear: false }, slots, gear114, loose114), [
    { id: "r", why: "no_rear", clash: [] },
    { id: "sh", why: "outside", clash: [] },
  ]);
  // shallower: the UPS (380 mm) is too deep for 300 mm
  assert.deepEqual(rackMisfits({ ...SPACE, mountDepth: 0.3 }, slots, gear114, loose114).map((m) => [m.id, m.why]), [["u", "too_deep"]]);
  // gear that overlaps (a pack update made it taller) is named on both sides
  assert.deepEqual(rackMisfits(SPACE, [at("u", "ups", 1), at("s", "switch", 2)], gear114).map((m) => [m.id, m.clash]), [["u", ["s"]], ["s", ["u"]]]);
});

test("a rack's layout gives the side lanes' width beside the panels (#114)", () => {
  const cab = rackLayout(readRackFrame(CABINET)!, 0.6, 0.45, 0.5);
  assert.ok(Math.abs(cab.lane - (0.6 - 0.4826) / 2) < 1e-9);
  assert.equal(rackSpace(readRackFrame(CABINET)!, cab).lane, cab.lane);
  assert.equal(rackSpace(readRackFrame(CABINET)!, cab).rear, true);
});

test("gear is drawn in its column, on its face (rear gear turned round), PDUs in the lanes, loose gear on its shelf (#114)", () => {
  const at9 = rackLayout(readRackFrame(CABINET)!, 0.6, 0.45, 0.5);
  const box = (id: string, size: [number, number, number], rack?: PackItem["rack"]): PackItem => ({ ...SWITCH, id, size, rack });
  const items: Record<string, PackItem> = {
    half: box("half", [0.22, 0.2, 0.0437], { u: 1, width: "half" }),
    sw: SWITCH,
    pdu: box("pdu", [0.05, 0.05, 0.3], { u: 0 }),
    shelf: box("shelf", [0.4826, 0.3, 0.004], { u: 2, shelf: true }),
    hub: box("hub", [0.09, 0.09, 0.026]),
    pc: box("pc", [0.18, 0.18, 0.035]),
  };
  const got = rackContents(
    at9,
    [at("a", "half", 1, { col: 0 }), at("b", "half", 1, { col: 1 }), at("r", "sw", 2, { face: "rear" }), at("p", "pdu", 1, { col: 1, face: "rear" }), at("sh", "shelf", 4), at("h", "hub", 4, { on: "sh" }), at("c", "pc", 4, { on: "sh" })],
    (t) => items[t],
  );
  const by = Object.fromEntries(got.map((g) => [g.slot.id, g]));
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  // halves: the left and the right half of the panels
  near(by.a.x, -at9.panel / 4);
  near(by.b.x, at9.panel / 4);
  assert.equal(by.a.back, false);
  // rear gear: its front panel just behind the rear rails, turned to face the back
  assert.equal(by.r.back, true);
  near(by.r.z - by.r.d / 2, at9.rear! - 0.003);
  // the PDU: in the right lane, at the rear, from the bottom of its lowest U
  near(by.p.x, at9.panel / 2 + at9.lane / 2);
  near(by.p.y, at9.units[0].y0);
  assert.equal(by.p.back, true);
  // the shelf sits at the bottom of its U; loose gear stands on it from the left, fronts at the shelf's front
  near(by.sh.y, at9.units[3].y0);
  near(by.h.y, by.sh.y + 0.004);
  near(by.h.x, -at9.opening / 2 + 0.045);
  near(by.c.x, -at9.opening / 2 + 0.09 + 0.09);
  near(by.h.z + by.h.d / 2, by.sh.z + by.sh.d / 2);
  // 2-post: no rear rails, rear gear is not drawn
  const two = rackLayout({ ...readRackFrame(CABINET)!, form: "frame2", door: "none" }, 0.52, 0.3, 0.5);
  assert.deepEqual(rackContents(two, [at("r", "sw", 2, { face: "rear" })], (t) => items[t]), []);
});

// ---------------------------------------------------------------------------- #119: LEDs and taps on gear

test("a piece's status LED sits on its front panel near the top left, just proud of it (#119)", () => {
  const at = rackLayout(readRackFrame(CABINET)!, 0.6, 0.45, 0.5);
  const [p] = rackContents(at, [slot("a", "t", 3)], () => SWITCH);
  const led = rackLedSpot(p);
  assert.ok(led.x < p.x && led.x > p.x - p.w / 2, "left half");
  assert.ok(led.y > p.y + p.h / 2 && led.y < p.y + p.h, "upper half");
  assert.ok(led.z > p.z + p.d / 2 && led.z < p.z + p.d / 2 + 0.01, "just in front of the panel");
  assert.ok(led.size > 0.004 && led.size < p.h / 2);
});

test("rear-face gear has its LED on its own front, at the rack's back (#119)", () => {
  const at = rackLayout(readRackFrame(CABINET)!, 0.6, 0.45, 0.5);
  const [p] = rackContents(at, [{ ...slot("a", "t", 3), face: "rear" }], () => SWITCH);
  assert.equal(p.back, true);
  const led = rackLedSpot(p);
  assert.ok(led.z < p.z - p.d / 2, "behind the piece, facing the rear");
  assert.ok(led.x > p.x, "its own left, seen from the back");
});

test("which gear a point in the rack hits: the piece around it, loose gear before its shelf, null between (#119)", () => {
  const at = rackLayout(readRackFrame(CABINET)!, 0.6, 0.45, 0.5);
  const slots = [slot("a", "t", 2), slot("b", "t", 5)];
  const pieces = rackContents(at, slots, () => SWITCH);
  const [a, b] = pieces;
  assert.equal(rackSlotAt(pieces, [a.x, a.y + a.h / 2, a.z + a.d / 2]), "a");
  assert.equal(rackSlotAt(pieces, [b.x + b.w / 3, b.y + 0.002, b.z]), "b");
  // in the empty U between them
  assert.equal(rackSlotAt(pieces, [a.x, at.units[3].y0 + 0.02, a.z + a.d / 2]), null);
});

test("the backend checks depth and side lanes at the rack's placed size, as the editor does (#124)", () => {
  // racks.py works the rails out itself (_space): the same insets
  assert.deepEqual(FRONT_INSET, py(RACKS_PY, "RACK_FRONT_INSET"));
  assert.deepEqual(REAR_INSET, py(RACKS_PY, "RACK_REAR_INSET"));
  // the worked example in tests/test_rack_contents.py: a 9U wall cabinet placed at 600 x 450 x 500 mm
  const frame = readRackFrame({ ...SWITCH, rack: undefined, mount: "wall", size: [0.6, 0.45, 0.5], rack_frame: { u: 9, form: "wall_cabinet" } } as PackItem)!;
  const space = rackSpace(frame, rackLayout(frame, 0.6, 0.45, 0.5));
  assert.ok(Math.abs(space.mountDepth - 0.35) < 1e-9);
  assert.ok(Math.abs(space.lane! - 0.0587) < 1e-9);
  const of: GearOf = (t) =>
    ({
      deep: { gear: { u: 1, width: "full", depth: "half", inch: 19 }, depth: 0.36, size: [0.48, 0.36, 0.04] },
      wide_pdu: { gear: { u: 0, width: "full", depth: "half", inch: 19 }, depth: 0.05, size: [0.07, 0.05, 0.35] },
      sw: { gear: { u: 1, width: "full", depth: "half", inch: 19 }, depth: 0.25, size: [0.48, 0.25, 0.04] },
    })[t] as unknown as ReturnType<GearOf>;
  const misfits = (...slots: RackSlot[]) => rackMisfits(space, slots, of).map((m) => [m.id, m.why]);
  assert.deepEqual(misfits({ id: "d", type: "deep", u: 1 }), [["d", "too_deep"]]);
  assert.deepEqual(misfits({ id: "p", type: "wide_pdu", u: 1 }), [["p", "no_lane"]]);
  // a slot whose type is unknown holds its one U (racks.py: test_gear_whose_recipe_is_gone_is_not_checked_but_keeps_its_one_u)
  assert.deepEqual(misfits({ id: "b", type: "gone", u: 1 }, { id: "a", type: "sw", u: 2 }), []);
  assert.deepEqual(misfits({ id: "b", type: "gone", u: 1 }, { id: "c", type: "sw", u: 1 }), [["c", "overlap"]]);
});

test("a tap on a glass or mesh door's rim or bars goes on to the gear behind it; a solid door keeps it (#131)", () => {
  const glass = readRackFrame(CABINET)!;
  const at = rackLayout(glass, 0.6, 0.45, 0.5);
  const pieces = rackContents(at, [slot("a", "t", 2), slot("b", "t", 5)], () => SWITCH);
  const [a, b] = pieces;
  const door = 0.45 / 2 - 0.01; // inside the door, in front of the gear
  const back: [number, number, number] = [0, 0, -1];
  assert.equal(rackTapSlot(glass, 0.6, 0.45, 0.5, pieces, [a.x, a.y + a.h / 2, door], back), "a");
  // slanting down from above b's front onto it
  assert.equal(rackTapSlot(glass, 0.6, 0.45, 0.5, pieces, [b.x, b.y + b.h + 0.01, door], [0, -0.2, -1]), "b");
  assert.equal(rackTapSlot({ ...glass, door: "mesh" }, 0.6, 0.45, 0.5, pieces, [a.x, a.y + a.h / 2, door], back), "a");
  assert.equal(rackTapSlot({ ...glass, door: "solid" }, 0.6, 0.45, 0.5, pieces, [a.x, a.y + a.h / 2, door], back), null, "nothing shows through");
  // through the door where no gear is
  assert.equal(rackTapSlot(glass, 0.6, 0.45, 0.5, pieces, [a.x, at.units[3].y0 + 0.02, door], back), null);
  // the side panel is no door: what lies behind it is not meant
  assert.equal(rackTapSlot(glass, 0.6, 0.45, 0.5, pieces, [0.295, a.y + a.h / 2, 0], [-1, 0, 0]), null);
  // a hit on the gear itself is the gear, door or none
  assert.equal(rackTapSlot({ ...glass, door: "solid" }, 0.6, 0.45, 0.5, pieces, [a.x, a.y + a.h / 2, a.z + a.d / 2], back), "a");
});
