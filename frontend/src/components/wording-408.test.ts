// #408 (WORD-5/10/11/12, CONS-4): quick wording and placeholder fixes. One word for one thing in every side panel
// (Turn, Height above floor, Name, Delete), placeholders from the item itself, "Floor finish" for a room and "On floor"
// for an item, and the pin and parking-spot changes and the room ID in the header's "⋯".

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { englishTable } from "../i18n.ts";
import type { Furniture } from "../model.ts";
import { setPacks, type FurniturePack } from "../packs.ts";
import { editorFiles } from "./editor-source.ts";
import { panelUi } from "./editor/item-sections.ts";
import { kindIcon } from "./editor/item-folds.ts";
import { rememberFromPin, resetFromPin } from "./editor/from-pin.ts";
import { makeEditor, square } from "./editor-harness.ts";

const en = englishTable() as Record<string, string>;
const de = JSON.parse(readFileSync(new URL("../../../custom_components/home_3d/bundled_languages/amluto.lang-de/strings.json", import.meta.url), "utf8")) as Record<string, string>;

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

/** Every text key the editor's panels name literally. */
function panelKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of editorFiles()) for (const m of readFileSync(file, "utf8").matchAll(/\bt\(\s*"([a-z][a-z0-9_]*)"/g)) keys.add(m[1]);
  return keys;
}

test("the retired words are gone from every side panel's texts (#408, CONS-4)", () => {
  const retired: [RegExp, string][] = [
    [/^Rotation\b/, "Turn"],
    [/^Device icon height/, "Height above floor"],
    [/^Own name/, "Name"],
    [/^Remove$/, "Delete"],
    [/telly|living room TV/, "an example from the item"],
    [/^Turn back into a plain pin$/, "Back to a device pin"],
    [/^Turn into a parking spot$/, "Make a parking spot"],
    [/^ID \(card option room:\)$/, "Copy room ID for a card"],
    [/^Height above the floor/, "Height above floor"],
  ];
  const hits: string[] = [];
  for (const key of panelKeys()) for (const [re, want] of retired) if (re.test(en[key] ?? "")) hits.push(`${key}: "${en[key]}" (say ${want})`);
  assert.deepEqual(hits, []);
  assert.equal(en.material, "Floor finish", "a room's floor is its finish");
  assert.equal(en.item_on_floor, "On floor", "an item's floor is the storey it stands on");
  assert.equal(en.rotation, en.item_turn, "a pin turns like an item");
});

test("German follows: the changed and new texts are in the German pack, without the old words (#408)", () => {
  for (const key of ["material", "rotation", "solar_rotation", "background_rotation", "devices_remove", "bin_kerb_clear", "vehicle_to_spot", "as_device", "aliases_placeholder", "aliases_placeholder_of", "aliases_hint", "item_on_floor", "room_id_copy", "room_id_copied"])
    assert.equal(typeof de[key], "string", key);
  assert.doesNotMatch(de.aliases_placeholder + de.aliases_hint, /Glotze|Wohnzimmerfernseher/);
  assert.equal(de.rotation, de.item_turn);
  assert.match(de.aliases_placeholder_of, /\{name\}/);
  assert.match(de.room_id_copied, /\{id\}/);
});

const PACK = {
  id: "demo.cars",
  name: "Cars",
  publisher: "Demo",
  items: [{ id: "leaf", name: { en: "Nissan Leaf" }, size: [1.8, 4.5, 1.5], vehicle: true, electric: true, parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0.2, h: 0.4, color: "paint" }] }],
} as unknown as FurniturePack;

