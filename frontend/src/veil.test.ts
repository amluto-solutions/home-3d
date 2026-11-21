import assert from "node:assert/strict";
import { test } from "node:test";
import { veilClick } from "./veil.ts";

test("a dialog closes on the veil only when the press began there too", () => {
  const veil = new EventTarget();
  const dialog = new EventTarget();
  assert.equal(veilClick(veil, veil, veil), true);
  assert.equal(veilClick(veil, veil, null), true, "unknown press: as before");
  assert.equal(veilClick(veil, veil, dialog), false, "pressed inside, let go outside: no close");
  assert.equal(veilClick(dialog, veil, dialog), false);
  assert.equal(veilClick(dialog, veil, veil), false);
});
