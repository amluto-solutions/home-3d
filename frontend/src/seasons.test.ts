import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RULES, SEASON_IDS, calendarChineseNewYear, chineseNewYear, easterSunday, parseMonthDay, ruleDays, seasonAt, seasonRules, type SeasonRule } from "./seasons.ts";

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
/** The first day of a rule in a year as [month, day]. */
const first = (r: SeasonRule, y: number): [number, number] => {
  const t = new Date(ruleDays(r, y)![0] * 864e5);
  return [t.getUTCMonth() + 1, t.getUTCDate()];
};
const pancakeDay = (y: number) => first(DEFAULT_RULES.pancake_day, y);
const mothersDay = (y: number) => first(DEFAULT_RULES.mothers_day, y);
const fathersDay = (y: number) => first(DEFAULT_RULES.fathers_day, y);
const remembranceSunday = (y: number) => first(DEFAULT_RULES.remembrance, y);
const id = (y: number, m: number, d: number, off?: Record<string, boolean>, h = 12) => seasonAt(at(y, m, d, h), off)?.id ?? null;

test("Easter Sunday follows the computus across years (#239)", () => {
  const known: Record<number, [number, number]> = {
    2019: [4, 21],
    2020: [4, 12],
    2021: [4, 4],
    2022: [4, 17],
    2023: [4, 9],
    2024: [3, 31],
    2025: [4, 20],
    2026: [4, 5],
    2027: [3, 28],
    2028: [4, 16],
    2029: [4, 1],
    2030: [4, 21],
    2038: [4, 25],
  };
  for (const [y, md] of Object.entries(known)) assert.deepEqual(easterSunday(Number(y)), md, y);
});

test("Pancake Day is 47 days before Easter (#239)", () => {
  const known: Record<number, [number, number]> = { 2023: [2, 21], 2024: [2, 13], 2025: [3, 4], 2026: [2, 17], 2027: [2, 9], 2028: [2, 29], 2029: [2, 13], 2030: [3, 5] };
  for (const [y, md] of Object.entries(known)) assert.deepEqual(pancakeDay(Number(y)), md, y);
  assert.equal(first({ kind: "easter", offset: -47 }, 2024)[0], 2);
});

test("Mother's Day (UK) is Easter minus 21 days, always a Sunday (#239)", () => {
  const known: Record<number, [number, number]> = { 2023: [3, 19], 2024: [3, 10], 2025: [3, 30], 2026: [3, 15], 2027: [3, 7], 2028: [3, 26], 2029: [3, 11], 2030: [3, 31] };
  for (const [y, md] of Object.entries(known)) {
    assert.deepEqual(mothersDay(Number(y)), md, y);
    assert.equal(new Date(Number(y), md[0] - 1, md[1]).getDay(), 0, `${y} is a Sunday`);
  }
});

test("Father's Day is the third Sunday of June (#239)", () => {
  const known: Record<number, number> = { 2023: 18, 2024: 16, 2025: 15, 2026: 21, 2027: 20, 2028: 18, 2029: 17, 2030: 16 };
  for (const [y, d] of Object.entries(known)) assert.deepEqual(fathersDay(Number(y)), [6, d], y);
});

test("Remembrance Sunday is the second Sunday of November (#239)", () => {
  const known: Record<number, number> = { 2023: 12, 2024: 10, 2025: 9, 2026: 8, 2027: 14, 2028: 12, 2029: 11, 2030: 10 };
  for (const [y, d] of Object.entries(known)) assert.deepEqual(remembranceSunday(Number(y)), [11, d], y);
});

test("the n-th weekday handles a month that starts on a Sunday (#239)", () => {
  // 1 June 2025 is a Sunday: the third is the 15th; 1 Feb 2026 too
  assert.equal(first({ kind: "nth", nth: 3, weekday: 0, month: 6 }, 2025)[1], 15);
  assert.equal(first({ kind: "nth", nth: 1, weekday: 0, month: 2 }, 2026)[1], 1);
});

