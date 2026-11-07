// #421: the editor's side panel moves by its header like the View panel (FloatDrag, #265): the place is kept per device
// ("home3d.float.editor-side"), double-click and the snap-back button put it back, it settles inside the editor when the
// window changes size, and phones keep the bottom sheet. The editor runs in plain Node here: the side panel's <aside> is
// a small stand-in with a box, a style and attributes.

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, square, type TestEditor } from "./editor-harness.ts";
import type { Fp3dEditor } from "./editor.ts";
import { resetSideDrag, settleSideDrag, SIDE_DRAG_NAME, sideDrag, sideDragHandle, syncSideDrag, forgetSideDrag } from "./editor/side-drag.ts";

// a storage for this test file (Node has no usable localStorage without a file)
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) },
});
const KEY = `home3d.float.${SIDE_DRAG_NAME}`;

/** An <aside> docked at the right of a 1280 x 800 editor: 320 wide, under the 52 px toolbar. */
function aside(stage = { left: 0, top: 0, right: 1280, bottom: 800 }) {
  const attrs = new Set<string>();
  const el = {
    style: { translate: "" },
    stage,
    offsetParent: { getBoundingClientRect: () => el.stage },
    getBoundingClientRect() {
      const [x, y] = el.style.translate ? el.style.translate.split(" ").map((v) => parseFloat(v)) : [0, 0];
      // floating it is as tall as its content (400 px); docked it fills the column
      const h = attrs.has("data-floating") ? 400 : 748;
      return { left: 960 + x, top: 52 + y, right: 1280 + x, bottom: 52 + h + y, width: 320, height: h };
    },
    toggleAttribute: (n: string, on: boolean) => void (on ? attrs.add(n) : attrs.delete(n)),
    setAttribute: (n: string) => void attrs.add(n),
    removeAttribute: (n: string) => void attrs.delete(n),
    hasAttribute: (n: string) => attrs.has(n),
  };
  return el;
}

async function editorWith(el: ReturnType<typeof aside>): Promise<TestEditor & Fp3dEditor> {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  const svg = ed.renderRoot.querySelector("svg");
  Object.defineProperty(ed, "renderRoot", { value: { querySelector: (sel: string) => (sel.startsWith("aside") ? el : svg), querySelectorAll: () => [], activeElement: null }, configurable: true });
  const attrs = new Set<string>();
  Object.assign(ed, { setAttribute: (n: string) => attrs.add(n), removeAttribute: (n: string) => attrs.delete(n), hasAttribute: (n: string) => attrs.has(n) });
  return ed as unknown as TestEditor & Fp3dEditor;
}

const pointer = (x: number, y: number, target: object = { closest: () => null }) => {
  const e = { button: 0, clientX: x, clientY: y, pointerId: 1, target, currentTarget: { setPointerCapture() {} }, defaultPrevented: false, preventDefault: () => (e.defaultPrevented = true) };
  return e as unknown as PointerEvent;
};

test("a stored place is read per device and the panel stands there, floating over the plan (#421)", async () => {
  store.clear();
  store.set(KEY, JSON.stringify({ x: -500, y: 40 }));
  const el = aside();
  const ed = await editorWith(el);
  syncSideDrag(ed);
  assert.deepEqual(sideDrag(ed)?.offset, { x: -500, y: 40 });
  assert.equal(el.style.translate, "-500px 40px");
  assert.ok(el.hasAttribute("data-floating"), "it floats over the plan");
  forgetSideDrag(ed);
});

test("dragging by the header moves the panel, keeps the place for this device, and the plan does not take the pointer (#421)", async () => {
  store.clear();
  const el = aside();
  const ed = await editorWith(el);
  syncSideDrag(ed);
  const h = sideDragHandle(ed);
  h.down(pointer(1100, 70));
  assert.ok(ed.hasAttribute("data-panel-drag"), "the plan and 3D pane are off while dragging");
  h.move(pointer(700, 120));
  assert.deepEqual(sideDrag(ed)?.offset, { x: -400, y: 50 });
  assert.equal(store.get(KEY), undefined, "kept once the drag ends");
  h.up();
  assert.deepEqual(JSON.parse(store.get(KEY)!), { x: -400, y: 50 });
  assert.ok(!ed.hasAttribute("data-panel-drag"));
  // a second visit (a new aside) stands at the same place
  const again = aside();
  const ed2 = await editorWith(again);
  syncSideDrag(ed2);
  assert.equal(again.style.translate, "-400px 50px");
  forgetSideDrag(ed);
  forgetSideDrag(ed2);
});

