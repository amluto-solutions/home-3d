// The card's floor tabs (#548): "Whole house" and each floor in one row at the top left, like the panel's floor bar,
// in place of the floor pictures at the side and the floors' name boxes over the house. A chunk of its own: view3d.ts
// loads it only when a card shows tabs (a phone-sized card, or the card option `floor_tabs: true`), so the panel and a
// wall tablet with floor pictures never fetch it.
//
// It is the top left column of the stage: the tabs, then whatever the 3D view puts in it (the energy values, the heat
// legend, a clock at the top), so the tabs never cover them and they never cover the tabs. A tap says "floor-tap"
// with the floor's id (null: the whole house), as the floor pictures do.
//
// A row wider than its room shows short names (#551: "House", "Top", "First", "Ground"), then, if need be, with less
// space at their sides; the full names stay the tabs' names for screen readers. A row that is still too wide scrolls
// sideways and fades out at the end(s) with more tabs, as the panel's does (#259); the chosen tab scrolls into view.

import { css, html, LitElement } from "lit";
import { defineElement } from "../define.ts";
import { navEdges } from "../nav-edges.ts";
import { controls } from "../styles.ts";

export interface FloorTab {
  id: string;
  name: string;
}

const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/**
 * Short floor names for a row with little room (#551): the word every name shares at its end ("Top floor", "First
 * floor" give "Top", "First"), or else at its start ("Level 1" gives "1"), goes, in any language that puts spaces
 * between words. A name stays whole when no letter or figure would be left, or when its short form would read like
 * another floor or like one of `taken` (the whole house tab).
 */
export function shortNames(names: string[], taken: string[] = []): string[] {
  const words = names.map((n) => n.trim().split(/\s+/));
  const shared = (at: (w: string[]) => string) => words.length > 1 && words.every((w) => same(at(w), at(words[0])));
  const end = shared((w) => w[w.length - 1]);
  if (!end && !shared((w) => w[0])) return names;
  const cut = words.map((w, i) => {
    const rest = (end ? w.slice(0, -1) : w.slice(1)).join(" ");
    return /[\p{L}\p{N}]/u.test(rest) ? rest : names[i];
  });
  return cut.map((s, i) => (taken.some((t) => same(s, t)) || names.some((n, j) => j !== i && (same(s, n) || same(s, cut[j]))) ? names[i] : s));
}

export class Fp3dFloorTabs extends LitElement {
  static properties = {
    // the view hands over a new list with each of its renders: only other floors or names count
    floors: { attribute: false, hasChanged: (a: FloorTab[], b?: FloorTab[]) => JSON.stringify(a) !== JSON.stringify(b) },
    floorId: { attribute: false },
    house: { attribute: false },
    shortHouse: { attribute: false },
    label: { attribute: false },
  };
  /** The floors, the top floor first. */
  declare floors: FloorTab[];
  /** The floor shown; null: the whole house. */
  declare floorId: string | null;
  /** "Whole house" in the user's language. */
  declare house: string;
  /** "House" in the user's language: the whole house tab when the row has little room. */
  declare shortHouse: string;
  /** "Floors": the row's name for screen readers. */
  declare label: string;

  constructor() {
    super();
    this.floors = [];
    this.floorId = null;
    this.house = "";
    this.shortHouse = "";
    this.label = "";
  }

  private pick(id: string | null): void {
    this.dispatchEvent(new CustomEvent("floor-tap", { detail: { floorId: id }, bubbles: true, composed: true }));
  }

  private readonly edges = () => {
    const row = this.renderRoot.querySelector<HTMLElement>(".tabs");
    if (!row) return;
    const more = navEdges(row.scrollLeft, row.scrollWidth, row.clientWidth);
    row.toggleAttribute("data-more-start", more.start);
    row.toggleAttribute("data-more-end", more.end);
  };

