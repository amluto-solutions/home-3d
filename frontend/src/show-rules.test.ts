import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, THIS_ITEM, type Furniture, type Placement, type RuleCondition, type ShowRule } from "./model.ts";
import { conditionMet, itemRules, ruleEntities, ruleShows, ruleTimed, rulesTimed } from "./show-rules.ts";
import type { HassEntity } from "./types.ts";

const st = (entity_id: string, state: string): HassEntity => ({ entity_id, state, attributes: {} });
const states = (...list: [string, string][]): Record<string, HassEntity> => Object.fromEntries(list.map(([e, s]) => [e, st(e, s)]));
// a local date and time: Wednesday 25 November 2026
const at = (iso: string) => new Date(iso);
const WED = at("2026-11-25T12:00");
const all = (...conditions: RuleCondition[]): ShowRule => ({ match: "all", conditions });
const any = (...conditions: RuleCondition[]): ShowRule => ({ match: "any", conditions });
const self = (when: "on" | "off" | "state" | "above" | "below", extra: Record<string, unknown> = {}): RuleCondition => ({ type: "state", entity: THIS_ITEM, when, ...extra });
const fixed = (entity: string, when: "on" | "off" | "state" | "above" | "below", extra: Record<string, unknown> = {}): RuleCondition => ({ type: "state", entity, when, ...extra });

test("no rule, or a rule without conditions, always shows (#535)", () => {
  assert.equal(ruleShows(null, "light.a", {}, WED), true);
  assert.equal(ruleShows(undefined, null, {}, WED), true);
  assert.equal(ruleShows(all(), "light.a", {}, WED), true);
  assert.equal(ruleShows(any(), "light.a", {}, WED), true);
});

test("'this item' is the item's own entity, found when judged: the same rule works on another item at once (#535)", () => {
  const rule = all(self("on"));
  const s = states(["light.hall", "on"], ["light.porch", "off"]);
  assert.equal(ruleShows(rule, "light.hall", s, WED), true);
  assert.equal(ruleShows(rule, "light.porch", s, WED), false);
  // the rule is never rewritten to an entity id
  assert.equal((rule.conditions[0] as { entity: string }).entity, THIS_ITEM);
});

test("a fixed entity is the same for every item (#535)", () => {
  const rule = all(fixed("binary_sensor.dark", "on"));
  assert.equal(ruleShows(rule, "light.hall", states(["binary_sensor.dark", "on"]), WED), true);
  assert.equal(ruleShows(rule, "light.porch", states(["binary_sensor.dark", "off"]), WED), false);
  assert.equal(ruleShows(rule, null, states(["binary_sensor.dark", "on"]), WED), true, "an item without an entity can still use a fixed one");
});

test("on and off follow show-when's words: on, true, home, open against off, false, not_home, away, closed (#535)", () => {
  for (const s of ["on", "true", "home", "open", "opening", "ON"]) assert.equal(conditionMet(self("on"), "cover.a", states(["cover.a", s]), WED), true, s);
  for (const s of ["off", "false", "not_home", "away", "closed", "closing"]) assert.equal(conditionMet(self("off"), "cover.a", states(["cover.a", s]), WED), true, s);
  assert.equal(conditionMet(self("on"), "sensor.a", states(["sensor.a", "21.5"]), WED), false, "a number is neither on nor off");
  assert.equal(conditionMet(self("off"), "sensor.a", states(["sensor.a", "21.5"]), WED), false);
  // a person anywhere but home is off
  assert.equal(conditionMet(self("off"), "person.anna", states(["person.anna", "Work"]), WED), true);
});

test("a typed state matches any of the comma separated states, any letter case; none typed matches any state (#535)", () => {
  const c = self("state", { state: "Playing, paused" });
  assert.equal(conditionMet(c, "media_player.tv", states(["media_player.tv", "playing"]), WED), true);
  assert.equal(conditionMet(c, "media_player.tv", states(["media_player.tv", "PAUSED"]), WED), true);
  assert.equal(conditionMet(c, "media_player.tv", states(["media_player.tv", "idle"]), WED), false);
  assert.equal(conditionMet(self("state", { state: "" }), "media_player.tv", states(["media_player.tv", "idle"]), WED), true);
});

test("an unavailable, unknown or missing entity counts as met unless the condition says hide (#535)", () => {
  for (const s of [states(["light.a", "unavailable"]), states(["light.a", "unknown"]), {}]) {
    assert.equal(conditionMet(self("on"), "light.a", s, WED), true);
    assert.equal(conditionMet(self("on", { unavailable: "hide" }), "light.a", s, WED), false);
    assert.equal(conditionMet(self("above", { value: 5, unavailable: "hide" }), "light.a", s, WED), false);
    assert.equal(conditionMet(self("above", { value: 5 }), "light.a", s, WED), true);
  }
});

