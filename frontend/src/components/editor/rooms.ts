// Rooms: drawing (polygon, rectangle by size, measure), adding, deleting, resizing and their notes, corners, the
// room list, the room form, packages, spots and the room's live and climate rows.

import { html, nothing, svg } from "lit";
import { areaEntities, CLIMATE_CLASSES, entityAreaId, isRoomClimateSensor, roomClimateSensors, type ClimateKey } from "../../devices.ts";
import { netRoomArea } from "../../geometry/area.ts";
import { unitLabel } from "../../units.ts";
import { itemsByRoom } from "../../item-list.ts";
import { CLIMATE_ATTRS } from "../../devices.ts";
import { furnishRoom, PACKAGES, type PackageId } from "../../packages.ts";
import { nameNewRoom, roomNameSuggestions } from "../../room-naming.ts";
import { carryRectResize, strandedBy } from "../../geometry/room-resize.ts";
import { formatNumber, type I18nKey } from "../../i18n.ts";
import { bounds, centroid, FLOOR_MATERIALS, isLamp, splitAliases, FURNITURE_SIZE, isAxisRect, spotGrid, step, type Direction, pointInPolygon, polygonArea, uid, type Building, type Floor, type Furniture, type FurnitureType, type Room, type Vec2 } from "../../model.ts";
import { roomLiveSensors, type LiveKind } from "../../room-effects.ts";
import { askConfirm } from "../../ask.ts";
import { cornerLoss, removeCorner } from "../../geometry/room-corners.ts";
import { type ResizeNote, round, patchItem, numberish } from "./helpers.ts";
import { pointKeys } from "./points.ts";
import type { Fp3dEditor } from "../editor.ts";

/**
 * What ties a room to Home Assistant or to its own spot: a duplicate leaves these with the original (#186), else two
 * rooms claim one area (and its voice names, chosen sensors, entity lists, start view and module links).
 */
const ROOM_LINKS = ["aliases", "climate", "live", "start_view", "panel", "hidden", "no_state", "mods"] as const satisfies readonly (keyof Room)[];

/** RoomsPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class RoomsPart {
  addDraftPoint(this: Fp3dEditor, p: Vec2, screen: [number, number]): void {
    const draft = this._draft;
    if (draft.length >= 3) {
      const [fx, fy] = this.toScreen(draft[0]);
      if (Math.hypot(fx - screen[0], fy - screen[1]) < 14) {
        this.closeDraft();
        return;
      }
    }
    const last = draft[draft.length - 1];
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < 1e-6) return;
    this._draft = [...draft, p];
  }

  closeDraft(this: Fp3dEditor): void {
    if (this._draft.length >= 3 && Math.abs(polygonArea(this._draft)) > 0.05) {
      if (this._tool === "outdoor" || this._tool === "pool") this.addOutdoor(this._draft);
      else this.addRoom(this._draft);
    }
    this._draft = [];
    this._cursor = null;
    this._guides = {};
  }

  /** By measure, a typed length wins over where the pointer is: the next point lies that far along the pull (#294). */
  pulledPoint(this: Fp3dEditor, p: Vec2 | null): Vec2 | null {
    const last = this._draft[this._draft.length - 1];
    if (!p || this._tool !== "measure" || !last || !(this._measureLen > 0)) return p;
    const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
    if (d < 1e-6) return p;
    return [round(last[0] + ((p[0] - last[0]) / d) * this._measureLen), round(last[1] + ((p[1] - last[1]) / d) * this._measureLen)];
  }

  /** Adds a wall of the typed length in a direction (drawing by measure). */
  measureStep(this: Fp3dEditor, dir: Direction): void {
    const last = this._draft[this._draft.length - 1];
    if (!last || !(this._measureLen > 0)) return;
    const next = step(last, this._measureLen, dir);
    // arriving at the start closes the room
    const first = this._draft[0];
    if (this._draft.length >= 3 && Math.hypot(next[0] - first[0], next[1] - first[1]) < 0.01) {
      this.closeDraft();
      return;
    }
    this._draft = [...this._draft, next];
  }

  rectBySize(this: Fp3dEditor): void {
    const start = this._draft[0] ?? [0, 0];
    const [w, d] = this._rectSize;
    if (!(w >= 0.1 && d >= 0.1)) {
      this._notice = this.t("rect_too_small", { min: this.m(0.1) });
      return;
    }
    this._notice = null;
    const floor = this.floor;
    const fallback = this.t("new_room", { n: (floor?.rooms.length ?? 0) + 1 });
    const named = nameNewRoom(this._rectName, Object.values(this.hass?.areas ?? {}), this.usedAreas(), fallback);
    this.addRoom([start, step(start, w, "right"), step(step(start, w, "right"), d, "down"), step(start, d, "down")], named);
    this._draft = [];
    this._rectName = "";
  }

  /** Type the start corner of the next room (#65): moves a tapped start and any walls typed from it. */
  setRectStart(this: Fp3dEditor, axis: 0 | 1, value: number): void {
    if (!Number.isFinite(value)) return;
    const start: Vec2 = this._draft[0] ?? [0, 0];
    const delta = round(value - start[axis]);
    const shift = (p: Vec2): Vec2 => (axis === 0 ? [round(p[0] + delta), p[1]] : [p[0], round(p[1] + delta)]);
    this._draft = this._draft.length ? this._draft.map(shift) : [shift(start)];
  }

  /** Areas some room or outdoor area of the home already stands for. */
  usedAreas(this: Fp3dEditor): Set<string | null> {
    return new Set(this._doc.floors.flatMap((f) => [...f.rooms.map((r) => r.area_id), ...(f.outdoor ?? []).map((a) => a.area_id ?? null)]));
  }

  /**
   * The measure tool owns the side panel (#301): only this form shows, in the order the work goes: what to do, the
   * length box (focused once the start is set), the arrows, the gap, Close room, the walls so far. The rectangle is a
   * closed fold-out below.
   */
  renderMeasureForm(this: Fp3dEditor) {
    const draft = this._draft;
    const first = draft[0];
    const last = draft[draft.length - 1];
    const gap = first && last && draft.length > 1 ? Math.hypot(last[0] - first[0], last[1] - first[1]) : 0;
    const arrows: [Direction, string][] = [
      ["up", "↑"],
      ["left", "←"],
      ["right", "→"],
      ["down", "↓"],
    ];
    const len = (v: number) => formatNumber(this.hass, v, 2);
    // what a screen reader hears after each tap or arrow: the start, the wall just added, the gap left to close
    const status = !first
      ? ""
      : draft.length === 1
        ? this.t("measure_started", { x: this.m(first[0]), z: this.m(first[1]) })
        : [this.t("measure_added", { n: draft.length - 1, len: this.m(Math.hypot(last[0] - draft[draft.length - 2][0], last[1] - draft[draft.length - 2][1])) }), draft.length >= 3 ? this.t("measure_gap", { gap: len(gap) }) : ""].filter(Boolean).join(". ");
    return html`<section class="fp3d-measure" aria-labelledby="fp3d-measure-h">
      <button class="fp3d-link fp3d-measure-back" @click=${() => this.setTool("select")}>‹ ${this.t("measure_back")}</button>
      <h3 id="fp3d-measure-h">${this.t("measure")}</h3>
      <p class="fp3d-sub fp3d-measure-hint">${this.t("hint_measure")}</p>
      ${first
        ? html`<p class="fp3d-sub fp3d-measure-from">${this.t("measure_from", { x: this.m(first[0]), z: this.m(first[1]) })}</p>`
        : html`<p class="fp3d-measure-start">${this.t("measure_start")}</p>`}
      <div class="fp3d-measure-row">
        <label class="fp3d-field fp3d-measure-len"
          >${unitLabel(this.t("measure_length"), this.unit)}
          <input
            class="fp3d-measure-input"
            type=${this.unit === "imperial" ? "text" : "number"}
            inputmode="decimal"
            step="0.01"
            min="0.05"
            ?disabled=${!first}
            placeholder=${this.t("measure_pull")}
            .value=${this._measureLen > 0 ? this.lenValue(this._measureLen) : ""}
            @input=${(e: Event) => (this._measureLen = this.readLen((e.target as HTMLInputElement).value) ?? 0)}
            @keydown=${(e: KeyboardEvent) => {
              const dir = { ArrowRight: "right", ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down" }[e.key] as Direction | undefined;
              if (dir) {
                e.preventDefault();
                this.measureStep(dir);
              } else if (e.key === "Enter") this.closeDraft();
            }}
        /></label>
        <div class="fp3d-arrows" role="group" aria-label=${this.t("measure_arrows")}>
          ${arrows.map(([dir, label]) => html`<button class="fp3d-btn fp3d-arrow-${dir}" ?disabled=${!first} title=${this.t(`dir_${dir}`)} aria-label=${this.t("measure_add_wall", { dir: this.t(`dir_${dir}`).toLowerCase() })} @click=${() => this.measureStep(dir)}><span aria-hidden="true">${label}</span></button>`)}
        </div>
      </div>
      ${first && draft.length >= 3 ? html`<p class="fp3d-sub fp3d-measure-gap">${this.t("measure_gap", { gap: len(gap) })}</p>` : nothing}
      ${this._notice ? html`<p class="fp3d-sub fp3d-notice">${this._notice}</p>` : nothing}
      ${first
        ? html`<div class="fp3d-actions">
              <button class="fp3d-btn fp3d-primary" ?disabled=${draft.length < 3} @click=${() => this.closeDraft()}>${this.t("measure_close")}</button>
              <button class="fp3d-btn" ?disabled=${draft.length < 2} @click=${() => (this._draft = draft.slice(0, -1))}>${this.t("measure_undo")}</button>
            </div>
            ${draft.length > 1
              ? html`<ol class="fp3d-measure-list">
                  ${draft.slice(1).map((p, i) => html`<li>${this.m(Math.hypot(p[0] - draft[i][0], p[1] - draft[i][1]))}</li>`)}
                </ol>`
              : nothing}`
        : nothing}
      <div class="fp3d-measure-sr" role="status" aria-live="polite">${status}</div>
      ${this.sideFold("rect-size", "", false, this.t("rect_by_size"), "", 0, () => html`<div class="fp3d-form">
        <label class="fp3d-field fp3d-wide"
          >${this.t("room_name")}
          <input
            list="fp3d-room-names"
            .value=${this._rectName}
            placeholder=${this.t("new_room", { n: (this.floor?.rooms.length ?? 0) + 1 })}
            @change=${(e: Event) => (this._rectName = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key !== "Enter") return;
              this._rectName = (e.target as HTMLInputElement).value;
              this.rectBySize();
            }}
          /><datalist id="fp3d-room-names">
            ${roomNameSuggestions(Object.values(this.hass?.areas ?? {}), this.usedAreas(), this.floor?.ha_floor ?? null).map((n) => html`<option value=${n}></option>`)}
          </datalist></label
        >
        ${this.len(this.t("x"), first?.[0] ?? 0, (v) => this.setRectStart(0, v))} ${this.len(this.t("z"), first?.[1] ?? 0, (v) => this.setRectStart(1, v))}
        ${this.len(this.t("width"), this._rectSize[0], (v) => (this._rectSize = [Math.max(0.1, v), this._rectSize[1]]), 0.01, 0.1)}
        ${this.len(this.t("depth"), this._rectSize[1], (v) => (this._rectSize = [this._rectSize[0], Math.max(0.1, v)]), 0.01, 0.1)}
        <button class="fp3d-btn fp3d-wide" @click=${() => this.rectBySize()}>${this.t("rect_add")}</button>
      </div>`)}
      <p class="fp3d-sub">${this.t("measure_hint")}</p>
    </section>`;
  }

  /**
   * After the measure tool's walls changed (#301): the newest wall is in view in the capped list, and the length box
   * takes the focus when a point was added (the start, an arrow, a tap) so the next length is typed at once. It never
   * steals the focus from another field and is not touched on ordinary re-renders.
   */
  afterMeasureDraft(this: Fp3dEditor, before: Vec2[] | undefined): void {
    const list = this.renderRoot.querySelector<HTMLElement>(".fp3d-measure-list");
    if (list) list.scrollTop = list.scrollHeight;
    if (this._draft.length === 0 || this._draft.length <= (before?.length ?? 0)) return;
    const input = this.renderRoot.querySelector<HTMLInputElement>(".fp3d-measure-input");
    if (!input || input.disabled) return;
    const active = (this.renderRoot as ShadowRoot).activeElement;
    if (active && active !== input && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    input.focus({ preventScroll: true });
  }

  /** A floor opening (stairwell, gallery): a hole in this floor's floor, drawn as a rectangle. */
  addHole(this: Fp3dEditor, lo: Vec2, hi: Vec2): void {
    if (!this.floor) return;
    const item: Furniture = {
      id: uid("hole"),
      type: "stairwell",
      x: round((lo[0] + hi[0]) / 2),
      z: round((lo[1] + hi[1]) / 2),
      w: round(hi[0] - lo[0]),
      d: round(hi[1] - lo[1]),
      h: 0.02,
      rotation: 0,
      variant: null,
    };
    this.change((_, floor) => floor.furniture.push(item));
    this.selectItem("furniture", item.id);
    // the tool stays: the next one is placed right away (Esc or "Select" ends it)
  }

  addRoom(this: Fp3dEditor, points: Vec2[], named?: { name: string; area_id: string | null }): void {
    if (!this.floor) return;
    const id = uid("room");
    const n = this.floor.rooms.length + 1;
    const { name, area_id } = named ?? { name: this.t("new_room", { n }), area_id: null };
    this.change((_, floor) => floor.rooms.push({ id, name, area_id, points: points.map(([x, z]) => [round(x), round(z)]), floor_material: "wood" }));
    this._roomId = id;
    this._vertex = null;
    // the tool stays: one room after the other (Esc or "Select" ends it)
  }

  async deleteRoom(this: Fp3dEditor): Promise<void> {
    const id = this._roomId;
    if (!id || !this.isEditor || !(await this.confirmFixedDelete("room", id))) return;
    this.change((_, floor) => {
      const room = floor.rooms.find((r) => r.id === id);
      floor.rooms = floor.rooms.filter((r) => r.id !== id);
      floor.openings = floor.openings.filter((o) => o.room_id !== id || o.wall);
      if (room) floor.placements = floor.placements.filter((pl) => !pointInPolygon([pl.x, pl.z], room.points));
    });
    this._roomId = null;
    this._vertex = null;
  }

  duplicateRoom(this: Fp3dEditor): void {
    const room = this.room;
    if (!room || !this.isEditor) return;
    const id = uid("room");
    // the copy keeps the shape and the look; it is a new room, named as a copy, with no area until one is picked (#186)
    const copy: Room = { ...structuredClone(room), id, name: this.t("home_copy_name", { name: room.name }), area_id: null, points: room.points.map(([x, z]) => [round(x + 0.5), round(z + 0.5)]) };
    for (const key of ROOM_LINKS) delete copy[key];
    this.change((_, floor) => floor.rooms.push(copy));
    this._roomId = id;
  }

  /**
   * Remove a corner. Where that would drop doors or windows, or give the joined wall one of two different heights or
   * thicknesses, ask first and say what is lost; openings that still fit on the joined wall can be kept (#206).
   * A corner that costs nothing (in line with its neighbours) goes without a question.
   */
  async deleteVertex(this: Fp3dEditor, index: number): Promise<void> {
    const room = this.room;
    if (!room || room.points.length <= 3) return;
    const loss = this.floor ? cornerLoss(this.floor, room.id, index) : null;
    let keep: string[] = [];
    if (loss && (loss.openings.length || loss.height || loss.thickness)) {
      const n = room.points.length;
      const parts = [
        this.t("corner_joins", { a: ((index - 1 + n) % n) + 1, b: index + 1, c: ((index + 1) % n) + 1 }),
        ...(loss.openings.length ? [this.t("corner_loses_openings", { n: loss.openings.length })] : []),
        ...(loss.height ? [this.t("corner_loses_height")] : []),
        ...(loss.thickness ? [this.t("corner_loses_thickness")] : []),
      ];
      if (!(await this.ask(parts.join(" "), this.t("delete_point")))) return;
      if (loss.fit.length && (await askConfirm(this.t("corner_keep_openings", { k: loss.fit.length, n: loss.openings.length }), { ok: this.t("corner_keep"), cancel: this.t("corner_drop"), danger: false })))
        keep = loss.fit.map((o) => o.id);
      // the plan may have changed while the questions were open
      if (this.room?.id !== room.id || this.room.points.length !== n) return;
    }
    const base = this._doc;
    // the edges at the corner become one; splits, part heights and openings are remapped with it (#157)
    this.change((_, floor) => removeCorner(floor, room.id, index, keep));
    this.noteResize(room.id, base);
    this._vertex = null;
  }

  updateRoom(this: Fp3dEditor, patch: Partial<Room>): void {
    const id = this._roomId;
    this.change((_, floor) => patchItem(floor.rooms.find((r) => r.id === id), patch));
  }

  setArea(this: Fp3dEditor, areaId: string): void {
    const room = this.room;
    if (!room) return;
    const area = areaId ? this.hass?.areas?.[areaId] : undefined;
    // a numbered default name ("Room 3", in the language shown or in English) gives way to the area's name
    const numbered = [this.t("new_room", { n: "#N#" }), "Room #N#"].some((p) => new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("#N#", "\\d+")}$`).test(room.name));
    const generic = !room.name || numbered || Object.values(this.hass?.areas ?? {}).some((a) => a.name === room.name);
    this.updateRoom({ area_id: areaId || null, ...(area && generic ? { name: area.name } : {}) });
  }

  setRect(this: Fp3dEditor, field: "x" | "z" | "w" | "d", value: number): void {
    const room = this.room;
    if (!room || !Number.isFinite(value)) return;
    const b = bounds(room.points);
    let { x0, z0, x1, z1 } = b;
    if (field === "x") [x0, x1] = [value, value + (x1 - x0)];
    if (field === "z") [z0, z1] = [value, value + (z1 - z0)];
    if (field === "w" && value > 0.05) x1 = x0 + value;
    if (field === "d" && value > 0.05) z1 = z0 + value;
    const points: Vec2[] = [[round(x0), round(z0)], [round(x1), round(z0)], [round(x1), round(z1)], [round(x0), round(z1)]];
    // a rectangle carries its contents and shared walls along (#64); "Outline only" swaps in the plain edit
    const base = this._doc;
    const floorId = this._floorId;
    const outline = structuredClone(base);
    const plain = outline.floors.find((f) => f.id === floorId)?.rooms.find((r) => r.id === room.id);
    if (plain) plain.points = points;
    let carried: ReturnType<typeof carryRectResize> = null;
    this.change((_, floor) => {
      carried = carryRectResize(floor, room.id, points);
      if (!carried) floor.rooms.find((r) => r.id === room.id)!.points = points;
    });
    this.noteResize(room.id, base, carried, outline);
  }

  /** The note of the last outline edit, while the document is still the one it describes. */
  resizeNote(this: Fp3dEditor): ResizeNote | null {
    const n = this._resize;
    return n && n.doc === this._doc ? n : null;
  }

  /** After an outline edit of `roomId` (`base` = the document before it): remember what moved and what it left outside. */
  noteResize(this: Fp3dEditor, roomId: string, base: Building, carried: ResizeNote["carried"] = null, outline: Building | null = null): void {
    // the previous note still holds if it described the document this edit started from
    const prev = this._resize?.doc === base ? this._resize : null;
    const floor = this.floor;
    const room = floor?.rooms.find((r) => r.id === roomId);
    // a run of edits on the same room counts from the outline before the first one
    const before = prev?.roomId === roomId ? prev.before : base.floors.find((f) => f.id === this._floorId)?.rooms.find((r) => r.id === roomId)?.points;
    this._resize = floor && room && before ? { roomId, before, doc: this._doc, base, carried, outline, stranded: strandedBy(floor, before, room.points) } : null;
  }

  /** "Outline only": keep the new outline, put the contents and neighbouring walls back (same undo step). */
  outlineOnly(this: Fp3dEditor): void {
    const n = this.resizeNote();
    if (!n?.outline) return;
    this.setDoc(structuredClone(n.outline), null);
    this.noteResize(n.roomId, n.base);
  }

  /** Select the items (else the first device) a resize left outside the room. */
  selectStranded(this: Fp3dEditor): void {
    const n = this.resizeNote();
    if (!n) return;
    const ids = n.stranded.furniture.filter((id) => this.floor?.furniture.some((m) => m.id === id));
    if (ids.length) this.setMulti(ids);
    else if (n.stranded.devices.length) this.selectItem("device", n.stranded.devices[0]);
  }

  renderResizeNote(this: Fp3dEditor, room: Room) {
    const n = this.resizeNote();
    if (!n || n.roomId !== room.id || !this.isEditor) return nothing;
    const c = n.carried;
    const moved = n.outline && c ? c.furniture + c.devices + c.walls : 0;
    const out = n.stranded.furniture.length + n.stranded.devices.length;
    if (!moved && !out) return nothing;
    return html`<div class="fp3d-resize-note" role="status">
      ${moved && c
        ? html`<p class="fp3d-sub">${this.t("resize_carried", { n: c.furniture + c.devices, w: c.walls })}</p>
            <div class="fp3d-actions">
              <button class="fp3d-btn" title=${this.t("resize_outline_only_hint")} @click=${() => this.outlineOnly()}>${this.t("resize_outline_only")}</button>
              <button class="fp3d-btn" @click=${() => this.undo()}>${this.t("undo")}</button>
            </div>`
        : nothing}
      ${out
        ? html`<p class="fp3d-sub">${out === 1 ? this.t("resize_outside_one") : this.t("resize_outside", { n: out })}</p>
            <div class="fp3d-actions"><button class="fp3d-btn" @click=${() => this.selectStranded()}>${this.t("resize_select")}</button></div>`
        : nothing}
    </div>`;
  }

  setPoint(this: Fp3dEditor, index: number, axis: 0 | 1, value: number): void {
    const room = this.room;
    if (!room || !Number.isFinite(value)) return;
    const points = room.points.map((p) => [...p] as Vec2);
    points[index][axis] = round(value);
    const base = this._doc;
    this.updateRoom({ points });
    this.noteResize(room.id, base);
  }

  renderRooms(this: Fp3dEditor, floor: Floor) {
    const shown = this.planLabels(floor);
    return svg`
      <g>${floor.rooms.map((r) => {
        const pts = r.points.map((p) => this.toScreen(p).join(",")).join(" ");
        return svg`<polygon data-room=${r.id} class=${r.id === this._roomId ? "fp3d-room fp3d-room-sel" : "fp3d-room"} points=${pts} />`;
      })}</g>
      ${this.renderEdgeHighlight()}
      <g pointer-events="none">${floor.rooms.map((r) => {
        // names that would sit on another's give way (#341)
        if (!shown.has(`r:${r.id}`)) return nothing;
        const [cx, cy] = this.toScreen(centroid(r.points));
        return svg`<text class="fp3d-room-name" x=${cx} y=${cy - 2}>${r.name}</text>
          <text class="fp3d-room-area" x=${cx} y=${cy + 14}>${this.area(polygonArea(r.points))}</text>`;
      })}</g>
    `;
  }

  renderHandles(this: Fp3dEditor, room: Room) {
    const pts = room.points;
    const n = pts.length;
    const edges = pts.map((a, i) => {
      const b = pts[(i + 1) % n];
      const [ax, ay] = this.toScreen(a);
      const [bx, by] = this.toScreen(b);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      // label outside the room: offset along the edge normal away from the centroid
      const [cx, cy] = this.toScreen(centroid(pts));
      let nx = -(by - ay);
      let ny = bx - ax;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      if (nx * (mx - cx) + ny * (my - cy) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const screenLen = Math.hypot(bx - ax, by - ay);
      return svg`
        ${screenLen > 50
          ? // on an upright edge the text starts beside the "+" instead of centred over it (#431)
            Math.abs(nx) > Math.abs(ny)
            ? svg`<text class="fp3d-dim" style="text-anchor:${nx > 0 ? "start" : "end"}" x=${mx + nx * 13} y=${my + ny * 13 + 4}>${this.m(len, 2)}</text>`
            : svg`<text class="fp3d-dim" x=${mx + nx * 16} y=${my + ny * 16 + 4}>${this.m(len, 2)}</text>`
          : nothing}
        ${screenLen > 36 ? svg`<g data-mid=${i} class="fp3d-mid"><circle cx=${mx} cy=${my} r="14" class="fp3d-hit" /><circle cx=${mx} cy=${my} r="6" /><path d="M${mx - 3} ${my}h6M${mx} ${my - 3}v6" /></g>` : nothing}
      `;
    });
    const vertices = pts.map((p, i) => {
      const [x, y] = this.toScreen(p);
      // a point takes the keyboard (#395): Tab to it, the arrows move it, Delete removes it
      const keys = pointKeys(this, { kind: "room", id: room.id, index: i }, n);
      return svg`<g data-vertex=${i} class=${i === this._vertex ? "fp3d-vertex fp3d-vertex-sel" : "fp3d-vertex"} tabindex="0" role="button" aria-label=${keys.label} @focus=${keys.focus}><circle cx=${x} cy=${y} r="16" class="fp3d-hit" /><circle cx=${x} cy=${y} r="6" /></g>
        <text class="fp3d-vertex-no" x=${x + 9} y=${y - 9}>${i + 1}</text>`;
    });
    return svg`<g>${edges}${vertices}</g>`;
  }

  renderDraft(this: Fp3dEditor) {
    const drag = this.drag;
    if (drag?.kind === "freewall") {
      const [x0, y0] = this.toScreen(drag.start);
      const [x1, y1] = this.toScreen(drag.end);
      const l = Math.hypot(drag.end[0] - drag.start[0], drag.end[1] - drag.start[1]);
      return svg`<g pointer-events="none">
        <line class="fp3d-draft fp3d-draft-wall" x1=${x0} y1=${y0} x2=${x1} y2=${y1} />
        <text class="fp3d-dim" x=${(x0 + x1) / 2} y=${(y0 + y1) / 2 - 10}>${this.m(l, 2)}</text>
      </g>`;
    }
    if (drag?.kind === "rect") {
      const [x0, y0] = this.toScreen(drag.start);
      const [x1, y1] = this.toScreen(drag.end);
      const w = Math.abs(drag.end[0] - drag.start[0]);
      const d = Math.abs(drag.end[1] - drag.start[1]);
      return svg`<g pointer-events="none">
        <rect class="fp3d-draft" x=${Math.min(x0, x1)} y=${Math.min(y0, y1)} width=${Math.abs(x1 - x0)} height=${Math.abs(y1 - y0)} />
        <text class="fp3d-dim" x=${(x0 + x1) / 2} y=${Math.min(y0, y1) - 8}>${this.m(w, 2)} × ${this.m(d, 2)}</text>
      </g>`;
    }
    if (this._tool !== "polygon" && this._tool !== "measure" && !this.drawingPoints) return nothing;
    const tip = this.pulledPoint(this._cursor);
    const world = [...this._draft, ...(tip && this._draft.length ? [tip] : [])];
    const pts = world.map((p) => this.toScreen(p));
    return svg`<g pointer-events="none">
      ${pts.length > 1 ? svg`<polyline class="fp3d-draft" points=${pts.map((p) => p.join(",")).join(" ")} />` : nothing}
      ${pts.slice(1).map((b, i) => {
        // every segment's length, the one to the pointer too (free form as with the other tools, #351)
        const a = pts[i];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 30) return nothing;
        return svg`<text class="fp3d-dim" x=${(a[0] + b[0]) / 2} y=${(a[1] + b[1]) / 2 - 6}>${this.m(Math.hypot(world[i + 1][0] - world[i][0], world[i + 1][1] - world[i][1]), 2)}</text>`;
      })}
      ${this._draft.map((p, i) => {
        const [x, y] = this.toScreen(p);
        return svg`<circle class=${i === 0 && this._draft.length >= 3 ? "fp3d-draft-pt fp3d-draft-first" : "fp3d-draft-pt"} cx=${x} cy=${y} r=${i === 0 && this._draft.length >= 3 ? 9 : 5} />`;
      })}
      ${tip ? svg`<circle class="fp3d-cursor" cx=${this.toScreen(tip)[0]} cy=${this.toScreen(tip)[1]} r="4" />` : nothing}
    </g>`;
  }

  /** A room one place up or down in its floor's list – the room bar of the 3D view shows them in this order (D599). */
  moveRoom(this: Fp3dEditor, id: string, by: number): void {
    this.change((_d, floor) => {
      const i = floor.rooms.findIndex((r) => r.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= floor.rooms.length) return;
      const [room] = floor.rooms.splice(i, 1);
      floor.rooms.splice(j, 0, room);
    });
  }

  renderRoomList(this: Fp3dEditor, floor: Floor) {
    if (!floor.rooms.length) return nothing;
    return html`<section>
      <h3>${this.t("rooms")}</h3>
      <div class="fp3d-room-list">
        ${floor.rooms.map(
          (r, i) => html`<div class="fp3d-row fp3d-dev-row">
            <button class="fp3d-row fp3d-room-btn" @click=${() => this.selectItem("room", r.id)}>
              <span>${r.name}</span><span class="fp3d-muted">${this.area(polygonArea(r.points))}</span>
            </button>
            ${this.isEditor && floor.rooms.length > 1
              ? html`<button class="fp3d-pin" aria-label=${this.t("room_move_up", { room: r.name })} title=${this.t("room_order_up")} ?disabled=${i === 0} @click=${() => this.moveRoom(r.id, -1)}>↑</button>
                  <button class="fp3d-pin" aria-label=${this.t("room_move_down", { room: r.name })} title=${this.t("room_order_down")} ?disabled=${i === floor.rooms.length - 1} @click=${() => this.moveRoom(r.id, 1)}>↓</button>`
              : nothing}
          </div>`,
        )}
      </div>
    </section>`;
  }

  renderRoomForm(this: Fp3dEditor, room: Room, areas: { area_id: string; name: string }[]) {
    const admin = this.isEditor;
    const rect = isAxisRect(room.points);
    // name, area, floor finish and size first; walls, devices and the rest as folds (#416, MANY-4, ORDER-7)
    return html`<section>
      ${this.renderPanelHeader({
        id: `room:${room.id}`,
        title: room.name || this.t("room"),
        kind: this.t("room"),
        where: this.floor?.name,
        lock: this.fixLock("room", room.id),
        menu: [
          { label: this.t("pkg_open"), run: () => (this._packages = !this._packages) },
          { label: this.t("spots_place"), run: () => this.openSpotForm(room) },
          { label: this.t("duplicate"), keys: ["Ctrl+D"], run: () => this.duplicateRoom() },
          this.pasteAction(),
          // the id a card's room: option takes, out of the form (#408, WORD-12)
          {
            label: this.t("room_id_copy"),
            run: () => {
              void navigator.clipboard?.writeText(room.id).catch(() => undefined);
              this._notice = this.t("room_id_copied", { id: room.id });
            },
          },
          { label: this.t("delete"), keys: ["Del"], danger: true, run: () => this.deleteRoom() },
        ],
      })}
      ${this._notice ? html`<p class="fp3d-sub fp3d-notice" role="status">${this._notice}</p>` : nothing}
      ${this.renderResizeNote(room)}
      ${this._spots ? this.renderSpotForm(room) : nothing}
      ${this._packages
        ? html`<div class="fp3d-packages">
            ${PACKAGES.map(
              (p) => html`<button class="fp3d-btn" @click=${() => this.applyPackage(room, p)}>
                <b>${this.t(`pkg_${p}` as I18nKey)}</b><span>${this.t(`pkg_${p}_desc` as I18nKey)}</span>
              </button>`,
            )}
            <p class="fp3d-sub">${this.t("pkg_hint")}</p>
          </div>`
        : nothing}
      <div class="fp3d-form">
        <label class="fp3d-field fp3d-wide"
          >${this.t("room_name")}
          <input .value=${room.name} ?disabled=${!admin} @change=${(e: Event) => this.updateRoom({ name: (e.target as HTMLInputElement).value })}
        /></label>
        <label class="fp3d-field fp3d-wide"
          >${this.t("area")}
          <select ?disabled=${!admin} @change=${(e: Event) => this.setArea((e.target as HTMLSelectElement).value)}>
            <option value="" ?selected=${!room.area_id}>${this.t("no_area")}</option>
            ${areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === room.area_id}>${a.name}</option>`)}
          </select></label
        >
        <label class="fp3d-field fp3d-wide"
          >${this.t("material")}
          <select ?disabled=${!admin} @change=${(e: Event) => this.updateRoom({ floor_material: (e.target as HTMLSelectElement).value })}>
            ${FLOOR_MATERIALS.map((m) => html`<option value=${m} ?selected=${m === room.floor_material}>${this.t(`mat_${m}` as I18nKey)}</option>`)}
          </select></label
        >
      </div>
      ${this.renderRoomSize(room, rect)}
    </section>
    ${this.renderEdgeHeights(room)}
    ${this.sideFold("room-devices", "", false, this.t("devices"), this.t("room_devices_n", { n: this.roomDeviceCount(room) }), 0, () => this.renderDeviceList(room, false))}
    ${this.renderRoomClimate(room)} ${this.renderRoomLive(room)} ${this.renderRoomOpenings(room)}
    ${this.renderItemsList(this.floor ? (itemsByRoom(this.floor.rooms, this.floor.furniture).get(room.id) ?? []) : [], false)}
    ${this.sideFold("corners", room.id, false, `${this.t("points")} (${room.points.length})`, "", 0, () =>
      room.points.map(
        (p, i) => html`<div class="fp3d-point ${i === this._vertex ? "fp3d-point-sel" : ""}">
          <span class="fp3d-muted">${i + 1}</span>
          ${this.len(this.t("x"), p[0], (v) => this.setPoint(i, 0, v))} ${this.len(this.t("z"), p[1], (v) => this.setPoint(i, 1, v))}
          ${admin
            ? html`<button class="fp3d-btn" aria-label=${this.t("delete_point")} title=${this.t("delete_point")} ?disabled=${room.points.length <= 3} @click=${() => void this.deleteVertex(i)}>
                ×
              </button>`
            : nothing}
        </div>`,
      ),
    )}
    ${this.renderRoomMore(room)} ${this.renderModuleRoomFields(room)}`;
  }

  /** The devices placed in a room (pins and lamps with a light), for the closed Devices fold (#416). */
  roomDeviceCount(this: Fp3dEditor, room: Room): number {
    const floor = this.floor;
    if (!floor) return 0;
    const inRoom = (x: number, z: number) => pointInPolygon([x, z], room.points);
    return floor.placements.filter((pl) => inRoom(pl.x, pl.z)).length + floor.furniture.filter((m) => isLamp(m.type) && !!m.entity && m.entity !== "none" && inRoom(m.x, m.z)).length;
  }

  /**
   * The room's Size fold (#416, ORDER-7): position and size of a rectangle, the ceiling height with one line of help
   * and an "i", and the area. Open by default, as it was left in this visit.
   */
  renderRoomSize(this: Fp3dEditor, room: Room, rect: boolean) {
    const admin = this.isEditor;
    const b = bounds(room.points);
    const net = netRoomArea(room, this.floor!, { exterior: this._doc.settings.wall_exterior, interior: this._doc.settings.wall_interior });
    const area = this.t("room_area_net", { a: this.area(polygonArea(room.points)), n: this.area(net) });
    const summary = [rect ? `${this.m(b.x1 - b.x0)} × ${this.m(b.z1 - b.z0)}` : "", this.area(polygonArea(room.points)), room.ceiling_height != null ? this.t("room_ceiling_at", { h: this.m(room.ceiling_height) }) : ""].filter(Boolean).join(" · ");
    return this.sideFold("room-size", "", true, this.t("fold_size"), summary, room.ceiling_height != null ? 1 : 0, () => html`<div class="fp3d-form">
        ${rect
          ? html`${this.len(this.t("x"), b.x0, (v) => this.setRect("x", v))} ${this.len(this.t("z"), b.z0, (v) => this.setRect("z", v))}
            ${this.len(this.t("width"), b.x1 - b.x0, (v) => this.setRect("w", v), 0.01, 0.05)}
            ${this.len(this.t("depth"), b.z1 - b.z0, (v) => this.setRect("d", v), 0.01, 0.05)}`
          : nothing}
        ${this.withInfo(
          html`<label class="fp3d-field"
            >${unitLabel(this.t("room_ceiling"), this.unit)}
            <input
              type=${this.unit === "imperial" ? "text" : "number"}
              step="0.05"
              min="1"
              placeholder=${this.floor ? this.lenValue(this.floor.height) : ""}
              .value=${room.ceiling_height != null ? this.lenValue(room.ceiling_height) : ""}
              ?disabled=${!admin}
              @change=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value.trim();
                const v = raw === "" ? null : this.readLen(raw);
                this.updateRoom({ ceiling_height: v === null || v <= 0 ? null : Math.min(30, Math.max(1, v)) });
              }}
          /></label>`,
          "room_ceiling_hint",
          this.t("room_ceiling"),
        )}
        <p class="fp3d-sub fp3d-wide">${this.t("room_ceiling_short")}</p>
        <div class="fp3d-with-info fp3d-wide"><p class="fp3d-sub fp3d-room-area">${area}</p>${this.infoButton("room_area_net_hint", this.t("room_area_size"))}</div>
      </div>`);
  }

  /** More options of a room (#416): other names, hide from the room list and the start view, each with its "i". */
  renderRoomMore(this: Fp3dEditor, room: Room) {
    const admin = this.isEditor;
    const summary = [(room.aliases ?? []).join(", "), room.hide_in_picker ? this.t("room_hidden_short") : "", room.start_view ? this.t("room_start_view_set") : ""].filter(Boolean);
    return this.sideFold("room-more", "", false, this.t("fold_more"), summary.join(" · ") || this.t("room_more_none"), summary.length, () => html`<div class="fp3d-form">
        ${this.withInfo(
          html`<label class="fp3d-field"
            >${this.t("aliases")}
            <input type="text" maxlength="240" .value=${(room.aliases ?? []).join(", ")} ?disabled=${!admin} placeholder=${this.aliasPlaceholder(room.name, true)} @change=${(e: Event) => this.updateRoom({ aliases: splitAliases((e.target as HTMLInputElement).value) })}
          /></label>`,
          "aliases_hint",
          this.t("aliases"),
        )}
        ${this.withInfo(
          html`<label class="fp3d-check"
            ><input type="checkbox" .checked=${room.hide_in_picker === true} ?disabled=${!admin} @change=${(e: Event) => this.updateRoom({ hide_in_picker: (e.target as HTMLInputElement).checked ? true : undefined })} />
            ${this.t("room_hide_in_picker")}</label
          >`,
          "room_hide_hint",
          this.t("room_hide_in_picker"),
        )}
        ${this.withInfo(
          html`<button class="fp3d-btn" ?disabled=${!admin} @click=${() => this.rememberRoomView()}>${this.t("room_start_view")}</button>`,
          "room_start_view_hint",
          this.t("room_start_view"),
        )}
        ${room.start_view ? html`<button class="fp3d-btn fp3d-wide" ?disabled=${!admin} @click=${() => this.updateRoom({ start_view: null })}>${this.t("room_start_view_reset")}</button>` : nothing}
      </div>`);
  }

  /** Adds the furniture of a room package (lamps link to the room's lights automatically). */
  applyPackage(this: Fp3dEditor, room: Room, pkg: PackageId): void {
    if (!this.isEditor) return;
    const items = furnishRoom(room, pkg, () => uid("furniture"));
    this.change((_, floor) => floor.furniture.push(...items));
    this._packages = false;
    this._notice = this.t("pkg_done", { n: items.length });
  }

  /** Suggests about one spot per 1.2 m in each direction, and the room's first light. */
  openSpotForm(this: Fp3dEditor, room: Room): void {
    const b = bounds(room.points);
    const lights = this.hass ? areaEntities(this.hass, room.area_id).filter((id) => id.startsWith("light.")) : [];
    this._spots = {
      type: "lamp_downlight",
      rows: Math.max(1, Math.round((b.z1 - b.z0) / 1.2)),
      cols: Math.max(1, Math.round((b.x1 - b.x0) / 1.2)),
      entity: lights[0] ?? null,
    };
  }

  placeSpots(this: Fp3dEditor, room: Room): void {
    const f = this._spots;
    if (!f || !this.isEditor) return;
    const [w, d, h] = FURNITURE_SIZE[f.type];
    const items = spotGrid(room, f.rows, f.cols).map(([x, z]) => ({
      id: uid("furniture"),
      type: f.type,
      x,
      z,
      rotation: 0,
      w,
      d,
      h,
      variant: null,
      // every spot of the grid follows the same light (spots on one dimmer); "none" = not linked
      entity: f.entity ?? "none",
      power: null,
    }));
    this.change((_, floor) => floor.furniture.push(...items));
    this._spots = null;
    this._notice = this.t("spots_placed", { n: items.length });
  }

  renderSpotForm(this: Fp3dEditor, room: Room) {
    const f = this._spots!;
    const count = spotGrid(room, f.rows, f.cols).length;
    const lights = this.entityOptions((id) => /^(light|switch|input_boolean)\./.test(id));
    const set = (patch: Partial<NonNullable<Fp3dEditor["_spots"]>>) => (this._spots = { ...f, ...patch });
    return html`<div class="fp3d-form fp3d-spot-form">
      <label class="fp3d-field fp3d-wide"
        >${this.t("spots_type")}
        <select @change=${(e: Event) => set({ type: (e.target as HTMLSelectElement).value as FurnitureType })}>
          ${(["lamp_downlight", "lamp_spot", "lamp_panel", "lamp_ceiling"] as FurnitureType[]).map(
            (t) => html`<option value=${t} ?selected=${t === f.type}>${this.t(`furn_${t}` as I18nKey)}</option>`,
          )}
        </select></label
      >
      ${this.num(this.t("spots_cols"), f.cols, (v) => set({ cols: Math.max(1, Math.min(12, Math.round(v))) }), 1, 1)}
      ${this.num(this.t("spots_rows"), f.rows, (v) => set({ rows: Math.max(1, Math.min(12, Math.round(v))) }), 1, 1)}
      ${this.entitySelect(this.t("furn_entity_light"), f.entity, undefined, lights, (v) => set({ entity: v === "none" ? null : v }))}
      <div class="fp3d-actions fp3d-wide">
        <button class="fp3d-btn fp3d-primary" ?disabled=${!count} @click=${() => this.placeSpots(room)}>${this.t("spots_add", { n: count })}</button>
        <button class="fp3d-btn" @click=${() => (this._spots = null)}>${this.t("cancel")}</button>
      </div>
      <p class="fp3d-sub fp3d-wide">${this.t("spots_hint")}</p>
    </div>`;
  }

  /** A room's leak and motion sensors for the live effects (#10): chosen ones, or every one of the room. */
  renderRoomLive(this: Fp3dEditor, room: Room) {
    const hass = this.hass;
    if (!hass) return nothing;
    const set = (key: LiveKind, v: string | null) => {
      const next = { ...(room.live ?? {}), [key]: v };
      const empty = Object.values(next).every((x) => x == null);
      this.updateRoom({ live: empty ? null : next });
    };
    const chosen = !!room.live && Object.values(room.live).some((x) => x != null);
    const field = (key: LiveKind, label: string) => {
      const auto = roomLiveSensors(hass, this.floor ?? null, { ...room, live: null }, key);
      const classes = key === "leak" ? ["moisture"] : ["motion", "occupancy", "presence"];
      const options = this.entityOptions((id) => id.startsWith("binary_sensor.") && classes.includes(String(hass.states[id]?.attributes.device_class ?? "")), classes.join(","))
        .map((o) => ({ ...o, rank: entityAreaId(hass, o.id) === room.area_id ? 0 : 1 }))
        .sort((a, b) => a.rank - b.rank)
        .map(({ id, label }) => ({ id, label }));
      return this.entitySelect(label, room.live?.[key] ?? null, auto[0] ?? null, options, (v) => set(key, v));
    };
    const picked = Object.values(room.live ?? {}).filter((x): x is string => !!x);
    return this.sideFold("room-live", room.id, chosen, this.t("room_live"), picked.map((id) => this.linkName(id)).join(" · ") || this.t("fold_auto"), picked.length, () =>
      html`<div class="fp3d-form">${field("leak", this.t("room_live_leak"))} ${field("motion", this.t("room_live_motion"))}</div>
        <p class="fp3d-sub">${this.t("room_live_hint")}</p>`,
    );
  }

  /** Room climate: temperature, humidity and CO2 from chosen sensors, or picked automatically. */
  renderRoomClimate(this: Fp3dEditor, room: Room) {
    const hass = this.hass;
    if (!hass) return nothing;
    const set = (key: ClimateKey, v: string | null) => {
      const next = { ...(room.climate ?? {}), [key]: v };
      const empty = Object.values(next).every((x) => x == null);
      this.updateRoom({ climate: empty ? null : next });
    };
    const chosen = !!room.climate && Object.values(room.climate).some((x) => x != null);
    const field = (key: ClimateKey, label: string) => {
      const dc = CLIMATE_CLASSES[key];
      const auto = roomClimateSensors(hass, this.floor ?? null, { ...room, climate: null }, key);
      // the room's own sensors first, then all others; device temperatures (printer, heat pump) last
      // sensors of the kind, and thermostats that report it (#478)
      const attr = CLIMATE_ATTRS[key];
      const options = this.entityOptions((id) => (numberish(id) && hass.states[id]?.attributes.device_class === dc) || (!!attr && id.startsWith("climate.") && typeof hass.states[id]?.attributes[attr] === "number"), dc, attr)
        .map((o) => ({ ...o, rank: (entityAreaId(hass, o.id) === room.area_id ? 0 : 1) + (isRoomClimateSensor(hass, o.id) ? 0 : 2) }))
        .sort((a, b) => a.rank - b.rank)
        .map(({ id, label }) => ({ id, label }));
      return this.entitySelect(label, room.climate?.[key] ?? null, auto[0] ?? null, options, (v) => set(key, v));
    };
    const picked = Object.values(room.climate ?? {}).filter((x): x is string => !!x);
    return this.sideFold("room-climate", room.id, chosen, this.t("climate"), picked.map((id) => this.linkName(id)).join(" · ") || this.t("fold_auto"), picked.length, () =>
      html`<div class="fp3d-form">
          ${field("temperature", this.t("climate_temperature"))} ${field("humidity", this.t("climate_humidity"))} ${field("co2", this.t("climate_co2"))}
        </div>
        <p class="fp3d-sub">${this.t("climate_hint")}</p>`,
    );
  }
}
