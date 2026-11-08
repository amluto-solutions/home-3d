// Home 3D's own packs are amluto.*: the bundled folders are named so, and an item of the former core pack (#111)
// resolves to the pack it moved to.

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import type { Building } from "./model.ts";
import { migratePlanTypes, packInfo, resolvePackType, setPacks, type FurniturePack } from "./packs.ts";

const part = { shape: "box" as const, x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood" };

const living: FurniturePack = {
  id: "amluto.living",
  name: "Living",
  publisher: "Amluto Solutions",
  items: [{ id: "sofa", name: { en: "Sofa" }, size: [2, 0.9, 0.8], parts: [part] }],
};
// the moved-items table (an item of the former core pack, #111)
const kitchen: FurniturePack = {
  id: "amluto.kitchen-bath",
  name: "Kitchen & bath",
  publisher: "Amluto Solutions",
  aliases: { "pack:amluto.core:air_fryer": "air_fryer" },
  items: [{ id: "air_fryer", name: { en: "Air fryer" }, size: [0.3, 0.3, 0.3], parts: [part] }],
};

function plan(): Building {
  const furniture = (id: string, type: string) => ({ id, type, x: 0, z: 0, rotation: 0, w: 1, d: 1, h: 1, variant: null });
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
        furniture: [furniture("a", "pack:amluto.living:sofa"), furniture("b", "pack:amluto.core:air_fryer"), furniture("c", "sofa")],
      },
    ],
  } as unknown as Building;
}

test("an item of the former core pack resolves to the pack it moved to", () => {
  setPacks([living, kitchen]);
  assert.equal(resolvePackType("pack:amluto.core:air_fryer"), "pack:amluto.kitchen-bath:air_fryer");
  assert.equal(resolvePackType("pack:amluto.living:sofa"), "pack:amluto.living:sofa");
  assert.equal(packInfo("pack:amluto.core:air_fryer")?.id, "air_fryer");
  const moved = migratePlanTypes(plan());
  assert.deepEqual(
    moved.floors[0].furniture.map((f) => f.type),
    ["pack:amluto.living:sofa", "pack:amluto.kitchen-bath:air_fryer", "sofa"],
  );
  // nothing moved: the same object
  assert.equal(migratePlanTypes(moved), moved);
  setPacks([]);
});

test("every bundled pack folder is an amluto pack", () => {
  for (const dir of ["bundled_packs", "bundled_languages"]) {
    const folders = readdirSync(new URL(`../../custom_components/home_3d/${dir}/`, import.meta.url));
    assert.ok(folders.length > 0, dir);
    assert.deepEqual(folders.filter((f) => !f.startsWith("amluto.")), [], dir);
  }
});
