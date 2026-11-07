// Seasonal themes (#239): the main UK holidays, Halloween and Chinese New Year (#287); every holiday's dates can be changed. On its day a house gets a greeting, a soft colour glow and a light
// falling or floating effect (fun/season.ts, a lazy bundle). This file is only the calendar: which holiday a day is.
// Moving dates are worked out from rules (#339): a fixed day, days from Easter (the computus), the n-th weekday of a month,
// a one-off window; a holiday has one or more, each with a length and optional start and end times.

import { SEASON_EFFECT_MODES, SEASON_IDS, type SeasonEffectMode, type SeasonId } from "./season-ids.ts";

export { SEASON_EFFECT_MODES, SEASON_IDS, type SeasonEffectMode, type SeasonId };

/** The effects the overlay can draw. */
export type SeasonEffect = "halloween" | "lanterns" | "fireworks" | "sparkles" | "confetti" | "snow" | "snow_light" | "snow_sleigh" | "poppies" | "hearts" | "pancakes" | "flowers" | "easter" | "stars";

export interface Season {
  id: SeasonId;
  effect: SeasonEffect;
  /** The glow laid over the view, as a CSS colour. */
  tint: string;
  /** The greeting: its text key and variables (the Advent count, the New Year's Eve countdown, the year). */
  key: string;
  vars: Record<string, number>;
}

/** How long the holiday effect plays when the view opens (#385): not at all, briefly (the default), a minute, or all the time. */
/** The seconds each mode plays for (the glow and the moving pieces). */
export const SEASON_EFFECT_SECONDS: Readonly<Record<SeasonEffectMode, number>> = { none: 0, brief: 15, long: 60, always: Infinity };
export function seasonEffectMs(mode: SeasonEffectMode | null | undefined): number {
  return (SEASON_EFFECT_SECONDS[mode ?? "brief"] ?? SEASON_EFFECT_SECONDS.brief) * 1000;
}

