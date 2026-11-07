// Selection: choosing items (plan, lists, 3D), multi selection and blocks, locking (fixed items), the context
// menu, copy and paste (#74), asking before deleting.

import { html, nothing, svg } from "lit";
import { firmHit, itemsAt, minHitPx } from "../../geometry/pick.ts";
import { itemsByRoom } from "../../item-list.ts";
import { furnitureFootprint } from "../../model.ts";
import { clipSize, copyItems, pasteClip, withKeys, type ItemClip } from "../../clipboard.ts";
import { touchOnly, touchWording } from "../../editor-hint.ts";
import { isFixed, uid, type Floor, type Vec2 } from "../../model.ts";
import { askConfirm, tell } from "../../ask.ts";
import { loadAlign } from "../../load-align.ts";
import { furnitureName } from "../../furniture-names.ts";
import { type FixKind, round } from "./helpers.ts";
import { canRemovePoint, chosenPoint, choosePoint, pointOf, removePoint } from "./points.ts";
import { refocusItemBar, renderItemBar } from "./item-bar.ts";
import { forgetPanelUi } from "./item-sections.ts";
import type { PanelAction } from "./panel-head.ts";
import type { Fp3dEditor } from "../editor.ts";

/** One action on an item from the plan (#398): the right-click menu shows `icon` + `text` (or `label`), the toolbar an icon named `label`. */
export interface ItemAct {
  key: string;
  icon: string;
  label: string;
  text?: string;
  title?: string;
  disabled?: boolean;
  danger?: boolean;
  pressed?: boolean;
  /** false: on the toolbar only (and in its "⋯" on a narrow plan) */
  menu?: boolean;
  run: () => void;
}

/** The editor's item clipboard (#74): in memory, shared by every editor on the page, kept while the Editor tab is closed. */
let clipboard: ItemClip | null = null;

/** SelectionPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
/** The actions the floating toolbar shows as its own buttons (#398); its "⋯" lists only the others. */
const ON_BAR: ReadonlySet<string> = new Set(["rotate", "duplicate", "lock", "delete"]);

export class SelectionPart {
  /** The item of a fixable kind on a floor. */
  fixItem(this: Fp3dEditor, floor: Floor | undefined, kind: FixKind, id: string): object | undefined {
    if (!floor) return undefined;
    switch (kind) {
      case "room":
        return floor.rooms.find((r) => r.id === id);
      case "opening":
        return floor.openings.find((o) => o.id === id);
      case "furniture":
        return floor.furniture.find((m) => m.id === id);
      case "device":
        return floor.placements.find((p) => p.entity_id === id);
      case "wall":
        return (floor.walls ?? []).find((w) => w.id === id);
      case "outdoor":
        return floor.outdoor.find((a) => a.id === id);
    }
  }

  /** Fixed by itself, or (rooms, walls, doors, windows, outdoor areas) by the plan lock. */
  isFixedItem(this: Fp3dEditor, kind: FixKind, id: string): boolean {
    return isFixed(this.fixItem(this.floor, kind, id), kind !== "furniture" && kind !== "device", this._doc.settings);
  }

  toggleFixed(this: Fp3dEditor, kind: FixKind, id: string): void {
    // rooms, walls, doors, windows and outdoor areas follow the plan lock alone
    if (!this.isEditor || (kind !== "furniture" && kind !== "device")) return;
    const next = !this.isFixedItem(kind, id);
    // released: the "fixed, release first" hint has done its job
    if (!next) this._fixedHint = false;
    this.change((_, floor) => {
      const item = this.fixItem(floor, kind, id) as { locked?: boolean | null } | undefined;
      if (item) item.locked = next;
    });
  }

  toggleLockPlan(this: Fp3dEditor): void {
    if (!this.isEditor) return;
    if (this._doc.settings.lock_plan) this._fixedHint = false;
    this.change((doc) => (doc.settings.lock_plan = !doc.settings.lock_plan));
  }

  /** A fixed item is only deleted after asking. */
  async confirmFixedDelete(this: Fp3dEditor, kind: FixKind, id: string): Promise<boolean> {
    return !this.isFixedItem(kind, id) || (await this.ask(this.t("fixed_delete_confirm")));
  }

