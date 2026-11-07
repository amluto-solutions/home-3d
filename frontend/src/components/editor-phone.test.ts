import assert from "node:assert/strict";
import { test } from "node:test";

// the editor's bundle hashes are build-time constants: plain strings will do here
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: { styles: { cssText: string }[] } };

/** The editor's styles, whitespace squeezed. */
const css = Fp3dEditor.styles
  .map((s) => s.cssText)
  .join("\n")
  .replace(/\s+/g, " ");

/** The declarations of the first rule whose selector list starts with `selector`. */
function rule(selector: string): string {
  const i = Math.min(...[`${selector} {`, `${selector}, `].map((s) => css.indexOf(s)).filter((n) => n >= 0));
  assert.ok(Number.isFinite(i), `${selector} has a rule`);
  return css.slice(i, css.indexOf("}", i));
}

// The phone editor (#250) replaced the squeezed desktop layout of #94 (a toolbar wrapping to three rows, the panel
// under the plan, a "draw on a PC or tablet" banner): its rules are classes the editor sets from the phone width.

test("on a phone the plan fills the screen between the header and the bottom bar (no page scroll, no wrapping toolbar)", () => {
  const phone = rule(".fp3d-editor.fp3d-phone");
  assert.match(phone, /grid-template-rows: minmax\(0, 1fr\) auto/);
  assert.match(phone, /height: 100%/);
  assert.match(phone, /overflow: hidden/);
  // the toolbar row is not drawn: its floor menu is a chip, its menus open above the bar
  assert.match(rule(".fp3d-phone > .fp3d-toolbar"), /display: contents/);
  assert.match(rule(".fp3d-phone .fp3d-seg-floor"), /position: absolute; top: 8px; left: 16px/);
  assert.match(rule(".fp3d-phone .fp3d-seg-tools .fp3d-menu"), /bottom: var\(--fp3d-bar-h\)/);
});

test("the bar keeps clear of the safe area (16 px at least, as the HA app on Android often reports 0)", () => {
  const phone = rule(".fp3d-editor.fp3d-phone");
  assert.match(phone, /--fp3d-bar-h: 76px; --fp3d-bar-h: calc\(60px \+ max\(16px, env\(safe-area-inset-bottom, 0px\)/);
});

test("the bar steps aside while the keyboard is up or something is moved on the plan", () => {
  assert.match(rule(".fp3d-phone.fp3d-typing > fp3d-phone-bar"), /display: none/);
  assert.match(rule(":host([data-dragging]) .fp3d-phone > fp3d-phone-bar"), /visibility: hidden/);
});

test("the details sheet has peek, half and full heights, sits above the bar and respects reduced motion", () => {
  assert.match(rule(".fp3d-editor.fp3d-sheeted > .fp3d-sheet"), /bottom: var\(--fp3d-bar-h\)/);
  assert.match(rule('.fp3d-sheeted > .fp3d-sheet[data-sheet="half"]'), /height: 50%/);
  assert.match(rule('.fp3d-sheeted > .fp3d-sheet[data-sheet="full"]'), /height: calc\(100% - var\(--fp3d-bar-h\) - 8px\)/);
  assert.match(rule('.fp3d-sheet[data-sheet="peek"] > .fp3d-sheet-body'), /display: none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.fp3d-editor\.fp3d-sheeted > \.fp3d-sheet/);
});

test("the 'works best on a PC or tablet' banner is gone: a phone edits everything now (owner, #219)", () => {
  assert.doesNotMatch(css, /fp3d-phone-hint/);
});
