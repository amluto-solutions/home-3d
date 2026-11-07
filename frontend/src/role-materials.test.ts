import assert from "node:assert/strict";
import { test } from "node:test";
import { MATERIALS, materialId, ownMaterial, roleMaterial, setRoleMaterial, usualMaterial } from "./role-materials.ts";

test("the six materials of the ticket: matt, gloss, fabric, glass, metal and rattan weave (#40)", () => {
  assert.deepEqual([...MATERIALS], ["matt", "gloss", "fabric", "glass", "metal", "rattan"]);
});

test("a role without a material of its own takes the usual one: fabric for fabric and cushions, metal, glass, gloss for white", () => {
  assert.equal(roleMaterial(null, "fabric"), "fabric");
  assert.equal(roleMaterial(undefined, "cushion"), "fabric");
  assert.equal(roleMaterial(null, "metal"), "metal");
  assert.equal(roleMaterial(null, "glass"), "glass");
  assert.equal(roleMaterial(null, "white"), "gloss");
  assert.equal(roleMaterial(null, "wood"), "matt");
  assert.equal(roleMaterial(null, "body"), "matt");
});

test("an item's own material per role wins; anything that is not a material falls back to the usual one", () => {
  assert.equal(roleMaterial({ fabric: "rattan" }, "fabric"), "rattan");
  assert.equal(roleMaterial({ fabric: "rattan" }, "cushion"), "fabric");
  assert.equal(roleMaterial({ wood: "velvet" as never }, "wood"), "matt");
});

test("setting a role's material keeps the others; clearing the last one leaves none at all", () => {
  const one = setRoleMaterial(null, "fabric", "rattan");
  assert.deepEqual(one, { fabric: "rattan" });
  const two = setRoleMaterial(one, "wood", "gloss");
  assert.deepEqual(two, { fabric: "rattan", wood: "gloss" });
  assert.deepEqual(one, { fabric: "rattan" }, "the old value is not changed");
  assert.deepEqual(setRoleMaterial(two, "fabric", null), { wood: "gloss" });
  assert.equal(setRoleMaterial({ wood: "gloss" }, "wood", null), null);
  assert.equal(setRoleMaterial({ wood: "gloss" }, "wood", "velvet" as never), null);
});

test("the shader's number per material: matt is 0 (what a surface without materials reads)", () => {
  assert.equal(materialId("matt"), 0);
  assert.deepEqual(
    MATERIALS.map((m) => materialId(m)),
    [0, 1, 2, 3, 4, 5],
  );
});

test("the item panel's choice per role: the item's own material, or none when it takes the usual one", () => {
  assert.equal(ownMaterial({ fabric: "rattan" }, "fabric"), "rattan");
  assert.equal(ownMaterial({ fabric: "rattan" }, "wood"), null);
  assert.equal(ownMaterial(null, "fabric"), null);
  assert.equal(usualMaterial("cushion"), "fabric");
  assert.equal(usualMaterial("accent"), "matt");
});