  /** A yes / no question in the app's own dialog (#59); `ok` names what yes does, a warning unless `danger` is false. */
  ask(this: Fp3dEditor, text: string, ok: string = this.t("delete"), danger = true): Promise<boolean> {
    return askConfirm(text, { ok, cancel: this.t("cancel"), danger });
  }

  /** A message in the app's own dialog (#59). */
  tell(this: Fp3dEditor, text: string): Promise<void> {
    return tell(text, { ok: this.t("ask_ok") });
  }

  /** Select the item under a plan point and open its menu. */
  /**
   * The item a plan press lands on (#72): its drawn shape grown to a 24 px target (44 px on touch), smallest item
   * first. A press on a room corner or wall-end handle is never an item.
   */
  pickItem(this: Fp3dEditor, target: Element, world: Vec2, pointerType: string): string | null {
    if (!this.floor || target.closest("[data-vertex], [data-mid], [data-wall-end], [data-out-box], [data-out-vertex], [data-out-mid], [data-roof-vertex], [data-roof-mid]")) return null;
    return this.itemHits(target, world, pointerType)[0] ?? target.closest("[data-furniture]")?.getAttribute("data-furniture") ?? null;
  }

  /** The shown items under a plan press, best first (#72); none on a room corner or wall-end handle. */
  itemHits(this: Fp3dEditor, target: Element, world: Vec2, pointerType: string): string[] {
    if (!this.floor || target.closest("[data-vertex], [data-mid], [data-wall-end], [data-out-box], [data-out-vertex], [data-out-mid], [data-roof-vertex], [data-roof-mid]")) return [];
    const hidden = this._hiddenItems;
    return itemsAt(this.floor.furniture, world, this._view.scale, minHitPx(pointerType), hidden.length ? (f) => hidden.includes(f.id) : undefined);
  }

  /** Whether a shown item is pressed on its shape (a thin one's grown depth included, #132). */
  firmItemAt(this: Fp3dEditor, world: Vec2, pointerType: string): boolean {
    const hidden = this._hiddenItems;
    return (this.floor?.furniture ?? []).some((f) => !hidden.includes(f.id) && firmHit(f, world, this._view.scale, minHitPx(pointerType)));
  }

  /** Hide an item in this editor's plan, or show it again (#75); a hidden selected item is let go. */
  toggleItemHidden(this: Fp3dEditor, id: string): void {
    const hidden = this._hiddenItems;
    this._hiddenItems = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
    if (this._hiddenItems.includes(id) && (this.selection().includes(id) || this._outdoorId === id)) this.selectItem("room", this._roomId);
  }

  /** The items Tab cycles through (#75): the shown ones in the selected item's room, else on the floor. */
  tabItems(this: Fp3dEditor): string[] {
    const floor = this.floor;
    const f = this.furnitureItem;
    if (!floor || !f) return [];
    const shown = floor.furniture.filter((m) => !this._hiddenItems.includes(m.id));
    const groups = itemsByRoom(floor.rooms, shown);
    for (const list of groups.values()) if (list.some((m) => m.id === f.id)) return list.map((m) => m.id);
    return shown.map((m) => m.id);
  }

  /** An item chosen in the items list (#75): selected, and brought into view only if it is out of view. */
  selectFromList(this: Fp3dEditor, id: string): void {
    const f = this.floor?.furniture.find((m) => m.id === id);
    if (!f) return;
    this.selectItem("furniture", id);
    this._single = !!f.group;
    this.showPoint(f.x, f.z);
  }

  /** Delete one item from the items list (#75): that row only, even when it is part of a block. */
  async deleteFromList(this: Fp3dEditor, id: string): Promise<void> {
    if (!this.floor?.furniture.some((m) => m.id === id)) return;
    this.selectItem("furniture", id);
    this._single = true;
    // asks first for a fixed item, in the app's own dialog (#59)
    await this.deleteFurniture();
  }

