import { test } from "node:test";
import assert from "node:assert/strict";
import { watchContext } from "./context-loss.ts";

function stubCanvas() {
  const target = new EventTarget();
  return Object.assign(target, {}) as unknown as HTMLCanvasElement;
}

test("context lost is cancelled (so it can come back) and reported", () => {
  const canvas = stubCanvas();
  const calls: string[] = [];
  watchContext(canvas, { lost: () => calls.push("lost"), restored: () => calls.push("restored") });
  const ev = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, true);
  assert.deepEqual(calls, ["lost"]);
});

test("context restored is reported", () => {
  const canvas = stubCanvas();
  const calls: string[] = [];
  watchContext(canvas, { lost: () => calls.push("lost"), restored: () => calls.push("restored") });
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  assert.deepEqual(calls, ["lost", "restored"]);
});

test("unwatch removes both listeners", () => {
  const canvas = stubCanvas();
  const calls: string[] = [];
  const off = watchContext(canvas, { lost: () => calls.push("lost"), restored: () => calls.push("restored") });
  off();
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  assert.deepEqual(calls, []);
});
