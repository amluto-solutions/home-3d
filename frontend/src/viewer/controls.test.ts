import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import { keyView, stale } from "./controls.ts";

test("input that waited out a busy moment is dropped, not replayed (#712)", () => {
  assert.equal(stale({ timeStamp: 1000 }, 1100), false);
  assert.equal(stale({ timeStamp: 1000 }, 1600), false); // a slow tablet's frame
  assert.equal(stale({ timeStamp: 1000 }, 2500), true);
  // a timestamp on another clock (very old browsers: epoch milliseconds) is never taken as stale
  assert.equal(stale({ timeStamp: 1_700_000_000_000 }, 5000), false);
  assert.equal(stale({ timeStamp: 1000 }, 1000 + 120_000), false);
});

test("a second finger neither moves nor drops a furniture drag (#174)", async () => {
  const { OrbitControls } = await import("./controls.ts");
  const handlers: Record<string, (e: unknown) => void> = {};
  const el = {
    addEventListener: (t: string, fn: (e: unknown) => void) => (handlers[t] = fn),
    removeEventListener: () => {},
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    clientHeight: 100,
  };
  const log: string[] = [];
  const events = {
    tap: () => log.push("tap"),
    doubleTap: () => log.push("dtap"),
    hold: () => log.push("hold"),
    change: () => {},
    grab: () => true,
    drag: (x: number) => log.push(`drag${x}`),
    drop: () => log.push("drop"),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new OrbitControls(el as any, {} as any, events as any);
  const ev = (id: number, x: number) => ({ pointerId: id, button: 0, clientX: x, clientY: 5, pointerType: "touch", timeStamp: performance.now(), altKey: false, shiftKey: false });
  handlers.pointerdown(ev(1, 10));
  handlers.pointerdown(ev(2, 50)); // second finger lands
  handlers.pointermove(ev(2, 60)); // and wanders
  handlers.pointermove(ev(1, 20));
  handlers.pointerup(ev(2, 60)); // and lifts
  assert.deepEqual(log, ["drag20"], "only the first finger drags; the second does not drop");
  handlers.pointerup(ev(1, 20));
  assert.deepEqual(log, ["drag20", "drop"]);
});

test("a resting mouse reports where it hovers; a pressed button, a finger or leaving does not hover (#284)", async () => {
  const { OrbitControls } = await import("./controls.ts");
  const handlers: Record<string, (e: unknown) => void> = {};
  const el = {
    addEventListener: (t: string, fn: (e: unknown) => void) => (handlers[t] = fn),
    removeEventListener: () => {},
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 100 }),
    clientHeight: 100,
  };
  const log: string[] = [];
  const events = { tap() {}, doubleTap() {}, hold() {}, change() {}, hover: (x: number, y: number) => log.push(`hover${x},${y}`), leave: () => log.push("leave") };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new OrbitControls(el as any, {} as any, events as any);
  const ev = (pointerType: string, buttons: number) => ({ pointerId: 1, button: 0, buttons, clientX: 40, clientY: 50, pointerType, timeStamp: performance.now(), altKey: false, shiftKey: false });
  handlers.pointermove(ev("mouse", 0));
  handlers.pointermove(ev("mouse", 1));
  handlers.pointermove(ev("touch", 0));
  handlers.pointerleave(ev("mouse", 0));
  assert.deepEqual(log, ["hover30,30", "leave"]);
});

const FROM = () => ({ target: new Vector3(5, 1, 5), radius: 16, theta: 0, phi: 0.85 });

