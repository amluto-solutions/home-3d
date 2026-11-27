// The copied show rule of the editor (#540): one rule, kept on this page only (not the system clipboard), pasted as an
// independent copy. "This item" (THIS_ITEM) stays relative, so a pasted rule works on the item it lands on at once; a
// fixed entity stays fixed.

import { THIS_ITEM, type ShowRule } from "./model.ts";

let clip: ShowRule | null = null;

/** Keeps a copy of the rule (a later change of the item's rule does not change the copy). */
export function copyRule(rule: ShowRule): void {
  clip = structuredClone(rule);
}

/** A fresh copy of the copied rule, or null when none was copied. */
export function copiedRule(): ShowRule | null {
  return clip ? structuredClone(clip) : null;
}

/** Whether the rule asks "this item": it needs an item with an entity of its own. */
export function ruleNeedsSelf(rule: ShowRule): boolean {
  return rule.conditions.some((c) => c.type === "state" && c.entity === THIS_ITEM);
}