  openContext(this: Fp3dEditor, target: Element, local: [number, number], pointerType = "mouse"): void {
    if (!this.isEditor || !this.floor) return;
    const world = this.toWorld(...local);
    // a point of the selected outline (#395): its own menu, Remove point
    const point = pointOf(target, this._roomId);
    if (point) {
      choosePoint(this, point);
      this._ctx = { x: local[0], y: local[1], kind: point.kind === "out" ? "outdoor" : "room", id: point.id, point };
      return;
    }
    const attr = (sel: string) => target.closest(`[${sel}]`)?.getAttribute(sel) ?? null;
    let hit: [FixKind, string] | null = null;
    const device = attr("data-device");
    const opening = attr("data-opening");
    const furniture = this.pickItem(target, world, pointerType);
    const wall = attr("data-free-wall");
    const outdoor = attr("data-outdoor") ? (this.outdoorAt(world) ?? attr("data-outdoor")) : null;
    const room = attr("data-room") ?? this.roomAt(world);
    if (device) hit = ["device", device];
    else if (opening) hit = ["opening", opening];
    else if (furniture) hit = ["furniture", furniture];
    else if (wall) hit = ["wall", wall];
    else if (outdoor && !room) hit = ["outdoor", outdoor];
    else if (room) hit = ["room", room];
    if (!hit) {
      this._ctx = null;
      return;
    }
    const [kind, id] = hit;
    this.selectItem(kind, id);
    if (kind === "opening" || kind === "furniture") this._roomId = this._roomId ?? room;
    this._ctx = { x: local[0], y: local[1], kind, id };
  }

  async deleteItem(this: Fp3dEditor, kind: FixKind, id: string): Promise<void> {
    if (kind === "device") {
      if (!(await this.confirmFixedDelete(kind, id))) return;
      this.removeDevice(id);
      this._deviceId = null;
      return;
    }
    // the delete methods ask themselves for fixed items
    if (kind === "room") this.deleteRoom();
    else if (kind === "opening") this.deleteOpening();
    else if (kind === "furniture") this.deleteFurniture();
    else if (kind === "wall") this.deleteFreeWall();
    else this.deleteOutdoor();
  }

  /**
   * What can be done to an item from the plan: the right-click menu's actions and the floating toolbar's (#398), one
   * list so the two never differ. `icon` is the menu's glyph; `menu: false` keeps an action off the right-click menu.
   */
  itemActions(this: Fp3dEditor, kind: FixKind, id: string): ItemAct[] {
    const fixed = this.isFixedItem(kind, id);
    const acts: ItemAct[] = [];
    if (kind === "furniture" || kind === "device")
      // a constant name with its state as "pressed" for the toolbar (#398); the menu keeps its words
      // one constant name everywhere, the state as "pressed" (#396, #398)
      acts.push({ key: "lock", icon: fixed ? "🔒" : "🔓", label: this.t("bar_lock"), text: this.t("lock_position"), title: withKeys(this.t("fix_hint"), ["L"]), pressed: fixed, run: () => this.toggleFixed(kind, id) });
    else acts.push({ key: "lock_plan", icon: this._doc.settings.lock_plan ? "🔓" : "🔒", label: this.t(this._doc.settings.lock_plan ? "plan_unlock" : "plan_lock"), title: this.t("lock_plan_hint"), run: () => this.toggleLockPlan() });
    if (kind === "room") acts.push({ key: "duplicate", icon: "⧉", label: this.t("duplicate"), run: () => this.duplicateRoom() });
    if (kind === "room" && clipboard) acts.push({ key: "paste", icon: "⎘", label: this.t("paste_items_n", { n: clipSize(clipboard) }), title: withKeys(this.t("paste_items"), ["Ctrl+V"]), run: () => this.pasteClipboard() });
    // an outdoor area copies like an item (#400): Duplicate here, Copy for another place, floor or home
    if (kind === "outdoor")
      acts.push(
        { key: "duplicate", icon: "⧉", label: this.t("duplicate"), run: () => this.duplicateOutdoor() },
        { key: "copy", icon: "⎘", label: this.t("copy_items"), title: withKeys(this.t("copy_items"), ["Ctrl+C"]), run: () => this.copySelection() },
      );
    if (kind === "furniture") {
      acts.push(
        { key: "duplicate", icon: "⧉", label: this.t("duplicate"), title: withKeys(this.t("duplicate"), ["Ctrl+D"]), run: () => this.duplicateFurniture() },
        { key: "copy", icon: "⎘", label: this.t("copy_items"), title: withKeys(this.t("copy_items"), ["Ctrl+C"]), run: () => this.copySelection() },
        { key: "rotate_left", icon: "↺", label: this.t("bar_turn_left"), title: withKeys(this.t("bar_turn_left"), ["Shift+R"]), disabled: fixed, menu: false, run: () => this.rotateFurniture(-90) },
        { key: "rotate", icon: "↻", label: this.t("bar_turn_right"), text: this.t("ctx_rotate"), title: withKeys(this.t("ctx_rotate"), ["R"]), disabled: fixed, run: () => this.rotateFurniture(90) },
        { key: "mirror", icon: "⇋", label: this.t("furn_mirror"), disabled: fixed, run: () => this.mirrorFurniture() },
        {
          key: "wall_view",
          icon: "▦",
          label: this.t("wall_view"),
          run: () => {
            const f = this.floor?.furniture.find((m) => m.id === id);
            if (f) this.openWallViewFor(f);
          },
        },
      );
    }
    acts.push({ key: "delete", icon: "✕", label: this.t("delete"), title: withKeys(this.t("delete"), ["Del"]), danger: true, run: () => void this.deleteItem(kind, id) });
    return acts;
  }