  private readonly onWheel = (e: WheelEvent) => {
    const row = e.currentTarget as HTMLElement;
    if (!e.deltaY || e.deltaX || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft += e.deltaY;
    e.preventDefault();
  };

  /** Full names where they fit; else short names; and less space at the tabs' sides if only that makes these fit (#551). */
  private fit(row: HTMLElement): void {
    const at = row.scrollLeft;
    const long = () => row.scrollWidth > row.clientWidth;
    row.removeAttribute("data-short");
    row.removeAttribute("data-tight");
    if (long()) {
      row.setAttribute("data-short", "");
      if (long()) {
        row.setAttribute("data-tight", "");
        if (long()) row.removeAttribute("data-tight");
      }
    }
    row.scrollLeft = at;
  }

  /** The names that fit, the chosen tab in view and the fades: after other floors or another floor, and at a new size. */
  private readonly sync = () => {
    const row = this.renderRoot.querySelector<HTMLElement>(".tabs");
    if (!row) return;
    this.fit(row);
    // the chosen tab in view: the row's own scroll only, never the page's (scrollIntoView would move the dashboard)
    const on = row.querySelector<HTMLElement>("[aria-pressed='true']");
    if (on && row.scrollWidth > row.clientWidth) {
      const left = on.offsetLeft - row.offsetLeft;
      if (left < row.scrollLeft + 24 || left + on.offsetWidth > row.scrollLeft + row.clientWidth - 24) row.scrollLeft = left - (row.clientWidth - on.offsetWidth) / 2;
    }
    this.edges();
  };

  private sizes: ResizeObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate(); // back on the page: watch the size again
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.sizes?.disconnect();
    this.sizes = null;
  }

  protected updated(): void {
    const row = this.renderRoot.querySelector<HTMLElement>(".tabs");
    if (!row) return;
    if (!this.sizes && typeof ResizeObserver === "function") {
      // a frame later: the new names may change the row, which an observer must not do while it reports
      this.sizes = new ResizeObserver(() => requestAnimationFrame(this.sync));
      // the room the row may take (the stage's width, the Walk button), and the row itself (a font that arrives late)
      this.sizes.observe(row.parentElement!);
      this.sizes.observe(row);
    }
    this.sync();
  }

  protected render() {
    const names = this.floors.map((f) => f.name);
    // a floor of that very name would read like the whole house
    const house = this.shortHouse && !names.some((n) => same(n, this.shortHouse)) ? this.shortHouse : this.house;
    const short = shortNames(names, [house]);
    const tab = (id: string | null, name: string, brief: string) =>
      html`<button type="button" title=${name} aria-label=${name} aria-pressed=${id === this.floorId} @click=${() => this.pick(id)}>${brief === name ? name : html`<span class="full">${name}</span><span class="short">${brief}</span>`}</button>`;
    return html`<div class="room">
        <div class="fp3d-seg tabs" role="group" aria-label=${this.label} @scroll=${this.edges} @wheel=${this.onWheel}>
          ${tab(null, this.house, house)}${this.floors.map((f, i) => tab(f.id, f.name, short[i]))}
        </div>
      </div>
      <slot></slot>`;
  }

  static styles = [
    controls,
    css`
      :host {
        position: absolute;
        z-index: 2;
        left: 12px;
        right: 12px;
        top: 10px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        pointer-events: none;
      }
      /* as wide as the row may be */
      .room {
        display: flex;
        width: calc(100% + 12px - var(--fp3d-ftabs-end, 12px));
      }
      .tabs {
        display: flex;
        max-width: 100%;
        box-sizing: border-box;
        overflow-x: auto;
        scrollbar-width: none;
        overscroll-behavior-x: contain;
        pointer-events: auto;
        scroll-padding-inline: 28px;
        backdrop-filter: blur(6px);
      }
      .tabs::-webkit-scrollbar {
        display: none;
      }
      .tabs[data-more-end] {
        mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);
      }
      .tabs[data-more-start] {
        mask-image: linear-gradient(to left, #000 calc(100% - 28px), transparent);
      }
      .tabs[data-more-start][data-more-end] {
        mask-image: linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent);
      }
      .tabs button {
        flex: none;
        font-size: 14px;
        max-width: 12em;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 6px 12px;
      }
      .tabs .short,
      .tabs[data-short] .full {
        display: none;
      }
      .tabs[data-short] .short {
        display: inline;
      }
      /* little space left: narrower tabs, as high as before */
      .tabs[data-tight] {
        gap: 0;
      }
      .tabs[data-tight] button {
        min-width: 40px;
        padding-inline: 7px;
      }
      /* what the 3D view puts in the column stands in it, one under the other, instead of at its own place */
      ::slotted(*) {
        position: static !important;
        max-width: 100% !important;
        transform: none !important;
      }
      ::slotted(.fp3d-clock-tr) {
        align-self: flex-end;
      }
    `,
  ];
}

defineElement("fp3d-floor-tabs", Fp3dFloorTabs);
