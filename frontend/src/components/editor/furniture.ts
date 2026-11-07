// Furniture (items): types, turning devices into items and back, placing (click-to-place, #76), moving, mirroring,
// deleting and duplicating, the plan drawing, and the library pane with its previews and updates.

import { html, nothing, svg } from "lit";
import { hasScreen, kindOf } from "../../devices.ts";
import { furnitureSymbol } from "../furniture2d.ts";
import { snapToWall, wallSnap } from "../../geometry/snap.ts";
import { snapPoint, snapTolerance } from "../../geometry/snap-guides.ts";
import { translate, type I18nKey } from "../../i18n.ts";
import { retypePatch, typeOptionLabels } from "../../item-panel.ts";
import { moveToFloor } from "../../item-floor.ts";
import { bounds, centroid, FURNITURE_GROUPS, FURNITURE_TYPES, isLamp, LAMP_MODEL, uid, type Floor, type Furniture, type Placement, type Vec2, STAIR_TYPES, stairLimits, stairOptionPatch } from "../../model.ts";
import { fetchPackUpdates, updatePlacedItems } from "../../api.ts";
import { libraryUpdates, sameSet } from "../../pack-updates.ts";
import { dropAdminActions } from "../../item-actions.ts";
import { load3d } from "../../load3d.ts";
import { ensureRecipes } from "../../pack-recipes.ts";
import { basicTypes, buildIndex, roomKindOf, type LibraryEntry } from "../../library-index.ts";
import { packsVersion as libPacksVersion } from "../../packs.ts";
import { setCameraLook } from "../../camera-models.ts";
import { furnitureName } from "../../furniture-names.ts";
import { furnitureSize, isElectric, isRobotVacuum, packItemName, packName, packType, type FurniturePack } from "../../packs.ts";
import { MAX_MOUNT_Y, round, isEnergyDevice, EN_HASS, type PlaceTarget } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";
import { need, loadItemPicker, loadLibrary, loadPackBrowser } from "./lazy.ts";
import { itemShown } from "../../show-when.ts";
import { rememberFromPin } from "./from-pin.ts";

const SPEAKERISH = /speaker|sound|subwoofer|receiver|smart_|display|tv|media|turntable|projector|console/;

/** Which furniture types can stand for a placed device of this entity's kind (a lamp for a light …). */
export function furnitureFits(entityId: string): (type: string) => boolean {
  const kind = kindOf(entityId);
  return (t) => {
    if (kind === "light") return isLamp(t);
    if (kind === "climate") return t === "radiator" || t === "ac_unit";
    if (entityId.startsWith("vacuum.")) return isRobotVacuum(t);
    if (kind === "media") return hasScreen(t) || (isElectric(t) && SPEAKERISH.test(t));
    return isElectric(t) && !isLamp(t);
  };
}

