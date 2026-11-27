// #549: on a phone the energy values all show (a second row, not a row that scrolls them out of sight), and the Walk
// button is in the top right corner unless the card's own buttons are there.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { walkRightFor, WALK_CORNER } from "../card-config.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { styles: unknown } };
const css = (() => {
  const s = Fp3dView3d.styles as { cssText?: string } | { cssText?: string }[];
  return (Array.isArray(s) ? s : [s]).map((x) => x.cssText ?? "").join("\n");
})();

/** The rules inside the first `@container` block that starts with `head`. */
function block(text: string, head: string): string {
  const i = text.indexOf(head);
  assert.ok(i >= 0, head);
  let depth = 0;
  for (let j = text.indexOf("{", i); j < text.length; j++) {
    if (text[j] === "{") depth++;
    else if (text[j] === "}" && --depth === 0) return text.slice(i, j + 1);
  }
  return "";
}

test("the Walk button sits in the corner without card buttons, and just past them when they are there (#549)", () => {
  assert.equal(WALK_CORNER, 12);
  assert.equal(walkRightFor([], 360), 12, "no card buttons: the corner on a phone");
  assert.equal(walkRightFor([360 - 10 - 38], 360), 56, "a fullscreen button: beside it");
  const card = readFileSync(new URL("../card.ts", import.meta.url), "utf8");
  assert.match(card, /fp3d-view3d \{\s*--fp3d-walk-right: 12px;/);
});

test("narrow stages wrap the energy values into another row instead of scrolling them out of sight (#549)", () => {
  const narrow = block(css, "@container fp3d (max-width: 900px)");
  assert.doesNotMatch(narrow, /\.fp3d-energy \{[^}]*overflow-x: auto/);
  assert.doesNotMatch(narrow, /flex-wrap: nowrap/);
  const phone = block(css, "@container fp3d (max-width: 600px)");
  assert.doesNotMatch(phone, /\.fp3d-energy \{[^}]*nowrap/);
  // the values still stop before the Walk button when no floor tabs take its row
  assert.match(narrow, /\.fp3d-stage:has\(> \.fp3d-walk-btn\) > \.fp3d-energy \{/);
});

test("the heat legend and a clock at the top stand below energy values that wrapped (#549)", () => {
  assert.match(css, /\.fp3d-legend \{\s*bottom: auto;\s*top: max\(70px, calc\(var\(--fp3d-energy-end, 0px\) \+ 8px\)\);/);
  assert.match(css, /\.fp3d-clock-tl,\s*\.fp3d-clock-tr \{\s*top: max\(64px, calc\(var\(--fp3d-energy-end, 0px\) \+ 8px\)\);/);
  const src = readFileSync(new URL("./view3d.ts", import.meta.url), "utf8");
  assert.match(src, /--fp3d-energy-end:\$\{this\._energyEnd\}px;/);
});
