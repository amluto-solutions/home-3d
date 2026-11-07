import assert from "node:assert/strict";
import { test } from "node:test";
import { furnitureSize, isElectric, packItem, packsVersion, setPacks, setPlanRecipes, type FurniturePack, type PackItem, type PlanRecipe } from "./packs.ts";

// Plans keep a copy of each placed item's recipe (#2): the views draw the copy, whatever the installed packs say.

const chair = (size: [number, number, number], electric = false): PackItem => ({
  id: "chair",
  name: { en: "Chair" },
  size,
  electric,
  parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood" }],
});
const pack = (release: number, item: PackItem): FurniturePack => ({ id: "demo.pack", name: "Demo", publisher: "Demo", release, items: [item] });
const copyOf = (release: number, item: PackItem): PlanRecipe => ({ pack: "demo.pack", item: item.id, release, hash: `sha256:${release}`, recipe: item });
const TYPE = "pack:demo.pack:chair";

test("a placed item keeps looking the same when its pack is removed", () => {
  setPacks([pack(1, chair([0.5, 0.5, 0.9], true))]);
  setPlanRecipes({ [TYPE]: copyOf(1, chair([0.5, 0.5, 0.9], true)) });
  setPacks([]);
  assert.deepEqual(packItem(TYPE)?.size, [0.5, 0.5, 0.9]);
  assert.deepEqual(furnitureSize(TYPE), [0.5, 0.5, 0.9]);
  assert.equal(isElectric(TYPE), true);
  setPlanRecipes(undefined);
});

test("a newer release of the pack does not change the placed item: the plan's copy wins", () => {
  setPlanRecipes({ [TYPE]: copyOf(1, chair([0.5, 0.5, 0.9])) });
  setPacks([pack(2, chair([1.2, 0.6, 1]))]);
  assert.deepEqual(packItem(TYPE)?.size, [0.5, 0.5, 0.9]);
  // a plan without a copy of it (an older plan) draws the installed item
  setPlanRecipes(undefined);
  assert.deepEqual(packItem(TYPE)?.size, [1.2, 0.6, 1]);
  setPacks([]);
});

test("new copies count as new packs, so the views rebuild their pack furniture", () => {
  const before = packsVersion();
  setPlanRecipes({ [TYPE]: copyOf(1, chair([0.5, 0.5, 0.9])) });
  const after = packsVersion();
  assert.ok(after > before);
  // the same copies again (every edit hands the plan over) change nothing
  setPlanRecipes({ [TYPE]: copyOf(1, chair([0.5, 0.5, 0.9])) });
  assert.equal(packsVersion(), after);
  setPlanRecipes({ [TYPE]: copyOf(2, chair([0.6, 0.5, 0.9])) });
  assert.ok(packsVersion() > after);
  setPlanRecipes(undefined);
});
