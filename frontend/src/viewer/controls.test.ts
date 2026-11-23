import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import { BASE_FOV, keyView, lookFov, OrbitControls, stale } from "./controls.ts";

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

test("a furniture drag passes on one move per frame, the last one before the drop, and ends when capture is lost", async () => {
  const { OrbitControls } = await import("./controls.ts");
  const g = globalThis as Record<string, unknown>;
  const frames = new Map<number, () => void>();
  let next = 0;
  g.requestAnimationFrame = (fn: () => void) => (frames.set(++next, fn), next);
  g.cancelAnimationFrame = (id: number) => frames.delete(id);
  const runFrames = () => {
    const due = [...frames.values()];
    frames.clear();
    for (const fn of due) fn();
  };
  try {
    const handlers: Record<string, (e: unknown) => void> = {};
    const el = {
      addEventListener: (t: string, fn: (e: unknown) => void) => (handlers[t] = fn),
      removeEventListener: () => {},
      setPointerCapture: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      clientHeight: 100,
    };
    const log: string[] = [];
    const events = { tap() {}, doubleTap() {}, hold() {}, change() {}, grab: () => true, drag: (x: number) => log.push(`drag${x}`), drop: () => log.push("drop") };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new OrbitControls(el as any, {} as any, events as any);
    const ev = (x: number) => ({ pointerId: 1, button: 0, clientX: x, clientY: 5, pointerType: "mouse", timeStamp: performance.now(), altKey: false, shiftKey: false });
    handlers.pointerdown(ev(10));
    handlers.pointermove(ev(11));
    handlers.pointermove(ev(12));
    handlers.pointermove(ev(13));
    assert.deepEqual(log, [], "moves wait for the frame");
    assert.equal(frames.size, 1, "one frame asked for, not one per move");
    runFrames();
    assert.deepEqual(log, ["drag13"], "only the newest move of the frame");
    handlers.pointermove(ev(20));
    handlers.pointerup(ev(20));
    assert.deepEqual(log, ["drag13", "drag20", "drop"], "the last move goes before the drop");
    assert.equal(frames.size, 0, "no frame left over");
    // a second grab that loses its capture without a pointerup is dropped, not left stuck
    handlers.pointerdown(ev(30));
    handlers.pointermove(ev(31));
    handlers.lostpointercapture({ ...ev(31), type: "lostpointercapture" });
    assert.deepEqual(log.slice(3), ["drag31", "drop"]);
    // after the drop, moves turn nothing into drags
    handlers.pointermove(ev(40));
    runFrames();
    assert.equal(log.length, 5);
  } finally {
    delete g.requestAnimationFrame;
    delete g.cancelAnimationFrame;
  }
});

