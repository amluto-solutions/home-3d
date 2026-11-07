// The language this device shows Home 3D in (#292): Automatic follows Home Assistant, or one of the languages that
// come with Home 3D. A device choice ("home3d.language"); i18n-core.ts reads the same key. No Lit, no texts table.

import { LANGUAGE_PREF } from "../i18n-core.ts";
import { deviceChoice } from "./view-settings.ts";
import { setTimeFormat } from "../time-format.ts";
import type { Option, Setting } from "./registry.ts";

/** The languages that come with Home 3D (bundled_languages/), besides English. */
export const LANGUAGES = ["cs", "da", "de", "es", "fi", "fr", "hu", "it", "nb", "nl", "nn", "pl", "pt", "ro", "sl", "sv", "zh"] as const;

/** A language's own name ("Français"), the code itself when the browser cannot name it. */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name && name !== code ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code;
  } catch {
    return code;
  }
}

/** Automatic, English, then each language by its own name. */
export function languageOptions(): Option[] {
  return [
    { value: "auto", label: "st_language_auto" },
    { value: "en", label: "English", raw: true },
    ...LANGUAGES.map((code): Option => ({ value: code, label: languageName(code), raw: true })),
  ];
}

const KEY = LANGUAGE_PREF.replace(/^home3d\./, "");

const TIME_FORMAT = deviceChoice("time_format", "look", "look", "time_format", ["auto", "12", "24"], "auto", "st_time_format", ["auto", "12", "24"].map((value) => ({ value, label: `st_time_format_${value}` as const })), "st_time_format_hint");

export const LANGUAGE: Setting[] = [
  deviceChoice(
    "language",
    "look",
    "look",
    KEY,
    ["auto", "en", ...LANGUAGES],
    "auto",
    "st_language",
    [],
    "st_language_hint",
    ["language", "translation", "translate", "locale", "english", "german", "deutsch", "french", "francais", "spanish", "espanol", "dutch", "nederlands", "italian", "italiano", "polish", "swedish", "norwegian", "danish", "finnish", "czech", "hungarian", "romanian", "slovenian", "portuguese", "chinese"],
    "select",
  ),
  // 12 or 24 hour times, everywhere a time is shown or picked (#318); Automatic follows the Home Assistant profile
  { ...TIME_FORMAT, write: (env, v: string) => (TIME_FORMAT.write!(env, v), setTimeFormat(v)) } as Setting,
];
LANGUAGE[0] = { ...LANGUAGE[0]!, control: { kind: "select", options: () => languageOptions() } };
