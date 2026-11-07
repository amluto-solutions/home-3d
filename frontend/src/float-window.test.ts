// The camera wall as a free window (#314): geometry, clamping inside the view, remembered place, reset, phone sheet,
// and the readable active buttons.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import { clampRect, dragRect, parseRect, WALL_RECT_KEY, WallWindow, type WindowHost } from "./float-window.ts";

const stage = { w: 1000, h: 600 };

function fakeEl(rect = { x: 12, y: 380, w: 976, h: 208 }, parent = { clientWidth: 1000, clientHeight: 600 }) {
  const attrs = new Set<string>();
  const el = {
    style: { left: "", top: "", right: "", bottom: "", width: "", height: "" },
    offsetLeft: rect.x,
    offsetTop: rect.y,
    offsetWidth: rect.w,
    offsetHeight: rect.h,
    offsetParent: parent,
    toggleAttribute: (n: string, f?: boolean) => {
      if (f === false) attrs.delete(n);
      else attrs.add(n);
      return attrs.has(n);
    },
    attrs,
  };
  return el as typeof el & WindowHost;
}
const ptr = (x: number, y: number, target: unknown = {}) => ({ button: 0, clientX: x, clientY: y, pointerId: 1, target, currentTarget: {}, preventDefault() {} }) as unknown as PointerEvent;

