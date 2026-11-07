// A searchable multi-select (#227): a box with the picks as removable chips, a search field and a dropdown of options
// that stay open while several are ticked. Options marked `secondary` (service users …) sit behind a toggle at the
// bottom of the list. Keyboard: type to filter, arrows move, Enter or Space ticks, Backspace in an empty box removes the
// last chip, Escape closes. Built to be reused (the settings redesign): it knows nothing about users.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { tokens } from "../styles.ts";

export interface MultiOption {
  id: string;
  label: string;
  /** Small text after the label (e.g. "admin"). */
  note?: string;
  /** Hidden until the list's toggle is on (unless picked). */
  secondary?: boolean;
}

export class MultiSelect extends LitElement {
  static properties = {
    options: { attribute: false },
    value: { attribute: false },
    locked: { attribute: false },
    disabled: { type: Boolean },
    label: { attribute: false },
    placeholder: { attribute: false },
    searchLabel: { attribute: false },
    emptyText: { attribute: false },
    secondaryLabel: { attribute: false },
    removeLabel: { attribute: false },
    summary: { attribute: false },
    noSearch: { type: Boolean },
    _query: { state: true },
    _open: { state: true },
    _cursor: { state: true },
    _more: { state: true },
  };

  declare options: MultiOption[];
  /** The picked ids. */
  declare value: string[];
  /** Picks that cannot be removed (the last admin). */
  declare locked: string[];
  declare disabled: boolean;
  /** The accessible name of the whole control. */
  declare label: string;
  declare placeholder: string;
  declare emptyText: string;
  /** The toggle's text; without it nothing is hidden. */
  declare secondaryLabel: string;
  /** "Remove {name}" for a chip's button. */
  declare removeLabel: string;
  declare searchLabel: string;
  /** Text in place of the chips ("6 object types selected", #268): a long list stays one line. */
  declare summary: string;
  /** No search field (#306): the box takes the keyboard itself, so nothing opens an on-screen keyboard. */
  declare noSearch: boolean;
  private declare _query: string;
  private declare _open: boolean;
  private declare _cursor: number;
  private declare _more: boolean;

  constructor() {
    super();
    this.options = [];
    this.value = [];
    this.locked = [];
    this.disabled = false;
    this.label = "";
    this.placeholder = "";
    this.searchLabel = "";
    this.emptyText = "–";
    this.secondaryLabel = "";
    this.removeLabel = "Remove {name}";
    this.summary = "";
    this.noSearch = false;
    this._query = "";
    this._open = false;
    this._cursor = 0;
    this._more = false;
  }

  /** Whether the list is open: the editor's shortcuts leave the keyboard to the control meanwhile. */
  get open(): boolean {
    return this._open;
  }

  private nameOf(id: string): string {
    return this.options.find((o) => o.id === id)?.label ?? id;
  }

  /** The rows the list shows: the search's matches; secondary ones only with the toggle on (or when picked). */
  private get rows(): MultiOption[] {
    const words = this._query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const showMore = this._more || !this.secondaryLabel;
    return this.options.filter((o) => (showMore || !o.secondary || this.value.includes(o.id)) && words.every((w) => `${o.label} ${o.note ?? ""}`.toLowerCase().includes(w)));
  }

  private get hiddenCount(): number {
    return this.secondaryLabel && !this._more ? this.options.filter((o) => o.secondary && !this.value.includes(o.id)).length : 0;
  }

  private emit(value: string[]): void {
    this.value = value;
    this.dispatchEvent(new CustomEvent("change", { detail: { value }, bubbles: true, composed: true }));
  }

  private toggle(id: string): void {
    if (this.disabled) return;
    if (this.value.includes(id)) {
      if (!this.locked.includes(id)) this.emit(this.value.filter((v) => v !== id));
    } else this.emit([...this.value, id]);
  }

  private dropPick(id: string): void {
    if (!this.disabled && !this.locked.includes(id)) this.emit(this.value.filter((v) => v !== id));
  }

  private openList(): void {
    this._open = true;
  }

  private closeList(): void {
    this._open = false;
    this._query = "";
  }

  protected updated(changed: PropertyValues): void {
    if (this._open && changed.has("_cursor")) (this.renderRoot?.querySelector?.("li.cursor") as HTMLElement | null)?.scrollIntoView?.({ block: "nearest" });
  }

