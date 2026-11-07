// The editor's item picker (#293): replaces the Item dropdown. A modal list that filters as you type (the library's
// fuzzy ranking), can be narrowed by pack and by type, shows a small picture per row and, for the row in focus, the
// item in 3D and in 2D (plan and front) before it is committed. The list is virtualised (only the rows in view are
// in the DOM) and the pictures are drawn lazily for those rows, two at a time, and kept (thumbs.ts, the library's cache).
// Fires "pick" {type} and "close". Lives in the editor's lazy chunk (editor/lazy-parts.ts).

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, svg } from "lit";
import { KINDS, searchLibrary, sizeText, type LibraryEntry } from "../library-index.ts";
import { tokens } from "../styles.ts";
import { thumbFor } from "../thumbs.ts";

const ROW = 48;
const OVERSCAN = 4;
const THUMB_PX = 96;
const BIG_PX = 220;
/** Pack filter value for the built-in kinds. */
const BASIC = "~basic";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const pictureKey = (e: Pick<LibraryEntry, "type" | "packRelease">): string => `${e.type}|${e.packRelease}`;

export class ItemPicker extends LitElement {
  static properties = {
    entries: { attribute: false },
    current: { attribute: false },
    heading: { attribute: false },
    language: { attribute: false },
    t: { attribute: false },
    thumb: { attribute: false },
    picture: { attribute: false },
    _q: { state: true },
    _pack: { state: true },
    _kind: { state: true },
    _sel: { state: true },
    _top: { state: true },
    _thumbs: { state: true },
    _big: { state: true },
  };

  declare entries: LibraryEntry[];
  /** The type the item has now (shown first and marked). */
  declare current: string;
  /** The dialog's title ("Choose an item" unless a caller names its own, as "Show as furniture" does, #419). */
  declare heading: string;
  declare language: string;
  declare t: Translate;
  /** Small picture of an entry (THUMB_PX), as the library's cards use. */
  declare thumb: ((e: LibraryEntry) => Promise<string | null>) | null;
  /** Larger picture of an entry at a size in px (the 3D preview). */
  declare picture: ((e: LibraryEntry, size: number) => Promise<string | null>) | null;
  private declare _q: string;
  private declare _pack: string;
  private declare _kind: string;
  private declare _sel: string | null;
  private declare _top: number;
  private declare _thumbs: Map<string, string>;
  private declare _big: { key: string; url: string | null } | null;

  private memo: { key: unknown; hits: LibraryEntry[] } | null = null;
  private wanted = new Set<string>();
  private queue: LibraryEntry[] = [];
  private drawing = 0;
  private bigFor: string | null = null;
  private viewH = 320;

