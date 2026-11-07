// A searchable entity picker: a text field that filters the options by name, area or id as you type,
// with a short result list below it. Replaces plain <select> elements, which are unusable with
// thousands of entities. Fixed choices (automatic, none) come first, then the likely entities (#132: the room's area,
// the link's domain), then the rest by name.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { rankOptions, type OptionPreference } from "../entity-options.ts";
import { tokens } from "../styles.ts";

export interface PickerOption {
  id: string;
  label: string;
  /** The entity's area, for ranking (#132). */
  area?: string;
}

const MAX_SHOWN = 40;

export class EntityPicker extends LitElement {
  /** Labelable (#132): a click on the field's label text focuses the box instead of leaving the keys to the plan. */
  static formAssociated = true;

  static properties = {
    options: { attribute: false },
    fixed: { attribute: false },
    value: { attribute: false },
    disabled: { type: Boolean },
    placeholder: { attribute: false },
    prefer: { attribute: false },
    groups: { attribute: false },
    label: { attribute: false },
    live: { attribute: false },
    _query: { state: true },
    _open: { state: true },
    _cursor: { state: true },
  };

  /** Entities to choose from. */
  declare options: PickerOption[];
  /** Choices shown before the entities (e.g. automatic, none); ids must not look like entity ids. */
  declare fixed: PickerOption[];
  /** The chosen id (an option's or a fixed choice's). */
  declare value: string | null;
  declare disabled: boolean;
  declare placeholder: string;
  /** Which entities are likely (#132): the room's area, the link's domains. */
  declare prefer: OptionPreference;
  /** Headings that split the list by the link's domains (#172): the entities that fit, then the others. Off when null. */
  declare groups: { likely: string; other: string } | null;
  /** The accessible name of the box (#396): the field's visible label, so a screen reader hears it, not the value. */
  declare label: string;
  /** What the chosen entity reports now (#396), shown after its name: "Car battery · 78 %". */
  declare live: string;
  private declare _query: string;
  private declare _open: boolean;
  private declare _cursor: number;
  private partition: { from: readonly PickerOption[]; domains: readonly string[]; list: readonly PickerOption[] } | null = null;
  private blurTimer: ReturnType<typeof setTimeout> | undefined;
  /** The ranked options, kept while the options and the preference stay (made only while the list is open). */
  private ranked: { options: PickerOption[]; prefer: string; list: readonly PickerOption[] } | null = null;

  constructor() {
    super();
    this.options = [];
    this.fixed = [];
    this.value = null;
    this.disabled = false;
    this.placeholder = "";
    this.prefer = {};
    this.groups = null;
    this.label = "";
    this.live = "";
    this._query = "";
    this._open = false;
    this._cursor = 0;
    this.addEventListener("click", (e) => {
      // the label's click lands on the picker itself: give the box the focus
      if (e.composedPath()[0] === this) (this.renderRoot?.querySelector?.("input") as HTMLInputElement | null)?.focus();
    });
  }

  /** Whether the list is open: the editor's shortcuts leave the keyboard to the picker meanwhile (#132). */
  get open(): boolean {
    return this._open;
  }

  private get current(): PickerOption | undefined {
    return [...this.fixed, ...this.options].find((o) => o.id === this.value);
  }

  private get hits(): PickerOption[] {
    const q = this._query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const match = (o: PickerOption) => {
      const text = `${o.label} ${o.id}`.toLowerCase();
      return words.every((w) => text.includes(w));
    };
    const fixed = this.fixed.filter((o) => !q || match(o));
    const all = this.grouped(this.rankedOptions());
    const rest = q ? all.filter(match) : all;
    return [...fixed, ...rest.slice(0, MAX_SHOWN)];
  }

  /** Whether an entity is in one of the link's domains (#172). */
  private fits(o: PickerOption): boolean {
    return (this.prefer.domains ?? []).includes(o.id.slice(0, o.id.indexOf(".")));
  }

  /** With headings on: the entities of the link's domains first (each part keeps its room-first order), then the rest. */
  private grouped(list: readonly PickerOption[]): readonly PickerOption[] {
    if (!this.groups || !this.prefer.domains?.length) return list;
    const key = list;
    if (this.partition?.from === key && this.partition.domains === this.prefer.domains) return this.partition.list;
    const out = [...list.filter((o) => this.fits(o)), ...list.filter((o) => !this.fits(o))];
    this.partition = { from: key, domains: this.prefer.domains, list: out };
    return out;
  }

  /** The heading before each row of the list: where the fitting entities start, and where the others do (#172). */
  private headings(hits: readonly PickerOption[]): (string | null)[] {
    const out: (string | null)[] = hits.map(() => null);
    if (!this.groups || !this.prefer.domains?.length) return out;
    const rows = hits.filter((h) => h.id.includes("."));
    const fitting = rows.filter((h) => this.fits(h)).length;
    // a single group needs no heading
    if (!fitting || fitting === rows.length) return out;
    out[hits.indexOf(rows[0])] = this.groups.likely;
    out[hits.indexOf(rows[fitting])] = this.groups.other;
    return out;
  }

  private rankedOptions(): readonly PickerOption[] {
    const key = `${this.prefer.area ?? ""}|${(this.prefer.domains ?? []).join(",")}`;
    const r = this.ranked;
    if (r && r.options === this.options && r.prefer === key) return r.list;
    const list = rankOptions(this.options, this.prefer);
    this.ranked = { options: this.options, prefer: key, list };
    return list;
  }

