// The Build and Outside panels of the editor's toolbar (#402), in the style of the furniture library: a card with a
// small picture and a plain name for every thing that can be drawn, a search, the last used cards first and one line
// under the cards that says how to draw the one in use (or the one under the pointer or focus). Outside also has the
// shape choice for areas (rectangle or free form) and the list of the plan's outdoor areas (#401). An element of its
// own, so typing in the search draws the panel again, not the editor and its plan.
//
// Events: "tool-pick" {id} (a card), "tool-free" {free} (the area shape), "tool-close" {refocus}, "area-go" {floor, id}.
//
// A lazy chunk of the editor bundle (home-3d-editor-tool-panel-<hash>.js), loaded once the editor has drawn and the page
// is idle, or when Build or Outside is first pointed at. Like the phone bar (#250) it imports nothing but types: Lit and
// the card functions come from the editor (definePanel's kit), so the editor's first open fetches no more files.

import type * as Lit from "lit";
import type { defineElement } from "../define.ts";
import type { touchWording } from "../editor-hint.ts";
import type { I18nKey } from "../i18n.ts";
import type * as Cards from "../tool-cards.ts";
import type { ToolCard, ToolGroup } from "../tool-cards.ts";
import { toolPictures } from "./tool-pics.ts";

/** One outdoor area in the Outside panel's list (#401). */
export interface AreaRow {
  id: string;
  floor: string;
  name: string;
  /** size and, on another floor, the floor's name */
  note: string;
  selected: boolean;
}

type T = (key: I18nKey, params?: Record<string, string | number>) => string;

/** What the chunk borrows from the editor bundle. */
export interface ToolPanelKit {
  LitElement: typeof Lit.LitElement;
  html: typeof Lit.html;
  svg: typeof Lit.svg;
  css: typeof Lit.css;
  nothing: typeof Lit.nothing;
  defineElement: typeof defineElement;
  touchWording: typeof touchWording;
  cards: Pick<typeof Cards, "fold" | "howKey" | "recentCards" | "RECENT_KEY" | "searchCards" | "useCard">;
}

