// The editor's items list (#75): one row per item with select, hide and a row menu with Delete (#420, A11Y-5: a
// mis-tap no longer deletes). Rows are 32 px with a mouse and 44 px on a touch screen or a phone. Long lists (a floor
// with 110+ items) draw only the rows in view (`listWindow`), and the scroll state lives here, so scrolling
// re-renders this list only, not the editor and its plan.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing } from "lit";
import { listWindow } from "../item-list.ts";
import { tokens } from "../styles.ts";
import { PHONE_MEDIA } from "../phone.ts";

export interface ItemRow {
  id: string;
  name: string;
  /** Muted text after the name (the room, on the floor list). */
  note?: string;
  hidden: boolean;
  selected: boolean;
}

export interface ItemListTexts {
  hide: string;
  show: string;
  remove: string;
  /** The row menu's name ("More actions"). */
  more?: string;
}

const ROW_H = 32;
/** Rows on a touch screen or a phone (#420, A11Y-5). */
const TOUCH_ROW_H = 44;

/** A touch screen or a phone-wide page: 44 px rows. */
function touchRows(): boolean {
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(pointer: coarse)").matches || matchMedia(PHONE_MEDIA).matches;
}
const MAX_ROWS = 9;

export class ItemListView extends LitElement {
  static properties = {
    rows: { attribute: false },
    texts: { attribute: false },
    editable: { type: Boolean },
    touch: { type: Boolean, reflect: true },
    _scroll: { state: true },
    _menu: { state: true },
  };

  declare rows: ItemRow[];
  declare texts: ItemListTexts;
  /** Delete buttons show only for editors. */
  declare editable: boolean;
  /** 44 px rows (a touch screen or a phone); set from the page when the list is made. */
  declare touch: boolean;
  private declare _scroll: number;
  /** The row whose menu is open (its id), or null. */
  private declare _menu: string | null;

  constructor() {
    super();
    this.rows = [];
    this.texts = { hide: "Hide", show: "Show", remove: "Delete" };
    this.editable = false;
    this.touch = touchRows();
    this._scroll = 0;
    this._menu = null;
  }

  private get rowH(): number {
    return this.touch ? TOUCH_ROW_H : ROW_H;
  }

  /** Opens or closes a row's menu; open, the keyboard goes to its first entry. */
  private toggleMenu(id: string): void {
    this._menu = this._menu === id ? null : id;
    if (this._menu) void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(".menu button")?.focus());
  }

  /** Closes the open menu; `refocus`: the keyboard goes back to its row's "⋯". */
  private closeMenu(refocus: boolean): void {
    const id = this._menu;
    this._menu = null;
    if (refocus && id) void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`.more[data-id="${CSS.escape(id)}"]`)?.focus());
  }

  private send(name: string, id: string): void {
    this.dispatchEvent(new CustomEvent(name, { detail: { id }, bubbles: true, composed: true }));
  }

  private onScroll(e: Event): void {
    const top = (e.currentTarget as HTMLElement).scrollTop;
    // redraw only when another row reaches the top
    const h = this.rowH;
    if (Math.floor(top / h) !== Math.floor(this._scroll / h)) this._scroll = top;
  }

  render() {
    const rows = this.rows;
    const h = this.rowH;
    const height = Math.min(rows.length, MAX_ROWS) * h;
    const win = listWindow(rows.length, this._scroll, height, h);
    const more = this.texts.more ?? "More actions";
    return html`<div class="box" style="height:${height}px;--row-h:${h}px" role="list" @scroll=${this.onScroll}>
      <div style="height:${win.before}px"></div>
      ${rows.slice(win.start, win.end).map(
        (r) => html`<div class=${`row${r.selected ? " sel" : ""}${r.hidden ? " off" : ""}`} role="listitem">
          <button class="name" aria-pressed=${r.selected} @click=${() => this.send("item-select", r.id)}>
            <span>${r.name}</span>${r.note ? html`<small>${r.note}</small>` : nothing}
          </button>
          <button class="icon" title=${r.hidden ? this.texts.show : this.texts.hide} aria-label=${r.hidden ? this.texts.show : this.texts.hide} aria-pressed=${r.hidden} @click=${() => this.send("item-hide", r.id)}>
            ${r.hidden ? "◌" : "◉"}
          </button>
          ${this.editable
            ? html`<button
                class="icon more"
                data-id=${r.id}
                title=${more}
                aria-label=${`${more}: ${r.name}`}
                aria-haspopup="menu"
                aria-expanded=${this._menu === r.id ? "true" : "false"}
                @click=${() => this.toggleMenu(r.id)}
              >
                ⋯
              </button>`
            : nothing}
          ${this.editable && this._menu === r.id
            ? html`<div
                class="menu"
                role="menu"
                aria-label=${r.name}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key !== "Escape") return;
                  e.stopPropagation();
                  this.closeMenu(true);
                }}
                @focusout=${(e: FocusEvent) => {
                  const to = e.relatedTarget as Node | null;
                  if (to && !(e.currentTarget as HTMLElement).parentElement?.contains(to)) this.closeMenu(false);
                }}
              >
                <button
                  role="menuitem"
                  class="danger"
                  @click=${() => {
                    this._menu = null;
                    this.send("item-delete", r.id);
                  }}
                >
                  ${this.texts.remove}
                </button>
              </div>`
            : nothing}
        </div>`,
      )}
      <div style="height:${win.after}px"></div>
    </div>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      .box {
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 2px;
        height: var(--row-h, ${ROW_H}px);
        box-sizing: border-box;
      }
      button {
        font: inherit;
        color: var(--fp3d-text);
        background: none;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
        height: calc(var(--row-h, ${ROW_H}px) - 4px);
      }
      button:hover,
      button:focus-visible {
        background: color-mix(in srgb, var(--fp3d-accent) 18%, transparent);
      }
      .name {
        flex: 1;
        min-width: 0;
        display: flex;
        gap: 8px;
        align-items: baseline;
        text-align: left;
        padding: 0 8px;
      }
      .name span,
      .name small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .name small {
        margin-left: auto;
        color: var(--fp3d-muted);
        font-size: 11px;
      }
      .sel .name {
        color: var(--fp3d-accent);
      }
      .off .name span {
        opacity: 0.5;
        text-decoration: line-through;
      }
      .icon {
        width: var(--row-h, ${ROW_H}px);
        flex: none;
        color: var(--fp3d-muted);
      }
      /* the row menu sits over the row's end, in the row: never cut off by the list's scroll box */
      .menu {
        position: absolute;
        right: calc(var(--row-h, ${ROW_H}px) + 2px);
        top: 2px;
        bottom: 2px;
        display: flex;
        z-index: 1;
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        box-shadow: var(--fp3d-shadow);
      }
      .menu button {
        height: auto;
        padding: 0 14px;
      }
      .menu .danger {
        color: var(--fp3d-danger);
        font-weight: 600;
      }
    `,
  ];
}

defineElement("fp3d-item-list", ItemListView);
