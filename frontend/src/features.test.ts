import assert from "node:assert/strict";
import { test } from "node:test";
import { released, UNRELEASED } from "./features.ts";

test("no feature gate: everything whose code is here is released, only the pool stays behind the lab switch", () => {
  assert.deepEqual([...UNRELEASED], ["pool"]);
  for (const f of ["diagnostics", "locate", "fun_pets", "fun_halloween", "fun_seasons"] as const) assert.equal(released(f), true, f);
  assert.equal(released("pool"), false);
});

test("a pack that still lists features loads and unlocks nothing", async () => {
  const { setPacks, getPacks } = await import("./packs.ts");
  setPacks([{ id: "test.old", name: "Old", items: [], features: ["pool", "household", "teleport"] } as never]);
  assert.equal(getPacks().length, 1);
  assert.equal(released("pool"), false);
  setPacks([]);
});