test("all needs every condition, any needs one (#535)", () => {
  const s = states(["light.a", "on"], ["binary_sensor.dark", "off"]);
  const a = self("on");
  const b = fixed("binary_sensor.dark", "on");
  assert.equal(ruleShows(all(a, b), "light.a", s, WED), false);
  assert.equal(ruleShows(any(a, b), "light.a", s, WED), true);
  assert.equal(ruleShows(any(self("off"), b), "light.a", s, WED), false);
  assert.equal(ruleShows(all(a, fixed("binary_sensor.dark", "off")), "light.a", s, WED), true);
});

test("an item without an entity: its 'this item' conditions cannot be judged and are left out (#535)", () => {
  const s = states(["binary_sensor.dark", "off"]);
  assert.equal(conditionMet(self("on"), null, s, WED), null);
  // only such conditions: the rule shows (the editor says the item cannot use it, #540)
  assert.equal(ruleShows(all(self("on")), null, s, WED), true);
  assert.equal(ruleShows(any(self("on")), null, s, WED), true);
  // the others still decide
  assert.equal(ruleShows(all(self("on"), fixed("binary_sensor.dark", "on")), null, s, WED), false);
  assert.equal(ruleShows(any(self("on"), fixed("binary_sensor.dark", "on")), null, s, WED), false);
  assert.equal(ruleShows(any(self("on"), fixed("binary_sensor.dark", "off")), null, s, WED), true);
  // "none" is no entity either
  assert.equal(conditionMet(self("on"), "none", s, WED), null);
});

test("above and below compare the state as a number, strictly; the value comes from the rule (#538)", () => {
  const above = self("above", { value: 50 });
  const below = self("below", { value: 50 });
  const w = (v: string) => states(["sensor.solar", v]);
  assert.equal(conditionMet(above, "sensor.solar", w("51"), WED), true);
  assert.equal(conditionMet(above, "sensor.solar", w("49"), WED), false);
  assert.equal(conditionMet(above, "sensor.solar", w("50"), WED), false);
  assert.equal(conditionMet(below, "sensor.solar", w("49"), WED), true);
  assert.equal(conditionMet(below, "sensor.solar", w("50"), WED), false);
  assert.equal(conditionMet(below, "sensor.solar", w("-3.5"), WED), true);
  assert.equal(conditionMet(self("above", { value: 0.25 }), "sensor.solar", w("0.3"), WED), true);
  assert.equal(conditionMet(self("above", { value: -10 }), "sensor.solar", w("-9"), WED), true);
  // a state that is no number is not above or below anything
  assert.equal(conditionMet(above, "sensor.solar", w("on"), WED), false);
  assert.equal(conditionMet(below, "sensor.solar", w(""), WED), false);
  // no value in the rule: nothing to compare with, the condition is left out
  assert.equal(conditionMet(self("above"), "sensor.solar", w("51"), WED), null);
  assert.equal(conditionMet(self("below", { value: null }), "sensor.solar", w("51"), WED), null);
});

test("a solar card with 'above 50' shows at 51 W and hides at 49 W (#538)", () => {
  const rule = all(self("above", { value: 50 }));
  assert.equal(ruleShows(rule, "sensor.pv_power", states(["sensor.pv_power", "51"]), WED), true);
  assert.equal(ruleShows(rule, "sensor.pv_power", states(["sensor.pv_power", "49"]), WED), false);
});

test("a time condition shows from its start up to its end (#535)", () => {
  const c: RuleCondition = { type: "time", start: "07:30", end: "22:00" };
  assert.equal(conditionMet(c, null, {}, at("2026-11-25T07:29")), false);
  assert.equal(conditionMet(c, null, {}, at("2026-11-25T07:30")), true);
  assert.equal(conditionMet(c, null, {}, at("2026-11-25T21:59")), true);
  assert.equal(conditionMet(c, null, {}, at("2026-11-25T22:00")), false);
  // no times: all day
  assert.equal(conditionMet({ type: "time" }, null, {}, at("2026-11-25T03:00")), true);
  // one end alone is no window: it never matches
  assert.equal(conditionMet({ type: "time", start: "07:00" }, null, {}, at("2026-11-25T12:00")), false);
});

test("a time condition runs over midnight when its start comes after its end (#535)", () => {
  const c: RuleCondition = { type: "time", start: "22:00", end: "06:00" };
  assert.equal(conditionMet(c, null, {}, at("2026-11-25T21:59")), false);
  assert.equal(conditionMet(c, null, {}, at("2026-11-25T22:00")), true);
  assert.equal(conditionMet(c, null, {}, at("2026-11-26T00:00")), true);
  assert.equal(conditionMet(c, null, {}, at("2026-11-26T05:59")), true);
  assert.equal(conditionMet(c, null, {}, at("2026-11-26T06:00")), false);
});

