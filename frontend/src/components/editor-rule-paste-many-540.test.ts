// "Paste onto other items" (#540): the copied rule goes onto chosen furniture and placed devices on every floor in one
// change (one undo), each its own copy, "This item" relative; items without an entity of their own are left out and named.

import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, THIS_ITEM, type Building, type Furniture, type Placement, type ShowRule } from "../model.ts";
import { pasteItems, pasteOnto, searchItems } from "./editor/rule-paste.ts";

const ON: ShowRule = { match: "all", conditions: [{ type: "state", entity: THIS_ITEM, when: "on" }] };

function plan(): Building {
  const b = emptyBuilding();
  const g = newFloor("g", "Ground", 0);
  const u = newFloor("u", "Upstairs", 3);
  const lamp = (id: string, entity: string | null, name?: string): Furniture => ({ id, type: "lamp_floor", x: 1, z: 1, rotation: 0, w: 0.4, d: 0.4, h: 1.7, variant: null, entity, ...(name ? { name } : {}) });
  g.furniture = [lamp("f1", "light.a", "Reading lamp"), { id: "rug", type: "rug", x: 2, z: 2, rotation: 0, w: 2, d: 1, h: 0.01, variant: null, entity: null, name: "Rug" }];
  const light = (id: string, name: string): Placement => ({ entity_id: id, x: 1, z: 1, y: 1, name });
  g.placements = Array.from({ length: 5 }, (_, i) => light(`light.g${i}`, `Ceiling ${i}`));
  u.placements = [...Array.from({ length: 4 }, (_, i) => light(`light.u${i}`, `Bedroom ${i}`)), { entity_id: "switch.fan", x: 1, z: 1, y: 1, name: "Fan" }];
  b.floors = [g, u];
  return b;
}
const names = { furniture: (t: string) => t, entity: (id: string) => id };
const selfOf = (f: Furniture) => (f.entity && f.entity !== "none" ? f.entity : null);

test("the list holds furniture and placed devices of every floor; lights are known (#540)", () => {
  const items = pasteItems(plan(), names, selfOf);
  assert.equal(items.length, 12);
  assert.equal(items.filter((it) => it.light).length, 10, "the lamp and nine light devices");
  assert.deepEqual(searchItems(items, "bedroom 2").map((it) => it.name), ["Bedroom 2"]);
  assert.equal(searchItems(items, "upstairs").length, 5, "the floor's name finds its items");
});

test("one rule pasted onto 10 lights (1 furniture, 9 placed devices) works on all 10, each its own copy (#540)", () => {
  const b = plan();
  const items = pasteItems(b, names, selfOf);
  const lights = new Set(items.filter((it) => it.light).map((it) => it.key));
  const out = pasteOnto(b, items, lights, ON, "card");
  assert.equal(out.done.length, 10);
  assert.equal(out.skipped.length, 0);
  const rules = [...b.floors.flatMap((f) => f.furniture.map((m) => m.show_rules?.card)), ...b.floors.flatMap((f) => f.placements.map((p) => p.show_rules?.card))].filter(Boolean);
  assert.equal(rules.length, 10);
  assert.ok(rules.every((r) => (r!.conditions[0] as { entity: string }).entity === THIS_ITEM), "'This item' stays relative");
  assert.notEqual(rules[0], rules[1], "independent copies");
  assert.equal(b.floors[1].placements.find((p) => p.entity_id === "switch.fan")!.show_rules, undefined, "the fan was not chosen");
});

test("an item without an entity of its own is left out and named; a fixed entity rule fits it (#540)", () => {
  const b = plan();
  const items = pasteItems(b, names, selfOf);
  const out = pasteOnto(b, items, new Set(["g|f|rug", "g|p|light.g0"]), ON, "icon");
  assert.deepEqual(out.skipped.map((it) => it.name), ["Rug"]);
  assert.deepEqual(out.done.map((it) => it.name), ["Ceiling 0"]);
  const fixed: ShowRule = { match: "all", conditions: [{ type: "state", entity: "sun.sun", when: "off" }] };
  const again = pasteOnto(b, items, new Set(["g|f|rug"]), fixed, "icon");
  assert.equal(again.done.length, 1);
  assert.equal((b.floors[0].furniture[1].show_rules!.icon!.conditions[0] as { entity: string }).entity, "sun.sun");
});
