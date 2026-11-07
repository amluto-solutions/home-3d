// The Settings page (#139): every setting of Home 3D in one place. The menu (#248, option B of the menus redesign #219)
// shows who a change affects first: This home (saved in the plan, every screen sees it) or This device (this browser
// only), then topics on that side, with a search over both (arrow keys, Enter, Escape). Each page says once who it
// affects (a row with a different rule says so under its label), house rows are locked for viewers who aren't editors,
// and one save line says who a change was saved for. Changes save as they are made. A Back link returns to the 3D view
// or the editor it was opened from. Under 760 px the menu is a list that drills into a section. It is a bundle of its own (home-3d-settings.js), loaded when someone
// opens the Settings tab; it brings no texts table of its own beyond its few new texts (the panel lends `t`).

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { need, once } from "../lazy-part.ts";
import { hoursToTime, timeToHours, uses12Hours } from "../time-of-day.ts";
import { entityOptionList } from "../entity-options.ts";
import { entityName } from "../devices.ts";
import { freshReload } from "../fresh-reload.ts";
import type { Building, StartView } from "../model.ts";
import type { FurniturePack } from "../packs.ts";
import type { HomeAssistant } from "../types.ts";
import { colourReset } from "../colour-reset.ts";
import { colourField } from "../colour-field-tag.ts";
import { optionGroups, optionText } from "./view-settings.ts";
import type { ExtensionEntry } from "./extensions-index.ts";
import { controls, tokens } from "../styles.ts";
import {
  GROUPS,
  LOADERS,
  audienceOf,
  type Audience,
  liveSections,
  mayChange,
  searchSettings,
  sectionOf,
  settingById,
  settingsIn,
  type Control,
  type DevicePrefs,
  type Option,
  type Section,
  type SectionId,
  type Setting,
  type SettingsEnv,
  type TextKey,
  type Viewer,
  type WriteResult,
  deviceKeys,
  lengthLabel,
  planUnit,
  shownLength,
  typedLength,
} from "./registry.ts";

// the two pickers are one chunk of this bundle (#245, pickers.ts): it loads when a row first draws one, or the first
// line icon (#248)
const loadTimeField = once(() => import("./pickers.ts"));
const loadEntityPicker = loadTimeField;
// the Homes page is a chunk of its own too (#296), loaded when it is first drawn
const loadHomes = once(() => import("./homes.ts"));
const loadMultiSelect = once(() => import("../components/multi-select.ts"));
// the shared colour field (#403): Settings' first open has no room for it
const loadColourField = once(() => import("../components/colour-field.ts"));

/** A line icon of the menu (#248, settings-icons.ts); `small` draws it at 16 px. Its code comes with the pickers. */
function icon(name: string, small = false) {
  need(loadTimeField);
  return html`<fp3d-line-icon class=${small ? "s" : ""} .name=${name}></fp3d-line-icon>`;
}

/** This browser's preferences, as the panel keeps them ("home3d.<key>"). */
export const localPrefs: DevicePrefs = {
  get(key) {
    try {
      return localStorage.getItem(`home3d.${key}`);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null) localStorage.removeItem(`home3d.${key}`);
      else localStorage.setItem(`home3d.${key}`, value);
    } catch {
      // storage unavailable (a private window): not remembered
    }
  },
};

/** Settings kept outside the plan: fetched when their section opens (by the setting's `loader`). */
export type Loaders = Record<string, (hass: HomeAssistant) => Promise<unknown>>;

/** Phone layout: the sidebar becomes a list that drills into a section. */
const NARROW_PX = 760;

export class SettingsPage extends LitElement {
  static properties = {
    hass: { attribute: false },
    building: { attribute: false },
    canEdit: { attribute: false },
    packs: { attribute: false },
    t: { attribute: false },
    section: { attribute: false },
    focusId: { attribute: false },
    saveState: { attribute: false },
    homeName: { attribute: false },
    homeId: { attribute: false },
    lastView: { attribute: false },
    loadEditor: { attribute: false },
    loaders: { attribute: false },
    backTo: { attribute: false },
    version: { attribute: false },
    _section: { state: true },
    _audience: { state: true },
    _cursor: { state: true },
    _saved: { state: true },
    _query: { state: true },
    _words: { state: true },
    _drill: { state: true },
    _flash: { state: true },
    _remote: { state: true },
    _embedState: { state: true },
    _note: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare building: Building | null;
  /** On the editors list (#7): may change house settings. */
  declare canEdit: boolean | undefined;
  declare packs: FurniturePack[] | undefined;
  /** The main texts (the panel's translate). */
  declare t: (key: string, vars?: Record<string, string | number>) => string;
  /** The section to open (from a deep link or another part of the UI) and the setting to bring into view. */
  declare section: SectionId | null;
  declare focusId: string | null;
  declare saveState: "idle" | "saving" | "saved" | "error";
  declare homeName: string;
  /** The home this view shows (the Homes page marks it, #296). */
  declare homeId: string | null;
  declare lastView: StartView | null;
  /** Loads the editor bundle (it draws the embedded parts: favourites, backup …). */
  declare loadEditor: (() => Promise<unknown>) | undefined;
  declare loaders: Loaders | undefined;
  /** Where the page was opened from: its Back link returns there (#248); null: no link. */
  declare backTo: "view" | "editor" | "extensions" | null;
  /** The versions running, for the About card (#248). */
  declare version: { frontend: string; backend: string | null } | undefined;
  private declare _section: SectionId;
  /** The side of the menu shown: This home or This device (#248). */
  private declare _audience: Audience;
  /** The search hit the arrow keys are on (#248). */
  private declare _cursor: number;
  /** Who the last change on this page was saved for (the save line, #248); null: nothing changed yet. */
  private declare _saved: Audience | null;
  /** The page that change was made on: the save line says it only there (#255). */
  private _savedOn: SectionId | null = null;
  /** The starting side was chosen for this viewer (once, when the viewer is first known, #255). */
  private startPicked = false;
  private declare _query: string;
  /** The search words of each setting, once their chunk has loaded (#286); null until then. */
  private declare _words: Readonly<Record<string, readonly string[]>> | null;
  /** What the Extensions tab holds, searched with the settings (#302); loaded with the search words. */
  private _extIndex: typeof import("./extensions-index.ts") | null = null;
  /** Phones: a section is open (else the list of sections). */
  private declare _drill: boolean;
  /** The row a deep link points at, highlighted for a moment. */
  private declare _flash: string | null;
  private declare _remote: Record<string, unknown>;
  private declare _embedState: "idle" | "loading" | "ready" | string;
  /** A short message under the section (a reset done, a failed call). */
  private declare _note: string | null;
  private remoteAsked = new Set<string>();
  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.building = null;
    this.section = null;
    this.focusId = null;
    this.saveState = "idle";
    this.homeName = "";
    this.homeId = null;
    this.lastView = null;
    this.t = (key) => key;
    this._section = "general";
    this._audience = "home";
    this._cursor = 0;
    this._saved = null;
    this.backTo = null;
    this._query = "";
    this._words = null;
    this._drill = false;
    this._flash = null;
    this._remote = {};
    this._embedState = customElements.get("fp3d-editor") ? "ready" : "idle";
    this._note = null;
  }