  renderContext(this: Fp3dEditor) {
    const c = this._ctx;
    if (!c) return renderItemBar(this);
    const wrap = this.renderRoot.querySelector(".fp3d-canvas-wrap") as HTMLElement | null;
    // keep the menu inside the plan
    const x = Math.max(4, Math.min(c.x, (wrap?.clientWidth ?? 800) - 190));
    const y = Math.max(4, Math.min(c.y, (wrap?.clientHeight ?? 600) - 190));
    const run = (fn: () => void) => () => {
      this._ctx = null;
      fn();
      // opened from the toolbar's "⋯": the keyboard goes back there
      if (c.bar) refocusItemBar(this);
    };
    const pt = c.point;
    // a point's menu (#395): remove it, never below three points
    const acts: ItemAct[] = pt
      ? [{ key: "remove_point", icon: "✕", label: this.t("remove_point"), title: withKeys(this.t("remove_point"), ["Del"]), disabled: !canRemovePoint(this, pt), danger: true, run: () => void removePoint(this, pt) }]
      : this.itemActions(c.kind, c.id).filter((a) =>
          // from the toolbar's "⋯": only what the toolbar does not show itself (turn left drops in there when narrow)
          c.bar ? (this.narrow || this._phone ? !ON_BAR.has(a.key) : !ON_BAR.has(a.key) && a.key !== "rotate_left") : a.menu !== false,
        );
    const keys = (e: KeyboardEvent) => {
      const items = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const at = items.indexOf((this.renderRoot as ShadowRoot).activeElement as HTMLButtonElement);
      const to = e.key === "ArrowDown" ? (at + 1) % items.length : e.key === "ArrowUp" ? (at - 1 + items.length) % items.length : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
      if (to >= 0 && items.length) {
        e.preventDefault();
        items[to].focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this._ctx = null;
        if (c.bar) refocusItemBar(this);
      }
    };
    return html`<div class="fp3d-ctx" role="menu" style=${`left:${x}px;top:${y}px`} @pointerdown=${(e: Event) => e.stopPropagation()} @contextmenu=${(e: Event) => e.preventDefault()} @keydown=${keys}>
      ${acts.map(
        (a) => html`<button role="menuitem" class=${a.danger ? "fp3d-ctx-danger" : ""} title=${a.title ?? nothing} ?disabled=${a.disabled} @click=${run(a.run)}>${a.icon} ${a.text ?? a.label}</button>`,
      )}
    </div>`;
  }

  /** Lock button in the form of an item. */
  fixButton(this: Fp3dEditor, kind: FixKind, id: string) {
    if (!this.isEditor) return nothing;
    if (kind !== "furniture" && kind !== "device") {
      // part of the floor plan: shows the plan lock, a click releases it
      return this._doc.settings.lock_plan
        ? html`<button class="fp3d-btn fp3d-fix" aria-pressed="true" title=${this.t("lock_plan_hint")} @click=${() => this.toggleLockPlan()}>
            🔒 ${this.t("plan_locked")}
          </button>`
        : nothing;
    }
    const fixed = this.isFixedItem(kind, id);
    // one constant name, the state as "pressed" (#396)
    return html`<button class="fp3d-btn fp3d-fix" aria-pressed=${fixed ? "true" : "false"} title=${withKeys(this.t("fix_hint"), ["L"])} @click=${() => this.toggleFixed(kind, id)}>
      ${this.t("lock_position")}
    </button>`;
  }

