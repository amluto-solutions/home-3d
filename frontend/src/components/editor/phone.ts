// The phone editor (#250, drawings signed off on #219): on a phone-wide screen the toolbar row gives way to a bottom
// bar (Select, Build, Furniture, Undo, Redo, More; components/editor/phone-bar.ts, a lazy chunk of its own), the floor
// menu floats as a chip at the top left, the side panel becomes a details sheet (peek, half and full heights, with
// Details and Close buttons so it never has to be dragged), and the hint shows on one line only while nothing is
// chosen. Every tool and panel of the desktop stays reachable (the owner's decision): the Build and Outside menus open
// as sheets above the bar, More holds the rest, and the sheet shows the very same side panel. Android's back gesture
// closes the sheet, then a menu (back-stack.ts).

import { html, nothing } from "lit";
import { COMPACT_MAX_PX, COMPACT_MEDIA, PHONE_MEDIA, SHORT_MEDIA } from "../../phone.ts";
import { polygonArea, type Floor, type Vec2 } from "../../model.ts";
import { uiIcon } from "../../ui-icons.ts";
import { itemProfile } from "../../item-profile.ts";
import type { I18nKey } from "../../i18n.ts";
import type { Tool } from "../../editor-hint.ts";
import { loadPhoneBar, need } from "./lazy.ts";
import { collectSheetHead, takeSheetHead } from "./panel-head.ts";
import type { Fp3dEditor } from "../editor.ts";

/** How far the details sheet is pulled up: shut, its title row only, half the plan, or nearly all of it. */
export type SheetHeight = "closed" | "peek" | "half" | "full";

const GROW: Record<SheetHeight, SheetHeight> = { closed: "peek", peek: "half", half: "full", full: "peek" };
/** Text fields that bring up the on-screen keyboard (a select, a switch or a slider do not). */
const TYPED = /^(?:text|search|number|email|url|tel|password|)$/;

