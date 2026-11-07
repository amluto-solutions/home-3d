// The item panel's parts (#410, #411): names by part (vehicle paint first), presets and finishes per part family.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { COLOUR_PRESETS, itemColourRoles, type ColourRole } from "./colour-roles.ts";
import { familyPresets, partFamily, partFinishes, partName, partOrder, presetKey, type PartFamily } from "./colour-parts.ts";
import { PART_NAMES } from "./item-format.ts";
import { englishTable } from "./i18n.ts";
import { de } from "./german.fixture.ts";
import { FURNITURE_TYPES } from "./model.ts";
import { packRoleNames, setPacks, type FurniturePack, type PackItem } from "./packs.ts";
import { usualMaterial } from "./role-materials.ts";

const en = englishTable() as Record<string, string>;
const deTable = de as Record<string, string>;
const BUNDLED = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs", import.meta.url));

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

/** Every bundled furniture pack, as the backend sends it. */
function bundledPacks(): FurniturePack[] {
  return readdirSync(BUNDLED)
    .map((name) => join(BUNDLED, name))
    .filter((dir) => statSync(dir).isDirectory())
    .map((dir) => {
      const meta = JSON.parse(readFileSync(join(dir, "pack.json"), "utf8"));
      const items = filesIn(dir)
        .filter((p) => p.endsWith(".json") && !p.endsWith("pack.json"))
        .map((p) => JSON.parse(readFileSync(p, "utf8")) as PackItem);
      return { ...meta, items } as FurniturePack;
    });
}

/** What the panel shows for a part, in English. */
const shown = (type: string, role: ColourRole) => en[`part_${partName(type, role, itemColourRoles(type))}`];

/** Colour words: a part named only by one of them says nothing about which part it is (WORD-1). */
const COLOUR_WORDS = new Set(["white", "dark", "black", "grey", "gray", "light", "accent", "red", "blue", "green", "silver", "colour", "color"]);

const DEMO: FurniturePack = {
  id: "demo.parts",
  name: "Parts",
  publisher: "Demo",
  items: [
    {
      id: "hatch",
      name: { en: "Hatch" },
      size: [1.8, 4, 1.5],
      vehicle: true,
      parts: (["dark", "metal", "glass", "white", "paint"] as const).map((color) => ({ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 0.2, color })),
    },
    {
      id: "rad",
      name: { en: "Radiator" },
      size: [1, 0.1, 0.6],
      role_names: { white: "panels", metal: "valves", accent: "nope" },
      parts: (["white", "metal", "accent"] as const).map((color) => ({ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 0.2, color })),
    },
  ],
} as unknown as FurniturePack;

test("parts are named by what they are: the pack's names, a vehicle's parts, else the material or Main/Second/Third colour (#411)", () => {
  setPacks([DEMO]);
  const car = "pack:demo.parts:hatch";
  assert.deepEqual(
    partOrder(itemColourRoles(car)).map((r) => shown(car, r)),
    ["Paint", "Details", "Wheels", "Tyres and trim", "Windows"],
    "a vehicle: Paint first, then its other parts",
  );
  const rad = "pack:demo.parts:rad";
  assert.equal(shown(rad, "white"), "Panels");
  assert.equal(shown(rad, "metal"), "Valves");
  assert.equal(shown(rad, "accent"), "Details", "a name the list does not know falls back");
  // built-in items: the colour-word roles take Main colour, Second colour, Third colour in turn; materials keep theirs
  assert.deepEqual(itemColourRoles("kitchen").map((r) => shown("kitchen", r)), ["Main colour", "Second colour", "Third colour"]);
  assert.deepEqual(itemColourRoles("radiator").map((r) => shown("radiator", r)), ["Main colour", "Metal"]);
  assert.deepEqual(itemColourRoles("sofa").map((r) => shown("sofa", r)), ["Fabric", "Cushions", "Wood"]);
  assert.deepEqual(itemColourRoles("robot_vacuum").map((r) => shown("robot_vacuum", r)), ["Main colour", "Details"]);
  setPacks([]);
});

test("the paint row comes first; the other parts keep their order (#411)", () => {
  assert.deepEqual(partOrder(["dark", "metal", "paint", "glass"]), ["paint", "dark", "metal", "glass"]);
  assert.deepEqual(partOrder(["fabric", "wood"]), ["fabric", "wood"]);
});

test("no part of any bundled or built-in item is shown by a colour word only (#411, WORD-1)", () => {
  const packs = bundledPacks();
  setPacks(packs);
  const bad: string[] = [];
  let seen = 0;
  const check = (type: string) => {
    for (const role of itemColourRoles(type)) {
      seen++;
      const text = shown(type, role);
      if (!text) bad.push(`${type} ${role}: no text`);
      else if (text.toLowerCase().split(/\s+/).every((w) => COLOUR_WORDS.has(w))) bad.push(`${type} ${role}: "${text}"`);
    }
  };
  for (const pack of packs) for (const item of pack.items) check(`pack:${pack.id}:${item.id}`);
  for (const type of FURNITURE_TYPES) check(type);
  assert.ok(seen > 1000, `checked ${seen} parts`);
  assert.deepEqual(bad, []);
  setPacks([]);
});

