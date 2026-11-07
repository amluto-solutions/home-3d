// Icon field with a picker (#327), a lazy chunk of the editor. Where Home Assistant's own <ha-icon-picker> is defined
// (it shows the icons and filters as you type) that is used; otherwise a text box with a button opens a grid of icons
// with a search filter (the full Material Design list from Home Assistant's frontend when it can be read, else a short
// list of common ones). A typed name is always accepted. Value: the name without "mdi:" (as the plan stores it).
// Fires "icon-change" {value: string | null}.

import { css, html, LitElement, nothing } from "lit";
import { defineElement } from "../../define.ts";
import { controls, tokens } from "../../styles.ts";
import { bareIconName, COMMON_ICONS, filterIcons, parseIconList, type IconEntry } from "../../icon-list.ts";

let fullList: Promise<IconEntry[]> | null = null;
const common = (): IconEntry[] => COMMON_ICONS.map((name) => ({ name, keywords: [] }));
/** The full list from Home Assistant's frontend once; the common icons when it cannot be read. */
function loadIcons(): Promise<IconEntry[]> {
  fullList ??= fetch("/static/mdi/iconList.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => {
      const list = parseIconList(d);
      return list.length ? list : common();
    })
    .catch(common);
  return fullList;
}

const safe = (n: string) => n.replace(/[^a-z0-9-]/gi, "");

export class IconPicker extends LitElement {
  static properties = {
    value: { attribute: false },
    hass: { attribute: false },
    disabled: { type: Boolean },
    label: { type: String },
    placeholder: { type: String },
    searchText: { type: String },
    noneText: { type: String },
    _open: { state: true },
    _q: { state: true },
    _list: { state: true },
  };
  declare value: string | null | undefined;
  declare hass: unknown;
  declare disabled: boolean;
  declare label: string;
  declare placeholder: string;
  declare searchText: string;
  declare noneText: string;
  private declare _open: boolean;
  private declare _q: string;
  private declare _list: IconEntry[] | null;

  constructor() {
    super();
    this.disabled = false;
    this.label = "";
    // no example icon of another kind (#408): the editor passes the one the thing's kind suggests, or none
    this.placeholder = "";
    this.searchText = "Search icons";
    this.noneText = "No icon of that name. You can still type it above.";
    this._open = false;
    this._q = "";
    this._list = null;
  }

  private emit(v: string | null) {
    this.dispatchEvent(new CustomEvent("icon-change", { detail: { value: bareIconName(v) }, bubbles: true, composed: true }));
  }

  private toggle() {
    this._open = !this._open;
    if (this._open && !this._list) void loadIcons().then((l) => (this._list = l));
  }

  render() {
    const name = bareIconName(this.value);
    // Home Assistant's own picker when it is there (it loads on demand in some versions, so check at every draw)
    if (customElements.get("ha-icon-picker")) {
      return html`<ha-icon-picker
        .hass=${this.hass}
        .label=${this.label}
        .value=${name ? `mdi:${name}` : ""}
        ?disabled=${this.disabled}
        @value-changed=${(e: CustomEvent<{ value?: string }>) => {
          e.stopPropagation();
          this.emit(e.detail.value || null);
        }}
      ></ha-icon-picker>`;
    }
    const hits = this._open && this._list ? filterIcons(this._list, this._q, 120) : [];
    // outside Home Assistant's own page there is no <ha-icon>: the grid then shows each icon's name instead of its picture
    const drawn = !!customElements.get("ha-icon");
    return html`<span class="row">
        <span class="fp3d-field grow"
          ><input
            type="text"
            .value=${this.value ?? ""}
            placeholder=${this.placeholder}
            aria-label=${this.label || this.placeholder}
            spellcheck="false"
            autocomplete="off"
            ?disabled=${this.disabled}
            @change=${(e: Event) => this.emit((e.target as HTMLInputElement).value)}
        /></span>
        ${name && drawn ? html`<ha-icon .icon=${`mdi:${safe(name)}`}></ha-icon>` : nothing}
        <button type="button" class="fp3d-btn pick" ?disabled=${this.disabled} aria-expanded=${this._open ? "true" : "false"} aria-label=${this.label || "Icons"} title=${this.label || "Icons"} @click=${() => this.toggle()}>▦</button>
      </span>
      ${this._open
        ? html`<div class="panel">
            <span class="fp3d-field"
              ><input
                type="search"
                .value=${this._q}
                placeholder=${this.searchText}
                aria-label=${this.searchText}
                spellcheck="false"
                autocomplete="off"
                @input=${(e: Event) => (this._q = (e.target as HTMLInputElement).value)}
            /></span>
            ${this._list
              ? html`<div class=${drawn ? "grid" : "grid names"} role="listbox">
                  ${hits.map(
                    (i) => html`<button
                      type="button"
                      role="option"
                      class=${i.name === name ? "on" : ""}
                      title=${i.name}
                      aria-label=${i.name}
                      @click=${() => {
                        this._open = false;
                        this._q = "";
                        this.emit(i.name);
                      }}
                    >
                      ${drawn ? html`<ha-icon .icon=${`mdi:${safe(i.name)}`}></ha-icon>` : html`<span>${i.name}</span>`}
                    </button>`,
                  )}
                </div>`
              : html`<small class="note" role="status">…</small>`}
            ${this._list && !hits.length ? html`<small class="note" role="status">${this.noneText}</small>` : nothing}
          </div>`
        : nothing}`;
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .grow {
        flex: 1;
        min-width: 0;
      }
      .grow input {
        width: 100%;
        box-sizing: border-box;
      }
      ha-icon {
        --mdc-icon-size: 22px;
        color: var(--fp3d-accent);
      }
      .pick {
        min-width: 36px;
        padding: 4px 8px;
      }
      .panel {
        display: grid;
        gap: 8px;
        margin-top: 6px;
        padding: 8px;
        border-radius: 10px;
        border: 1px solid var(--fp3d-line);
        background: rgba(127, 127, 127, 0.08);
      }
      .panel input {
        width: 100%;
        box-sizing: border-box;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
        gap: 4px;
        max-height: 200px;
        overflow: auto;
      }
      .grid.names {
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      }
      .grid button {
        min-height: 40px;
        display: grid;
        place-items: center;
        border: 1px solid transparent;
        border-radius: 8px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .grid.names button span {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0 6px;
      }
      .grid button:hover,
      .grid button:focus-visible,
      .grid button.on {
        border-color: var(--fp3d-accent);
      }
      .note {
        color: var(--fp3d-muted);
      }
    `,
  ];
}

defineElement("fp3d-icon-picker", IconPicker);
