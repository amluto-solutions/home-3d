// The room panel's "Edit list" mode (#229): an editor hides or shows each entity, moves rows within their group, moves
// the groups and pins rows into a "Pinned" section at the top. A lazy chunk of the main bundle: only an editor who
// opens the mode loads it. Each step is a "plan-change" event (bubbling out of the room panel), saved for the house.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import type { I18nKey } from "../i18n.ts";
import type { PanelLayout } from "../model.ts";
import type { ArrangedPanel, PanelGroup } from "../panel-layout.ts";
import { moveIn, storePanelChoice, toggleHidden, togglePinned, withGroupOrder, withPinnedOrder, withRowOrder } from "../panel-layout-edit.ts";
import { controls, tokens } from "../styles.ts";
import type { HomeAssistant } from "../types.ts";

const TITLES: Record<PanelGroup, I18nKey> = {
  lights: "panel_lights",
  covers: "panel_covers",
  climate: "panel_climate",
  media: "panel_media",
  switches: "panel_switches",
  cameras: "panel_cameras",
  sensors: "panel_sensors",
  scenes: "panel_scenes",
};

/** A list the drag handles move in: the pinned rows, one group's rows, or the groups. */
type ListKey = "pinned" | "groups" | PanelGroup;

const svg = (d: string) =>
  html`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${d} /></svg>`;
const ICONS = {
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2",
  pin: "M12 17v5M8 3h8l-1 6 3 4H6l3-4z",
};

export class Fp3dRoomListEdit extends LitElement {
  static properties = {
    hass: { attribute: false },
    roomId: { attribute: false },
    arranged: { attribute: false },
    hiddenIds: { attribute: false },
    layout: { attribute: false },
    allGroups: { attribute: false },
    nameOf: { attribute: false },
    iconOf: { attribute: false },
    t: { attribute: false },
    _drag: { state: true },
  };

  declare hass: HomeAssistant;
  declare roomId: string;
  /** Every entity the room can list, hidden ones too, as the panel arranges them. */
  declare arranged: ArrangedPanel;
  declare hiddenIds: string[];
  declare layout: PanelLayout | null;
  /** Every group in the order the panel uses now (shown or not). */
  declare allGroups: PanelGroup[];
  declare nameOf: (id: string) => string;
  /** The icon path of an entity's kind (the room panel's, so this chunk shares no module with the main bundle but Lit). */
  declare iconOf: (id: string) => string | null;
  declare t: (key: I18nKey) => string;
  /** A drag under way: the list, where it started, where it would land, and the middles of its entries then. */
  declare _drag: { list: ListKey; from: number; to: number; mids: number[] } | null;

  constructor() {
    super();
    this.hiddenIds = [];
    this.layout = null;
    this._drag = null;
  }

  private store(choice: { hidden?: string[]; layout?: PanelLayout | null }): void {
    this.dispatchEvent(new CustomEvent("plan-change", { detail: { change: storePanelChoice(this.roomId, choice) }, bubbles: true, composed: true, cancelable: true }));
  }

  /** The entries of a list as shown now. */
  private entries(list: ListKey): string[] {
    const a = this.arranged;
    if (list === "pinned") return a.pinned;
    if (list === "groups") return a.groups.map((g) => g.group);
    return a.groups.find((g) => g.group === list)?.ids ?? [];
  }

  /** Moves an entry of a list and stores the new order. */
  private move(list: ListKey, from: number, to: number): void {
    const now = this.entries(list);
    if (from === to || to < 0 || to >= now.length) return;
    const next = moveIn(now, from, to);
    if (list === "pinned") this.store({ layout: withPinnedOrder(this.layout, next) });
    else if (list === "groups") this.store({ layout: withGroupOrder(this.layout, next as PanelGroup[], this.allGroups) });
    else this.store({ layout: withRowOrder(this.layout, this.arranged, list, next) });
  }

  private dragStart(e: PointerEvent, list: ListKey, index: number): void {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const mids = [...this.renderRoot.querySelectorAll(`[data-list="${list}"]`)].map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    this._drag = { list, from: index, to: index, mids };
  }

  private dragMove(e: PointerEvent): void {
    const d = this._drag;
    if (!d) return;
    const to = d.mids.filter((m, i) => i !== d.from && m < e.clientY).length;
    if (to !== d.to) this._drag = { ...d, to };
  }

  private dragEnd(): void {
    const d = this._drag;
    this._drag = null;
    if (d) this.move(d.list, d.from, d.to);
  }

  /** The entries of a list in the order shown: while it is dragged, with the dragged one where it would land. */
  private shown<T extends string>(list: ListKey, items: T[]): T[] {
    const d = this._drag;
    return d && d.list === list ? moveIn(items, d.from, d.to) : items;
  }

  private grip(list: ListKey, index: number, label: string) {
    return html`<button
      class="fp3d-le-grip"
      title=${this.t("panel_drag")}
      aria-label="${this.t("panel_drag")}: ${label}"
      @pointerdown=${(e: PointerEvent) => this.dragStart(e, list, index)}
      @pointermove=${(e: PointerEvent) => this.dragMove(e)}
      @pointerup=${() => this.dragEnd()}
      @pointercancel=${() => (this._drag = null)}
    >
      ${svg(ICONS.grip)}
    </button>`;
  }

  private upDown(list: ListKey, index: number, count: number, label: string) {
    return html`<button class="fp3d-le-btn" title=${this.t("move_up")} aria-label="${this.t("move_up")}: ${label}" ?disabled=${index === 0} @click=${() => this.move(list, index, index - 1)}>
        ${svg(ICONS.up)}</button
      ><button class="fp3d-le-btn" title=${this.t("move_down")} aria-label="${this.t("move_down")}: ${label}" ?disabled=${index === count - 1} @click=${() => this.move(list, index, index + 1)}>
        ${svg(ICONS.down)}
      </button>`;
  }

