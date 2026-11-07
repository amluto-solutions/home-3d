// A new plan swapped in during a drag (#382): someone else saved while an item was held (a reload, or the #149
// conflict path loads their plan). The drag held the older plan as its base; its next move, a second finger, Esc, a
// cancel or the release must not write that older plan back over theirs.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Building } from "../model.ts";
import { makeEditor, planEl, square, type TestEditor } from "./editor-harness.ts";

interface Mounted {
  ed: TestEditor;
  /** Every plan the editor handed out (`building-changed`), the one the panel would save. */
  sent: Building[];
}

async function mounted(): Promise<Mounted> {
  const ed = await makeEditor(
    [square("r", 0, 0, 6, 6)],
    [
      { id: "sofa", type: "sofa", x: 4, z: 4, rotation: 0, w: 1, d: 0.5, h: 0.8, variant: null },
      { id: "lamp", type: "lamp", x: 1, z: 1, rotation: 0, w: 0.3, d: 0.3, h: 1.5, variant: null },
    ],
  );
  ed.building = ed._doc;
  ed.refreshLibUpdates = () => {}; // asks the backend for pack updates on a new plan
  ed.history.adopt(ed._doc, ed.home);
  const sent: Building[] = [];
  ed.dispatchEvent = (e: CustomEvent<{ building: Building }>) => {
    if (e.type === "building-changed") {
      sent.push(e.detail.building);
      // the panel stores the edit and hands it back as `building`, as it does in the app
      ed.building = e.detail.building;
    }
    return true;
  };
  return { ed, sent };
}

const item = (b: Building, id: string) => b.floors[0].furniture.find((m) => m.id === id)!;

/** The sofa held and moved half a metre (the save of that move ran); returns the plan on screen then. */
function holdSofa({ ed }: Mounted): Building {
  ed.press(400, 400, { target: planEl({ "data-furniture": "sofa" }), pointerType: "touch" });
  ed.move(450, 400, { pointerType: "touch" });
  assert.equal(item(ed._doc, "sofa").x, 4.5, "the sofa follows the pointer");
  return ed._doc;
}

/** Someone else's save arrives: their plan has the lamp moved (and the sofa where our save left it). */
function theirSave({ ed }: Mounted, from: Building): Building {
  const theirs = structuredClone(from);
  item(theirs, "lamp").x = 2;
  const before = ed.building;
  ed.building = theirs;
  ed.willUpdate(new Map<string, unknown>([["building", before]]));
  assert.equal(ed._doc, theirs, "their plan is shown");
  return theirs;
}

function keepsTheirs(m: Mounted, theirs: Building, sentBefore: number): void {
  assert.equal(m.ed._doc, theirs, "the plan on screen is still theirs");
  assert.equal(item(m.ed._doc, "lamp").x, 2, "their lamp move stays");
  assert.equal(m.sent.length, sentBefore, "nothing of the older plan is handed out to be saved");
}

test("a plan swapped in during a drag ends the drag: the next move does not write the older plan back (#382)", async () => {
  const m = await mounted();
  const ours = holdSofa(m);
  const theirs = theirSave(m, ours);
  const n = m.sent.length;
  assert.equal(m.ed.drag, null, "the drag is dropped");
  m.ed.move(550, 400, { pointerType: "touch" });
  m.ed.move(600, 420, { pointerType: "touch" });
  keepsTheirs(m, theirs, n);
  assert.equal(item(m.ed._doc, "sofa").x, 4.5, "the sofa stays where their plan has it");
  m.ed.release(600, 420, { pointerType: "touch" });
  keepsTheirs(m, theirs, n);
  assert.equal(m.ed.history.canUndo, false, "no undo step leads back to the older plan");
});

test("Esc after the swap, then moving on, leaves their plan alone (#382)", async () => {
  const m = await mounted();
  const theirs = theirSave(m, holdSofa(m));
  const n = m.sent.length;
  m.ed.key("Escape");
  m.ed.move(550, 400, { pointerType: "touch" });
  m.ed.release(550, 400, { pointerType: "touch" });
  keepsTheirs(m, theirs, n);
  assert.equal(m.ed.history.canUndo, false);
});