  /** Select a room, an opening or a furniture item (only one at a time). */
  selectItem(this: Fp3dEditor, kind: "room" | "opening" | "furniture" | "device" | "outdoor" | "wall", id: string | null): void {
    this._notice = null;
    this._kerbPick = false;
    this._petId = null;
    this._petPick = null;
    // a selection made in the plan (or by a tool) opens the folded sidebar
    if (id) this._sideOpen = true;
    this._outdoorId = kind === "outdoor" ? id : null;
    this._wallId = kind === "wall" ? id : null;
    this._edgeHi = null;
    if (kind === "outdoor" || kind === "wall") this._roomId = null;
    if (kind !== "room" || id !== this._roomId) this._vertex = null;
    this._point = null;
    this._roomId = kind === "room" ? id : this._roomId;
    this._openingId = kind === "opening" ? id : null;
    // a new selection starts at the panel's short first view: folds opened for the last one close again (#407)
    if (!(kind === "furniture" && id && id === this._furnitureId)) forgetPanelUi(this);
    this._furnitureId = kind === "furniture" ? id : null;
    this._multi = [];
    this._multiOut = [];
    this._single = false;
    this._deviceId = kind === "device" ? id : null;
    if (kind === "device" && id) {
      const pl = this.floor?.placements.find((x) => x.entity_id === id);
      this._roomId = (pl && this.roomAt([pl.x, pl.z])) ?? this._roomId;
    }
    if (kind === "opening" && id) this._roomId = this.floor?.openings.find((o) => o.id === id)?.room_id ?? this._roomId;
  }

  /** Shows an item of any floor and selects it (a link from the Settings page, #226); false when it is not there. */
  goToFurniture(this: Fp3dEditor, id: string): boolean {
    const fl = this._doc.floors.find((f) => f.furniture.some((m) => m.id === id));
    const m = fl?.furniture.find((x) => x.id === id);
    if (!fl || !m) return false;
    this._floorId = fl.id;
    this.selectItem("furniture", id);
    this.showPoint(m.x, m.z);
    return true;
  }

  /** Ctrl+C (#74, #400): the chosen items (block, multi selection) and outdoor areas go to the editor's clipboard; false when none is chosen. */
  copySelection(this: Fp3dEditor): boolean {
    const floor = this.floor;
    const areas = this.areaSelection();
    const clip = floor && (this._furnitureId || areas.length) ? copyItems(floor, this._furnitureId ? this.selection() : [], areas) : null;
    if (!clip) return false;
    clipboard = clip;
    this.requestUpdate();
    return true;
  }

  /**
   * Ctrl+V (#74, #400): copies of the clipboard's items and outdoor areas on the floor being edited, chosen, in one undo
   * step; at the pointer when it is on the plan (`at`, from Ctrl+V), else a step off the originals. False with nothing
   * to paste.
   */
  pasteClipboard(this: Fp3dEditor, at: Vec2 | null = null): boolean {
    const floor = this.floor;
    if (!clipboard || !floor || !this.isEditor) return false;
    const { items: copies, areas } = pasteClip(clipboard, floor.id, uid, at, this._doc.settings.grid);
    const dropped = this.dropCopiedAdminActions(copies);
    this.change((_, f) => {
      f.furniture.push(...copies);
      f.outdoor.push(...areas);
    });
    this.selectMixed(copies.map((c) => c.id), areas.map((a) => a.id));
    const first = this.furnitureItem;
    if (first) this._roomId = this.roomAt([first.x, first.z]) ?? this._roomId;
    // where it can be seen: a paste out of view (another floor, a far corner) is brought into it
    this.showArea([...copies.map((c): Vec2 => [c.x, c.z]), ...areas.flatMap((a) => a.points)]);
    this.noteDroppedActions(dropped);
    return true;
  }

  /** Ctrl+A (#74): every item on the floor; false when it has none. */
  selectAll(this: Fp3dEditor): boolean {
    const items = this.floor?.furniture ?? [];
    if (!items.length) return false;
    this.setMulti(items.map((m) => m.id));
    return true;
  }

