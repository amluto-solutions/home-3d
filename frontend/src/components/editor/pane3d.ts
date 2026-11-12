// The 3D pane beside the plan (#89 split): its bar, the divider, moves and surface grabs made in 3D.

import { html, nothing } from "lit";
import { defaultHeight, entityName, kindOf } from "../../devices.ts";
import { formatImperial, unitLabel } from "../../units.ts";
import { clampIntoRoom, keepInRoom, snapToWall } from "../../geometry/snap.ts";
import { clampField, fieldFace, roofFaces, wallFaces, windowAsField, onFace, onField, rayOnFace, type RoofFace } from "../../solar.ts";
import type { SurfaceRay } from "../../viewer/viewer3d.ts";
import type { I18nKey } from "../../i18n.ts";
import { ENERGY_DEVICES, canLift, type LampMount, type SolarField } from "../../model.ts";
import type { WallMode } from "../../viewer/viewer3d.ts";
import { furnitureName } from "../../furniture-names.ts";
import { mountBase } from "../../packs.ts";
import { MAX_MOUNT_Y, round } from "./helpers.ts";
import { EDITOR_SYNC_MS } from "../../viewer/pace.ts";
import type { PlanChange } from "../../building-controller.ts";
import type { Fp3dEditor } from "../editor.ts";

