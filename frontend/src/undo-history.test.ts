// The undo history's memory (#185): steps share the parts of the plan they have in common, and the steps together
// stay under a size limit, the oldest dropping off first.

import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Building } from "./model.ts";
import { HISTORY_CHARS, UndoHistory } from "./undo-history.ts";

/** A plan with two floors, one item each; `pad` characters of recipe copy (the bulk of a real plan). */
function plan(pad = 0): Building {
  const b = emptyBuilding();
  for (const id of ["g", "u"]) {
    const floor = newFloor(id, id, 0);
    floor.furniture.push({ id: `t${id}`, type: "table", x: 0, z: 0, rotation: 0, w: 1, d: 1, h: 0.75, variant: null });
    b.floors.push(floor);
  }
  b.recipes = { "pack:big": { hash: "h", recipe: { id: "big", note: "x".repeat(pad) } } } as never;
  return b;
}

/** `b` with the ground floor's item at `x` (a new floor object, the rest shared, as the editor's drags make it). */
function moved(b: Building, x: number, where = 0): Building {
  const floors = b.floors.slice();
  floors[where] = { ...floors[where], furniture: [{ ...floors[where].furniture[0], x }] };
  return { ...b, floors };
}

test("a big plan's steps stay under the size limit: the oldest drop off, undo still works for the rest (#185)", () => {
  const limit = 1_000_000;
  const h = new UndoHistory({ maxChars: limit });
  // every step changes the big part too (a new recipe copy), so nothing can be shared: 100 steps would be ~10 MB
  let doc = plan();
  for (let i = 1; i <= 100; i++) {
    const next = { ...moved(doc, i), recipes: { "pack:big": { hash: `h${i}`, recipe: { id: "big", note: String(i).padEnd(100_000, "x") } } } as never };
    h.push(doc);
    doc = next;
  }
  assert.ok(h.size <= limit, `held ${h.size} characters, limit ${limit}`);
  assert.ok(h.steps < 100 && h.steps >= 5, `kept ${h.steps} steps`);
  // the steps kept are the newest ones, in order
  const kept = h.steps;
  for (let i = 0; i < kept; i++) doc = h.undo(doc)!;
  assert.equal(doc.floors[0].furniture[0].x, 100 - kept);
  assert.equal(h.undo(doc), null);
});

test("the default limit is about 25 MB of plan JSON (#185)", () => {
  assert.equal(HISTORY_CHARS, 25_000_000);
});

test("steps share what did not change: 100 moves on a 1 MB plan hold the big parts once (#185)", () => {
  const h = new UndoHistory();
  let doc = plan(1_000_000);
  for (let i = 1; i <= 100; i++) {
    h.push(doc);
    doc = moved(doc, i, i % 2);
  }
  assert.equal(h.steps, 100);
  assert.ok(h.size < 1_100_000, `held ${h.size} characters for 100 steps of a 1 MB plan`);
  for (let i = 100; i > 0; i--) doc = h.undo(doc)!;
  assert.deepEqual(doc, plan(1_000_000));
});

test("the newest step stays even when it alone is over the limit (#185)", () => {
  const h = new UndoHistory({ maxChars: 1000 });
  const a = plan(5000);
  h.push(a);
  h.push(moved(a, 1));
  assert.equal(h.steps, 1);
  assert.equal(h.undo(moved(a, 2))?.floors[0].furniture[0].x, 1);
});

test("undo and redo give the plan back as it was, field order and all; clearing lets everything go (#185)", () => {
  const h = new UndoHistory();
  const a = plan(10);
  a.opening_links_saved = true;
  const b = moved(a, 3);
  h.push(a);
  const back = h.undo(b)!;
  assert.deepEqual(back, a);
  assert.deepEqual(Object.keys(back), Object.keys(a));
  assert.deepEqual(h.redo(back), b);
  assert.ok(h.size > 0);
  h.clear();
  assert.equal(h.size, 0);
  assert.equal(h.steps, 0);
});

test("a new change after undo lets the redo steps go and their size with them (#185)", () => {
  const h = new UndoHistory();
  const a = plan();
  const b = moved(plan(50_000), 1);
  h.push(a);
  h.undo(b);
  const withRedo = h.size;
  h.push(moved(a, 5));
  assert.ok(h.size < withRedo, "the redo step's own parts are gone");
  assert.equal(h.canRedo, false);
});
