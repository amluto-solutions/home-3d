import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { editorSource } from "./components/editor-source.ts";

// #301: drawing by measure owns the side panel. The editor needs a browser, so these read its source.
const rooms = readFileSync(new URL("./components/editor/rooms.ts", import.meta.url), "utf8");
const side = readFileSync(new URL("./components/editor/side-panel.ts", import.meta.url), "utf8");
const form = rooms.slice(rooms.indexOf("  renderMeasureForm("), rooms.indexOf("  afterMeasureDraft("));

test("while measuring, the measure form is the only section (it returns before the floor settings)", () => {
  const early = side.indexOf('if (this._tool === "measure" && floor) return this.renderMeasureForm();');
  assert.ok(early > 0);
  assert.ok(early < side.indexOf("floor_settings_of"), "before the floor settings are rendered");
  assert.equal((side.match(/renderMeasureForm\(/g) ?? []).length, 1, "no second place renders it below the settings");
});

test("the form is a labelled section with a way back, the hint under the heading and the rectangle closed", () => {
  assert.match(form, /<section class="fp3d-measure" aria-labelledby="fp3d-measure-h">/);
  assert.match(form, /id="fp3d-measure-h"/);
  assert.ok(form.indexOf("fp3d-measure-back") < form.indexOf(`id="fp3d-measure-h"`));
  assert.ok(form.indexOf(`id="fp3d-measure-h"`) < form.indexOf("hint_measure"));
  assert.match(form, /this\.setTool\("select"\)/);
  assert.match(form, /this\.sideFold\("rect-size", "", false,/, "the rectangle is the shared fold, closed by default (#413)");
});

test("order: length box, arrow pad (labelled group, labelled buttons), gap, Close room, then the walls", () => {
  const at = (s: string) => form.indexOf(s);
  assert.ok(at("fp3d-measure-input") < at("fp3d-arrows"));
  assert.ok(at("fp3d-arrows") < at("fp3d-measure-gap"));
  assert.ok(at("fp3d-measure-gap") < at("measure_close"));
  assert.ok(at("measure_close") < at("fp3d-measure-list"));
  assert.ok(at("fp3d-measure-list") < at("rect-size"));
  assert.match(form, /class="fp3d-arrows" role="group" aria-label=/);
  assert.match(form, /aria-label=\$\{this\.t\("measure_add_wall"/);
  assert.match(form, /\?disabled=\$\{!first\}[\s\S]*placeholder/, "the length box waits for the start point");
  assert.match(form, /role="status" aria-live="polite"/);
});

test("the length box takes the focus when a point is added, once per point, never from another field", () => {
  const after = rooms.slice(rooms.indexOf("  afterMeasureDraft("));
  assert.match(after, /this\._draft\.length <= \(before\?\.length \?\? 0\)\) return;/, "only when the draft grew");
  assert.match(after, /\/\^\(INPUT\|TEXTAREA\|SELECT\)\$\/\.test\(active\.tagName\)\) return;/);
  assert.match(after, /input\.focus\(\{ preventScroll: true \}\)/);
  const editor = editorSource();
  assert.equal((editor.match(/afterMeasureDraft\(/g) ?? []).length, 2, "defined once, called once");
  assert.match(editor, /this\._tool === "measure" && changed\.has\("_draft"\)\) this\.afterMeasureDraft/, "on a change of the draft only, not on every render, and not on entering the tool");
});

test("the list of walls is capped and the arrows reach 44 px on touch", () => {
  const css = readFileSync(new URL("./components/editor/styles/side.ts", import.meta.url), "utf8");
  assert.match(css, /\.fp3d-measure-list \{[^}]*max-height: 120px;[^}]*overflow-y: auto/);
  assert.match(css, /@media \(pointer: coarse\) \{\s*\.fp3d-arrows \{[\s\S]*\.fp3d-arrows \.fp3d-btn \{[^}]*height: var\(--fp3d-touch, 44px\)/);
});
