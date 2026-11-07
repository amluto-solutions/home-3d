import assert from "node:assert/strict";
import { test } from "node:test";
import { TypedCommit } from "./typed-commit.ts";

/** Timers run by hand: `tick(ms)` moves the clock on. */
function clock() {
  let now = 0;
  let next = 1;
  const due = new Map<number, { at: number; fn: () => void }>();
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        due.set(next, { at: now + ms, fn });
        return next++;
      },
      clear: (id: unknown) => void due.delete(id as number),
    },
    tick(ms: number) {
      now += ms;
      for (const [id, t] of [...due]) if (t.at <= now) (due.delete(id), t.fn());
    },
  };
}

function setup() {
  const c = clock();
  const typed = new TypedCommit({ delay: 600, timers: c.timers });
  const box = {};
  const saved: string[] = [];
  const commit = (text: string) => void saved.push(text);
  return { c, typed, box, saved, commit };
}

test("a typed number is saved after a short pause, without Enter or leaving the box (#69)", () => {
  const { c, typed, box, saved, commit } = setup();
  typed.focus(box);
  typed.input(box, "3", commit);
  c.tick(300);
  typed.input(box, "3.1", commit);
  c.tick(599);
  assert.deepEqual(saved, []);
  c.tick(1);
  assert.deepEqual(saved, ["3.1"]);
});

test("Enter saves at once (#69)", () => {
  const { c, typed, box, saved, commit } = setup();
  typed.focus(box);
  typed.input(box, "2.5", commit);
  typed.enter(box, "2.5", commit);
  assert.deepEqual(saved, ["2.5"]);
  c.tick(1000);
  assert.deepEqual(saved, ["2.5"], "the pending pause doesn't save it twice");
});

test("leaving the box saves what was typed, once (one undo step) (#69)", () => {
  const { c, typed, box, saved, commit } = setup();
  typed.focus(box);
  typed.input(box, "1.2", commit);
  c.tick(600);
  typed.change(box, "1.2", commit);
  typed.blur(box);
  assert.deepEqual(saved, ["1.2"]);
  typed.input(box, "1.25", commit);
  typed.change(box, "1.25", commit);
  assert.deepEqual(saved, ["1.2", "1.25"]);
});

test("while the user types, a redraw must not overwrite the box; after leaving it, it may (#69)", () => {
  const { typed, box, commit } = setup();
  typed.focus(box);
  assert.equal(typed.typing(box), false);
  typed.input(box, "-9", commit);
  assert.equal(typed.typing(box), true);
  typed.change(box, "-90", commit);
  typed.blur(box);
  assert.equal(typed.typing(box), false);
});

test("Enter hands the box back to the plan's value (a rotation of -90 shows as 270) (#69)", () => {
  const { typed, box, commit } = setup();
  typed.focus(box);
  typed.input(box, "-90", commit);
  typed.enter(box, "-90", commit);
  assert.equal(typed.typing(box), false);
});

test("the same box used for the next item saves the same text again (#69)", () => {
  // Lit reuses the X box when another item is chosen: "2" for the lamp is a new value even if the sofa got "2"
  const { typed, box, saved, commit } = setup();
  typed.focus(box);
  typed.input(box, "2", commit);
  typed.change(box, "2", commit);
  typed.blur(box);
  typed.focus(box);
  typed.input(box, "2", commit);
  typed.change(box, "2", commit);
  assert.deepEqual(saved, ["2", "2"]);
});

test("a pause after the box was left saves nothing more (#69)", () => {
  const { c, typed, box, saved, commit } = setup();
  typed.focus(box);
  typed.input(box, "4", commit);
  typed.blur(box);
  c.tick(1000);
  assert.deepEqual(saved, []);
});