test("each moving holiday shows on its day and not the day before or after (#239)", () => {
  // 2026: Chinese New Year is on Pancake Day, and wins (#287); switched off, Pancake Day shows
  assert.equal(id(2026, 2, 17), "chinese_new_year");
  assert.equal(id(2026, 2, 17, { chinese_new_year: false }), "pancake_day");
  assert.equal(id(2026, 2, 16), null);
  assert.equal(id(2026, 2, 18), null);
  assert.equal(id(2026, 3, 15), "mothers_day");
  assert.equal(id(2026, 3, 22), null);
  assert.equal(id(2026, 6, 21), "fathers_day");
  assert.equal(id(2026, 6, 14), null);
  assert.equal(id(2026, 11, 8), "remembrance");
  assert.equal(id(2026, 11, 15), null);
  // 2027: Easter on 28 March, Mothering Sunday on the 7th
  assert.equal(id(2027, 3, 7), "mothers_day");
  assert.equal(id(2027, 11, 14), "remembrance");
});

test("Easter runs from Good Friday to Easter Monday, also over a month end (#239)", () => {
  // 2026: Sunday 5 April
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map((d) => id(2026, 4, d)), [null, "easter", "easter", "easter", "easter", null, null]);
  // 2024: Sunday 31 March, Monday 1 April
  assert.deepEqual([28, 29, 30, 31].map((d) => id(2024, 3, d)), [null, "easter", "easter", "easter"]);
  assert.equal(id(2024, 3, 29), "easter");
  assert.equal(id(2024, 4, 1), "easter");
  assert.equal(id(2024, 4, 2), null);
  assert.equal(id(2024, 3, 27), null);
});

test("the fixed holidays are on their dates (#239)", () => {
  assert.equal(id(2026, 1, 1), "new_year");
  assert.equal(id(2026, 2, 14), "valentines");
  assert.equal(id(2026, 11, 5), "bonfire");
  assert.equal(id(2026, 12, 24), "christmas_eve");
  assert.equal(id(2026, 12, 25), "christmas");
  assert.equal(id(2026, 12, 26), "boxing_day");
  assert.equal(id(2026, 12, 27), "twixmas");
  assert.equal(id(2026, 12, 30), "twixmas");
  assert.equal(id(2026, 12, 31), "nye");
  assert.equal(id(2026, 7, 15), null);
  assert.equal(id(2026, 10, 31), "halloween", "Halloween is one of the holidays since #287");
});

test("Advent counts the sleeps to Christmas from 1 December (#239)", () => {
  assert.equal(id(2026, 11, 30), null);
  const first = seasonAt(at(2026, 12, 1));
  assert.equal(first?.id, "advent");
  assert.deepEqual([first?.key, first?.vars.n], ["season_advent", 24]);
  assert.equal(seasonAt(at(2026, 12, 22))?.vars.n, 3);
  assert.equal(seasonAt(at(2026, 12, 23))?.vars.n, 2, "the last day before Christmas Eve");
});

test("New Year's Eve counts down the hours, then the minutes, and fireworks come in the evening (#239)", () => {
  const eve = (h: number, m: number) => seasonAt(at(2026, 12, 31, h, m))!;
  assert.deepEqual([eve(18, 0).key, eve(18, 0).vars], ["season_nye_hours", { n: 6, year: 2027 }]);
  assert.equal(eve(18, 30).vars.n, 6, "5.5 hours left rounds up");
  assert.deepEqual([eve(23, 0).key, eve(23, 0).vars.n], ["season_nye_minutes", 60]);
  assert.deepEqual([eve(23, 35).key, eve(23, 35).vars.n], ["season_nye_minutes", 25]);
  assert.deepEqual([eve(23, 59).key, eve(23, 59).vars.n], ["season_nye_minute", 1]);
  assert.equal(eve(12, 0).effect, "sparkles");
  assert.equal(eve(20, 0).effect, "fireworks");
  assert.equal(seasonAt(at(2027, 1, 1))?.vars.year, 2027);
});

test("a holiday switched off is skipped; the other holiday of the day shows instead (#239)", () => {
  assert.equal(id(2026, 12, 25, { christmas: false }), null);
  assert.equal(id(2026, 12, 25, { boxing_day: false }), "christmas");
  assert.equal(id(2026, 12, 31, { nye: false }), "twixmas");
  assert.equal(id(2026, 12, 31, { nye: false, twixmas: false }), null);
  assert.equal(id(2026, 4, 3, { easter: false }), null);
  assert.equal(id(2026, 4, 3, { easter: true }), "easter");
  // a Pancake Day on Valentine's Day (Easter on 1 April): Valentine's wins, and switched off Pancake Day shows
  assert.deepEqual(pancakeDay(2040), [2, 14]);
  assert.equal(id(2040, 2, 14), "valentines");
  assert.equal(id(2040, 2, 14, { valentines: false }), "pancake_day");
});

