// The Rooms picker on the floor bar (#249, option B of the menus redesign #219): one searchable list of rooms instead of
// a chip per room, so the bar never grows however many rooms a home has. Grouped by floor, so rooms with the same name
// show which floor they are on. A chunk of its own (load-parts.ts): it loads when the Rooms button is first pointed at.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";

/** A floor's rooms, as the picker lists them (the panel leaves out rooms without a name). */
export interface RoomGroup {
  id: string;
  name: string;
  rooms: { id: string; name: string; /** Hidden from the list unless "Show hidden" is on (#298). */ hidden?: boolean }[];
}

/** The groups whose rooms match what was typed (any part of the name, any case); groups left empty go. */
export function filterRooms(groups: readonly RoomGroup[], query: string, showHidden = true): RoomGroup[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q && showHidden) return [...groups];
  return groups.map((g) => ({ ...g, rooms: g.rooms.filter((r) => (showHidden || !r.hidden) && (!q || r.name.toLocaleLowerCase().includes(q))) })).filter((g) => g.rooms.length);
}

type T = (key: string, vars?: Record<string, string | number>) => string;

export class Fp3dRoomsPicker extends LitElement {
  static properties = {
    groups: { attribute: false },
    selected: { attribute: false },
    t: { attribute: false },
    editFloor: { attribute: false },
    canHide: { attribute: false },
    _showHidden: { state: true },
    _query: { state: true },
    _cursor: { state: true },
  };

  declare groups: RoomGroup[];
  /** The open room's id. */
  declare selected: string | null;
  declare t: T;
  /** The floor "Edit floor" opens in the editor (editors, one floor picked); null: no such line. */
  declare editFloor: string | null;
  /** Editors can hide a room from this list and bring it back (#298). */
  declare canHide: boolean;
  private declare _showHidden: boolean;
  private declare _query: string;
  /** The highlighted room (index into the listed rooms). */
  private declare _cursor: number;

  constructor() {
    super();
    this.groups = [];
    this.selected = null;
    this.t = (k) => k;
    this.editFloor = null;
    this.canHide = false;
    this._showHidden = false;
    this._query = "";
    this._cursor = 0;
  }

  private listed(): { group: RoomGroup; room: { id: string; name: string } }[] {
    return filterRooms(this.groups, this._query, this._showHidden).flatMap((group) => group.rooms.map((room) => ({ group, room })));
  }

