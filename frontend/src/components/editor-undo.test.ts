import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Building } from "../model.ts";
import { TypedCommit } from "../typed-commit.ts";
import { UndoHistory } from "../undo-history.ts";

// the editor's bundle hashes are build-time constants: plain strings will do here
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

/** A plan with one 6 x 4 m room holding a 1 x 1 m table at (2, 2). */
function plan(): Building {
  const b = emptyBuilding();
  const floor = newFloor("f", "Ground", 0);
  floor.rooms.push({ id: "r", name: "Hall", area_id: null, points: [[0, 0], [6, 0], [6, 4], [0, 4]], floor_material: "wood" } as never);
  floor.furniture.push({ id: "t", type: "table", x: 2, z: 2, width: 1, depth: 1, height: 0.75, rotation: 0 } as never);
  b.floors.push(floor);
  return b;
}

/**
 * The editor as panel.ts mounts it on opening the Editor tab: a fresh element, handed the panel's history, the home
 * and the building. Its edits come back out as `building-changed`, which the panel stores and hands to the next one.
 */
function mount(building: Building, history: UndoHistory, home: string | null = "home-a") {
  const el = new Fp3dEditor();
  el.canEdit = true;
  el.renderRoot = { activeElement: null, querySelector: () => null, querySelectorAll: () => [] };
  el.history = history;
  el.home = home;
  el.building = building;
  el.willUpdate(new Map<string, unknown>([["building", undefined], ["home", undefined], ["history", undefined]]));
  const out = { el, last: building };
  el.dispatchEvent = (e: CustomEvent<{ building: Building }>) => {
    if (e.type === "building-changed") out.last = e.detail.building;
    return true;
  };
  return out;
}

const table = (b: Building) => b.floors[0].furniture.find((m) => m.id === "t")!;

/** Moves the table by `dx` through the item panel's X field (one ordinary undo step). */
function moveTable(el: Record<string, any>, x: number) {
  el.selectItem("furniture", "t");
  el.updateFurniture({ x });
}

test("undo after leaving the Editor tab and coming back still steps back through the edits made before (#66)", () => {
  const history = new UndoHistory();
  const first = mount(plan(), history);
  moveTable(first.el, 3);
  moveTable(first.el, 4);
  // the tab is left: the element goes; coming back mounts a new one with what the panel kept
  const second = mount(first.last, history);
  assert.equal(second.el._canUndo, true);
  second.el.undo();
  assert.equal(table(second.el._doc).x, 3);
  second.el.undo();
  assert.equal(table(second.el._doc).x, 2);
  assert.equal(second.el._canUndo, false);
  second.el.redo();
  assert.equal(table(second.el._doc).x, 3);
});

test("a plan reloaded from the server (someone else's edit) starts a fresh history, so undo can't jump back over it (#66)", () => {
  const history = new UndoHistory();
  const first = mount(plan(), history);
  moveTable(first.el, 3);
  // the editor is still open when the other change arrives: a new plan object the history never handed out
  const theirs = structuredClone(first.last);
  table(theirs).z = 1;
  first.el.building = theirs;
  first.el.willUpdate(new Map<string, unknown>([["building", first.last]]));
  assert.equal(first.el._canUndo, false);
  first.el.undo();
  assert.equal(table(first.el._doc).z, 1);
  // and the same after the tab was left meanwhile
  moveTable(first.el, 4);
  const reloaded = structuredClone(first.last);
  const again = mount(reloaded, history);
  assert.equal(again.el._canUndo, false);
});

test("switching to another home drops the history; coming back to the first home does not bring it back (#66, #53)", () => {
  const history = new UndoHistory();
  const a = mount(plan(), history, "home-a");
  moveTable(a.el, 3);
  const b = mount(plan(), history, "home-b");
  assert.equal(b.el._canUndo, false);
  // the first home's plan comes back from the server as a new object: nothing to undo there either
  const back = mount(structuredClone(a.last), history, "home-a");
  assert.equal(back.el._canUndo, false);
});

/** A history whose clock the test moves. */
function clocked() {
  const clock = { t: 1000 };
  return { clock, history: new UndoHistory({ now: () => clock.t }) };
}

test("arrow nudges of the same item in quick succession are one undo step (#66)", () => {
  const { clock, history } = clocked();
  const { el } = mount(plan(), history);
  el.selectItem("furniture", "t");
  for (let i = 0; i < 5; i++) {
    el.nudge(0.1, 0);
    clock.t += 200; // a held arrow key repeats faster than this
  }
  assert.equal(table(el._doc).x, 2.5);
  el.undo();
  assert.equal(table(el._doc).x, 2);
  assert.equal(el._canUndo, false);
  // and redo brings the whole run back
  el.redo();
  assert.equal(table(el._doc).x, 2.5);
});

