// A layer owner that leaves takes its reopen closures out of the shared navigation state (#384).
import assert from "node:assert/strict";
import { test } from "node:test";
import { BackLayers } from "./back-stack.ts";

const openers = () => (globalThis as unknown as Record<string, { openers: Map<string, unknown> }>)["__fp3dBackStack"]?.openers;

test("closeAll removes the openers the owner set, not those of a newer owner of the same key (#384)", () => {
  const a = new BackLayers("t384");
  a.sync("sheet", false, () => undefined, () => undefined);
  a.sync("menu", false, () => undefined, () => undefined);
  const o = openers();
  assert.ok(o, "the shared state exists");
  assert.ok(o.has("t384:sheet") && o.has("t384:menu"));
  // a newer owner (the same scope) took the "menu" key over
  const b = new BackLayers("t384");
  b.sync("menu", false, () => undefined, () => undefined);
  a.closeAll();
  assert.equal(o.has("t384:sheet"), false);
  assert.equal(o.has("t384:menu"), true, "the newer owner keeps its opener");
  b.closeAll();
  assert.equal(o.has("t384:menu"), false);
});