  /** The page's text (st_ keys are in the main table and the language packs like every other). */
  private tr(key: TextKey, vars?: Record<string, string | number>): string {
    return this.t(key, vars);
  }

  /** The loaders in use: the registry's, unless a test hands in its own. */
  private get loadersNow(): Loaders {
    return this.loaders ?? LOADERS;
  }

  private get env(): SettingsEnv {
    return { building: this.building, hass: this.hass, prefs: localPrefs, lastView: this.lastView, remote: this._remote, version: this.version };
  }

  private get viewer(): Viewer {
    return { editor: this.canEdit ?? this.hass?.user?.is_admin ?? false, haAdmin: this.hass?.user?.is_admin ?? false };
  }

  /** A new `hass` every state change: only the first one renders (labels and lists don't need every state). */
  protected shouldUpdate(changed: PropertyValues): boolean {
    return !(changed.size === 1 && changed.has("hass") && changed.get("hass"));
  }

  protected willUpdate(changed: PropertyValues): void {
    if ((changed.has("section") || changed.has("focusId")) && (this.section || this.focusId)) {
      // a link to a row that moved (Quality to Appearance, the people rows out of Advanced, #248) opens the row's section
      const row = this.focusId ? settingById(this.focusId) : undefined;
      const id = row?.section ?? this.section ?? this._section;
      if (sectionOf(id) && !sectionOf(id)!.hidden) this._section = id;
      this._query = "";
      this._note = null;
      if (sectionOf(id)?.hidden) this.toExtensions();
      else if (sectionOf(id)) {
        // an unknown name opens the menu, not the first page (#256)
        this._drill = true;
        if (this.focusId) this.flash(this.focusId);
      }
    }
    // people who cannot change the home's settings start on the device side, where they can change something (#255)
    if (!this.startPicked && this.hass && (changed.has("hass") || changed.has("canEdit"))) {
      this.startPicked = true;
      const first = liveSections(this.env).find((s) => !s.hidden && audienceOf(s) === "device");
      if (first && !this.section && !this.focusId && !this.viewer.editor) this._section = first.id;
    }
    const sections = liveSections(this.env);
    if (sections.length && !sections.some((s) => s.id === this._section)) this._section = sections[0].id;
    // the menu shows the open section's side
    if (changed.has("section") || changed.has("focusId") || !this.hasUpdated) this._audience = audienceOf(sectionOf(this._section)!);
    this.askRemote();
  }

  protected updated(): void {
    if (this.cursorMoved) {
      this.cursorMoved = false;
      this.renderRoot.querySelector?.(".st-active")?.scrollIntoView?.({ block: "nearest" });
    }
    if (!this._flash) return;
    const row = this.renderRoot.querySelector(`[data-id="${CSS.escape(this._flash)}"]`);
    if (row && !row.hasAttribute("data-seen")) {
      row.setAttribute("data-seen", "");
      row.scrollIntoView({ block: "center" });
    }
  }

