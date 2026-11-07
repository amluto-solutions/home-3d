// The floating edit toolbar over the selected item (#398): where it goes, its keys, that it uses the right-click
// menu's own actions, that Tab reaches it and that the side panel is left alone while a drag moves the item.

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, planEl, square } from "./editor-harness.ts";
import { barKeys, barPlace, barSize, barStep } from "./editor/item-bar-view.ts";
import type { Furniture } from "../model.ts";

const item = (id: string, x: number, z: number, extra: Partial<Furniture> = {}): Furniture => ({ id, type: "box", x, z, rotation: 0, w: 1, d: 0.6, h: 0.8, variant: null, ...extra });
const plan = { w: 800, h: 600 };
const bar = barSize(6, false);

test("the toolbar sits centred above the item, inside the plan (#398)", () => {
  const at = barPlace({ x0: 300, y0: 300, x1: 400, y1: 360 }, plan, bar)!;
  assert.equal(at.below, false);
  assert.equal(at.x, Math.round(350 - bar.w / 2));
  assert.equal(at.y, 300 - 10 - bar.h);
});

test("near the top edge the toolbar flips below the item; near the sides it stays inside (#398)", () => {
  const top = barPlace({ x0: 300, y0: 20, x1: 400, y1: 80 }, plan, bar)!;
  assert.equal(top.below, true);
  assert.equal(top.y, 90);
  const left = barPlace({ x0: -40, y0: 300, x1: 20, y1: 340 }, plan, bar)!;
  assert.equal(left.x, 4);
  const right = barPlace({ x0: 780, y0: 300, x1: 830, y1: 340 }, plan, bar)!;
  assert.equal(right.x, plan.w - bar.w - 4);
  // a tall item filling the plan: the toolbar still stays inside
  const tall = barPlace({ x0: 300, y0: 2, x1: 400, y1: 598 }, plan, bar)!;
  assert.ok(tall.y >= 4 && tall.y + bar.h <= plan.h - 4);
  assert.equal(barPlace({ x0: 900, y0: 300, x1: 950, y1: 340 }, plan, bar), null, "no toolbar for an item out of view");
});

test("touch buttons are 44 px; on a narrow plan Turn left waits in the '⋯' (#398)", () => {
  assert.equal(barSize(6, true).h, 54);
  assert.ok(barSize(6, true).w > barSize(6, false).w);
  assert.deepEqual(barKeys(false), ["rotate_left", "rotate", "duplicate", "lock", "delete"]);
  assert.deepEqual(barKeys(true), ["rotate", "duplicate", "lock", "delete"]);
});

test("the toolbar's roving focus: arrows wrap, Home and End jump, other keys are not its own (#398)", () => {
  assert.equal(barStep("ArrowRight", 5, 6), 0);
  assert.equal(barStep("ArrowLeft", 0, 6), 5);
  assert.equal(barStep("Home", 3, 6), 0);
  assert.equal(barStep("End", 1, 6), 5);
  assert.equal(barStep("Enter", 1, 6), -1);
});

test("the toolbar's buttons are the right-click menu's actions: turn, duplicate, lock, delete (#398)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)], [item("a", 1, 1), item("b", 3, 1)]);
  ed._tool = "select";
  ed.selectItem("furniture", "a");
  const acts = ed.itemActions("furniture", "a");
  const keys = acts.map((a: { key: string }) => a.key);
  for (const k of [...barKeys(false), "copy", "mirror", "wall_view"]) assert.ok(keys.includes(k), k);
  const act = (k: string) => acts.find((a: { key: string }) => a.key === k);
  assert.equal(act("rotate_left").menu, false, "Turn left is the toolbar's own (and its '⋯' on a narrow plan)");
  act("rotate_left").run();
  assert.equal(ed.furnitureItem.rotation, 270);
  ed.itemActions("furniture", "a").find((a: { key: string }) => a.key === "rotate").run();
  assert.equal(ed.furnitureItem.rotation, 0);
  const n = ed._doc.floors[0].furniture.length;
  ed.itemActions("furniture", "a").find((a: { key: string }) => a.key === "duplicate").run();
  assert.equal(ed._doc.floors[0].furniture.length, n + 1);
  ed.selectItem("furniture", "a");
  const lock = ed.itemActions("furniture", "a").find((a: { key: string }) => a.key === "lock");
  assert.equal(lock.label, "Lock position");
  assert.equal(lock.pressed, false);
  lock.run();
  const locked = ed.itemActions("furniture", "a");
  assert.equal(locked.find((a: { key: string }) => a.key === "lock").pressed, true, "the same name, pressed");
  assert.equal(locked.find((a: { key: string }) => a.key === "rotate_left").disabled, true, "a fixed item does not turn");
});

test("the toolbar shows for one item only, not for several or a block (#398)", async () => {
  const { barShown } = await import("./editor/item-bar.ts");
  const ed = await makeEditor([square("r", 0, 0, 4, 3)], [item("a", 1, 1), item("b", 3, 1), item("c", 2, 2, { group: "g" }), item("d", 2.5, 2, { group: "g" })]);
  ed._tool = "select";
  ed.selectItem("furniture", "a");
  assert.equal(barShown(ed as never), true);
  ed.setMulti(["a", "b"]);
  assert.equal(barShown(ed as never), false);
  ed.selectItem("furniture", "c");
  assert.equal(barShown(ed as never), false, "a block has its own panel");
  ed._tool = "roof";
  ed.selectItem("furniture", "a");
  assert.equal(barShown(ed as never), false);
});

test("Tab from the selected item goes into its toolbar; without one it steps to the next item (#398, #75)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)], [item("a", 1, 1), item("b", 3, 1)]);
  ed._tool = "select";
  ed.selectItem("furniture", "a");
  let focused = 0;
  const svg = ed.renderRoot.querySelector("svg.fp3d-plan");
  Object.defineProperty(ed, "renderRoot", { value: { querySelector: (sel: string) => (sel.includes("fp3d-itembar") ? { focus: () => focused++ } : svg), querySelectorAll: () => [], activeElement: null }, configurable: true });
  assert.equal(ed.key("Tab").prevented, true);
  assert.equal(focused, 1);
  assert.equal(ed._furnitureId, "a", "the item stays chosen");
  assert.equal(ed.key("Tab", { shiftKey: true }).prevented, true, "Shift+Tab still steps back through the items");
  assert.equal(ed._furnitureId, "b");
});

test("while a drag moves an item the side panel keeps its last drawing; it is drawn again on release (#398)", async () => {
  const { sideFreeze } = await import("./editor/item-bar.ts");
  const ed = await makeEditor([square("r", 0, 0, 4, 3)], [item("a", 1, 1)]);
  ed._tool = "select";
  assert.notEqual(sideFreeze(ed as never), sideFreeze(ed as never), "no drag: a new key every render");
  ed.press(100, 100, { target: planEl({ "data-furniture": "a" }) });
  assert.notEqual(sideFreeze(ed as never), sideFreeze(ed as never), "pressed, not moved yet: the panel shows the chosen item");
  ed.move(150, 100);
  const key = sideFreeze(ed as never);
  ed.move(200, 100);
  assert.equal(sideFreeze(ed as never), key, "moving: the same key, so the panel is not drawn again");
  ed.release(200, 100);
  assert.notEqual(sideFreeze(ed as never), key);
  assert.equal(ed.furnitureItem.x, 2);
});
