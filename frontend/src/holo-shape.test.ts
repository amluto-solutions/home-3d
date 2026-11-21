import assert from "node:assert/strict";
import { test } from "node:test";
import { holoShape } from "./holo-shape.ts";

test("the shape of the cards changes when a card comes or goes, not when only its content does", () => {
  const a = holoShape([{ kind: "main" }, { kind: "module" }, { kind: "bin" }]);
  assert.equal(a, "main,module,bin");
  assert.notEqual(holoShape([{ kind: "main" }, { kind: "bin" }]), a);
  assert.equal(holoShape([{ kind: "main" }, { kind: "module" }, { kind: "bin" }]), a);
  assert.equal(holoShape([]), "");
});