  /** Duplicate, copy and (with something copied) paste, each with its shortcut in the tooltip (#74). */
  renderClipButtons(this: Fp3dEditor) {
    return html`<button class="fp3d-btn" title=${withKeys(this.t("duplicate"), ["Ctrl+D"])} @click=${() => this.duplicateFurniture()}>${this.t("duplicate")}</button>
      <button class="fp3d-btn" title=${withKeys(this.t("help_key_copy"), ["Ctrl+C"])} @click=${() => this.copySelection()}>${this.t("copy_items")}</button>
      ${this.renderPasteButton()}`;
  }

  /** "Paste (n)" while the clipboard holds items (#74): pastes them on this floor. */
  /** Paste for a header's "⋯" menu (#409): there while the editor's clipboard holds something. */
  pasteAction(this: Fp3dEditor): PanelAction | null {
    if (!clipboard || !this.isEditor) return null;
    return { label: this.t("paste_items_n", { n: clipSize(clipboard) }), keys: ["Ctrl+V"], run: () => void this.pasteClipboard() };
  }

  renderPasteButton(this: Fp3dEditor) {
    if (!clipboard || !this.isEditor) return nothing;
    return html`<button class="fp3d-btn" title=${withKeys(this.t("help_key_paste"), ["Ctrl+V"])} @click=${() => this.pasteClipboard()}>${this.t("paste_items_n", { n: clipSize(clipboard) })}</button>`;
  }

  // ------------------------------------------------------------------ furniture blocks and multi selection

  /** The furniture moved together: the multi selection, else the selected item's block (unless one part is edited alone), else the item. */
  selection(this: Fp3dEditor): string[] {
    if (this._multi.length) return this._multi;
    const f = this.furnitureItem;
    if (!f) return [];
    if (f.group && !this._single) return (this.floor?.furniture ?? []).filter((m) => m.group === f.group).map((m) => m.id);
    return [f.id];
  }

  /** Ids with every other part of their blocks. */
  withGroups(this: Fp3dEditor, ids: string[]): string[] {
    const groups = new Set((this.floor?.furniture ?? []).filter((m) => ids.includes(m.id) && m.group).map((m) => m.group));
    return [...new Set([...ids, ...(this.floor?.furniture ?? []).filter((m) => m.group && groups.has(m.group)).map((m) => m.id)])];
  }

  setMulti(this: Fp3dEditor, ids: string[]): void {
    if (!ids.length) return this.selectItem("room", this._roomId);
    this.selectItem("furniture", ids[0]);
    // one item (or exactly one block) needs no multi selection
    const block = this.selection();
    if (ids.length > 1 && !(ids.length === block.length && ids.every((id) => block.includes(id)))) this._multi = ids;
  }

  /** Shift-click: an item (with its block) joins the selection or leaves it. */
  toggleMulti(this: Fp3dEditor, id: string): void {
    const cur = this._furnitureId ? this.selection() : [];
    const part = this.withGroups([id]);
    const next = cur.includes(id) ? cur.filter((x) => !part.includes(x)) : [...new Set([...cur, ...part])];
    // the outdoor areas chosen with them stay chosen (#400)
    this.selectMixed(next, this.areaSelection());
  }

  /** The selection's centre (middle of its items' extent). */
  selectionCentre(this: Fp3dEditor, ids: string[]): Vec2 {
    const items = (this.floor?.furniture ?? []).filter((m) => ids.includes(m.id));
    const xs = items.map((m) => m.x);
    const zs = items.map((m) => m.z);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
  }

  /** Turns the whole selection about its centre (positions and each item's own turn). */
  rotateSelection(this: Fp3dEditor, delta: number): void {
    const set = this.selection();
    if (set.some((id) => this.isFixedItem("furniture", id))) {
      this._fixedHint = true;
      return;
    }
    const [cx, cz] = this.selectionCentre(set);
    const a = (delta * Math.PI) / 180;
    const c = Math.round(Math.cos(a) * 1e6) / 1e6;
    const s = Math.round(Math.sin(a) * 1e6) / 1e6;
    const ids = new Set(set);
    this.change((_, floor) => {
      for (const m of floor.furniture) {
        if (!ids.has(m.id)) continue;
        const dx = m.x - cx;
        const dz = m.z - cz;
        // the plan turns clockwise for a positive angle (x right, z down)
        Object.assign(m, { x: round(cx + dx * c - dz * s), z: round(cz + dx * s + dz * c), rotation: (((m.rotation + delta) % 360) + 360) % 360 });
      }
    });
  }