  private row(list: ListKey, id: string, count: number): TemplateResult {
    const name = this.nameOf(id);
    const hidden = this.hiddenIds.includes(id);
    const pinned = this.arranged.pinned.includes(id);
    const icon = this.iconOf(id);
    const real = this.entries(list).indexOf(id);
    const dragged = this._drag?.list === list && this._drag.from === real;
    return html`<li class="fp3d-le-row ${hidden ? "fp3d-le-hidden" : ""} ${dragged ? "fp3d-le-dragged" : ""}" data-list=${list}>
      ${this.grip(list, real, name)}
      <span class="fp3d-le-icon">${icon ? svg(icon) : nothing}</span>
      <span class="fp3d-le-name">${name}</span>
      <span class="fp3d-le-tools">
        ${this.upDown(list, real, count, name)}
        <button
          class="fp3d-le-btn"
          aria-pressed=${hidden ? "false" : "true"}
          title=${this.t(hidden ? "panel_unhide" : "panel_hide")}
          aria-label="${this.t(hidden ? "panel_unhide" : "panel_hide")}: ${name}"
          @click=${() => this.store({ hidden: toggleHidden(this.hiddenIds, id) })}
        >
          ${svg(hidden ? ICONS.eyeOff : ICONS.eye)}
        </button>
        <button
          class="fp3d-le-btn ${pinned ? "fp3d-le-on" : ""}"
          aria-pressed=${pinned ? "true" : "false"}
          title=${this.t(pinned ? "panel_unpin_top" : "panel_pin_top")}
          aria-label="${this.t(pinned ? "panel_unpin_top" : "panel_pin_top")}: ${name}"
          @click=${() => this.store({ layout: togglePinned(this.layout, id) })}
        >
          ${svg(ICONS.pin)}
        </button>
      </span>
    </li>`;
  }

  private rows(list: ListKey, ids: string[]) {
    return html`<ul class="fp3d-le-list">
      ${this.shown(list, ids).map((id, _i, all) => this.row(list, id, all.length))}
    </ul>`;
  }

  protected render() {
    const a = this.arranged;
    if (!a) return nothing;
    const groups = this.shown(
      "groups",
      a.groups.map((g) => g.group),
    );
    return html`<p class="fp3d-le-note">${this.t("panel_edit_note")}</p>
      ${a.pinned.length
        ? html`<section class="fp3d-le-sec fp3d-le-pinned">
            <h3>${this.t("panel_pinned")}</h3>
            ${this.rows("pinned", a.pinned)}
          </section>`
        : nothing}
      ${groups.map((group) => {
        const real = a.groups.findIndex((g) => g.group === group);
        const title = this.t(TITLES[group]);
        return html`<section class="fp3d-le-sec ${this._drag?.list === "groups" && this._drag.from === real ? "fp3d-le-dragged" : ""}" data-list="groups">
          <div class="fp3d-le-head">
            ${this.grip("groups", real, title)}
            <h3>${title}</h3>
            <span class="fp3d-le-tools">${this.upDown("groups", real, groups.length, title)}</span>
          </div>
          ${this.rows(group, a.groups[real].ids)}
        </section>`;
      })}`;
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        display: grid;
        gap: 12px;
      }
      .fp3d-le-note {
        margin: 4px 0 0;
        color: var(--fp3d-muted);
        font-size: 12.5px;
      }
      .fp3d-le-sec {
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
        padding: 4px 6px;
        background: var(--fp3d-chrome-solid);
      }
      .fp3d-le-pinned {
        border-color: color-mix(in srgb, var(--fp3d-accent, #37e0ff) 50%, var(--fp3d-line));
      }
      .fp3d-le-pinned h3 {
        padding: 6px 4px;
      }
      .fp3d-le-head,
      .fp3d-le-row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 40px;
      }
      h3 {
        flex: 1;
        margin: 0;
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .fp3d-le-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .fp3d-le-row {
        border-top: 1px solid var(--fp3d-line);
      }
      .fp3d-le-icon {
        display: grid;
        place-items: center;
        width: 26px;
        color: var(--fp3d-muted);
      }
      .fp3d-le-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .fp3d-le-hidden .fp3d-le-name,
      .fp3d-le-hidden .fp3d-le-icon {
        opacity: 0.45;
        text-decoration: line-through;
      }
      .fp3d-le-dragged {
        outline: 2px dashed var(--fp3d-accent, #37e0ff);
        outline-offset: -2px;
        border-radius: 8px;
      }
      .fp3d-le-tools {
        display: inline-flex;
        gap: 2px;
      }
      .fp3d-le-btn,
      .fp3d-le-grip {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: none;
        color: var(--fp3d-text);
        cursor: pointer;
      }
      .fp3d-le-btn:hover:not(:disabled),
      .fp3d-le-grip:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .fp3d-le-btn:disabled {
        opacity: 0.3;
        cursor: default;
      }
      .fp3d-le-on {
        color: var(--fp3d-accent, #37e0ff);
      }
      /* a drag on the handle moves the row, it does not scroll the panel */
      .fp3d-le-grip {
        touch-action: none;
        cursor: grab;
        color: var(--fp3d-muted);
      }
      button:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 2px;
      }
      @media (pointer: coarse) {
        .fp3d-le-btn,
        .fp3d-le-grip {
          width: 44px;
          height: 44px;
        }
      }
    `,
  ];
}

defineElement("fp3d-room-list-edit", Fp3dRoomListEdit);
