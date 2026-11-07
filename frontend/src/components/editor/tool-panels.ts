// The toolbar's Build and Outside panels (#402): the cards element (components/tool-panel.ts) in the toolbar's menu
// place, and what a card does when it is picked.

import { html } from "lit";
import { touchOnly } from "../../editor-hint.ts";
import type { I18nKey } from "../../i18n.ts";
import { cardsOf, TOOL_CARDS, type ToolCard, type ToolGroup } from "../../tool-cards.ts";
import { loadToolPanel, need } from "./lazy.ts";
import type { Fp3dEditor } from "../editor.ts";

/** The cards per panel and pipe rule, made once: the same array is no new property for the panel element. */
const CARDS = new Map<string, ToolCard[]>();
const NO_AREAS: never[] = [];
/** One `t` per editor, for the same reason. */
const TEXTS = new WeakMap<Fp3dEditor, (k: I18nKey, p?: Record<string, string | number>) => string>();

/** ToolPanelPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class ToolPanelPart {
  /** The open Build or Outside panel; on a phone a sheet above the bottom bar. */
  renderToolPanel(this: Fp3dEditor, group: ToolGroup, active: string | null) {
    const pipes = !!this.pipeRules;
    const key = `${group}:${pipes}`;
    const cards = CARDS.get(key) ?? CARDS.set(key, cardsOf(group, pipes)).get(key)!;
    need(loadToolPanel);
    let t = TEXTS.get(this);
    if (!t) TEXTS.set(this, (t = (k, p) => this.t(k, p)));
    return html`<fp3d-tool-panel
      class="fp3d-tool-panel"
      ?sheet=${this._phone}
      .group=${group}
      .cards=${cards}
      .active=${active}
      .free=${this._areaFree}
      .touch=${touchOnly()}
      .t=${t}
      .areas=${group === "outside" ? this.outdoorRows() : NO_AREAS}
      @area-go=${(e: CustomEvent<{ floor: string; id: string }>) => this.goToOutdoor(e.detail.floor, e.detail.id)}
      @tool-pick=${(e: CustomEvent<{ id: string }>) => this.pickToolCard(e.detail.id)}
      @tool-free=${(e: CustomEvent<{ free: boolean }>) => this.setAreaFree(e.detail.free)}
      @tool-close=${(e: CustomEvent<{ refocus: boolean }>) => this.closeToolPanel(e.detail.refocus)}
    ></fp3d-tool-panel>`;
  }

  /** A card picked: its tool with its kind or shape; the panel closes. */
  pickToolCard(this: Fp3dEditor, id: string): void {
    const card = TOOL_CARDS.find((c) => c.id === id);
    if (!card) return;
    this.closeToolPanel(true);
    this.setTool(card.tool);
    if (card.outdoor) {
      this._outdoorType = card.outdoor;
      this._outdoorFree = this._areaFree;
    }
    if (card.pool) {
      this._poolShape = card.pool;
      this._outdoorFree = card.pool === "free";
    }
    if (card.pipes) this._pipeMode = true;
    this._draft = [];
  }

  /** The Outside panel's shape choice: areas by their corners, or as a dragged rectangle (the area tool in use follows). */
  setAreaFree(this: Fp3dEditor, free: boolean): void {
    this._areaFree = free;
    if (this._tool === "outdoor") {
      this._outdoorFree = free;
      this._draft = [];
    }
  }

  /** Closes the open panel; `refocus`: the keyboard goes back to its toolbar button (not on a phone: the row is hidden). */
  closeToolPanel(this: Fp3dEditor, refocus: boolean): void {
    const group = this._toolMenu;
    this._toolMenu = null;
    this._toolOpen = null;
    if (refocus && group && !this._phone) void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`.fp3d-toolbar [data-group="${group}"]`)?.focus());
  }
}
