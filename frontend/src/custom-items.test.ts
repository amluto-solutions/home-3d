// Custom items (#13): the item editor's logic. A custom item is a plain pack v2 item (docs/packs.md).

import assert from "node:assert/strict";
import { test } from "node:test";
import { addPart, changePart, CUSTOM_PACK_ID, customPack, duplicatePart, itemFile, newItem, PART_SHAPES, profileText, readItemFile, readItemFiles, readProfile, readStations, removePart, setDetails, stationsText, toggleFix, type CustomItem } from "./custom-items.ts";
import { buildIndex, filterEntries } from "./library-index.ts";
import { furnitureSize, packItem, setPacks, type PackItem, type PackPart } from "./packs.ts";

test("a new item has an id from its name that no other custom item uses", () => {
  const item = newItem("Oak wall shelf", ["oak_wall_shelf"]);
  assert.equal(item.id, "oak_wall_shelf_2");
  assert.deepEqual(item.name, { en: "Oak wall shelf" });
  assert.equal(item.parts.length, 1);
  assert.equal(item.parts[0].shape, "box");
  assert.equal(CUSTOM_PACK_ID, "household.custom");
});

/** The ranges docs/packs.md gives a part (the backend's schema checks the same). */
function assertValidPart(p: PackPart): void {
  for (const k of ["x", "z"] as const) assert.ok(p[k] >= -0.5 && p[k] <= 0.5, `${p.shape}.${k}`);
  for (const k of ["w", "d", "h"] as const) assert.ok(p[k] >= 0.001 && p[k] <= 1, `${p.shape}.${k}`);
  assert.ok(p.y >= 0 && p.y <= 1, `${p.shape}.y`);
  assert.equal(p.shape === "lathe", "profile" in p, `${p.shape}: only a lathe has a profile`);
  if (p.profile) {
    assert.ok(p.profile.length >= 2 && p.profile.length <= 12);
    for (const [r, y] of p.profile) assert.ok(r >= 0 && r <= 1 && y >= 0 && y <= 1);
  }
  assert.equal(p.shape === "shell", "side" in p, `${p.shape}: only a shell has a side view`);
  if (p.side) {
    assert.ok(p.side.length >= 2 && p.side.length <= 16);
    for (const [z, b, t] of p.side) assert.ok(z >= 0 && z <= 1 && b >= 0 && b <= t && t <= 1);
  }
  if ("round" in p) {
    assert.ok(p.shape === "rbox" || p.shape === "shell", "only a rounded box or a shell has a rounding");
    assert.ok(p.round! >= 0.01 && p.round! <= 0.5);
  }
}

test("a part of every shape the packs know can be added, with what that shape needs", () => {
  let item = newItem("Lamp", []);
  for (const shape of PART_SHAPES) item = addPart(item, shape);
  assert.deepEqual(item.parts.map((p) => p.shape), ["box", ...PART_SHAPES]);
  for (const p of item.parts) assertValidPart(p);
  assert.ok(item.parts.find((p) => p.shape === "lathe")!.profile);
  assert.deepEqual(PART_SHAPES, ["box", "cyl", "loft", "sphere", "lathe", "rbox", "shell"]);
  assert.ok(item.parts.find((p) => p.shape === "shell")!.side);
});

test("a shell's side and plan are typed as groups of numbers, and leave with its shape (#252)", () => {
  assert.equal(stationsText([[0, 0.1, 0.5], [1, 0, 0.9]]), "0 0.1 0.5, 1 0 0.9");
  // sorted by z, cut to 0..1, a top below its bottom swapped
  assert.deepEqual(readStations("1 0 0.9, 0 0.5 0.1; 0.5 -1 2", 3), [[0, 0.1, 0.5], [0.5, 0, 1], [1, 0, 0.9]]);
  assert.deepEqual(readStations("0 0.8, 1 0.7", 2), [[0, 0.8], [1, 0.7]]);
  assert.equal(readStations("0 0.8", 2), null);
  assert.equal(readStations("0 0.8 1, 1 0.7", 3), null);
  assert.equal(readStations(Array.from({ length: 17 }, (_, i) => `${i / 16} 0.5`).join(", "), 2), null);
  let item = addPart(newItem("Boat", []), "shell");
  item = changePart(item, 1, { plan: [[0, 0.5], [1, 1]], taper: 3, round: 0.4 });
  assert.equal(item.parts[1].taper, 1.5);
  assert.equal(item.parts[1].round, 0.4);
  assertValidPart(item.parts[1]);
  item = changePart(item, 1, { shape: "box" });
  for (const k of ["side", "plan", "taper", "round"]) assert.ok(!(k in item.parts[1]), k);
});

