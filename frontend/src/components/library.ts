// The furniture library of the editor: everything that can be placed, sorted by what it is and filtered by the
// room it is for, with a picture, the size and a star on every card; variants of one thing (a bed in five widths,
// a corner sofa for the left and the right) fold into one card with chips. The logic (index, classification, families, search) lives in library-index.ts;
// this element only shows it. Pictures are drawn by the 3D bundle through the `thumb` callback and kept in the
// browser (thumbs.ts). Fires "library-add" {type, mirror} and "library-preview" {type, element} (type null = gone; only without card pictures),
// and "library-update" {types} from the badge of a card whose placed items have an update (#48, editors only).

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { KINDS, activeFilters, cardsOf, searchLibrary, warmIndex, sizeText, type LibraryCard, type LibraryChip, type LibraryEntry, type LibraryFilter, type Room, ROOMS } from "../library-index.ts";
import { updatesOnCard } from "../pack-updates.ts";
import { tokens } from "../styles.ts";
import { thumbFor } from "../thumbs.ts";

const RECENT_MAX = 10;
const PAGE = 24;
const THUMB_PX = 96;
const STORE_OPEN = "home3d.lib.open";
const STORE_FAV = "home3d.lib.fav";
const STORE_RECENT = "home3d.lib.recent";
const STORE_RECENT_SHUT = "home3d.lib.recent.shut";
const STORE_SHUT = "home3d.lib.shut";
const STORE_FILTERS = "home3d.lib.filters";
/** Blocks above and below the sections: open by default, each folds away on its own header (#211). */
const SPECIAL = new Set(["fav", "other-rooms"]);
/** The sections open until the person has opened or closed one. */
const DEFAULT_OPEN = ["sofa", "lamp"];

/** What a card picture is kept under: the item and its pack's release, so an updated pack gets its picture drawn again (#192). */
export const pictureKey = (e: Pick<LibraryEntry, "type" | "packRelease">): string => `${e.type}|${e.packRelease}`;

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no storage: the choice lives for this page
  }
}

/** A stored list of library keys (favourites, recent). */
function storedKeys(key: string): string[] {
  const list = load<unknown>(key, []);
  return Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : [];
}

export class FurnitureLibrary extends LitElement {
  static properties = {
    entries: { attribute: false },
    language: { attribute: false },
    roomHint: { attribute: false },
    admin: { type: Boolean },
    lite: { type: Boolean },
    t: { attribute: false },
    thumb: { attribute: false },
    updates: { attribute: false },
    _query: { state: true },
    _room: { state: true },
    _electric: { state: true },
    _light: { state: true },
    _outdoor: { state: true },
    _pack: { state: true },
    _open: { state: true },
    _shut: { state: true },
    _searchShut: { state: true },
    _fav: { state: true },
    _recent: { state: true },
    _recentShut: { state: true },
    _thumbs: { state: true },
    _shown: { state: true },
    _limits: { state: true },
    _filtersOpen: { state: true },
    _status: { state: true },
  };

  /** Everything the library offers (from buildIndex). */
  declare entries: LibraryEntry[];
  declare language: string;
  /** The room kind of the room open in the editor: preselects the room chips until the user picks one. */
  declare roomHint: Room | null;
  declare admin: boolean;
  /** Weak device: no pictures on the cards (the hover preview stays). */
  declare lite: boolean;
  declare t: Translate;
  /** Draws an item's picture (a data URL) or gives null; the library asks once per item and release. */
  declare thumb: ((entry: LibraryEntry) => Promise<string | null>) | null;
  /** The furniture types of placed items with an update (#48): their cards offer it to editors. */
  declare updates: ReadonlySet<string>;
  private declare _query: string;
  private declare _room: Room | null;
  private declare _electric: boolean;
  private declare _light: boolean;
  private declare _outdoor: boolean;
  /** The pack the library is narrowed to (its id), or null for all (#109). */
  private declare _pack: string | null;
  /** The sections the person left open (remembered per device); null until one was opened or closed (#211). */
  private declare _open: Set<string> | null;
  /** Favourites / other rooms folded away (remembered per device). */
  private declare _shut: Set<string>;
  /** Headers folded away while a search is typed (forgotten when the search starts or ends). */
  private declare _searchShut: Set<string>;
  /** What opens by itself while nothing was chosen: worked out by render. */
  private defaultOpen = new Set<string>();
  private declare _fav: string[];
  private declare _recent: string[];
  /** The Recently used block is folded away (#78). */
  private declare _recentShut: boolean;
  private declare _thumbs: Map<string, string>;
  /** The variant whose picture a family card shows (its first key -> the variant's key), set by hovering a chip. */
  private declare _shown: Map<string, string>;
  private declare _limits: Map<string, number>;
  /** The filter drawer (room, pack, toggles) is open; remembered per device, closed by default (#300). */
  private declare _filtersOpen: boolean;
  /** The "N results" line a screen reader hears, set a moment after the query or a filter changed. */
  private declare _status: string;
  private resultText = "";
  private filterKey = "";
  private announcedKey: string | null = null;
  private statusTimer: ReturnType<typeof setTimeout> | undefined;
  private roomTouched = false;
  private observer: IntersectionObserver | null = null;
  private observed = new WeakSet<Element>();
  private wanted = new Set<string>();
  private drawing = 0;
  private warmTimer: ReturnType<typeof setTimeout> | undefined;
  private queue: LibraryEntry[] = [];

