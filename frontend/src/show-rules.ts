// Show rules (#535): when an item's icon (#536) and its card (#537) show. A rule is all or any of its conditions; a
// condition asks an entity's state (on, off, typed states, a number above or below a value, #538) or the clock (a time
// of day, weekdays). Nothing is fixed here: every time, state and number comes from the rule in the plan.
//
// "This item" (THIS_ITEM) is the item's own main entity, handed in by the caller when the rule is judged (`self`); it
// is never written into the rule, so a copied rule works on another item at once. A condition that cannot be judged
// (this item without an entity, a number condition without its number, a kind a newer release added) is left out.
//
// Pure and small: the 3D view judges the rules only when a watched entity changed, and once a minute when one of them
// has a time condition (rulesTimed).

import { RULE_WHENS, THIS_ITEM, type Building, type Furniture, type Placement, type RuleCondition, type ShowRule, type ShowRules } from "./model.ts";
import { absentState, hhmm, HHMM, inTimes, stateIs } from "./show-when.ts";
import type { HassEntity } from "./types.ts";

/** The entity a state condition asks: a fixed one, or the item's own for THIS_ITEM (null: it has none). */
function conditionEntity(entity: string, self: string | null): string | null {
  const e = entity === THIS_ITEM ? self : entity;
  return e && e !== "none" ? e : null;
}

/** Weekday of a moment, 0 = Monday … 6 = Sunday (as the pets' routine spots count them). */
function weekday(at: Date): number {
  return (at.getDay() + 6) % 7;
}

/** Whether the moment lies in the time condition; a window over midnight belongs to the day it started. */
function inTime(c: { start?: string | null; end?: string | null; days?: number[] | null }, now: Date): boolean {
  const start = c.start ?? null;
  const end = c.end ?? null;
  // one end alone is no window (the schema refuses it): never
  if (!!start !== !!end) return false;
  if (start && end && !(HHMM.test(start) && HHMM.test(end))) return false;
  const time = hhmm(now);
  if (start && end && !inTimes(time, start, end)) return false;
  const days = c.days ?? [];
  if (!days.length) return true;
  const night = !!start && !!end && start > end && time < end;
  const day = night ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now;
  return days.includes(weekday(day));
}

/**
 * Whether one condition is met now: true or false, or null when it cannot be judged (this item without an entity, a
 * number condition without its number, a kind or choice this release does not know) and is left out of its rule.
 */
export function conditionMet(c: RuleCondition, self: string | null, states: Record<string, HassEntity>, now: Date): boolean | null {
  if (c.type === "time") return inTime(c, now);
  if (c.type !== "state" || !(RULE_WHENS as readonly string[]).includes(c.when)) return null;
  const entity = conditionEntity(c.entity, self);
  if (!entity) return null;
  const number = c.when === "above" || c.when === "below";
  if (number && (typeof c.value !== "number" || !Number.isFinite(c.value))) return null;
  const state = states[entity]?.state;
  if (absentState(state)) return c.unavailable !== "hide";
  if (number) {
    const text = state.trim();
    const n = text === "" ? NaN : Number(text);
    if (!Number.isFinite(n)) return false;
    return c.when === "above" ? n > (c.value as number) : n < (c.value as number);
  }
  return stateIs(entity, state, c.when as "on" | "off" | "state", c.state);
}

/**
 * Whether the rule lets the thing show now: all (or any) of the conditions that can be judged are met. No rule, no
 * conditions, or none that can be judged: it shows.
 */
export function ruleShows(rule: ShowRule | null | undefined, self: string | null, states: Record<string, HassEntity>, now: Date): boolean {
  if (!rule?.conditions?.length) return true;
  const anyOf = rule.match === "any";
  let judged = false;
  for (const c of rule.conditions) {
    const met = conditionMet(c, self, states, now);
    if (met === null) continue;
    judged = true;
    if (anyOf && met) return true;
    if (!anyOf && !met) return false;
  }
  return !anyOf || !judged;
}

/** The entities the rule asks (its fixed ones, and the item's own through THIS_ITEM): a change of one judges it again. */
export function ruleEntities(rule: ShowRule | null | undefined, self: string | null): string[] {
  const out = new Set<string>();
  for (const c of rule?.conditions ?? []) {
    if (c.type !== "state") continue;
    const e = conditionEntity(c.entity, self);
    if (e) out.add(e);
  }
  return [...out];
}

/** Whether the rule has a time condition: it is judged again every minute. */
export function ruleTimed(rule: ShowRule | null | undefined): boolean {
  return !!rule?.conditions?.some((c) => c.type === "time");
}

/** A rule of the plan with the item it belongs to: a furniture item (key: its id) or a placed device (key: its entity). */
export type ItemRule =
  | { kind: "furniture"; key: string; item: Furniture; rule: ShowRule }
  | { kind: "placement"; key: string; item: Placement; rule: ShowRule };

/** Every item of the plan with a rule of that kind (with at least one condition). */
export function itemRules(b: Building, which: keyof ShowRules): ItemRule[] {
  const out: ItemRule[] = [];
  for (const fl of b.floors) {
    for (const f of fl.furniture) {
      const rule = f.show_rules?.[which];
      if (rule?.conditions?.length) out.push({ kind: "furniture", key: f.id, item: f, rule });
    }
    for (const p of fl.placements) {
      const rule = p.show_rules?.[which];
      if (rule?.conditions?.length) out.push({ kind: "placement", key: p.entity_id, item: p, rule });
    }
  }
  return out;
}

/** Some item's rule of that kind has a time condition: the view judges them again every minute. */
export function rulesTimed(b: Building, which: keyof ShowRules): boolean {
  return b.floors.some((fl) => fl.furniture.some((f) => ruleTimed(f.show_rules?.[which])) || fl.placements.some((p) => ruleTimed(p.show_rules?.[which])));
}
