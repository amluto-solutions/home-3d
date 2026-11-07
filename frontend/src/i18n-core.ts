// How texts are looked up and loaded (#196): the language a page shows, its texts from language packs, English as the
// fallback (#217: there is no other source of texts). No table here: i18n.ts holds the English one and registers it, so
// the editor and card editor bundles can share it (i18n-borrowed.ts) instead of carrying a copy each.

import type { I18nKey } from "./i18n.ts";
import type { HomeAssistant } from "./types.ts";

/**
 * English is built in; every other language is loaded once when Home Assistant runs in it (#196), so wall tablets
 * never load texts they do not need. Its texts come from language packs in Home Assistant (`home_3d/languages/get`): the
 * ones that come with Home 3D (German and 16 partial ones, #217) and the ones installed from a folder or GitHub, like
 * furniture packs. A key a pack lacks shows in English.
 */
type Table = Record<string, string>;
// shared on the page: every bundle that names texts carries its own copy of this module, and a language one of them
// loaded is at hand in the others at once (no English flash, no second fetch). The English table is the main bundle's
// (i18n.ts registers it); the editor and card-editor bundles borrow it (#196, i18n-borrowed.ts).
interface Shared {
  extra: Map<string, Table>;
  pending: Map<string, Promise<void>>;
  en?: Table;
  /** This device's chosen language (#292); undefined: not read yet, null: follow Home Assistant. */
  chosen?: string | null;
  /** Loads the English texts of the lazy bundles (the main bundle sets it, i18n.ts). */
  late?: () => Promise<void>;
}
const shared: Shared = ((globalThis as { __fp3dLanguages?: Shared }).__fp3dLanguages ??= { extra: new Map(), pending: new Map() });
const { extra, pending } = shared;

/**
 * Make `table` the page's English texts (i18n.ts, in the main bundle). A page can run two copies of the main bundle
 * (#218: one a cached page still names), and the lazy bundles borrow whatever is registered (#238): the tables are
 * merged, the later one's texts first, so a key either copy knows never shows as its key.
 */
export function registerEnglish(table: Table): void {
  shared.en = shared.en && shared.en !== table ? { ...shared.en, ...table } : table;
}

/** The main bundle's way to fetch the English texts that only the lazy bundles show (i18n-late.ts). */
export function setLateTexts(load: () => Promise<void>): void {
  let loading: Promise<void> | undefined;
  shared.late = () =>
    (loading ??= load().catch((err: unknown) => {
      loading = undefined;
      throw err;
    }));
}

/** Resolves once the English texts of the editor, Settings, time travel … are registered (at once where there is nothing to load). */
export function lateTextsReady(): Promise<void> {
  return shared.late ? shared.late() : Promise.resolve();
}

/** The page's English texts (empty until the main bundle registered them). */
export function english(): Table {
  return shared.en ?? {};
}

/** The pref this device keeps its language choice in ("home3d.language"; absent or "auto": follow Home Assistant, #292). */
export const LANGUAGE_PREF = "home3d.language";

/** Use `code` instead of Home Assistant's language on this page (null or "auto": follow Home Assistant again). */
export function setChosenLanguage(code: string | null | undefined): void {
  shared.chosen = code && code !== "auto" && /^[a-z]{2,3}$/i.test(code) ? code.toLowerCase() : null;
}

/** The language this device chose, read from its pref once; null: it follows Home Assistant. */
export function chosenLanguage(): string | null {
  if (shared.chosen === undefined) {
    try {
      setChosenLanguage(localStorage.getItem(LANGUAGE_PREF));
    } catch {
      shared.chosen = null;
    }
  }
  return shared.chosen ?? null;
}

/** The language a Home Assistant language reads (its base code, "de" of "de-AT"); null: English, built in. This device's own choice (#292) comes first. */
export function languageCode(lang: string | undefined): string | null {
  const raw = (chosenLanguage() ?? lang ?? navigator.language ?? "en").toLowerCase();
  // plain "no" (Norwegian) reads as Bokmål
  const code = raw.startsWith("no") ? "nb" : raw.split(/[-_]/)[0]!;
  return code === "en" || !/^[a-z]{2,3}$/.test(code) ? null : code;
}

