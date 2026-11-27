// A show rule in words, and the ready choices (#544). The editor's "Show and hide" rows say each rule as one plain
// sentence ("Show when this item is on", "Show 07:00–23:00, Sat and Sun") and offer choices that set a whole rule in one
// tap. Pure: the texts come in through `t`, so every sentence is a whole template with placeholders in each language.
// Part of the editor's lazy "Show and hide" chunk; the rule format of the plan does not change. The Object row (#547)
// says an item's "When it shows" rule (`show_when`) the same way, at the end of this file.

import { THIS_ITEM, type RuleCondition, type ShowInterval, type ShowRule, type ShowWhen } from "../../model.ts";
import type { I18nKey } from "../../i18n.ts";

/** The ready choices: no rule, this item on or off, a time window, dark outside, or anything else (custom). */
export type Preset = "none" | "on" | "off" | "times" | "dark" | "custom";

/** Home Assistant's sun: "when it is dark" asks it to be below the horizon (offered only where it exists). */
export const SUN = "sun.sun";
const DARK = "below_horizon";

/** Parts of a sentence that stand out (a name, a time, the days) are wrapped in this mark: the row draws them in bold. */
export const MARK = "\u0001";
const em = (s: string) => `${MARK}${s}${MARK}`;

/** Which ready choice the rule is; "custom" for anything the choices do not make. */
export function presetOf(rule: ShowRule | null | undefined): Preset {
  if (!rule?.conditions?.length) return "none";
  if (rule.conditions.length !== 1) return "custom";
  const c = rule.conditions[0];
  if (c.type === "time") return "times";
  if (c.type !== "state" || c.unavailable === "hide") return "custom";
  if (c.entity === THIS_ITEM && (c.when === "on" || c.when === "off")) return c.when;
  if (c.entity === SUN && c.when === "state" && c.state === DARK) return "dark";
  return "custom";
}

/**
 * The rule a ready choice sets. "times" keeps a time window already there (so a second tap loses nothing) and is
 * otherwise an open window the user then sets; "custom" keeps the rule as it is.
 */
export function presetRule(p: Preset, rule: ShowRule | null | undefined): ShowRule | null {
  const cur = rule?.conditions?.length ? rule : null;
  const one = (c: RuleCondition): ShowRule => ({ match: "all", conditions: [c] });
  if (p === "none") return null;
  if (p === "on" || p === "off") return one({ type: "state", entity: THIS_ITEM, when: p });
  if (p === "dark") return one({ type: "state", entity: SUN, when: "state", state: DARK });
  if (p === "times") return one(cur?.conditions.find((c) => c.type === "time") ?? { type: "time" });
  return cur;
}

export interface Words {
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
  /** An entity's name ("this item" is said by the template, not here). */
  name: (entity: string) => string;
  /** Weekday names, Monday first. */
  days: string[];
  /** "HH:MM" as the user reads a time. */
  time: (hhmm: string) => string;
  /** A list joined the language's way: "a, b and c" (and) or "a, b or c" (or). */
  list: (items: string[], or: boolean) => string;
  /** A day of the year, "MM-DD", as the user reads it ("1 Dec"); only the Object row (#547) says days of the year. */
  date?: (mmdd: string) => string;
}

/**
 * The locales Intl formats a sentence's lists and weekdays with. Chrome has no Nynorsk there and would take the
 * browser's own language (English days and "and" in a Nynorsk sentence): Bokmål stands in for it.
 */
export function intlLocales(lang: string | undefined): string | string[] | undefined {
  return lang && /^nn\b/i.test(lang) ? [lang, "nb"] : lang || undefined;
}

/** Weekdays as short text: three or more days in a row become a range ("Mon–Fri"), the rest a list. */
export function daysText(days: number[], w: Words): string {
  const d = [...new Set(days)].filter((x) => x >= 0 && x <= 6).sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < d.length; ) {
    let j = i;
    while (j + 1 < d.length && d[j + 1] === d[j] + 1) j++;
    if (j - i >= 2) parts.push(`${w.days[d[i]]}–${w.days[d[j]]}`);
    else for (let k = i; k <= j; k++) parts.push(w.days[d[k]]);
    i = j + 1;
  }
  return w.list(parts, false);
}