  private fire(type: string, detail: unknown = null): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  protected firstUpdated(): void {
    const at = this.listed().findIndex((x) => x.room.id === this.selected);
    if (at > 0) this._cursor = at;
    this.renderRoot.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has("_cursor")) (this.renderRoot.querySelector(".cursor") as HTMLElement | null)?.scrollIntoView?.({ block: "nearest" });
  }

  /** Arrow keys (Home, End) move the highlight, Enter opens the highlighted room, Escape closes the picker. */
  private onKey(e: KeyboardEvent): void {
    const list = this.listed();
    const last = list.length - 1;
    const to = e.key === "ArrowDown" ? Math.min(last, this._cursor + 1) : e.key === "ArrowUp" ? Math.max(0, this._cursor - 1) : e.key === "Home" && e.ctrlKey ? 0 : e.key === "End" && e.ctrlKey ? last : null;
    if (to !== null) {
      e.preventDefault();
      this._cursor = Math.max(0, to);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = list[this._cursor];
      if (hit) this.fire("room-pick", { floorId: hit.group.id, roomId: hit.room.id });
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.fire("picker-close", { focus: true });
    }
  }

  protected render() {
    const groups = filterRooms(this.groups, this._query, this._showHidden);
    const hiddenCount = this.groups.reduce((n, g) => n + g.rooms.filter((r) => r.hidden).length, 0);
    const many = this.groups.length > 1;
    let i = -1;
    const cursorId = this.listed().length ? `room-${this._cursor}` : nothing;
    return html`<div class="veil" @click=${() => this.fire("picker-close")}></div>
      <div class="box" role="dialog" aria-label=${this.t("rooms")}>
        <input
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="rooms-list"
          aria-autocomplete="list"
          aria-activedescendant=${cursorId}
          aria-label=${this.t("rooms_find")}
          placeholder=${this.t("rooms_find")}
          .value=${this._query}
          @input=${(e: Event) => ((this._query = (e.target as HTMLInputElement).value), (this._cursor = 0))}
          @keydown=${(e: KeyboardEvent) => this.onKey(e)}
        />
        <div id="rooms-list" class="list" role="listbox" aria-label=${this.t("rooms")}>
          ${groups.map(
            (g) => html`<div role="group" aria-label=${g.name}>
              ${many ? html`<div class="mh" aria-hidden="true">${g.name}</div>` : nothing}
              ${g.rooms.map((r) => {
                i++;
                const n = i;
                return html`<div
                  id="room-${n}"
                  role="option"
                  aria-selected=${r.id === this.selected}
                  class="mi ${n === this._cursor ? "cursor" : ""} ${r.id === this.selected ? "on" : ""} ${r.hidden ? "dim" : ""}"
                  @mouseenter=${() => (this._cursor = n)}
                  @click=${() => this.fire("room-pick", { floorId: g.id, roomId: r.id })}
                >
                  ${r.name}${this.canHide
                    ? html`<button
                        type="button"
                        class="hide"
                        aria-label=${this.t(r.hidden ? "room_unhide_named" : "room_hide_named", { room: r.name })}
                        @click=${(e: Event) => (e.stopPropagation(), this.fire("room-hide", { roomId: r.id, hide: !r.hidden }))}
                      >
                        ${this.t(r.hidden ? "room_unhide" : "room_hide")}
                      </button>`
                    : nothing}
                </div>`;
              })}
            </div>`,
          )}
          ${groups.length ? nothing : html`<p class="none" role="status">${this.t("rooms_none", { q: this._query.trim() })}</p>`}
        </div>
        ${hiddenCount
          ? html`<label class="more"><input type="checkbox" .checked=${this._showHidden} @change=${(e: Event) => ((this._showHidden = (e.target as HTMLInputElement).checked), (this._cursor = 0))} />${this.t("rooms_show_hidden")} <small>(${hiddenCount})</small></label>`
          : nothing}
        ${this.editFloor ? html`<button class="edit" @click=${() => this.fire("edit-floor", { floorId: this.editFloor })}>${this.t("edit_floor")} ›</button>` : nothing}
      </div>`;
  }

  static styles = css`
    :host {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 40;
    }
    .veil {
      position: fixed;
      inset: 0;
    }
    .box {
      position: relative;
      display: grid;
      gap: 4px;
      width: min(280px, calc(100vw - 24px));
      padding: 6px;
      border-radius: var(--fp3d-radius-card, 8px);
      border: 1px solid var(--fp3d-line, rgba(127, 127, 127, 0.4));
      background: var(--fp3d-chrome-solid, #131c31);
      color: var(--fp3d-text, inherit);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
      font-size: 13.5px;
    }
    input {
      font: inherit;
      color: inherit;
      min-height: 36px;
      padding: 0 10px;
      border-radius: var(--fp3d-radius-control, 6px);
      border: 1px solid var(--fp3d-line, rgba(127, 127, 127, 0.4));
      background: transparent;
    }
    input:focus-visible,
    .edit:focus-visible {
      outline: 2px solid var(--fp3d-accent, #48cdeb);
      outline-offset: 1px;
    }
    .list {
      max-height: min(50vh, 360px);
      overflow-y: auto;
    }
    .mh {
      padding: 8px 10px 4px;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--fp3d-muted, #94a3b8);
    }
    .mi {
      display: flex;
      align-items: center;
      min-height: 36px;
      padding: 0 10px;
      border-radius: var(--fp3d-radius-control, 6px);
      cursor: pointer;
    }
    .mi.cursor {
      background: color-mix(in srgb, var(--fp3d-accent, #48cdeb) 12%, transparent);
    }
    .mi.on {
      color: var(--fp3d-accent, #48cdeb);
      font-weight: 700;
    }
    .mi.dim {
      color: var(--fp3d-muted, #94a3b8);
      font-style: italic;
    }
    .hide {
      margin-left: auto;
      font: inherit;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      color: var(--fp3d-muted, #94a3b8);
      background: none;
      border: none;
      min-height: 28px;
      padding: 0 6px;
      cursor: pointer;
      text-decoration: underline;
    }
    .hide:hover,
    .hide:focus-visible {
      color: var(--fp3d-accent, #48cdeb);
    }
    .more {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      padding: 0 10px;
      border-top: 1px solid var(--fp3d-line, rgba(127, 127, 127, 0.4));
      cursor: pointer;
    }
    .more input {
      min-height: 0;
    }
    .more small {
      color: var(--fp3d-muted, #94a3b8);
    }
    .mi.on::after {
      content: "✓";
      margin-left: auto;
    }
    .none {
      margin: 6px 10px;
      color: var(--fp3d-muted, #94a3b8);
    }
    .edit {
      font: inherit;
      text-align: left;
      color: var(--fp3d-accent, #48cdeb);
      background: none;
      border: none;
      border-top: 1px solid var(--fp3d-line, rgba(127, 127, 127, 0.4));
      min-height: 36px;
      padding: 0 10px;
      cursor: pointer;
    }
    @media (pointer: coarse) {
      .mi,
      input,
      .edit {
        min-height: 44px;
      }
    }
  `;
}

defineElement("fp3d-rooms-picker", Fp3dRoomsPicker);