test("a nudge after a pause, of another item, or after another edit starts a new undo step (#66)", () => {
  const { clock, history } = clocked();
  const b = plan();
  b.floors[0].furniture.push({ id: "c", type: "chair", x: 4, z: 2, width: 0.5, depth: 0.5, height: 0.9, rotation: 0 } as never);
  const { el } = mount(b, history);
  const chair = (d: Building) => d.floors[0].furniture.find((m) => m.id === "c")!;
  el.selectItem("furniture", "t");
  el.nudge(0.1, 0); // 2.1
  clock.t += 600;
  el.nudge(0.1, 0); // 2.2, after a pause: its own step
  clock.t += 100;
  el.selectItem("furniture", "c");
  el.nudge(0, 0.1); // the chair: its own step
  clock.t += 100;
  el.updateFurniture({ rotation: 90 }); // an ordinary edit
  clock.t += 100;
  el.nudge(0, 0.1); // the chair again, but the run was broken
  assert.equal(chair(el._doc).z, 2.2);
  el.undo();
  assert.equal(chair(el._doc).z, 2.1);
  assert.equal(chair(el._doc).rotation, 90);
  el.undo();
  assert.equal(chair(el._doc).rotation, 0);
  el.undo();
  assert.equal(chair(el._doc).z, 2);
  assert.equal(table(el._doc).x, 2.2);
  el.undo();
  assert.equal(table(el._doc).x, 2.1);
  el.undo();
  assert.equal(table(el._doc).x, 2);
  assert.equal(el._canUndo, false);
});

test("a change made in the 3D view while the Editor tab is closed is one more undo step, not a reason to drop them (#66)", () => {
  const history = new UndoHistory();
  const first = mount(plan(), history);
  moveTable(first.el, 3);
  // View tab: the table is turned in 3D (panel.ts editFurniture), and the panel records it
  const turned = structuredClone(first.last);
  table(turned).rotation = 45;
  history.record(first.last, turned, "home-a");
  const second = mount(turned, history);
  assert.equal(second.el._canUndo, true);
  second.el.undo();
  assert.equal(table(second.el._doc).rotation, 0);
  assert.equal(table(second.el._doc).x, 3);
  second.el.undo();
  assert.equal(table(second.el._doc).x, 2);
});

/** The editor's typed-number boxes (#69) on a hand-run clock: `tick` runs the pause timers and moves history time. */
function typing(el: Record<string, any>, clock: { t: number }) {
  const due = new Map<number, { at: number; fn: () => void }>();
  let next = 1;
  const timers = {
    set: (fn: () => void, ms: number) => (due.set(next, { at: clock.t + ms, fn }), next++),
    clear: (id: unknown) => void due.delete(id as number),
  };
  Object.defineProperty(el, "typed", { value: new TypedCommit({ delay: 600, timers }) });
  const tick = (ms: number) => {
    clock.t += ms;
    for (const [id, t] of [...due]) if (t.at <= clock.t) (due.delete(id), t.fn());
  };
  /** A number box saving into the selected item's `key`, as the item panel's X/Z boxes do. */
  const box = (key: "x" | "z") => {
    const input = { value: "" };
    const on = el.typedEvents((text: string) => el.updateFurniture({ [key]: parseFloat(text) }));
    const ev = { target: input };
    return {
      focus: () => on.focus(ev),
      type: (text: string) => ((input.value = text), on.input(ev)),
      enter: () => on.keydown({ ...ev, key: "Enter" }),
      blur: () => (on.change(ev), on.blur(ev)),
    };
  };
  return { tick, box };
}

test("one typed value is one undo step even with a pause in the middle of typing it (#127)", () => {
  const { clock, history } = clocked();
  const { el } = mount(plan(), history);
  const { tick, box } = typing(el, clock);
  el.selectItem("furniture", "t");
  const x = box("x");
  x.focus();
  x.type("1.");
  tick(600); // saved after the pause: 1
  tick(3000); // thinking
  x.type("1.5");
  tick(600); // saved again: 1.5
  x.blur();
  assert.equal(table(el._doc).x, 1.5);
  el.undo();
  assert.equal(table(el._doc).x, 2);
  assert.equal(el._canUndo, false);
});

test("Enter or leaving the box ends the step; another box or another item is a step of its own (#127)", () => {
  const { clock, history } = clocked();
  const b = plan();
  b.floors[0].furniture.push({ id: "c", type: "chair", x: 4, z: 2, width: 0.5, depth: 0.5, height: 0.9, rotation: 0 } as never);
  const { el } = mount(b, history);
  const chair = (d: Building) => d.floors[0].furniture.find((m) => m.id === "c")!;
  const { tick, box } = typing(el, clock);
  el.selectItem("furniture", "t");
  const x = box("x");
  x.focus();
  x.type("3");
  x.enter(); // 3, step ends
  x.type("4");
  tick(600); // 4: a new step
  const z = box("z");
  z.focus();
  z.type("1");
  tick(600); // z 1: the Z box's own step
  // the same box drawn for another item (Lit reuses it) without leaving it
  el.selectItem("furniture", "c");
  x.type("5");
  tick(600);
  assert.deepEqual([table(el._doc).x, table(el._doc).z, chair(el._doc).x], [4, 1, 5]);
  el.undo();
  assert.equal(chair(el._doc).x, 4);
  el.undo();
  assert.equal(table(el._doc).z, 2);
  el.undo();
  assert.equal(table(el._doc).x, 3);
  el.undo();
  assert.equal(table(el._doc).x, 2);
  assert.equal(el._canUndo, false);
});