  constructor() {
    super();
    this.entries = [];
    this.current = "";
    this.heading = "";
    this.language = "en";
    this.t = (k) => k;
    this.thumb = null;
    this.picture = null;
    this._q = "";
    this._pack = "";
    this._kind = "";
    this._sel = null;
    this._top = 0;
    this._thumbs = new Map();
    this._big = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("keydown", this.onKey);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this.onKey);
  }

  protected firstUpdated(): void {
    const cur = this.hits.find((e) => e.type === this.current);
    this._sel = (cur ?? this.hits[0])?.key ?? null;
    if (cur) this.reveal(cur.key, true);
    (this.renderRoot.querySelector("input.ip-q") as HTMLInputElement | null)?.focus();
  }

  protected updated(): void {
    const list = this.renderRoot.querySelector<HTMLElement>(".ip-list");
    if (list && list.clientHeight && list.clientHeight !== this.viewH) {
      this.viewH = list.clientHeight;
      this.requestUpdate();
    }
    for (const e of this.visible().rows) this.want(e);
    const sel = this.selected;
    if (sel && this.bigFor !== sel.key) void this.drawBig(sel);
  }

  // ------------------------------------------------------------------ data

  /** Entries to choose from, filtered and ranked; kept until the query or a filter changes. */
  private get hits(): LibraryEntry[] {
    const key = [this.entries, this._q, this._pack, this._kind];
    const m = this.memo;
    if (m && (m.key as unknown[]).every((v, i) => v === key[i])) return m.hits;
    const own = this.entries.filter((e) => !e.mirror);
    const pack = (e: LibraryEntry) => !this._pack || (this._pack === BASIC ? e.pack === null : e.pack === this._pack);
    let hits = searchLibrary(own, { query: this._q, room: null, electric: false, light: false, outdoor: false }).hits.filter((e) => pack(e) && (!this._kind || e.kind === this._kind));
    // nothing typed: the item in use first, so the list opens where it is
    if (!this._q.trim()) hits = [...hits.filter((e) => e.type === this.current), ...hits.filter((e) => e.type !== this.current)];
    this.memo = { key, hits };
    return hits;
  }

  private get selected(): LibraryEntry | null {
    return this.hits.find((e) => e.key === this._sel) ?? null;
  }

  private get packs(): { id: string; label: string }[] {
    const seen = new Map<string, string>();
    for (const e of this.entries) if (e.pack && !seen.has(e.pack)) seen.set(e.pack, e.packLabel ?? e.pack);
    return [...seen].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }

  /** The rows in view (and a few more each side) and the spacers that keep the scroll bar honest. */
  private visible(): { rows: LibraryEntry[]; before: number; after: number } {
    const all = this.hits;
    const first = Math.max(0, Math.floor(this._top / ROW) - OVERSCAN);
    const last = Math.min(all.length, Math.ceil((this._top + this.viewH) / ROW) + OVERSCAN);
    return { rows: all.slice(first, last), before: first * ROW, after: (all.length - last) * ROW };
  }

  // ------------------------------------------------------------------ pictures

  private want(entry: LibraryEntry): void {
    const pic = pictureKey(entry);
    if (!this.thumb || this._thumbs.has(pic) || this.wanted.has(pic)) return;
    this.wanted.add(pic);
    this.queue.push(entry);
    this.drain();
  }

  private drain(): void {
    while (this.drawing < 2 && this.queue.length) {
      const entry = this.queue.shift()!;
      // scrolled past while waiting: not drawn now, asked again if it comes back into view
      if (!this.visible().rows.includes(entry)) {
        this.wanted.delete(pictureKey(entry));
        continue;
      }
      this.drawing++;
      const pic = pictureKey(entry);
      thumbFor(`${pic}|${THUMB_PX}|1`, () => (this.thumb ? this.thumb(entry) : Promise.resolve(null)))
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

  private async drawBig(entry: LibraryEntry): Promise<void> {
    this.bigFor = entry.key;
    if (!this.picture) return;
    try {
      const url = await thumbFor(`${pictureKey(entry)}|${BIG_PX}|1`, () => (this.picture ? this.picture(entry, BIG_PX) : Promise.resolve(null)));
      if (this.bigFor === entry.key) this._big = { key: entry.key, url };
    } catch {
      if (this.bigFor === entry.key) this._big = { key: entry.key, url: null };
    }
  }

  // ------------------------------------------------------------------ actions

  private reveal(key: string, centre = false): void {
    const i = this.hits.findIndex((e) => e.key === key);
    const list = this.renderRoot.querySelector<HTMLElement>(".ip-list");
    if (i < 0 || !list) return;
    const top = i * ROW;
    if (centre) list.scrollTop = Math.max(0, top - list.clientHeight / 2 + ROW / 2);
    else if (top < list.scrollTop) list.scrollTop = top;
    else if (top + ROW > list.scrollTop + list.clientHeight) list.scrollTop = top + ROW - list.clientHeight;
    this._top = list.scrollTop;
  }

  private move(by: number): void {
    const all = this.hits;
    if (!all.length) return;
    const i = Math.max(0, Math.min(all.length - 1, all.findIndex((e) => e.key === this._sel) + by));
    this._sel = all[i].key;
    this.reveal(all[i].key);
  }

  private use(entry: LibraryEntry | null): void {
    if (!entry) return;
    this.dispatchEvent(new CustomEvent("pick", { detail: { type: entry.type }, bubbles: true, composed: true }));
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  private onKey = (e: KeyboardEvent): void => {
    e.stopPropagation(); // the editor's shortcuts stay out of the picker
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this.move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.move(-1);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      this.move(Math.max(1, Math.floor(this.viewH / ROW) - 1));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      this.move(-Math.max(1, Math.floor(this.viewH / ROW) - 1));
    } else if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") {
      e.preventDefault();
      this.use(this.selected);
    }
  };

  private setQuery(q: string): void {
    this._q = q;
    this.afterFilter();
  }

  /** After the list changed: back to the top, with the best match in focus. */
  private afterFilter(): void {
    const list = this.renderRoot.querySelector<HTMLElement>(".ip-list");
    if (list) list.scrollTop = 0;
    this._top = 0;
    this._sel = this.hits[0]?.key ?? null;
  }

  // ------------------------------------------------------------------ drawing

  private renderPlans(e: LibraryEntry) {
    const [w, d, h] = e.size;
    const box = 84;
    const fit = (a: number, b: number) => {
      const s = box / Math.max(a, b, 0.01);
      return [a * s, b * s];
    };
    const [pw, pd] = fit(w, d);
    const [fw, fh] = fit(w, h);
    const cm = (v: number) => (v >= 10 ? `${Math.round(v * 10) / 10} m` : `${Math.round(v * 100)}`);
    const plan = svg`<svg viewBox="0 0 100 100" role="img" aria-label=${this.t("item_picker_plan")}>
      <rect x=${(100 - pw) / 2} y=${(100 - pd) / 2} width=${pw} height=${pd} class="ip-shape" />
      <text x="50" y="97" class="ip-dim">${cm(w)}</text>
      <text x="4" y="52" class="ip-dim" transform="rotate(-90 4 52)" text-anchor="middle">${cm(d)}</text>
    </svg>`;
    const front = svg`<svg viewBox="0 0 100 100" role="img" aria-label=${this.t("item_picker_front")}>
      <rect x=${(100 - fw) / 2} y=${96 - 8 - fh} width=${fw} height=${fh} class="ip-shape" />
      <text x="50" y="97" class="ip-dim">${cm(w)}</text>
      <text x="4" y="48" class="ip-dim" transform="rotate(-90 4 48)" text-anchor="middle">${cm(h)}</text>
    </svg>`;
    return html`<div class="ip-plans"><figure>${plan}<figcaption>${this.t("item_picker_plan")}</figcaption></figure><figure>${front}<figcaption>${this.t("item_picker_front")}</figcaption></figure></div>`;
  }

  private renderRow(e: LibraryEntry) {
    const url = this._thumbs.get(pictureKey(e));
    const on = e.key === this._sel;
    return html`<li
      class="ip-row ${on ? "on" : ""}"
      role="option"
      aria-selected=${on}
      @click=${() => (this._sel = e.key)}
      @dblclick=${() => this.use(e)}
    >
      <span class="ip-pic">${url ? html`<img src=${url} alt="" draggable="false" />` : nothing}</span>
      <span class="ip-name">${e.label}${e.type === this.current ? html` <em>${this.t("item_picker_current")}</em>` : nothing}</span>
      <span class="ip-meta">${e.packLabel ?? this.t("item_picker_basic")} · ${this.t(`lib_kind_${e.kind}`)}</span>
    </li>`;
  }

  render() {
    const t = this.t;
    const all = this.hits;
    const { rows, before, after } = this.visible();
    const sel = this.selected;
    const title = this.heading || t("item_picker_title");
    return html`<div class="ip-back" @click=${(e: Event) => e.target === e.currentTarget && this.close()}>
      <div class="ip-dialog" role="dialog" aria-modal="true" aria-label=${title}>
        <header>
          <h3>${title}</h3>
          <button class="fp3d-btn" @click=${() => this.close()}>${t("cancel")}</button>
        </header>
        <div class="ip-filters">
          <input class="ip-q" type="search" autocomplete="off" placeholder=${t("item_picker_search")} aria-label=${t("item_picker_search")} .value=${this._q} @input=${(e: Event) => this.setQuery((e.target as HTMLInputElement).value)} />
          <select aria-label=${t("item_picker_pack")} .value=${this._pack} @change=${(e: Event) => ((this._pack = (e.target as HTMLSelectElement).value), this.afterFilter())}>
            <option value="">${t("item_picker_pack_all")}</option>
            <option value=${BASIC}>${t("item_picker_basic")}</option>
            ${this.packs.map((p) => html`<option value=${p.id}>${p.label}</option>`)}
          </select>
          <select aria-label=${t("item_picker_kind")} .value=${this._kind} @change=${(e: Event) => ((this._kind = (e.target as HTMLSelectElement).value), this.afterFilter())}>
            <option value="">${t("item_picker_kind_all")}</option>
            ${KINDS.map((k) => html`<option value=${k}>${t(`lib_kind_${k}`)}</option>`)}
          </select>
        </div>
        <div class="ip-body">
          <div class="ip-list" role="listbox" aria-label=${t("item_picker_title")} @scroll=${(e: Event) => (this._top = (e.target as HTMLElement).scrollTop)}>
            ${all.length ? nothing : html`<p class="fp3d-sub ip-none">${t("furniture_search_none")}</p>`}
            <ul style="padding-top:${before}px;padding-bottom:${after}px">
              ${rows.map((e) => this.renderRow(e))}
            </ul>
          </div>
          <aside class="ip-view" aria-live="polite">
            ${sel
              ? html`<div class="ip-big">${this._big?.key === sel.key && this._big.url ? html`<img src=${this._big.url} alt=${sel.label} draggable="false" />` : nothing}</div>
                  <b>${sel.label}</b>
                  <span class="fp3d-sub">${sizeText(sel.size, this.language)} · ${sel.packLabel ?? t("item_picker_basic")}</span>
                  ${this.renderPlans(sel)}`
              : nothing}
          </aside>
        </div>
        <footer>
          <span class="fp3d-sub">${t("item_picker_count", { n: all.length })}</span>
          <button class="fp3d-btn fp3d-primary" ?disabled=${!sel || sel.type === this.current} @click=${() => this.use(sel)}>${t("item_picker_use")}</button>
        </footer>
      </div>
    </div>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 60;
        color: var(--fp3d-text);
      }
      .ip-back {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: grid;
        place-items: center;
        padding: 12px;
      }
      .ip-dialog {
        background: var(--fp3d-panel, #0d1424);
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
        width: min(760px, 100%);
        max-height: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        box-sizing: border-box;
      }
      header,
      footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      h3 {
        margin: 0;
      }
      .ip-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .ip-filters input {
        flex: 1 1 200px;
      }
      .ip-filters input,
      .ip-filters select {
        min-height: 36px;
        box-sizing: border-box;
        color: var(--fp3d-text);
        background: transparent;
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        padding: 0 8px;
      }
      .ip-filters select {
        flex: 0 1 160px;
        min-width: 0;
      }
      .ip-body {
        display: flex;
        gap: 10px;
        min-height: 0;
        flex: 1;
      }
      .ip-list {
        flex: 1 1 55%;
        height: min(52vh, 384px);
        overflow-y: auto;
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        position: relative;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .ip-row {
        height: ${ROW}px;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 40px 1fr;
        grid-template-areas: "pic name" "pic meta";
        column-gap: 8px;
        align-items: center;
        padding: 0 8px;
        cursor: pointer;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .ip-row.on {
        background: rgba(55, 224, 255, 0.14);
        outline: 1px solid var(--fp3d-accent);
        outline-offset: -1px;
      }
      .ip-pic {
        grid-area: pic;
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
      }
      .ip-pic img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .ip-name {
        grid-area: name;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ip-name em {
        font-size: 11px;
        opacity: 0.7;
      }
      .ip-meta {
        grid-area: meta;
        font-size: 11px;
        opacity: 0.65;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ip-none {
        padding: 12px;
      }
      .ip-view {
        flex: 1 1 45%;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .ip-big {
        aspect-ratio: 1;
        max-height: 200px;
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        display: grid;
        place-items: center;
      }
      .ip-big img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .ip-plans {
        display: flex;
        gap: 8px;
      }
      .ip-plans figure {
        margin: 0;
        flex: 1;
        text-align: center;
        font-size: 11px;
      }
      .ip-plans svg {
        width: 100%;
        max-height: 100px;
      }
      .ip-shape {
        fill: rgba(55, 224, 255, 0.12);
        stroke: var(--fp3d-accent);
        stroke-width: 1.5;
      }
      .ip-dim {
        font-size: 8px;
        fill: currentColor;
        text-anchor: middle;
      }
      @media (max-width: 620px) {
        .ip-body {
          flex-direction: column;
          overflow-y: auto;
        }
        .ip-list {
          flex: none;
          height: 40vh;
        }
        .ip-big {
          max-height: 140px;
        }
      }
    `,
  ];
}

defineElement("fp3d-item-picker", ItemPicker);