/** 0xAARRGGBB to a CSS colour. */
function argb(v: number): string {
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${(((v >>> 24) & 255) / 255).toFixed(2)})`;
}
const RED = argb(0x55c8102e);
const GOLD = argb(0x4dffc94d);
const BLUE = argb(0x3384a9ff);

/** Easter Sunday of a year (Gregorian, the anonymous computus): [month 1-12, day]. */
export function easterSunday(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return [Math.floor(n / 31), (n % 31) + 1];
}

/** A day as [month 1-12, day]. */
export type MonthDay = readonly [number, number];
/** What a house stores to change a holiday's dates (#287): "MM-DD" text, no year (it repeats every year). */
export interface SeasonDates {
  from: string;
  to?: string;
}
export type SeasonDatesMap = Readonly<Record<string, SeasonDates | undefined>> | null | undefined;

/** Chinese New Year's Day of the years to come (2025-2035), as the Hong Kong Observatory lists them. */
const CNY_TABLE: Record<number, MonthDay> = {
  2025: [1, 29],
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
  2031: [1, 23],
  2032: [2, 11],
  2033: [1, 31],
  2034: [2, 19],
  2035: [2, 8],
};

/** Chinese New Year's Day from the browser's Chinese calendar; null where it has none. It can be a day out when the new moon is minutes from midnight in China. */
export function calendarChineseNewYear(year: number): MonthDay | null {
  try {
    const f = new Intl.DateTimeFormat("en-u-ca-chinese", { month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" });
    if (f.resolvedOptions().calendar !== "chinese") return null;
    for (let n = 0; n < 33; n++) {
      const day = new Date(Date.UTC(year, 0, 19 + n, 4)); // noon in China, where the calendar is kept
      const parts = f.formatToParts(day);
      if (parts.find((p) => p.type === "month")?.value === "1" && parts.find((p) => p.type === "day")?.value === "1") return [day.getUTCMonth() + 1, day.getUTCDate()];
    }
  } catch {
    // no Chinese calendar here
  }
  return null;
}

/** Chinese New Year's Day (between 21 January and 20 February): the table for the years it knows, else the Chinese calendar. */
export function chineseNewYear(year: number): MonthDay {
  return CNY_TABLE[year] ?? calendarChineseNewYear(year) ?? CNY_TABLE[2026]!;
}

const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** "MM-DD" as [month, day]; null when it is not a day of the calendar (29 February is one). */
export function parseMonthDay(text: string | undefined): MonthDay | null {
  const m = /^(\d\d)-(\d\d)$/.exec(text ?? "");
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN[month - 1]! ? [month, day] : null;
}

/** One way a holiday's days are given (#339); stored in settings.season_rules. */
export interface SeasonRule {
  kind: "fixed" | "easter" | "nth" | "once" | "cny";
  /** fixed: month and day (no year, repeats); nth: the month. */
  month?: number;
  day?: number;
  /** easter: days from Easter Sunday (negative: before). */
  offset?: number;
  /** nth: 1-5, or -1 for the last; weekday 0 (Sunday) to 6. */
  nth?: number;
  weekday?: number;
  /** once: the first and last day, "YYYY-MM-DD" (the last defaults to the first). */
  from?: string;
  to?: string;
  /** How many days it lasts from its first day (1 when missing). */
  days?: number;
  /** "HH:MM" on the first day (midnight when missing) and on the last day (the day's end when missing). */
  start?: string;
  end?: string;
}
export type SeasonRulesMap = Readonly<Record<string, readonly SeasonRule[] | undefined>> | null | undefined;

const DAY = 864e5;
/** Days since 1970-01-01 of a calendar day (days may run over the month). */
const ymd = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / DAY);
const clock = (t: string | undefined, or: number) => {
  const m = /^(\d\d):(\d\d)$/.exec(t ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : or;
};

/** The first and last day (days since 1970) a rule gives in a year; null when it gives none (31 February, a fifth Monday that is not). */
export function ruleDays(r: SeasonRule, y: number): [number, number] | null {
  const k = r.kind;
  const month = r.month ?? 1;
  const n = r.nth ?? 1;
  let a: number;
  if (k === "once") {
    const p = (s?: string) => {
      const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s ?? "");
      return m ? ymd(Number(m[1]), Number(m[2]), Number(m[3])) : NaN;
    };
    const first = p(r.from);
    const last = r.to ? p(r.to) : first;
    return first <= last ? [first, last] : null;
  }
  if (k === "easter") {
    const [m, d] = easterSunday(y);
    a = ymd(y, m, d) + (r.offset ?? 0);
  } else if (k === "cny") a = ymd(y, ...chineseNewYear(y));
  else if (k === "nth" && n < 0) {
    const last = ymd(y, month + 1, 1) - 1;
    a = last - ((((last + 4) % 7) - (r.weekday ?? 0) + 7) % 7);
  } else {
    // day 0 of 1970 was a Thursday
    const first = ymd(y, month, 1);
    a = k === "fixed" ? ymd(y, month, r.day ?? 1) : first + (((r.weekday ?? 0) - ((first + 4) % 7) + 7) % 7) + (n - 1) * 7;
    if (new Date(a * DAY).getUTCMonth() + 1 !== month) return null;
  }
  return [a, a + (r.days ?? 1) - 1];
}

/** A rule's window in a year as minutes since 1970 (local clock): from its start to its end, not included. */
export function ruleWindow(r: SeasonRule, y: number): [number, number] | null {
  const d = ruleDays(r, y);
  if (!d) return null;
  const from = d[0] * 1440 + clock(r.start, 0);
  const to = d[1] * 1440 + clock(r.end, 1440);
  return [from, to > from ? to : to + 1440];
}

const fx = (month: number, day: number, days = 1): SeasonRule => ({ kind: "fixed", month, day, days });
const nth = (n: number, month: number): SeasonRule => ({ kind: "nth", nth: n, weekday: 0, month, days: 1 });
const easter = (offset: number, days = 1): SeasonRule => ({ kind: "easter", offset, days });

/** The usual days of each holiday (worked out each year; Easter runs from Good Friday to Easter Monday). */
export const DEFAULT_RULES: Record<SeasonId, SeasonRule> = {
  nye: fx(12, 31),
  new_year: fx(1, 1),
  chinese_new_year: { kind: "cny", days: 1 },
  christmas_eve: fx(12, 24),
  christmas: fx(12, 25),
  boxing_day: fx(12, 26),
  twixmas: fx(12, 27, 5),
  advent: fx(12, 1, 23),
  bonfire: fx(11, 5),
  remembrance: nth(2, 11),
  valentines: fx(2, 14),
  pancake_day: easter(-47),
  mothers_day: easter(-21),
  easter: easter(-2, 4),
  fathers_day: nth(3, 6),
  halloween: fx(10, 31),
};

/** The rules of a holiday: the house's own; else its old "MM-DD" dates as a fixed date rule (#287 data, unchanged); else the usual ones. */
export function seasonRules(id: SeasonId, dates?: SeasonDatesMap, rules?: SeasonRulesMap): readonly SeasonRule[] {
  const own = rules?.[id];
  if (own) return own;
  const old = dates?.[id];
  const f = parseMonthDay(old?.from);
  if (!old || !f) return [DEFAULT_RULES[id]];
  const t = parseMonthDay(old.to) ?? f;
  return [fx(f[0], f[1], ((ymd(2023, t[0], t[1]) - ymd(2023, f[0], f[1]) + 365) % 365) + 1)];
}

/** The hours to midnight on New Year's Eve, then the minutes in the last hour. */
function countdown(y: number, hour: number, minute: number): Pick<Season, "key" | "vars"> {
  const left = 24 * 60 - (hour * 60 + minute);
  if (left > 60) return { key: "season_nye_hours", vars: { n: Math.ceil(left / 60), year: y + 1 } };
  return { key: left === 1 ? "season_nye_minute" : "season_nye_minutes", vars: { n: left, year: y + 1 } };
}

function describe(id: SeasonId, y: number, hour: number, minute: number, month: number, day: number): Season {
  const plain = (effect: SeasonEffect, tint: string): Season => ({ id, effect, tint, key: `season_${id}`, vars: {} });
  switch (id) {
    case "nye":
      return { ...plain(hour >= 20 ? "fireworks" : "sparkles", GOLD), ...countdown(y, hour, minute) };
    case "new_year":
      return { ...plain("confetti", GOLD), vars: { year: y } };
    case "christmas_eve":
    case "christmas":
      return plain("snow_sleigh", RED);
    case "boxing_day":
      return plain("snow", RED);
    case "twixmas":
      return plain("snow_light", BLUE);
    case "advent": {
      // the sleeps to Christmas Day (24 December is Christmas Eve, so there are two or more with the usual dates)
      return { ...plain("snow", RED), vars: { n: Math.max(1, Math.round((Date.UTC(y, 11, 25) - Date.UTC(y, month - 1, day)) / 864e5)) } };
    }
    case "bonfire":
      return plain("fireworks", argb(0x4dff7a1a));
    case "remembrance":
      return plain("poppies", argb(0x40b00020));
    case "valentines":
      return plain("hearts", argb(0x4dff3366));
    case "pancake_day":
      return plain("pancakes", argb(0x4df5b041));
    case "mothers_day":
      return plain("flowers", argb(0x4dff8fc7));
    case "easter":
      return plain("easter", argb(0x4db5e48c));
    case "fathers_day":
      return plain("stars", argb(0x4d4fc3f7));
    case "halloween":
      return plain("halloween", argb(0x40ff7a00));
    case "chinese_new_year":
      return plain("lanterns", argb(0x40d4202f));
  }
}

/** Holidays switched off, by id (false = off; a missing one is on). */
export type SeasonsOff = Readonly<Record<string, boolean | undefined>> | null | undefined;

/**
 * The holiday of a moment (local time), or null on a plain day. A holiday switched off is skipped, so on 31 December
 * with New Year's Eve off the day is Twixmas.
 */
export function seasonAt(now: Date, off?: SeasonsOff, dates?: SeasonDatesMap, rules?: SeasonRulesMap): Season | null {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const at = Math.floor(Date.UTC(y, m - 1, d, now.getHours(), now.getMinutes()) / 6e4);
  let best: SeasonId | null = null;
  let len = Infinity;
  // a window can have started in the year before; where two overlap the shorter one wins, then the order of SEASON_IDS
  for (const id of SEASON_IDS) {
    if (off?.[id] === false) continue;
    for (const r of seasonRules(id, dates, rules)) {
      for (const yy of [y - 1, y]) {
        const w = ruleWindow(r, yy);
        if (w && at >= w[0] && at < w[1] && w[1] - w[0] < len) [best, len] = [id, w[1] - w[0]];
      }
    }
  }
  return best && describe(best, y, now.getHours(), now.getMinutes(), m, d);
}

/** "?fp3d_season=christmas" in the address bar shows that holiday on any day (to look at it). */
export function seasonPreview(): SeasonId | null {
  try {
    const v = new URLSearchParams(location.search).get("fp3d_season");
    return (SEASON_IDS as readonly string[]).includes(v ?? "") ? (v as SeasonId) : null;
  } catch {
    return null;
  }
}

/** The holiday to show now: the previewed one (unless switched off), else today's. */
export function seasonNow(off?: SeasonsOff, now = new Date(), dates?: SeasonDatesMap, rules?: SeasonRulesMap): Season | null {
  const p = seasonPreview();
  if (!p) return seasonAt(now, off, dates, rules);
  return off?.[p] === false ? null : describe(p, now.getFullYear(), now.getHours(), now.getMinutes(), 12, 12);
}
