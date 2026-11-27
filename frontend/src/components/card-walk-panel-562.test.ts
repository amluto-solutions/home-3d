// #562: on a wide card the Walk button lay over the room panel's close button. Beside a side panel it now stands left of
// it; a sheet dragged up over the corner covers it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { walkRightFor } from "../card-config.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { styles: unknown } };
const css = (() => {
  const s = Fp3dView3d.styles as { cssText?: string } | { cssText?: string }[];
  return (Array.isArray(s) ? s : [s]).map((x) => x.cssText ?? "").join("\n");
})();

test("the Walk button stands left of a room panel at the side (#562)", () => {
  // the sizes measured on a 1360 px card: the panel is 340 px wide, 10 px from the right edge
  assert.equal(walkRightFor([], 1360, 1010), 358);
  assert.equal(walkRightFor([1312], 1360, 1010), 358, "the full screen button lies under the panel");
  assert.equal(walkRightFor([], 701, 351), 358, "the narrowest card with a side panel");
});

test("a sheet at the bottom, or no panel, leaves the Walk button in its corner (#562)", () => {
  assert.equal(walkRightFor([], 390, 8), 12);
  assert.equal(walkRightFor([342], 390, 8), 56, "still beside the full screen button");
  assert.equal(walkRightFor([], 1000, 8), 12, "the sheet of a portrait tablet");
  assert.equal(walkRightFor([], 1360, null), 12);
});

test("the card measures its room panel for the Walk button (#562)", () => {
  const card = readFileSync(new URL("../card.ts", import.meta.url), "utf8");
  assert.match(card, /querySelector<HTMLElement>\("\.fp3d-card-panel"\)/);
  assert.match(card, /walkRightFor\(.*, view\.clientWidth, panel\?\.offsetLeft \?\? null\)/);
});

test("an open room panel lies over the Walk button, never under it (#562)", () => {
  // the panel's z-index is 2; the phone rule gives the button 5, so this rule needs the stronger selector
  assert.match(css, /\.fp3d-panel-open \.fp3d-walk-btn \{\s*z-index: 1;/);
});
