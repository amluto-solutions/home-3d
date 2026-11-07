// The View's "Display what" kinds and the Furniture switch (#268, #269).

import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Furniture } from "./model.ts";
import { setPacks } from "./packs.ts";
import { buildFloorGeometry, clearFurnitureCache } from "./viewer/build.ts";
import { hiddenItemIds, hiddenText, itemHidden, parseHidden, typeOfEntity, typeOfItem, type ObjectType } from "./object-types.ts";

const item = (id: string, type: string, extra: Partial<Furniture> = {}): Furniture => ({ id, type, x: 2, z: 2, rotation: 0, w: 1, d: 1, h: 1, variant: null, entity: null, power: null, ...extra });

test("items and devices fall into the kinds the View lists", () => {
  assert.equal(typeOfItem(item("a", "lamp_floor")), "lights");
  assert.equal(typeOfItem(item("a", "sofa")), "furniture");
  assert.equal(typeOfItem(item("a", "sofa", { entity: "binary_sensor.x" })), "furniture", "a sofa with an occupancy sensor stays furniture");
  assert.equal(typeOfItem(item("a", "plant")), "decor");
  assert.equal(typeOfItem(item("a", "inverter")), "energy");
  assert.equal(typeOfItem(item("a", "tv_wall")), "media");
  assert.equal(typeOfItem(item("a", "radiator")), "climate");
  assert.equal(typeOfItem(item("a", "mailbox")), "outdoor");
  assert.equal(typeOfItem(item("a", "stairs")), null, "stairs are the building's own");
  assert.equal(typeOfEntity("media_player.sample_tv"), "media");
  assert.equal(typeOfEntity("cover.sample_blind"), "covers");
  assert.equal(typeOfEntity("zone.home"), null);
});

test("the preference keeps the hidden kinds; the old Room names switch counts until it is written", () => {
  assert.deepEqual([...parseHidden(null)], ["room_names"], "never chosen: room names off (#347)");
  assert.deepEqual([...parseHidden(null, "1")], [], "the old switch on was a choice and is kept (#347)");
  assert.deepEqual([...parseHidden(null, "0")], ["room_names"]);
  assert.deepEqual([...parseHidden("", "0")], [], "an empty list is written: nothing is hidden");
  assert.deepEqual([...parseHidden("lights,bogus,decor")], ["lights", "decor"]);
  assert.equal(hiddenText(new Set<ObjectType>(["decor", "lights"])), "lights,decor");
});

test("the Furniture switch off keeps only items linked to a device (#269)", () => {
  const none = new Set<ObjectType>();
  const plain = item("p", "sofa");
  const linked = item("l", "tv_board", { entity: "media_player.sample_tv" });
  const lamp = item("m", "lamp_table");
  assert.equal(itemHidden(plain, none, true), false);
  assert.equal(itemHidden(plain, none, false), true);
  assert.equal(itemHidden(linked, none, false), false);
  assert.equal(itemHidden(item("s", "stairs"), none, false), false);
  assert.equal(itemHidden(lamp, none, false), false, "a lamp is not furniture");
  assert.equal(itemHidden(lamp, new Set<ObjectType>(["lights"]), true), true);
  const b = { ...emptyBuilding(), floors: [{ ...newFloor("f", "F", 0), furniture: [plain, linked, lamp] }] };
  assert.deepEqual([...hiddenItemIds(b, none, false)], ["p"]);
  assert.equal(hiddenItemIds(b, none, true).size, 0);
  // a link found through the registry counts as well
  assert.equal(hiddenItemIds(b, none, false, (f) => (f.id === "p" ? "light.sample" : (f.entity ?? null))).size, 0);
});

test("every item's triangles, edges and shadow have a range the viewer can collapse (#268)", () => {
  setPacks([]);
  clearFurnitureCache();
  const f = { ...newFloor("f", "F", 0), rooms: [{ id: "a", name: "a", area_id: null, points: [[0, 0], [6, 0], [6, 5], [0, 5]] as [number, number][], floor_material: "wood" as const }], furniture: [item("s", "sofa", { w: 2, d: 0.9, h: 0.8 }), item("t", "table", { x: 4, z: 3 })] };
  const g = buildFloorGeometry(f, 0.24, 0.12);
  assert.equal(g.furnitureTris.length, 2);
  let wallEnd = 0;
  for (const r of g.furnitureTris) {
    assert.ok(r.end > r.start && r.start >= wallEnd, "ranges follow each other");
    assert.ok(r.line && r.line[1] > r.line[0] && r.line[1] <= g.lines.getAttribute("position").count);
    assert.ok(r.shadow && r.shadow[1] > r.shadow[0] && r.shadow[1] <= g.shadow.getAttribute("position").count);
    wallEnd = r.end;
  }
  assert.ok(wallEnd * 3 <= g.walls.getAttribute("position").count);
});