  /** "Group as block": the selection becomes one block. */
  groupSelection(this: Fp3dEditor): void {
    const ids = new Set(this.selection());
    if (ids.size < 2) return;
    const gid = uid("block");
    this.change((_, floor) => {
      for (const m of floor.furniture) if (ids.has(m.id)) m.group = gid;
    });
    this._multi = [];
    this._single = false;
  }

  /** "Ungroup": every part on its own again (the parts stay selected). */
  ungroupSelection(this: Fp3dEditor): void {
    const set = this.selection();
    const ids = new Set(set);
    this.change((_, floor) => {
      for (const m of floor.furniture) if (ids.has(m.id)) m.group = null;
    });
    if (set.length > 1) this._multi = set;
  }

  lockSelection(this: Fp3dEditor, on: boolean): void {
    const ids = new Set(this.selection());
    this.change((_, floor) => {
      for (const m of floor.furniture) if (ids.has(m.id)) m.locked = on || null;
    });
  }

  /**
   * What the Delete key removes: only what the active tool has selected (#158). The roof and energy tools own a roof
   * window, solar field or roof section; nothing else, least of all a room drawn earlier, goes with their Delete.
   * The room is the fallback in the select and furniture tools only.
   */
  deleteSelected(this: Fp3dEditor): void {
    // a chosen outdoor or roof point goes alone (#395); a room's corner below, as before
    const pt = chosenPoint(this);
    if (this._multiOut.length) void this.deleteMixed();
    else if (pt && pt.kind !== "room") void removePoint(this, pt);
    else if (this._roofWinId && this._tool === "roof") this.deleteRoofWindow();
    else if (this._solarId && this.houseTool) this.deleteSolar();
    else if (this._roofId && this._tool === "roof") this.deleteRoofSection();
    else if (this._deviceId) this.deleteItem("device", this._deviceId);
    else if (this._outdoorId) this.deleteOutdoor();
    else if (this._wallId) this.deleteFreeWall();
    else if (this._openingId) this.deleteOpening();
    else if (this._furnitureId) this.deleteFurniture();
    else if (this._vertex !== null && !this.houseTool) void this.deleteVertex(this._vertex);
    else if (this._tool === "select" || this._tool === "furniture") this.deleteRoom();
  }

  /** Let go of everything the last tool had selected (#158); the room stays, except for the roof and energy tools. */
  clearToolSelection(this: Fp3dEditor): void {
    this._openingId = null;
    this._furnitureId = null;
    this._deviceId = null;
    this._outdoorId = null;
    this._wallId = null;
    this._vertex = null;
    this._point = null;
    this._multi = [];
    this._multiOut = [];
    this._single = false;
    this._roofId = null;
    this._solarId = null;
    this._roofWinId = null;
    this._cableId = null;
    this._solarPick = false;
    this._edgeHi = null;
  }