test("changing a part's shape keeps its place and drops what the old shape needed", () => {
  let item = addPart(newItem("Vase", []), "lathe");
  item = changePart(item, 1, { x: 0.2, h: 0.5 });
  item = changePart(item, 1, { shape: "rbox" });
  const p = item.parts[1];
  assert.equal(p.shape, "rbox");
  assert.equal(p.x, 0.2);
  assert.equal(p.h, 0.5);
  assertValidPart(p);
  item = changePart(item, 1, { shape: "box" });
  assertValidPart(item.parts[1]);
});

test("measures typed in are kept within what a part allows", () => {
  const item = changePart(newItem("Box", []), 0, { x: 2, w: 0, y: -1, h: 3 });
  assertValidPart(item.parts[0]);
  assert.equal(item.parts[0].x, 0.5);
  assert.equal(item.parts[0].h, 1);
});

test("a part is marked fixed per measure, and removed parts never leave an item without parts", () => {
  let item = addPart(newItem("Table", []), "cyl");
  item = toggleFix(item, 1, "h");
  item = toggleFix(item, 1, "w");
  assert.equal(item.parts[1].fix, "wh");
  item = toggleFix(item, 1, "h");
  assert.equal(item.parts[1].fix, "w");
  item = toggleFix(item, 1, "w");
  assert.equal("fix" in item.parts[1], false);
  item = removePart(item, 0);
  assert.equal(item.parts.length, 1);
  assert.equal(removePart(item, 0).parts.length, 1, "the last part stays");
  item = duplicatePart(item, 0);
  assert.equal(item.parts.length, 2);
});

test("an exported item is an item file named after its id, without the defaults the backend fills in", () => {
  // as the backend sends a saved item back: every optional flag filled with its default
  const saved = {
    ...newItem("Wall shelf", []),
    electric: false,
    mount: "floor",
    wall_y: 1,
    surface: false,
    vehicle: false,
    hole: false,
    parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood", edges: false, glow: false, screen: false, fix: "h" }],
  } as PackItem;
  const file = itemFile(saved);
  assert.equal(file.name, "wall_shelf.json");
  assert.deepEqual(JSON.parse(file.text), {
    id: "wall_shelf",
    name: { en: "Wall shelf" },
    size: [0.6, 0.6, 0.75],
    parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood", fix: "h" }],
  });
  // a wall item keeps its height on the wall
  assert.equal(JSON.parse(itemFile({ ...saved, mount: "wall", wall_y: 1.4 }).text).wall_y, 1.4);
});

test("an item file imports as it is, under a free id when that id is taken", () => {
  const shelf = newItem("Wall shelf", []);
  const text = itemFile(shelf).text;
  assert.deepEqual(readItemFile(text, []), { item: shelf });
  assert.equal((readItemFile(text, ["wall_shelf"]) as { item: PackItem }).item.id, "wall_shelf_2");
  assert.deepEqual(readItemFile("not json", []), { error: "not_json" });
  assert.deepEqual(readItemFile("[1, 2]", []), { error: "not_an_item" });
  assert.deepEqual(readItemFile(JSON.stringify({ format: "home3d-pack", version: 2, id: "a.b" }), []), { error: "pack_file" });
});

test("the library details are set from the editor's fields", () => {
  let item = newItem("Shelf", []);
  item = setDetails(item, { name: " Oak shelf ", group: "storage", room: ["living", "office"], tags: "floating, oak,, wall ", ikea: " LACK " });
  assert.deepEqual(item.name, { en: "Oak shelf" });
  assert.equal(item.group, "storage");
  assert.deepEqual(item.room, ["living", "office"]);
  assert.deepEqual(item.tags, ["floating", "oak", "wall"]);
  assert.equal((item as CustomItem).ikea, "LACK");
  assert.equal(item.id, "shelf", "the id stays: placed copies keep their item");
  // empty fields leave the item without them (an empty room list means any room)
  item = setDetails(item, { group: "", room: [], tags: " ", ikea: "" });
  for (const k of ["group", "room", "tags", "ikea"]) assert.equal(k in item, false, k);
  assert.deepEqual(item.name, { en: "Oak shelf" }, "a blank name is not taken");
  assert.equal(setDetails(item, { tags: Array.from({ length: 20 }, (_, i) => `t${i}`).join(",") }).tags!.length, 12);
});

test("a custom item shows in the library under its section and is placed as a pack item", () => {
  const shelf = setDetails(newItem("Oak shelf", []), { group: "storage", room: ["living"], tags: "floating" });
  const pack = customPack([shelf]);
  const entries = buildIndex({ packs: [pack], basics: [], language: "en", basicName: (t) => t, basicNameEn: (t) => t, kindName: (k) => k, size: () => [1, 1, 1] });
  const entry = entries.find((e) => e.type === "pack:household.custom:oak_shelf");
  assert.ok(entry, "in the library");
  assert.equal(entry.kind, "storage");
  assert.deepEqual(entry.rooms, ["living"]);
  assert.equal(entry.label, "Oak shelf");
  assert.ok(filterEntries(entries, { query: "floating", room: null, electric: false, light: false, outdoor: false }).includes(entry), "found by its tags");
  setPacks([pack]);
  assert.equal(packItem(entry.type), shelf);
  assert.deepEqual(furnitureSize(entry.type), [0.6, 0.6, 0.75]);
});