/** PhonePart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class PhonePart {
  /** Follows the phone width (the same rule as the CSS, phone.ts), the keyboard and drags; off when the editor leaves. */
  watchPhone(this: Fp3dEditor, on: boolean): void {
    const w = this.phoneWatch;
    if (!on) {
      if (!w) return;
      for (const m of w.media) m?.removeEventListener?.("change", w.onMedia);
      this.removeEventListener("focusin", w.onFocus);
      this.removeEventListener("focusout", w.onFocus);
      this.removeEventListener("pointermove", w.onPointer);
      this.removeEventListener("pointerup", w.onPointer);
      this.removeEventListener("pointercancel", w.onPointer);
      this.phoneWatch = null;
      this.backLayers.closeAll();
      return;
    }
    if (w) return;
    // a tablet held upright (compact and portrait) and a phone held sideways (short) get the sheet too, under their
    // toolbar row: the plan keeps the screen, nothing scrolls the page
    const media =
      typeof matchMedia === "function" ? [matchMedia(PHONE_MEDIA), matchMedia(`${COMPACT_MEDIA} and (orientation: portrait)`), matchMedia(`(max-width: ${COMPACT_MAX_PX}px) and ${SHORT_MEDIA}`)] : [];
    const onMedia = () => {
      const was = this._phone;
      this._phone = !!media[0]?.matches;
      // the 3D view covers the plan on a phone (#263): a phone's editor opens on the plan, whatever the desktop kept
      if (this._phone && !was) this._split = false;
      this._sheeted = media.some((m) => m.matches);
    };
    const onFocus = (e: Event) => {
      const el = e.type === "focusin" ? (e.composedPath()[0] as HTMLElement | undefined) : undefined;
      this._typing = !!el && (el.tagName === "TEXTAREA" || el.isContentEditable || (el.tagName === "INPUT" && TYPED.test((el as HTMLInputElement).type)));
    };
    // the bar steps aside while something is moved on the plan (not while the plan itself is moved)
    const onPointer = (e: Event) => {
      const d = this.drag;
      const moving = e.type === "pointermove" && !!d && d.kind !== "pan" && (!("moved" in d) || d.moved);
      if (moving !== this.hasAttribute("data-dragging")) this.toggleAttribute("data-dragging", moving);
    };
    for (const m of media) m.addEventListener?.("change", onMedia);
    this.addEventListener("focusin", onFocus);
    this.addEventListener("focusout", onFocus);
    this.addEventListener("pointermove", onPointer);
    this.addEventListener("pointerup", onPointer);
    this.addEventListener("pointercancel", onPointer);
    this.phoneWatch = { media, onMedia, onFocus, onPointer };
    onMedia();
  }

  /** The selection the sheet is about (its id), whatever kind it is. */
  sheetSelection(this: Fp3dEditor): string | null {
    return this._furnitureId ?? this._openingId ?? this._deviceId ?? this._outdoorId ?? this._wallId ?? this._roomId ?? this._roofId ?? this._solarId ?? this._roofWinId ?? this._pipeId ?? this._cableId ?? null;
  }

  /** What the sheet shows: a tool other than Select (with its selection), or a selection; null: nothing. */
  sheetKey(this: Fp3dEditor): string | null {
    const sel = this.sheetSelection();
    return this._tool === "select" && !sel ? null : `${this._tool}|${sel ?? ""}`;
  }

  /**
   * Keeps the sheet in step with the selection (from willUpdate): something chosen, or another tool, pulls a shut sheet
   * up to its title row (the furniture library to half); nothing chosen shuts it, unless the floor's settings were
   * asked for. A sheet already up keeps its height; one shut by hand stays shut while only its tool's selection goes.
   */
  syncSheet(this: Fp3dEditor): void {
    if (!this._sheeted) return;
    const key = this.sheetKey();
    if (key === this.sheetFor) return;
    const before = this.sheetFor;
    this.sheetFor = key;
    if (!key) {
      if (!this.floorSheet) this._sheet = "closed";
      return;
    }
    this.floorSheet = false;
    if (this._sheet !== "closed") return;
    const sel = this.sheetSelection();
    const sameTool = before?.split("|")[0] === key.split("|")[0];
    if (!sel && sameTool) return;
    // peek, also for the library: it tells you to tap the plan, so the plan stays in view (#262)
    this._sheet = "peek";
  }

  /** Opens the sheet at a height (the floor menu's "Floor settings", a bar tool pressed again). */
  showSheet(this: Fp3dEditor, height: SheetHeight): void {
    if (!this.sheetKey()) this.floorSheet = true;
    this._sheet = height;
  }

  /** Close: the sheet goes down and what it showed is let go (the tool stays). */
  closeSheet(this: Fp3dEditor): void {
    this._sheet = "closed";
    this.floorSheet = false;
    this.clearToolSelection();
    this._pipeId = null;
    this._roomId = null;
  }

  /** A bar button picked a tool: as the toolbar does, and the tool's sheet comes up even if it was shut by hand. */
  phoneTool(this: Fp3dEditor, tool: Tool): void {
    this.openToolMenu(null);
    this.setTool(tool);
    if (this._sheet === "closed" && tool !== "select") this.showSheet("peek");
  }

  /** Select several on or off (#263, the phone's More): on, the plan's taps add items, so the select tool comes first. */
  toggleMultiMode(this: Fp3dEditor): void {
    const on = !this._multiMode;
    if (on && this._tool !== "select" && this._tool !== "furniture") this.setTool("select");
    this._multiMode = on;
  }

  /** The sheet's title row: what is chosen (name, kind, a room's area), else the tool and its hint, else the floor. */
  sheetHead(this: Fp3dEditor, floor: Floor | undefined): { title: string; kind: string; sub: string } {
    const f = this.furnitureItem;
    const room = this.room;
    // several items chosen: the sheet is about all of them, not about the one the panel happens to hold (#261)
    const many = this.selection().length;
    if (many > 1 && f) return { title: this._multi.length ? this.t("multi_title", { n: many }) : `▣ ${this.t("block_title")}`, kind: this._multi.length ? "" : String(many), sub: "" };
    if (f) return { title: this.itemTitle(f), kind: this.t(`item_kind_${itemProfile(f.type).kind}` as I18nKey), sub: "" };
    // the library is what the Furniture tool shows, whatever lies under the last tap (#262)
    if (this._tool === "furniture" && !f) return { title: this.t("tool_furniture"), kind: room?.name ?? "", sub: this.hintText() };
    if (this.opening) return { title: this.t("sheet_opening"), kind: "", sub: "" };
    if (this.device) {
      const id = this.device.entity_id;
      return { title: String(this.hass?.states?.[id]?.attributes?.friendly_name ?? id), kind: this.t("device"), sub: "" };
    }
    const out = this.outdoorArea;
    if (out) return { title: out.name || this.t(`out_${out.type}` as I18nKey), kind: this.t("sheet_outdoor"), sub: "" };
    if (this.freeWall) return { title: this.t("free_wall"), kind: "", sub: "" };
    if (this._tool !== "select") return { title: this.t(`tool_${this._tool}` as I18nKey), kind: room?.name ?? "", sub: this.hintText() };
    if (room) return { title: room.name, kind: this.t("room"), sub: room.points.length >= 3 ? this.area(polygonArea(room.points)) : "" };
    return { title: floor?.name ?? this.t("floors"), kind: this.t("floor"), sub: "" };
  }

  /**
   * The details sheet (a named region): the grab bar (a button: peek → half → full → peek; a swipe on the head does the
   * same), the title row with Close, and under it the side panel as the desktop draws it. Shut: nothing. A panel with
   * its own header (#409) has that header as the title row (#420, CONS-9): name, kind, lock, "⋯" and Close in one
   * row, the name once. Several items chosen keep the sheet's own title ("2 items selected").
   */
  renderSheet(this: Fp3dEditor, floor: Floor | undefined) {
    const at = this._sheet;
    if (at === "closed") return nothing;
    const head = this.sheetHead(floor);
    const grow = () => (this._sheet = GROW[at]);
    // the panel's header is the title row when the sheet is about one chosen thing (or the floor); a drawing tool keeps
    // its name and hint, several items their count
    const chosen = !!(this.furnitureItem || this.opening || this.device || this.outdoorArea || this.freeWall);
    const ownHead = !(this.selection().length > 1 && this.furnitureItem) && (chosen || this._tool === "select");
    if (ownHead) collectSheetHead(this);
    const body = this.renderSide(floor);
    const own = ownHead ? takeSheetHead(this) : null;
    const close = html`<button class="fp3d-btn fp3d-sheet-close" aria-label=${this.t("close")} title=${this.t("close")} @click=${() => this.closeSheet()}>${uiIcon("x")}</button>`;
    const size: I18nKey = at === "peek" ? "details" : at === "half" ? "sheet_taller" : "sheet_smaller";
    // a swipe on the title row: up grows the sheet, down shrinks it (the buttons do the same without dragging)
    const down = (e: PointerEvent) => (this.sheetSwipe = e.clientY);
    const up = (e: PointerEvent) => {
      const from = this.sheetSwipe;
      this.sheetSwipe = null;
      if (from === null) return;
      const dy = e.clientY - from;
      if (dy < -40) this._sheet = at === "peek" ? "half" : "full";
      else if (dy > 40) this._sheet = at === "full" ? "half" : "peek";
    };
    return html`<aside class="fp3d-side fp3d-sheet" data-sheet=${at} role="region" aria-label=${head.title}>
      <div class="fp3d-sheet-head" @pointerdown=${down} @pointerup=${up} @pointercancel=${() => (this.sheetSwipe = null)}>
        <button type="button" class="fp3d-sheet-grab" aria-label=${this.t(size)} aria-expanded=${at === "peek" ? "false" : "true"} @click=${grow}></button>
        ${own
          ? html`<div class="fp3d-sheet-row fp3d-sheet-own">${own}${close}</div>`
          : html`<div class="fp3d-sheet-row">
              <div class="fp3d-sheet-title">
                <b>${head.title}</b>${head.kind ? html` <span class="fp3d-sub">· ${head.kind}</span>` : nothing}${head.sub && this._tool === "select" ? html` <span class="fp3d-sub">· ${head.sub}</span>` : nothing}
                ${head.sub && this._tool !== "select" ? html`<span class="fp3d-sheet-hint fp3d-hint-text">${head.sub}</span>` : nothing}
              </div>
              ${close}
            </div>`}
      </div>
      <div class="fp3d-sheet-body">${body}</div>
    </aside>`;
  }

  /** The bottom bar (a lazy chunk: only phones load it); its properties are what it shows. */
  renderPhoneBar(this: Fp3dEditor, floor: Floor | undefined) {
    need(loadPhoneBar);
    const more = this._toolMenu === "phone-more";
    return html`<fp3d-phone-bar
      .ed=${this}
      .tool=${this._tool}
      .menu=${this._toolMenu}
      .canUndo=${this._canUndo}
      .canRedo=${this._canRedo}
      .split=${this._split}
      .wallPick=${this._wallPick}
      .hasFloor=${!!floor}
      .editable=${this.isEditor}
      .outside=${more && this.hasOutside(floor)}
      .multi=${this._multiMode}
      .lang=${this.hass?.language ?? "en"}
    ></fp3d-phone-bar>`;
  }

  /** The hint on a phone (#250): one line, only while nothing is chosen and the sheet is down; it can be hidden. */
  showsPhoneHint(this: Fp3dEditor): boolean {
    return !this._hintOff && this._sheet === "closed" && !this.sheetSelection();
  }

  /** Hides the phone's hint for good (remembered on this device), or brings it back (Help does). */
  setHintOff(this: Fp3dEditor, off: boolean): void {
    this._hintOff = off;
    try {
      localStorage.setItem("home3d.hintOff", off ? "1" : "0");
    } catch {
      // no storage: for this visit
    }
  }

  /** The point of the selection on the plan (its middle), to keep it clear of the sheet. */
  selectionPoint(this: Fp3dEditor): Vec2 | null {
    const f = this.furnitureItem;
    if (f) return [f.x, f.z];
    const d = this.device;
    if (d) return [d.x, d.z];
    const pts = this.outdoorArea?.points ?? this.room?.points;
    if (!pts?.length) return null;
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  }

  /**
   * After a render on a phone (from updated): the open sheet, menus and overlays get their Back entries, and the plan moves so the
   * selection stays above the sheet (the drawings' note: it pans, it never hides under it).
   */
  afterPhoneRender(this: Fp3dEditor, changed: Map<PropertyKey, unknown>): void {
    const phone = this._sheeted;
    this.backLayers.sync("sheet", phone && this._sheet !== "closed", () => this.closeSheet());
    this.backLayers.sync("menu", phone && !!this._toolMenu, () => {
      this._toolMenu = null;
      this._toolOpen = null;
      this._floorMenu = false;
    });
    this.backLayers.sync("help", phone && this._help, () => (this._help = false));
    // the long-press menu, the wall view and the rack sheet are over the plan as well
    this.backLayers.sync("ctx", phone && !!this._ctx, () => (this._ctx = null));
    this.backLayers.sync("wall", phone && !!this._wallView, () => (this._wallView = null));
    this.backLayers.sync("rack", phone && !!this._rackSheet, () => (this._rackSheet = null));
    // the full-screen 3D view of a phone (#263): Back goes to the 2D plan, Forward opens it again
    this.backLayers.sync("3d", this._phone && this._split, () => (this._split = false), () => (this._split = true));
    if (!phone || this._sheet === "closed") return;
    const moved = changed.has("_sheet") || changed.has("_roomId") || changed.has("_furnitureId") || changed.has("_deviceId") || changed.has("_outdoorId");
    if (!moved) return;
    const sheet = this.renderRoot.querySelector<HTMLElement>(".fp3d-sheet");
    const body = sheet?.querySelector<HTMLElement>(".fp3d-sheet-body");
    if (body && !changed.has("_sheet")) body.scrollTop = 0;
    const p = this.selectionPoint();
    if (!sheet || !p) return;
    const clear = this._size.h - sheet.offsetHeight;
    const [, sy] = this.toScreen(p);
    if (clear > 80 && (sy > clear - 24 || sy < 56)) this.panBy(0, clear / 2 - sy);
  }
}
