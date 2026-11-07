// The one place that decides 12 or 24 hour times (#318). This device's choice ("home3d.time_format": auto, 12 or
// 24; auto follows the Home Assistant profile's time format) is read here, and every time Home 3D shows or picks
// goes through these functions: the clock, the sun ring label, the time pickers, time travel, trails, backups.
// No Lit, no texts table: the viewer bundle and the settings share it.

/** Home Assistant's `hass.locale` (the profile's language and time format). */
export interface HassLocale {
  language?: string;
  time_format?: string;
}

export type TimeFormatPref = "auto" | "12" | "24";

/** The pref this device keeps the choice in. */
export const TIME_FORMAT_PREF = "home3d.time_format";

const shared: { pref?: TimeFormatPref } = {};

/** Use this choice for every time (null or anything unknown: follow Home Assistant again). */
export function setTimeFormat(v: string | null | undefined): void {
  shared.pref = v === "12" || v === "24" ? v : "auto";
}

/** This device's choice, read from its pref once. */
export function timeFormatPref(): TimeFormatPref {
  if (shared.pref === undefined) {
    try {
      setTimeFormat(localStorage.getItem(TIME_FORMAT_PREF));
    } catch {
      shared.pref = "auto";
    }
  }
  return shared.pref ?? "auto";
}

/**
 * Whether times show with am/pm: this device's choice, else the profile's time format ("12" or "24"; "am_pm" and
 * "twenty_four" are the older names), else what the profile's language (or, with "system", the browser) uses.
 */
export function uses12Hours(locale: HassLocale | undefined, language?: string): boolean {
  const own = timeFormatPref();
  if (own !== "auto") return own === "12";
  const f = locale?.time_format;
  if (f === "12" || f === "am_pm") return true;
  if (f === "24" || f === "twenty_four") return false;
  try {
    const lang = f === "system" ? undefined : (locale?.language || language || undefined)?.replace("_", "-");
    return new Intl.DateTimeFormat(lang, { hour: "numeric" }).resolvedOptions().hourCycle?.startsWith("h12") ?? false;
  } catch {
    return false;
  }
}
