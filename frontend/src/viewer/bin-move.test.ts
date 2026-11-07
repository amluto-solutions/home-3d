import assert from "node:assert/strict";
import { test } from "node:test";
import type { Vec2 } from "../model.ts";
import { binGlides, cueDashes, glidePos, type BinGlide } from "./bin-move.ts";

const home = new Map<string, Vec2>([["b", [0, 0]]]);
const none = new Map<string, Vec2>();
const kerb = new Map<string, Vec2>([["b", [4, 0]]]);

test("a bin marked out glides from its place to the kerb, and back when marked in (#142)", () => {
  const out = binGlides(none, kerb, home, new Map(), true);
  assert.deepEqual(out.get("b"), { from: [0, 0], to: [4, 0], t: 0 });
  const back = binGlides(kerb, none, home, new Map(), true);
  assert.deepEqual(back.get("b"), { from: [4, 0], to: [0, 0], t: 0 });
});

test("no glide without animation (reduced motion, tablet level) or when nothing moved (#142)", () => {
  assert.equal(binGlides(none, kerb, home, new Map(), false).size, 0);
  assert.equal(binGlides(kerb, kerb, home, new Map(), true).size, 0);
  assert.equal(binGlides(none, none, home, new Map(), true).size, 0);
});

test("a glide turned round midway starts where the bin is; a running one to the same spot keeps going (#142)", () => {
  const running: BinGlide = { from: [0, 0], to: [4, 0], t: 0.5 };
  const same = binGlides(none, kerb, home, new Map([["b", running]]), true);
  assert.equal(same.get("b"), running);
  const back = binGlides(kerb, none, home, new Map([["b", running]]), true).get("b")!;
  assert.deepEqual(back.from, glidePos(running));
  assert.deepEqual(back.to, [0, 0]);
});

test("a bin that is gone drops its glide (#142)", () => {
  assert.equal(binGlides(none, kerb, new Map(), new Map([["b", { from: [0, 0], to: [4, 0], t: 0.2 }]]), true).size, 0);
});

test("glidePos eases from start to end", () => {
  const g: BinGlide = { from: [0, 0], to: [2, 4], t: 0 };
  assert.deepEqual(glidePos(g), [0, 0]);
  assert.deepEqual(glidePos({ ...g, t: 1 }), [2, 4]);
  assert.deepEqual(glidePos({ ...g, t: 0.5 }), [1, 2]);
  assert.deepEqual(glidePos({ ...g, t: 3 }), [2, 4]);
});

test("the cue's dashes run from the bin's edge to short of the spot (#142)", () => {
  const d = cueDashes([0, 0], [3, 0], 0.5, 0.3, 0.3, 0.2);
  assert.equal(d[0][0][0], 0.5);
  assert.ok(Math.abs(d[0][1][0] - 0.8) < 1e-9);
  const last = d[d.length - 1];
  assert.ok(last[1][0] <= 2.7 + 1e-9);
  assert.ok(d.every(([a, b]) => b[0] > a[0]));
  // a spot right next to the bin: no dashes
  assert.deepEqual(cueDashes([0, 0], [0.4, 0], 0.3), []);
});
