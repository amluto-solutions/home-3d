// The zoom view on a phone (#546): upright, the card fills the width and its curve or artwork takes the height left.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("in the zoom view, upright, the card fills the width and its curve or artwork takes the height left (#546)", () => {
  const src = readFileSync(new URL("./card-zoom.ts", import.meta.url), "utf8");
  assert.ok(src.includes(`const tall = h > w * 1.25;`));
  assert.ok(src.includes(`card.querySelector<HTMLElement>(".fp3d-holo-curve, .fp3d-holo-cover")`));
  assert.ok(src.includes(`fp3d-card-zoom[tall] .fp3d-holo-curve circle { display: none; }`), "a stretched curve hides its end dot");
});
