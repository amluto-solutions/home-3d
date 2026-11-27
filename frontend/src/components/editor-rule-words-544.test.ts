// The shorter "Show and hide" editor (#544): each rule as one sentence from whole templates, the ready choices, the
// weekdays as seven buttons; and the solar card's second tap opening the zoom view (#545).

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { THIS_ITEM, type ShowRule } from "../model.ts";
import { lateEnglish as EN_LATE } from "../i18n-late.ts";
import { daysText, intlLocales, MARK, presetOf, presetRule, ruleWords, SUN, type Words } from "./editor/rule-words.ts";

const fill = (s: string, v: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? `{${k}}`));
const w: Words = {
  t: (k, v) => fill((EN_LATE as Record<string, string>)[k] ?? k, v),
  name: (id) => (id === "light.hall" ? "Hall light" : id),
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  time: (s) => s,
  list: (items, or) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${or ? "or" : "and"} ${items.at(-1)}`),
};
const plain = (s: string) => s.split(MARK).join("");

test("each rule reads as one sentence; no rule says the usual behaviour (#544)", () => {
  assert.equal(ruleWords(null, w, "Shows as usual"), "Shows as usual");
  assert.equal(plain(ruleWords({ match: "all", conditions: [{ type: "state", entity: THIS_ITEM, when: "on" }] }, w, "")), "Show when this item is on");
  assert.equal(plain(ruleWords({ match: "all", conditions: [{ type: "time", start: "07:00", end: "23:00", days: [5, 6] }] }, w, "")), "Show 07:00–23:00, Sat and Sun");
  assert.equal(plain(ruleWords({ match: "all", conditions: [{ type: "time", days: [0, 1, 2, 3, 4] }] }, w, "")), "Show on Mon–Fri");
  assert.equal(plain(ruleWords({ match: "all", conditions: [{ type: "time" }] }, w, "")), "Show at any time");
  const any: ShowRule = {
    match: "any",
    conditions: [
      { type: "state", entity: "light.hall", when: "above", value: 40 },
      { type: "state", entity: SUN, when: "state", state: "below_horizon" },
    ],
  };
  assert.equal(plain(ruleWords(any, w, "")), "Show when Hall light is above 40 or when it is dark");
  const long: ShowRule = { match: "all", conditions: [1, 2, 3, 4].map(() => ({ type: "state" as const, entity: THIS_ITEM, when: "off" as const })) };
  assert.match(plain(ruleWords(long, w, "")), /and 2 more$/, "four conditions: two said, the rest counted");
  // the parts that matter are marked (drawn bold), the glue is not
  assert.ok(ruleWords({ match: "all", conditions: [{ type: "state", entity: "light.hall", when: "on" }] }, w, "").includes(`${MARK}Hall light${MARK}`));
});

test("days: three or more in a row are a range, the rest a list (#544)", () => {
  assert.equal(daysText([0, 2, 4], w), "Mon, Wed and Fri");
  assert.equal(daysText([5, 6, 0, 1, 2], w), "Mon–Wed, Sat and Sun");
});

test("the ready choices set a whole rule in one tap and are found again; no fixed clock time in any (#544)", () => {
  for (const p of ["on", "off", "dark", "times"] as const) {
    const r = presetRule(p, null)!;
    assert.equal(presetOf(r), p, p);
    assert.ok(!JSON.stringify(r).match(/\d\d:\d\d/), `${p} has no fixed time`);
  }
  assert.equal(presetRule("none", presetRule("on", null)), null, "No rule removes it");
  const timed: ShowRule = { match: "all", conditions: [{ type: "time", start: "07:00", end: "09:00" }] };
  assert.deepEqual(presetRule("times", timed), timed, "a second tap on At set times keeps the times");
  assert.equal(presetOf({ match: "all", conditions: [{ type: "state", entity: THIS_ITEM, when: "on", unavailable: "hide" }] }), "custom");
  assert.equal(presetOf({ match: "any", conditions: [{ type: "time" }, { type: "time" }] }), "custom");
  assert.equal(presetRule("custom", timed), timed, "Custom keeps the rule");
});

test("weekdays are seven pressed buttons with the full day name; one rule open at a time (#544)", () => {
  const src = readFileSync(new URL("./editor/show-rules.ts", import.meta.url), "utf8");
  assert.ok(src.includes(`aria-pressed=\${days.includes(d) ? "true" : "false"} aria-label=\${long[d]}`));
  assert.ok(src.includes("let openRule: string | null = null;"));
  assert.ok(!src.includes('type="checkbox"'), "no day switches left");
});

test("Nynorsk sentences join lists and weekdays in Bokmål where Intl has no Nynorsk (Chrome), never in English (#544)", () => {
  assert.deepEqual(intlLocales("nn"), ["nn", "nb"]);
  assert.deepEqual(intlLocales("nn-NO"), ["nn-NO", "nb"]);
  assert.equal(intlLocales("de"), "de");
  assert.equal(intlLocales(undefined), undefined);
  const src = readFileSync(new URL("./editor/show-rules.ts", import.meta.url), "utf8");
  assert.equal(src.match(/new Intl\.(?:ListFormat|DateTimeFormat)\(intlLocales\(lang\)/g)?.length, 3, "lists, weekdays and the Object row's days (#547)");
});
