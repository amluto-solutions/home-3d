// One rebuild per batch of changes (#131): a home switch hands the viewer new packs, parked cars and the new plan in
// one go; it used to rebuild the scene for each of them.

import assert from "node:assert/strict";
import { test } from "node:test";
import { RebuildBatch } from "./rebuild-batch.ts";

function counting() {
  const runs: boolean[] = [];
  return { runs, batch: new RebuildBatch((incremental) => runs.push(incremental)) };
}

test("outside a batch every request rebuilds at once (#131)", () => {
  const { runs, batch } = counting();
  batch.request(true);
  batch.request(false);
  assert.deepEqual(runs, [true, false]);
});

test("requests inside a batch rebuild once at its end, in full if any asked for it (#131)", () => {
  const { runs, batch } = counting();
  batch.run(() => {
    batch.request(false); // new packs
    batch.request(false); // other parked cars
    batch.request(true); // the new plan
    assert.deepEqual(runs, [], "nothing while the batch runs");
  });
  assert.deepEqual(runs, [false]);
  batch.run(() => {
    batch.request(true);
    batch.request(true);
  });
  assert.deepEqual(runs, [false, true], "only new plans: the incremental rebuild");
  batch.run(() => {});
  assert.deepEqual(runs, [false, true], "nothing asked, nothing done");
});

test("nested batches rebuild when the outer one ends, also after an error (#131)", () => {
  const { runs, batch } = counting();
  batch.run(() => {
    batch.run(() => batch.request(true));
    assert.deepEqual(runs, []);
  });
  assert.deepEqual(runs, [true]);
  assert.throws(() =>
    batch.run(() => {
      batch.request(false);
      throw new Error("x");
    }),
  );
  assert.deepEqual(runs, [true, false]);
  batch.request(true);
  assert.deepEqual(runs, [true, false, true], "not stuck in a batch");
});