  private onKey(e: KeyboardEvent): void {
    const rows = this.rows;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      this.openList();
      this._cursor = Math.max(0, Math.min(rows.length - 1, this._cursor + (e.key === "ArrowDown" ? 1 : -1)));
      e.preventDefault();
    } else if (e.key === "Enter" || (e.key === " " && !this._query)) {
      if (this._open && rows[this._cursor]) this.toggle(rows[this._cursor].id);
      else this.openList();
      e.preventDefault();
    } else if (e.key === "Escape") {
      if (this._open) e.stopPropagation();
      this.closeList();
    } else if (e.key === "Backspace" && !this._query) {
      const last = [...this.value].reverse().find((id) => !this.locked.includes(id));
      if (last) this.dropPick(last);
    }
  }

  private onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (!next || !this.renderRoot.contains(next)) this.closeList();
  }

  protected render() {
    const rows = this._open ? this.rows : [];
    const hidden = this.hiddenCount;
    return html`<div class="wrap" @focusout=${this.onFocusOut}>
      <div class="box" @click=${() => (this.renderRoot.querySelector("input, .pick") as HTMLElement | null)?.focus()}>
        ${this.summary ? html`<span class="sum">${this.summary}</span>` : nothing}
        ${(this.summary ? [] : this.value).map((id) => {
          const name = this.nameOf(id);
          const fixed = this.locked.includes(id);
          return html`<span class="chip">${name}${fixed || this.disabled
            ? nothing
            : html`<button type="button" aria-label=${this.removeLabel.replace("{name}", name)} @click=${(e: Event) => (e.stopPropagation(), this.dropPick(id))}>×</button>`}</span>`;
        })}
        ${this.noSearch
          ? html`<span class="pick" tabindex="0" role="combobox" aria-label=${this.label} aria-expanded=${this._open} aria-haspopup="listbox" aria-controls="list" @focus=${() => this.openList()} @click=${() => this.openList()} @keydown=${this.onKey}></span>`
          : html`<input
              type="text"
              role="combobox"
              autocomplete="off"
              aria-label=${this.label}
              aria-expanded=${this._open}
              aria-haspopup="listbox"
              aria-controls="list"
              placeholder=${this.value.length ? this.searchLabel : this.placeholder || this.searchLabel}
              .value=${this._query}
              ?disabled=${this.disabled}
              @focus=${() => this.openList()}
              @click=${() => this.openList()}
              @input=${(e: Event) => {
                this._query = (e.target as HTMLInputElement).value;
                this._cursor = 0;
                this.openList();
              }}
              @keydown=${this.onKey}
            />`}
      </div>
      ${this._open
        ? html`<div class="pop">
            <ul id="list" class="list" role="listbox" aria-multiselectable="true" aria-label=${this.label}>
              ${rows.length ? nothing : html`<li class="empty" role="presentation">${this.emptyText}</li>`}
              ${rows.map((o, i) => {
                const on = this.value.includes(o.id);
                return html`<li
                  role="option"
                  aria-selected=${on}
                  class="${i === this._cursor ? "cursor" : ""} ${on ? "on" : ""}"
                  @mousedown=${(e: Event) => e.preventDefault()}
                  @click=${() => this.toggle(o.id)}
                >
                  <span class="tick" aria-hidden="true">${on ? "✓" : ""}</span><span>${o.label}</span>${o.note ? html`<small>${o.note}</small>` : nothing}
                </li>`;
              })}
            </ul>
            ${this.secondaryLabel
              ? html`<label class="more"><input type="checkbox" .checked=${this._more} @change=${(e: Event) => (this._more = (e.target as HTMLInputElement).checked)} />${this.secondaryLabel}${hidden ? html` <small>(${hidden})</small>` : nothing}</label>`
              : nothing}
          </div>`
        : nothing}
    </div>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
        position: relative;
      }
      .box {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        box-sizing: border-box;
        min-height: 44px;
        padding: 4px 8px;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        cursor: text;
      }
      .box:focus-within {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: -1px;
      }
      .sum {
        font-size: 13px;
      }
      .pick {
        flex: 1 1 4em;
        min-height: 32px;
        outline: none;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        box-sizing: border-box;
        min-height: 32px;
        padding: 0 2px 0 10px;
        font-size: 13px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--fp3d-accent) 20%, transparent);
      }
      .chip button {
        position: relative;
        width: 28px;
        height: 28px;
        padding: 0;
        font: inherit;
        line-height: 1;
        color: inherit;
        background: none;
        border: 0;
        border-radius: 50%;
        cursor: pointer;
      }
      .chip button::after {
        content: "";
        position: absolute;
        inset: -8px -4px;
      }
      .chip button:hover,
      .chip button:focus-visible {
        background: color-mix(in srgb, var(--fp3d-text) 20%, transparent);
        outline: none;
      }
      input[type="text"] {
        flex: 1 1 8em;
        min-width: 6em;
        box-sizing: border-box;
        padding: 8px 2px;
        font: inherit;
        color: var(--fp3d-text);
        background: none;
        border: 0;
        outline: none;
      }
      input::placeholder {
        color: var(--fp3d-muted);
      }
      .pop {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 4px);
        z-index: 20;
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        box-shadow: var(--fp3d-shadow);
      }
      .list {
        margin: 0;
        padding: 4px;
        list-style: none;
        max-height: 260px;
        overflow-y: auto;
      }
      li {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 4px 8px;
        box-sizing: border-box;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13.5px;
      }
      li small,
      .more small {
        color: var(--fp3d-muted);
        font-size: 11px;
      }
      li.cursor,
      li:hover {
        background: color-mix(in srgb, var(--fp3d-accent) 18%, transparent);
      }
      li.on {
        color: var(--fp3d-accent);
      }
      .tick {
        width: 1.2em;
        text-align: center;
      }
      li.empty {
        color: var(--fp3d-muted);
        cursor: default;
      }
      .more {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 4px 12px;
        font-size: 13px;
        border-top: 1px solid var(--fp3d-line);
        cursor: pointer;
      }
    `,
  ];
}

defineElement("fp3d-multi-select", MultiSelect);
