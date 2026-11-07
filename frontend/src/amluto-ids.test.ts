// Home 3D's own packs were renamed from theovencook.* to amluto.* (#424): an old id names the same pack under its new
// id in the browser too (plans, imported files, favourites and recent lists), and the table's moves follow.

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import type { Building } from "./model.ts";
import { migratePlanTypes, packInfo, renamedPackId, renamedPackType, resolvePackType, setPacks, type FurniturePack } from "./packs.ts";

const part = { shape: "box" as const, x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood" };

const living: FurniturePack = {
  id: "amluto.living",
  name: "Living",
  publisher: "Amluto Solutions",
  items: [{ id: "sofa", name: { en: "Sofa" }, size: [2, 0.9, 0.8], parts: [part] }],
};
// the moved-items table names the new ids (an item of the former core pack, #111)
const kitchen: FurniturePack = {
  id: "amluto.kitchen-bath",
  name: "Kitchen & bath",
  publisher: "Amluto Solutions",
  aliases: { "pack:amluto.core:air_fryer": "air_fryer" },
  items: [{ id: "air_fryer", name: { en: "Air fryer" }, size: [0.3, 0.3, 0.3], parts: [part] }],
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
          furniture("a", "pack:theovencook.living:sofa"),
          furniture("b", "pack:theovencook.core:air_fryer"),
          furniture("c", "sofa"),
          furniture("r", "network_rack", { rack: { slots: [{ id: "s1", type: "pack:theovencook.it:patch_panel", u: 1 }] } }),
        ],
      },
    ],
    recipes: {
      "pack:theovencook.living:sofa": { pack: "theovencook.living", item: "sofa", release: 4, hash: "sha256:old", recipe: { id: "sofa", name: { en: "Sofa" }, size: [2, 0.9, 0.8], parts: [part] } },
    },
  } as unknown as Building;
}

test("an old pack id or type names the amluto one", () => {
  assert.equal(renamedPackId("theovencook.lang-de"), "amluto.lang-de");
  assert.equal(renamedPackId("amluto.living"), "amluto.living");
  assert.equal(renamedPackId("acme.theovencook"), "acme.theovencook");
  assert.equal(renamedPackType("pack:theovencook.living:sofa"), "pack:amluto.living:sofa");
  // a library key of a mirrored card keeps its ending
  assert.equal(renamedPackType("pack:theovencook.living:sofa#m"), "pack:amluto.living:sofa#m");
  assert.equal(renamedPackType("sofa"), "sofa");
  assert.equal(renamedPackType("pack:acme.chairs:theovencook.x"), "pack:acme.chairs:theovencook.x");
});

test("an old id resolves to the final amluto item, also through a move, with no packs loaded", () => {
  setPacks([]);
  assert.equal(resolvePackType("pack:theovencook.living:sofa"), "pack:amluto.living:sofa");
  setPacks([living, kitchen]);
  assert.equal(resolvePackType("pack:theovencook.core:air_fryer"), "pack:amluto.kitchen-bath:air_fryer");
  assert.equal(packInfo("pack:theovencook.living:sofa")?.id, "sofa");
  assert.equal(packInfo("pack:theovencook.core:air_fryer")?.id, "air_fryer");
  setPacks([]);
});

test("a plan or backup file with old ids takes the amluto ids, with its recipe copies", () => {
  setPacks([living, kitchen]);
  const moved = migratePlanTypes(plan());
  assert.deepEqual(
    moved.floors[0].furniture.map((f) => f.type),
    ["pack:amluto.living:sofa", "pack:amluto.kitchen-bath:air_fryer", "sofa", "network_rack"],
  );
  assert.equal(moved.floors[0].furniture[3].rack?.slots[0].type, "pack:amluto.it:patch_panel");
  const copy = moved.recipes!["pack:amluto.living:sofa"];
  assert.deepEqual([copy.pack, copy.item, copy.recipe.id], ["amluto.living", "sofa", "sofa"]);
  assert.equal(moved.recipes!["pack:theovencook.living:sofa"], undefined);
  // nothing old left: the same object
  assert.equal(migratePlanTypes(moved), moved);
  setPacks([]);
  // with no packs loaded (the table is not known yet) the rename still applies
  assert.equal(migratePlanTypes(plan()).floors[0].furniture[0].type, "pack:amluto.living:sofa");
});

test("no bundled pack folder keeps a theovencook id", () => {
  for (const dir of ["bundled_packs", "bundled_languages"]) {
    const folders = readdirSync(new URL(`../../custom_components/home_3d/${dir}/`, import.meta.url));
    assert.ok(folders.length > 0, dir);
    assert.deepEqual(folders.filter((f) => !f.startsWith("amluto.")), [], dir);
  }
});