test("a bundled item's role_names name only roles it uses, with names from the list (#411)", () => {
  const packs = bundledPacks();
  let named = 0;
  for (const pack of packs)
    for (const item of pack.items) {
      if (!item.role_names) continue;
      named++;
      const used = new Set((item.parts ?? []).flatMap((p) => [p.color, p.top]));
      for (const [role, name] of Object.entries(item.role_names)) {
        assert.ok(used.has(role), `${pack.id}/${item.id}: ${role} is drawn`);
        assert.ok((PART_NAMES as readonly string[]).includes(name!), `${pack.id}/${item.id}: ${name}`);
      }
    }
  assert.ok(named >= 18, `${named} named items`);
});

test("the Sample Home's car, radiators and label printer show part names, also from their older plan copies (#411)", () => {
  const sample = JSON.parse(readFileSync(new URL("../../custom_components/home_3d/sample/sample-home.json", import.meta.url), "utf8"));
  const placed = new Set<string>(JSON.stringify(sample).match(/pack:amluto\.[a-z-]+:[a-z0-9_]+/g) ?? []);
  setPacks(bundledPacks());
  const want: Record<string, string[]> = {
    "pack:amluto.outdoor:nissan_leaf": ["Paint", "Details", "Wheels", "Tyres and trim", "Windows"],
    "pack:amluto.devices:radiator_trv_600": ["Panels", "Valves", "Grille", "Details"],
    "pack:amluto.office:label_printer": ["Case", "Details", "Glass", "Buttons"],
    "pack:amluto.living:fabric_sofa_2_seater": ["Fabric", "Cushions", "Legs"],
  };
  for (const [type, names] of Object.entries(want)) {
    assert.ok(placed.has(type), `the Sample Home has ${type}`);
    assert.deepEqual(partOrder(itemColourRoles(type)).map((r) => shown(type, r)), names, type);
  }
  // the names come from the installed pack before the plan's copy (the Sample Home's copies are older)
  assert.deepEqual(packRoleNames("pack:amluto.devices:radiator_trv_600"), { white: "panels", metal: "valves", dark: "grille", accent: "details" });
  setPacks([]);
});

test("every part name has its text in English and German (#411)", () => {
  for (const name of PART_NAMES) {
    assert.equal(typeof en[`part_${name}`], "string", `en part_${name}`);
    assert.equal(typeof deTable[`part_${name}`], "string", `de part_${name}`);
  }
});

test("each part family offers presets that fit it: no velvet on glass, the ten car paints for paint (#410, MANY-2)", () => {
  const families: PartFamily[] = ["paint", "wood", "metal", "fabric", "glass", "plant", "plain"];
  for (const family of families) {
    const presets = familyPresets(family);
    assert.ok(presets.length >= 3 && presets.length <= 10, `${family}: ${presets.length}`);
    for (const p of presets) {
      assert.match(p.hex, /^#[0-9a-f]{6}$/, p.id);
      assert.equal(typeof en[p.key], "string", `en ${p.key}`);
      assert.equal(typeof deTable[p.key], "string", `de ${p.key}`);
    }
  }
  assert.equal(familyPresets("paint").length, 10);
  assert.ok(familyPresets("paint").every((p) => p.key.startsWith("paint_")));
  const glass = familyPresets("glass").map((p) => p.id);
  for (const id of ["green_velvet", "oak", "rattan", "grey_fabric"]) assert.ok(!glass.includes(id), `glass has no ${id}`);
  assert.ok(!familyPresets("metal").some((p) => p.id.includes("fabric") || p.id === "green_velvet"));
  assert.ok(familyPresets("wood").some((p) => p.id === "oak"));
  assert.equal(partFamily("cushion"), "fabric");
  assert.equal(partFamily("dark"), "plain");
  // the presets' ids are unique and so are their colours (a colour names its preset in the fold's summary)
  assert.equal(new Set(COLOUR_PRESETS.map((p) => p.hex)).size, COLOUR_PRESETS.length);
  assert.equal(presetKey("#c09a6b"), "colour_preset_oak");
  assert.equal(presetKey("#2f63b5"), "paint_blue");
  assert.equal(presetKey("#123456"), null);
});

test("a part offers 2-3 finishes that fit it, its usual one first, and keeps a saved one that is not among them (#410)", () => {
  for (const role of itemColourRoles("sofa").concat(["paint", "glass", "metal", "white", "plant"] as ColourRole[])) {
    const list = partFinishes(role, null);
    assert.ok(list.length >= 2 && list.length <= 3, `${role}: ${list.join(", ")}`);
    assert.equal(list[0], usualMaterial(role), role);
    assert.equal(new Set(list).size, list.length);
  }
  assert.ok(!partFinishes("glass", null).includes("fabric"), "glass is never fabric");
  assert.ok(!partFinishes("glass", null).includes("rattan"));
  const kept = partFinishes("glass", "fabric");
  assert.equal(kept[kept.length - 1], "fabric", "a saved finish stays to be seen and changed");
});
