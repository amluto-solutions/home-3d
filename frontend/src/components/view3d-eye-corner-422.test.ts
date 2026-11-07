import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// #422: with the search button gone from the stage (it moved to the header) the eye takes the bottom-left corner
const view = readFileSync(new URL("./view3d.ts", import.meta.url), "utf8");

test("the stage gets fp3d-no-find from the same test that hides the find button", () => {
  assert.match(view, /private findButtonShown\(\): boolean \{\s*return !!this\.building && !!this\.hass && !this\.findInBar;/);
  assert.match(view, /if \(!this\.findButtonShown\(\) \|\| !b\) return nothing;/);
  assert.match(view, /\$\{this\.findButtonShown\(\) \? "" : "fp3d-no-find"\}/);
});

test("without the find button the eye takes the corner, mirrored on the right", () => {
  assert.match(view, /\.fp3d-no-find \.fp3d-eye \{\s*left: 12px;/);
  assert.match(view, /\.fp3d-side-right\.fp3d-no-find \.fp3d-eye \{\s*left: auto;\s*right: 12px;/);
});

test("on the docked bar the eye sits at the dock corner and the star and its menu rise above it", () => {
  assert.match(view, /\.fp3d-no-find \.fp3d-eye \{\s*left: var\(--fp3d-dock-left, 12px\);/);
  assert.match(view, /\.fp3d-side-right\.fp3d-no-find \.fp3d-eye \{\s*left: auto;\s*right: var\(--fp3d-dock-left, 12px\);/);
  assert.match(view, /\.fp3d-no-find \.fp3d-central-btn \{\s*bottom: calc\(var\(--fp3d-dock-bottom[^;]*\+ 52px\);/);
  assert.match(view, /\.fp3d-no-find \.fp3d-central \{\s*bottom: calc\(var\(--fp3d-dock-menu[^;]*\+ 52px\);/);
});