/** One condition as a clause of the sentence ("when this item is on", "07:00–23:00, Sat and Sun"). */
export function conditionWords(c: RuleCondition, w: Words): string {
  if (c.type === "time") {
    const span = c.start && c.end ? em(`${w.time(c.start)}–${w.time(c.end)}`) : "";
    const days = c.days?.length ? em(daysText(c.days, w)) : "";
    if (span && days) return w.t("rules_c_time_days", { time: span, days });
    if (span) return span;
    if (days) return w.t("rules_c_days", { days });
    return w.t("rules_c_always");
  }
  if (c.type !== "state") return "…";
  if (c.entity === SUN && c.when === "state" && c.state === DARK) return w.t("rules_c_dark");
  const self = c.entity === THIS_ITEM;
  const name = em(self ? w.t("rules_c_self") : w.name(c.entity));
  if (c.when === "on" || c.when === "off") return w.t(c.when === "on" ? "rules_c_on" : "rules_c_off", { name });
  if (c.when === "above" || c.when === "below") return w.t(c.when === "above" ? "rules_c_above" : "rules_c_below", { name, value: em(String(c.value ?? 0)) });
  return w.t("rules_c_state", { name, state: em(c.state?.trim() || "…") });
}

/** The whole rule as one sentence; no rule: `none` (the item's usual behaviour in words). Long rules end in "+2 more". */
export function ruleWords(rule: ShowRule | null | undefined, w: Words, none: string): string {
  const cs = rule?.conditions ?? [];
  if (!cs.length) return none;
  const shown = cs.slice(0, cs.length > 3 ? 2 : 3).map((c) => conditionWords(c, w));
  if (shown.length < cs.length) shown.push(w.t("rules_c_more", { n: cs.length - shown.length }));
  return w.t("rules_s_show", { list: w.list(shown, rule!.match === "any") });
}

// The Object row (#547): the item's "When it shows" rule (`show_when`, #15, #338) in the same sentence form. Only what
// `show_when` can store is offered: an entity (available, on, off, a typed state) and intervals of days of the year and
// times of day. It has no weekdays and no "this item", so neither is offered there.

/** The ready choices of the Object row: always, dates and times, dark outside, or anything else (custom). */
export type WhenPreset = "none" | "times" | "dark" | "custom";

const hasEntity = (r: ShowWhen) => !!r.entity && r.entity !== "none";

/** Which ready choice an item's `show_when` is. */
export function whenPresetOf(rule: ShowWhen | null | undefined): WhenPreset {
  const ivs = rule?.intervals ?? [];
  if (!rule || (!hasEntity(rule) && !ivs.length)) return "none";
  if (!hasEntity(rule)) return ivs.length === 1 ? "times" : "custom";
  if (!ivs.length && rule.entity === SUN && rule.when === "state" && rule.state === DARK && rule.unavailable !== "hide") return "dark";
  return "custom";
}

/** The `show_when` a ready choice sets: "times" keeps the first interval there (else an open one), "custom" keeps it all. */
export function whenPresetRule(p: WhenPreset, rule: ShowWhen | null | undefined): ShowWhen | null {
  if (p === "none") return null;
  if (p === "dark") return { entity: SUN, when: "state", state: DARK };
  if (p === "times") return { intervals: [rule?.intervals?.[0] ?? {}] };
  return whenPresetOf(rule) === "none" ? null : (rule as ShowWhen);
}

/** One interval as a clause: "07:00–23:00", "1 Dec–6 Jan", "07:00–23:00, 1 Dec–6 Jan" or "at any time". */
function intervalWords(iv: ShowInterval, w: Words): string {
  const date = w.date ?? ((d: string) => d);
  const span = iv.start && iv.end ? em(`${w.time(iv.start)}–${w.time(iv.end)}`) : "";
  const days = iv.from && iv.to ? em(`${date(iv.from)}–${date(iv.to)}`) : "";
  if (span && days) return w.t("rules_c_time_days", { time: span, days });
  return span || days || w.t("rules_c_always");
}

/** An item's `show_when` as one sentence: the entity's clause and the intervals (any one of them will do); none: `none`. */
export function whenWords(rule: ShowWhen | null | undefined, w: Words, none: string): string {
  if (!rule || whenPresetOf(rule) === "none") return none;
  const parts: string[] = [];
  if (hasEntity(rule)) {
    const e = rule.entity as string;
    const name = em(w.name(e));
    if (!rule.when) parts.push(w.t("rules_c_available", { name }));
    else if (e === SUN && rule.when === "state" && rule.state === DARK) parts.push(w.t("rules_c_dark"));
    else if (rule.when === "on" || rule.when === "off") parts.push(w.t(rule.when === "on" ? "rules_c_on" : "rules_c_off", { name }));
    else parts.push(w.t("rules_c_state", { name, state: em(rule.state?.trim() || "…") }));
  }
  const ivs = rule.intervals ?? [];
  if (ivs.length) {
    const said = ivs.slice(0, ivs.length > 3 ? 2 : 3).map((iv) => intervalWords(iv, w));
    if (said.length < ivs.length) said.push(w.t("rules_c_more", { n: ivs.length - said.length }));
    parts.push(w.list(said, true));
  }
  return w.t("rules_s_show", { list: w.list(parts, false) });
}
