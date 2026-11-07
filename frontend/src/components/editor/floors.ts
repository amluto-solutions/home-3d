// Floors: adding, ordering and deleting them, rooms from Home Assistant areas, shifting and turning a floor, the
// floor menu, the backdrop picture and its tools, the floor below and the attic headroom lines.

import { html, nothing, svg } from "lit";
import { fetchImage, storeImage } from "../../api.ts";
import { errorText, isImagesFull } from "../../failure.ts";
import { unitLabel } from "../../units.ts";
import { closeGaps, straightenEdges, suggestedThickness } from "../../geometry/gaps.ts";
import { activeSections, headroomLines, sectionAbove, sectionCutsBelow } from "../../roof-sections.ts";
import type { Background } from "../../model.ts";
import { formatNumber } from "../../i18n.ts";
import { bounds, newFloor, floorElevation, roomTiles, unplacedAreas, uid, type Floor, type Vec2 } from "../../model.ts";
import type { HassArea, HassFloor } from "../../types.ts";
import { shiftBy, transformPlan, turnAbout } from "../../plan-transform.ts";
import { firstHaFloor, floorLinks, haFloorNamed } from "../../floor-link.ts";
import { round } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** FloorsPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class FloorsPart {
  /** Areas of a floor's Home Assistant floor that have no room in the plan yet (none for a sample home, #61). */
  unplacedAreas(this: Fp3dEditor, floor: Floor): HassArea[] {
    return unplacedAreas(this._doc, floor, this.hass?.areas);
  }

  addFloor(this: Fp3dEditor, ha: HassFloor | null = null): void {
    const floors = this._doc.floors;
    // a home's first floor stands for Home Assistant's ground floor (or its lowest) by itself (#263)
    if (!ha && floors.length === 0) ha = firstHaFloor(this.freeHaFloors);
    const id = uid("floor");
    const name = ha?.name ?? (floors.length === 0 ? this.t("default_floor") : this.t("new_floor", { n: floors.length }));
    const floor = { ...newFloor(id, name, floorElevation(floors, ha?.level)), ha_floor: ha?.floor_id ?? null };
    const next = structuredClone(this._doc);
    // floors are kept from bottom to top
    const at = next.floors.findIndex((f) => f.elevation > floor.elevation);
    next.floors.splice(at < 0 ? next.floors.length : at, 0, floor);
    this.setDoc(next);
    this._floorId = id;
    this._roomId = null;
    this._floorMenu = false;
    // a new floor starts with Select, so the next-step hint shows instead of the last tool's (#262)
    if (this._tool !== "select") this.setTool("select");
    this.fit();
  }

  /** One room tile per unplaced area of the floor's Home Assistant floor, to drag into place. */
  addAreaRooms(this: Fp3dEditor, floor: Floor): void {
    const areas = this.unplacedAreas(floor);
    if (!areas.length) return;
    const rooms = roomTiles(floor, areas, () => uid("room"));
    this.change((_, f) => f.rooms.push(...rooms));
    this.fit();
  }

  moveFloor(this: Fp3dEditor, dir: -1 | 1): void {
    const i = this._doc.floors.findIndex((f) => f.id === this._floorId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this._doc.floors.length) return;
    const next = structuredClone(this._doc);
    [next.floors[i], next.floors[j]] = [next.floors[j], next.floors[i]];
    this.setDoc(next);
  }

  async deleteFloor(this: Fp3dEditor): Promise<void> {
    const floor = this.floor;
    if (!floor || !(await this.ask(this.t("delete_floor_confirm", { name: floor.name })))) return;
    const next = structuredClone(this._doc);
    next.floors = next.floors.filter((f) => f.id !== floor.id);
    this.setDoc(next);
    this._floorId = next.floors[0]?.id ?? null;
    this._roomId = null;
  }

  /** Straighten edges that are almost along an axis (a corner a centimetre off makes slanted walls in 3D, #333). */
  straightenFloor(this: Fp3dEditor): void {
    const floor = this.floor;
    if (!floor || !this.isEditor) return;
    const { rooms, fixed } = straightenEdges(floor.rooms);
    if (!fixed) {
      this._notice = this.t("straighten_none");
      return;
    }
    this.change((_, f) => (f.rooms = rooms));
    this._notice = this.t("straighten_done", { n: fixed });
  }

  /** Close gaps between rooms of this floor and take the gap as interior wall thickness. */
  closeFloorGaps(this: Fp3dEditor): void {
    const floor = this.floor;
    if (!floor || !this.isEditor) return;
    const { rooms, gaps } = closeGaps(floor.rooms);
    if (!gaps.length) {
      this._notice = this.t("gaps_none");
      return;
    }
    const thickness = suggestedThickness(gaps);
    this.change((doc, f) => {
      f.rooms = rooms;
      if (thickness) doc.settings.wall_interior = thickness;
    });
    this._notice = thickness
      ? this.t("gaps_closed_wall", { n: gaps.length, t: formatNumber(this.hass, thickness, 2) })
      : this.t("gaps_closed", { n: gaps.length });
  }

  /** Move everything on the floor (or with "all floors" the whole house) by (dx, dz): every plan coordinate, see plan-transform.ts (#156). */
  shiftFloor(this: Fp3dEditor, dx: number, dz: number): void {
    if (!this.isEditor || (!dx && !dz)) return;
    const all = this._shiftAll;
    this.change((doc, floor) => transformPlan(doc, all ? null : [floor.id], shiftBy(dx, dz)));
    this._shiftX = 0;
    this._shiftZ = 0;
  }

  /** Turn everything on the floor by 90° (clockwise in the plan) about the middle of its rooms: when a floor was drawn the wrong way round. */
  turnFloor(this: Fp3dEditor): void {
    const floor = this.floor;
    if (!floor || !this.isEditor) return;
    // with "all floors" the house turns about the middle of every room on every floor
    const all = this._shiftAll;
    const pts = (all ? this._doc.floors : [floor]).flatMap((f) => f.rooms.flatMap((r) => r.points));
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    this.change((doc, f) => transformPlan(doc, all ? null : [f.id], turnAbout(cx, cz)));
  }

  updateFloor(this: Fp3dEditor, patch: Partial<Floor>): void {
    this.change((doc, floor) => {
      Object.assign(floor, patch);
      // a floor renamed like a Home Assistant floor links to it, when it has no link yet (#263; editable below)
      if (patch.name !== undefined && !floor.ha_floor) {
        const hit = haFloorNamed(floor.name, Object.values(this.hass?.floors ?? {}), new Set(doc.floors.map((f) => f.ha_floor)));
        if (hit) floor.ha_floor = hit.floor_id;
      }
    });
  }

  /** A home none of whose floors is linked to Home Assistant's yet: floors link by name, once, undoable (#263). */
  linkFloorsByName(this: Fp3dEditor): void {
    if (!this.isEditor || this._doc.floors.some((f) => f.ha_floor)) return;
    const links = floorLinks(this._doc.floors, Object.values(this.hass?.floors ?? {}));
    if (links.size) this.change((doc) => doc.floors.forEach((f) => (f.ha_floor = links.get(f.id) ?? f.ha_floor)));
  }

  async loadImage(this: Fp3dEditor, imageId: string): Promise<void> {
    this.loadingImages.add(imageId);
    try {
      const url = await fetchImage(this.hass, imageId, this.home);
      const img = new Image();
      img.src = url;
      await img.decode();
      this._images = { ...this._images, [imageId]: { url, aspect: img.naturalHeight / img.naturalWidth } };
    } catch {
      // image missing (e.g. removed): the background stays empty
    }
  }

  async uploadBackground(this: Fp3dEditor, e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      await this.storeBackground(file);
    } catch (err) {
      await this.tell(isImagesFull(err) ? this.t("images_full") : this.t("picture_failed", { error: errorText(err) }));
    }
  }

  async storeBackground(this: Fp3dEditor, file: File): Promise<void> {
    const bitmap = await createImageBitmap(file);
    const k = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * k);
    canvas.height = Math.round(bitmap.height * k);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.85);
    const imageId = uid("img");
    await storeImage(this.hass, imageId, data, this.home);
    this._images = { ...this._images, [imageId]: { url: data, aspect: canvas.height / canvas.width } };
    const b = this.floor?.rooms.length ? bounds(this.floor.rooms.flatMap((r) => r.points)) : null;
    this.updateFloor({ background: { image_id: imageId, x: b ? b.x0 : 0, z: b ? b.z0 : 0, width: b ? Math.max(4, round(b.x1 - b.x0)) : 12, opacity: 0.5 } });
  }

  // ------------------------------------------------------------------ rendering

  /** "Later" on the news: gone for this visit of the editor, back the next time. */

  /** Work on another floor (from the floor menu of the toolbar). */
  selectFloor(this: Fp3dEditor, id: string): void {
    this._floorId = id;
    this._roomId = null;
    this._vertex = null;
    this._draft = [];
    this.fit();
  }

  /**
   * "Edit room" / "Edit floor" from the 3D view (#249): this floor with "Select", the room (or an outdoor area acting as
   * one) chosen and its panel open; without a room, the floor's settings. A floor or room no longer there: false.
   */
  goToRoom(this: Fp3dEditor, floorId: string | null, roomId: string | null): boolean {
    const floors = this._doc.floors;
    const fl = floors.find((f) => f.id === floorId) ?? floors.find((f) => !!roomId && (f.rooms.some((r) => r.id === roomId) || f.outdoor.some((o) => o.id === roomId)));
    if (!fl) return false;
    this._toolMenu = null;
    this.setTool("select");
    this.selectFloor(fl.id);
    if (roomId && fl.rooms.some((r) => r.id === roomId)) this.selectItem("room", roomId);
    else if (roomId && fl.outdoor.some((o) => o.id === roomId)) this.selectItem("outdoor", roomId);
    else this.selectItem("room", null);
    this._sideOpen = true;
    this.setSideFolded(false);
    return !roomId || this._roomId === roomId || this._outdoorId === roomId;
  }

  /**
   * The floor worked on, always at hand at the left of the toolbar whatever the tool: a menu with every floor (top
   * floor first), "New floor" (from a Home Assistant floor or empty) and the floor's settings in the sidebar.
   */
  renderFloorMenu(this: Fp3dEditor) {
    const floors = this._doc.floors;
    const floor = this.floor;
    const admin = this.isEditor;
    const open = this._toolMenu === "floor";
    const close = () => ((this._toolMenu = null), (this._floorMenu = false));
    return html`<div class="fp3d-seg fp3d-seg-menu fp3d-seg-floor">
      <div class="fp3d-menu-wrap">
        <button aria-haspopup="menu" aria-expanded=${open} @click=${() => this.openToolMenu(open ? null : "floor")}>
          <span class="fp3d-menu-label">${this.t("floor_label")}</span> ${floor?.name ?? this.t(floors.length ? "floors" : "floor_none")} <span class="fp3d-caret">▾</span>
        </button>
        ${open
          ? html`<div class="fp3d-menu-veil" @click=${close}></div>
              <div class="fp3d-menu" role="menu" @keydown=${(e: KeyboardEvent) => this.menuKeys(e)}>
                ${[...floors].reverse().map(
                  (f) => html`<button role="menuitem" class="fp3d-menu-item ${f.id === this._floorId ? "fp3d-menu-on" : ""}" @click=${() => (close(), this.selectFloor(f.id))}>
                    ${f.name}<span class="fp3d-menu-more">${f.id === this._floorId ? "✓" : ""}</span>
                  </button>`,
                )}
                ${admin
                  ? html`<div class="fp3d-menu-sep"></div>
                      <button
                        role="menuitem"
                        class="fp3d-menu-item"
                        aria-expanded=${this.freeHaFloors.length ? this._floorMenu : nothing}
                        @click=${() => (this.freeHaFloors.length ? (this._floorMenu = !this._floorMenu) : (close(), this.addFloor()))}
                      >
                        ${this.t("add_floor")}${this.freeHaFloors.length ? html`<span class="fp3d-menu-more">${this._floorMenu ? "▾" : "▸"}</span>` : nothing}
                      </button>
                      ${this._floorMenu
                        ? html`<div class="fp3d-menu-sub">
                            ${this.freeHaFloors.map((f) => html`<button class="fp3d-chip" @click=${() => (close(), this.addFloor(f))}>${f.name}</button>`)}
                            <button class="fp3d-chip" @click=${() => (close(), this.addFloor())}>${this.t("floor_empty")}</button>
                          </div>`
                        : nothing}
                      ${floor
                        ? html`<button
                            role="menuitem"
                            class="fp3d-menu-item"
                            @click=${() => {
                              close();
                              // the floor's settings are the sidebar's first page: "Select", nothing chosen
                              this.setTool("select");
                              this.selectItem("room", null);
                              this._sideOpen = true;
                              // a phone shows them in the details sheet (#250)
                              this.showSheet("half");
                            }}
                          >
                            ${this.t("floor_settings")}
                          </button>`
                        : nothing}`
                  : nothing}
              </div>`
          : nothing}
      </div>
    </div>`;
  }

  renderBackground(this: Fp3dEditor, floor: Floor | undefined) {
    const bg = floor?.background;
    const img = bg ? this._images[bg.image_id] : undefined;
    if (!bg || !img) return nothing;
    const [x, y] = this.toScreen([bg.x, bg.z]);
    const w = bg.width * this._view.scale;
    const h = w * img.aspect;
    const rot = bg.rotation ?? 0;
    const edit = this.bgHandles();
    // while editing, the picture takes the pointer (drag moves it) and its lower right corner scales it
    return svg`<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
      <image href=${img.url} x=${x} y=${y} width=${w} height=${h} opacity=${bg.opacity} preserveAspectRatio="none" pointer-events=${edit ? "auto" : "none"} data-bg="1" style=${edit ? "cursor:move" : ""} />
      ${edit
        ? svg`<rect class="fp3d-bg-frame" x=${x} y=${y} width=${w} height=${h} />
          <circle class="fp3d-bg-handle" data-bg-handle="1" cx=${x + w} cy=${y + h} r="9" />
          <g class="fp3d-rotate" data-bg-rotate="1">
            <line x1=${x + w / 2} y1=${y} x2=${x + w / 2} y2=${y - 30} />
            <circle cx=${x + w / 2} cy=${y - 30} r="16" class="fp3d-hit" />
            <circle cx=${x + w / 2} cy=${y - 30} r="8" />
            <path d="M${x + w / 2 - 4} ${y - 31}a4 4 0 1 1 2 3.5" />
          </g>`
        : nothing}
    </g>${this.renderBgRuler()}`;
  }

  /** The picture has handles (move, scale, turn) only while "Move and scale" is switched on, with the select tool. */
  bgHandles(this: Fp3dEditor): boolean {
    return !!this.floor?.background && this.isEditor && this._tool === "select" && this._bgEdit;
  }

  /** The ruler's points and line over the background (#183), or the straighten line. */
  renderBgRuler(this: Fp3dEditor) {
    const pts = this._bgLevel?.length ? this._bgLevel : this._bgRuler;
    if (!pts?.length) return nothing;
    const s = pts.map((p) => this.toScreen(p));
    return svg`<g class="fp3d-bg-ruler">
      ${s.length === 2 ? svg`<line x1=${s[0][0]} y1=${s[0][1]} x2=${s[1][0]} y2=${s[1][1]} />` : nothing}
      ${s.map(([x, y]) => svg`<circle cx=${x} cy=${y} r="6" />`)}
    </g>`;
  }

  /** Turn the background about the first tap so the tapped line runs exactly along x or z (whichever is nearer). */
  applyBgLevel(this: Fp3dEditor, p: Vec2, q: Vec2): void {
    const bg = this.floor?.background;
    const img = bg ? this._images[bg.image_id] : undefined;
    this._bgLevel = null;
    if (!bg || !img || Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05) return;
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const delta = Math.round(a / (Math.PI / 2)) * (Math.PI / 2) - a;
    if (Math.abs(delta) < 1e-4) return;
    // turning about p moves the picture's middle along: c' = p + R(delta) (c − p)
    const h = bg.width * img.aspect;
    const c: Vec2 = [bg.x + bg.width / 2, bg.z + h / 2];
    const dx = c[0] - p[0];
    const dz = c[1] - p[1];
    const c2: Vec2 = [p[0] + dx * Math.cos(delta) - dz * Math.sin(delta), p[1] + dx * Math.sin(delta) + dz * Math.cos(delta)];
    let rot = (bg.rotation ?? 0) + (delta * 180) / Math.PI;
    rot = Math.round((((((rot + 180) % 360) + 360) % 360) - 180) * 100) / 100;
    this.updateFloor({ background: { ...bg, rotation: rot, x: round(c2[0] - bg.width / 2), z: round(c2[1] - h / 2) } });
  }

  /** Scale the background about the ruler's first point so the measured stretch gets its real length (#183). */
  applyBgRuler(this: Fp3dEditor, real: number): void {
    const floor = this.floor;
    const bg = floor?.background;
    const pts = this._bgRuler;
    const img = bg ? this._images[bg.image_id] : undefined;
    if (!bg || !img || !pts || pts.length < 2 || !(real > 0)) return;
    const measured = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    if (measured < 1e-4) return;
    const k = real / measured;
    // scaling about p keeps the turn: the centre moves to p + k (c − p), the size grows by k
    const h = bg.width * img.aspect;
    const c: Vec2 = [bg.x + bg.width / 2, bg.z + h / 2];
    const p = pts[0];
    const c2: Vec2 = [p[0] + k * (c[0] - p[0]), p[1] + k * (c[1] - p[1])];
    const w2 = bg.width * k;
    const h2 = h * k;
    this.updateFloor({ background: { ...bg, width: round(w2), x: round(c2[0] - w2 / 2), z: round(c2[1] - h2 / 2) } });
    this._bgRuler = null;
    this._bgRulerLen = 0;
  }

  /** The picture's own frame: a plan point measured from its top left corner, along its (turned) sides, in metres. */
  bgLocal(this: Fp3dEditor, bg: Background, world: Vec2, aspect: number): Vec2 {
    const h = bg.width * aspect;
    const cx = bg.x + bg.width / 2;
    const cz = bg.z + h / 2;
    const a = (-(bg.rotation ?? 0) * Math.PI) / 180;
    const dx = world[0] - cx;
    const dz = world[1] - cz;
    return [cx + dx * Math.cos(a) - dz * Math.sin(a) - bg.x, cz + dx * Math.sin(a) + dz * Math.cos(a) - bg.z];
  }

  renderGhost(this: Fp3dEditor) {
    const i = this._doc?.floors.findIndex((f) => f.id === this._floorId) ?? -1;
    const below = i > 0 ? this._doc.floors[i - 1] : undefined;
    if (!below) return nothing;
    return svg`<g pointer-events="none">${below.rooms.map(
      (r) => svg`<polygon class="fp3d-ghost" points=${r.points.map((p) => this.toScreen(p).join(",")).join(" ")} />`,
    )}</g>`;
  }

  /** Attic floors: dashed lines where the roof slope leaves 1.5 m and 2 m of headroom, with labels. */
  renderHeadroom(this: Fp3dEditor, floor: Floor) {
    const ceiling = floor.elevation + floor.height;
    const sections = activeSections(this._doc);
    if (!sections.some((s) => sectionCutsBelow(s, ceiling) && sectionAbove(s, floor.elevation))) return nothing;
    const b = { settings: this._doc.settings };
    return svg`${[1.5, 2].map((h) =>
      headroomLines(b, floor.elevation, h).map(([p, q]) => {
        const [x1, y1] = this.toScreen(p);
        const [x2, y2] = this.toScreen(q);
        return svg`<line class="fp3d-headroom" x1=${x1} y1=${y1} x2=${x2} y2=${y2} />
          <text class="fp3d-headroom-label" x=${(x1 + x2) / 2} y=${(y1 + y2) / 2 - 4}>${this.m(h, 1)}</text>`;
      }),
    )}`;
  }

  renderBackgroundForm(this: Fp3dEditor, floor: Floor) {
    const bg = floor.background;
    const open = this._bgOpen;
    return this.foldRow("background", open, () => (this._bgOpen = !open), this.t("background"), "", bg ? 1 : 0, () => html`<div class="fp3d-form">
        <label class="fp3d-btn fp3d-wide fp3d-upload"
          >${this.t("background_upload")}<input type="file" accept="image/png,image/jpeg,image/webp" @change=${this.uploadBackground}
        /></label>
        ${bg
          ? html`${this.len(this.t("x"), bg.x, (v) => this.updateFloor({ background: { ...bg, x: v } }))}
              ${this.len(this.t("z"), bg.z, (v) => this.updateFloor({ background: { ...bg, z: v } }))}
              ${this.len(this.t("background_width"), bg.width, (v) => this.updateFloor({ background: { ...bg, width: Math.max(0.1, v) } }), 0.01, 0.1)}
              ${this.num(this.t("background_rotation"), bg.rotation ?? 0, (v) => this.updateFloor({ background: { ...bg, rotation: Math.round(v * 10) / 10 } }), 0.5)}
              ${this.isEditor
                ? html`<button
                      class="fp3d-btn fp3d-wide ${this._bgEdit ? "fp3d-primary" : ""}"
                      aria-pressed=${this._bgEdit}
                      @click=${() => {
                        this._bgEdit = !this._bgEdit;
                        // the handles need the select tool
                        if (this._bgEdit) this._tool = "select";
                      }}
                    >
                      ${this.t(this._bgEdit ? "background_edit_done" : "background_edit")}
                    </button>
                    <p class="fp3d-sub fp3d-wide">${this.t(this._bgEdit ? "background_handles_hint" : "background_fixed_hint")}</p>
                  <button class="fp3d-btn fp3d-wide ${this._bgLevel ? "fp3d-primary" : ""}" aria-pressed=${!!this._bgLevel} @click=${() => {
                    this._bgLevel = this._bgLevel ? null : [];
                    this._bgRuler = null;
                    this._bgEdit = false;
                  }}>📐 ${this.t(this._bgLevel ? "bg_level_cancel" : "bg_level")}</button>
                  ${this._bgLevel ? html`<p class="fp3d-sub fp3d-wide">${this.t(this._bgLevel.length ? "bg_level_second" : "bg_level_first")}</p>` : nothing}
                  <button class="fp3d-btn fp3d-wide ${this._bgRuler ? "fp3d-primary" : ""}" aria-pressed=${!!this._bgRuler} @click=${() => {
                    this._bgRuler = this._bgRuler ? null : [];
                    this._bgLevel = null;
                    this._bgEdit = false;
                  }}>📏 ${this.t(this._bgRuler ? "bg_ruler_cancel" : "bg_ruler")}</button>
                  ${this._bgRuler
                    ? this._bgRuler.length < 2
                      ? html`<p class="fp3d-sub fp3d-wide">${this.t(this._bgRuler.length ? "bg_ruler_second" : "bg_ruler_first")}</p>`
                      : html`<p class="fp3d-sub fp3d-wide">${this.t("bg_ruler_length_hint", { m: this.m(Math.hypot(this._bgRuler[1][0] - this._bgRuler[0][0], this._bgRuler[1][1] - this._bgRuler[0][1])) })}</p>
                          <label class="fp3d-field"
                            >${unitLabel(this.t("bg_ruler_length"), this.unit)}
                            <input type=${this.unit === "imperial" ? "text" : "number"} min="0.01" step="0.01" .value=${this._bgRulerLen ? this.lenValue(this._bgRulerLen) : ""} @input=${(e: Event) => (this._bgRulerLen = this.readLen((e.target as HTMLInputElement).value) ?? 0)} @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this.applyBgRuler(this._bgRulerLen)}
                          /></label>
                          <button class="fp3d-btn fp3d-primary" ?disabled=${!(this._bgRulerLen > 0)} @click=${() => this.applyBgRuler(this._bgRulerLen)}>${this.t("bg_ruler_apply")}</button>`
                    : nothing}`
                : nothing}
              <label class="fp3d-field"
                >${this.t("background_opacity")}
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  .value=${String(bg.opacity)}
                  @change=${(e: Event) => this.updateFloor({ background: { ...bg, opacity: parseFloat((e.target as HTMLInputElement).value) } })}
              /></label>
              <button class="fp3d-btn fp3d-danger fp3d-wide" @click=${() => this.updateFloor({ background: null })}>${this.t("background_remove")}</button>`
          : nothing}
      </div>`);
  }
}
