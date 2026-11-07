import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { editorSource } from "./components/editor-source.ts";

const css = readFileSync(new URL("./styles.ts", import.meta.url), "utf8");

test("links and file labels drawn as buttons centre their text like buttons (#236)", () => {
  assert.match(css, /a\.fp3d-btn,\s*label\.fp3d-btn \{[^}]*display: inline-flex;[^}]*align-items: center/);
});

test("buttons under a hint line or a form have room above them (#236)", () => {
  assert.match(css, /\.fp3d-sub \+ \.fp3d-actions[^{]*\{\s*margin-top: 12px/);
  assert.match(css, /\.fp3d-form \+ \.fp3d-actions \{\s*margin-top: 12px/);
});

test("the floor shift has a title, X and Z on one row, then the Shift button (#236)", () => {
  const src = editorSource();
  const i = src.indexOf('class="fp3d-field fp3d-wide fp3d-shift"');
  const block = src.slice(i, i + 2600);
  const title = block.indexOf('floor_shift"');
  const xz = block.indexOf("fp3d-shift-xz");
  const apply = block.indexOf("floor_shift_apply");
  assert.ok(title > -1 && title < xz && xz < apply, "title, then the X / Z row, then Shift");
  assert.ok(block.indexOf('aria-label="Z"') < apply);
});
