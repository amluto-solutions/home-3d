// Holiday date rules (#339): Easter from the computus, n-th and last weekdays, windows over New Year, overlaps, times and the old "MM-DD" data.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RULES, easterSunday, ruleDays, ruleWindow, seasonAt, seasonRules, type SeasonRule } from "./seasons.ts";

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const day = (n: number) => new Date(n * 864e5).toISOString().slice(0, 10);
const days = (r: SeasonRule, y: number) => ruleDays(r, y)!.map(day);
const who = (now: Date, rules: Record<string, SeasonRule[]>, off?: Record<string, boolean>) => seasonAt(now, off, undefined, rules)?.id ?? null;

test("Easter Sunday for 2024 to 2035 (the Gregorian computus)", () => {
  const known: Record<number, string> = {
    2024: "03-31",
    2025: "04-20",
    2026: "04-05",
    2027: "03-28",
    2028: "04-16",
    2029: "04-01",
    2030: "04-21",
    2031: "04-13",
    2032: "03-28",
    2033: "04-17",
    2034: "04-09",
    2035: "03-25",
  };
  for (const [y, md] of Object.entries(known)) {
    const [m, d] = easterSunday(Number(y));
    assert.equal(`${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, md, y);
    assert.equal(days({ kind: "easter", offset: 0 }, Number(y))[0], `${y}-${md}`);
  }
});

test("days from Easter: Good Friday, Easter Monday, Mothering Sunday, Pancake Day and a window", () => {
  assert.deepEqual(days({ kind: "easter", offset: -2 }, 2026), ["2026-04-03", "2026-04-03"]);
  assert.deepEqual(days({ kind: "easter", offset: 1 }, 2026), ["2026-04-06", "2026-04-06"]);
  assert.deepEqual(days({ kind: "easter", offset: -21 }, 2026), ["2026-03-15", "2026-03-15"]);
  assert.deepEqual(days({ kind: "easter", offset: -47 }, 2028), ["2028-02-29", "2028-02-29"]);
  assert.deepEqual(days({ kind: "easter", offset: -2, days: 4 }, 2024), ["2024-03-29", "2024-04-01"]);
  assert.deepEqual(days(DEFAULT_RULES.easter, 2024), ["2024-03-29", "2024-04-01"]);
});

test("n-th weekday of a month, and the last", () => {
  const mon = (nth: number, month: number): SeasonRule => ({ kind: "nth", nth, weekday: 1, month });
  assert.deepEqual(days(mon(-1, 5), 2026), ["2026-05-25", "2026-05-25"]); // late May bank holiday
  assert.deepEqual(days(mon(-1, 5), 2027), ["2027-05-31", "2027-05-31"]);
  assert.deepEqual(days({ kind: "nth", nth: 4, weekday: 4, month: 11 }, 2026), ["2026-11-26", "2026-11-26"]); // 4th Thursday of November
  assert.deepEqual(days({ kind: "nth", nth: 2, weekday: 0, month: 5 }, 2026), ["2026-05-10", "2026-05-10"]); // 2nd Sunday of May
  assert.deepEqual(days({ kind: "nth", nth: 1, weekday: 0, month: 2 }, 2026), ["2026-02-01", "2026-02-01"]); // the month starts on it
  assert.deepEqual(days({ kind: "nth", nth: -1, weekday: 0, month: 11 }, 2026), ["2026-11-29", "2026-11-29"]); // the last Sunday
  assert.deepEqual(days({ kind: "nth", nth: -1, weekday: 3, month: 12 }, 2026), ["2026-12-30", "2026-12-30"]); // December runs into January
  // February 2026 has four Mondays only: there is no fifth; March 2026 has five
  assert.equal(ruleDays(mon(5, 2), 2026), null);
  assert.deepEqual(days(mon(5, 3), 2026), ["2026-03-30", "2026-03-30"]);
});

test("fixed days: 29 February exists only in leap years", () => {
  const leap: SeasonRule = { kind: "fixed", month: 2, day: 29 };
  assert.deepEqual(days(leap, 2028), ["2028-02-29", "2028-02-29"]);
  assert.equal(ruleDays(leap, 2027), null);
  assert.equal(ruleDays({ kind: "fixed", month: 4, day: 31 }, 2026), null);
});

test("a one-off window belongs to its year only and may be one day", () => {
  const party: SeasonRule = { kind: "once", from: "2027-03-12", to: "2027-03-14" };
  assert.deepEqual(days(party, 2020), ["2027-03-12", "2027-03-14"]);
  assert.equal(who(at(2027, 3, 13), { easter: [party] }), "easter");
  assert.equal(who(at(2028, 3, 13), { easter: [party] }), null);
  assert.deepEqual(days({ kind: "once", from: "2027-03-12" }, 1), ["2027-03-12", "2027-03-12"]);
  assert.equal(ruleDays({ kind: "once", from: "2027-03-14", to: "2027-03-12" }, 1), null);
  assert.equal(ruleDays({ kind: "once", from: "soon" }, 1), null);
});

test("a window over New Year shows on both sides, in both years", () => {
  const r: SeasonRule = { kind: "fixed", month: 12, day: 28, days: 8 };
  const rules = { boxing_day: [r] };
  const off = { twixmas: false, nye: false, new_year: false };
  assert.equal(who(at(2026, 12, 27), rules, off), null);
  assert.equal(who(at(2026, 12, 28), rules, off), "boxing_day");
  assert.equal(who(at(2027, 1, 4), rules, off), "boxing_day");
  assert.equal(who(at(2027, 1, 5), rules, off), null);
  assert.deepEqual(days(r, 2026), ["2026-12-28", "2027-01-04"]);
});

test("start and end times cut the first and last day; an end before the start runs into the next morning", () => {
  const timed: SeasonRule = { kind: "fixed", month: 10, day: 30, days: 3, start: "18:00", end: "02:00" };
  const rules = { halloween: [timed] };
  assert.equal(who(at(2026, 10, 30, 17, 59), rules), null);
  assert.equal(who(at(2026, 10, 30, 18, 0), rules), "halloween");
  assert.equal(who(at(2026, 10, 31, 23, 0), rules), "halloween");
  assert.equal(who(at(2026, 11, 1, 1, 59), rules), "halloween");
  assert.equal(who(at(2026, 11, 1, 2, 0), rules), null);
  const night: SeasonRule = { kind: "fixed", month: 10, day: 31, start: "20:00", end: "06:00" };
  assert.equal(who(at(2026, 11, 1, 5, 0), { halloween: [night] }), "halloween");
  assert.equal(who(at(2026, 11, 1, 6, 0), { halloween: [night] }), null);
  const w = ruleWindow(night, 2026)!;
  assert.equal(w[1] - w[0], 10 * 60);
});

test("several rules: any of them shows the holiday", () => {
  const rules = { halloween: [{ kind: "fixed", month: 10, day: 31 } as SeasonRule, { kind: "once", from: "2026-11-09" } as SeasonRule] };
  assert.equal(who(at(2026, 10, 31), rules), "halloween");
  assert.equal(who(at(2026, 11, 9), rules), "halloween");
  assert.equal(who(at(2026, 11, 10), rules), null);
  // a holiday with an empty list never shows
  assert.equal(who(at(2026, 10, 31), { halloween: [] }), null);
  // switched off still wins
  assert.equal(who(at(2026, 10, 31), rules, { halloween: false }), null);
});

test("when windows overlap the shorter one wins; equal lengths keep the usual order", () => {
  // advent (1-23 December) against a one day Christmas Eve rule moved into it
  const rules = { christmas_eve: [{ kind: "fixed", month: 12, day: 10 } as SeasonRule] };
  assert.equal(who(at(2026, 12, 10), rules), "christmas_eve");
  assert.equal(who(at(2026, 12, 11), rules), "advent");
  // a long Halloween week against Bonfire Night's day: the day wins
  const week = { halloween: [{ kind: "fixed", month: 10, day: 30, days: 8 } as SeasonRule] };
  assert.equal(who(at(2026, 11, 4), week), "halloween");
  assert.equal(who(at(2026, 11, 5), week), "bonfire");
  // New Year's Eve (one day) against Twixmas (five days)
  assert.equal(who(at(2026, 12, 31), {}), "nye");
  // one day each: Chinese New Year comes first in the order
  assert.equal(who(at(2026, 2, 17), {}), "chinese_new_year");
});

test("old MM-DD dates load as fixed day rules, unchanged", () => {
  assert.deepEqual(seasonRules("halloween", { halloween: { from: "10-29", to: "11-01" } }), [{ kind: "fixed", month: 10, day: 29, days: 4 }]);
  assert.deepEqual(seasonRules("halloween", { halloween: { from: "10-25" } }), [{ kind: "fixed", month: 10, day: 25, days: 1 }]);
  // over New Year: 20 December to 3 January is 15 days
  assert.deepEqual(seasonRules("twixmas", { twixmas: { from: "12-20", to: "01-03" } }), [{ kind: "fixed", month: 12, day: 20, days: 15 }]);
  // not a date: the usual rule; no data: the usual rule; rules win over old dates
  assert.deepEqual(seasonRules("halloween", { halloween: { from: "13-40" } }), [DEFAULT_RULES.halloween]);
  assert.deepEqual(seasonRules("halloween"), [DEFAULT_RULES.halloween]);
  const own: SeasonRule[] = [{ kind: "fixed", month: 10, day: 1 }];
  assert.deepEqual(seasonRules("halloween", { halloween: { from: "10-29" } }, { halloween: own }), own);
  // and they evaluate as before
  const old = { halloween: { from: "10-29", to: "11-01" } };
  assert.equal(seasonAt(at(2026, 10, 29), undefined, old)?.id, "halloween");
  assert.equal(seasonAt(at(2026, 11, 1), undefined, old)?.id, "halloween");
  assert.equal(seasonAt(at(2026, 11, 2), undefined, old), null);
  const wrap = { chinese_new_year: { from: "12-30", to: "01-02" } };
  assert.equal(seasonAt(at(2027, 1, 2), { new_year: false }, wrap)?.id, "chinese_new_year");
  assert.equal(seasonAt(at(2027, 1, 3), undefined, wrap), null);
});

test("the usual rule of Easter 2026 is Friday to Monday", () => {
  assert.equal(seasonAt(at(2026, 4, 3))?.id, "easter");
  assert.equal(seasonAt(at(2026, 4, 6, 23, 59))?.id, "easter");
  assert.equal(seasonAt(at(2026, 4, 7)), null);
});
