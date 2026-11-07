// The clock in a corner of the view (#232): what it looks like (12 or 24 hours, digital or analogue, seconds, date) and
// how it is drawn. The look is a device preference ("home3d.clock_*"); the corner is the older "home3d.clock".

import { html, svg, type TemplateResult } from "lit";
import { hourOptions } from "./time-text.ts";
import { uses12Hours, type HassLocale } from "./time-format.ts";

export interface ClockLook {
  /** 12 or 24 hour digits; "auto" follows Home Assistant's profile. */
  hours: "auto" | "12" | "24";
  analogue: boolean;
  seconds: boolean;
  date: boolean;
}

/** As before the settings existed: digital, hours and minutes, with the date, in the profile's hour format. */
export const CLOCK_LOOK: ClockLook = { hours: "auto", analogue: false, seconds: false, date: true };

/** The look from this device's preferences. */
export function clockLookOf(get: (key: string) => string | null): ClockLook {
  const hours = get("clock_hours");
  return {
    hours: hours === "12" || hours === "24" ? hours : "auto",
    analogue: get("clock_style") === "analogue",
    seconds: get("clock_seconds") === "1",
    date: get("clock_date") !== "0",
  };
}

export interface ClockEnv {
  now: Date;
  /** The BCP 47 language and Home Assistant's time zone (the browser's when missing). */
  lang: string;
  timeZone?: string;
  locale?: HassLocale;
}

const format = (env: ClockEnv, o: Intl.DateTimeFormatOptions): string => {
  try {
    return env.now.toLocaleString(env.lang, env.timeZone ? { ...o, timeZone: env.timeZone } : o);
  } catch {
    return env.now.toLocaleString(env.lang, o);
  }
};

/** The digits: 12 hour ("2:30 PM") or 24 hour ("14:30"), with seconds when asked. */
export function digitalText(env: ClockEnv, look: ClockLook): string {
  // "auto" follows this device's time format (#318), which follows the profile unless it was changed
  const h12 = look.hours === "auto" ? uses12Hours(env.locale, env.lang) : look.hours === "12";
  return format(env, { hour: h12 ? "numeric" : "2-digit", minute: "2-digit", second: look.seconds ? "2-digit" : undefined, ...hourOptions(h12) });
}

export const dateText = (env: ClockEnv): string => format(env, { weekday: "short", day: "numeric", month: "short" });

/** Hour, minute and second of the clock's time zone. */
export function clockParts(env: ClockEnv): { h: number; m: number; s: number } {
  const get = (tz?: string) => {
    const parts = new Intl.DateTimeFormat("en-GB", { hourCycle: "h23", hour: "numeric", minute: "numeric", second: "numeric", timeZone: tz }).formatToParts(env.now);
    const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return { h: n("hour") % 24, m: n("minute"), s: n("second") };
  };
  try {
    return get(env.timeZone);
  } catch {
    return get();
  }
}

/** The hands as degrees clockwise from 12 o'clock; the hour hand creeps with the minutes, the minute hand with the seconds. */
export function handAngles(p: { h: number; m: number; s: number }): { hour: number; minute: number; second: number } {
  return { hour: ((p.h % 12) + p.m / 60) * 30, minute: (p.m + p.s / 60) * 6, second: p.s * 6 };
}

/** The clock's face in the view: digital digits or an analogue dial, with the date under it when asked. */
export function renderClock(pos: string, env: ClockEnv, look: ClockLook): TemplateResult {
  const label = digitalText(env, look);
  return html`<div class="fp3d-clock fp3d-clock-${pos}" role="img" aria-label=${label}>
    ${look.analogue ? dial(env, look) : html`<b aria-hidden="true">${label}</b>`}${look.date ? html`<span aria-hidden="true">${dateText(env)}</span>` : ""}
  </div>`;
}

/** An analogue dial: twelve ticks, hour and minute hands, a thin second hand when seconds are on. */
function dial(env: ClockEnv, look: ClockLook): TemplateResult {
  const a = handAngles(clockParts(env));
  const hand = (deg: number, len: number, width: number, cls: string) => svg`<line class=${cls} x1="50" y1="50" x2="50" y2=${50 - len} stroke="currentColor" stroke-width=${width} stroke-linecap="round" transform="rotate(${deg} 50 50)" />`;
  return html`<svg class="fp3d-dial" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-opacity="0.5" stroke-width="2" />
    ${Array.from({ length: 12 }, (_, i) => svg`<line x1="50" y1=${i % 3 ? 8 : 6} x2="50" y2=${i % 3 ? 12 : 14} stroke="currentColor" stroke-width=${i % 3 ? 1.5 : 3} transform="rotate(${i * 30} 50 50)" />`)}
    ${hand(a.hour, 24, 4.5, "h")} ${hand(a.minute, 36, 3, "m")}
    ${look.seconds ? hand(a.second, 40, 1.2, "s") : ""}
    <circle cx="50" cy="50" r="3" fill="currentColor" />
  </svg>`;
}