  private flash(id: string): void {
    this._flash = id;
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => (this._flash = null), 2500);
  }

  /** Fetch what the open section's settings keep outside the plan (once per opening of the page). */
  private askRemote(): void {
    const hass = this.hass;
    if (!hass) return;
    const wanted = new Set((this._query ? searchSettings(this._query, this.env, (k) => this.tr(k), this._words ?? undefined) : settingsIn(this._section, this.env)).map((s) => s.loader).filter((l): l is string => !!l));
    for (const id of wanted) {
      if (this.remoteAsked.has(id) || !this.loadersNow[id]) continue;
      this.remoteAsked.add(id);
      void this.reload(id);
    }
  }

  private async reload(id: string): Promise<void> {
    const hass = this.hass;
    const load = this.loadersNow[id];
    if (!hass || !load) return;
    try {
      this._remote = { ...this._remote, [id]: await load(hass) };
    } catch (err) {
      this._remote = { ...this._remote, [id]: { error: String((err as { message?: string })?.message ?? err) } };
    }
  }

  // ------------------------------------------------------------------------------------------------ writing

  private write<V>(s: Setting<V>, value: V): void {
    if (!s.write || !mayChange(s, this.viewer)) return;
    if (s.scope === "house" && !this.building) return;
    let result: WriteResult;
    try {
      result = s.write(this.env, value);
    } catch (err) {
      this._note = String(err);
      return;
    }
    this.apply(s, result);
  }

  private apply(s: Setting, result: WriteResult): void {
    this._saved = s.scope === "device" ? "device" : "home";
    this._savedOn = this._section;
    if (result && typeof (result as Promise<unknown>).then === "function") {
      void (result as Promise<unknown>)
        .then(() => (s.loader ? this.reload(s.loader) : undefined))
        .catch((err: unknown) => (this._note = this.tr("st_failed", { error: String((err as { message?: string })?.message ?? err) })));
      return;
    }
    if (result && typeof result === "object" && "floors" in result) {
      this.dispatchEvent(new CustomEvent("settings-edit", { detail: { building: result, key: `settings:${s.id}` }, bubbles: true, composed: true }));
      return;
    }
    // a device preference: the panel reads its preferences again
    this.dispatchEvent(new CustomEvent("device-change", { detail: { id: s.id }, bubbles: true, composed: true }));
    this.requestUpdate();
  }

  /** A button row: what it does (some write too). */
  private act(s: Setting, action: string): void {
    if (action === "start_view") {
      if (this.lastView) this.write(s, this.lastView as never);
      return;
    }
    if (action.startsWith("goto:")) {
      // a row that points to where a setting moved to (#295)
      const [section, id] = action.slice(5).split(":");
      if (sectionOf(section as SectionId)) this.open(section as SectionId, id || null);
      return;
    }
    if (action === "reset_device") {
      // one tap used to wipe the device's choices at once (#255): it asks first (reset.ts, loaded now)
      void import("./reset.ts").then(async (m) => {
        if (!(await m.resetDevice(localPrefs, deviceKeys(), { ask: this.tr("st_reset_ask"), ok: this.tr("st_reset"), cancel: this.tr("cancel") }))) return;
        this._note = this.tr("st_reset_done");
        this.dispatchEvent(new CustomEvent("device-change", { detail: { id: s.id }, bubbles: true, composed: true }));
        this.requestUpdate();
      });
      return;
    }
    this.dispatchEvent(new CustomEvent("settings-action", { detail: { action, id: s.id }, bubbles: true, composed: true }));
  }

  /** The old "fun" page: its switches live on the Extensions tab alone (#256). `focus`: the card there to scroll to; `id`: the setting whose card it is (#302). */
  private toExtensions(focus?: string | null, id?: string | null): void {
    this.dispatchEvent(new CustomEvent("settings-action", { detail: { action: "extensions", id, focus }, bubbles: true, composed: true }));
  }

  private open(section: SectionId, focus: string | null = null): void {
    if (sectionOf(section)?.hidden) return this.toExtensions(null, focus);
    this._section = section;
    this._audience = audienceOf(sectionOf(section)!);
    if (focus) this.flash(focus);
    this._query = "";
    this._drill = true;
    this._note = null;
    this.dispatchEvent(new CustomEvent("settings-nav", { detail: { section, id: focus }, bubbles: true, composed: true }));
    if (!focus) this.renderRoot.querySelector?.(".st-main")?.scrollTo?.({ top: 0 });
  }

  // ------------------------------------------------------------------------------------------------ render

  /**
   * The texts the page is lent lack its own (#238): an older main bundle (one the browser kept, #223) loaded this newer
   * page, whose texts moved into the main table (#217). Its rows would show their keys (st_sec_general …), so the page
   * says the update is there instead, in words every main bundle has.
   */
  private get stale(): boolean {
    return this.tr("st_title") === "st_title";
  }

  protected render() {
    if (this.stale) {
      return html`<div class="st-stale" role="status">
        <span>${this.t("update_ready")}</span>
        <button class="fp3d-btn" @click=${() => void freshReload()}>${this.t("reload_page")}</button>
      </div>`;
    }
    const env = this.env;
    const sections = liveSections(env).filter((s) => !s.hidden);
    const query = this._query.trim();
    const hits = query ? this.hits(query) : null;
    const side = this._audience;
    const other: Audience = side === "home" ? "device" : "home";
    const ext = this.extHits(query);
    const n = (hits?.length ?? 0) + ext.length;
    const cursor = n ? Math.min(this._cursor, n - 1) : -1;
    return html`<div class="st ${this._drill || query ? "st-drill" : ""} ${query ? "st-query" : ""}">
      <nav class="st-nav" aria-label=${this.tr("st_title")}>
        ${this.renderBackTo()}
        <div class="st-sides" role="group" aria-label=${this.tr("st_audience")}>
          ${(["home", "device"] as const).map(
            (a) => html`<button class="st-side" aria-pressed=${a === side} @click=${() => this.showSide(a)}>
              <span><b>${this.tr(a === "home" ? "st_audience_home" : "st_group_device")}</b>${this.tr(a === "home" ? "st_audience_home_sub" : "st_audience_device_sub")}</span>
            </button>`,
          )}
        </div>
        <label class="st-search">
          ${icon("search")}
          <input
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded=${hits ? "true" : "false"}
            aria-controls="st-hits"
            aria-activedescendant=${cursor >= 0 ? `st-hit-${cursor}` : ""}
            .value=${this._query}
            placeholder=${this.tr("st_search_all")}
            aria-label=${this.tr("st_search_all")}
            @focus=${this.loadWords}
            @input=${(e: Event) => {
              this._query = (e.target as HTMLInputElement).value;
              this._cursor = 0;
              this.loadWords();
            }}
            @keydown=${this.searchKey}
          />
        </label>
        ${GROUPS.filter((g) => g.audience === side).map((g) => {
          const list = sections.filter((s) => s.group === g.id);
          return list.length
            ? html`<div class="st-group">${this.tr(g.title)}</div>
                ${list.map(
                  (s) => html`<button class="st-nav-btn" aria-current=${!query && s.id === this._section ? "page" : "false"} @click=${() => this.open(s.id)}>
                    <span class="st-ic">${icon(s.icon)}</span><span>${this.tr(s.title)}</span><span class="st-chev">${icon("next", true)}</span>
                  </button>`,
                )}`
            : nothing;
        })}
        <button class="st-other" @click=${() => this.showSide(other)}><span>${this.tr(other === "home" ? "st_other_home" : "st_other_device")}</span>${icon("next", true)}</button>
      </nav>
      <main class="st-main">${hits ? this.renderResults(query, hits, ext, cursor) : this.renderSection(sectionOf(this._section)!)}</main>
    </div>`;
  }

  /** The search's hits in the order they show (by section): the arrow keys walk this list. */
  private hits(query: string): Setting[] {
    const bySection = new Map<SectionId, Setting[]>();
    for (const s of searchSettings(query, this.env, (k) => this.tr(k), this._words ?? undefined)) bySection.set(s.section, [...(bySection.get(s.section) ?? []), s]);
    return [...bySection.values()].flat();
  }

  /** What the search finds on the Extensions tab (#302): editors only, as the tab is; nothing until the index has loaded. */
  private extHits(query: string): ExtensionEntry[] {
    return this._extIndex && this.viewer.editor ? this._extIndex.searchExtensions(query, (k) => this.tr(k)) : [];
  }

  /** The search words (#286, search-words.ts) and the Extensions index (#302) are a chunk of their own: loaded at the search box's first use; the page draws again when they arrive. */
  private readonly loadWords = (): void => {
    if (this._words) return;
    need(async () => {
      const [words, ext] = await Promise.all([import("./search-words.ts"), import("./extensions-index.ts")]);
      this._words ??= words.SEARCH_WORDS;
      this._extIndex ??= ext;
    });
  };

  /** The search box's keys (#248): arrows move through the hits, Enter opens the one marked, Escape clears. */
  private readonly searchKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      if (!this._query) return;
      e.preventDefault();
      e.stopPropagation();
      this._query = "";
      this._cursor = 0;
      return;
    }
    const q = this._query.trim();
    const hits = q ? this.hits(q) : [];
    const ext = this.extHits(q);
    const total = hits.length + ext.length;
    if (!total) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const at = Math.min(this._cursor, total - 1);
      this._cursor = (at + (e.key === "ArrowDown" ? 1 : total - 1)) % total;
      this.cursorMoved = true;
    } else if (e.key === "Enter") {
      e.preventDefault();
      const at = Math.min(this._cursor, total - 1);
      this._query = "";
      this._cursor = 0;
      if (at >= hits.length) this.toExtensions(ext[at - hits.length].anchor);
      else this.open(hits[at].section, hits[at].id);
    }
  };

  private cursorMoved = false;

  /** One side of the menu (#248): on a wide screen its first page opens beside it, unless one of its pages is open. */
  private showSide(a: Audience): void {
    this._audience = a;
    this._query = "";
    this._note = null;
    if (audienceOf(sectionOf(this._section)!) === a) return;
    const first = liveSections(this.env).find((s) => !s.hidden && audienceOf(s) === a);
    if (first) this._section = first.id;
  }

  /** "‹ Back to 3D / Editor" (#248): where the page was opened from. */
  private renderBackTo() {
    const to = this.backTo;
    if (!to) return nothing;
    return html`<button class="st-backto" @click=${() => this.dispatchEvent(new CustomEvent("settings-back", { detail: { mode: to }, bubbles: true, composed: true }))}>
      ${icon("back", true)}<span>${this.tr(`st_back_to_${to === "view" ? "3d" : to}`)}</span>
    </button>`;
  }

  /** The one save line (#248): who the last change was saved for, read out politely when it changes. */
  private renderSave(side: Audience, section: SectionId) {
    // a change is named on the page it was made on; every other page says its own side (#255)
    const who = this._saved && this._savedOn === section ? this._saved : side;
    const state = who === "home" ? this.saveState : "saved";
    const text = state === "saving" ? this.tr("st_saving") : state === "error" ? this.tr("st_save_error") : this.tr(who === "device" ? "st_saved_device" : "st_saved_home");
    return html`<p class="st-save st-save-${state}" aria-live="polite">${text}</p>`;
  }

  /** Whose a row is, in words, when it differs from its page's sentence (or on a search hit, where there is no page). */
  private rule(s: Setting, hit: boolean, page: { side: Audience; install: boolean; admin: boolean }): TextKey | null {
    if (["note", "info"].includes(s.control.kind)) return null;
    if (hit) return s.scope === "device" ? "st_row_device" : s.scope === "install" ? "st_row_install" : "st_row_home";
    if (s.scope === "device" && page.side !== "device") return "st_row_device";
    if (s.scope === "house" && page.side === "device") return "st_row_home";
    if (s.scope === "install" && !page.install) return "st_row_install";
    if (s.permission === "ha_admin" && !page.admin) return "st_row_admin";
    return null;
  }

  private renderResults(query: string, hits: Setting[], ext: ExtensionEntry[], cursor: number) {
    // the hits come by section (hits()): a card per run of one section
    const runs: Setting[][] = [];
    for (const s of hits) (runs.at(-1)?.[0].section === s.section ? runs.at(-1)! : (runs[runs.length] = [])).push(s);
    let i = 0;
    const n = hits.length + ext.length;
    return html`<button class="st-back" @click=${() => (this._query = "")}>${icon("back", true)} ${this.tr("st_back")}</button>
      <div class="st-title" role="status"><h2>${n ? this.tr("st_results", { n, q: query }) : this.tr("st_search_none", { q: query })}</h2></div>
      <div id="st-hits">
        ${runs.map((list) => {
          const sec = sectionOf(list[0].section)!;
          return html`<section class="st-card">
            <h3><button class="st-link" @click=${() => this.open(sec.id)}>${icon(sec.icon, true)} ${this.tr(sec.title)} ›</button></h3>
            ${list.map((s, n) => {
              // whose a hit is, said once per run of the same answer (#254), not on every row
              const same = n > 0 && this.rule(s, true, undefined as never) === this.rule(list[n - 1], true, undefined as never);
              return this.renderRow(s, true, i++, cursor, undefined, !same);
            })}
          </section>`;
        })}
        ${ext.length ? this._extIndex!.extensionHits(ext, { html, first: hits.length, cursor, tr: (k) => this.tr(k), icon: icon("package", true), open: (a) => this.toExtensions(a) }) : nothing}
      </div>`;
  }

  private renderSection(sec: Section) {
    const list = settingsIn(sec.id, this.env);
    const who = this.viewer;
    const side = audienceOf(sec);
    const admin = list.length > 0 && list.every((s) => s.permission === "ha_admin" || s.control.kind === "note");
    const install = list.length > 0 && list.every((s) => s.scope === "install");
    const houseLocked = list.some((s) => s.scope !== "device" && s.permission === "editor") && !who.editor;
    const page = { side, install, admin };
    const sentence = side === "device" ? "st_page_device" : install ? "st_page_install" : admin ? "st_page_home_admin" : "st_page_home";
    const lock = admin && !who.haAdmin ? "st_admin_locked" : houseLocked ? "st_locked" : null;
    return html`<button class="st-back" @click=${() => (this._drill = false)}>${icon("back", true)} ${this.tr("st_back")}</button>
      <div class="st-title">
        <div>
          <h2>${this.tr(sec.title)}</h2>
          <p>${this.tr(sentence)}</p>
        </div>
        ${lock ? nothing : this.renderSave(side, sec.id)}
      </div>
      ${lock ? html`<p class="st-lock">${icon("lock", true)} ${this.tr(lock)}</p>` : nothing}
      ${this._note ? html`<p class="st-note" role="status">${this._note}</p>` : nothing}
      ${sec.cards.map((card) => {
        const rows = list.filter((s) => s.card === card.id);
        return rows.length
          ? html`<section class="st-card">
              <h3>${this.tr(card.title)}</h3>
              ${rows.map((s) => this.renderRow(s, false, -1, -1, page))}
            </section>`
          : nothing;
      })}`;
  }

  private renderRow(s: Setting, hit: boolean, index = -1, cursor = -1, page = { side: audienceOf(sectionOf(s.section)!), install: false, admin: false }, showRule = true) {
    const may = mayChange(s, this.viewer);
    // the start view's two buttons and its state line go under the label, so the label keeps its width (#246)
    // a segment of three or more choices and a select with long choices go under their label too, so the hint keeps its width (#256)
    const c = s.control;
    const wide = (c.kind === "select" && c.options(this.env).some((o) => this.label(o).length > 24)) || (c.kind === "segment" && this.options(c).length > 2) || c.kind === "embed" || c.kind === "homes" || c.kind === "list" || c.kind === "checks" || c.kind === "entity" || (c.kind === "action" && c.action === "start_view");
    const rule = showRule ? this.rule(s, hit, page) : null;
    const more = planUnit(this.env) === "imperial" && s.hintImperial;
    return html`<div
      class="st-row st-k-${c.kind} ${s.hint || rule ? "" : "st-nohint"} ${wide ? "st-row-wide" : ""} ${(hit && index === cursor) || this._flash === s.id ? "st-hit" : ""} ${hit && index === cursor ? "st-active" : ""}"
      data-id=${s.id}
      id=${index >= 0 ? `st-hit-${index}` : nothing}
    >
      ${s.id === "editors" ? nothing : html`<div class="st-lbl"><span class="st-name">${c.kind === "number" && c.length ? lengthLabel(this.env, this.tr(s.label)) : this.tr(s.label)}</span></div>`}
      ${s.hint || rule ? html`<p class="st-hint">${s.hint ? this.tr(s.hint) : nothing}${more ? html` ${this.tr(more)}` : nothing}${rule ? html`<span class="st-rule">${this.tr(rule)}</span>` : nothing}</p>` : nothing}
      <div class="st-ctl">${this.renderControl(s, s.control, !may)}</div>
    </div>`;
  }

  private options(c: { options: Option[] | ((env: SettingsEnv) => Option[]) }): Option[] {
    return typeof c.options === "function" ? c.options(this.env) : c.options;
  }

  private label(o: Option): string {
    return o.raw ? o.label : this.tr(o.label);
  }

  private renderControl(s: Setting, c: Control, disabled: boolean) {
    const env = this.env;
    const value = s.read(env);
    const aria = this.tr(s.label);
    switch (c.kind) {
      case "switch":
        return html`<button class="st-sw" role="switch" aria-checked=${!!value} aria-label=${aria} ?disabled=${disabled} @click=${() => this.write(s as Setting<boolean>, !value)}></button>`;
      case "number": {
        // a length in feet and inches: a text box with the editor's formatter and parser (units.ts), metres stored
        if (c.length && planUnit(env) === "imperial") {
          return html`<span class="st-num">
            <input
              class="st-len"
              type="text"
              inputmode="text"
              spellcheck="false"
              .value=${typeof value === "number" ? shownLength(env, value) : ""}
              placeholder=${c.clearable && typeof s.default === "number" ? shownLength(env, s.default) : ""}
              aria-label=${aria}
              ?disabled=${disabled}
              @change=${(e: Event) => {
                const input = e.target as HTMLInputElement;
                const raw = input.value.trim();
                if (raw === "") {
                  if (c.clearable) this.write(s as Setting<number | null>, null);
                  return;
                }
                const v = typedLength(env, raw);
                if (v === null) {
                  // not a length: the old value shows again
                  input.value = typeof value === "number" ? shownLength(env, value) : "";
                  return;
                }
                this.write(s as Setting<number | null>, v);
              }}
            />
          </span>`;
        }
        const unit = typeof c.unit === "function" ? c.unit(env) : c.unit;
        const shown = typeof value === "number" ? String(Math.round(value * 1000) / 1000) : "";
        return html`<span class="st-num">
          <input
            type="number"
            inputmode="decimal"
            step=${c.step}
            min=${c.min ?? ""}
            max=${c.max ?? ""}
            .value=${shown}
            placeholder=${c.empty ? this.tr(c.empty) : c.clearable ? String(s.default ?? "") : ""}
            aria-label=${aria}
            ?disabled=${disabled}
            @change=${(e: Event) => {
              const raw = (e.target as HTMLInputElement).value.trim().replace(",", ".");
              if (raw === "") {
                if (c.clearable) this.write(s as Setting<number | null>, null);
                return;
              }
              const v = Number(raw);
              if (Number.isFinite(v)) this.write(s as Setting<number | null>, v);
            }}
          />${unit ? html`<i>${unit.startsWith("st_") ? this.tr(unit) : unit}</i>` : nothing}
        </span>`;
      }
      case "segment":
        return html`<div class="fp3d-seg st-seg" role="group" aria-label=${aria}>
          ${this.options(c).map(
            (o) => html`<button aria-pressed=${value === o.value} ?disabled=${disabled} @click=${() => this.write(s as Setting<string>, o.value)}>${this.label(o)}</button>`,
          )}
        </div>`;
      case "select":
        return html`<select class="st-select" aria-label=${aria} ?disabled=${disabled} @change=${(e: Event) => this.write(s as Setting<string>, (e.target as HTMLSelectElement).value)}>
          ${optionGroups(c.options(env)).map(({ group, options }) => {
            const list = options.map((o) => html`<option value=${o.value} ?selected=${value === o.value}>${optionText(o, (k, v) => this.tr(k, v))}</option>`);
            return group ? html`<optgroup label=${this.tr(group)}>${list}</optgroup>` : list;
          })}
        </select>`;
      case "entity":
        return this.renderEntity(s as Setting<string | null>, c, disabled);
      case "text":
        return html`<input
          class="st-text"
          type="text"
          maxlength=${c.maxLength ?? 255}
          .value=${String(value ?? "")}
          placeholder=${c.placeholder ? this.tr(c.placeholder) : ""}
          aria-label=${aria}
          ?disabled=${disabled}
          @change=${(e: Event) => this.write(s as Setting<string>, (e.target as HTMLInputElement).value.trim())}
        />`;
      case "time":
        return this.timeField(String(value ?? ""), aria, disabled, (v) => this.write(s as Setting<string | null>, v || null), true);
      case "hour":
        // stored as hours (the bins' glow): the field shows and gives back a time of day
        return this.timeField(hoursToTime(value as number | null), aria, disabled, (v) => timeToHours(v) !== null && this.write(s as Setting<number>, timeToHours(v)!), false);
      case "colour":
        return html`<span class="st-colour">
          ${this.colourField(value as string | null, c.fallback, aria, disabled, (hex) => this.write(s as Setting<string | null>, hex))}
          ${colourReset({ value: value as string | null, fallback: c.fallback, label: this.tr(c.clearable ? "st_accent_default" : "colour_reset"), disabled, onReset: () => this.write(s as Setting<string | null>, null) })}
        </span>`;
      case "range":
        return html`<span class="st-num">
          <input type="range" min=${c.min} max=${c.max} step=${c.step} .value=${String(value ?? s.default)} aria-label=${aria} ?disabled=${disabled} @change=${(e: Event) => this.write(s as Setting<number>, Number((e.target as HTMLInputElement).value))} />
          <i>${String(value ?? s.default)}</i>
        </span>`;
      case "checks": {
        // the same searchable multi-select as the View panel (#332); a long list reads "6 object types selected"
        need(loadMultiSelect);
        const on = (value as string[] | null) ?? [];
        return html`<fp3d-multi-select
          class="st-multi"
          .options=${c.options.map((o) => ({ id: o.value, label: this.label(o) }))}
          .value=${on}
          .label=${aria}
          .disabled=${disabled}
          .summary=${c.options.length > 6 ? this.tr(on.length === 1 ? "display_count_one" : "display_count", { n: on.length }) : ""}
          .searchLabel=${this.tr("multi_search")}
          .emptyText=${this.tr("multi_none")}
          .removeLabel=${this.tr("multi_remove")}
          @change=${(e: CustomEvent<{ value: string[] }>) => this.write(s as Setting<string[]>, c.options.map((x) => x.value).filter((v) => e.detail.value.includes(v)))}
        ></fp3d-multi-select>`;
      }
      case "action":
        return this.renderAction(s, c, disabled);
      case "list":
        return this.renderIgnored(s, disabled);
      case "embed":
        return this.renderEmbed(s, c.topic);
      case "homes":
        if (disabled) return html`<p class="st-sub">${icon("lock", true)}</p>`;
        need(loadHomes);
        return html`<fp3d-homes-page .hass=${this.hass} .home=${this.homeId} .t=${this.t}></fp3d-homes-page>`;
      case "note":
        return nothing;
      case "info":
        return html`<span class="st-info">${String(value ?? "–")}</span>`;
    }
  }

  /** The shared colour field (#403): swatch, hex value and copy; its code is a chunk of its own. */
  private colourField(value: string | null, fallback: string, label: string, disabled: boolean, set: (hex: string) => unknown) {
    need(loadColourField);
    return colourField({ value, base: fallback, label, t: (k, v) => this.tr(k, v), disabled, live: true, onChange: (hex) => hex && set(hex) });
  }

  /** A time of day picker (#225) in the profile's 12 or 24 hours. */
  private timeField(value: string, aria: string, disabled: boolean, set: (v: string) => unknown, clearable: boolean) {
    need(loadTimeField);
    return html`<fp3d-time-field
      .value=${value}
      .hour12=${uses12Hours(this.hass?.locale, this.hass?.language)}
      .clearable=${clearable}
      .label=${aria}
      .hourLabel=${this.tr("time_hour")}
      .minuteLabel=${this.tr("time_minute")}
      ?disabled=${disabled}
      @change=${(e: CustomEvent<{ value: string }>) => set(e.detail.value)}
    ></fp3d-time-field>`;
  }

  private renderEntity(s: Setting<string | null>, c: Extract<Control, { kind: "entity" }>, disabled: boolean) {
    const env = this.env;
    const value = s.read(env);
    const auto = c.auto?.(env);
    const autoLabel = auto === undefined ? null : auto ? this.t("entity_auto", { name: this.hass ? entityName(this.hass, auto) : auto }) : this.t("entity_auto_none");
    const fixed = [...(autoLabel !== null ? [{ id: "__auto", label: autoLabel }] : []), { id: "none", label: this.t("entity_none") }];
    const options = entityOptionList(this.hass, (id) => c.filter(id, env));
    need(loadEntityPicker);
    return html`<fp3d-entity-picker
      .options=${options}
      .fixed=${fixed}
      .value=${value ?? (autoLabel !== null ? "__auto" : "none")}
      .placeholder=${this.t("entity_search")}
      aria-label=${this.tr(s.label)}
      ?disabled=${disabled}
      @change=${(e: CustomEvent<{ value: string }>) => {
        e.stopPropagation();
        const v = e.detail.value;
        this.write(s, v === "__auto" || v === "none" ? null : v);
      }}
    ></fp3d-entity-picker>`;
  }

  private renderAction(s: Setting, c: Extract<Control, { kind: "action" }>, disabled: boolean) {
    if (c.action === "start_view") {
      const set = s.read(this.env);
      return html`<div class="st-actions">
        <button class="fp3d-btn" ?disabled=${disabled || !this.lastView} title=${this.lastView ? "" : this.tr("st_start_view_none")} @click=${() => this.act(s, "start_view")}>${this.tr(c.button)}</button>
        ${set ? html`<button class="fp3d-btn" ?disabled=${disabled} @click=${() => this.write(s, null)}>${this.tr("st_start_view_reset")}</button>` : nothing}
        <span class="st-sub">${this.tr(set ? "st_start_view_set" : "st_start_view_default")}</span>
      </div>`;
    }
    const n = Array.isArray(s.read(this.env)) ? (s.read(this.env) as unknown[]).length : 0;
    return html`<button class="fp3d-btn" ?disabled=${disabled} @click=${() => this.act(s, c.action)}>${this.tr(c.button, { n })}</button>`;
  }

  /** The warnings dismissed for good (#138), each with its way back; never a safety warning. */
  private renderIgnored(s: Setting, disabled: boolean) {
    const list = (s.read(this.env) as { kind: string; entity: string }[]) ?? [];
    if (!list.length) return html`<p class="st-sub">${this.tr("st_ignored_none")}</p>`;
    return html`<div class="st-list">
      ${list.map((a) => {
        const key = `alert_short_${a.kind}`;
        const kind = this.t(key);
        return html`<div class="st-list-row">
          <span title=${a.entity}>${kind === key ? a.kind : kind} · ${this.hass ? entityName(this.hass, a.entity) : a.entity}</span>
          <button class="fp3d-btn" ?disabled=${disabled} @click=${() => this.write(s, list.filter((x) => !(x.kind === a.kind && x.entity === a.entity)))}>${this.t("alert_restore")}</button>
        </div>`;
      })}
    </div>`;
  }

  /** A part the editor draws (its bundle loads the first time one is shown). */
  private renderEmbed(s: Setting, topic: string) {
    if (!this.viewer.editor && s.permission !== "everyone") return html`<p class="st-sub">${icon("lock", true)}</p>`;
    if (this._embedState !== "ready") {
      if (this._embedState === "idle" && this.loadEditor) {
        this._embedState = "loading";
        this.loadEditor().then(
          () => (this._embedState = "ready"),
          (err: unknown) => (this._embedState = String(err)),
        );
      }
      return html`<p class="st-sub">${this._embedState === "loading" || this._embedState === "idle" ? this.tr("st_embed_loading") : this.tr("st_embed_failed", { error: this._embedState })}</p>`;
    }
    return html`<fp3d-editor
      class="st-embed"
      .topic=${topic}
      .hass=${this.hass}
      .building=${this.building}
      .canEdit=${this.canEdit}
      .packs=${this.packs}
      .narrow=${true}
      @building-changed=${(e: CustomEvent<{ building: Building }>) => {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("settings-edit", { detail: { building: e.detail.building, key: null }, bubbles: true, composed: true }));
      }}
    ></fp3d-editor>`;
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        display: block;
        min-height: 0;
        overflow: hidden;
      }
      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }
      .st {
        display: grid;
        grid-template-columns: 248px 1fr;
        height: 100%;
        min-height: 0;
      }
      .st-stale {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        padding: 24px 16px;
      }
      .st-nav {
        border-right: 1px solid var(--fp3d-line);
        background: var(--fp3d-chrome);
        padding: 12px;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .st-backto,
      .st-other,
      .st-side,
      .st-link,
      .st-nav-btn {
        border: 0;
        background: none;
        font: inherit;
        cursor: pointer;
      }
      .st-backto,
      .st-other {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 40px;
        padding: 0 8px;
        color: var(--fp3d-accent);
      }
      .st-other {
        margin-top: 12px;
        border-top: 1px solid var(--fp3d-line);
        justify-content: space-between;
      }
      .st-sides {
        display: flex;
        gap: 4px;
        padding: 4px;
        margin: 4px 0 10px;
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
      }
      .st-side {
        flex: 1;
        display: flex;
        gap: 6px;
        min-height: 44px;
        padding: 6px;
        border-radius: 6px;
        color: var(--fp3d-muted);
        font-size: 11.5px;
        text-align: left;
      }
      .st-side b {
        display: block;
        font-size: 13.5px;
        color: var(--fp3d-text);
      }
      .st-side[aria-pressed="true"] {
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
        color: var(--fp3d-accent);
      }
      .st-search {
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        padding: 0 10px;
        margin-bottom: 8px;
        background: var(--fp3d-bg2);
        color: var(--fp3d-muted);
      }
      .st-search input {
        flex: 1;
        min-width: 0;
        min-height: 38px;
        border: 0;
        background: none;
        color: var(--fp3d-text);
        font: inherit;
        font-size: 14px;
      }
      .st-search input:focus {
        outline: none;
      }
      .st-search:focus-within {
        border-color: var(--fp3d-accent);
      }
      .st-group {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
        padding: 12px 8px 4px;
      }
      .st-nav-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 38px;
        padding: 0 8px;
        border-radius: 8px;
        color: var(--fp3d-text);
        font-size: 14px;
        text-align: left;
      }
      .st-nav-btn:hover {
        background: var(--fp3d-bg2);
      }
      .st-nav-btn[aria-current="page"] {
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
        color: var(--fp3d-accent);
        font-weight: 600;
      }
      .st-ic {
        display: inline-flex;
        width: 18px;
      }
      .st-chev {
        margin-left: auto;
        color: var(--fp3d-muted);
        display: none;
      }
      .st-main {
        overflow: auto;
        padding: 20px 24px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }
      .st-main > * {
        max-width: 760px;
        width: 100%;
      }
      .st-back {
        display: none;
      }
      .st-title {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px 16px;
        flex-wrap: wrap;
      }
      .st-title h2 {
        margin: 0;
        font-family: var(--fp3d-title-font);
        font-size: 22px;
      }
      .st-title p {
        margin: 4px 0 0;
        color: var(--fp3d-muted);
        font-size: 13px;
      }
      .st-lock,
      .st-note {
        margin: 0;
        padding: 9px 12px;
        border-radius: 10px;
        font-size: 13px;
        color: var(--fp3d-warm);
        border: 1px solid color-mix(in srgb, var(--fp3d-warm) 35%, transparent);
        background: color-mix(in srgb, var(--fp3d-warm) 8%, transparent);
      }
      .st-note {
        color: var(--fp3d-text);
        border-color: var(--fp3d-line);
        background: var(--fp3d-bg2);
      }
      .st-card {
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-card);
        background: var(--fp3d-chrome);
      }
      .st-card h3 {
        margin: 0;
        padding: 12px 16px 4px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .st-link {
        padding: 0;
        color: var(--fp3d-accent);
        letter-spacing: inherit;
        text-transform: inherit;
        min-height: 36px;
      }
      .st-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px 18px;
        align-items: center;
        padding: 11px 16px;
        border-top: 1px solid var(--fp3d-line);
      }
      .st-card h3 + .st-row {
        border-top: 0;
      }
      .st-row.st-hit {
        background: color-mix(in srgb, var(--fp3d-accent) 8%, transparent);
      }
      .st-row.st-active {
        box-shadow: inset 3px 0 0 var(--fp3d-accent);
      }
      .st-lock {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .st-lbl {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        grid-column: 1;
      }
      .st-hint {
        grid-column: 1;
        margin: 0;
        font-size: 12.5px;
        line-height: 1.45;
        color: var(--fp3d-muted);
      }
      .st-ctl {
        grid-column: 2;
        grid-row: 1 / span 2;
        justify-self: end;
        min-width: 0;
      }
      .st-nohint .st-ctl {
        grid-row: 1;
      }
      .st-row-wide .st-ctl {
        grid-column: 1 / -1;
        grid-row: auto;
        justify-self: stretch;
      }
      .st-rule {
        display: block;
        font-style: italic;
      }
      .st-info {
        font-size: 14px;
      }
      .st-sw {
        position: relative;
        width: 46px;
        height: 28px;
        border: 0;
        padding: 0;
        border-radius: 999px;
        background: var(--fp3d-line);
        cursor: pointer;
        /* the tap target is the whole 46 × 36 px box around the track */
        margin: 4px 0;
      }
      .st-sw::after {
        content: "";
        position: absolute;
        top: 4px;
        left: 4px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--fp3d-muted);
        transition: transform 0.15s, background 0.15s;
      }
      .st-sw[aria-checked="true"] {
        background: var(--fp3d-primary);
      }
      .st-sw[aria-checked="true"]::after {
        transform: translateX(18px);
        background: var(--fp3d-primary-text);
      }
      .st-sw:disabled,
      .st-seg button:disabled,
      .st-ctl :disabled {
        opacity: 0.5;
        cursor: default;
      }
      .st-num {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .st-num i {
        font-style: normal;
        color: var(--fp3d-muted);
        font-size: 13px;
      }
      .st-num input[type="number"],
      .st-num .st-len,
      .st-text,
      .st-select {
        font: inherit;
        font-size: 14px;
        color: var(--fp3d-text);
        background: var(--fp3d-bg2);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        padding: 0 9px;
        min-height: 36px;
        min-width: 0;
      }
      .st-num .st-len {
        width: 110px;
      }
      .st-num input[type="number"] {
        width: 90px;
        font-variant-numeric: tabular-nums;
      }
      .st-text {
        width: min(280px, 100%);
      }
      .st-select {
        max-width: 280px;
      }
      .st-seg {
        flex-wrap: wrap;
        box-shadow: none;
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
      }
      .st-seg button {
        min-height: 32px;
        padding: 5px 11px;
        font-size: 13px;
      }
      .st-colour {
        display: inline-flex;
        gap: 6px;
        align-items: center;
      }
      .st-multi {
        width: 100%;
        max-width: 460px;
      }
      .st-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
      }
      .st-sub {
        margin: 0;
        font-size: 12.5px;
        color: var(--fp3d-muted);
      }
      .st-list {
        display: grid;
        gap: 6px;
      }
      .st-list-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 4px 4px 4px 10px;
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        background: var(--fp3d-bg2);
        font-size: 13px;
      }
      .st-list-row span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      fp3d-entity-picker {
        display: block;
        max-width: 420px;
        font-size: 14px;
      }
      .st-embed {
        display: block;
        height: auto;
      }
      .fp3d-btn {
        min-height: 36px;
      }
      .st-save {
        margin: 0;
        font-size: 12.5px;
        padding-top: 6px;
      }
      .st-save-saved,
      .st-save-idle {
        color: #34d399;
      }
      .st-save-error {
        color: var(--fp3d-danger);
      }
      @media (max-width: ${NARROW_PX}px) {
        .st {
          grid-template-columns: 1fr;
        }
        .st-nav {
          border-right: 0;
        }
        .st-drill .st-nav {
          display: none;
        }
        /* a search in progress keeps its box on screen above the results (#254) */
        .st-drill.st-query {
          grid-template-rows: auto 1fr;
        }
        .st-drill.st-query .st-nav {
          display: flex;
        }
        .st-drill.st-query .st-nav > :not(.st-search) {
          display: none;
        }
        .st:not(.st-drill) .st-main {
          display: none;
        }
        .st-chev {
          display: inline;
        }
        .st-nav-btn {
          min-height: 44px;
        }
        .st-back {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          align-self: flex-start;
          width: auto;
          border: 0;
          background: none;
          color: var(--fp3d-accent);
          font: inherit;
          font-size: 14px;
          min-height: 36px;
          padding: 0;
          cursor: pointer;
        }
        .st-main {
          padding: 12px 16px 24px;
        }
        /* a switch or a number stays at the right; wider controls go under their label */
        .st-row:not(.st-k-switch):not(.st-k-number) {
          grid-template-columns: 1fr;
        }
        .st-row:not(.st-k-switch):not(.st-k-number) .st-ctl {
          grid-column: 1;
          grid-row: auto;
          justify-self: start;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .st-sw::after,
        .st-row {
          transition: none;
        }
      }
    `,
  ];
}

defineElement("fp3d-settings-page", SettingsPage);
