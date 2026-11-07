// What lives on the Extensions tab, for the Settings search (#302): its cards and their main rows, each with the
// words people type for it, in the style of search-words.ts. A hit opens the tab at its anchor (`data-ext` there:
// components/extensions.ts, season-dates.ts). English words only, 3 to 8 per entry. Part of the search-words chunk, so
// the Settings page's first open stays in its budget.

import type { html as Html, TemplateResult } from "lit";

export interface ExtensionEntry {
  /** The text keys of the name, joined with " · " ("Holidays · Dates"). */
  label: string[];
  /** The card or row on the Extensions tab (`data-ext`). */
  anchor: string;
  words: readonly string[];
}

/** The holidays (season-ids.ts lists the same; the test checks they agree): a copy here keeps this chunk free of imports, so it adds no shared chunk to the Settings page's first open. */
export const HOLIDAYS = ["nye", "new_year", "chinese_new_year", "christmas_eve", "christmas", "boxing_day", "twixmas", "advent", "bonfire", "remembrance", "valentines", "pancake_day", "mothers_day", "easter", "fathers_day", "halloween"];

const DATES = ["dates", "date", "days", "when", "start", "end"];

export const EXTENSION_ENTRIES: readonly ExtensionEntry[] = [
  // the fun packs card
  { label: ["fun_title"], anchor: "fun", words: ["extras", "fun", "novelty", "bonus", "optional", "built-in"] },
  // holidays, each with its dates (#287)
  { label: ["fun_name_seasons"], anchor: "holidays", words: ["holiday", "holidays", "festive", "seasonal", "celebration", "occasions", "decorations"] },
  { label: ["fun_name_seasons", "season_dates"], anchor: "holidays", words: ["holiday", "calendar", ...DATES] },
  ...HOLIDAYS.map((id): ExtensionEntry => ({ label: [`season_name_${id}`, "season_dates"], anchor: `season:${id}`, words: ["holiday", ...DATES] })),
  // pets: the card's own fields (the switch and the list are settings of their own: registry.ts)
  { label: ["fun_name_pets", "pet_add"], anchor: "pets", words: ["pet", "new", "animal", "cat", "dog", "rabbit"] },
  { label: ["fun_name_pets", "pet_name"], anchor: "pets", words: ["pet", "called", "title", "label", "animal"] },
  { label: ["fun_name_pets", "pet_kind"], anchor: "pets", words: ["pet", "cat", "dog", "rabbit", "species", "type"] },
  { label: ["fun_name_pets", "pet_breed"], anchor: "pets", words: ["pet", "dog", "labrador", "terrier", "type"] },
  { label: ["fun_name_pets", "pet_fur"], anchor: "pets", words: ["pet", "coat", "colour", "color", "hair", "tabby"] },
  { label: ["fun_name_pets", "pet_eyes"], anchor: "pets", words: ["pet", "colour", "color", "blue", "green", "pupils"] },
  { label: ["fun_name_pets", "pet_floor"], anchor: "pets", words: ["pet", "level", "storey", "lives", "upstairs", "downstairs"] },
  { label: ["fun_name_pets", "pet_mode"], anchor: "pets", words: ["pet", "roaming", "static", "wander", "still", "move"] },
  { label: ["fun_name_pets", "pet_pose"], anchor: "pets", words: ["pet", "sit", "sleep", "lie", "stand", "posture"] },
  // each extension's own settings
  { label: ["ext_module_settings"], anchor: "modules", words: ["extension", "extensions", "module", "addon", "options", "configure"] },
  // your own items
  { label: ["own_items_title"], anchor: "items", words: ["custom", "furniture", "build", "shapes", "editor", "create", "library"] },
  // pack updates
  { label: ["upd_title"], anchor: "updates", words: ["update", "updates", "release", "version", "upgrade", "outdated"] },
  { label: ["upd_title", "upd_frequency"], anchor: "updates", words: ["update", "how", "often", "daily", "weekly", "schedule", "interval"] },
  { label: ["upd_title", "upd_check_now"], anchor: "updates", words: ["update", "refresh", "look", "new", "releases", "manual"] },
  { label: ["upd_title", "upd_auto"], anchor: "updates", words: ["update", "automatic", "automatically", "placed", "items", "release"] },
  // furniture packs
  { label: ["packs"], anchor: "packs", words: ["pack", "library", "items", "installed", "bundled", "catalogue"] },
  { label: ["packs", "pack_import"], anchor: "packs", words: ["pack", "upload", "file", "zip", "json", "add"] },
  { label: ["packs", "pack_import_folder"], anchor: "packs", words: ["pack", "upload", "directory", "folder", "add"] },
  { label: ["packs", "pack_install_url"], anchor: "packs", words: ["pack", "github", "download", "link", "url", "repository"] },
  // language packs
  { label: ["languages"], anchor: "languages", words: ["language", "translation", "translations", "locale", "text", "english"] },
];

/** What a search finds on the Extensions tab: the entries whose name, words or the tab's own name start every typed word. */
export function searchExtensions(query: string, text: (key: string) => string): ExtensionEntry[] {
  // typed words are split like the names are, so "new year's eve" is new, year, s, eve
  const split = (t: string): string[] => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const typed = split(query);
  if (!typed.length) return [];
  return EXTENSION_ENTRIES.filter((e) => {
    const names = split([...e.label.map(text), ...e.words, text("ext_tab")].join(" "));
    return typed.every((w) => names.some((n) => n.startsWith(w)));
  });
}

/** An entry's name as shown. */
export const extensionLabel = (e: ExtensionEntry, text: (key: string) => string): string => e.label.map(text).join(" \u00b7 ");

/** The card of hits on the Extensions tab (#302), drawn after the settings' hits: `first` is the index of its first row for the arrow keys. */
export function extensionHits(hits: ExtensionEntry[], h: { html: typeof Html; first: number; cursor: number; tr: (key: string) => string; icon: TemplateResult; open: (anchor: string | null) => void }): TemplateResult {
  const html = h.html;
  return html`<section class="st-card">
    <h3><button class="st-link" @click=${() => h.open(null)}>${h.icon} ${h.tr("ext_tab")} ›</button></h3>
    ${hits.map((e, n) => {
      const at = h.first + n;
      return html`<div class="st-row st-nohint st-k-action ${at === h.cursor ? "st-hit st-active" : ""}" id="st-hit-${at}" data-ext-hit=${e.anchor}>
        <div class="st-lbl"><span class="st-name">${extensionLabel(e, h.tr)}</span></div>
        <div class="st-ctl"><button class="fp3d-btn" @click=${() => h.open(e.anchor)}>${h.tr("ext_tab")} ›</button></div>
      </div>`;
    })}
  </section>`;
}
