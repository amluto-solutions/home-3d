import { test } from "node:test";
import assert from "node:assert/strict";
import { shadowWanted } from "./sun-fx.ts";

test("the house shadow shows for the whole house and for the one floor of a one-floor house (#1196, #488)", () => {
  assert.equal(shadowWanted(null, 2, "sig"), true);
  assert.equal(shadowWanted("eg", 1, "sig"), true);
  assert.equal(shadowWanted("eg", 2, "sig"), false);
  assert.equal(shadowWanted(null, 2, ""), false);
});
