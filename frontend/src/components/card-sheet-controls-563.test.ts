// #563: on a narrow card the star button stood over the room panel's sheet. The view's corner controls now lie under
// the sheet; where the panel app lifts them above it, nothing overlaps and nothing changes.
import assert from "node:assert/strict";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { styles: unknown } };
const css = (() => {
  const s = Fp3dView3d.styles as { cssText?: string } | { cssText?: string }[];
  return (Array.isArray(s) ? s : [s]).map((x) => x.cssText ?? "").join("\n");
})();

/** Every `@container` block that starts with `head`, joined. */
function blocks(text: string, head: string): string {
  let out = "";
  for (let i = text.indexOf(head); i >= 0; i = text.indexOf(head, i + 1)) {
    let depth = 0;
    for (let j = text.indexOf("{", i); j < text.length; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}" && --depth === 0) {
        out += text.slice(i, j + 1);
        break;
      }
    }
  }
  return out;
}

const RULE = /\.fp3d-panel-open :is\(\.fp3d-central-btn, \.fp3d-eye, \.fp3d-mic, \.fp3d-mic-say\) \{\s*z-index: 1;/;

test("a room's sheet lies over the star, the eye and the microphone (#563)", () => {
  // the panel's z-index is 2; the buttons have 3 and 4 of their own
  assert.match(blocks(css, "@container fp3d ((max-width: 700px) or ((orientation: portrait) and (max-width: 1000px)))"), RULE);
});

test("beside a panel at the side the buttons keep their own layer (#563)", () => {
  assert.equal(css.match(new RegExp(RULE, "g"))?.length, 1);
});