  constructor() {
    super();
    this.entries = [];
    this.language = "en";
    this.roomHint = null;
    this.admin = true;
    this.lite = ((navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? 4) <= 2 || ((navigator as { deviceMemory?: number }).deviceMemory ?? 4) <= 2;
    this.t = (k) => k;
    this.thumb = null;
    this.updates = new Set();
    this._query = "";
    this._room = null;
    this._electric = false;
    this._light = false;
    this._outdoor = false;
    this._pack = null;
    const stored = load<string[] | null>(STORE_OPEN, null);
    this._open = Array.isArray(stored) ? new Set(stored) : null;
    this._shut = new Set(load<string[]>(STORE_SHUT, []));
    this._searchShut = new Set();
    this._fav = storedKeys(STORE_FAV);
    this._recent = storedKeys(STORE_RECENT);
    this._recentShut = load<boolean>(STORE_RECENT_SHUT, false) === true;
    this._thumbs = new Map();
    this._shown = new Map();
    this._limits = new Map();
    this._filtersOpen = load<boolean>(STORE_FILTERS, false) === true;
    this._status = "";
  }

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("roomHint") && !this.roomTouched) this._room = this.roomHint;
    if (changed.has("entries")) {
      // the search's index is worked out while nothing is typed yet, not on the first letter (#131)
      clearTimeout(this.warmTimer);
      const entries = this.entries;
      // in short slices, so a slow tablet never stalls on it
      const warm = (from: number) => {
        const end = Math.min(entries.length, from + 200);
        warmIndex(entries.slice(from, end));
        if (end < entries.length) this.warmTimer = setTimeout(() => warm(end), 0);
      };
      this.warmTimer = setTimeout(() => warm(0), 300);
      // a pack that is gone (removed) no longer narrows anything
      if (this._pack && !this.entries.some((e) => e.pack === this._pack)) this._pack = null;
      // packs changed: forget pictures of items that are gone and start over with the queue
      const known = new Set(this.entries.map((e) => e.key));
      this._fav = this._fav.filter((k) => known.has(k));
      this._recent = this._recent.filter((k) => known.has(k));
      this.queue = [];
      this.resetPictures(this.entries);
    }
  }

  /**
   * Packs changed (#192): pictures of items that are gone, or of a pack release that was replaced, are dropped,
   * and items that were queued but never drawn are asked for again (they would otherwise stay "wanted" for good).
   */
  resetPictures(entries: readonly LibraryEntry[]): void {
    const known = new Set(entries.map(pictureKey));
    this._thumbs = new Map([...this._thumbs].filter(([k]) => known.has(k)));
    this.wanted = new Set([...this.wanted].filter((k) => this._thumbs.has(k)));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.warmTimer);
    clearTimeout(this.statusTimer);
    this.observer?.disconnect();
    this.observer = null;
  }

  updated(): void {
    // "N results" for a screen reader, a moment after the query or a filter changed (not on every re-render)
    const key = `${this._query.trim()}|${this.filterKey}`;
    if (this.announcedKey === null) this.announcedKey = key;
    else if (key !== this.announcedKey) {
      this.announcedKey = key;
      clearTimeout(this.statusTimer);
      this.statusTimer = setTimeout(() => (this._status = this.resultText), 500);
    }
    if (this.lite || !this.thumb) return;
    this.observer ??= new IntersectionObserver(
      (hits) => {
        for (const h of hits) {
          if (!h.isIntersecting) continue;
          const entry = this.byKey.get((h.target as HTMLElement).dataset.key ?? "");
          if (entry) this.want(entry);
        }
      },
      { root: null, rootMargin: "200px" },
    );
    const byKey = this.byKey;
    for (const el of this.renderRoot.querySelectorAll<HTMLElement>(".fp3d-lc-pic[data-key]")) {
      // a new card: the observer reports it once it is laid out (in view or not)
      if (!this.observed.has(el)) {
        this.observed.add(el);
        this.observer.observe(el);
        continue;
      }
      const entry = byKey.get(el.dataset.key ?? "");
      if (!entry || this._thumbs.has(pictureKey(entry)) || this.wanted.has(pictureKey(entry))) continue;
      // a card still without its picture: asked again if it is in view; observing it anew reports that after the next
      // layout, where measuring it here forced a layout of every new card on each keystroke (#131)
      this.observer.unobserve(el);
      this.observer.observe(el);
    }
  }

  private get byKey(): Map<string, LibraryEntry> {
    return new Map(this.entries.map((e) => [e.key, e]));
  }

  /**
   * A family card shows the picture of the variant under the pointer (a sofa in five widths, a corner for the
   * left or the right): its picture is drawn on demand. Without card pictures the big preview shows it instead.
   */
  private showVariant(cardKey: string, entry: LibraryEntry | null, el: HTMLElement | null): void {
    if (this.lite || !this.thumb) {
      this.preview(entry?.type ?? null, el);
      return;
    }
    const next = new Map(this._shown);
    if (entry) next.set(cardKey, entry.key);
    else next.delete(cardKey);
    this._shown = next;
    if (entry) this.want(entry);
  }

  /** Asks for an item's picture once; at most two are drawn at a time so the editor stays smooth. */
  private want(entry: LibraryEntry): void {
    const pic = pictureKey(entry);
    if (this._thumbs.has(pic) || this.wanted.has(pic)) return;
    this.wanted.add(pic);
    this.queue.push(entry);
    this.drain();
  }

  private drain(): void {
    while (this.drawing < 2 && this.queue.length) {
      const entry = this.queue.shift()!;
      this.drawing++;
      const pic = pictureKey(entry);
      const key = `${pic}|${THUMB_PX}|1`;
      thumbFor(key, () => (this.thumb ? this.thumb(entry) : Promise.resolve(null)))
        .then((url) => {
          if (url) {
            const next = new Map(this._thumbs);
            next.set(pic, url);
            this._thumbs = next;
          } else this.wanted.delete(pic);
        })
        .catch(() => this.wanted.delete(pic))
        .finally(() => {
          this.drawing--;
          this.drain();
        });
    }
  }

  private pick(entry: LibraryEntry): void {
    if (!this.admin) return;
    this._recent = [entry.key, ...this._recent.filter((k) => k !== entry.key)].slice(0, RECENT_MAX);
    save(STORE_RECENT, this._recent);
    this.resetFilters();
    this.dispatchEvent(new CustomEvent("library-add", { detail: { type: entry.type, mirror: !!entry.mirror }, bubbles: true, composed: true }));
  }

  private preview(type: string | null, element: HTMLElement | null): void {
    // the cards show their pictures: the big preview stays only on devices without them
    if (!this.lite) return;
    this.dispatchEvent(new CustomEvent("library-preview", { detail: { type, element }, bubbles: true, composed: true }));
  }

  private toggleFav(key: string): void {
    this._fav = this._fav.includes(key) ? this._fav.filter((k) => k !== key) : [...this._fav, key];
    save(STORE_FAV, this._fav);
  }

  private toggleRecent(): void {
    this._recentShut = !this._recentShut;
    save(STORE_RECENT_SHUT, this._recentShut);
  }

  /** Is the block under this header showing? (#211) */
  private isOpen(key: string, searching: boolean): boolean {
    if (key === "recent") return !this._recentShut;
    if (searching) return !this._searchShut.has(key);
    if (SPECIAL.has(key)) return !this._shut.has(key);
    return (this._open ?? this.defaultOpen).has(key);
  }

  /** A header toggles its own block only; any number stay open (#211). */
  private toggleOpen(key: string, searching: boolean): void {
    if (key === "recent") return this.toggleRecent();
    const flip = (from: Set<string>): Set<string> => {
      const next = new Set(from);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    };
    // the shut sets hold the folded blocks, the open set the opened ones
    if (searching) this._searchShut = flip(this._searchShut);
    else if (SPECIAL.has(key)) {
      this._shut = flip(this._shut);
      save(STORE_SHUT, [...this._shut]);
    } else {
      this._open = flip(this._open ?? this.defaultOpen);
      save(STORE_OPEN, [...this._open]);
    }
  }

  private setQuery(value: string): void {
    // folding done during one search is forgotten when a search starts or ends
    if (!!this._query.trim() !== !!value.trim()) this._searchShut = new Set();
    this._query = value;
  }

  private setFiltersOpen(open: boolean): void {
    this._filtersOpen = open;
    save(STORE_FILTERS, open);
  }

  private setRoom(room: Room | null): void {
    this.roomTouched = true;
    this._room = room;
  }

  /** The filter the cards show: the typed words and the chips. */
  get filter(): LibraryFilter {
    return { query: this._query, room: this._room, electric: this._electric, light: this._light, outdoor: this._outdoor, pack: this._pack };
  }

  /** The chips that are switched on (shown above the cards with "Clear filters"). */
  get activeFilters(): LibraryChip[] {
    return activeFilters(this.filter);
  }

  /** "Clear filters": every chip off and all rooms; the typed words stay (the search box clears itself). */
  clearFilters(): void {
    this.roomTouched = true;
    this._room = null;
    this._pack = null;
    this._electric = this._light = this._outdoor = false;
  }

  /** After an item is chosen: chips off and the room chip back on the open room (it follows the room again). */
  resetFilters(): void {
    this.roomTouched = false;
    this._room = this.roomHint;
    this._pack = null;
    this._electric = this._light = this._outdoor = false;
  }

  render() {
    const t = this.t;
    const filter = this.filter;
    const found = searchLibrary(this.entries, filter);
    const hits = found.hits;
    const searching = this._query.trim().length > 0;
    const byKey = this.byKey;
    const hitKeys = new Set(hits.map((e) => e.key));
    const single = (e: LibraryEntry): LibraryCard => ({ key: e.key, label: e.label, kind: e.kind, rooms: e.rooms, entries: [e] });
    const recent = this._recent.map((k) => byKey.get(k)).filter((e): e is LibraryEntry => !!e && hitKeys.has(e.key));
    const favs = this._fav.map((k) => byKey.get(k)).filter((e): e is LibraryEntry => !!e && hitKeys.has(e.key));
    // while searching, the room chip ranks instead of hiding (#77): its items by kind, then the rest in one block
    const sections = KINDS.map((kind) => ({ kind, cards: cardsOf(found.inRoom, kind) })).filter((s) => s.cards.length);
    const others = found.otherRooms.length ? KINDS.flatMap((kind) => cardsOf(found.otherRooms, kind)) : [];
    // until the person opens or closes one, the usual sections open by themselves, else the first one
    const usual = sections.filter((s) => DEFAULT_OPEN.includes(s.kind)).map((s) => s.kind);
    this.defaultOpen = new Set(usual.length ? usual : sections.length ? [sections[0].kind] : []);
    const active = activeFilters(filter);
    const chipName = (c: LibraryChip) => (c === "room" ? t(`lib_room_${this._room}`) : c === "pack" ? (this.entries.find((e) => e.pack === this._pack)?.packLabel ?? this._pack ?? "") : t(`lib_chip_${c}`));
    const packs = this.packList();
    const n = active.length;
    const open = this._filtersOpen;
    const q = this._query.trim();
    this.resultText = hits.length === 1 ? t("lib_results_one") : t("lib_results", { n: hits.length });
    this.filterKey = JSON.stringify(filter);
    return html`<div class="fp3d-lib-top">
        <div class="fp3d-lib-bar">
          <input
            class="fp3d-search"
            type="search"
            aria-label=${t("lib_search_label")}
            placeholder=${t("furniture_search")}
            .value=${this._query}
            @input=${(e: Event) => this.setQuery((e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Escape") this.setQuery("");
            }}
          />
          <button class="fp3d-lib-filterbtn ${open || n ? "on" : ""}" aria-expanded=${open} aria-controls="fp3d-lib-filters" @click=${() => this.setFiltersOpen(!open)}>
            ${t("lib_filters_btn")}${n ? html` <span class="fp3d-lib-badge">${n}</span>` : nothing}
          </button>
        </div>
        <div id="fp3d-lib-filters" class="fp3d-lib-drawer" ?hidden=${!open}>
          <label class="fp3d-lib-sel"
            ><span>${t("lib_room_label")}</span>
            <select @change=${(e: Event) => this.setRoom(((e.target as HTMLSelectElement).value || null) as Room | null)}>
              <option value="" ?selected=${this._room === null}>${t("lib_room_all")}</option>
              ${ROOMS.map((r) => html`<option value=${r} ?selected=${this._room === r}>${t(`lib_room_${r}`)}</option>`)}
            </select></label
          >
          ${packs.size < 2
            ? nothing
            : html`<label class="fp3d-lib-sel"
                ><span>${t("lib_pack_label")}</span>
                <select @change=${(e: Event) => (this._pack = (e.target as HTMLSelectElement).value || null)}>
                  <option value="" ?selected=${this._pack === null}>${t("lib_pack_all")}</option>
                  ${[...packs].map(([id, label]) => html`<option value=${id} ?selected=${this._pack === id}>${label}</option>`)}
                </select></label
              >`}
          <div class="fp3d-lib-chips" role="group" aria-label=${t("lib_toggles_label")}>
            <button class="fp3d-chip fp3d-chip-f ${this._electric ? "on" : ""}" aria-pressed=${this._electric} @click=${() => (this._electric = !this._electric)}><span aria-hidden="true">⚡</span> ${t("lib_chip_electric")}</button>
            <button class="fp3d-chip fp3d-chip-f ${this._light ? "on" : ""}" aria-pressed=${this._light} @click=${() => (this._light = !this._light)}><span aria-hidden="true">💡</span> ${t("lib_chip_light")}</button>
            <button class="fp3d-chip fp3d-chip-f ${this._outdoor ? "on" : ""}" aria-pressed=${this._outdoor} @click=${() => (this._outdoor = !this._outdoor)}><span aria-hidden="true">🌳</span> ${t("lib_chip_outdoor")}</button>
          </div>
        </div>
        ${active.length
          ? html`<div class="fp3d-lib-active">
              <span>${t("lib_filters")} ${active.map(chipName).join(" · ")}${found.hiddenByChips ? html` <span class="fp3d-lib-hidden">(${t("lib_hidden_by_filters", { n: found.hiddenByChips })})</span>` : nothing}</span>
              <button class="fp3d-lib-clear" @click=${() => this.clearFilters()}>${t("lib_clear_filters")}</button>
            </div>`
          : nothing}
      </div>
      <div class="fp3d-lib-sr" role="status" aria-live="polite">${this._status}</div>
      ${!searching && this.roomHint && this._room === this.roomHint && !this.roomTouched ? html`<p class="fp3d-lib-hint">${t("lib_hint_room")}</p>` : nothing}
      ${!hits.length
        ? html`<div class="fp3d-lib-empty">
            <p class="fp3d-lib-hint">${q ? t("lib_no_match", { q }) : t("furniture_search_none")}</p>
            ${found.hiddenByChips ? html`<p class="fp3d-lib-hint">${t("lib_hidden_by_filters", { n: found.hiddenByChips })}</p>` : nothing}
            ${active.length ? html`<button class="fp3d-lib-clear fp3d-lib-clear-big" @click=${() => this.clearFilters()}>${t("lib_clear_filters")}</button>` : nothing}
          </div>`
        : nothing}
      ${found.cut ? html`<p class="fp3d-lib-hint">${t("lib_keep_typing", { n: found.cut })}</p>` : nothing}
      ${recent.length && !searching ? this.section("recent", `🕘 ${t("lib_recent")}`, recent.map(single), searching) : nothing}
      ${favs.length ? this.section("fav", `★ ${t("lib_favorites")}`, favs.map(single), searching) : nothing}
      ${sections.map((s) => this.section(s.kind, t(`lib_kind_${s.kind}`), s.cards, searching))}
      ${others.length ? this.section("other-rooms", t("lib_other_rooms", { n: found.otherRooms.length }), others, searching) : nothing}`;
  }

  /** The packs to narrow the library to (id -> label); the pack select shows only with two or more installed (#109). */
  private packList(): Map<string, string> {
    const packs = new Map<string, string>();
    for (const e of this.entries) if (e.pack && e.packLabel) packs.set(e.pack, e.packLabel);
    return packs;
  }

  private section(key: string, title: string, cards: LibraryCard[], searching: boolean) {
    // every header folds its own block away; while searching the blocks start expanded (#211)
    const recent = key === "recent";
    const open = this.isOpen(key, searching);
    const limit = this._limits.get(key) ?? PAGE;
    const shown = cards.slice(0, limit);
    const count = cards.reduce((n, c) => n + c.entries.length, 0);
    return html`<button class="fp3d-lib-head fp3d-lib-toggle ${recent ? "fp3d-lib-recent" : ""}" aria-expanded=${open} @click=${() => this.toggleOpen(key, searching)}>
        <span class="fp3d-lib-caret">${open ? "▾" : "▸"}</span>${title} <span class="fp3d-lib-count">${count}</span>
      </button>
      ${open
        ? html`<div class="fp3d-lib-grid ${recent ? "fp3d-lib-recent-grid" : ""}">${repeat(shown, (c) => c.key, (c) => this.card(c))}</div>
            ${cards.length > limit
              ? html`<button class="fp3d-lib-more" @click=${() => {
                  const next = new Map(this._limits);
                  next.set(key, limit + PAGE * 2);
                  this._limits = next;
                }}>${this.t("lib_more", { n: cards.length - limit })}</button>`
              : nothing}`
        : nothing}`;
  }

  private card(c: LibraryCard) {
    const t = this.t;
    const first = c.entries[0];
    const family = c.entries.length > 1;
    const fav = this._fav.includes(first.key);
    // a family card shows the variant under the pointer (its picture once drawn, the first one meanwhile)
    const shownKey = this._shown.get(first.key);
    const shown = (shownKey && c.entries.find((e) => e.key === shownKey)) || first;
    const pic = this._thumbs.get(pictureKey(shown)) ?? this._thumbs.get(pictureKey(first));
    const badge = first.light ? "💡" : first.electric ? "⚡" : "";
    const updates = updatesOnCard(c.entries.map((e) => e.type), this.updates, this.admin);
    return html`<div class="fp3d-lc ${family ? "fp3d-lc-family" : ""}" title=${shown.ikea ? `${shown.label} (IKEA ${shown.ikea})` : shown.label} @mouseleave=${() => family && this.showVariant(first.key, null, null)}>
      <button
        class="fp3d-lc-main"
        ?disabled=${!this.admin}
        @click=${() => this.pick(first)}
        @mouseenter=${(e: Event) => this.preview(first.type, e.currentTarget as HTMLElement)}
        @focus=${(e: Event) => this.preview(first.type, e.currentTarget as HTMLElement)}
        @mouseleave=${() => this.preview(null, null)}
        @blur=${() => this.preview(null, null)}
      >
        ${this.lite ? nothing : html`<span class="fp3d-lc-pic" data-key=${first.key}>${pic ? html`<img src=${pic} alt="" loading="lazy" class=${(this._thumbs.has(pictureKey(shown)) ? shown : first).mirror ? "fp3d-lc-mirrored" : ""} />` : html`<span class="fp3d-lc-wait"></span>`}</span>`}
        <span class="fp3d-lc-label">${c.label}${badge ? html` <span class="fp3d-lc-badge">${badge}</span>` : nothing}</span>
        <span class="fp3d-lc-sub">${family ? t("lib_sizes", { n: c.entries.length }) : sizeText(first.size, this.language)}${first.packLabel ? html` · ${first.packLabel}` : html` · ${t("lib_basic")}`}</span>
      </button>
      ${family
        ? html`<div class="fp3d-lc-chips">
            ${c.entries.map(
              (e) => html`<button
                title="${e.label} · ${sizeText(e.size, this.language)}"
                ?disabled=${!this.admin}
                class="fp3d-lc-chip ${shown.key === e.key && family && shownKey ? "on" : ""}"
                @click=${() => this.pick(e)}
                @mouseenter=${(ev: Event) => this.showVariant(first.key, e, ev.currentTarget as HTMLElement)}
                @focus=${(ev: Event) => this.showVariant(first.key, e, ev.currentTarget as HTMLElement)}
                @mouseleave=${() => this.preview(null, null)}
                @blur=${() => this.preview(null, null)}
              >${e.variant ?? e.label}</button>`,
            )}
          </div>`
        : nothing}
      ${updates.length
        ? html`<button
            class="fp3d-lc-update"
            title=${t("lib_update_title")}
            @click=${() => this.dispatchEvent(new CustomEvent("library-update", { detail: { types: updates }, bubbles: true, composed: true }))}
          >
            ⟳ ${t("upd_update")}
          </button>`
        : nothing}
      <button class="fp3d-lc-fav ${fav ? "on" : ""}" title=${fav ? t("lib_fav_remove") : t("lib_fav_add")} aria-label=${fav ? t("lib_fav_remove") : t("lib_fav_add")} @click=${() => this.toggleFav(first.key)}>${fav ? "★" : "☆"}</button>
    </div>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      /* the search and the filter button stay in view above the results (sticky in the scrolling side panel, #300) */
      .fp3d-lib-top {
        position: sticky;
        top: 0;
        z-index: 3;
        margin: 0 -2px;
        padding: 6px 2px 2px;
        background: var(--fp3d-chrome-solid, var(--fp3d-panel, #0d1424));
        /* solid up to the panel's top edge too (#320): the side panel's top padding sits above a top:0 sticky box, and
           the rows scrolled up into it showed through */
        box-shadow: 0 -14px 0 var(--fp3d-chrome-solid, var(--fp3d-panel, #0d1424));
      }
      .fp3d-lib-bar {
        display: flex;
        gap: 6px;
        margin-bottom: 6px;
      }
      .fp3d-search {
        flex: 1;
        min-width: 0;
        min-height: 36px;
        box-sizing: border-box;
        font: inherit;
        font-size: 14px;
        color: var(--fp3d-text);
        background: var(--fp3d-panel, #0d1424);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        padding: 6px 10px;
      }
      .fp3d-lib-filterbtn {
        flex: none;
        min-height: 36px;
        padding: 0 12px;
        font: inherit;
        font-size: 13px;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        cursor: pointer;
      }
      .fp3d-lib-filterbtn.on {
        border-color: var(--fp3d-accent);
      }
      .fp3d-lib-badge {
        display: inline-block;
        min-width: 16px;
        padding: 0 5px;
        font-size: 11px;
        font-weight: 700;
        line-height: 16px;
        text-align: center;
        color: var(--fp3d-primary-text);
        background: var(--fp3d-primary);
        border-radius: 999px;
      }
      .fp3d-lib-drawer {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-bottom: 6px;
      }
      .fp3d-lib-drawer[hidden] {
        display: none;
      }
      .fp3d-lib-drawer .fp3d-lib-chips {
        grid-column: 1 / -1;
        margin-bottom: 0;
      }
      .fp3d-lib-sel {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        font-size: 11px;
        color: var(--fp3d-muted);
      }
      .fp3d-lib-sel select {
        min-height: 36px;
        min-width: 0;
        box-sizing: border-box;
        font: inherit;
        font-size: 13px;
        color: var(--fp3d-text);
        background: var(--fp3d-panel, #0d1424);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        padding: 0 6px;
      }
      .fp3d-lib-sr {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        border: 0;
      }
      .fp3d-lib-empty {
        margin: 4px 0 8px;
      }
      .fp3d-lib-clear-big {
        padding: 6px 12px;
      }
      .fp3d-lib-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 6px;
      }
      /* fingers need 40-44 px; the shared coarse rules live in the editor's styles and do not reach this shadow root */
      @media (pointer: coarse) {
        .fp3d-search,
        .fp3d-lib-filterbtn,
        .fp3d-lib-sel select,
        .fp3d-chip,
        .fp3d-lib-clear,
        .fp3d-lib-more,
        .fp3d-lib-head {
          min-height: var(--fp3d-touch, 44px);
        }
        .fp3d-lib-filterbtn,
        .fp3d-chip {
          min-width: 40px;
        }
      }
      .fp3d-chip {
        font: inherit;
        font-size: 12px;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        padding: 3px 9px;
        cursor: pointer;
        white-space: nowrap;
      }
      .fp3d-chip.on {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
        border-color: var(--fp3d-accent);
        font-weight: 600;
      }
      .fp3d-chip-f {
        font-size: 11px;
      }
      .fp3d-lib-hint {
        margin: 2px 0 8px;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .fp3d-lib-active {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px 8px;
        margin: 0 0 8px;
        padding: 5px 8px;
        font-size: 12px;
        color: var(--fp3d-text);
        border: 1px solid var(--fp3d-accent);
        border-radius: 8px;
        background: rgba(80, 200, 255, 0.08);
      }
      .fp3d-lib-hidden {
        color: var(--fp3d-muted);
      }
      .fp3d-lib-clear {
        margin-left: auto;
        padding: 2px 8px;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        color: var(--fp3d-accent);
        background: none;
        border: 1px solid var(--fp3d-accent);
        border-radius: 999px;
        cursor: pointer;
      }
      .fp3d-lib-head {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        margin: 10px 0 4px;
        padding: 4px 0;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--fp3d-text);
        background: none;
        border: 0;
        border-bottom: 1px solid var(--fp3d-line);
        text-align: left;
        cursor: pointer;
      }
      .fp3d-lib-recent {
        padding-left: 8px;
        border-left: 3px solid var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 10%, transparent);
      }
      .fp3d-lib-recent-grid {
        padding: 6px 0 6px 8px;
        border-left: 3px solid var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 5%, transparent);
      }
      .fp3d-lib-caret {
        width: 10px;
        color: var(--fp3d-muted);
      }
      .fp3d-lib-count {
        margin-left: auto;
        font-weight: 400;
        font-size: 12px;
        color: var(--fp3d-muted);
        font-variant-numeric: tabular-nums;
      }
      .fp3d-lib-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
        gap: 6px;
      }
      .fp3d-lc {
        position: relative;
        display: flex;
        flex-direction: column;
        /* cards out of view are not laid out or painted: a first letter typed shows hundreds of them (#131) */
        content-visibility: auto;
        contain-intrinsic-size: auto 220px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        overflow: hidden;
      }
      .fp3d-lc:hover {
        border-color: var(--fp3d-accent);
      }
      .fp3d-lc-main {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
        padding: 6px 6px 5px;
        font: inherit;
        color: var(--fp3d-text);
        background: none;
        border: 0;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-lc-main:disabled {
        cursor: default;
        opacity: 0.6;
      }
      .fp3d-lc-pic {
        display: block;
        height: 64px;
        border-radius: 6px;
        background: radial-gradient(ellipse at 50% 70%, rgba(80, 200, 255, 0.12), transparent 70%);
      }
      .fp3d-lc-pic img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .fp3d-lc-pic img.fp3d-lc-mirrored {
        transform: scaleX(-1);
      }
      .fp3d-lc-wait {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.03);
      }
      .fp3d-lc-label {
        font-size: 12px;
        font-weight: 500;
        line-height: 1.25;
        padding-right: 16px;
      }
      .fp3d-lc-badge {
        font-size: 10px;
      }
      .fp3d-lc-sub {
        font-size: 10.5px;
        color: var(--fp3d-muted);
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp3d-lc-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        padding: 0 6px 6px;
      }
      .fp3d-lc-chip {
        font: inherit;
        font-size: 11px;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid var(--fp3d-line);
        border-radius: 6px;
        padding: 2px 6px;
        cursor: pointer;
        white-space: nowrap;
      }
      .fp3d-lc-chip:hover,
      .fp3d-lc-chip.on {
        border-color: var(--fp3d-accent);
        color: var(--fp3d-accent);
      }
      .fp3d-lc-fav {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 22px;
        height: 22px;
        padding: 0;
        font-size: 14px;
        line-height: 22px;
        color: var(--fp3d-muted);
        background: rgba(4, 16, 24, 0.55);
        border: 0;
        border-radius: 50%;
        cursor: pointer;
      }
      .fp3d-lc-fav.on,
      .fp3d-lc-fav:hover {
        color: #ffd166;
      }
      .fp3d-lc-update {
        position: absolute;
        top: 4px;
        left: 4px;
        padding: 2px 7px;
        font: inherit;
        font-size: 10.5px;
        font-weight: 600;
        color: #04101a;
        background: #ffd166;
        border: 0;
        border-radius: 999px;
        cursor: pointer;
      }
      .fp3d-lib-more {
        display: block;
        width: 100%;
        margin: 6px 0 2px;
        padding: 6px;
        font: inherit;
        font-size: 12px;
        color: var(--fp3d-accent);
        background: none;
        border: 1px dashed var(--fp3d-line);
        border-radius: 8px;
        cursor: pointer;
      }
    `,
  ];
}

defineElement("fp3d-library", FurnitureLibrary);
