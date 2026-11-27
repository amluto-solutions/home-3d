// The Object row (#547): a furniture item's "When it shows" rule (`show_when`) as the first row of "Show and hide", in
// the same sentence form as the icon and card rules. The data, the plan format and what a saved plan does stay the same.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { ShowWhen } from "../model.ts";
import { lateEnglish as EN_LATE } from "../i18n-late.ts";
import { englishTable } from "../i18n.ts";
import { MARK, SUN, whenPresetOf, whenPresetRule, whenWords, type Words } from "./editor/rule-words.ts";

const fill = (s: string, v: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? `{${k}}`));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const w: Words = {
  t: (k, v) => fill((EN_LATE as Record<string, string>)[k] ?? k, v),
  name: (id) => (id === "binary_sensor.guests" ? "Guests" : id),
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  time: (s) => s,
  list: (items, or) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${or ? "or" : "and"} ${items.at(-1)}`),
  date: (d) => `${Number(d.slice(3))} ${MONTHS[Number(d.slice(0, 2)) - 1]}`,
};
const say = (r: ShowWhen | null) => whenWords(r, w, "Always shows").split(MARK).join("");

test("a saved When it shows rule reads as one sentence (#547)", () => {
  assert.equal(say(null), "Always shows");
  assert.equal(say({}), "Always shows", "an empty rule is no rule, as the plan heals it on load");
  assert.equal(say({ entity: "binary_sensor.guests", when: "on", intervals: [{ start: "07:00", end: "23:00" }] }), "Show when Guests is on and 07:00–23:00");
  assert.equal(say({ entity: "binary_sensor.guests" }), "Show while Guests is available");
  assert.equal(say({ entity: "binary_sensor.guests", when: "off" }), "Show when Guests is off");
  assert.equal(say({ entity: "binary_sensor.guests", when: "state", state: "party, dinner" }), "Show when Guests is party, dinner");
  assert.equal(say({ intervals: [{ from: "12-01", to: "01-06" }] }), "Show 1 Dec–6 Jan");
  assert.equal(say({ intervals: [{ from: "12-01", to: "12-31", start: "16:00", end: "23:00" }] }), "Show 16:00–23:00, 1 Dec–31 Dec");
  assert.equal(say({ intervals: [{}] }), "Show at any time");
  assert.equal(say({ intervals: [{ from: "12-01", to: "12-31" }, { from: "04-01", to: "04-20" }] }), "Show 1 Dec–31 Dec or 1 Apr–20 Apr");
  assert.match(say({ intervals: [{}, {}, {}, {}, {}] }), /or 3 more$/, "five intervals: two said, the rest counted");
  assert.equal(say({ entity: SUN, when: "state", state: "below_horizon" }), "Show when it is dark");
});

test("the ready choices only make what show_when stores: no weekdays, no 'this item', no fixed time (#547)", () => {
  assert.equal(whenPresetRule("none", { intervals: [{}] }), null);
  assert.deepEqual(whenPresetRule("dark", null), { entity: SUN, when: "state", state: "below_horizon" });
  assert.deepEqual(whenPresetRule("times", null), { intervals: [{}] });
  const xmas: ShowWhen = { intervals: [{ from: "12-01", to: "01-06" }] };
  assert.deepEqual(whenPresetRule("times", xmas), xmas, "a second tap keeps the dates");
  for (const p of ["dark", "times"] as const) {
    const r = whenPresetRule(p, null)!;
    assert.equal(whenPresetOf(r), p, p);
    assert.ok(!JSON.stringify(r).match(/\d\d:\d\d|days|this_item|conditions/), `${p} is plain show_when`);
  }
  assert.equal(whenPresetOf({ entity: "binary_sensor.guests", when: "on" }), "custom");
  assert.equal(whenPresetOf({ entity: SUN, when: "state", state: "below_horizon", unavailable: "hide" }), "custom");
  assert.equal(whenPresetOf({ intervals: [{}, {}] }), "custom");
  const kept: ShowWhen = { entity: "binary_sensor.guests", intervals: [{ start: "07:00", end: "09:00" }] };
  assert.equal(whenPresetRule("custom", kept), kept, "Custom keeps the rule as it is");
});

test("the old section is gone; the Object row is first and only on furniture, without copy and paste (#547)", () => {
  const form = readFileSync(new URL("./editor/item-form.ts", import.meta.url), "utf8");
  assert.ok(!form.includes("renderShowWhen"), "no separate When it shows section");
  const folds = readFileSync(new URL("./editor/item-folds.ts", import.meta.url), "utf8");
  assert.ok(!folds.includes("renderShowWhen"));
  assert.match(folds, /renderShowRules\(this, `f:\$\{f\.id\}`[\s\S]*?set: \(r\) => this\.updateFurniture\(\{ show_when: r \}\)/, "furniture passes its show_when");
  const device = readFileSync(new URL("./editor/device-panel.ts", import.meta.url), "utf8");
  assert.match(device, /renderShowRules\(this, `p:\$\{pl\.entity_id\}`, pl\.show_rules, pl\.entity_id, \(r\) => this\.updateDevice\(\{ show_rules: r \}\)\)\)/, "a placed device keeps two rows");
  const rules = readFileSync(new URL("./editor/show-rules.ts", import.meta.url), "utf8");
  const section = rules.slice(rules.indexOf("export function renderShowRules"));
  assert.ok(section.indexOf("renderObjectBlock") < section.indexOf('`${id}:icon`'), "Object above Icon and Card");
  const object = rules.slice(rules.indexOf("function renderObjectOpen"), rules.indexOf("function renderObjectCustom"));
  assert.ok(!/copyRule|copiedRule|rules_paste/.test(object), "no copy and paste on the Object row");
  assert.ok(object.includes('host.t("rules_object_note")'), "it says it hides the whole item");
  // as the old section: up to 12 intervals, the state options only with an entity
  assert.ok(rules.includes("list.length >= 12"));
});

test("the Object row's English texts are there; the old heading and ghost line are gone (#547)", () => {
  const all = englishTable() as Record<string, string>;
  for (const k of ["rules_object", "rules_object_note", "rules_s_always", "rules_c_available", "rules_p_dates", "show_when_hint", "show_when_entity", "show_add_interval"]) assert.ok(all[k], k);
  assert.ok(!("show_when" in all) && !("show_when_ghost" in all));
  assert.match(all.rules_object_note, /whole item/);
});