test("buttons in the header keep their own clicks: no drag starts on them (#421)", async () => {
  store.clear();
  const el = aside();
  const ed = await editorWith(el);
  syncSideDrag(ed);
  const h = sideDragHandle(ed);
  const onButton = pointer(1250, 70, { closest: (sel: string) => (sel.includes("button") ? {} : null) });
  h.down(onButton);
  assert.equal(onButton.defaultPrevented, false, "the button keeps the press (and the keyboard focus stays where it was)");
  h.move(pointer(900, 300));
  assert.equal(sideDrag(ed)?.offset, null);
  forgetSideDrag(ed);
});

test("double-click and the snap-back button put the panel back and forget the place (#421)", async () => {
  store.clear();
  store.set(KEY, JSON.stringify({ x: -300, y: 20 }));
  const el = aside();
  const ed = await editorWith(el);
  syncSideDrag(ed);
  // the navigation row shows the snap-back button while the panel is moved
  const flat = (v: unknown): string => {
    if (Array.isArray(v)) return v.map(flat).join("");
    if (v && typeof v === "object" && "strings" in v) {
      const t = v as unknown as { strings: readonly string[]; values: unknown[] };
      return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
    }
    return typeof v === "string" ? v : "";
  };
  assert.match(flat(ed.renderNavRow(null, true)), /fp3d-side-snap" aria-label=Put the panel back in its place/);
  sideDragHandle(ed).dblclick({ target: { closest: () => null } } as unknown as MouseEvent);
  assert.equal(sideDrag(ed)?.offset, null);
  assert.equal(el.style.translate, "");
  assert.ok(!el.hasAttribute("data-floating"), "docked again: the plan gives the column back");
  assert.equal(store.has(KEY), false);
  assert.doesNotMatch(flat(ed.renderNavRow(null, true)), /fp3d-side-snap/);
  store.set(KEY, JSON.stringify({ x: -300, y: 20 }));
  forgetSideDrag(ed);
  syncSideDrag(ed);
  resetSideDrag(ed);
  assert.equal(store.has(KEY), false, "the button's reset forgets it too");
  forgetSideDrag(ed);
});

test("a smaller window settles the moved panel back inside the editor (#421)", async () => {
  store.clear();
  store.set(KEY, JSON.stringify({ x: -900, y: 300 }));
  const el = aside();
  const ed = await editorWith(el);
  syncSideDrag(ed);
  assert.deepEqual(sideDrag(ed)?.offset, { x: -900, y: 300 });
  el.stage = { left: 0, top: 0, right: 1280, bottom: 600 };
  settleSideDrag(ed);
  const box = el.getBoundingClientRect();
  assert.ok(box.bottom <= 600 - 8 + 0.5, `inside the shorter editor (${box.bottom})`);
  forgetSideDrag(ed);
});

test("phones keep the bottom sheet: no drag, nothing moved (#421)", async () => {
  store.clear();
  store.set(KEY, JSON.stringify({ x: -300, y: 20 }));
  const el = aside();
  const ed = await editorWith(el);
  syncSideDrag(ed);
  assert.ok(sideDrag(ed));
  ed._phone = true;
  ed.narrow = true;
  syncSideDrag(ed);
  assert.equal(sideDrag(ed), null);
  assert.equal(el.style.translate, "", "the sheet stands where the stylesheet puts it");
  const h = sideDragHandle(ed);
  const e = pointer(100, 500);
  h.down(e);
  assert.equal(e.defaultPrevented, false, "a press on the sheet's header does not start a drag");
  forgetSideDrag(ed);
});

test("the shared header and the navigation row are the drag handles; the styles float a moved panel and switch the plan off while dragging (#421)", async () => {
  const { readFileSync } = await import("node:fs");
  const head = readFileSync(new URL("./editor/panel-head.ts", import.meta.url), "utf8");
  assert.match(head, /@pointerdown=\$\{drag\.down\}[\s\S]*@dblclick=\$\{drag\.dblclick\}/);
  const shell = readFileSync(new URL("./editor/styles/shell.ts", import.meta.url), "utf8");
  assert.match(shell, /aside\.fp3d-side\[data-floating\] \{[^}]*position: absolute/);
  assert.match(shell, /:host\(\[data-panel-drag\]\) \.fp3d-stage-pair \{\s*pointer-events: none/);
  assert.match(shell, /\.fp3d-drag-handle \{[^}]*touch-action: none/);
});
