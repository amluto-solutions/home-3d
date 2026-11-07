// #420 (CONS-9, A11Y-5, CONS-7, HELP-3): on a phone the panel header is the sheet's title row (name once, lock, "⋯",
// Close; the grab bar sizes the sheet); list rows reach 44 px on touch with Delete behind a row menu; the item editor
// takes the page's look, keeps hints muted, has its actions in a header bar and labelled part fields in % of the item.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { makeEditor, square } from "./editor-harness.ts";

(globalThis as Record<string, unknown>).__FP3D_VIEWER_HASH__ ??= "test";

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

const car = { id: "car", type: "lamp_floor", name: "Nissan Leaf", x: 1, z: 1, rotation: 0, w: 0.4, d: 0.4, h: 1.6, variant: null, entity: null, power: null } as unknown as Furniture;

async function phone() {
  const el = await makeEditor([{ ...square("g", 0, 0, 5, 4), name: "Garage" }], [structuredClone(car)]);
  el._phone = true;
  el._sheeted = true;
  el._size = { w: 390, h: 640 };
  return el;
}
const headOf = (sheet: string) => sheet.slice(0, sheet.indexOf("fp3d-sheet-body"));

test("on a phone the item's own header is the sheet's title row: the name once, lock, more and Close in one row (#420, CONS-9)", async () => {
  const el = await phone();
  el.selectItem("furniture", "car");
  el.syncSheet();
  const sheet = flat(el.renderSheet(el.floor));
  const head = headOf(sheet);
  assert.match(head, /fp3d-sheet-own"><header[^]*<h2>Nissan Leaf<\/h2>[^]*fp3d-fix[^]*fp3d-item-more[^]*<\/header><button class="fp3d-btn fp3d-sheet-close"/);
  assert.equal(sheet.match(/<h2>Nissan Leaf</g)?.length, 1, "the name is a heading once in the whole sheet");
  assert.doesNotMatch(sheet.slice(sheet.indexOf("fp3d-sheet-body")), /fp3d-panel-head/, "no second header in the body");
  assert.doesNotMatch(head, /<b>Nissan Leaf<\/b>/);
});

test("the grab bar is the sheet's size button; there is no separate Expand / Shrink button (#420, CONS-9)", async () => {
  const el = await phone();
  el.selectItem("furniture", "car");
  el.syncSheet();
  assert.equal(el._sheet, "peek");
  const head = headOf(flat(el.renderSheet(el.floor)));
  assert.match(head, /<button type="button" class="fp3d-sheet-grab" aria-label=Details aria-expanded=false/);
  assert.doesNotMatch(head, /fp3d-sheet-size|>Expand panel<|>Shrink panel</);
  const css = readFileSync(new URL("./editor/styles/phone.ts", import.meta.url), "utf8");
  assert.match(css, /\.fp3d-sheet-grab \{[^}]*width: 96px;[^}]*height: 24px/);
  assert.match(css, /\.fp3d-sheet-own \.fp3d-icon-btn \{[^}]*min-height: 44px/);
});

test("the header's more menu pulls a peek sheet up to half, so the menu has room (#420)", async () => {
  const el = await phone();
  el.selectItem("furniture", "car");
  el.syncSheet();
  const head = el.renderPanelHeader({ id: "car", title: "Nissan Leaf", menu: [{ label: "Delete", run: () => undefined }] });
  // the menu button's click handler is the function before its icon
  const clicks: (() => void)[] = [];
  (function find(v: unknown) {
    if (v && typeof v === "object" && "strings" in (v as object)) {
      const r = v as { strings: readonly string[]; values: unknown[] };
      r.strings.forEach((s, i) => {
        const before = r.strings.slice(0, i + 1).join("");
        if (/@click=$/.test(s) && /<button[^<]*fp3d-item-more[^<]*$/.test(before) && typeof r.values[i] === "function") clicks.push(r.values[i] as () => void);
        if (i < r.values.length) find(r.values[i]);
      });
    } else if (Array.isArray(v)) v.forEach(find);
  })(head);
  assert.equal(clicks.length, 1);
  clicks[0]();
  assert.equal(el._sheet, "half");
});

test("a drawing tool keeps its own sheet title and hint (#420)", async () => {
  const el = await phone();
  el.phoneTool("wall");
  el.syncSheet();
  const head = headOf(flat(el.renderSheet(el.floor)));
  assert.match(head, /<b>Wall<\/b>/);
  assert.doesNotMatch(head, /fp3d-sheet-own/);
});

test("list rows are 44 px on touch and Delete sits behind the row menu (#420, A11Y-5)", async () => {
  const { ItemListView } = await import("./item-list-view.ts");
  const list = new ItemListView() as unknown as Record<string, any>;
  list.rows = [{ id: "a", name: "Sofa", hidden: false, selected: false }];
  list.editable = true;
  list.texts = { hide: "Hide", show: "Show", remove: "Delete", more: "More actions" };
  list.touch = true;
  const shut = flat(list.render());
  assert.match(shut, /--row-h:44px/);
  assert.doesNotMatch(shut, />✕</, "no delete button on the row");
  assert.doesNotMatch(shut, /role="menuitem"/);
  assert.match(shut, /class="icon more"[^>]*aria-label=More actions: Sofa[^>]*aria-haspopup="menu"/);
  list.toggleMenu("a");
  const open = flat(list.render());
  assert.match(open, /role="menu"[^]*role="menuitem"[^]*Delete/);
  const sent: string[] = [];
  list.dispatchEvent = (e: Event) => (sent.push(e.type), true);
  list.closeMenu(false);
  assert.doesNotMatch(flat(list.render()), /role="menu"/);
  list.touch = false;
  assert.match(flat(list.render()), /--row-h:32px/, "32 px with a mouse");
  assert.deepEqual(sent, []);
});