/** Defines <fp3d-tool-panel> with the editor's Lit (lazy.ts calls it when the chunk arrives); returns its class. */
export function defineToolPanel(kit: ToolPanelKit) {
  const { LitElement, html, css, nothing, touchWording } = kit;
  const { fold, howKey, recentCards, RECENT_KEY, searchCards, useCard } = kit.cards;
  const toolPic = toolPictures(kit.svg).pic;

  function loadRecent(): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  class ToolPanel extends LitElement {
    static properties = {
      group: { attribute: false },
      cards: { attribute: false },
      active: { attribute: false },
      free: { attribute: false },
      touch: { attribute: false },
      t: { attribute: false },
      areas: { attribute: false },
      _query: { state: true },
      _hint: { state: true },
      _recent: { state: true },
    };

    declare group: ToolGroup;
    declare cards: ToolCard[];
    /** The card of the tool in use. */
    declare active: string | null;
    /** Outside: areas are drawn by their corners (else as a dragged rectangle). */
    declare free: boolean;
    declare touch: boolean;
    declare t: T;
    declare areas: AreaRow[];
    private declare _query: string;
    /** The card under the pointer or focus: the hint line says how to draw it. */
    private declare _hint: string | null;
    private declare _recent: string[];

    constructor() {
      super();
      this.group = "build";
      this.cards = [];
      this.active = null;
      this.free = false;
      this.touch = false;
      this.t = (k) => k;
      this.areas = [];
      this._query = "";
      this._hint = null;
      this._recent = loadRecent();
    }

    private send(name: string, detail: object): void {
      this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    /** The focus goes into the panel when it opens: the search, or on a touch screen (no keyboard popping up) the card in use. */
    focusStart(): void {
      const root = this.renderRoot as ShadowRoot;
      const el = this.touch ? (root.querySelector<HTMLElement>(".tc[aria-pressed='true']") ?? root.querySelector<HTMLElement>(".tc")) : root.querySelector<HTMLElement>(".search");
      el?.focus();
    }

    pick(card: ToolCard): void {
      this._recent = useCard(this._recent, card.id);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(this._recent));
      } catch {
        // no storage: remembered for this visit
      }
      this.send("tool-pick", { id: card.id });
    }

    /** How a card draws, in a line (worded for touch on a touch screen). */
    how(card: ToolCard): string {
      return touchWording(this.touch, howKey(card, this.free), this.t);
    }

    private found(): ToolCard[] {
      return searchCards(this.cards, this._query, (c) => `${this.t(c.name)} ${this.t(howKey(c, false))}`);
    }

    /** Keys: arrows move between the cards as they are laid out, Home / End; Escape clears the search, then closes. */
    private readonly keys = (e: KeyboardEvent) => {
      // nothing typed or pressed here reaches the editor's own keys (Delete, arrows nudging the selection …)
      e.stopPropagation();
      const root = this.renderRoot as ShadowRoot;
      const at = root.activeElement as HTMLElement | null;
      const cards = [...root.querySelectorAll<HTMLElement>(".tc")];
      const inSearch = at?.classList.contains("search");
      if (e.key === "Escape") {
        e.preventDefault();
        if (inSearch && this._query) this._query = "";
        else this.send("tool-close", { refocus: true });
        return;
      }
      if (inSearch) {
        if (e.key === "ArrowDown" && cards.length) {
          e.preventDefault();
          cards[0]!.focus();
        } else if (e.key === "Enter") {
          const first = this.found()[0];
          if (first) {
            e.preventDefault();
            this.pick(first);
          }
        }
        return;
      }
      const i = at ? cards.indexOf(at) : -1;
      if (i < 0) return;
      let to = -1;
      if (e.key === "ArrowRight") to = Math.min(cards.length - 1, i + 1);
      else if (e.key === "ArrowLeft") to = Math.max(0, i - 1);
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = cards.length - 1;
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        // the nearest card in the next row down (or up), by the cards' places on the screen
        const r = cards[i]!.getBoundingClientRect();
        const down = e.key === "ArrowDown";
        let best = Infinity;
        cards.forEach((c, j) => {
          const q = c.getBoundingClientRect();
          const dy = down ? q.top - r.bottom : r.top - q.bottom;
          if (dy < -1) return;
          const d = dy * 10 + Math.abs(q.left - r.left);
          if (j !== i && d < best) [best, to] = [d, j];
        });
        if (to < 0 && !down) {
          e.preventDefault();
          root.querySelector<HTMLElement>(".search")?.focus();
          return;
        }
      }
      if (to >= 0) {
        e.preventDefault();
        cards[to]!.focus();
      }
    };

    private card(c: ToolCard) {
      const on = c.id === this.active;
      const hint = (v: string | null) => () => (this._hint = v);
      return html`<button class="tc" aria-pressed=${on ? "true" : "false"} data-id=${c.id} title=${this.touch ? nothing : this.how(c)} @click=${() => this.pick(c)} @focus=${hint(c.id)} @blur=${hint(null)} @pointerenter=${hint(c.id)} @pointerleave=${hint(null)}>
        <span class="pic">${toolPic(c.id)}</span>
        <span class="name">${this.t(c.name)}</span>
      </button>`;
    }

    private hintLine() {
      const id = this._hint ?? this.active;
      const card = id ? this.cards.find((c) => c.id === id) : undefined;
      if (!card) return html`${this.t("tp_pick")}`;
      return html`<b>${this.t(card.name)}</b> · ${this.how(card)}`;
    }

    render() {
      const t = this.t;
      const q = this._query.trim();
      const found = this.found();
      const recent = q ? [] : recentCards(this.cards, this._recent);
      const label = t(this.group === "build" ? "tool_group_build" : "tool_group_outside");
      return html`<div class="box" role="dialog" aria-label=${label} @keydown=${this.keys}>
        <div class="top">
          <input class="search" type="search" .value=${this._query} placeholder=${t("tp_search")} aria-label=${t("tp_search")} @input=${(e: Event) => (this._query = (e.target as HTMLInputElement).value)} />
          ${this.group === "outside"
            ? html`<div class="seg" role="radiogroup" aria-label=${t("tp_shape")}>
                <span class="seg-label" aria-hidden="true">${t("tp_shape")}</span>
                ${[false, true].map(
                  (free) => html`<button role="radio" aria-checked=${this.free === free ? "true" : "false"} @click=${() => this.send("tool-free", { free })}>${t(free ? "outdoor_shape_free" : "outdoor_shape_rect")}</button>`,
                )}
              </div>`
            : nothing}
        </div>
        <div class="body">
          ${recent.length
            ? html`<h4 class="head">${t("lib_recent")}</h4>
                <div class="grid recent">${recent.map((c) => this.card(c))}</div>
                <h4 class="head">${t("tp_all")}</h4>`
            : nothing}
          ${found.length ? this.grids(found, !q) : html`<p class="none">${t("lib_no_match", { q })}</p>`}
          ${this.renderAreas()}
        </div>
        <p class="hint" aria-live="polite">${this.hintLine()}</p>
      </div>`;
    }

    /** The cards; on Outside, while nothing is searched, the pool's under a heading of their own (the area shape is not theirs). */
    private grids(found: ToolCard[], parted: boolean) {
      const pools = parted && this.group === "outside" ? found.filter((c) => c.tool === "pool") : [];
      const rest = pools.length ? found.filter((c) => c.tool !== "pool") : found;
      return html`<div class="grid">${rest.map((c) => this.card(c))}</div>
        ${pools.length ? html`<h4 class="head">${this.t("tool_pool")}</h4><div class="grid">${pools.map((c) => this.card(c))}</div>` : nothing}`;
    }

    /** Outside: the home's outdoor areas (#401), as the search narrows them; a tap goes to one, on its floor. */
    renderAreas() {
      if (this.group !== "outside" || !this.areas.length) return nothing;
      const words = fold(this._query).split(/\s+/).filter(Boolean);
      const rows = this.areas.filter((r) => words.every((w) => fold(`${r.name} ${r.note}`).includes(w)));
      if (!rows.length) return nothing;
      return html`<h4 class="head">${this.t("tp_on_plan", { n: rows.length })}</h4>
        <div class="areas">
          ${rows.map(
            (r) => html`<button class="area" aria-pressed=${r.selected ? "true" : "false"} @click=${() => this.send("area-go", { floor: r.floor, id: r.id })}>
              <span>${r.name}</span><small>${r.note}</small>
            </button>`,
          )}
        </div>`;
    }

    static styles = css`
      :host {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 30;
        width: min(400px, calc(100vw - 24px));
        max-height: min(72vh, 600px);
        display: flex;
        color: var(--fp3d-text);
        font-family: var(--fp3d-font, inherit);
        font-size: 14px;
        background: var(--fp3d-chrome-solid, #0f172a);
        border: 1px solid var(--fp3d-line);
        border-radius: 14px;
        box-shadow: var(--fp3d-shadow);
      }
      /* a phone: a sheet above the bottom bar, as the old menus were */
      :host([sheet]) {
        top: auto;
        left: 0;
        right: 0;
        bottom: var(--fp3d-bar-h, 76px);
        width: auto;
        max-height: 72%;
        border-width: 1px 0 0;
        border-radius: 14px 14px 0 0;
        box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
      }
      .box {
        display: flex;
        flex-direction: column;
        min-height: 0;
        width: 100%;
      }
      .top {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 12px 8px;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .search {
        min-height: 36px;
        box-sizing: border-box;
        font: inherit;
        color: var(--fp3d-text);
        background: var(--fp3d-panel, #1e293b);
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-control, 6px);
        padding: 6px 10px;
      }
      .seg {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
      }
      .seg-label {
        color: var(--fp3d-muted);
        margin-right: 4px;
      }
      .seg button {
        min-height: 32px;
        padding: 0 12px;
        font: inherit;
        color: var(--fp3d-text);
        background: none;
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        cursor: pointer;
      }
      .seg button[aria-checked="true"] {
        color: var(--fp3d-primary-text, #fff);
        background: var(--fp3d-primary);
        border-color: var(--fp3d-primary);
        font-weight: 600;
      }
      .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 4px 12px 8px;
      }
      .head {
        margin: 10px 0 6px;
        font-size: 12px;
        font-weight: 600;
        color: var(--fp3d-muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
        gap: 8px;
        margin-top: 8px;
      }
      .head + .grid {
        margin-top: 0;
      }
      .tc {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        padding: 6px 6px 8px;
        font: inherit;
        text-align: left;
        color: var(--fp3d-text);
        background: color-mix(in srgb, var(--fp3d-panel, #1e293b) 55%, transparent);
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-card, 8px);
        cursor: pointer;
      }
      .tc:hover {
        border-color: var(--fp3d-accent);
      }
      .tc:focus-visible,
      .seg button:focus-visible,
      .search:focus-visible,
      .area:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 1px;
      }
      .tc[aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
      }
      .tc[aria-pressed="true"] .name {
        color: var(--fp3d-accent);
        font-weight: 700;
      }
      .pic {
        display: block;
        height: 52px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--fp3d-bg, #070b14) 45%, transparent);
      }
      .fp3d-tc-svg {
        display: block;
        width: 100%;
        height: 100%;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .w {
        stroke: var(--fp3d-text);
        stroke-width: 2.2;
      }
      .wide {
        stroke-width: 4;
      }
      .l {
        stroke: var(--fp3d-muted);
        stroke-width: 1.2;
      }
      .a {
        stroke: var(--fp3d-accent);
        stroke-width: 1.8;
      }
      .dash {
        stroke-dasharray: 3 3;
      }
      .x {
        stroke: var(--fp3d-muted);
        stroke-width: 1.6;
        stroke-dasharray: 4 3;
      }
      .d {
        fill: var(--fp3d-accent);
      }
      .g,
      .s,
      .k,
      .m,
      .p {
        stroke-width: 1.5;
      }
      .g {
        fill: color-mix(in srgb, var(--fp3d-success) 28%, transparent);
        stroke: var(--fp3d-success);
      }
      .gl {
        stroke: var(--fp3d-success);
        stroke-width: 1.5;
      }
      .s {
        fill: color-mix(in srgb, var(--fp3d-soft) 24%, transparent);
        stroke: var(--fp3d-soft);
      }
      .k {
        fill: color-mix(in srgb, var(--fp3d-warm) 26%, transparent);
        stroke: var(--fp3d-warm);
      }
      .m {
        fill: color-mix(in srgb, var(--fp3d-muted) 22%, transparent);
        stroke: var(--fp3d-muted);
      }
      .p {
        fill: color-mix(in srgb, var(--fp3d-accent) 26%, transparent);
        stroke: var(--fp3d-accent);
      }
      .band {
        stroke: var(--fp3d-muted);
        stroke-width: 7;
        opacity: 0.8;
      }
      .name {
        font-size: 13px;
        font-weight: 500;
        line-height: 1.25;
      }
      .areas {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .area {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-height: 36px;
        padding: 6px 8px;
        font: inherit;
        text-align: left;
        color: var(--fp3d-text);
        background: none;
        border: 0;
        border-radius: var(--fp3d-radius-control, 6px);
        cursor: pointer;
      }
      .area:hover {
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
      }
      .area[aria-pressed="true"] {
        color: var(--fp3d-accent);
        font-weight: 600;
      }
      .area span {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .area small {
        flex: none;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .none {
        margin: 8px 0;
        font-size: 13px;
        color: var(--fp3d-muted);
      }
      .hint {
        margin: 0;
        padding: 8px 12px 10px;
        font-size: 12.5px;
        line-height: 1.35;
        color: var(--fp3d-muted);
        border-top: 1px solid var(--fp3d-line);
      }
      .hint b {
        color: var(--fp3d-text);
        font-weight: 600;
      }
      @media (pointer: coarse) {
        .search,
        .seg button {
          min-height: var(--fp3d-touch, 44px);
        }
      }
      @media (forced-colors: active) {
        .tc[aria-pressed="true"],
        .seg button[aria-checked="true"] {
          outline: 2px solid CanvasText;
        }
      }
    `;
  }

  kit.defineElement("fp3d-tool-panel", ToolPanel);
  return ToolPanel;
}

export type ToolPanel = InstanceType<ReturnType<typeof defineToolPanel>>;