let mem: Record<string, string>;
beforeEach(() => {
  mem = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => void (mem[k] = v),
    removeItem: (k: string) => void delete mem[k],
  };
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

test("moving and resizing: a window stays inside the view and above the minimum size", () => {
  const start = { x: 100, y: 100, w: 400, h: 300 };
  assert.deepEqual(clampRect(dragRect(start, "move", -9999, -9999), stage), { x: 8, y: 8, w: 400, h: 300 });
  assert.deepEqual(clampRect(dragRect(start, "move", 9999, 9999), stage), { x: 592, y: 292, w: 400, h: 300 });
  assert.deepEqual(dragRect(start, "se", -999, -999), { x: 100, y: 100, w: 260, h: 200 }, "minimum 260x200");
  assert.deepEqual(dragRect(start, "nw", 50, 40), { x: 150, y: 140, w: 350, h: 260 }, "the far edge stays put");
  assert.deepEqual(dragRect(start, "nw", 999, 999), { x: 240, y: 200, w: 260, h: 200 });
  assert.deepEqual(clampRect({ x: 0, y: 0, w: 5000, h: 5000 }, stage), { x: 8, y: 8, w: 984, h: 584 }, "never larger than the view");
});

test("stored rectangles are read defensively", () => {
  assert.deepEqual(parseRect('{"x":1,"y":2,"w":300,"h":250}'), { x: 1, y: 2, w: 300, h: 250 });
  for (const bad of [null, "x", '{"x":1}', '{"x":"1","y":2,"w":3,"h":4}', '{"x":1,"y":2,"w":0,"h":4}']) assert.equal(parseRect(bad), null);
});

test("position and size are saved on release and restored when the wall opens again", () => {
  const w = new WallWindow();
  const a = fakeEl();
  w.attach(a);
  assert.equal(a.style.left, "", "nothing stored: the stylesheet's default dock");
  w.begin(ptr(500, 390), "move");
  w.move(ptr(400, 300));
  w.end();
  const saved = parseRect(mem[WALL_RECT_KEY]);
  assert.deepEqual(saved, { x: 8, y: 290, w: 976, h: 208 });
  // a real element reports where it now stands
  Object.assign(a, { offsetLeft: 8, offsetTop: 290, offsetWidth: 976, offsetHeight: 208 });
  w.begin(ptr(0, 0), "se");
  w.move(ptr(-300, -100));
  w.end();
  assert.deepEqual(parseRect(mem[WALL_RECT_KEY]), { x: 8, y: 290, w: 676, h: 200 });
  // the wall closes and opens again: a new element gets the saved place
  w.attach(null);
  const b = fakeEl();
  const w2 = new WallWindow();
  w2.attach(b);
  assert.equal(b.style.left, "8px");
  assert.equal(b.style.top, "290px");
  assert.equal(b.style.width, "676px");
  assert.equal(b.style.height, "200px");
  assert.ok(b.attrs.has("data-free"));
});

test("a saved window that no longer fits is pulled back inside the view", () => {
  mem[WALL_RECT_KEY] = JSON.stringify({ x: 900, y: 500, w: 800, h: 700 });
  const w = new WallWindow();
  const el = fakeEl();
  w.attach(el);
  const r = parseRect(JSON.stringify(w.rect))!;
  assert.ok(r.x >= 8 && r.y >= 8 && r.x + r.w <= 992 && r.y + r.h <= 592, JSON.stringify(r));
  // the browser window shrinks
  el.offsetParent = { clientWidth: 500, clientHeight: 400 };
  w.settle();
  assert.ok(w.rect!.x + w.rect!.w <= 492 && w.rect!.y + w.rect!.h <= 392, JSON.stringify(w.rect));
});

test("a double click on the header resets to the default and forgets the place", () => {
  mem[WALL_RECT_KEY] = JSON.stringify({ x: 50, y: 50, w: 400, h: 300 });
  const w = new WallWindow();
  const el = fakeEl();
  w.attach(el);
  assert.equal(el.style.left, "50px");
  w.reset();
  assert.equal(el.style.left, "");
  assert.equal(el.style.width, "");
  assert.equal(mem[WALL_RECT_KEY], undefined);
  assert.ok(!el.attrs.has("data-free"));
});

test("buttons in the header do not start a drag; a phone sheet is not moved; the old dock key is dropped", () => {
  const w = new WallWindow();
  w.attach(fakeEl());
  const btn = { closest: (s: string) => (s.includes("button") ? {} : null) };
  w.begin(ptr(10, 10, btn), "move");
  w.move(ptr(200, 200));
  w.end();
  assert.equal(mem[WALL_RECT_KEY], undefined);

  mem["home3d.camera_wall_dock"] = "left";
  mem[WALL_RECT_KEY] = JSON.stringify({ x: 50, y: 50, w: 400, h: 300 });
  const phone = new WallWindow(() => true);
  const el = fakeEl();
  phone.attach(el);
  assert.equal(el.style.left, "", "a sheet keeps the stylesheet's full width place");
  phone.begin(ptr(0, 0), "move");
  phone.move(ptr(99, 99));
  phone.end();
  assert.equal(el.style.left, "");
  assert.equal(mem["home3d.camera_wall_dock"], undefined);
});

test("storage failures just mean nothing is remembered", () => {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  const w = new WallWindow();
  const el = fakeEl();
  w.attach(el);
  w.begin(ptr(0, 0), "move");
  w.move(ptr(10, 10));
  assert.doesNotThrow(() => w.end());
  assert.doesNotThrow(() => w.reset());
});

test("active buttons keep dark text on the fill: the Cameras button and no accent-on-accent in the wall (#314)", () => {
  const panel = readFileSync(new URL("./panel.ts", import.meta.url), "utf8");
  const rule = panel.match(/\.fp3d-cam-btn\[aria-pressed="true"\]\s*\{([^}]*)\}/)![1];
  assert.match(rule, /background:\s*var\(--fp3d-primary\)/);
  assert.match(rule, /color:\s*var\(--fp3d-primary-text\)/);
  assert.doesNotMatch(rule, /color:\s*var\(--fp3d-accent\)/);
  const view = readFileSync(new URL("./components/view3d.ts", import.meta.url), "utf8");
  assert.doesNotMatch(view, /fp3d-wall-dock/, "the dock buttons are gone");
});

test("the wall's stored size is its whole box, so a window clamped to the view stays inside it", () => {
  const src = readFileSync(new URL("./components/view3d.ts", import.meta.url), "utf8");
  const rule = src.match(/.fp3d-wall {[^}]*}/)?.[0] ?? "";
  assert.match(rule, /box-sizing: border-box/);
});
