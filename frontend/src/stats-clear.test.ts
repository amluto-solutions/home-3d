import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// #241: the FPS stats line keeps clear of the round buttons in the bottom corner (search, hide, star)
const css = readFileSync(new URL("./components/view3d.ts", import.meta.url), "utf8");

test("the stats line reserves the button column on either side and wraps (#241)", () => {
  const rule = css.match(/\.fp3d-stats \{[^}]*\}/)?.[0] ?? "";
  assert.match(rule, /max-width: calc\(100% - (\d+)px\)/);
  const reserved = Number(/calc\(100% - (\d+)px\)/.exec(rule)![1]);
  // the widest button column: hide button at 62 px + 44 px on a phone, 10 px gutter
  assert.ok(reserved >= 62 + 44 + 10, "the reserved width covers the buttons");
  assert.match(css, /\.fp3d-side-right \.fp3d-stats \{\s*right: (\d+)px/);
  const side = Number(/\.fp3d-side-right \.fp3d-stats \{\s*right: (\d+)px/.exec(css)![1]);
  assert.ok(side >= 56 + 44 + 10, "with the controls on the right the line moves left of them");
});