test("a second finger after the swap pinches without putting the older plan back (#382)", async () => {
  const m = await mounted();
  const theirs = theirSave(m, holdSofa(m));
  const n = m.sent.length;
  m.ed.press(200, 200, { id: 2, pointerType: "touch" });
  assert.ok(m.ed.pinch, "the second finger pinches");
  m.ed.move(150, 150, { id: 2, pointerType: "touch" });
  m.ed.release(150, 150, { id: 2, pointerType: "touch" });
  m.ed.release(450, 400, { pointerType: "touch" });
  keepsTheirs(m, theirs, n);
});

test("a browser cancel after the swap does not restore the older plan (#382)", async () => {
  const m = await mounted();
  const theirs = theirSave(m, holdSofa(m));
  const n = m.sent.length;
  m.ed.onPointerUp({ type: "pointercancel", clientX: 450, clientY: 400, button: 0, pointerId: 1, pointerType: "touch", target: planEl(), currentTarget: m.ed.renderRoot.querySelector("svg"), preventDefault() {}, stopPropagation() {} });
  keepsTheirs(m, theirs, n);
});

test("a held item's long press does not open its menu after the swap (#382)", async () => {
  const m = await mounted();
  const g = globalThis as { window?: unknown };
  const hadWindow = "window" in g;
  g.window ??= globalThis; // the long press is timed with window.setTimeout
  const svg = m.ed.renderRoot.querySelector("svg");
  m.ed.onPointerDown({ clientX: 400, clientY: 400, button: 0, pointerId: 1, pointerType: "touch", target: planEl({ "data-furniture": "sofa" }), currentTarget: svg, preventDefault() {}, stopPropagation() {} });
  assert.equal(m.ed.drag?.kind, "furniture");
  let opened = false;
  m.ed.openContext = () => (opened = true);
  theirSave(m, m.ed._doc);
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(opened, false, "no menu");
  assert.equal(m.ed._multiMode, false, "no Select several");
  if (!hadWindow) delete g.window;
});

test("the wall view's and pipe drags holding the older plan end with the swap too (#382)", async () => {
  const m = await mounted();
  const old = m.ed._doc;
  m.ed.wallDrag = { id: "sofa", x: 0, y: 0, base: old, s0: 0, y0: 0, lift: false, moved: true };
  m.ed.wallResize = { id: "sofa", side: "l", x0: 0, x1: 1, y0: 0, y1: 1, base: old, moved: true };
  m.ed.lift = { id: "sofa", y: 0, startY: 0, perPx: 0.01, base: old, top: 2, moved: true };
  m.ed.runDrag = { pipe: "p", i: 0, d: 0, base: old, moved: true };
  m.ed.jointDrag = { id: "j", d: 0, base: old, moved: true };
  m.ed.fitDrag = { pipe: "p", id: "v", base: old, moved: true, x: 0, y: 0 };
  theirSave(m, old);
  for (const k of ["wallDrag", "wallResize", "lift", "runDrag", "jointDrag", "fitDrag"]) assert.equal(m.ed[k], null, k);
  // their ends push nothing into the history
  m.ed.liftUp();
  m.ed.runPointUp();
  m.ed.endJointDrags();
  assert.equal(m.ed.history.canUndo, false);
});

test("panning and drawing hold no plan and go on after the swap; a room drawn lands on their plan (#382)", async () => {
  const m = await mounted();
  m.ed.setTool("rect");
  m.ed.press(700, 100);
  m.ed.move(750, 150);
  const theirs = theirSave(m, m.ed._doc);
  assert.equal(m.ed.drag?.kind, "rect", "the frame being drawn goes on");
  m.ed.move(790, 200);
  m.ed.release(790, 200);
  assert.equal(m.ed._doc.floors[0].rooms.length, 2, "the room drawn is added");
  assert.equal(item(m.ed._doc, "lamp").x, 2, "on their plan");
  assert.notEqual(m.ed._doc, theirs);
});

test("an ordinary drag with no plan swapped in still moves and is one undo step (#382)", async () => {
  const m = await mounted();
  holdSofa(m);
  m.ed.move(500, 400, { pointerType: "touch" });
  m.ed.release(500, 400, { pointerType: "touch" });
  assert.equal(item(m.ed._doc, "sofa").x, 5);
  m.ed.undo();
  assert.equal(item(m.ed._doc, "sofa").x, 4);
});
