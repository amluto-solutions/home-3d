// The solar card on a phone (#545): a tap grows it, a tap on the grown card opens the zoom view (its zoom button is
// small on a phone). A mouse still grows it on hover and folds it on a click; the card's own buttons stop their taps.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("a tap on the grown solar card opens the zoom view; the first tap grows it (#545)", () => {
  const src = readFileSync(new URL("./view3d.ts", import.meta.url), "utf8");
  const at = src.indexOf("private renderHoloCard(");
  const body = src.slice(at, src.indexOf("\n  private ", at + 10));
  assert.ok(body.includes(`if (press !== "mouse") return this._holoBig ? this.zoomTo(card) : this.growHolo(true, index, true);`));
  assert.ok(src.includes("@click=${(e: Event) => (stop(e), this.zoomTo(card))}"), "the zoom button stops its tap");
});
