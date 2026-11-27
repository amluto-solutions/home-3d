// #550: a slider inside a pop-up's shadow root (quick menu, device pop-up, room panel, zoom view) keeps its drag; the
// house behind stays still. The host sees the pop-up as the target (retargeted), so the composed path decides.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";

const mk = () => {
  const l: Record<string, ((e: unknown) => void)[]> = {};
  return {
    l,
    addEventListener: (t: string, fn: (e: unknown) => void) => (l[t] ??= []).push(fn),
    removeEventListener: (t: string, fn: (e: unknown) => void) => (l[t] = (l[t] ?? []).filter((f) => f !== fn)),
    fire: (t: string, e: unknown) => (l[t] ?? []).forEach((f) => f(e)),
  };
};

/** An element as the guest code reads it: a tag, attributes, sizes; parentElement only inside its own shadow root. */
const node = (tagName: string, attrs: Record<string, string> = {}, extra: Record<string, unknown> = {}) => ({
  tagName,
  parentElement: null as unknown,
  scrollHeight: 10,
  clientHeight: 10,
  getAttribute: (k: string) => attrs[k] ?? null,
  hasAttribute: (k: string) => k in attrs,
  ...extra,
});

async function setup() {
  const { OrbitControls } = await import("./controls.ts");
  const win = mk();
  const host = { ...mk(), tagName: "DIV" };
  const el = { ...mk(), parentElement: host, setPointerCapture: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }), clientHeight: 100 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = new OrbitControls(el as any, { fov: 50 } as any, { tap() {}, doubleTap() {}, hold() {}, change() {} } as any);
  c.view = { target: new Vector3(), radius: 10, theta: 0, phi: 0.8 };
  return { c, win, host, el };
}

/** A pointer event whose target is retargeted to `popup` and whose composed path runs through the shadow root. */
const ptr = (type: string, x: number, path: unknown[], buttons = 1, id = 1) => ({
  pointerId: id,
  pointerType: type,
  clientX: x,
  clientY: 50,
  target: path.find((n) => (n as { tagName?: string }).tagName?.startsWith("FP3D-")) ?? path[0],
  composedPath: () => path,
  button: 0,
  buttons,
  timeStamp: performance.now(),
  altKey: false,
  shiftKey: false,
});

test("a slider inside a pop-up's shadow root does not turn the house, by touch or mouse (#550)", async () => {
  const g = globalThis as Record<string, unknown>;
  const saved = g.window;
  const win = mk();
  g.window = win;
  try {
    const s = { ...(await setup()), win };
    const shadow = { host: null }; // a ShadowRoot: no tagName
    const popup = node("FP3D-QUICK-MENU");
    const slider = node("INPUT", { type: "range" });
    const row = node("DIV");
    for (const type of ["touch", "mouse"]) {
      const path = [slider, row, shadow, popup, s.host];
      const t0 = s.c.view.theta;
      s.host.fire("pointerdown", ptr(type, 50, path));
      s.win.fire("pointermove", ptr(type, 90, path));
      s.win.fire("pointermove", ptr(type, 20, path));
      assert.equal(s.c.view.theta, t0, `${type}: dragging the blind's slider leaves the camera still`);
      s.win.fire("pointerup", ptr(type, 20, path));
    }
  } finally {
    g.window = saved;
  }
});

test("a drag on a pin or floor label still turns the house; a role=slider, a scrolling list and the zoom view do not (#550)", async () => {
  const g = globalThis as Record<string, unknown>;
  const saved = g.window;
  const win = mk();
  g.window = win;
  const savedStyle = g.getComputedStyle;
  g.getComputedStyle = (n: { overflowY?: string }) => ({ overflowY: n.overflowY ?? "visible" });
  try {
    const { c, host } = await setup();
    const drag = (path: unknown[]) => {
      const t0 = c.view.theta;
      host.fire("pointerdown", ptr("touch", 50, path));
      win.fire("pointermove", ptr("touch", 90, path));
      win.fire("pointermove", ptr("touch", 20, path));
      win.fire("pointerup", ptr("touch", 20, path));
      return c.view.theta !== t0;
    };
    // a floor label or a pin (in the 3D view's own tree): the house turns
    assert.equal(drag([node("DIV"), host]), true, "a label turns the house");
    // a pin's glass card drawn in a child's shadow root, no field in it: still the house
    assert.equal(drag([node("SPAN"), { host: null }, node("FP3D-PIN"), host]), true, "a pin turns the house");
    // the time bar's handle (role=slider)
    assert.equal(drag([node("DIV", { role: "slider" }), { host: null }, node("FP3D-TIME-BAR"), host]), false, "a role=slider keeps its drag");
    // a list that scrolls inside the room panel
    const list = node("DIV", {}, { scrollHeight: 400, clientHeight: 100, overflowY: "auto" });
    assert.equal(drag([node("DIV"), list, { host: null }, node("FP3D-ROOM-PANEL"), host]), false, "a scrolling list keeps its drag");
    // anywhere on the zoom view (its dimmed page included)
    assert.equal(drag([node("DIV"), { host: null }, node("FP3D-CARD-ZOOM", { "data-own-pointer": "" }), host]), false, "the zoom view keeps the house still");
    // the wheel over a pop-up's slider leaves the zoom alone
    const r0 = c.view.radius;
    const slider = node("INPUT");
    host.fire("wheel", { target: node("FP3D-QUICK-MENU"), composedPath: () => [slider, { host: null }, node("FP3D-QUICK-MENU"), host], deltaY: -100, deltaMode: 0, preventDefault() {}, timeStamp: performance.now(), clientX: 50, clientY: 50 });
    assert.equal(c.view.radius, r0, "the wheel over a pop-up's slider is left alone");
  } finally {
    g.window = saved;
    g.getComputedStyle = savedStyle;
  }
});

test("an element that took the pointer for itself is no guest: its drag never turns the house (#550)", async () => {
  const g = globalThis as Record<string, unknown>;
  const saved = g.window;
  const win = mk();
  g.window = win;
  try {
    const { c, host } = await setup();
    const panel = node("FP3D-FLOAT-PANEL");
    // a finger on the title text; the title bar takes the pointer, so the moves come to the bar
    const header = node("HEADER", {}, { hasPointerCapture: () => true });
    const title = node("H2");
    for (const type of ["touch", "mouse"]) {
      const t0 = c.view.theta;
      host.fire("pointerdown", ptr(type, 50, [title, header, { host: null }, panel, host]));
      win.fire("pointermove", ptr(type, 90, [header, { host: null }, panel, host]));
      win.fire("pointermove", ptr(type, 20, [header, { host: null }, panel, host]));
      assert.equal(c.view.theta, t0, `${type}: a captured drag (a panel's title bar) leaves the camera still`);
      win.fire("pointerup", ptr(type, 20, [header, { host: null }, panel, host]));
    }
    // a finger is always held by what it touched first (implicit capture): a pin still turns the house
    const pin = node("BUTTON", {}, { hasPointerCapture: () => true });
    const t1 = c.view.theta;
    host.fire("pointerdown", ptr("touch", 50, [pin, host]));
    win.fire("pointermove", ptr("touch", 90, [pin, host]));
    win.fire("pointermove", ptr("touch", 20, [pin, host]));
    assert.notEqual(c.view.theta, t1, "a finger held by its pin turns the house");
    win.fire("pointerup", ptr("touch", 20, [pin, host]));
  } finally {
    g.window = saved;
  }
});
