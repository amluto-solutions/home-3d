import assert from "node:assert/strict";
import { test } from "node:test";
import { nextTask, runAll, runSliced, SliceCancelled, type SliceClock } from "./slices.ts";

/** A clock where each step costs `stepMs` and the pauses are counted. */
function fakeClock(): SliceClock & { t: number; pauses: number } {
  const c = {
    t: 0,
    pauses: 0,
    now: () => c.t,
    pause: () => {
      c.pauses++;
      return Promise.resolve();
    },
  };
  return c;
}

function* steps(n: number, clock: { t: number }, stepMs: number, log: number[] = []): Generator<unknown, string, void> {
  for (let i = 0; i < n; i++) {
    clock.t += stepMs;
    log.push(i);
    yield;
  }
  return "built";
}

test("a job runs in slices of about the budget, each after a pause (run 6 speed)", async () => {
  const clock = fakeClock();
  const log: number[] = [];
  // 20 steps of 5 ms, 12 ms a slice: 3 steps a slice (15 ms), 7 slices
  const job = runSliced(steps(20, clock, 5, log), clock, 12);
  assert.equal(log.length, 0, "nothing runs in the caller's task");
  assert.equal(await job.done, "built");
  assert.equal(log.length, 20);
  assert.equal(clock.pauses, 7);
});

test("a step longer than the budget still makes progress, one step a slice", async () => {
  const clock = fakeClock();
  const job = runSliced(steps(4, clock, 50), clock, 12);
  assert.equal(await job.done, "built");
  // one pause before each of the 4 steps' slices, and one before the slice that returns
  assert.equal(clock.pauses, 5);
});

test("a cancelled job stops before its next slice, closes the generator and rejects", async () => {
  const clock = fakeClock();
  let closed = false;
  const log: number[] = [];
  function* gen(): Generator<unknown, string, void> {
    try {
      yield* steps(100, clock, 5, log);
      return "never";
    } finally {
      closed = true;
    }
  }
  const job = runSliced(gen(), clock, 12);
  await Promise.resolve();
  job.cancel();
  await assert.rejects(job.done, SliceCancelled);
  assert.ok(job.cancelled);
  assert.ok(closed, "the generator's finally ran");
  assert.ok(log.length < 100, `${log.length} steps ran`);
});

test("an error in a step rejects the job", async () => {
  const clock = fakeClock();
  function* bad(): Generator<unknown, string, void> {
    yield;
    throw new Error("boom");
  }
  await assert.rejects(runSliced(bad(), clock).done, /boom/);
});

test("runAll does the same work at once", () => {
  const clock = { t: 0 };
  const log: number[] = [];
  assert.equal(runAll(steps(5, clock, 1, log)), "built");
  assert.deepEqual(log, [0, 1, 2, 3, 4]);
});

test("nextTask resolves in a later task", async () => {
  let later = false;
  const p = nextTask().then(() => later);
  later = true;
  assert.equal(await p, true);
});
