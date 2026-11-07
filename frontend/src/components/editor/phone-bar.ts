// The phone editor's bottom bar and its More sheet (#250, drawings signed off on #219): a lazy chunk of the editor
// bundle (home-3d-editor-phone-bar-<hash>.js), loaded only where the editor is phone-wide. Select, Build, Furniture,
// Undo, Redo and More, as a toolbar with roving focus (one tab stop, the arrow keys, Home and End move). More holds
// what the desktop row has besides: Outside, Energy, Wall view, 3D beside, Fit, Fit with garden, Help and Settings
// for this home. Build and Outside open the editor's own menus (drawn as sheets above the bar), so a phone has every
// drawing tool and choice the desktop has. The bar works the editor through its methods; it keeps no plan state.
// The chunk imports nothing but types: Lit, the icons and defineElement come from the editor (definePhoneBar's kit),
// so its modules stay in the editor's one shared chunk and the editor's first open still fetches two files (#245).

import type * as Lit from "lit";
import type { PropertyValues } from "lit";
import type { defineElement } from "../../define.ts";
import type { uiIcon, UiIcon } from "../../ui-icons.ts";
import type { I18nKey } from "../../i18n.ts";
import type { Tool } from "../../editor-hint.ts";
import type { Fp3dEditor } from "../editor.ts";

/** The drawing tools in the Build menu (the toolbar's group): the bar's Build button is lit while one is in use. */
export const BUILD_TOOLS: readonly Tool[] = ["rect", "polygon", "measure", "wall", "opening", "hole", "roof"];

export interface BarButton {
  id: "select" | "build" | "furniture" | "undo" | "redo" | "more";
  icon: UiIcon;
  label: string;
  /** a tool: lit while in use (aria-pressed); a menu: open or shut (aria-expanded) */
  pressed?: boolean;
  menu?: boolean;
  open?: boolean;
  disabled: boolean;
  run: () => void;
}

export interface MoreRow {
  id: string;
  icon: UiIcon;
  label: string;
  sub?: string;
  /** a switch row (3D beside): its state */
  checked?: boolean;
  /** leads on to another menu or page */
  onward?: boolean;
  disabled?: boolean;
  run: () => void;
}

/** What the chunk borrows from the editor bundle. */
export interface PhoneBarKit {
  LitElement: typeof Lit.LitElement;
  html: typeof Lit.html;
  css: typeof Lit.css;
  nothing: typeof Lit.nothing;
  uiIcon: typeof uiIcon;
  defineElement: typeof defineElement;
}