test("arrow keys turn the view, Shift+arrows move it, plus and minus zoom (#195)", () => {
  const left = keyView("ArrowLeft", false, FROM())!;
  const right = keyView("ArrowRight", false, FROM())!;
  assert.ok(left.theta! > 0 && right.theta! < 0, "left and right turn opposite ways");
  assert.ok(Math.abs(left.theta! + right.theta!) < 1e-9);
  assert.ok(keyView("ArrowUp", false, FROM())!.phi! < 0.85 && keyView("ArrowDown", false, FROM())!.phi! > 0.85);
  // the polar angle stays inside its stops
  assert.ok(keyView("ArrowDown", false, { ...FROM(), phi: 1.35 })!.phi! <= 1.35);
  assert.ok(keyView("ArrowUp", false, { ...FROM(), phi: 0.12 })!.phi! >= 0.12);
  // Shift moves across the ground along the view's right (theta 0: +x) and forward (-z)
  const moved = keyView("ArrowRight", true, FROM())!.target!;
  assert.ok(moved.x > 5 && Math.abs(moved.z - 5) < 1e-9 && moved.y === 1);
  assert.ok(keyView("ArrowUp", true, FROM())!.target!.z < 5);
  // zoom in is closer, out is further, both stay inside the limits
  assert.ok(keyView("+", false, FROM())!.radius! < 16 && keyView("-", false, FROM())!.radius! > 16);
  assert.equal(keyView("+", false, { ...FROM(), radius: 2 }, 2, 80)!.radius, 2);
  assert.equal(keyView("-", false, { ...FROM(), radius: 80 }, 2, 80)!.radius, 80);
  // other keys are left alone
  assert.equal(keyView("a", false, FROM()), null);
  assert.equal(keyView("Enter", false, FROM()), null);
});

test("the canvas takes arrow keys when focused and the host allows it, and leaves other keys and targets alone (#195)", async () => {
  const { OrbitControls } = await import("./controls.ts");
  const handlers: Record<string, (e: unknown) => void> = {};
  const el = {
    addEventListener: (t: string, fn: (e: unknown) => void) => (handlers[t] = fn),
    removeEventListener: () => {},
  };
  (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: true });
  let allowed = true;
  const changes: number[] = [];
  const events = { change: () => changes.push(1), tap: () => {}, doubleTap: () => {}, hold: () => {}, keys: () => allowed };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = new OrbitControls(el as any, {} as any, events as any);
  const key = (k: string, extra: Record<string, unknown> = {}, target: unknown = el) => {
    let prevented = false;
    handlers.keydown({ key: k, target, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: () => (prevented = true), ...extra });
    return prevented;
  };
  const theta = c.view.theta;
  assert.equal(key("ArrowLeft"), true);
  assert.ok(c.view.theta > theta, "turned");
  // repeated keys accumulate
  const once = c.view.theta;
  key("ArrowLeft");
  assert.ok(c.view.theta > once);
  // a key typed in a field over the view, a shortcut and a refusing host are left alone
  assert.equal(key("ArrowLeft", {}, {}), false);
  assert.equal(key("ArrowLeft", { ctrlKey: true }), false);
  assert.equal(key("x"), false);
  allowed = false;
  const before = c.view.theta;
  assert.equal(key("ArrowLeft"), false);
  assert.equal(c.view.theta, before);
  delete (globalThis as { matchMedia?: unknown }).matchMedia;
});

test("the turn buttons orbit the view 15 degrees a press, round the same target (#307)", async () => {
  const { OrbitControls } = await import("./controls.ts");
  (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: false });
  const el = { addEventListener: () => {}, removeEventListener: () => {}, clientHeight: 100 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = new OrbitControls(el as any, {} as any, { change: () => {} } as any);
  c.view = FROM();
  c.nudge("turnLeft");
  assert.ok(Math.abs(c.goal.theta - Math.PI / 12) < 1e-9);
  c.nudge("turnLeft"); // presses add up from where the flight is headed
  assert.ok(Math.abs(c.goal.theta - Math.PI / 6) < 1e-9);
  c.nudge("turnRight");
  c.nudge("turnRight");
  c.nudge("turnRight");
  assert.ok(Math.abs(c.goal.theta + Math.PI / 12) < 1e-9);
  assert.deepEqual([c.goal.target.x, c.goal.target.y, c.goal.target.z], [5, 1, 5]);
  assert.equal(c.goal.radius, 16);
});
