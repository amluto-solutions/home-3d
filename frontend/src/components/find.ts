// "Find an object" (#305): the search field and its results. In the floor bar (variant "bar") it drops down under the
// magnifier button at the bar's right end; on a card that has no floor bar (variant "float") it keeps the old place,
// the view's bottom corner. A chunk of its own (load-parts.ts): it loads the first time the search opens.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { iconPath } from "../icons.ts";
import { translate } from "../i18n.ts";
import { searchIndex, searchItems, type SearchItem } from "../search.ts";
import type { Building } from "../model.ts";
import type { HomeAssistant } from "../types.ts";

export class Fp3dFind extends LitElement {
  static properties = {
    hass: { attribute: false },
    building: { attribute: false },
    variant: { reflect: true },
    _q: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare building: Building | undefined;
  declare variant: "bar" | "float";
  declare _q: string;
  private index: SearchItem[] | null = null;

  constructor() {
    super();
    this.variant = "bar";
    this._q = "";
  }

  protected firstUpdated(): void {
    this.renderRoot.querySelector<HTMLInputElement>("input")?.focus();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has("building")) this.index = null;
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent("find-close", { bubbles: true, composed: true }));
  }

  private pick(item: SearchItem): void {
    this.dispatchEvent(new CustomEvent("find-pick", { detail: item, bubbles: true, composed: true }));
  }

  protected render() {
    const hass = this.hass;
    const b = this.building;
    if (!hass || !b) return nothing;
    const results = searchItems((this.index ??= searchIndex(hass, b)), this._q);
    return html`<input
        type="search"
        aria-label=${translate(hass, "find")}
        placeholder=${translate(hass, "find_placeholder")}
        .value=${this._q}
        @input=${(e: Event) => (this._q = (e.target as HTMLInputElement).value)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Escape") this.close();
          if (e.key === "Enter" && results[0]) this.pick(results[0]);
        }}
      />
      ${this.variant === "float" ? html`<button class="close" aria-label=${translate(hass, "close")} @click=${() => this.close()}>✕</button>` : nothing}
      ${this._q.trim()
        ? html`<div class="list">
            ${results.length
              ? results.map(
                  (it) => html`<button @click=${() => this.pick(it)}>
                    <span class="icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d=${it.icon ? iconPath(it.icon) : "M4 10l8-6 8 6v10H4z"} /></svg></span>
                    <span><b>${it.name}</b>${it.where ? html`<small>${it.where}</small>` : nothing}</span>
                  </button>`,
                )
              : html`<p>${translate(hass, "find_none")}</p>`}
          </div>`
        : nothing}`;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 3;
      position: absolute;
    }
    :host([variant="float"]) {
      left: 12px;
      bottom: calc(10px + var(--fp3d-bottom-inset, 0px));
      width: min(340px, calc(100% - 24px));
      flex-direction: column-reverse;
    }
    /* in the floor bar: the field takes the bar's right end beside the magnifier; the list drops under it */
    :host([variant="bar"]) {
      top: 4px;
      right: 56px;
      width: min(340px, calc(100% - 72px));
      z-index: 40;
    }
    :host([variant="bar"]) .list {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      max-height: min(60vh, 420px);
      overflow-y: auto;
    }
    @media (max-width: 600px) {
      /* phone: the field covers the whole row, bar to button */
      :host([variant="bar"]) {
        left: 8px;
        width: auto;
      }
    }
    input {
      box-sizing: border-box;
      width: 100%;
      height: 42px;
      padding: 0 42px 0 14px;
      border: 1px solid var(--fp3d-line);
      border-radius: 14px;
      background: var(--fp3d-chrome-solid, var(--fp3d-chrome));
      color: var(--fp3d-text);
      font: inherit;
      font-size: 15px;
      box-shadow: var(--fp3d-shadow);
    }
    :host([variant="float"]) input {
      background: var(--fp3d-chrome);
      backdrop-filter: blur(8px);
    }
    /* one cross: the field's own clear button goes (#259, V08); the bar's magnifier closes, the float has a cross */
    input::-webkit-search-cancel-button {
      -webkit-appearance: none;
      appearance: none;
      display: none;
    }
    .close {
      position: absolute;
      right: 6px;
      bottom: 6px;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: var(--fp3d-muted);
      cursor: pointer;
    }
    .list {
      display: grid;
      padding: 6px;
      border-radius: 14px;
      background: var(--fp3d-chrome-solid, var(--fp3d-chrome));
      box-shadow: var(--fp3d-shadow);
    }
    .list button {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: var(--fp3d-text);
      text-align: left;
      font: inherit;
      cursor: pointer;
    }
    .list button:hover,
    .list button:focus-visible {
      background: rgba(127, 127, 127, 0.14);
    }
    .list b {
      display: block;
      font-weight: 600;
    }
    .list small,
    .list p {
      color: var(--fp3d-muted);
      font-size: 12px;
      margin: 0;
    }
    .list p {
      padding: 8px 10px;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 10px;
      background: rgba(127, 127, 127, 0.15);
      flex: none;
    }
    .icon svg {
      width: 16px;
      height: 16px;
    }
    @media (pointer: coarse) {
      input {
        height: 44px;
      }
      .close {
        width: 44px;
        height: 44px;
        right: 0;
        bottom: 0;
      }
      .icon {
        min-width: 44px;
        min-height: 44px;
      }
    }
  `;
}

defineElement("fp3d-find", Fp3dFind);