test("weekdays count from 0 = Monday; a night over midnight belongs to the day it started (#535)", () => {
  // 27 Nov 2026 is a Friday, 28 a Saturday, 30 a Monday
  const weekend: RuleCondition = { type: "time", days: [5, 6] };
  assert.equal(conditionMet(weekend, null, {}, at("2026-11-27T23:59")), false);
  assert.equal(conditionMet(weekend, null, {}, at("2026-11-28T00:00")), true);
  assert.equal(conditionMet(weekend, null, {}, at("2026-11-29T23:59")), true);
  assert.equal(conditionMet(weekend, null, {}, at("2026-11-30T00:00")), false);
  const monday: RuleCondition = { type: "time", days: [0] };
  assert.equal(conditionMet(monday, null, {}, at("2026-11-30T12:00")), true);
  // Friday night, 22:00 to 02:00
  const friday: RuleCondition = { type: "time", start: "22:00", end: "02:00", days: [4] };
  assert.equal(conditionMet(friday, null, {}, at("2026-11-27T23:00")), true);
  assert.equal(conditionMet(friday, null, {}, at("2026-11-28T01:30")), true, "Saturday 01:30 is still Friday night");
  assert.equal(conditionMet(friday, null, {}, at("2026-11-28T23:00")), false, "Saturday night is not");
  assert.equal(conditionMet(friday, null, {}, at("2026-11-27T01:30")), false, "Friday 01:30 belongs to Thursday night");
  // no weekdays (null or empty): every day
  assert.equal(conditionMet({ type: "time", days: [] }, null, {}, WED), true);
  assert.equal(conditionMet({ type: "time", days: null }, null, {}, WED), true);
});

test("state and time together: a porch light's icon only on weekday evenings while it is on (#535)", () => {
  const rule = all(self("on"), { type: "time", start: "18:00", end: "23:00", days: [0, 1, 2, 3, 4] });
  assert.equal(ruleShows(rule, "light.porch", states(["light.porch", "on"]), at("2026-11-25T19:00")), true);
  assert.equal(ruleShows(rule, "light.porch", states(["light.porch", "off"]), at("2026-11-25T19:00")), false);
  assert.equal(ruleShows(rule, "light.porch", states(["light.porch", "on"]), at("2026-11-25T12:00")), false);
  assert.equal(ruleShows(rule, "light.porch", states(["light.porch", "on"]), at("2026-11-28T19:00")), false);
});

test("a condition of an unknown kind or choice is left out, so a plan of a newer release never hides everything", () => {
  const odd = { type: "sun", after: "sunset" } as unknown as RuleCondition;
  assert.equal(conditionMet(odd, "light.a", {}, WED), null);
  assert.equal(conditionMet(self("glows" as "on"), "light.a", states(["light.a", "on"]), WED), null);
  assert.equal(ruleShows(all(odd, self("on")), "light.a", states(["light.a", "off"]), WED), false);
  assert.equal(ruleShows(all(odd), "light.a", {}, WED), true);
});

test("the entities a rule watches: its fixed ones and, through 'this item', the item's own (#535)", () => {
  const rule = any(self("on"), fixed("binary_sensor.dark", "on"), { type: "time", start: "18:00", end: "23:00" }, fixed("binary_sensor.dark", "off"));
  assert.deepEqual(ruleEntities(rule, "light.a").sort(), ["binary_sensor.dark", "light.a"]);
  assert.deepEqual(ruleEntities(rule, null), ["binary_sensor.dark"]);
  assert.deepEqual(ruleEntities(null, "light.a"), []);
});

test("only rules with a time condition need the clock (#535)", () => {
  assert.equal(ruleTimed(all(self("on"))), false);
  assert.equal(ruleTimed(any(self("on"), { type: "time", days: [5] })), true);
  assert.equal(ruleTimed(null), false);
});

test("the rules of a plan: furniture and placed devices, each with its own 'this item' (#535)", () => {
  const b = emptyBuilding();
  const fl = newFloor("g", "Ground", 0);
  const lamp: Furniture = { id: "lamp1", type: "lamp_floor", x: 0, z: 0, rotation: 0, w: 1, d: 1, h: 1, variant: null, entity: "light.reading", show_rules: { icon: all(self("on")) } };
  const plain: Furniture = { id: "sofa", type: "sofa", x: 0, z: 0, rotation: 0, w: 1, d: 1, h: 1, variant: null };
  const plug: Placement = { entity_id: "switch.kettle", x: 0, z: 0, y: null, show_rules: { icon: all({ type: "time", start: "06:00", end: "09:00" }), card: any(self("on")) } };
  const bare: Placement = { entity_id: "sensor.t", x: 0, z: 0, y: null };
  fl.furniture.push(lamp, plain);
  fl.placements.push(plug, bare);
  b.floors.push(fl);
  const icons = itemRules(b, "icon");
  assert.deepEqual(icons.map((r) => [r.kind, r.key]), [["furniture", "lamp1"], ["placement", "switch.kettle"]]);
  assert.equal(itemRules(b, "card").length, 1);
  assert.equal(rulesTimed(b, "icon"), true);
  assert.equal(rulesTimed(b, "card"), false);
});