  /** A dashed frame around several selected items (a block or a multi selection), and the frame being drawn. */
  renderSelectionFrame(this: Fp3dEditor, floor: Floor, set: string[]) {
    const d = this.drag;
    const drawing = d?.kind === "marquee" ? svg`<rect class="fp3d-marquee" x=${Math.min(...[d.start, d.end].map((p) => this.toScreen(p)[0]))} y=${Math.min(...[d.start, d.end].map((p) => this.toScreen(p)[1]))} width=${Math.abs(this.toScreen(d.end)[0] - this.toScreen(d.start)[0])} height=${Math.abs(this.toScreen(d.end)[1] - this.toScreen(d.start)[1])} />` : nothing;
    // outdoor areas chosen with the items (#400) are inside the frame too
    const areas = this._multiOut.length ? floor.outdoor.filter((a) => this._multiOut.includes(a.id)) : [];
    if (set.length + areas.length < 2) return drawing;
    const pts = [...floor.furniture.filter((m) => set.includes(m.id)).flatMap((m) => furnitureFootprint(m)), ...areas.flatMap((a) => a.points)];
    if (!pts.length) return drawing;
    const [x0, y0] = this.toScreen([Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))]);
    const [x1, y1] = this.toScreen([Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]);
    const block = !this._multi.length && !areas.length;
    return svg`${drawing}<g class=${`fp3d-selframe${block ? " fp3d-selframe-block" : ""}`}>
      <rect x=${x0 - 6} y=${y0 - 6} width=${x1 - x0 + 12} height=${y1 - y0 + 12} rx="6" />
      <text x=${x0 - 4} y=${y0 - 12}>${block ? `▣ ${this.t("block_title")} · ${set.length}` : this.t(areas.length ? "mixed_title" : "multi_title", { n: set.length + areas.length })}</text>
    </g>`;
  }

  /** Side panel for several items: a block (or a multi selection that can become one). */
  renderBlockForm(this: Fp3dEditor) {
    if (this._multiOut.length) return this.renderMixedForm();
    const set = this.selection();
    const items = (this.floor?.furniture ?? []).filter((m) => set.includes(m.id));
    const block = !this._multi.length && !!items[0]?.group;
    const fixed = items.every((m) => this.isFixedItem("furniture", m.id));
    const some = !fixed && items.some((m) => this.isFixedItem("furniture", m.id));
    return html`<section>
      <div class="fp3d-h3row"><h3>${block ? `▣ ${this.t("block_title")}` : this.t("multi_title", { n: items.length })}</h3></div>
      <p class="fp3d-sub">${touchOnly() && !block && this._multiMode ? this.t("multi_hint_on_touch") : touchWording(touchOnly(), block ? "block_hint" : "multi_hint", (k, p) => this.t(k, p))}</p>
      ${some ? html`<p class="fp3d-sub fp3d-wv-fixnote">${this.t("block_some_fixed")}</p>` : nothing}
      <div class="fp3d-block-parts">
        ${items.map(
          (m) => html`<button class="fp3d-chip" title=${this.t("block_part_edit")} @click=${() => {
            this.selectItem("furniture", m.id);
            this._single = !!m.group;
          }}>${m.name || furnitureName(this.hass, m.type)}</button>`,
        )}
      </div>
      ${this._doc.floors.length > 1 ? html`<div class="fp3d-form">${this.renderItemFloor()}</div>` : nothing}
      <div class="fp3d-actions">
        ${block
          ? html`<button class="fp3d-btn" @click=${() => this.ungroupSelection()}>${this.t("block_break")}</button>`
          : html`<button class="fp3d-btn fp3d-primary" @click=${() => this.groupSelection()}>▣ ${this.t("block_make")}</button>`}
        <button class="fp3d-btn" title=${withKeys(this.t("rotate_left"), ["Shift+R"])} @click=${() => this.rotateSelection(-90)}>${this.t("rotate_left")}</button>
        <button class="fp3d-btn" title=${withKeys(this.t("rotate_right"), ["R"])} @click=${() => this.rotateSelection(90)}>${this.t("rotate_right")}</button>
        ${this.renderClipButtons()}
        <button class="fp3d-btn ${some ? "fp3d-primary" : ""}" title=${withKeys(this.t(fixed || some ? "unfix" : "fix"), ["L"])} @click=${() => this.lockSelection(!fixed && !some)}>${fixed ? `🔓 ${this.t("unfix")}` : some ? `🔓 ${this.t("unfix_all")}` : `🔒 ${this.t("fix")}`}</button>
        <button class="fp3d-btn fp3d-danger" title=${withKeys(this.t("delete"), ["Del"])} @click=${() => this.deleteFurniture()}>${this.t("delete")}</button>
      </div>
      ${block ? nothing : this.renderAlignTools(items.length, fixed || some)}
    </section>`;
  }

  /** Align and distribute buttons (#235): a bundle of their own, loaded the first time several items are chosen. */
  renderAlignTools(this: Fp3dEditor, count: number, fixed: boolean) {
    void loadAlign();
    return html`<fp3d-align .host=${this} .count=${count} .fixed=${fixed}></fp3d-align>`;
  }

  /** Touch has no shift key: this switch makes taps add items and a drag on empty ground draw a frame. */
  renderMultiToggle(this: Fp3dEditor) {
    return html`<label class="fp3d-check fp3d-multi-toggle"><input type="checkbox" .checked=${this._multiMode} @change=${(e: Event) => (this._multiMode = (e.target as HTMLInputElement).checked)} /> ${this.t("multi_mode")}</label>`;
  }

  /** A tap in the 3D pane: select there, and fold the sidebar away (the bar under the pane has the essentials). */
  selectFrom3d(this: Fp3dEditor, kind: "room" | "furniture" | "device", id: string | null): void {
    this.selectItem(kind, id);
    this._sideOpen = false;
  }
}