test("the item editor takes the look of the page that opened it (#420, CONS-7)", async () => {
  const { hostScheme } = await import("./ask-dialog.ts");
  const panel = { hasAttribute: (a: string) => a === "light", parentElement: null, getRootNode: () => ({}) };
  const card = { hasAttribute: () => false, parentElement: null, getRootNode: () => ({ host: panel }) };
  const button = { hasAttribute: () => false, parentElement: card, getRootNode: () => ({}) };
  assert.equal(hostScheme(button as unknown as Element), "light");
  assert.equal(hostScheme(null), null);
  const entry = readFileSync(new URL("../items/entry.ts", import.meta.url), "utf8");
  assert.match(entry, /toggleAttribute\("light", scheme === "light"\)/);
  assert.match(readFileSync(new URL("./extensions.ts", import.meta.url), "utf8"), /from: this,/);
});

test("the item editor: actions in the header bar, muted hints, the intro once, part fields with labels in % (#420, CONS-7, HELP-3)", async () => {
  const { ItemEditor, partPercent } = await import("../items/item-editor.ts");
  const el = new ItemEditor() as unknown as Record<string, any>;
  const en: Record<string, string> = { ie_px: "Left–right", ie_pz: "Front–back", ie_pw: "Width", ie_pd: "Depth", ie_py: "Bottom", ie_ph: "Height", ie_pct: "% of item", ie_intro: "INTRO" };
  el.options = { hass: { language: "en" }, t: (k: string) => en[k] ?? k, items: [], kinds: [], rooms: [], roles: ["wood"], changed: () => undefined };
  el._items = [];
  el._draft = { id: "stool", name: { en: "Stool" }, size: [0.3, 0.3, 0.45], parts: [{ shape: "box", x: -0.25, z: 0, w: 0.5, d: 1, y: 0, h: 0.125, color: "wood" }] };
  el._savedId = "stool";
  const text = flat(el.render());
  const header = text.slice(text.indexOf('<header class="ie-head">'), text.indexOf("</header>"));
  assert.match(header, /role="toolbar"[^]*ie_save[^]*ie_export[^]*ie_delete[^]*ie_close/, "Save, Export, Delete and Close in the header bar");
  assert.equal(text.match(/INTRO/g)?.length, 1, "the intro once");
  for (const label of ["Left–right", "Front–back", "Width", "Depth", "Bottom", "Height"]) assert.match(text, new RegExp(`class="ie-num"\\s*>${label}<`), label);
  assert.match(text, /aria-label=Left–right \(% of item\)/);
  assert.match(text, /class="ie-unit" aria-hidden="true">% of item</);
  assert.equal(partPercent(-0.25), -25);
  assert.equal(partPercent(0.125), 12.5);
  // its own rules (the shared tokens and controls come first)
  const css = (ItemEditor as unknown as { styles: { cssText: string }[] }).styles.at(-1)!.cssText;
  assert.match(css, /\.ie-sub \{[^}]*color: var\(--fp3d-muted\)/, "hints in the muted colour, not the link blue");
  assert.doesNotMatch(css, /color: var\(--fp3d-soft\)/);
  assert.doesNotMatch(css, /rgba\(255, 255, 255, 0\.04\)/, "inputs follow the look");
});

test("a part field typed in % is kept as the fraction of the item (#420, HELP-3)", async () => {
  const { ItemEditor } = await import("../items/item-editor.ts");
  const el = new ItemEditor() as unknown as Record<string, any>;
  el.options = { hass: { language: "en" }, t: (k: string) => k, items: [], kinds: [], rooms: [], roles: ["wood"], changed: () => undefined };
  const draft = { id: "stool", name: { en: "Stool" }, size: [0.3, 0.3, 0.45], parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood" }] };
  el._draft = draft;
  // the change handler of the first part field (x), found in the rendered part
  const part = el.renderPart(draft, draft.parts[0], 0);
  let handler: ((e: Event) => void) | null = null;
  (function find(v: unknown) {
    if (handler) return;
    if (v && typeof v === "object" && "strings" in (v as object)) {
      const r = v as { strings: readonly string[]; values: unknown[] };
      r.strings.forEach((s, i) => {
        if (!handler && /@change=$/.test(s) && /ie-unit-box/.test(r.strings.join("")) && typeof r.values[i] === "function") handler = r.values[i] as (e: Event) => void;
        if (i < r.values.length) find(r.values[i]);
      });
    } else if (Array.isArray(v)) v.forEach(find);
  })(part);
  assert.ok(handler);
  (handler as unknown as (e: Event) => void)({ target: { value: "-12.5" } } as unknown as Event);
  assert.equal(el._draft.parts[0].x, -0.125);
});
