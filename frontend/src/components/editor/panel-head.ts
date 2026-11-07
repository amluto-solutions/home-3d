// One panel header for every side panel (#409, CONS-1/2/3, WORD-8): the name as the heading, "kind · place" under it,
// the live state as chips, a lock icon button and the "⋯" menu with Duplicate, Delete and the kind's own actions. Items,
// rooms, doors and windows, free walls, outdoor areas, pools, roof sections and windows, solar fields, device pins,
// pets and the floor settings all draw it from here, so it looks and works the same in each.

import { html, nothing } from "lit";
import { withKeys } from "../../clipboard.ts";
import { stateText } from "../../markers.ts";
import type { HassEntity, HomeAssistant } from "../../types.ts";
import { type FixKind } from "./helpers.ts";
import { panelIcon, panelUi } from "./item-sections.ts";
import type { Fp3dEditor } from "../editor.ts";
import { sideDrag, sideDragHandle } from "./side-drag.ts";

/** One action of a header's "⋯" menu. */
export interface PanelAction {
  label: string;
  run: () => void;
  /** Its keys, shown at the end of the row ("Ctrl+D"). */
  keys?: string[];
  danger?: boolean;
  disabled?: boolean;
}

/** The header's lock: one icon button with a constant name; the state is "pressed". */
export interface PanelLock {
  name: string;
  pressed: boolean;
  toggle: () => void;
  keys?: string[];
}

/** What a header shows. */
export interface PanelHead {
  /** The selection the header belongs to ("room:<id>", an item's id …): its menu closes when the selection changes. */
  id: string;
  /** The name, or the kind when the thing has no name. */
  title: string;
  /** The kind ("Door", "Lawn") and the place (room or floor): one line under the name; a part equal to the title is left out. */
  kind?: string | null;
  where?: string | null;
  /** What it reports now, one chip each. */
  live?: string[];
  lock?: PanelLock | null;
  menu?: (PanelAction | null | false | undefined)[];
}

/**
 * On a phone sheet the first panel header is the sheet's title row (#420, CONS-9): renderSheet opens a collector, the
 * header lands there instead of in the sheet's body, and the sheet draws it beside its Close button, so the name shows
 * once.
 */
const sheetHeads = new WeakMap<object, { head: unknown }>();

/** Starts collecting the next panel header for the sheet's title row. */
export function collectSheetHead(ed: object): void {
  sheetHeads.set(ed, { head: null });
}

/** The panel header collected since collectSheetHead (null: the panel drew none), and stops collecting. */
export function takeSheetHead(ed: object): unknown {
  const s = sheetHeads.get(ed);
  sheetHeads.delete(ed);
  return s?.head ?? null;
}

/** "online" → "Online", "78 %" stays: the first letter in upper case, the rest as it is (#409, WORD-8). */
export function sentenceCase(text: string, locale?: string): string {
  const s = text.trim();
  if (!s) return s;
  const first = String.fromCodePoint(s.codePointAt(0)!);
  return first.toLocaleUpperCase(locale) + s.slice(first.length);
}

/** An entity's state for a header chip: Home Assistant's own translated text where it has one, in sentence case. */
export function stateChip(hass: HomeAssistant | undefined, st: HassEntity | undefined): string {
  if (!st) return "";
  const own = (hass as { formatEntityState?: (s: HassEntity) => string } | undefined)?.formatEntityState;
  let text = "";
  try {
    text = own ? own(st) : "";
  } catch {
    text = "";
  }
  text ||= stateText(hass, st) || st.state;
  return sentenceCase(text, hass?.locale?.language ?? hass?.language);
}

/** PanelHeadPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class PanelHeadPart {
  /** The header (#409): name, kind · place, live chips, the lock and "⋯". The editor's tools only for an editor. */
  renderPanelHeader(this: Fp3dEditor, h: PanelHead) {
    const lang = this.hass?.locale?.language ?? this.hass?.language;
    const line = [h.kind && h.kind !== h.title ? h.kind : null, h.where].filter(Boolean).join(" · ");
    const live = (h.live ?? []).filter(Boolean).map((s) => sentenceCase(s, lang));
    // the side panel moves by its header (#421): drag it, double-click puts it back
    const drag = sideDragHandle(this);
    const movable = !!sideDrag(this);
    const head = html`<header
      class="fp3d-item-head fp3d-panel-head ${movable ? "fp3d-drag-handle" : ""}"
      title=${movable ? this.t("float_drag_hint") : nothing}
      @pointerdown=${drag.down}
      @pointermove=${drag.move}
      @pointerup=${drag.up}
      @pointercancel=${drag.up}
      @dblclick=${drag.dblclick}
    >
      <div class="fp3d-item-title">
        <h2>${h.title}</h2>
        ${line ? html`<span class="fp3d-sub">${line}</span>` : nothing}
      </div>
      <div class="fp3d-item-tools">${h.lock ? this.lockButton(h.lock) : nothing}${this.panelMenu(h.id, h.menu ?? [])}</div>
      ${live.length ? html`<div class="fp3d-live" role="status">${live.map((s) => html`<span class="fp3d-live-chip">${s}</span>`)}</div>` : nothing}
    </header>`;
    const sink = sheetHeads.get(this);
    if (sink && !sink.head) {
      sink.head = head;
      return nothing;
    }
    return head;
  }

  /** The lock (#409, CONS-3): the same icon button everywhere, its name constant, its state as aria-pressed. */
  lockButton(this: Fp3dEditor, lock: PanelLock) {
    if (!this.isEditor) return nothing;
    return html`<button type="button" class="fp3d-btn fp3d-fix fp3d-icon-btn" aria-pressed=${lock.pressed ? "true" : "false"} aria-label=${lock.name} title=${lock.keys ? withKeys(lock.name, lock.keys) : lock.name} @click=${lock.toggle}>
      ${panelIcon(lock.pressed ? "lock" : "unlock")}
    </button>`;
  }

  /**
   * The lock of a thing on the plan: furniture and device pins have their own ("Lock position", key L); rooms, walls,
   * doors, windows and outdoor areas follow the plan lock ("Lock floor plan").
   */
  fixLock(this: Fp3dEditor, kind: FixKind, id: string): PanelLock {
    if (kind === "furniture" || kind === "device") return { name: this.t("lock_position"), pressed: this.isFixedItem(kind, id), keys: ["L"], toggle: () => this.toggleFixed(kind, id) };
    return this.planLock();
  }

  /** The floor plan's lock, for the parts of the plan (rooms, walls, openings, outdoor areas, floors). */
  planLock(this: Fp3dEditor): PanelLock {
    return { name: this.t("plan_lock"), pressed: !!this._doc.settings.lock_plan, toggle: () => this.toggleLockPlan() };
  }

  /** A roof section's, roof window's or solar field's own lock; the plan lock wins while it is on. */
  ownLock(this: Fp3dEditor, locked: boolean | null | undefined, toggle: () => void): PanelLock {
    if (this._doc.settings.lock_plan) return this.planLock();
    return { name: this.t("lock_position"), pressed: !!locked, toggle };
  }

  /**
   * The header's "⋯" menu (#396, #409): the actions with their keys, Delete last and in red. Escape closes it and
   * gives the keyboard back to "⋯"; leaving it closes it too. Nothing for a viewer or with no action.
   */
  panelMenu(this: Fp3dEditor, id: string, entries: (PanelAction | null | false | undefined)[]) {
    const acts = entries.filter((a): a is PanelAction => !!a);
    if (!this.isEditor || !acts.length) return nothing;
    const s = panelUi(this, id);
    const close = () => {
      s.menu = false;
      this.requestUpdate();
    };
    const run = (fn: () => void) => () => {
      s.menu = false;
      fn();
      this.requestUpdate();
    };
    return html`<span class="fp3d-menu-wrap"
      @keydown=${(e: KeyboardEvent) => {
        if (e.key !== "Escape" || !s.menu) return;
        e.stopPropagation();
        close();
        (this.renderRoot.querySelector?.(".fp3d-item-more") as HTMLElement | null)?.focus();
      }}
      @focusout=${(e: FocusEvent) => {
        const to = e.relatedTarget as Node | null;
        if (s.menu && to && !(e.currentTarget as HTMLElement).contains(to)) close();
      }}
      ><button type="button" class="fp3d-btn fp3d-icon-btn fp3d-item-more" aria-haspopup="menu" aria-expanded=${s.menu ? "true" : "false"} aria-label=${this.t("item_menu")} title=${this.t("item_menu")} @click=${() => {
        s.menu = !s.menu;
        // in a phone sheet pulled up to its title row only, the menu needs the room below it (#420)
        if (s.menu && this._sheeted && this._sheet === "peek") this._sheet = "half";
        this.requestUpdate();
      }}>${panelIcon("more")}</button>
      ${s.menu
        ? html`<div class="fp3d-ctx fp3d-item-menu" role="menu" aria-label=${this.t("item_menu")}>
            ${acts.map(
              (a) =>
                html`<button type="button" role="menuitem" class=${a.danger ? "fp3d-ctx-danger" : ""} ?disabled=${!!a.disabled} @click=${run(a.run)}><span>${a.label}</span>${a.keys?.length ? html`<kbd>${a.keys.join(", ")}</kbd>` : nothing}</button>`,
            )}
          </div>`
        : nothing}</span
    >`;
  }
}
