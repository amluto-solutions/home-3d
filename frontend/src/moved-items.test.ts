// Items that moved between packs (#110): the library lists the old ids of the items that moved into a pack
// (`aliases`), so an old id still resolves in the browser, and an imported plan takes the new ids.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Building } from "./model.ts";
import { furnitureSize, migratePlanTypes, missingRecipes, packInfo, packItem, resolvePackType, setPacks, type FurniturePack } from "./packs.ts";

const part = { shape: "box" as const, x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood" };

const living: FurniturePack = {
  id: "test.living",
  name: "Living",
  publisher: "Test",
  aliases: { "pack:test.core:sofa": "sofa", "pack:test.core:lamp": "reading_lamp" },
  items: [
    { id: "sofa", name: { en: "Sofa" }, size: [2, 0.9, 0.8], parts: [part] },
    { id: "reading_lamp", name: { en: "Reading lamp" }, size: [0.3, 0.3, 1.5] },
  ],
};

function plan(): Building {
  const furniture = (id: string, type: string, extra: object = {}) => ({ id, type, x: 0, z: 0, rotation: 0, w: 1, d: 1, h: 1, variant: null, ...extra });
  return {
    version: 1,
    settings: { wall_exterior: 0.24, wall_interior: 0.12, grid: 0.05 },
    floors: [
      {
        id: "f1",
        name: "Ground",
        elevation: 0,
        height: 2.5,
        cut_height: 1.15,
        rooms: [],
        openings: [],
        placements: [],
        background: null,
        furniture: [
          furniture("a", "pack:test.core:sofa"),
          furniture("b", "pack:test.core:lamp"),
          furniture("c", "sofa"),
          furniture("p", "parking", { vehicle: "pack:test.core:sofa", types: [{ state: "x", vehicle: "pack:test.core:lamp" }] }),
        ],
      },
    ],
    recipes: {
      "pack:test.core:lamp": { pack: "test.core", item: "lamp", release: 4, hash: "sha256:old", recipe: { id: "lamp", name: { en: "Lamp" }, size: [0.2, 0.2, 1], parts: [part] } },
    },
  } as unknown as Building;
}

test("an old id resolves to the item that moved", () => {
  setPacks([living]);
  assert.equal(resolvePackType("pack:test.core:lamp"), "pack:test.living:reading_lamp");
  assert.equal(resolvePackType("pack:test.living:sofa"), "pack:test.living:sofa");
  assert.equal(resolvePackType("sofa"), "sofa");
  assert.equal(packInfo("pack:test.core:lamp")?.id, "reading_lamp");
  assert.deepEqual(furnitureSize("pack:test.core:sofa"), [2, 0.9, 0.8]);
  assert.equal(packItem("pack:test.core:sofa")?.id, "sofa");
  // an old id whose item has no recipe yet asks the new pack for it
  assert.deepEqual([...missingRecipes(["pack:test.core:lamp"])], [["test.living", ["reading_lamp"]]]);
  setPacks([]);
  assert.equal(resolvePackType("pack:test.core:lamp"), "pack:test.core:lamp");
});

test("an imported plan from before a move takes the new ids, with its recipe copies", () => {
  setPacks([living]);
  const moved = migratePlanTypes(plan());
  const types = moved.floors[0].furniture.map((f) => [f.type, f.vehicle ?? null, (f.types ?? []).map((t) => t.vehicle)]);
  assert.deepEqual(types, [
    ["pack:test.living:sofa", null, []],
    ["pack:test.living:reading_lamp", null, []],
    ["sofa", null, []],
    ["parking", "pack:test.living:sofa", ["pack:test.living:reading_lamp"]],
  ]);
  // the plan's own copy moves with the item (the backend checks it again and computes its hash)
  const copy = moved.recipes!["pack:test.living:reading_lamp"];
  assert.deepEqual([copy.pack, copy.item, copy.recipe.id, copy.release], ["test.living", "reading_lamp", "reading_lamp", 1]);
  assert.deepEqual(copy.recipe.size, [0.2, 0.2, 1]);
  assert.equal(moved.recipes!["pack:test.core:lamp"], undefined);
  // a plan without moved items stays the very same object
  const fresh = migratePlanTypes(moved);
  assert.equal(fresh, moved);
  setPacks([]);
});

test("an old id that a pack still offers stays that pack's item", () => {
  const core: FurniturePack = { id: "test.core", name: "Core", publisher: "Test", items: [{ id: "sofa", name: { en: "Old sofa" }, size: [1, 1, 1], parts: [part] }] };
  setPacks([core, living]);
  assert.equal(packInfo("pack:test.core:sofa")?.name.en, "Old sofa");
  // a plan still migrates to the new id (as the backend does)
  assert.equal(resolvePackType("pack:test.core:sofa"), "pack:test.living:sofa");
  assert.equal(resolvePackType("pack:test.core:lamp"), "pack:test.living:reading_lamp");
  setPacks([]);
});

test("gear in a rack takes the new ids of moved items (#123)", () => {
  setPacks([living]);
  const base = plan();
  base.floors[0].furniture = [
    { id: "r", type: "network_rack", x: 0, z: 0, rotation: 0, w: 0.6, d: 0.6, h: 2, variant: null, rack: { slots: [{ id: "s1", type: "pack:test.core:lamp", u: 1 }, { id: "s2", type: "sofa", u: 3 }] } },
  ] as unknown as Building["floors"][0]["furniture"];
  const moved = migratePlanTypes(base);
  assert.deepEqual(moved.floors[0].furniture[0].rack?.slots.map((s) => s.type), ["pack:test.living:reading_lamp", "sofa"]);
  assert.ok(moved.recipes!["pack:test.living:reading_lamp"]);
  // nothing moved: the same object
  assert.equal(migratePlanTypes(moved), moved);
  setPacks([]);
});