test("placeholders come from the item: 'e.g. the Leaf' and the car's icon, no TV and no thermometer (#408, WORD-5)", async () => {
  setPacks([PACK]);
  const car = { id: "c", type: "pack:demo.cars:leaf", x: 1, z: 1, rotation: 0, w: 1.8, d: 4.5, h: 1.5, variant: null, entity: "sensor.car_battery" } as Furniture;
  const ed = await makeEditor([square("r", 0, 0, 6, 6)], [car]);
  ed.packs = [PACK];
  ed.selectItem("furniture", "c");
  panelUi(ed, "c").folds.add("more");
  const form = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.match(form, /placeholder=e\.g\. the Leaf/);
  assert.doesNotMatch(form, /placeholder=(?:[^ ]*(?:telly|living room TV)|mdi:thermometer)/);
  assert.equal(kindIcon("car"), "mdi:car");
  assert.equal(kindIcon("appliance"), "", "no one icon for every appliance: none");
  assert.equal(ed.aliasPlaceholder("Sofa", false), "e.g. the sofa");
  assert.equal(ed.aliasPlaceholder("Lounge", true), "e.g. the Lounge");
  const src = readFileSync(new URL("./editor/fields.ts", import.meta.url), "utf8") + readFileSync(new URL("./editor/icon-picker.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /"mdi:thermometer"/);
});

test("'Back to a device pin' only on an item made from a pin; it and 'Make a parking spot' are in ⋯, not in More options (#408, WORD-11)", async () => {
  setPacks([PACK]);
  resetFromPin();
  const car = { id: "c", type: "pack:demo.cars:leaf", x: 1, z: 1, rotation: 0, w: 1.8, d: 4.5, h: 1.5, variant: null, entity: "sensor.car_battery" } as Furniture;
  const tv = { id: "tv", type: "tv_wall", x: 4, z: 1, rotation: 0, w: 1.2, d: 0.1, h: 0.7, variant: null, entity: "media_player.tv" } as Furniture;
  const ed = await makeEditor([square("r", 0, 0, 6, 6)], [car, tv]);
  ed.packs = [PACK];
  const menu = (id: string) => {
    ed.selectItem("furniture", id);
    panelUi(ed, id).folds.add("more");
    panelUi(ed, id).menu = true;
    const form = flat(ed.renderFurnitureForm(ed.furnitureItem));
    return { form, items: [...form.matchAll(/role="menuitem"[^>]*><span>([^<]+)<\/span>/g)].map((m) => m[1]) };
  };
  const c = menu("c");
  assert.ok(c.items.includes("Make a parking spot"));
  assert.ok(!c.items.includes("Back to a device pin"), "a car was never a pin");
  assert.doesNotMatch(c.form, /class="fp3d-btn"[^>]*>(🅿 )?Make a parking spot/);
  assert.ok(!menu("tv").items.includes("Back to a device pin"), "a TV placed from the library was never a pin");
  rememberFromPin("tv");
  const t = menu("tv");
  assert.ok(t.items.includes("Back to a device pin"), "made from a pin: it can go back");
  assert.doesNotMatch(t.form, /class="fp3d-btn"[^>]*>Back to a device pin/, "not a button in More options");
  resetFromPin();
});

test("the room's ID is 'Copy room ID for a card' in ⋯, not developer text in the form; the floor finish is named so (#408, WORD-10/12)", async () => {
  const ed = await makeEditor([{ ...square("r", 0, 0, 4, 4), name: "Lounge" }]);
  ed.selectItem("room", "r");
  const form = flat(ed.renderSide(ed.floor));
  assert.doesNotMatch(form, /card option room:|fp3d-room-id/);
  assert.match(form, />Floor finish\s*<select/);
  panelUi(ed, "room:r").menu = true;
  assert.match(flat(ed.renderSide(ed.floor)), /role="menuitem"[^>]*><span>Copy room ID for a card<\/span>/);
});

test("an item's floor field is 'On floor' (#408, WORD-10)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [{ id: "s", type: "sofa", x: 1, z: 1, rotation: 0, w: 2, d: 1, h: 0.8, variant: null } as Furniture]);
  ed.selectItem("furniture", "s");
  assert.match(flat(ed.renderItemFloor()), />On floor\s*<select/);
});
