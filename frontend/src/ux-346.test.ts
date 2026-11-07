// Phone layout (#346): View and Cameras as full screen pages, the floor as a dropdown, one tidy bottom bar.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const after = (text: string, mark: string) => {
  const i = text.indexOf(mark);
  assert.ok(i >= 0, `missing: ${mark}`);
  return text.slice(i);
};

// 1. The View panel

test("the phone View panel is a full screen page with its Close button, no half height sheet (#346)", () => {
  const vp = src("./components/view-panel.ts");
  const phone = after(vp, "/* phones: a full screen page");
  assert.match(phone, /:host \{\s*inset: 0;/);
  assert.match(phone, /max-height: none;/);
  assert.doesNotMatch(vp, /max-height: 50%/);
  assert.doesNotMatch(vp, /sheetStep|view_sheet_/);
  assert.match(vp, /class="vp-close"[^>]*@click=\$\{\(\) => this\.emit\("view-close"\)\}/);
  // the time bar's lift of the floating panel does not apply to the page
  assert.match(after(src("./panel.ts"), "full screen page on a phone (#346)"), /\.fp3d-tt fp3d-view-panel \{\s*bottom: 0;/);
});

// 2. The camera wall

test("the phone camera wall is a full screen page and the bar's buttons step aside while it is open (#346)", () => {
  const v = src("./components/view3d.ts");
  const phone = after(v, "/* phones: the wall is a full screen page");
  assert.match(phone, /\.fp3d-wall \{\s*inset: 0;\s*height: auto;\s*z-index: 12;/);
  assert.doesNotMatch(v, /height: min\(60%, 420px\)/);
  const panel = src("./panel.ts");
  assert.match(panel, /\$\{this\._cameraWall && !tt \? "fp3d-cams-open" : ""\}/);
  assert.match(panel, /\.fp3d-cams-open \.fp3d-overlay \{\s*display: none;/);
  // Back closes it (#322)
  assert.match(panel, /row\("_cameraWall", "cameras"/);
});