/** Pane3dPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class Pane3dPart {
  /** Hand the draft to the 3D pane a moment after the last change (a drag changes it many times a second). */
  queue3d(this: Fp3dEditor): void {
    clearTimeout(this.doc3dTimer);
    this.doc3dTimer = setTimeout(() => (this._doc3d = this.docWithDraft()), 150);
  }

  /** Dragging the divider between the plan and the 3D pane changes their share of the width. */
  onSplitDown(this: Fp3dEditor, e: PointerEvent): void {
    const pair = (e.currentTarget as HTMLElement).parentElement!;
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const rect = pair.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      this._splitRatio = Math.min(0.8, Math.max(0.2, (ev.clientX - rect.left) / rect.width));
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      try {
        localStorage.setItem("home3d.editorSplit", String(Math.round(this._splitRatio * 100)));
      } catch {
        /* no storage */
      }
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
    e.preventDefault();
  }

  toggleSplit(this: Fp3dEditor): void {
    this._split = !this._split;
    // on a phone the 3D view opens full screen over the plan (#263): asked for each time, not remembered
    if (this._phone) return;
    try {
      localStorage.setItem("home3d.editor3d", this._split ? "1" : "0");
    } catch {
      // no storage: the choice lasts for this page
    }
  }

  /**
   * A change from the 3D view's ⚙ sheet or ★ menu (#212): made on the draft like any other edit, so it can be undone
   * and goes out with the editor's save. Taking the event keeps the view from saving the plan behind the editor's back.
   */
  onPlanChange3d(this: Fp3dEditor, e: CustomEvent<{ change: PlanChange }>): void {
    e.preventDefault();
    this.change((doc) => e.detail.change(doc));
  }

  /**
   * An item tapped or grabbed in the 3D pane. One of a multi selection keeps the selection: grabbing it moves them
   * all, as in the plan (selecting it alone dropped the others, and only the grabbed item moved).
   */
  onFurnitureSelected3d(this: Fp3dEditor, e: CustomEvent<{ id: string | null }>): void {
    const id = e.detail.id;
    if (id && this._multi.length > 1 && this._multi.includes(id)) return;
    if (id) this.selectFrom3d("furniture", id);
    else if (this._furnitureId) this.selectFrom3d("furniture", null);
  }

  /** Furnishing in the 3D pane: the item moved there is moved in the draft (undoable, saved with the plan). */
  onFurnitureMoved3d(this: Fp3dEditor, e: CustomEvent<{ id: string; x: number; z: number }>): void {
    const { id, x, z } = e.detail;
    const wall = this._doc.settings.wall_interior;
    // a part of a block (or of a multi selection) takes the others along by the same step
    const sel = this._wallView ? this.wallSelection() : this._furnitureId ? this.selection() : [];
    const together = sel.includes(id) && sel.length > 1 ? sel : [];
    if (together.length) {
      const f = this.floor?.furniture.find((m) => m.id === id);
      if (!f || together.some((x2) => this.isFixedItem("furniture", x2))) return;
      const dx = round(x - f.x);
      const dz = round(z - f.z);
      const ids = new Set(together);
      this.change((_, floor) => {
        for (const m of floor.furniture) if (ids.has(m.id)) Object.assign(m, { x: round(m.x + dx), z: round(m.z + dz) });
      });
      return;
    }
    this.change((doc) => {
      for (const floor of doc.floors) {
        const f = floor.furniture.find((m) => m.id === id);
        if (!f) continue;
        // the item stays in its room (no dragging through walls)
        const [kx, kz] = keepInRoom(floor, f.x, f.z, x, z);
        const [nx, nz] = clampIntoRoom(floor, f, kx, kz, wall);
        const was = snapToWall(floor, f, wall);
        const gapBefore = was ? Math.hypot(was.x - f.x, was.z - f.z) : Infinity;
        Object.assign(f, { x: nx, z: nz });
        const snap = snapToWall(floor, f, wall);
        // pulled away from the wall (a fridge 15 cm forward): it stays where it was put instead of snapping back
        if (snap && Math.hypot(snap.x - nx, snap.z - nz) <= gapBefore + 0.01) Object.assign(f, snap);
      }
    });
  }

  onDeviceMoved3d(this: Fp3dEditor, e: CustomEvent<{ id: string; x: number; z: number }>): void {
    const { id, x, z } = e.detail;
    this.change((doc) => {
      for (const floor of doc.floors) {
        const p = floor.placements.find((d) => d.entity_id === id);
        if (!p) continue;
        const [nx, nz] = keepInRoom(floor, p.x, p.z, x, z);
        Object.assign(p, { x: nx, z: nz });
      }
    });
  }

  /** Bar under the 3D pane: turn or delete the selected item or device (as when furnishing in the panel). */
  render3dBar(this: Fp3dEditor) {
    if (!this.isEditor) return nothing;
    const f = this.furnitureItem;
    const d = this.device;
    if (f) {
      const wallItem = canLift(f);
      const num = (key: "w" | "d" | "h", label: string, min = 0.05) => html`<label class="fp3d-3d-size" title=${this.t(`size_${key}` as I18nKey)}
        >${label}
        <input
          type=${this.unit === "imperial" ? "text" : "number"}
          inputmode="decimal"
          step="0.05"
          min=${min}
          .value=${this.unit === "imperial" ? formatImperial(f[key]) : String(Math.round(f[key] * 100) / 100)}
          @change=${(e: Event) => {
            const v = this.readLen((e.target as HTMLInputElement).value);
            if (v !== null && v >= min) this.updateFurniture({ [key]: Math.round(v * 1000) / 1000 });
          }}
        />
      </label>`;
      return html`<div class="fp3d-3d-bar">
        <span>${furnitureName(this.hass, f.type)}</span>
        ${num("w", this.t("size_short_w"))} ${num("d", this.t("size_short_d"))} ${num("h", this.t("size_short_h"))}
        ${wallItem
          ? html`<label class="fp3d-3d-size" title=${unitLabel(this.t("mount_height"), this.unit)}
              >↕
              <input
                type=${this.unit === "imperial" ? "text" : "number"}
                inputmode="decimal"
                step="0.05"
                min="0"
                .value=${this.unit === "imperial" ? formatImperial(f.mount_y ?? mountBase(this.floor!, f)) : String(Math.round((f.mount_y ?? mountBase(this.floor!, f)) * 100) / 100)}
                @change=${(e: Event) => {
                  const v = this.readLen((e.target as HTMLInputElement).value);
                  if (v !== null && v >= 0) this.updateFurniture({ mount_y: Math.round(Math.min(MAX_MOUNT_Y, v) * 1000) / 1000 });
                }}
              />
            </label>`
          : nothing}
        <button class="fp3d-chip" @click=${() => this.rotateFurniture(-45)}>↺ 45°</button>
        <button class="fp3d-chip" @click=${() => this.rotateFurniture(45)}>↻ 45°</button>
        ${this.fixButton("furniture", f.id)}
        <button class="fp3d-chip fp3d-danger-chip" @click=${() => this.deleteFurniture()}>${this.t("delete")}</button>
      </div>`;
    }
    if (d) {
      const kind = kindOf(d.entity_id);
      const light = kind === "light";
      const auto = kind ? defaultHeight(kind, this.floor?.height ?? 2.5, light ? (d.mount ?? "ceiling") : null) : 1;
      return html`<div class="fp3d-3d-bar">
        <span>${entityName(this.hass, d.entity_id)}</span>
        ${light
          ? html`<select class="fp3d-3d-select" title=${this.t("lamp_mount")} @change=${(e: Event) => this.updateDevice({ mount: (e.target as HTMLSelectElement).value as LampMount, y: null })}>
              ${(["ceiling", "floor", "table", "wall"] as const).map((m) => html`<option value=${m} ?selected=${m === (d.mount ?? "ceiling")}>${this.t(`lamp_${m}`)}</option>`)}
            </select>`
          : nothing}
        <label class="fp3d-3d-size" title=${unitLabel(this.t("marker_height"), this.unit)}
          >${this.t("size_short_h")}
          <input
            type=${this.unit === "imperial" ? "text" : "number"}
            inputmode="decimal"
            step="0.05"
            min="0"
            .value=${this.lenValue(d.y ?? auto)}
            @change=${(e: Event) => {
              const v = this.readLen((e.target as HTMLInputElement).value);
              if (v !== null && v >= 0) this.updateDevice({ y: Math.round(v * 1000) / 1000 });
            }}
          />
        </label>
        <button class="fp3d-chip" @click=${() => this.updateDevice({ rotation: ((((d.rotation ?? 0) - 45) % 360) + 360) % 360 })}>↺ 45°</button>
        <button class="fp3d-chip" @click=${() => this.updateDevice({ rotation: (((d.rotation ?? 0) + 45) % 360) % 360 })}>↻ 45°</button>
        ${this.fixButton("device", d.entity_id)}
        <button class="fp3d-chip fp3d-danger-chip" @click=${() => this.deleteItem("device", d.entity_id)}>${this.t("delete")}</button>
      </div>`;
    }
    return nothing;
  }

  grab3dStart(this: Fp3dEditor, ray: SurfaceRay): boolean {
    const doc = this._doc;
    const roof = roofFaces(doc);
    let best: { id: string; win: boolean; t: number; du: number; ds: number } | null = null;
    const consider = (id: string, win: boolean, face: RoofFace | null, field: SolarField, locked = false) => {
      if (!face || locked) return;
      const hit = rayOnFace(face, ray.o, ray.d);
      if (!hit || !onField(face, field, hit.u, hit.s) || (best && best.t <= hit.t)) return;
      best = { id, win, t: hit.t, du: hit.u - field.u, ds: hit.s - field.v };
    };
    if (this._tool === "energy") for (const f of doc.settings.roof.solar ?? []) consider(f.id, false, fieldFace(doc, f, roof), f, !!f.locked);
    if (this._tool === "roof") for (const w of doc.settings.roof.windows ?? []) consider(w.id, true, roof.find((x) => x.key === w.face) ?? null, windowAsField(w), !!w.locked);
    if (!best) return false;
    const b = best as { id: string; win: boolean; du: number; ds: number };
    this.grab3d = { id: b.id, win: b.win, du: b.du, ds: b.ds, base: doc, moved: false };
    if (b.win) this._roofWinId = b.id;
    else this.selectSolar(b.id);
    return true;
  }

  grab3dMove(this: Fp3dEditor, ray: SurfaceRay): void {
    const g = this.grab3d;
    if (!g) return;
    const doc = g.base;
    const winSrc = g.win ? doc.settings.roof.windows?.find((x) => x.id === g.id) : undefined;
    const src = g.win ? (winSrc ? windowAsField(winSrc) : undefined) : doc.settings.roof.solar?.find((x) => x.id === g.id);
    if (!src) return;
    const own = fieldFace(doc, src);
    // free-standing fields stay on their own level; the others go to the face nearest under the pointer
    const faces = own?.unbounded ? [own] : g.win ? roofFaces(doc) : [...roofFaces(doc), ...wallFaces(doc)];
    let best: { face: RoofFace; t: number; u: number; s: number } | null = null;
    for (const face of faces) {
      const hit = rayOnFace(face, ray.o, ray.d);
      if (hit && onFace(face, hit.u, hit.s) && (!best || hit.t < best.t)) best = { face, ...hit };
    }
    if (!best) return;
    const face = best.face;
    const step = 0.05;
    const snapTo = (v: number) => round(Math.round(v / step) * step);
    const kept = clampField(face, { ...src, face: face.key, u: snapTo(best.u - g.du), v: snapTo(best.s - g.ds), tilt: face.flat ? (src.tilt ?? 15) : src.tilt });
    g.moved = true;
    this.change(
      (d) => {
        if (g.win) {
          const w = d.settings.roof.windows?.find((x) => x.id === g.id);
          if (w) Object.assign(w, { face: face.key, ...kept });
          return;
        }
        const f = d.settings.roof.solar?.find((x) => x.id === g.id);
        if (f) Object.assign(f, { face: face.key, ...kept }, face.flat && f.tilt == null ? { tilt: 15 } : {});
      },
      g.base,
      false,
    );
  }

  render3d(this: Fp3dEditor) {
    return html`<div class="fp3d-editor-3d">
      ${this.houseTool
        ? nothing
        : html`<div class="fp3d-seg fp3d-3d-walls">
            <button aria-pressed=${this._wall3d === "auto"} @click=${() => this.setWall3d("auto")}>${this.t("walls_auto")}</button>
            <button aria-pressed=${this._wall3d === "cut"} @click=${() => this.setWall3d("cut")}>${this.t("walls_cut")}</button>
          </div>`}
      ${this._phone
        ? html`<button class="fp3d-3d-fold" title=${this.t("split_back_2d_hint")} aria-label=${this.t("split_back_2d_hint")} @click=${() => this.toggleSplit()}>← ${this.t("split_back_2d")}</button>`
        : html`<button class="fp3d-3d-fold" title=${this.t("split_fold_hint")} aria-label=${this.t("split_fold_hint")} @click=${() => this.toggleSplit()}>✕ 3D</button>`}
      ${this.render3dBar()}
      <fp3d-view3d
              .walkable=${false}
        .pivotMark=${true}
        .hass=${this.rawHass}
        .syncPace=${EDITOR_SYNC_MS}
        .home=${this.home}
        .building=${this._doc3d}
        .floorId=${this.houseTool ? null : this._floorId}
        .roomId=${null}
        .wallMode=${this.houseTool ? "auto" : this._wall3d}
        .explode=${false}
        .keepRoof=${this._tool === "roof" || this._tool === "energy"}
        .markerMode=${"important"}
        .heatMode=${"none"}
        .theme=${"neon"}
        .packs=${this.packs}
        .showEnergy=${false}
        .holograms=${this._tool === "energy" ? true : null}
        .flows=${false}
        ?furnish=${this.isEditor}
        .surfaceGrab=${this.isEditor && this.houseTool ? this.surfaceGrabber : null}
        .furnishTypes=${this._tool === "energy" ? ENERGY_DEVICES : this._tool === "roof" ? [] : null}
        .selectedFurniture=${this._furnitureId}
        .selectedSet=${this._furnitureId ? this.selection() : []}
        .selectedDevice=${this._deviceId}
        .quality=${"auto"}
        .floorThumbs=${false}
        .roomLabels=${true}
        .floorStack=${this.houseTool ? "stacked" : "single"}
        .panelOpen=${false}
        .alerts=${false}
        .scenes=${false}
        @furniture-select=${this.onFurnitureSelected3d}
        @furniture-move=${this.onFurnitureMoved3d}
        @plan-change=${this.onPlanChange3d}
        @device-select=${(e: CustomEvent<{ id: string | null }>) => {
          if (e.detail.id) this.selectFrom3d("device", e.detail.id);
          else if (this._deviceId) this.selectFrom3d("device", null);
        }}
        @device-move=${this.onDeviceMoved3d}
        @floor-tap=${(e: CustomEvent<{ floorId: string | null }>) => {
          if (e.detail.floorId) this._floorId = e.detail.floorId;
          this._sideOpen = false;
        }}
        @room-tap=${(e: CustomEvent<{ floorId: string; roomId: string | null }>) => {
          if (e.detail.floorId) this._floorId = e.detail.floorId;
          if (e.detail.roomId) this.selectFrom3d("room", e.detail.roomId);
          else this._sideOpen = false;
        }}
      ></fp3d-view3d>
    </div>`;
  }

  setWall3d(this: Fp3dEditor, mode: WallMode): void {
    this._wall3d = mode;
    try {
      localStorage.setItem("home3d.walls3d", mode);
    } catch {
      // no storage: not remembered
    }
  }
}
