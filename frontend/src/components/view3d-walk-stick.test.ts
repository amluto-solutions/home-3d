import assert from "node:assert/strict";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

/** The functions bound in a lit template, in order. */
function handlers(v: unknown, out: ((e: unknown) => void)[] = []): ((e: unknown) => void)[] {
  if (typeof v === "function") out.push(v as (e: unknown) => void);
  else if (Array.isArray(v)) v.forEach((x) => handlers(x, out));
  else if (v && typeof v === "object" && "values" in (v as object)) handlers((v as { values: unknown[] }).values, out);
  return out;
}

import { nothing as nothing_ } from "lit";

test("the walk stick keeps steering after the view redraws mid-drag (#311)", () => {
  const el = new Fp3dView3d();
  el.hass = { language: "en", locale: { language: "en" }, states: {}, config: { unit_system: {} } };
  el.building = { floors: [] };
  el.walkable = true;
  el.plan2d = false;
  el._walk = { room: null, hint: false };
  const sticks: ({ x: number; y: number } | null)[] = [];
  el.walker = { dispose() {}, setStick: (v: { x: number; y: number } | null) => sticks.push(v) };
  const knob = { style: { transform: "" } };
  const pad = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }), setPointerCapture() {}, firstElementChild: knob };
  const ev = (x: number, y: number) => ({ pointerId: 1, clientX: x, clientY: y, currentTarget: pad });
  // [exit click, pointerdown, pointermove, pointerup, pointercancel]
  const first = handlers(el.renderWalk());
  first[1](ev(50, 10)); // finger down, pushing forward
  // the view redraws (a room change): the new template's handlers take over
  const second = handlers(el.renderWalk());
  second[2](ev(90, 50)); // the finger slides to the right
  const last = sticks.at(-1)!;
  assert.ok(last && last.x > 0.9 && Math.abs(last.y) < 0.1, `the stick follows the finger (${JSON.stringify(last)})`);
  second[3](ev(90, 50));
  assert.equal(sticks.at(-1), null);
});

test("Back and Escape end the walk, and the clock stays away while walking (#351)", () => {
  const el = new Fp3dView3d();
  el.hass = { language: "en", locale: { language: "en" }, states: {}, config: { unit_system: {} } };
  el.building = { floors: [] };
  el.clock = "br";
  assert.ok(el.renderClock() !== undefined && typeof el.renderClock() === "object", "the clock shows");
  assert.equal(el.endWalk(), false, "no walk, nothing to end");
  let disposed = 0;
  el._walk = { room: null, hint: false };
  assert.equal(el.renderClock(), nothing_, "no clock while walking");
  el.walker = { dispose: () => disposed++, setStick() {} };
  assert.equal(el.endWalk(), true);
  assert.equal(el._walk, false);
  assert.equal(disposed, 1);
  // the clock's ticking timer would keep the test process alive
  clearInterval(el.clockTimer);
});
