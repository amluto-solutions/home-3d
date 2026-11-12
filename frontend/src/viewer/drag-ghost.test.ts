// The group-drag freeze (Intel Arc, Chrome): every drag move disposed the ghost's material and made a new one, so
// three.js deleted the line shader and linked it again per pointer move (601 links in a 600-move drag), with new GPU
// buffers each time, until the page's frames stopped. These pin the fix in viewer3d.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = readFileSync(new URL("./viewer3d.ts", import.meta.url), "utf8");
const body = (name: string) => {
  const at = src.indexOf(`  private ${name}(`);
  assert.ok(at > 0, name);
  return src.slice(at, src.indexOf("\n  }\n", at));
};

test("a drag move shifts the ghost; it never rebuilds it or makes a material", () => {
  const drag = body("dragFurniture");
  assert.match(drag, /this\.moveGhost\(\)/);
  assert.doesNotMatch(drag, /updateGhost|new LineBasicMaterial|dispose\(/);
});

test("the ghost keeps one material and writes over its buffers when the number of lines is the same", () => {
  const ghost = body("updateGhost");
  assert.match(ghost, /this\.ghostMat \?\?= new LineBasicMaterial/);
  assert.doesNotMatch(ghost, /material as Material\)\.dispose|ghostMat\.dispose/);
  assert.match(ghost, /pos\.count \* 3 === lines\.p\.length/);
});

test("invalidate asks again for a frame that never came", () => {
  const at = src.indexOf("  invalidate(): void {");
  const inv = src.slice(at, src.indexOf("\n  }\n", at));
  assert.match(inv, /performance\.now\(\) - this\.frameAskedAt < FRAME_LOST_MS/);
  assert.match(inv, /cancelAnimationFrame\(this\.frame\)/);
  assert.doesNotMatch(inv, /if \(this\.frame \|\|/);
});
