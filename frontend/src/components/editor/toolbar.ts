// The toolbar: tools, the settings menu and its links to the Settings page, the hint bar and the help sheet.

import { html, nothing, svg } from "lit";
import { live } from "lit/directives/live.js";
import { modalFocus } from "../../dialog-focus.ts";
import { released } from "../../features.ts";
import type { I18nKey } from "../../i18n.ts";
import type { Floor } from "../../model.ts";
import { activeCard, TOOL_CARDS, type ToolGroup } from "../../tool-cards.ts";
import { LEGEND, SHORTCUTS } from "../../help.ts";
import { hintKey, touchOnly, touchWording, type Tool } from "../../editor-hint.ts";
import { uiIcon, type UiIcon } from "../../ui-icons.ts";
import { startChecklist, type StartStep } from "../../start-checklist.ts";
import { furnitureName } from "../../furniture-names.ts";
import type { ToolPanel } from "../tool-panel.ts";
import { loadToolPanel, need } from "./lazy.ts";
import type { Fp3dEditor } from "../editor.ts";

/** Select several: two items in a dashed frame, drawn like the toolbar's icons (ui-icons.ts). */
const MULTI_ICON = svg`<svg class="fp3d-ui-icon" viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="vertical-align:-0.2em"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><rect x="7" y="7" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/></svg>`;

/** ToolbarPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class ToolbarPart {
  /** The hint bar under the plan (#96, #62): what the current tool does, what can be done with the selection, on a new
   *  plan the next step, and in Doors & windows mode what a tap will do right now. */
  hintText(this: Fp3dEditor): string {
    // while a guide holds what is placed or dragged, the bar says which and how to get free of it (#143)
    // (placing and Doors & windows keep their own sentence: it already says what a click does there)
    const snapped = this.drag ? this._guides.lines?.[0]?.label : undefined;
    // on a touch-only device the hints say taps, not clicks and keys (#228)
    const say = (k: I18nKey, p?: Record<string, string | number>) => touchWording(touchOnly(), k, (key, params) => this.t(key, params), p);
    if (snapped) return say("hint_snapped", { what: snapped });
    const key = this.hintKeyNow();
    // the kind the next tap adds is always named: it is never inherited silently (#63)
    if (key === "hint_place" && this._placing) return say("hint_place", { name: furnitureName(this.hass, this._placing.type) });
    if (key === "hint_opening") return this._openingNote ?? this._openingHover ?? say("hint_opening", { kind: this.t(`preset_${this._openingPreset}` as I18nKey) });
    return say(key);
  }

  /** Which hint string shows now (editor-hint.ts hintKey, #96). */
  hintKeyNow(this: Fp3dEditor): I18nKey {
    const floor = this.floor;
    return hintKey({
      tool: this._tool,
      hasFloor: !!floor,
      rooms: floor?.rooms.length ?? 0,
      placing: !!this._placing,
      selected: this._deviceId ? "device" : this._furnitureId ? "furniture" : this._openingId ? "opening" : this._roomId ? "room" : null,
      wallPick: this._wallPick,
      kerbPick: this._kerbPick,
      fixedHint: this._fixedHint,
      outdoorFree: !!this._outdoorFree,
      jointPlace: !!this._jointPlace,
      pipeMode: !!this._pipeMode,
      poolArea: !!this.poolArea,
      pipeDraft: !!this._pipeDraft,
      poolTech: released("pool"),
    });
  }

  /** Switch to a tool (from the tool menu): a fresh drawing, the sidebar for it. */
  setTool(this: Fp3dEditor, tool: Tool): void {
    const floor = this.floor;
    if (tool !== this._tool) {
      this.clearToolSelection();
      if (tool === "roof" || tool === "energy") this._roomId = null;
    }
    this._tool = tool;
    if (tool !== "select" && tool !== "furniture") this.cancelPlacing();
    this._draft = [];
    this._cursor = null;
    this._notice = null;
    this._rectName = "";
    this._openingNote = null;
    this.openingHoverText = null;
    this._pipeMode = false;
    this._pipeDraft = null;
    // the pool tool works on a pool: the selected one, else the first of the floor
    if (tool === "pool" && this.outdoorArea?.type !== "pool") {
      const first = floor?.outdoor.find((x) => x.type === "pool");
      if (first) this.selectItem("outdoor", first.id);
    }
    // another tool: its sidebar (library, presets, details) unfolds again, even if it was collapsed for the last one
    this.setSideFolded(false);
  }

  /**
   * One toolbar row (#249, drawn for #219): the floor menu, then the tools with an icon and a label – "Select", the
   * drawing tools in menus by what they are for, "Build" (room, wall, door & window, floor opening, roof) and "Outside"
   * (areas, pool), "Furniture" and "Energy" – Wall view (a mode), Undo and Redo, and at the end "3D beside"
   * and More (Fit with garden when something stands outside, Help and shortcuts, Settings for this home). Tools with
   * choices unfold them in the menu; a group's button names the tool in use. The old ⚙ menu is gone: the panels link to
   * their settings, the room panel's "Edit room" opens the editor at the room, and Locating is in Settings › People.
   */
  renderToolBar(this: Fp3dEditor, floor: Floor | undefined, warn: unknown = nothing) {
    const admin = this.isEditor;
    const off = !floor || !admin;
    // Build and Outside open a panel of cards like the furniture library (#402): what is drawn, with a picture
    const groups: { id: ToolGroup; label: string; icon: UiIcon }[] = [
      { id: "build", label: this.t("tool_group_build"), icon: "wall" },
      { id: "outside", label: this.t("tool_group_outside"), icon: "tree" },
    ];
    const active = activeCard({ tool: this._tool, outdoorType: this._outdoorType ?? "lawn", poolShape: this._poolShape ?? "rect", pipeMode: !!this._pipeMode });
    const activeOf = (g: ToolGroup) => TOOL_CARDS.find((c) => c.id === active && c.group === g);
    const close = () => ((this._toolMenu = null), (this._toolOpen = null));
    const plain = (tool: Tool, label: string, icon: UiIcon) =>
      html`<button aria-pressed=${this._tool === tool} ?disabled=${off} @click=${() => (close(), this.setTool(tool))}>${uiIcon(icon)} ${label}</button>`;
    // no Fit in the row (#321): the plan has its own beside the zoom buttons; fitting the garden too is in More, when something stands outside
    return html`<span class="fp3d-tb-sep"></span>
      <div class="fp3d-seg fp3d-seg-menu fp3d-seg-tools" role="group" aria-label=${this.t("tools")}>
        <button aria-pressed=${this._tool === "select"} ?disabled=${!floor} @click=${() => (close(), this.setTool("select"))}>${uiIcon("pointer")} ${this.t("tool_select")}</button>
        <!-- Select several (#398, quick win 12): a mode of the plan, so beside Select rather than in an item's panel -->
        <button class="fp3d-multi-btn" aria-pressed=${this._multiMode} ?disabled=${off} title=${this.t("multi_mode")} aria-label=${this.t("tool_multi")} @click=${() => (close(), this.toggleMultiMode())}>
          ${MULTI_ICON}<span class="fp3d-tool-word"> ${this.t("tool_multi")}</span>
        </button>
        ${groups.map((g) => {
          const card = activeOf(g.id);
          const open = this._toolMenu === g.id;
          // the group's button names the tool in use
          const text = card ? `${g.label}: ${this.t(card.name)}` : g.label;
          return html`<div class="fp3d-menu-wrap">
            <button data-group=${g.id} aria-pressed=${!!card} aria-haspopup="dialog" aria-expanded=${open} ?disabled=${off} @pointerenter=${() => need(loadToolPanel)} @click=${() => this.openToolMenu(open ? null : g.id)}>
              ${uiIcon(g.icon)} ${text} <span class="fp3d-caret">▾</span>
            </button>
            ${open ? html`<div class="fp3d-menu-veil" @click=${close}></div>${this.renderToolPanel(g.id, active)}` : nothing}
          </div>`;
        })}
        ${plain("furniture", this.t("tool_furniture"), "sofa")} ${plain("energy", this.t("tool_energy"), "bolt")}
      </div>
      <span class="fp3d-tb-sep"></span>
      <!-- Wall view is a mode: beside the tools, kept away from the view buttons by undo / redo (#91) -->
      <div class="fp3d-seg fp3d-seg-menu">
        <button aria-pressed=${this._wallPick} title=${this.t("wall_view_open")} @click=${(e: Event) => (close(), this.toggleWallPick(e.currentTarget as HTMLElement))}>${this.t("wall_view")}</button>
      </div>
      <span class="fp3d-tb-sep"></span>
      <div class="fp3d-seg fp3d-seg-menu fp3d-seg-undo">
        <button class="fp3d-undo" ?disabled=${!this._canUndo} @click=${() => this.undo()} title=${`${this.t("undo")} (Ctrl+Z)`} aria-label=${this.t("undo")}>${uiIcon("undo")}<span class="fp3d-tool-word">${this.t("undo")}</span></button>
        <button class="fp3d-undo" ?disabled=${!this._canRedo} @click=${() => this.redo()} title=${`${this.t("redo")} (Ctrl+Y)`} aria-label=${this.t("redo")}>${uiIcon("redo")}<span class="fp3d-tool-word">${this.t("redo")}</span></button>
      </div>
      ${warn}
      <span class="fp3d-tb-grow"></span>
      <div class="fp3d-seg fp3d-seg-menu fp3d-seg-views">
        <button class="fp3d-split-btn" aria-pressed=${this._split} title=${this.t("split_3d_hint")} @click=${() => (close(), this.toggleSplit())}>${uiIcon(this._split ? "split-on" : "split-off")} ${this.t("split_3d")}</button>
      </div>
      ${this.renderMoreMenu(close)}`;
  }

  /** A tool menu opened or closed (null); the focus goes to its first line, as menus do (#249, drawings' notes). */
  openToolMenu(this: Fp3dEditor, id: string | null): void {
    this._toolMenu = id;
    this._toolOpen = null;
    this._floorMenu = false;
    this._viewMenu = false;
    // a tool panel (#402) takes the focus itself: the search, or on a touch screen the card in use
    if (id === "build" || id === "outside")
      void Promise.all([this.updateComplete, customElements.whenDefined("fp3d-tool-panel")]).then(async () => {
        const panel = this.renderRoot.querySelector<ToolPanel>("fp3d-tool-panel");
        await panel?.updateComplete;
        panel?.focusStart();
      });
    else if (id) void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(".fp3d-toolbar .fp3d-menu [role^='menuitem']")?.focus());
  }

  /** The keys of an open toolbar menu: arrows, Home and End move through its lines; Escape closes it, back on its button. */
  menuKeys(this: Fp3dEditor, e: KeyboardEvent): void {
    const menu = e.currentTarget as HTMLElement;
    const items = [...menu.querySelectorAll<HTMLElement>("[role^='menuitem']")];
    const root = menu.getRootNode() as Document | ShadowRoot;
    const at = items.indexOf(root.activeElement as HTMLElement);
    const to = e.key === "ArrowDown" ? (at + 1) % items.length : e.key === "ArrowUp" ? (at - 1 + items.length) % items.length : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
    if (to >= 0 && items.length) {
      e.preventDefault();
      items[to]!.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      const button = menu.closest(".fp3d-menu-wrap")?.querySelector<HTMLElement>(":scope > button");
      this._toolMenu = null;
      this._toolOpen = null;
      this._floorMenu = false;
      button?.focus();
    }
  }

  /** Something stands outside the rooms of the floor (a garden, a path, an item past the walls): "Fit with garden" shows more. */
  hasOutside(this: Fp3dEditor, floor: Floor | undefined): boolean {
    if (!floor) return false;
    if (floor.outdoor.length) return true;
    const pts = floor.rooms.flatMap((r) => r.points);
    if (!pts.length) return floor.furniture.length > 0 || floor.placements.length > 0;
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const out = (x: number, z: number) => x < x0 || x > x1 || z < z0 || z > z1;
    return floor.furniture.some((f) => out(f.x, f.z)) || floor.placements.some((p) => out(p.x, p.z));
  }

  /**
   * More (#249): Fit with garden (only when something stands outside), 3D beside on narrower screens (on wide ones it
   * is in the row), Help and shortcuts, and Settings for this home.
   */
  renderMoreMenu(this: Fp3dEditor, close: () => void) {
    const open = this._toolMenu === "more";
    const item = (icon: UiIcon, label: string, note: string, run: () => void, cls = "") =>
      html`<button role="menuitem" class="fp3d-menu-item ${cls}" @click=${() => (close(), run())}>${uiIcon(icon)} ${label}<span class="fp3d-menu-more">${note}</span></button>`;
    return html`<div class="fp3d-seg fp3d-seg-menu fp3d-seg-more">
      <div class="fp3d-menu-wrap">
        <button class="fp3d-more-btn" aria-haspopup="menu" aria-expanded=${open} @click=${() => this.openToolMenu(open ? null : "more")}>
          ${uiIcon("more")} <span class="fp3d-tool-word">${this.t("more")}</span> <span class="fp3d-caret">${open ? "▴" : "▾"}</span>
        </button>
        ${open
          ? html`<div class="fp3d-menu-veil" @click=${close}></div>
              <div class="fp3d-menu fp3d-menu-right" role="menu" @keydown=${(e: KeyboardEvent) => this.menuKeys(e)}>
                ${this.hasOutside(this.floor) ? item("tree", this.t("fit_all"), "", () => this.fit(true)) : nothing}
                <button role="menuitemcheckbox" aria-checked=${this._split ? "true" : "false"} class="fp3d-menu-item fp3d-more-split" @click=${() => (close(), this.toggleSplit())}>
                  ${uiIcon(this._split ? "split-on" : "split-off")} ${this.t("split_3d")}<span class="fp3d-menu-more">${this._split ? "✓" : ""}</span>
                </button>
                ${item("help", this.t("help_and_shortcuts"), touchOnly() ? "" : "?", () => (this._help = true))}
                <div class="fp3d-menu-sep" role="separator"></div>
                ${item("gear", this.t("settings_home"), "›", () => this.openSettings("general"))}
              </div>`
          : nothing}
      </div>
    </div>`;
  }

  /**
   * Where a house-wide setting went (#139): a line in a tool panel or item form that opens the Settings page at it.
   * `text` says what is there; `icon` leads it (a lock's state).
   */
  renderSettingsLink(this: Fp3dEditor, section: string, id: string | null, text: I18nKey, icon = "⚙") {
    return html`<button class="fp3d-settings-link fp3d-wide" @click=${() => this.openSettings(section, id)}>
      <span>${icon} ${this.t(text)}</span><b>${this.t("settings")} ›</b>
    </button>`;
  }

  /**
   * "Settings for this home" on the floor's page (#249): the links that replace the old ⚙ menu of the toolbar, each
   * opening the Settings page at its place (Locating is in Settings › People now). Editors see the home's; the HA
   * admin's lines (People, Editors) only HA admins.
   */
  renderHomeLinks(this: Fp3dEditor) {
    const editor = this.isEditor;
    const links: { section: string; id: string | null; label: I18nKey; show: boolean }[] = [
      { section: "general", id: null, label: "st_sec_general", show: editor },
      { section: "scene", id: "weather_entity", label: "settings_weather", show: editor },
      { section: "cameras", id: "director.doorbell", label: "card_director", show: editor },
      { section: "voice", id: null, label: "voice", show: true },
      { section: "people", id: "locate", label: "st_sec_people", show: editor && this.isHaAdmin },
      { section: "favourites", id: null, label: "favorites", show: editor },
      { section: "scene", id: "backdrop.kind", label: "backdrop", show: editor },
      { section: "scene", id: "terrain.level", label: "terrain", show: editor },
      { section: "backup", id: null, label: "backup", show: editor },
      { section: "access", id: null, label: "editors_title", show: editor && this.isHaAdmin },
    ];
    return html`<section class="fp3d-home-links">
      <h3>${this.t("settings_home")}</h3>
      <div class="fp3d-home-link-list">
        ${links.filter((l) => l.show).map((l) => html`<button class="fp3d-link fp3d-home-link" @click=${() => this.openSettings(l.section, l.id)}>${this.t(l.label)} ›</button>`)}
      </div>
    </section>`;
  }

  /** Opens the Settings page (#139) at a section and setting; the panel listens. */
  openSettings(this: Fp3dEditor, section: string | null, id: string | null = null): void {
    this.dispatchEvent(new CustomEvent("open-settings", { detail: { section, id }, bubbles: true, composed: true }));
  }

  /** Rooms for the Home Assistant areas of the first free HA floor, from the empty-home checklist (#193). */
  startAreas(this: Fp3dEditor): void {
    let floor = this.floor;
    if (!floor || !this.unplacedAreas(floor).length) {
      const ha = this.freeHaFloors[0];
      if (!ha) return;
      if (floor && !floor.rooms.length && !floor.ha_floor) {
        // the empty floor the person started with becomes that HA floor
        this.change((_, f) => {
          f.ha_floor = ha.floor_id;
          f.name = ha.name;
        });
      } else this.addFloor(ha);
      floor = this.floor;
    }
    if (floor) this.addAreaRooms(floor);
  }

  /** Is there something for "Add rooms from Home Assistant areas" to add? */
  hasStartAreas(this: Fp3dEditor): boolean {
    const floor = this.floor;
    return this.freeHaFloors.length > 0 || (!!floor && this.unplacedAreas(floor).length > 0);
  }

  /** Whether the empty home's checklist is up (the side panel leaves the first-floor call to it, #262). */
  startShowing(this: Fp3dEditor): boolean {
    return this.isEditor && this._tool === "select" && !this._placing && startChecklist(this._doc).show;
  }

  /** The empty home's checklist (#193): replaces the hint pill until the first room exists. */
  renderStart(this: Fp3dEditor) {
    if (!this.startShowing()) return null;
    const list = startChecklist(this._doc);
    const t = this.t.bind(this);
    const hasFloor = this._doc.floors.length > 0;
    const drawRoom = () => {
      if (!this.floor) this.addFloor();
      this.setTool("rect");
    };
    const action: Record<StartStep, ReturnType<typeof html> | typeof nothing> = {
      floor: hasFloor ? nothing : html`<button class="fp3d-btn fp3d-primary" @click=${() => this.addFloor()}>${t("start_floor_btn")}</button>`,
      room: html`<button class="fp3d-btn ${hasFloor ? "fp3d-primary" : ""}" @click=${drawRoom}>${t("start_room_btn")}</button>`,
      furniture: nothing,
    };
    return html`<section class="fp3d-start" aria-label=${t("start_title")}>
      <h3>${t("start_title")}</h3>
      <ol>
        ${list.steps
          .map(
            (s) => html`<li class=${s.done ? "fp3d-start-done" : ""}>
              ${s.done ? html`<span class="fp3d-start-mark" role="img" aria-label=${t("start_done")}>✓</span>` : html`<span class="fp3d-start-mark" aria-hidden="true"></span>`}
              <span class="fp3d-start-text">${t(`start_${s.step}` as I18nKey)}</span>
              ${s.done ? nothing : action[s.step]}
            </li>`,
          )}
      </ol>
      <p class="fp3d-start-or">${t("start_or")}</p>
      <div class="fp3d-start-alt">
        ${this.hasStartAreas() ? html`<button class="fp3d-btn" @click=${() => this.startAreas()}>${t("start_areas")}</button>` : nothing}
        <button class="fp3d-btn" @click=${() => this.dispatchEvent(new CustomEvent("load-sample", { bubbles: true, composed: true }))}>${t("home_sample")}</button>
      </div>
    </section>`;
  }

  /** The hint bar under the plan (#96): the current tool, the selection, or on a new plan the next step. */
  renderHint(this: Fp3dEditor) {
    const start = this.renderStart();
    if (start) return start;
    // a phone (#250): one line, only while nothing is chosen and the sheet is down (a tool's hint is in the sheet's
    // title row); ✕ hides it for good, Help in More brings it back
    if (this._phone && !this.showsPhoneHint()) return nothing;
    const key = this.hintKeyNow();
    const first = key === "hint_empty" || key === "hint_first_room";
    const warn = this._fixedHint || (this._tool === "opening" && !!this._openingNote);
    // the tooltip names the key that turns snapping off while dragging (#143)
    return html`<div class="fp3d-hint ${warn ? "fp3d-hint-fixed" : ""} ${first ? "fp3d-hint-first" : ""}" role="status" aria-live="polite" title=${touchOnly() ? nothing : this.t("snap_off_tip")}>
      <span class="fp3d-hint-text" .textContent=${live(this.hintText())}></span>
      ${this._phone
        ? html`<button class="fp3d-hint-help fp3d-hint-hide" aria-label=${this.t("hint_hide")} title=${this.t("hint_hide")} @click=${() => this.setHintOff(true)}>${uiIcon("x")}</button>`
        : html`<button class="fp3d-hint-help" title=${this.t("help_open")} @click=${() => (this._help = true)}>? ${this.t("hint_help")}</button>`}
    </div>`;
  }

  /** The '?' help (#95): the shortcuts and the plan's marks, both from the tables in help.ts. */
  renderHelp(this: Fp3dEditor) {
    if (!this._help) return nothing;
    const close = () => (this._help = false);
    const mark = (m: (typeof LEGEND)[number]["mark"]) => {
      const shape =
        m === "swing"
          ? svg`<path class="fp3d-help-swing" d="M4 22L4 4A18 18 0 0 1 22 22" />`
          : m === "track"
            ? svg`<path class="fp3d-help-track" d="M4 20L4 4M22 20L22 4" />`
            : m === "guide"
              ? svg`<line class="fp3d-guide" x1="2" y1="13" x2="24" y2="13" />`
              : m === "snap"
                ? svg`<circle class="fp3d-snap" cx="13" cy="13" r="8" />`
                : m === "ghost"
                  ? svg`<rect class="fp3d-ghost" x="3" y="5" width="20" height="16" />`
                  : svg`<rect class="fp3d-help-sel" x="3" y="5" width="20" height="16" rx="2" />`;
      return html`<svg class="fp3d-help-mark" viewBox="0 0 26 26" aria-hidden="true">${shape}</svg>`;
    };
    return html`<div class="fp3d-dialog-veil" @click=${(e: Event) => e.target === e.currentTarget && close()}>
      <div class="fp3d-dialog fp3d-help-overlay" role="dialog" aria-modal="true" aria-label=${this.t("help_overlay_title")} tabindex="-1" ${modalFocus()}>
        <div class="fp3d-dialog-head">
          <h3>${this.t("help_overlay_title")}</h3>
          <button class="fp3d-btn" aria-label=${this.t("close")} @click=${close}>✕</button>
        </div>
        <div class="fp3d-dialog-body">
          ${touchOnly()
            ? nothing
            : html`<h4>${this.t("help_shortcuts")}</h4>
                <dl class="fp3d-help-keys">
                  ${SHORTCUTS.map((k) => html`<dt>${k.keys.map((key, i) => html`${i ? " / " : ""}<kbd>${key}</kbd>`)}</dt><dd>${this.t(k.text)}</dd>`)}
                </dl>`}
          <h4>${this.t("help_legend")}</h4>
          <ul class="fp3d-help-legend">
            ${LEGEND.map((l) => html`<li>${mark(l.mark)}<span>${this.t(l.text)}</span></li>`)}
          </ul>
        </div>
      </div>
    </div>`;
  }
}