test("a drag move does not wait for a frame that never comes", async () => {
  const { OrbitControls } = await import("./controls.ts");
  const g = globalThis as Record<string, unknown>;
  g.requestAnimationFrame = () => 1; // frames stalled: the callback never runs
  g.cancelAnimationFrame = () => {};
  const realNow = performance.now.bind(performance);
  let now = 1000;
  performance.now = () => now;
  try {
    const handlers: Record<string, (e: unknown) => void> = {};
    const el = {
      addEventListener: (t: string, fn: (e: unknown) => void) => (handlers[t] = fn),
      removeEventListener: () => {},
      setPointerCapture: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      clientHeight: 100,
    };
    const log: string[] = [];
    const events = { tap() {}, doubleTap() {}, hold() {}, change() {}, grab: () => true, drag: (x: number) => log.push(`drag${x}`), drop: () => log.push("drop") };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new OrbitControls(el as any, {} as any, events as any);
    const ev = (x: number) => ({ pointerId: 1, button: 0, clientX: x, clientY: 5, pointerType: "mouse", timeStamp: now, altKey: false, shiftKey: false });
    handlers.pointerdown(ev(10));
    handlers.pointermove(ev(11));
    now += 50;
    handlers.pointermove(ev(12));
    assert.deepEqual(log, []);
    now += 100;
    handlers.pointermove(ev(13));
    assert.deepEqual(log, ["drag13"], "past the wait it goes at once");
  } finally {
    performance.now = realNow;
    delete g.requestAnimationFrame;
    delete g.cancelAnimationFrame;
  }
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

test("looking through a camera: a wall camera is about 90 degrees across, a dome wider, and back to 38 (#448)", () => {
  const wide = 16 / 9;
  const wall = lookFov(null, false, wide);
  // 90 degrees across on a 16:9 view is 2 atan(1 / 1.78) = 58.7 up and down
  assert.ok(Math.abs(wall - 58.7) < 0.2, `wall ${wall}`);
  assert.ok(lookFov(null, true, wide) > wall, "a dome sees wider");
  // the camera's own field counts; a 360 lens counts as unset
  assert.ok(lookFov(60, false, wide) < wall);
  assert.equal(lookFov(360, false, wide), wall);
  // never narrower than the view itself, never wider than 85
  assert.equal(lookFov(50, false, 4), BASE_FOV);
  assert.equal(lookFov(110, true, 0.3), 85);
  assert.equal(BASE_FOV, 38);
});

test("a saved flight keeps its angle under the 3D lock, an ordinary one does not (#448)", () => {
  const g = globalThis as { matchMedia?: unknown };
  const had = g.matchMedia;
  g.matchMedia = () => ({ matches: true });
  try {
    const mk = () => {
      const c = Object.create(OrbitControls.prototype) as OrbitControls;
      c.view = { target: new Vector3(), radius: 5, theta: 0.2, phi: 0.5 };
      c.angleLock = true;
      (c as unknown as { events: unknown }).events = { change() {} };
      return c;
    };
    const a = mk();
    a.flyTo({ theta: 1, phi: 1.2, radius: 3 }, 0);
    assert.equal(a.view.theta, 0.2);
    const b = mk();
    b.flyTo({ theta: 1, phi: 1.2, radius: 3 }, 0, true);
    assert.equal(b.view.theta, 1);
    assert.equal(b.view.phi, 1.2);
  } finally {
    g.matchMedia = had;
  }
});

test("fingers on a label, a pin or a card join a pinch; the element under a zooming finger is not tapped", async () => {
  const { OrbitControls } = await import("./controls.ts");
  const g = globalThis as Record<string, unknown>;
  const mk = () => {
    const l: Record<string, ((e: unknown) => void)[]> = {};
    return {
      l,
      addEventListener: (t: string, fn: (e: unknown) => void) => (l[t] ??= []).push(fn),
      removeEventListener: (t: string, fn: (e: unknown) => void) => (l[t] = (l[t] ?? []).filter((f) => f !== fn)),
      fire: (t: string, e: unknown) => (l[t] ?? []).forEach((f) => f(e)),
    };
  };
  const win = mk();
  const host = mk();
  const el = {
    ...mk(),
    parentElement: host,
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    clientHeight: 100,
  };
  const savedWindow = g.window;
  g.window = win;
  try {
    const view = { target: new Vector3(), radius: 10, theta: 0, phi: 0.8 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = new OrbitControls(el as any, { fov: 50 } as any, { tap() {}, doubleTap() {}, hold() {}, change() {} } as any);
    c.view = view;
    const label = { tagName: "DIV", parentElement: host, scrollHeight: 10, clientHeight: 10 };
    const field = { tagName: "INPUT", parentElement: host };
    const touch = (id: number, x: number, target: unknown) => ({ pointerId: id, pointerType: "touch", clientX: x, clientY: 50, target, button: 0, timeStamp: performance.now(), altKey: false, shiftKey: false });
    // a finger on a text field is left alone
    host.fire("pointerdown", touch(9, 10, field));
    el.fire("pointerdown", touch(1, 60, el));
    assert.equal(c.busy, true);
    win.fire("pointerup", touch(9, 10, field));
    el.fire("pointerup", touch(1, 60, el));
    // one finger on a label, one on the picture: a pinch
    host.fire("pointerdown", touch(2, 40, label));
    el.fire("pointerdown", touch(3, 60, el));
    const r0 = c.view.radius;
    win.fire("pointermove", touch(2, 20, label)); // guest moves apart
    el.fire("pointermove", touch(3, 80, el));
    assert.ok(c.view.radius < r0, "spreading the fingers zooms in");
    // the click of the element under the zooming finger is swallowed
    let stopped = false;
    host.fire("click", { stopPropagation: () => (stopped = true), preventDefault: () => {} });
    assert.equal(stopped, true, "the pinch made the label's click a non-tap");
  } finally {
    g.window = savedWindow;
  }
});

test("one finger that begins on a label turns the house; the wheel over a label zooms it (#1248, #1271)", async () => {
  const { OrbitControls } = await import("./controls.ts");
  const g = globalThis as Record<string, unknown>;
  const mk = () => {
    const l: Record<string, ((e: unknown) => void)[]> = {};
    return {
      l,
      addEventListener: (t: string, fn: (e: unknown) => void) => (l[t] ??= []).push(fn),
      removeEventListener: (t: string, fn: (e: unknown) => void) => (l[t] = (l[t] ?? []).filter((f) => f !== fn)),
      fire: (t: string, e: unknown) => (l[t] ?? []).forEach((f) => f(e)),
    };
  };
  const win = mk();
  const host = mk();
  const el = { ...mk(), parentElement: host, setPointerCapture: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }), clientHeight: 100 };
  const savedWindow = g.window;
  g.window = win;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = new OrbitControls(el as any, { fov: 50 } as any, { tap() {}, doubleTap() {}, hold() {}, change() {} } as any);
    c.view = { target: new Vector3(), radius: 10, theta: 0, phi: 0.8 };
    const label = { tagName: "DIV", parentElement: host, scrollHeight: 10, clientHeight: 10 };
    const field = { tagName: "INPUT", parentElement: host };
    const ptr = (type: string, x: number, target: unknown, buttons = 1) => ({ pointerId: 1, pointerType: type, clientX: x, clientY: 50, target, button: 0, buttons, timeStamp: performance.now(), altKey: false, shiftKey: false });
    for (const type of ["touch", "mouse"]) {
      // a small move is still a tap on the label
      const t0 = c.view.theta;
      host.fire("pointerdown", ptr(type, 50, label));
      win.fire("pointermove", ptr(type, 53, label));
      assert.equal(c.view.theta, t0, `${type}: a small move leaves the house`);
      // a longer one turns the house
      win.fire("pointermove", ptr(type, 90, label));
      win.fire("pointermove", ptr(type, 20, label));
      assert.notEqual(c.view.theta, t0, `${type}: a drag that begins on a label turns the house`);
      win.fire("pointerup", ptr(type, 20, label));
      // a text field keeps its own drag
      const t1 = c.view.theta;
      host.fire("pointerdown", ptr(type, 50, field));
      win.fire("pointermove", ptr(type, 90, field));
      assert.equal(c.view.theta, t1, `${type}: a field is left alone`);
      win.fire("pointerup", ptr(type, 90, field));
    }
    // the wheel over a label zooms; over a field it does not
    const r0 = c.view.radius;
    host.fire("wheel", { target: field, deltaY: -100, deltaMode: 0, preventDefault() {}, timeStamp: performance.now(), clientX: 50, clientY: 50 });
    assert.equal(c.view.radius, r0, "the wheel over a field is left alone");
    host.fire("wheel", { target: label, deltaY: -100, deltaMode: 0, preventDefault() {}, timeStamp: performance.now(), clientX: 50, clientY: 50 });
    assert.ok(c.view.radius < r0, "the wheel over a label zooms in");
  } finally {
    g.window = savedWindow;
  }
});