/** Whether the texts for a language are at hand (English, or already loaded). */
export function languageReady(lang: string | undefined): boolean {
  const code = languageCode(lang);
  return !code || extra.has(code);
}

/** Put a language's texts in place without loading them (tests); a key the table lacks still falls back to English. */
export function useLanguage(code: string, table: Table): void {
  extra.set(code, table);
}

/** What `languages/get` answers (#196). */
interface LanguageAnswer {
  hash: string;
  strings?: Table;
}

/** Something that reaches Home Assistant (a hass). */
type Caller = { callWS<T>(msg: Record<string, unknown>): Promise<T> };

const CACHE = "home3d.lang.";

/** The pack texts this browser kept for a language, by their hash (a wall tablet does not fetch them again). */
function cached(code: string): { hash: string; strings: Table } | null {
  try {
    const kept = JSON.parse(localStorage.getItem(CACHE + code) ?? "null") as { hash?: unknown; strings?: unknown } | null;
    return kept && typeof kept.hash === "string" && kept.strings && typeof kept.strings === "object" ? (kept as { hash: string; strings: Table }) : null;
  } catch {
    return null;
  }
}

function keep(code: string, hash: string, strings: Table): void {
  try {
    if (Object.keys(strings).length) localStorage.setItem(CACHE + code, JSON.stringify({ hash, strings }));
    else localStorage.removeItem(CACHE + code);
  } catch {
    // a private window or a full storage: they are fetched again next time
  }
}

/** A language's texts from its packs in Home Assistant; none (an older backend, no connection): empty. */
async function packTexts(code: string, hass: Caller | undefined): Promise<Table> {
  if (!hass?.callWS) return {};
  const had = cached(code);
  try {
    const res = await hass.callWS<LanguageAnswer>({ type: "home_3d/languages/get", language: code, ...(had ? { hash: had.hash } : {}) });
    if (res.strings && typeof res.strings === "object") {
      keep(code, res.hash, res.strings);
      return res.strings;
    }
    return had && res.hash === had.hash ? had.strings : {};
  } catch {
    return had?.strings ?? {};
  }
}

/**
 * Load a language's texts (once): its packs from Home Assistant. Nothing
 * found leaves English in place. `again`: load anew (a language pack was installed or removed); the texts shown stay
 * until the new ones are there.
 */
export function loadLanguage(lang: string | undefined, hass?: Caller, again = false): Promise<void> {
  const code = languageCode(lang);
  if (!code || (extra.has(code) && !again)) return Promise.resolve();
  let p = pending.get(code);
  if (!p) {
    p = packTexts(code, hass)
      .then((pack) => void extra.set(code, pack))
      .finally(() => pending.delete(code));
    pending.set(code, p);
  }
  return p;
}

/**
 * The language the texts are shown in, for the `lang` attribute (#196: a screen reader picks its voice by it): Home
 * Assistant's language when texts for it are at hand, else English (the texts fall back to it).
 */
export function uiLanguage(hass: HomeAssistant | undefined): string {
  const lang = chosenLanguage() ?? hass?.language ?? navigator.language ?? "en";
  const code = languageCode(lang);
  if (!code) return /^en(?:-|$)/i.test(lang) ? lang : "en";
  const table = extra.get(code);
  for (const _ in table) return lang;
  return "en";
}

export function translate(hass: HomeAssistant | undefined, key: I18nKey, vars: Record<string, string | number> = {}): string {
  const code = languageCode(hass?.language ?? navigator.language);
  const table = code ? extra.get(code) : undefined;
  let s: string = table?.[key] ?? shared.en?.[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** One number format per language and digits (run 6 speed): `toLocaleString` with options builds a new one each call. */
const numberFormats = new Map<string, Intl.NumberFormat>();

export function formatNumber(hass: HomeAssistant | undefined, value: number, digits = 2): string {
  const lang = hass?.language ?? "";
  const key = `${lang}|${digits}`;
  let f = numberFormats.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(lang || undefined, { maximumFractionDigits: digits });
    } catch {
      // a language tag the browser does not know: as toLocaleString would have thrown, but the page keeps going
      f = new Intl.NumberFormat(undefined, { maximumFractionDigits: digits });
    }
    numberFormats.set(key, f);
  }
  return f.format(value);
}