  /** After typing: the highlight goes to the first matching entity (fixed choices only when no entity matches). */
  private onQuery(): void {
    const hits = this.hits;
    const first = this._query.trim() ? hits.findIndex((o) => o.id.includes(".")) : -1;
    this._cursor = Math.max(0, first);
  }

  /** How many matching entities the list leaves out (it shows the first MAX_SHOWN). */
  private get leftOut(): number {
    const q = this._query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const all = q ? this.options.filter((o) => words.every((w) => `${o.label} ${o.id}`.toLowerCase().includes(w))).length : this.options.length;
    return Math.max(0, all - MAX_SHOWN);
  }

  private openList(): void {
    clearTimeout(this.blurTimer);
    this._open = true;
    this._query = "";
    this._cursor = 0;
  }

  protected updated(changed: PropertyValues): void {
    // the highlighted row stays in view while the arrows move it
    if (this._open && changed.has("_cursor")) (this.renderRoot?.querySelector?.("li.cursor") as HTMLElement | null)?.scrollIntoView?.({ block: "nearest" });
  }

  private choose(id: string): void {
    this.value = id;
    this._query = "";
    this._open = false;
    this.dispatchEvent(new CustomEvent("change", { detail: { value: id }, bubbles: true, composed: true }));
  }

  private onKey(e: KeyboardEvent): void {
    const hits = this.hits;
    if (e.key === "ArrowDown") {
      this._open = true;
      this._cursor = Math.min(hits.length - 1, this._cursor + 1);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      this._cursor = Math.max(0, this._cursor - 1);
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (this._open && hits[this._cursor]) this.choose(hits[this._cursor].id);
      e.preventDefault();
    } else if (e.key === "Escape") {
      this._open = false;
      this._query = "";
    }
  }

  protected render() {
    const current = this.current;
    const hits = this._open ? this.hits : [];
    const heads = this.headings(hits);
    const picked = this.value && this.value.includes(".") ? this.value : null;
    // a press anywhere in the picker but its box (the list's padding or scrollbar, a note row) keeps the box focused,
    // so the typed keys stay here instead of reaching the plan's shortcuts (#132)
    return html`<div class="wrap" @mousedown=${(e: Event) => (e.target as Element)?.localName !== "input" && e.preventDefault()}>
      <input
        type="text"
        role="combobox"
        aria-expanded=${this._open}
        aria-label=${this.label || nothing}
        title=${picked ?? nothing}
        ?disabled=${this.disabled}
        placeholder=${current ? current.label : this.placeholder}
        .value=${this._open ? this._query : current ? (this.live && picked ? `${current.label} · ${this.live}` : current.label) : ""}
        @focus=${() => this.openList()}
        @click=${() => {
          // a second click on the box (it kept the focus after a pick) opens the list again (#132)
          if (!this._open) this.openList();
        }}
        @blur=${() => {
          this.blurTimer = setTimeout(() => (this._open = false), 150);
        }}
        @input=${(e: Event) => {
          this._query = (e.target as HTMLInputElement).value;
          this._open = true;
          this.onQuery();
        }}
        @keydown=${this.onKey}
      />
      ${this._open
        ? html`<ul class="list" role="listbox">
            ${hits.length ? nothing : html`<li class="empty">–</li>`}
            ${hits.map(
              (o, i) => html`${heads[i] ? html`<li class="group" role="presentation">${heads[i]}</li>` : nothing}<li
                role="option"
                aria-selected=${o.id === this.value}
                class="${i === this._cursor ? "cursor" : ""} ${o.id === this.value ? "chosen" : ""}"
                @mousedown=${(e: Event) => e.preventDefault()}
                @click=${() => this.choose(o.id)}
              >
                <span>${o.label}</span>${o.id.includes(".") ? html`<small>${o.id}</small>` : nothing}
              </li>`,
            )}
            ${this.leftOut > 0 ? html`<li class="empty">… +${this.leftOut} · ${this.placeholder}</li>` : nothing}
          </ul>`
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
      input {
        width: 100%;
        box-sizing: border-box;
        font: inherit;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        padding: 8px 10px;
      }
      input::placeholder {
        color: var(--fp3d-text);
        opacity: 0.9;
      }
      input:focus::placeholder {
        color: var(--fp3d-muted);
      }
      input:focus {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: -1px;
      }
      .list {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 4px);
        z-index: 20;
        margin: 0;
        padding: 4px;
        list-style: none;
        max-height: 280px;
        overflow-y: auto;
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        box-shadow: var(--fp3d-shadow);
      }
      li {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 6px 8px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13.5px;
      }
      li small {
        color: var(--fp3d-muted);
        font-size: 11px;
      }
      li.cursor,
      li:hover {
        background: color-mix(in srgb, var(--fp3d-accent) 18%, transparent);
      }
      li.chosen {
        color: var(--fp3d-accent);
      }
      li.group {
        color: var(--fp3d-muted);
        cursor: default;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 6px 8px 2px;
      }
      li.group:hover {
        background: none;
      }
      li.empty {
        color: var(--fp3d-muted);
        cursor: default;
      }
    `,
  ];
}

defineElement("fp3d-entity-picker", EntityPicker);
