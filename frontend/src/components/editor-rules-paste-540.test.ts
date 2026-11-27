// Copy a rule and paste it onto one or many items (#540): an independent copy, "This item" stays relative, a fixed
// entity stays fixed, one paste onto a multi-selection is one undo step, and items without an entity are named.

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor } from "./editor-harness.ts";
import { THIS_ITEM, type Furniture, type ShowRule } from "../model.ts";
import { copiedRule, copyRule, ruleNeedsSelf } from "../rule-clip.ts";

const lamp = (i: number, entity: string | null): Furniture => ({ id: `l${i}`, type: "lamp_floor", x: i, z: 1, rotation: 0, w: 0.4, d: 0.4, h: 1.7, variant: null, entity });
const ON: ShowRule = { match: "all", conditions: [{ type: "state", entity: THIS_ITEM, when: "on" }] };

test("a copied rule is an independent copy (#540)", () => {
  const rule: ShowRule = structuredClone(ON);
  copyRule(rule);
  rule.conditions.push({ type: "time", start: "08:00", end: "09:00" });
  const a = copiedRule()!;
  assert.equal(a.conditions.length, 1, "a later change of the item's rule does not change the copy");
  a.match = "any";
  assert.equal(copiedRule()!.match, "all", "each paste gets its own copy");
  assert.equal(ruleNeedsSelf(ON), true);
  assert.equal(ruleNeedsSelf({ match: "all", conditions: [{ type: "state", entity: "sun.sun", when: "off" }] }), false);
});

test("one rule pasted onto 10 selected lights works on all 10, in one undo step (#540)", async () => {
  const items = Array.from({ length: 10 }, (_, i) => lamp(i, `light.l${i}`));
  const ed = await makeEditor([], items);
  copyRule(ON);
  ed.pasteRuleOnto(items.map((m) => m.id), "card");
  const after = ed._doc.floors[0].furniture as Furniture[];
  assert.equal(after.filter((m) => m.show_rules?.card?.conditions[0]?.type === "state" && (m.show_rules.card.conditions[0] as { entity: string }).entity === THIS_ITEM).length, 10, "all ten, 'This item' kept relative");
  assert.notEqual(after[0].show_rules!.card, after[1].show_rules!.card, "each item has its own copy");
  ed.undo();
  assert.equal((ed._doc.floors[0].furniture as Furniture[]).filter((m) => m.show_rules).length, 0, "one undo takes the whole paste back");
});

test("items without an entity of their own are left out and named; a fixed entity rule fits every item (#540)", async () => {
  const items = [lamp(0, "light.a"), { ...lamp(1, null), name: "Rug" }];
  const ed = await makeEditor([], items);
  copyRule(ON);
  ed.pasteRuleOnto(["l0", "l1"], "icon");
  const after = ed._doc.floors[0].furniture as Furniture[];
  assert.ok(after[0].show_rules?.icon);
  assert.equal(after[1].show_rules, undefined);
  copyRule({ match: "all", conditions: [{ type: "state", entity: "sun.sun", when: "off" }] });
  ed.pasteRuleOnto(["l0", "l1"], "icon");
  const fixed = ed._doc.floors[0].furniture as Furniture[];
  assert.deepEqual(fixed.map((m) => (m.show_rules?.icon?.conditions[0] as { entity: string }).entity), ["sun.sun", "sun.sun"], "a fixed entity stays fixed");
});
