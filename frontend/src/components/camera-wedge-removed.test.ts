import { test } from "node:test";
import assert from "node:assert/strict";
import { englishTable } from "../i18n.ts";
import { editorSource } from "./editor-source.ts";

// #182: the 3D view lost its camera wedges in #137; the 2D editor must not draw them either.
// the editor is editor.ts plus its modules under editor/ (#202)
const editor = editorSource();

test("the 2D editor draws no camera wedge and has no wedge aim handle", () => {
  assert.doesNotMatch(editor, /renderCameraWedge/);
  assert.doesNotMatch(editor, /fp3d-wedge/);
  assert.doesNotMatch(editor, /data-aim/);
  assert.doesNotMatch(editor, /camera_aim_hint/);
});

test("the wedge-only hint text is gone", () => {
  assert.equal("camera_aim_hint" in englishTable(), false);
});
