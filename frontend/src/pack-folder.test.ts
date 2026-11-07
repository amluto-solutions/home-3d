import assert from "node:assert/strict";
import { test } from "node:test";
import { planPackFolders } from "./pack-folder.ts";

test("a picked pack folder becomes one pack: pack.json and its item files, paths relative to the folder", () => {
  const plans = planPackFolders(["amluto.bedroom/pack.json", "amluto.bedroom/seating/stool.json", "amluto.bedroom/tables/side_table.json"]);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].root, "amluto.bedroom");
  assert.deepEqual(Object.fromEntries(plans[0].files), {
    "pack.json": "amluto.bedroom/pack.json",
    "seating/stool.json": "amluto.bedroom/seating/stool.json",
    "tables/side_table.json": "amluto.bedroom/tables/side_table.json",
  });
  assert.deepEqual(plans[0].refused, []);
});

test("a picked repository with a folder per pack becomes several packs; readme, licence and git files stay behind", () => {
  const plans = planPackFolders([
    "home-3d-packs/README.md",
    "home-3d-packs/LICENSE",
    "home-3d-packs/.git/config",
    "home-3d-packs/.github/workflows/check.json",
    "home-3d-packs/amluto.bedroom/pack.json",
    "home-3d-packs/amluto.bedroom/LICENSE",
    "home-3d-packs/amluto.bedroom/sofa.json",
    "home-3d-packs/amluto.ikea-uk/pack.json",
    "home-3d-packs/amluto.ikea-uk/README.md",
    "home-3d-packs/amluto.ikea-uk/storage/billy.json",
  ]);
  assert.deepEqual(
    plans.map((p) => [p.root, [...p.files.keys()].sort(), p.refused]),
    [
      ["home-3d-packs/amluto.bedroom", ["pack.json", "sofa.json"], []],
      ["home-3d-packs/amluto.ikea-uk", ["pack.json", "storage/billy.json"], []],
    ],
  );
});

test("pictures, code and other files in a pack folder are refused: packs are data only", () => {
  const [plan] = planPackFolders(["p/pack.json", "p/chair.json", "p/chair.png", "p/module.js"]);
  assert.deepEqual([...plan.files.keys()].sort(), ["chair.json", "pack.json"]);
  assert.deepEqual(plan.refused, ["chair.png", "module.js"]);
});

test("a folder without a pack.json holds no pack", () => {
  assert.deepEqual(planPackFolders(["photos/a.json", "photos/b.png"]), []);
});