/** FurniturePart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class FurniturePart {
  /** A pack's lines in the Type list, same-named items told apart (#132); kept per pack and language. */
  typeLabels(this: Fp3dEditor, pack: FurniturePack): string[] {
    const lang = this.hass?.language ?? "en";
    const kept = this.typeLabelMemo.get(pack);
    if (kept && kept.lang === lang) return kept.labels;
    const labels = typeOptionLabels(pack.items, lang);
    this.typeLabelMemo.set(pack, { lang, labels });
    return labels;
  }

  /**
   * The built-in types offered in a furniture item's type list: what the library offers (#530 – devices of the energy
   * tool, the pool module parts not released yet and the stairwell are no furniture to switch to), plus the item's own type.
   */
  typeChoices(this: Fp3dEditor, current: string): string[] {
    const shown = new Set<string>(Object.values(FURNITURE_GROUPS).flat());
    // the smart fridge: its own pack, or the household feature
    shown.add("fridge_smart");
    return FURNITURE_TYPES.filter((t) => shown.has(t) || t === current);
  }

  /** Furniture that can stand for a placed device of this kind (a speaker for a media player, a lamp for a light …). */
  furnitureFor(this: Fp3dEditor, entityId: string): { type: string; label: string }[] {
    const lang = this.hass?.language ?? "en";
    const all = [
      ...FURNITURE_TYPES.map((t) => ({ type: t as string, label: this.t(`furn_${t}` as I18nKey) })),
      ...(this.packs ?? []).flatMap((p) => p.items.map((it) => ({ type: packType(p.id, it.id), label: `${packItemName(it, lang)} · ${packName(p, lang)}` }))),
    ];
    const fits = furnitureFits(entityId);
    return all.filter((x) => fits(x.type)).sort((a, b) => a.label.localeCompare(b.label));
  }

  /** The library's cards that can stand for a placed device (#419): the picker of "Show as furniture …". */
  furnitureEntriesFor(this: Fp3dEditor, entityId: string): LibraryEntry[] {
    const fits = furnitureFits(entityId);
    return this.libraryEntries(this.hass?.language ?? "en").filter((e) => !e.mirror && fits(e.type));
  }

  /** A vehicle placed as plain furniture becomes a parking spot with this vehicle (presence and the car's data live there). */
  vehicleToSpot(this: Fp3dEditor, f: Furniture): void {
    if (!this.isEditor) return;
    const [w, d, h] = furnitureSize("parking");
    const spot: Furniture = { id: uid("furniture"), type: "parking", x: f.x, z: f.z, rotation: f.rotation, w: Math.max(w, round(f.w + 0.5)), d: Math.max(d, round(f.d + 0.4)), h, variant: null, vehicle: f.type, ...(f.name ? { name: f.name } : {}) };
    this.change((_, floor) => {
      floor.furniture = floor.furniture.filter((m) => m.id !== f.id);
      floor.furniture.push(spot);
    });
    this.selectItem("furniture", spot.id);
  }

  /** Replace a placed device by a furniture item linked to it, where the pin stood (one undo step). */
  deviceToFurniture(this: Fp3dEditor, pl: Placement, type: string): void {
    if (!this.isEditor) return;
    // a camera keeps its pin with everything set there (field of view, aim, Kamera-Cockpit): the model is only its
    // look – one item that replaces the last one and moves with the camera (#779); a camera model sets its mount (#9)
    if (pl.entity_id.startsWith("camera.")) {
      this.change((_, f) => setCameraLook(f, pl.entity_id, type));
      return;
    }
    const [w, d, h] = furnitureSize(type);
    const item: Furniture = {
      id: uid("furniture"),
      type,
      x: pl.x,
      z: pl.z,
      rotation: pl.rotation ?? 0,
      w,
      d,
      h,
      variant: null,
      entity: pl.entity_id,
      name: pl.name ?? null,
      ...(pl.locked ? { locked: true } : {}),
      // own tap / hold / double-tap actions go along (#6)
      ...(pl.actions ? { actions: pl.actions } : {}),
    };
    this.change((_, f) => {
      f.placements = f.placements.filter((p) => p.entity_id !== pl.entity_id);
      f.furniture.push(item);
    });
    rememberFromPin(item.id);
    this._deviceId = null;
    this.selectItem("furniture", item.id);
  }

  /** Turn a furniture item linked by hand back into a plain device pin at its place. */
  furnitureToDevice(this: Fp3dEditor, f: Furniture): void {
    const id = f.entity;
    if (!this.isEditor || !id || id === "none") return;
    const pl: Placement = { entity_id: id, x: f.x, z: f.z, y: null, rotation: f.rotation, ...(f.name ? { name: f.name } : {}), ...(id.startsWith("light.") ? { pin: true } : {}), ...(f.actions ? { actions: f.actions } : {}) };
    this.change((_, floor) => {
      floor.furniture = floor.furniture.filter((m) => m.id !== f.id);
      if (!floor.placements.some((p) => p.entity_id === id)) floor.placements.push(pl);
    });
    this._furnitureId = null;
    this.selectItem("device", id);
  }

  /**
   * "Show as furniture …" (#419, MANY-3): a button that opens the furniture library's picker (search, filters,
   * pictures) with the items that fit the device, instead of one select of every library item. Picking one turns the
   * pin into it (a camera keeps its pin and takes the model as its look); a camera with a look can go back to the
   * built-in model.
   */
  renderAsFurniture(this: Fp3dEditor, pl: Placement) {
    if (!this.isEditor) return nothing;
    const entries = this.furnitureEntriesFor(pl.entity_id);
    if (!entries.length) return nothing;
    const look = pl.entity_id.startsWith("camera.") ? this.floor?.furniture.find((m) => m.look_of === pl.entity_id) : undefined;
    need(loadItemPicker);
    const lang = this.hass?.language ?? "en";
    return html`<div class="fp3d-field fp3d-wide fp3d-as-furniture">
      ${this.withInfo(
        html`<span class="fp3d-as-furniture-row"
          ><button type="button" class="fp3d-btn fp3d-item-pick" aria-haspopup="dialog" @click=${() => (this._itemPicker = true)}>${look ? furnitureName(this.hass, look.type) : this.t("as_furniture_open")}</button
          >${look
            ? html`<button type="button" class="fp3d-link" @click=${() => this.change((_, f) => (f.furniture = f.furniture.filter((m) => m.look_of !== pl.entity_id)))}>${this.t("camera_look_builtin")}</button>`
            : nothing}</span
        >`,
        "as_furniture_hint",
        this.t("as_furniture"),
      )}
      ${this._itemPicker
        ? html`<fp3d-item-picker
            .entries=${entries}
            .current=${look?.type ?? ""}
            .language=${lang}
            .heading=${this.t("as_furniture")}
            .t=${(k: string, v?: Record<string, string | number>) => this.t(k as I18nKey, v)}
            .thumb=${this.libraryThumb}
            .picture=${this.libraryPicture}
            @pick=${(e: CustomEvent<{ type: string }>) => {
              this._itemPicker = false;
              this.deviceToFurniture(pl, e.detail.type);
            }}
            @close=${() => (this._itemPicker = false)}
          ></fp3d-item-picker>`
        : nothing}
    </div>`;
  }

  /**
   * A library card was chosen (#76): it waits for a click on the plan, which places it there ("Place in the
   * middle" keeps the old way). Its recipe is fetched meanwhile (#44), so it shows as itself at once.
   */
  addFurniture(this: Fp3dEditor, type: string, mirror = false): void {
    if (!this.hass || !this.isEditor) return;
    this._placing = { type, mirror };
    this._placeAt = null;
    void ensureRecipes(this.hass, [type]);
  }

  /** The armed card placed at a target (or in the room's middle without one); Ctrl/Cmd-click keeps it armed. */
  placeArmed(this: Fp3dEditor, at: PlaceTarget | null, keep = false): void {
    const p = this._placing;
    if (!p || !this.hass) return;
    if (!keep) {
      this._placing = null;
      this._placeAt = null;
    }
    this.showGuides([]);
    void ensureRecipes(this.hass, [p.type]).then(() => this.placeFurniture(p.type, p.mirror, at));
  }

  placeArmedInMiddle(this: Fp3dEditor): void {
    this.placeArmed(null);
  }

  cancelPlacing(this: Fp3dEditor): void {
    this._placing = null;
    this._placeAt = null;
    this.showGuides([]);
  }

  /** Snapping is off for this event: Shift (or Alt) held on a desktop, or the snap switch turned off (#173). */
  snapOff(this: Fp3dEditor, e: { shiftKey: boolean; altKey: boolean }): boolean {
    return e.shiftKey || e.altKey || !this._snapOn;
  }

  /** The snap switch (for touch, where there is no Shift), remembered on this device (#173). */
  setSnapOn(this: Fp3dEditor, on: boolean): void {
    this._snapOn = on;
    if (!on) this.showGuides([]);
    try {
      localStorage.setItem("home3d.snap", on ? "1" : "0");
    } catch {
      // private mode: the choice lasts until the editor closes
    }
  }

  /**
   * Where the armed card would land for a plan point, and what it lands on (#173): on a room's centre lines or in
   * line with other items (#143), else on the grid, then against the nearest wall of the room under the pointer
   * (back to the wall, flush). The room is the one under the true pointer, not the snapped point. `free`: no snapping.
   */
  placeTarget(this: Fp3dEditor, world: Vec2, free: boolean): PlaceTarget {
    const g = this._doc.settings.grid;
    const grid = (v: number) => (free || !g ? round(v) : round(Math.round(v / g) * g));
    const p = this._placing;
    const floor = this.floor;
    const roomId = this.roomAt(world);
    if (free || !p || !floor) {
      this.showGuides([]);
      return { at: [grid(world[0]), grid(world[1])], rotation: 0, roomId, wall: null };
    }
    const [w, d, h] = furnitureSize(p.type);
    // the lines are gathered again only when the plan changed
    if (this.placeLines?.floor !== floor) this.placeLines = { floor, lines: this.alignLinesFor(floor, null) };
    const s = snapPoint(world, [w / 2, d / 2], this.placeLines.lines, snapTolerance(this._view.scale));
    let x = s.x ? round(s.p[0]) : grid(world[0]);
    let z = s.z ? round(s.p[1]) : grid(world[1]);
    let rotation = 0;
    let wall: PlaceTarget["wall"] = null;
    const stand: Furniture = { id: "", type: p.type, x, z, rotation: 0, w, d, h, variant: null };
    const hit = roomId ? wallSnap(floor, stand, this._doc.settings.wall_interior, undefined, { turn: true, roomId }) : null;
    if (hit) {
      ({ x, z, rotation } = hit);
      wall = { roomId: hit.roomId, edge: hit.edge };
    }
    // a wall that pulled the item off a guide drops that guide
    this.showGuides(s.guides.length ? s.guides.filter((q) => Math.abs(q.axis === "x" ? x - s.p[0] : z - s.p[1]) < 0.002) : []);
    return { at: [x, z], rotation, roomId, wall };
  }

  placeFurniture(this: Fp3dEditor, type: string, mirror: boolean, target: PlaceTarget | null = null): void {
    const floor = this.floor;
    if (!floor || !this.isEditor) return;
    const at = target?.at ?? null;
    // placed by a click (#76): into the room under the pointer itself (#173), not under the snapped point
    if (target) this._roomId = target.roomId ?? this._roomId;
    const [w, d, h0] = furnitureSize(type);
    // stairs reach up to the next floor
    const above = this._doc.floors.filter((f) => f.elevation > floor.elevation).sort((p, q) => p.elevation - q.elevation)[0];
    const h = STAIR_TYPES.has(type) ? round(above ? above.elevation - floor.elevation : floor.height + 0.25) : h0;
    const room = this.room;
    const [x, z] = at ?? (room ? centroid(room.points) : this.toWorld(this._size.w / 2, this._size.h / 2));
    let rotation = target?.wall ? target.rotation : 0;
    if (type === "parking" && room && !target?.wall) {
      // a parking spot runs into the room from its garage door, else along the room's longer side
      const gate = floor.openings.find((o) => o.room_id === room.id && o.type === "garage");
      const a = gate ? room.points[gate.edge] : null;
      const c = gate ? room.points[(gate.edge + 1) % room.points.length] : null;
      const b = bounds(room.points);
      rotation = (a && c ? Math.abs(c[1] - a[1]) > Math.abs(c[0] - a[0]) : b.x1 - b.x0 > b.z1 - b.z0) ? 90 : 0;
    }
    const item: Furniture = { id: uid("furniture"), type, x: round(x), z: round(z), rotation, w, d, h, variant: null, ...(mirror ? { mirror: true } : {}) };
    this.change((_, f) => f.furniture.push(item));
    this.selectItem("furniture", item.id);
    // small items are easy to lose in a large plan: bring the new one into view
    this.showPoint(item.x, item.z);
  }

  /**
   * Snap a furniture item against the nearest wall of its room: back to the wall (or a side, when it
   * stands sideways), flush with the wall face. Null when no wall is close enough.
   */
  snapToWall(this: Fp3dEditor, f: Furniture): { x: number; z: number; rotation: number } | null {
    return this.floor ? snapToWall(this.floor, f, this._doc.settings.wall_interior) : null;
  }

  /** Straight stairs: open treads, a turn or landing at the bottom, a flat top and a start height (#16). */
  renderStairOptions(this: Fp3dEditor, f: Furniture) {
    const admin = this.isEditor;
    const limits = stairLimits(f);
    const apply = (change: Parameters<typeof stairOptionPatch>[1]) => this.updateFurniture(stairOptionPatch(f, change));
    return html`<div class="fp3d-form">
      <label class="fp3d-check fp3d-wide"
        ><input type="checkbox" .checked=${!!f.stair_open} ?disabled=${!admin} @change=${(e: Event) => apply({ stair_open: (e.target as HTMLInputElement).checked })} />
        ${this.t("stair_open")}</label
      >
      <label class="fp3d-field fp3d-wide" title=${this.t("stair_turn_hint")}
        >${this.t("stair_turn")}
        <select ?disabled=${!admin || !limits.canTurn} @change=${(e: Event) => apply({ stair_turn: ((e.target as HTMLSelectElement).value || null) as "left" | "right" | null })}>
          ${(["", "left", "right"] as const).map((v) => html`<option value=${v} ?selected=${(f.stair_turn ?? "") === v}>${this.t(`stair_turn_${v || "none"}` as I18nKey)}</option>`)}
        </select></label
      >
      <span title=${this.t("stair_landing_hint")}>${this.num(this.t("stair_landing"), f.stair_landing ?? 0, (v) => apply({ stair_landing: v }), 1, 0)}</span>
      <span title=${this.t("stair_top_hint")}>${this.len(this.t("stair_top"), f.stair_top ?? 0, (v) => apply({ stair_top: v }), 0.05, 0)}</span>
      ${this.len(this.t("stair_start"), f.mount_y ?? 0, (v) => this.updateFurniture({ mount_y: Math.round(Math.min(MAX_MOUNT_Y, Math.max(0, v)) * 1000) / 1000 || null }), 0.05, 0)}
    </div>`;
  }

  updateFurniture(this: Fp3dEditor, patch: Partial<Furniture>): void {
    const id = this._furnitureId;
    // a field may report its change after the item was deselected or the floor changed (on blur): then nothing to do
    if (!id || !this.floor?.furniture.some((f) => f.id === id)) return;
    this.change((_, floor) => {
      const item = floor.furniture.find((f) => f.id === id);
      if (item) Object.assign(item, patch);
    });
  }

  /** Another type from the item panel (#132): with the new type's size unless the item was resized by hand. */
  retypeFurniture(this: Fp3dEditor, type: string): void {
    const f = this.furnitureItem;
    if (f) this.updateFurniture(retypePatch(f, type));
  }

  mirrorFurniture(this: Fp3dEditor): void {
    const f = this.furnitureItem;
    if (!f || !this.isEditor) return;
    this.updateFurniture({ mirror: !f.mirror });
  }

  rotateFurniture(this: Fp3dEditor, delta: number): void {
    const f = this.furnitureItem;
    if (!f || !this.isEditor) return;
    const set = this.selection();
    if (set.length > 1) return this.rotateSelection(delta);
    this.updateFurniture({ rotation: (((f.rotation + delta) % 360) + 360) % 360 });
  }

  async deleteFurniture(this: Fp3dEditor): Promise<void> {
    const id = this._furnitureId;
    if (!id || !this.isEditor) return;
    const set = this.selection();
    if (set.length > 1) {
      const fixed = set.some((x) => this.isFixedItem("furniture", x));
      if (!(await this.ask(this.t(fixed ? "block_delete_fixed" : "block_delete", { n: set.length })))) return;
      const ids = new Set(set);
      this.change((_, floor) => (floor.furniture = floor.furniture.filter((f) => !ids.has(f.id))));
      this.selectItem("room", this._roomId);
      return;
    }
    if (!(await this.confirmFixedDelete("furniture", id))) return;
    this.change((_, floor) => (floor.furniture = floor.furniture.filter((f) => f.id !== id)));
    this._furnitureId = null;
  }

  duplicateFurniture(this: Fp3dEditor): void {
    const f = this.furnitureItem;
    if (!f || !this.isEditor) return;
    const set = this.selection();
    if (set.length > 1) {
      // the copy of a block is a block of its own
      const items = this.floor!.furniture.filter((m) => set.includes(m.id));
      const blocks = new Map<string, string>();
      const copies = items.map((m) => ({ ...structuredClone(m), id: uid("furniture"), x: round(m.x + 0.3), z: round(m.z + 0.3), group: m.group ? (blocks.get(m.group) ?? blocks.set(m.group, uid("block")).get(m.group)!) : null, locked: null }));
      const dropped = this.dropCopiedAdminActions(copies);
      this.change((_, floor) => floor.furniture.push(...copies));
      this.setMulti(copies.map((c) => c.id));
      this.noteDroppedActions(dropped);
      return;
    }
    const copy = { ...structuredClone(f), id: uid("furniture"), x: round(f.x + 0.3), z: round(f.z + 0.3), group: this._single ? f.group : null };
    const dropped = this.dropCopiedAdminActions([copy]);
    this.change((_, floor) => floor.furniture.push(copy));
    this.selectItem("furniture", copy.id);
    this.noteDroppedActions(dropped);
  }

  /** A non-admin's copies lose their perform actions (#383); an admin's keep them. How many went. */
  dropCopiedAdminActions(this: Fp3dEditor, copies: Furniture[]): number {
    return this.isHaAdmin ? 0 : dropAdminActions(copies);
  }

  /** The short notice for that (after the selection, which clears notices). */
  noteDroppedActions(this: Fp3dEditor, n: number): void {
    if (n) this._notice = this.t("copy_actions_dropped", { n });
  }

  /**
   * The item panel's floor dropdown (#73): the chosen item (its block, the multi selection) goes to another floor
   * with its links, in one undo step, and the editor follows it there, still chosen. Fixed items stay put.
   */
  moveSelectionToFloor(this: Fp3dEditor, to: string): void {
    const from = this._floorId;
    const ids = this._furnitureId ? this.selection() : [];
    if (!from || to === from || !ids.length || !this.isEditor) return;
    if (ids.some((id) => this.isFixedItem("furniture", id))) {
      this._fixedHint = true;
      return;
    }
    const [first, multi, single] = [this._furnitureId!, this._multi.length > 1, this._single];
    let moved: string[] = [];
    this.change((doc) => (moved = moveToFloor(doc, from, ids, to)));
    if (!moved.length) return;
    this._floorId = to;
    this._vertex = null;
    this._draft = [];
    if (multi) this.setMulti(moved);
    else this.selectItem("furniture", first);
    this._single = single;
    const item = this.furnitureItem;
    this._roomId = item ? this.roomAt([item.x, item.z]) : null;
  }

  /** Rooms of the floor below, as orientation. */
  /** The outline of an armed library card under the pointer (#76), turned to the wall it snaps to, with the room and wall named (#173). */
  renderPlaceGhost(this: Fp3dEditor) {
    const p = this._placing;
    const target = this._placeAt;
    if (!p || !target) return nothing;
    const [w, d] = furnitureSize(p.type);
    const k = this._view.scale;
    const [cx, cy] = this.toScreen(target.at);
    const room = target.roomId ? this.floor?.rooms.find((r) => r.id === target.roomId) : null;
    const n = room?.points.length ?? 0;
    const label = !room ? this.t("place_no_room") : target.wall ? `${room.name} · ${this.t("wall_n", { a: target.wall.edge + 1, b: ((target.wall.edge + 1) % n) + 1 })}` : room.name;
    return svg`<g class="fp3d-place-ghost-g">
      <rect class=${`fp3d-place-ghost${target.wall ? " fp3d-place-ghost-wall" : ""}`} x=${-(w * k) / 2} y=${-(d * k) / 2} width=${w * k} height=${d * k} transform="translate(${cx} ${cy}) rotate(${target.rotation})" />
      <text class="fp3d-place-label" x=${cx} y=${cy - (Math.max(w, d) * k) / 2 - 6} text-anchor="middle">${label}</text>
    </g>`;
  }

  renderFurniture(this: Fp3dEditor, floor: Floor) {
    const k = this._view.scale;
    const set = this._furnitureId ? this.selection() : [];
    const many = set.length > 1;
    const hidden = this._hiddenItems;
    const shown = hidden.length ? floor.furniture.filter((f) => !hidden.includes(f.id)) : floor.furniture;
    // names that would sit on another's give way; a hidden one shows while the pointer is over its item (#341)
    const named = this.planLabels(floor);
    return svg`<g>${this.renderSelectionFrame(floor, set)}${shown.map((f) => {
      const member = set.includes(f.id);
      const sel = f.id === this._furnitureId && !many;
      const [cx, cy] = this.toScreen([f.x, f.z]);
      // the handle sits in front of the item; dragging it turns the item
      const a = (f.rotation * Math.PI) / 180;
      const reach = f.d / 2 + Math.max(0.3, 26 / k);
      const [hx, hy] = this.toScreen([f.x - Math.sin(a) * reach, f.z + Math.cos(a) * reach]);
      const [fx, fy] = this.toScreen([f.x - Math.sin(a) * (f.d / 2), f.z + Math.cos(a) * (f.d / 2)]);
      const ghost = !!f.show_when && !!this.hass && !itemShown(f, this.hass.states, new Date());
      const lit = isLamp(f.type) && !!f.entity && f.entity !== "none" && this.hass?.states[f.entity]?.state === "on";
      return svg`<g data-furniture=${f.id} class=${`fp3d-furn${ghost ? " fp3d-furn-ghost" : ""}${sel || member ? " fp3d-furn-sel" : ""}${lit ? " fp3d-furn-lit" : ""}${isEnergyDevice(f.type) ? " fp3d-energy-item" : ""}`}>
        <g transform="translate(${cx} ${cy}) rotate(${f.rotation}) scale(${f.mirror ? -k : k} ${k})">
          <rect class="fp3d-furn-body" x=${-f.w / 2} y=${-f.d / 2} width=${f.w} height=${f.d} />
          <g class="fp3d-furn-sym">${furnitureSymbol(f.type, f.w, f.d)}</g>
          <line class="fp3d-furn-front" x1=${-f.w / 2} y1=${f.d / 2} x2=${f.w / 2} y2=${f.d / 2} />
        </g>
        <text class=${named.has(`f:${f.id}`) ? "" : "fp3d-lbl-off"} x=${cx} y=${this.itemLabelY(f, cy)}>${furnitureName(this.hass, f.type)}</text>
      </g>
      ${sel && this.isEditor && !f.locked
        ? ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sz]) => {
            const [x, y] = this.toScreen([f.x + (sx * f.w * Math.cos(a)) / 2 - (sz * f.d * Math.sin(a)) / 2, f.z + (sx * f.w * Math.sin(a)) / 2 + (sz * f.d * Math.cos(a)) / 2]);
            return svg`<g class="fp3d-resize" data-resize=${`${f.id}:${sx}:${sz}`}>
              <circle cx=${x} cy=${y} r="14" class="fp3d-hit" />
              <rect x=${x - 5} y=${y - 5} width="10" height="10" rx="2" />
            </g>`;
          })
        : nothing}
      ${sel
        ? (() => {
            // behind the item, away from the turn handle in front
            const [lx, ly] = this.toScreen([f.x + Math.sin(a) * (f.d / 2 + 18 / k), f.z - Math.cos(a) * (f.d / 2 + 18 / k)]);
            return svg`<text class="fp3d-dim" x=${lx} y=${ly + 4}>${this.m(f.w, 2)} × ${this.m(f.d, 2)}</text>`;
          })()
        : nothing}
      ${sel && f.locked ? svg`<text class="fp3d-lock" x=${hx} y=${hy + 5}>🔒</text>` : nothing}
      ${sel && this.isEditor && !f.locked
        ? svg`<g class="fp3d-rotate" data-rotate=${f.id}>
            <line x1=${fx} y1=${fy} x2=${hx} y2=${hy} />
            <circle cx=${hx} cy=${hy} r="16" class="fp3d-hit" />
            <circle cx=${hx} cy=${hy} r="8" />
            <path d="M${hx - 4} ${hy - 1}a4 4 0 1 1 2 3.5" />
          </g>`
        : nothing}`;
    })}</g>`;
  }

  /** The library's index, built once per language and pack state. */
  libraryEntries(this: Fp3dEditor, lang: string): LibraryEntry[] {
    // the smart fridge is exclusive: an installed pack with the feature "fridge_smart", or the household feature, offers it
    const extra = ["fridge_smart"];
    const key = `${lang}|${libPacksVersion()}|${this.packs?.length ?? 0}|${extra.length}`;
    if (this.libIndex?.key === key) return this.libIndex.entries;
    const entries = buildIndex({
      packs: this.packs ?? [],
      basics: basicTypes(extra),
      language: lang,
      basicName: (t) => this.t(`furn_${t}` as I18nKey),
      basicNameEn: (t) => translate(EN_HASS, `furn_${t}` as I18nKey),
      kindName: (k) => this.t(`lib_kind_${k}` as I18nKey),
      size: furnitureSize,
    });
    this.libIndex = { key, entries };
    return entries;
  }

  /** Ask which placed items have an update (#48); a request already under way is asked again once it is back. */
  setLibUpdates(this: Fp3dEditor, next: ReadonlySet<string>): void {
    if (!sameSet(next, this._libUpdates)) this._libUpdates = next;
  }

  refreshLibUpdates(this: Fp3dEditor): void {
    if (!this.hass) return;
    if (this.libUpdatesAsking) {
      this.libUpdatesAsked = true;
      return;
    }
    this.libUpdatesAsking = true;
    void fetchPackUpdates(this.hass)
      // the same updates again are no new state: no render (#391)
      .then((status) => this.setLibUpdates(libraryUpdates(status)))
      .catch(() => this.setLibUpdates(new Set()))
      .finally(() => {
        this.libUpdatesAsking = false;
        if (this.libUpdatesAsked) {
          this.libUpdatesAsked = false;
          this.refreshLibUpdates();
        }
      });
  }

  /** Update the placed items of a library card to the installed release (#48); the plan comes back with a new revision. */
  async updateFromLibrary(this: Fp3dEditor, types: string[]): Promise<void> {
    if (!this.hass) return;
    try {
      await updatePlacedItems(this.hass, types);
    } catch (err) {
      this._notice = String((err as { message?: string })?.message ?? err);
    }
    this.refreshLibUpdates();
  }

  renderFurnitureLibrary(this: Fp3dEditor) {
    const room = this.room;
    const lang = this.hass?.language ?? "en";
    need(loadLibrary);
    return html`<section>
      <h3>${this.t("furniture_add")}</h3>
      ${this._placing ? nothing : html`<p class="fp3d-sub">${room ? this.t("furniture_into", { room: room.name }) : this.t("furniture_pick_room")}</p>`}
      ${this._placing
        ? html`<div class="fp3d-placing" role="status">
            <span>${this.t("place_armed", { name: furnitureName(this.hass, this._placing.type) })}</span>
            <label class="fp3d-check" title=${this.t("snap_toggle_hint")}
              ><input type="checkbox" .checked=${this._snapOn} @change=${(e: Event) => this.setSnapOn((e.target as HTMLInputElement).checked)} />
              ${this.t("snap_toggle")}</label
            >
            <button class="fp3d-btn fp3d-primary" @click=${() => this.placeArmedInMiddle()}>${room ? this.t("place_middle_room", { room: room.name }) : this.t("place_middle")}</button>
            <button class="fp3d-btn" @click=${() => this.cancelPlacing()}>${this.t("cancel")}</button>
          </div>`
        : nothing}
      ${this.isEditor
        ? html`<div class="fp3d-seg fp3d-lib-tabs" role="tablist">
            <button role="tab" aria-selected=${!this._libBrowse} aria-pressed=${!this._libBrowse} @click=${() => (this._libBrowse = false)}>${this.t("pb_tab_items")}</button>
            <button role="tab" aria-selected=${this._libBrowse} aria-pressed=${this._libBrowse} @click=${() => (this._libBrowse = true)}>${this.t("pb_tab_browse")}</button>
          </div>`
        : nothing}
      ${this._libBrowse && this.isEditor ? this.renderPackBrowser() : html`<fp3d-library
        .entries=${this.libraryEntries(lang)}
        .language=${lang}
        .roomHint=${room ? roomKindOf(room.name) : null}
        .admin=${this.isEditor}
        .t=${(k: string, v?: Record<string, string | number>) => this.t(k as I18nKey, v)}
        .thumb=${this.libraryThumb}
        .updates=${this._libUpdates}
        @library-update=${(e: CustomEvent<{ types: string[] }>) => void this.updateFromLibrary(e.detail.types)}
        @library-add=${(e: CustomEvent<{ type: string; mirror?: boolean }>) => this.addFurniture(e.detail.type, !!e.detail.mirror)}
        @library-preview=${(e: CustomEvent<{ type: string | null; element: HTMLElement | null }>) => {
          if (e.detail.type && e.detail.element) void this.showPreview(e.detail.type, e.detail.element);
          else this._preview = null;
        }}
      ></fp3d-library>`}
    </section>
    <div class="fp3d-ext-teaser">
      <b>${this.t("ext_teaser_title")}</b>
      <span class="fp3d-sub">${this.t("ext_teaser_text")}</span>
      <button class="fp3d-btn fp3d-primary" @click=${() => this.dispatchEvent(new CustomEvent("open-extensions", { bubbles: true, composed: true }))}>${this.t("ext_open")}</button>
    </div>`;
  }

  /** The Library's Browse tab (#336), a chunk of its own: the packs the curated index lists, to install or update. */
  renderPackBrowser(this: Fp3dEditor) {
    need(loadPackBrowser);
    return html`<fp3d-pack-browser .hass=${this.hass} .packs=${this.packs ?? []} .picture=${this.indexPicture}></fp3d-pack-browser>`;
  }

  /** Picture of an item, drawn by the 3D bundle and shown left of its button. */
  async showPreview(this: Fp3dEditor, type: string, button: HTMLElement): Promise<void> {
    const r = button.getBoundingClientRect();
    const place = { left: Math.max(8, r.left - 196), top: Math.max(8, Math.min(window.innerHeight - 200, r.top + r.height / 2 - 95)) };
    this._preview = { type, url: null, ...place };
    try {
      const [mod] = await Promise.all([load3d(), this.hass ? ensureRecipes(this.hass, [type]) : undefined]);
      const [w, d, h] = furnitureSize(type);
      const url = mod.furniturePreview({ type, w, d, h, variant: null, lamp: LAMP_MODEL[type] ?? null }, 180, this.packs ?? []);
      if (this._preview?.type === type) this._preview = { type, url, ...place };
    } catch {
      this._preview = null;
    }
  }

  renderPreview(this: Fp3dEditor) {
    const p = this._preview;
    if (!p) return nothing;
    return html`<div class="fp3d-preview" style="left:${p.left}px;top:${p.top}px" aria-hidden="true">
      ${p.url ? html`<img src=${p.url} alt="" />` : html`<span class="fp3d-preview-wait"></span>`}
      <b>${furnitureName(this.hass, p.type)}</b>
    </div>`;
  }
}