test("every holiday has a day it shows on in a normal year (#239)", () => {
  const seen = new Set<string>();
  for (let t = new Date(2027, 0, 1); t.getFullYear() === 2027; t.setDate(t.getDate() + 1)) {
    const s = seasonAt(new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12));
    if (s) seen.add(s.id);
  }
  assert.deepEqual([...seen].sort(), [...SEASON_IDS].sort());
});

// ---- Halloween, Chinese New Year and editable dates (#287)

test("Halloween is a holiday on 31 October, with its own greeting and effect (#287)", () => {
  assert.equal(id(2026, 10, 31), "halloween");
  assert.equal(id(2026, 10, 30), null);
  assert.equal(id(2026, 10, 31, { halloween: false }), null);
  const s = seasonAt(at(2026, 10, 31))!;
  assert.equal(s.effect, "halloween");
  assert.equal(s.key, "season_halloween");
});

test("Chinese New Year is worked out from the Chinese calendar and agrees with the known dates (#287)", () => {
  const known: Record<number, [number, number]> = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19], 2035: [2, 8], 2040: [2, 12], 2050: [1, 23] };
  for (const [y, md] of Object.entries(known)) assert.deepEqual(chineseNewYear(Number(y)), md, y);
  // the browser's calendar agrees to within a day (it can be a day out when the new moon is minutes from midnight in China)
  for (let y = 2025; y <= 2050; y++) {
    const cal = calendarChineseNewYear(y);
    if (!cal) continue;
    const gap = Math.abs(Date.UTC(y, cal[0] - 1, cal[1]) - Date.UTC(y, chineseNewYear(y)[0] - 1, chineseNewYear(y)[1])) / 864e5;
    assert.ok(gap <= 1, `${y}: ${cal} against ${chineseNewYear(y)}`);
  }
  assert.equal(id(2026, 2, 17), "chinese_new_year");
  assert.equal(seasonAt(at(2026, 2, 17))!.effect, "lanterns");
  assert.equal(id(2026, 2, 16), null);
});

test("a holiday's dates can be changed; the change repeats every year and can run over New Year (#287)", () => {
  const dates = { halloween: { from: "10-29", to: "11-01" } };
  assert.equal(seasonAt(at(2026, 10, 29), undefined, dates)?.id, "halloween");
  assert.equal(seasonAt(at(2026, 11, 1), undefined, dates)?.id, "halloween");
  assert.equal(seasonAt(at(2026, 11, 2), undefined, dates), null);
  assert.equal(seasonAt(at(2027, 10, 30), undefined, dates)?.id, "halloween");
  // the usual day no longer counts once the house moved it
  assert.equal(seasonAt(at(2026, 10, 31), undefined, { halloween: { from: "10-25" } }), null);
  assert.equal(seasonAt(at(2026, 10, 25), undefined, { halloween: { from: "10-25" } })?.id, "halloween");
  const wrap = { chinese_new_year: { from: "12-30", to: "01-02" } };
  assert.equal(seasonAt(at(2026, 1, 1), { new_year: false }, wrap)?.id, "chinese_new_year");
  assert.equal(seasonAt(at(2026, 12, 30), undefined, wrap)?.id, "chinese_new_year");
});

test("dates that are not a day of the calendar are ignored: the usual dates stay (#287)", () => {
  assert.equal(parseMonthDay("02-30"), null);
  assert.deepEqual(parseMonthDay("02-29"), [2, 29]);
  assert.equal(parseMonthDay("2-3"), null);
  assert.equal(seasonAt(at(2026, 10, 31), undefined, { halloween: { from: "13-40" } })?.id, "halloween");
  assert.deepEqual(seasonRules("halloween", { halloween: { from: "13-40" } }), [DEFAULT_RULES.halloween]);
});

test("the usual days of every holiday give a window in the year (#287)", () => {
  for (const sid of SEASON_IDS) {
    const d = ruleDays(DEFAULT_RULES[sid], 2026)!;
    assert.ok(d && d[0] <= d[1], sid);
    assert.equal(new Date(d[0] * 864e5).getUTCFullYear(), 2026, sid);
  }
  const range = (sid: (typeof SEASON_IDS)[number]) => ruleDays(DEFAULT_RULES[sid], 2026)!.map((x) => new Date(x * 864e5).toISOString().slice(5, 10));
  assert.deepEqual(range("easter"), ["04-03", "04-06"]);
  assert.deepEqual(range("advent"), ["12-01", "12-23"]);
});
