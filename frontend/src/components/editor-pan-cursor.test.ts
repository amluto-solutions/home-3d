import assert from "node:assert/strict";
import { test } from "node:test";
import { editorSource } from "./editor-source.ts";

// #233: the plan shows a grab cursor where a drag pans it, and grabbing while it does
test("the plan has grab and grabbing cursors", () => {
  const src = editorSource();
  assert.match(src, /svg\.fp3d-tool-select,[\s\S]*?cursor: grab;/);
  assert.match(src, /fp3d-panning \*[\s\S]*?cursor: grabbing/);
  assert.match(src, /classList\?\.toggle\("fp3d-panning", on\)/);
});
