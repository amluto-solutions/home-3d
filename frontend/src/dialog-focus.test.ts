import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { trapTab, wrapTab } from "./dialog-focus.ts";

// #196 (A11Y-7): a modal dialog keeps Tab inside itself and gives the focus back when it closes.

test("Tab wraps from the last control to the first, Shift+Tab from the first to the last", () => {
  const list = ["a", "b", "c"];
  assert.equal(wrapTab(list, "c", false, true), "a");
  assert.equal(wrapTab(list, "a", true, true), "c");
  // in the middle the browser moves on by itself
  assert.equal(wrapTab(list, "b", false, true), null);
  assert.equal(wrapTab(list, "b", true, true), null);
  // the focus outside the dialog (or on its box): into it
  assert.equal(wrapTab(list, null, false, false), "a");
  assert.equal(wrapTab(list, null, true, false), "c");
  // inside a component of the dialog that the list cannot see into: left to the browser
  assert.equal(wrapTab(list, "x", false, true), null);
  assert.equal(wrapTab([], null, false, false), null);
});

/** A dialog box with buttons, as trapTab sees it (no DOM in Node). */
function fakeDialog(n: number) {
  let active: unknown = null;
  const buttons = Array.from({ length: n }, (_, i) => ({
    id: i,
    disabled: i === 1 && n > 2, // the second of several is disabled: Tab skips it
    tabIndex: 0,
    getClientRects: () => [{}],
    closest: () => null,
    focus() {
      active = this;
    },
  }));
  const box = {
    querySelectorAll: () => buttons,
    contains: (el: unknown) => el === box || buttons.includes(el as never),
    getRootNode: () => ({ activeElement: active }),
    focus() {
      active = box;
    },
  };
  const press = (shiftKey = false) => {
    let prevented = false;
    trapTab({ key: "Tab", shiftKey, altKey: false, ctrlKey: false, metaKey: false, preventDefault: () => (prevented = true) } as unknown as KeyboardEvent, box as unknown as HTMLElement);
    return prevented;
  };
  return { buttons, box, press, get active() {
    return active;
  }, set active(v) {
    active = v;
  } };
}

test("trapTab keeps the focus in the dialog box", () => {
  const d = fakeDialog(3);
  d.active = d.box;
  assert.equal(d.press(), true);
  assert.equal(d.active, d.buttons[0]);
  // the last enabled control: Tab comes round to the first
  d.active = d.buttons[2];
  assert.equal(d.press(), true);
  assert.equal(d.active, d.buttons[0]);
  // Shift+Tab on the first goes to the last (the disabled one is skipped)
  assert.equal(d.press(true), true);
  assert.equal(d.active, d.buttons[2]);
  // the focus somewhere else on the page: back into the dialog
  d.active = { outside: true };
  assert.equal(d.press(), true);
  assert.equal(d.active, d.buttons[0]);
  // a dialog without controls keeps the focus on itself
  const empty = fakeDialog(0);
  assert.equal(empty.press(), true);
  assert.equal(empty.active, empty.box);
});

test("the modal dialogs are marked aria-modal and keep the focus (ask, help, wall view, pool part, rack, item editor)", () => {
  const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const ask = src("./components/ask-dialog.ts");
  assert.match(ask, /aria-modal="true"/);
  assert.match(ask, /trapTab\(e, e\.currentTarget/);
  for (const [file, cls] of [
    ["./components/editor/toolbar.ts", "fp3d-help-overlay"],
    ["./components/editor/wall-view.ts", 'class="fp3d-wv"'],
    ["./components/editor/pool.ts", 'class="fp3d-pc"'],
    ["./components/rack-sheet.ts", 'class="fp3d-rack-sheet"'],
    ["./items/item-editor.ts", 'class="ie"'],
  ] as const) {
    const line = src(file)
      .split("\n")
      .find((l) => l.includes(cls) && l.includes('role="dialog"'));
    assert.ok(line, `${file}: the dialog`);
    assert.match(line, /aria-modal="true"/, `${file}: aria-modal`);
    assert.match(line, /\$\{modalFocus\(\)\}/, `${file}: modalFocus`);
  }
});
