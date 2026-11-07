// Times as text in the device's 12 or 24 hours (#318): the clock, the sun ring labels, time travel, trails, backups.
// The choice itself (and uses12Hours) is in time-format.ts, which the Settings page loads; this part is not needed there.

import { uses12Hours, type HassLocale } from "./time-format.ts";

/** What times look like: 12 hours with am/pm or 24 hours, in a language. */
export interface TimeStyle {
  h12: boolean;
  language?: string;
}

/** The style for a Home Assistant connection (anything with `locale` and `language`). */
export function timeStyleOf(hass: { locale?: HassLocale; language?: string } | null | undefined): TimeStyle {
  return { h12: uses12Hours(hass?.locale, hass?.language), language: hass?.language };
}

/** The Intl options that make the hours 12 or 24 (24 hour times never read "24:05"). */
export function hourOptions(h12: boolean): Intl.DateTimeFormatOptions {
  return h12 ? { hour12: true } : { hourCycle: "h23" };
}

interface Extra {
  seconds?: boolean;
  timeZone?: string;
}

const formats = new Map<string, Intl.DateTimeFormat>();

// one formatter per look: a scrub over the time travel track asks for a time on every pointer move
function intl(language: string | undefined, o: Intl.DateTimeFormatOptions, tz: string | undefined): Intl.DateTimeFormat {
  const lang = language?.replace("_", "-");
  const key = `${lang}|${tz}|${JSON.stringify(o)}`;
  let f = formats.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(lang, tz ? { ...o, timeZone: tz } : o);
    } catch {
      f = new Intl.DateTimeFormat(undefined, o);
    }
    formats.set(key, f);
  }
  return f;
}

/** A time of day: "14:30" or "2:30 PM"; two-digit hours in 24 hour times. */
export function formatTime(at: number | Date, style: TimeStyle, extra: Extra = {}): string {
  if (!Number.isFinite(+at)) return "–";
  const o: Intl.DateTimeFormatOptions = { hour: style.h12 ? "numeric" : "2-digit", minute: "2-digit", ...(extra.seconds ? { second: "2-digit" } : {}), ...hourOptions(style.h12) };
  return intl(style.language, o, extra.timeZone).format(at);
}

/** A date and a time ("12/11/2026, 14:30"). */
export function formatDateTime(at: number | Date, style: TimeStyle, dateStyle: "short" | "medium" = "short", extra: Extra = {}): string {
  if (!Number.isFinite(+at)) return "–";
  return intl(style.language, { dateStyle, timeStyle: "short", ...hourOptions(style.h12) }, extra.timeZone).format(at);
}
