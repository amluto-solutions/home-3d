// Snap guides in the 2D editor (#143): doors and windows snap to their wall's middle, items to room centre lines and
// other items; Alt turns it off; the guides show while snapped and go when the drag ends.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture, Opening } from "../model.ts";
import { makeEditor, planEl, square } from "./editor-harness.ts";

const item = (id: string, x: number, z: number, w = 0.4, d = 0.4): Furniture => ({ id, type: "chair", x, z, rotation: 0, w, d, h: 0.8, variant: null });

const door = (id: string, offset: number): Opening =>
  ({ id, room_id: "r", edge: 0, offset, width: 0.9, type: "door", sill: 0, height: 2.05, hinge: "left", leaves: 1, swing: "in", cover: null, contact: null, contact2: null, tilt: null }) as Opening;

// the harness view: 100 px per metre, plan (0, 0) at the screen's top left
const at = (ed: Record<string, any>, id: string) => ed._doc.floors[0].furniture.find((m: Furniture) => m.id === id) as Furniture;

test("an item dragged near its room's centre line snaps onto it and shows the guide (#143)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 6, 4)], [item("c", 1, 1)]);
  ed.press(100, 100, { target: planEl({ "data-furniture": "c" }) });
  ed.move(150, 100);
  ed.move(304, 100);
  assert.equal(at(ed, "c").x, 3);
  assert.equal(ed._guides.lines?.length, 1);
  assert.equal(ed._guides.lines[0].label, ed.t("snap_room"));
  // the hint bar says what it snapped to and how to move freely
  assert.equal(ed.hintText(), ed.t("hint_snapped", { what: ed.t("snap_room") }));
  ed.release(304, 100);
  assert.deepEqual(ed._guides, {});
});

test("Alt drags without snapping: no guide, by the centimetre (#143)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 6, 4)], [item("c", 1, 1)]);
  ed.press(100, 100, { target: planEl({ "data-furniture": "c" }) });
  ed.move(150, 100, { altKey: true });
  ed.move(304, 100, { altKey: true });
  assert.equal(at(ed, "c").x, 3.04);
  assert.equal(ed._guides.lines, undefined);
});

test("an item lines up its centre with another item's (#143)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 6, 4)], [item("c", 1, 1), item("t", 4.5, 3, 1, 1)]);
  ed.press(100, 100, { target: planEl({ "data-furniture": "c" }) });
  ed.move(150, 100);
  ed.move(453, 100);
  assert.equal(at(ed, "c").x, 4.5);
  assert.equal(ed._guides.lines?.[0]?.label, ed.t("snap_centre"));
});

test("a door dragged along its wall snaps to the wall's middle, labelled 'mid'; Alt slides it freely (#143)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 6, 4)]);
  ed._doc.floors[0].openings = [door("d", 1.5)];
  ed.press(150, 0, { target: planEl({ "data-opening": "d" }) });
  assert.equal(ed.drag?.kind, "opening");
  ed.move(200, 0);
  ed.move(305, 0);
  assert.equal(ed._doc.floors[0].openings[0].offset, 3);
  assert.equal(ed._guides.lines?.[0]?.label, ed.t("snap_mid"));
  ed.move(305, 0, { altKey: true });
  assert.equal(ed._doc.floors[0].openings[0].offset, 3.05);
  assert.equal(ed._guides.lines, undefined);
  ed.release(305, 0, { altKey: true });
  assert.deepEqual(ed._guides, {});
});

test("a second window snaps to repeat the gap of the first, labelled with the gap (#143)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 10, 4)]);
  // first window 1 m wide, 0.6 m from the corner (centre 1.1); the second 1 m wide is dragged to about 2.67
  ed._doc.floors[0].openings = [{ ...door("w1", 1.1), width: 1, type: "window" }, { ...door("w2", 6), width: 1, type: "window" }];
  ed.press(600, 0, { target: planEl({ "data-opening": "w2" }) });
  ed.move(500, 0);
  ed.move(267, 0);
  assert.equal(ed._doc.floors[0].openings[1].offset, 2.7);
  const labels = (ed._guides.lines ?? []).map((l: { label: string }) => l.label);
  assert.ok(labels.length === 2 && labels.every((l: string) => l === ed.t("snap_equal", { d: ed.m(0.6) })), labels.join(" | "));
});