test("a lathe's profile is typed as radius-height pairs and kept within its limits", () => {
  assert.equal(profileText([[0, 0], [0.7, 0], [1, 0.4], [0, 1]]), "0 0, 0.7 0, 1 0.4, 0 1");
  assert.deepEqual(readProfile("0 0, 0.55 0 ,1 0.35;0 1"), [[0, 0], [0.55, 0], [1, 0.35], [0, 1]]);
  assert.deepEqual(readProfile("0 0, 2 0.5, 0 1"), [[0, 0], [1, 0.5], [0, 1]], "a radius beyond the part's box is cut back");
  assert.equal(readProfile("0 0"), null, "two points at least");
  assert.equal(readProfile(Array.from({ length: 13 }, (_, i) => `0.5 ${i / 12}`).join(", ")), null, "twelve at most");
  assert.equal(readProfile("0 0, a b"), null);
});

test("a new part stands on top of the parts there are, so it is seen at once", () => {
  let item = newItem("Lamp", []);
  const top = (it: PackItem) => Math.max(...it.parts.slice(0, -1).map((p) => p.y + p.h));
  item = addPart(item, "sphere");
  assert.equal(item.parts[1].y, top(item));
  item = addPart(item, "cyl");
  assert.ok(item.parts[2].y >= 0.75 - 1e-9 && item.parts[2].y + item.parts[2].h <= 1 + 1e-9, "near the top it still fits in the item");
});

test("until it is saved, a new item's id follows its name", () => {
  const draft = newItem("New item", []);
  assert.equal(setDetails(draft, { name: "Table lamp" }, ["table_lamp"]).id, "table_lamp_2");
  assert.equal(setDetails(draft, { tags: "x" }, []).id, "new_item", "only a new name changes it");
});

test("an LLM's answer reads as the item it holds, fenced or with a line of chat around it", () => {
  const item = { id: "stool", name: { en: "Stool" }, size: [0.3, 0.3, 0.45], parts: [{ shape: "cyl", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood" }] };
  const json = JSON.stringify(item, null, 2);
  for (const answer of [json, `\`\`\`json\n${json}\n\`\`\``, `Here is your stool:\n\n\`\`\`json\n${json}\n\`\`\`\n\nWant a taller one?`, `  ${json}  \n`]) {
    const read = readItemFile(answer, []);
    assert.ok("item" in read, answer);
    assert.deepEqual(read.item, item);
  }
  assert.deepEqual(readItemFile("Sorry, I can't help with that.", []), { error: "not_json" });
  assert.deepEqual(readItemFile("```json\n{ broken\n```", []), { error: "not_json" });
});

test("a list of items imports as one item each, from a file, a paste or an LLM's answer (#84)", () => {
  const stool = { id: "stool", name: { en: "Stool" }, size: [0.3, 0.3, 0.45], parts: [{ shape: "cyl", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood" }] };
  const bench = { ...stool, id: "bench", name: { en: "Bench" } };
  const list = JSON.stringify([stool, bench], null, 2);
  for (const answer of [list, `Here are both:\n\n\`\`\`json\n${list}\n\`\`\`\nAnything else?`, JSON.stringify({ items: [stool, bench] })]) {
    assert.deepEqual(readItemFiles(answer, []), [{ item: stool }, { item: bench }], answer);
  }
  // one item reads as a list of one, as before
  assert.deepEqual(readItemFiles(JSON.stringify(stool), []), [{ item: stool }]);
  // a bad entry is reported on its own, the good ones still import
  assert.deepEqual(readItemFiles(JSON.stringify([stool, { name: "no parts" }]), []), [{ item: stool }, { error: "not_an_item" }]);
  // the same id twice in one list: the second gets a free id, as does one already taken
  assert.deepEqual(
    readItemFiles(JSON.stringify([stool, stool]), ["stool"]).map((r) => ("item" in r ? r.item.id : r.error)),
    ["stool_2", "stool_3"],
  );
  assert.deepEqual(readItemFiles("[]", []), [{ error: "not_an_item" }]);
  assert.deepEqual(readItemFiles("no json here", []), [{ error: "not_json" }]);
  assert.deepEqual(readItemFiles(JSON.stringify({ format: "home3d-pack", version: 2, id: "a.b", items: [stool] }), []), [{ error: "pack_file" }]);
});
