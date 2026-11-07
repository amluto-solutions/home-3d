// The holidays' dates on the Extensions page (#287, #339): next showing as text, the next three windows, rules stored and reset.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RULES, seasonRules } from "../seasons.ts";
import { addedRule, asKind, cleanRule, clockMinutes, nextShowingText, nextWindows, windowText, withSeasonRules } from "./season-dates.ts";

const st = { lang: "en-GB", h12: false };
const t = (key: string, vars?: Record<string, string | number>) => (key === "season_next" ? `Next showing: ${vars?.when}` : key === "season_now_until" ? `Showing now until ${vars?.when}` : key);
// some ICU versions put a comma after the weekday when a year follows
const plain = (s: string) => s.replace(/,/g, "");
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

test("the next showing of Easter reads like the owner's example", () => {
  assert.equal(plain(nextShowingText([DEFAULT_RULES.easter], at(2026, 3, 1), st, t)), "Next showing: Fri 3 Apr – Mon 6 Apr 2026");
  assert.equal(plain(nextShowingText([DEFAULT_RULES.easter], at(2026, 4, 4), st, t)), "Showing now until Mon 6 Apr 2026");
  // after this year's Easter the next one is next year's (Sunday 28 March 2027: Good Friday 26th)
  assert.equal(plain(nextShowingText([DEFAULT_RULES.easter], at(2026, 4, 7), st, t)), "Next showing: Fri 26 Mar – Mon 29 Mar 2027");
});

test("a window over New Year names both years; a one-day window reads as one date; times appear where part way through a day", () => {
  const rules = seasonRules("twixmas", { twixmas: { from: "12-20", to: "01-03" } });
  assert.equal(plain(nextShowingText(rules, at(2026, 6, 1), st, t)), "Next showing: Sun 20 Dec 2026 – Sun 3 Jan 2027");
  assert.equal(plain(nextShowingText([DEFAULT_RULES.halloween], at(2026, 6, 1), st, t)), "Next showing: Sat 31 Oct 2026");
  const timed = [{ kind: "fixed" as const, month: 10, day: 31, start: "18:00", end: "23:30" }];
  assert.equal(plain(nextShowingText(timed, at(2026, 6, 1), st, t)), "Next showing: Sat 31 Oct 18:00 – Sat 31 Oct 2026 23:30");
  assert.equal(plain(nextShowingText([], at(2026, 6, 1), st, t)), "season_never");
});

test("the next three windows come from all the rules, soonest first, with no repeats", () => {
  const rules = [DEFAULT_RULES.halloween, { kind: "once" as const, from: "2026-11-09" }, { kind: "once" as const, from: "2026-06-01" }];
  const w = nextWindows(rules, clockMinutes(at(2026, 6, 2)), 3, 2026);
  assert.deepEqual(
    w.map((x) => plain(windowText(x, st))),
    ["Sat 31 Oct 2026", "Mon 9 Nov 2026", "Sun 31 Oct 2027"],
  );
  // a one-off in the past is not listed
  assert.equal(nextWindows([{ kind: "once", from: "2020-01-01" }], clockMinutes(at(2026, 1, 1)), 3, 2026).length, 0);
  // the one that is on is the first window
  const now = clockMinutes(at(2026, 10, 31));
  assert.equal(nextWindows([DEFAULT_RULES.halloween], now, 1, 2026)[0]!.from <= now, true);
});

test("changing the kind keeps the length and times; Add dates copies a one-off a year later, else starts a one-day one-off", () => {
  const timed = { kind: "fixed" as const, month: 10, day: 31, days: 3, start: "18:00", end: "02:00" };
  assert.deepEqual(asKind(timed, "easter", at(2026, 5, 5)), { kind: "easter", offset: 0, days: 3, start: "18:00", end: "02:00" });
  assert.deepEqual(asKind(timed, "once", at(2026, 5, 5)), { kind: "once", from: "2026-05-05", start: "18:00", end: "02:00" });
  assert.deepEqual(asKind(timed, "nth", at(2026, 5, 5)), { kind: "nth", nth: 1, weekday: 1, month: 5, days: 3, start: "18:00", end: "02:00" });
  assert.deepEqual(addedRule({ kind: "once", from: "2026-11-05", to: "2026-11-06" }, at(2026, 5, 5)), { kind: "once", from: "2027-11-05", to: "2027-11-06" });
  assert.deepEqual(addedRule(timed, at(2026, 5, 5)), { kind: "once", from: "2026-05-05" });
  assert.deepEqual(addedRule(undefined, at(2026, 5, 5)), { kind: "once", from: "2026-05-05" });
});

test("empty fields are left out of a stored rule", () => {
  assert.deepEqual(cleanRule({ kind: "fixed", month: 10, day: 31, start: "", end: undefined, days: NaN }), { kind: "fixed", month: 10, day: 31 });
  assert.deepEqual(cleanRule({ kind: "once", from: "2026-11-05", days: 2 }), { kind: "once", from: "2026-11-05" });
});

test("storing rules drops the holiday's old MM-DD entry (its days are in the rules now) and keeps the others; reset removes both", () => {
  const dates = { halloween: { from: "10-29", to: "11-01" }, christmas: { from: "12-20" } };
  const rules = [{ kind: "fixed" as const, month: 10, day: 29, days: 4 }];
  const one = withSeasonRules(undefined, dates, "halloween", rules);
  assert.deepEqual(one, { season_rules: { halloween: rules }, season_dates: { christmas: { from: "12-20" } } });
  const two = withSeasonRules(one.season_rules, one.season_dates, "easter", [{ kind: "easter", offset: -2, days: 4 }]);
  assert.deepEqual(Object.keys(two.season_rules!).sort(), ["easter", "halloween"]);
  assert.deepEqual(withSeasonRules(two.season_rules, two.season_dates, "easter", null).season_rules, { halloween: rules });
  const empty = withSeasonRules(one.season_rules, { christmas: { from: "12-20" } }, "halloween", null);
  assert.deepEqual(empty, { season_rules: undefined, season_dates: { christmas: { from: "12-20" } } });
  // removing every rule keeps an empty list (the holiday never shows) rather than going back to the usual days
  assert.deepEqual(withSeasonRules(undefined, undefined, "halloween", []).season_rules, { halloween: [] });
  // an entry that is not a date is dropped on the way
  assert.equal(withSeasonRules(undefined, { easter: { from: "nope" } }, "halloween", null).season_dates, undefined);
});