/** Defines <fp3d-phone-bar> with the editor's Lit (lazy.ts calls it when the chunk arrives); returns its class. */
export function definePhoneBar(kit: PhoneBarKit) {
  const { LitElement, html, css, nothing, uiIcon } = kit;

  class Fp3dPhoneBar extends LitElement {
    static properties = {
      ed: { attribute: false },
      tool: { attribute: false },
      menu: { attribute: false },
      canUndo: { attribute: false },
      canRedo: { attribute: false },
      split: { attribute: false },
      wallPick: { attribute: false },
      hasFloor: { attribute: false },
      editable: { attribute: false },
      outside: { attribute: false },
      multi: { attribute: false },
      lang: { attribute: false },
      _focus: { state: true },
    };

    declare ed: Fp3dEditor;
    declare tool: Tool;
    declare menu: string | null;
    declare canUndo: boolean;
    declare canRedo: boolean;
    declare split: boolean;
    declare wallPick: boolean;
    declare hasFloor: boolean;
    declare editable: boolean;
    declare outside: boolean;
    /** Select several is on (#263). */
    declare multi: boolean;
    declare lang: string;
    /** The bar's one tab stop (roving focus). */
    declare _focus: number;

    constructor() {
      super();
      this._focus = 0;
      this.menu = null;
    }

    private t(key: I18nKey): string {
      return this.ed.t(key);
    }

    /** The six buttons, as drawn. */
    buttons(): BarButton[] {
      const ed = this.ed;
      const off = !this.hasFloor || !this.editable;
      const menu = this.menu;
      return [
        { id: "select", icon: "pointer", label: this.t("tool_select"), pressed: this.tool === "select", disabled: !this.hasFloor, run: () => ed.phoneTool("select") },
        { id: "build", icon: "wall", label: this.t("tool_group_build"), pressed: BUILD_TOOLS.includes(this.tool), menu: true, open: menu === "build", disabled: off, run: () => ed.openToolMenu(menu === "build" ? null : "build") },
        { id: "furniture", icon: "sofa", label: this.t("tool_furniture"), pressed: this.tool === "furniture", disabled: off, run: () => ed.phoneTool("furniture") },
        { id: "undo", icon: "undo", label: this.t("undo"), disabled: !this.canUndo, run: () => ed.undo() },
        { id: "redo", icon: "redo", label: this.t("redo"), disabled: !this.canRedo, run: () => ed.redo() },
        { id: "more", icon: "more", label: this.t("more"), menu: true, open: menu === "phone-more", disabled: false, run: () => ed.openToolMenu(menu === "phone-more" ? null : "phone-more") },
      ];
    }

    /** More's rows: the rest of the desktop's toolbar row and its More menu. */
    moreRows(): MoreRow[] {
      const ed = this.ed;
      const off = !this.hasFloor || !this.editable;
      const close = () => ed.openToolMenu(null);
      const rows: MoreRow[] = [
        // Select several (#263): on a phone it sat at the bottom of a long item form; a long press on an item starts it too
        { id: "multi", icon: "pointer", label: this.t("multi_more"), sub: this.t("multi_more_sub"), checked: this.multi, disabled: off, run: () => (close(), ed.toggleMultiMode()) },
        { id: "outside", icon: "tree", label: this.t("tool_group_outside"), sub: this.t("outside_sub"), onward: true, disabled: off, run: () => ed.openToolMenu("outside") },
        { id: "energy", icon: "bolt", label: this.t("tool_energy"), disabled: off, run: () => ed.phoneTool("energy") },
        { id: "wall-view", icon: "wall", label: this.t("wall_view"), sub: this.t("wall_view_sub"), checked: this.wallPick, run: () => (close(), ed.toggleWallPick(this)) },
        { id: "split", icon: this.split ? "split-on" : "split-off", label: this.t("split_3d"), checked: this.split, run: () => (close(), ed.toggleSplit()) },
        { id: "fit", icon: "expand", label: this.t("fit"), run: () => (close(), ed.fit()) },
      ];
      // as on the desktop: only when something stands outside the rooms
      if (this.outside) rows.push({ id: "fit-all", icon: "tree", label: this.t("fit_all"), run: () => (close(), ed.fit(true)) });
      rows.push(
        // Help brings a hidden hint back too (the drawings' note)
        { id: "help", icon: "help", label: this.t("help_and_shortcuts"), run: () => (close(), ed.setHintOff(false), (ed._help = true)) },
        { id: "settings", icon: "gear", label: this.t("settings_home"), onward: true, run: () => (close(), ed.openSettings("general")) },
      );
      return rows;
    }

    /** The button that holds the tab stop: the last one focused, else the first that can take it. */
    private stop(items: BarButton[]): number {
      if (!items[this._focus]?.disabled) return this._focus;
      return Math.max(0, items.findIndex((b) => !b.disabled));
    }

    /** Arrow keys, Home and End move along the bar (skipping what is off). */
    private readonly keys = (e: KeyboardEvent) => {
      const items = this.buttons();
      const on = items.map((b, i) => (b.disabled ? -1 : i)).filter((i) => i >= 0);
      if (!on.length) return;
      const at = on.indexOf(this.stop(items));
      const to = e.key === "ArrowRight" ? on[(at + 1) % on.length] : e.key === "ArrowLeft" ? on[(at - 1 + on.length) % on.length] : e.key === "Home" ? on[0] : e.key === "End" ? on[on.length - 1] : undefined;
      if (to === undefined) return;
      e.preventDefault();
      this._focus = to;
      void this.updateComplete.then(() => this.renderRoot.querySelectorAll<HTMLElement>(".bar > button")[to]?.focus());
    };

    /** More's keys: arrows, Home and End move; Escape shuts it, back on its button. */
    private readonly menuKeys = (e: KeyboardEvent) => {
      const rows = [...this.renderRoot.querySelectorAll<HTMLElement>(".more [role^='menuitem']:not([disabled])")];
      const at = rows.indexOf((this.renderRoot as ShadowRoot).activeElement as HTMLElement);
      const to = e.key === "ArrowDown" ? (at + 1) % rows.length : e.key === "ArrowUp" ? (at - 1 + rows.length) % rows.length : e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : -1;
      if (to >= 0 && rows.length) {
        e.preventDefault();
        rows[to]!.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.ed.openToolMenu(null);
        this.renderRoot.querySelector<HTMLElement>(".bar > button:last-child")?.focus();
      }
    };

    protected updated(changed: PropertyValues): void {
      // More opened: the focus goes to its first row, as menus do
      if (changed.has("menu") && this.menu === "phone-more") this.renderRoot.querySelector<HTMLElement>(".more [role^='menuitem']")?.focus();
    }

    renderMore() {
      return html`<div class="veil" @click=${() => this.ed.openToolMenu(null)}></div>
        <div class="more" role="menu" aria-label=${this.t("more")} @keydown=${this.menuKeys}>
          <div class="grab" aria-hidden="true"></div>
          <div class="title" aria-hidden="true">${this.t("more")}</div>
          ${this.moreRows().map(
            (r) => html`${r.id === "settings" ? html`<div class="sep" role="separator"></div>` : nothing}
              <button
                role=${r.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked=${r.checked === undefined ? nothing : r.checked ? "true" : "false"}
                class="row row-${r.id}"
                ?disabled=${!!r.disabled}
                @click=${r.run}
              >
                ${uiIcon(r.icon)}
                <span class="l">${r.label}${r.sub ? html`<small>${r.sub}</small>` : nothing}</span>
                ${r.checked !== undefined ? html`<span class="sw ${r.checked ? "sw-on" : ""}" aria-hidden="true"></span>` : r.onward ? uiIcon("right") : nothing}
              </button>`,
          )}
        </div>`;
    }

    render() {
      const items = this.buttons();
      const stop = this.stop(items);
      return html`${this.menu === "phone-more" ? this.renderMore() : nothing}
        <div class="bar" role="toolbar" aria-label=${this.t("tools")} @keydown=${this.keys}>
          ${items.map(
            (b, i) => html`<button
              class="btn-${b.id} ${b.pressed || b.open ? "on" : ""}"
              tabindex=${i === stop ? 0 : -1}
              aria-pressed=${b.menu || b.pressed === undefined ? nothing : b.pressed ? "true" : "false"}
              aria-haspopup=${b.menu ? "menu" : nothing}
              aria-expanded=${b.menu ? (b.open ? "true" : "false") : nothing}
              ?disabled=${b.disabled}
              @focus=${() => (this._focus = i)}
              @click=${b.run}
            >
              ${uiIcon(b.icon)}<span>${b.label}</span>
            </button>`,
          )}
        </div>`;
    }

    static styles = css`
      :host {
        display: block;
        position: relative;
        z-index: 26;
        color: var(--fp3d-text);
        font-family: var(--fp3d-font, inherit);
      }
      .bar {
        position: relative;
        z-index: 2;
        display: flex;
        height: 60px;
        /* the safe area under the bar (the editor works it out: --fp3d-bar-h is 60 px plus it, at least 16 px) */
        padding-bottom: calc(var(--fp3d-bar-h, 76px) - 60px);
        background: var(--fp3d-chrome-solid, #0d1628);
        border-top: 1px solid var(--fp3d-line, rgba(120, 190, 255, 0.22));
      }
      .bar > button {
        flex: 1 1 0;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 0 2px;
        border: 0;
        background: none;
        color: var(--fp3d-muted, #94a3b8);
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .bar > button > span {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bar > button .fp3d-ui-icon {
        width: 22px;
        height: 22px;
      }
      .bar > button.on {
        color: var(--fp3d-accent, #48cdeb);
      }
      .bar > button:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .bar > button:focus-visible,
      .row:focus-visible {
        outline: 2px solid var(--fp3d-accent, #48cdeb);
        outline-offset: -3px;
      }
      .veil {
        position: fixed;
        inset: 0;
        z-index: 0;
        background: rgba(2, 6, 14, 0.45);
      }
      .more {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 100%;
        z-index: 1;
        max-height: 72vh;
        overflow-y: auto;
        padding-bottom: 6px;
        background: var(--fp3d-chrome-solid, #0d1628);
        border-top: 1px solid var(--fp3d-line, rgba(120, 190, 255, 0.22));
        border-radius: 14px 14px 0 0;
        box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
      }
      .grab {
        width: 40px;
        height: 4px;
        border-radius: 2px;
        background: #475569;
        margin: 8px auto 4px;
      }
      .title {
        padding: 2px 16px 4px;
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fp3d-muted, #94a3b8);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 48px;
        padding: 10px 16px;
        border: 0;
        border-bottom: 1px solid var(--fp3d-line, rgba(120, 190, 255, 0.22));
        background: none;
        color: inherit;
        font: inherit;
        font-size: 14px;
        text-align: left;
        cursor: pointer;
      }
      .row:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .row .fp3d-ui-icon {
        flex: none;
        width: 20px;
        height: 20px;
      }
      .l {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      small {
        color: var(--fp3d-muted, #94a3b8);
        font-size: 12px;
      }
      .sep {
        height: 6px;
      }
      .sw {
        flex: none;
        position: relative;
        width: 36px;
        height: 20px;
        border-radius: 999px;
        background: #334155;
      }
      .sw::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #e2e8f0;
        transition: left 0.15s;
      }
      .sw-on {
        background: var(--fp3d-accent, #48cdeb);
      }
      .sw-on::after {
        left: 18px;
      }
      @media (prefers-reduced-motion: reduce) {
        .sw::after {
          transition: none;
        }
      }
      @media (forced-colors: active) {
        .bar > button.on,
        .sw-on {
          outline: 2px solid CanvasText;
        }
      }
    `;
  }

  kit.defineElement("fp3d-phone-bar", Fp3dPhoneBar);
  return Fp3dPhoneBar;
}

export type Fp3dPhoneBar = InstanceType<ReturnType<typeof definePhoneBar>>;
