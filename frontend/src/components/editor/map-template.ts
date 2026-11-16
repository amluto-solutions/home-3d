// Starting a house from the map (#465): the note on an empty ground floor, the house's outline from OpenStreetMap drawn
// as the template to draw on (its corners snap, see plan-view.ts), and "Align to the map" in the template (floor-plan
// picture) section: two corners tapped in the picture, the same two on the outline, and the picture is scaled, turned
// and moved at once. The note itself is a lazy chunk (components/map-start.ts); the maths is bg-align.ts.
// Ported from NeonPlan 3D 3.3.0 (MIT, Mastershort).

import { html, nothing, svg } from "lit";
import { alignBackground, nearestCorner } from "../../bg-align.ts";
import type { I18nKey } from "../../i18n.ts";
import type { Building, Floor, Vec2 } from "../../model.ts";
import { atGroundLevel, mapCorners, ownOutline, surroundFloorId } from "../../surroundings.ts";
import { loadMapStart, need } from "./lazy.ts";
import { SNAP_PX } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** The key the note's "not now" is kept under (the note stays away on this device once put away). */
export const MAP_START_KEY = "home3d.mapStart";

/** MapTemplatePart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class MapTemplatePart {
  /** The note shows: a Home Assistant admin (the map comes from public servers) on an empty ground floor, not put away. */
  mapStartShows(this: Fp3dEditor, floor: Floor | undefined): boolean {
    // while a picture is aligned the note steps aside: it would cover the corners to tap
    return this.isHaAdmin && !!floor && floor.rooms.length === 0 && floor.id === surroundFloorId(this._doc) && !this._mapStartOff && !this._bgMap;
  }

  /** On an empty ground floor: start with the map (the house's outline from OpenStreetMap as the template to draw on). */
  renderMapStart(this: Fp3dEditor, floor: Floor | undefined) {
    if (!this.mapStartShows(floor)) return nothing;
    need(loadMapStart);
    return html`<fp3d-map-start
      .hass=${this.hass}
      .building=${this._doc}
      .t=${(k: string, v?: Record<string, string | number>) => this.t(k as I18nKey, v)}
      @map-start-loaded=${(e: CustomEvent<{ building: Building }>) => this.mapStartLoaded(e.detail.building)}
      @map-start-off=${() => this.mapStartOff()}
    ></fp3d-map-start>`;
  }

  /** The map came in: it is part of the plan now (one undo step), and the view fits the house on it. */
  mapStartLoaded(this: Fp3dEditor, next: Building): void {
    this.setDoc(next);
    this.fit();
  }

  /** "Not now" / "Got it": the note stays away on this device. */
  mapStartOff(this: Fp3dEditor): void {
    this._mapStartOff = true;
    try {
      localStorage.setItem(MAP_START_KEY, "0");
    } catch {
      // no storage: gone for this visit
    }
  }

  /**
   * The house from the map as the template, over the plan: dashed, with its corners marked (they snap). Shown while the
   * ground floor has no room yet, and while the picture is being aligned to it.
   */
  renderMapTemplate(this: Fp3dEditor, floor: Floor) {
    const out = ownOutline(this._doc);
    if (!out || !atGroundLevel(this._doc, floor) || !(floor.rooms.length === 0 || this._bgMap)) return nothing;
    const pts = out.map((p) => this.toScreen(p));
    return svg`<g class="fp3d-map-template" pointer-events="none">
      <polygon points=${pts.map((p) => p.join(",")).join(" ")} fill="rgba(255, 209, 102, 0.12)" stroke="#ffd166" stroke-width="2" stroke-dasharray="8 5" stroke-linejoin="round" />
      ${pts.map(([x, y]) => svg`<circle cx=${x} cy=${y} r="4.5" fill="#ffd166" stroke="#0b1426" stroke-width="1" />`)}
    </g>`;
  }

  /** The corner of a house on the map nearest to a tap (within 2 m or two snap distances), else the tap itself. */
  nearMapCorner(this: Fp3dEditor, p: Vec2): Vec2 {
    return nearestCorner(p, mapCorners(this._doc), (SNAP_PX * 2) / this._view.scale);
  }

  /** Whether "Align to the map" is offered: a house from the map to align to, on the floor the map lies on. */
  canAlignToMap(this: Fp3dEditor, floor: Floor): boolean {
    return !!ownOutline(this._doc) && floor.id === surroundFloorId(this._doc);
  }

  /** The text for the tap to come: bg_map_1 … bg_map_4. */
  bgMapStep(this: Fp3dEditor): string {
    return this.t(`bg_map_${(this._bgMap?.length ?? 0) + 1}` as I18nKey);
  }

  /** Lay the picture onto the map: the stretch between the first two taps lands on the stretch between the last two. */
  applyBgMap(this: Fp3dEditor, [a1, a2, b1, b2]: Vec2[]): void {
    const bg = this.floor?.background;
    const img = bg ? this._images[bg.image_id] : undefined;
    this._bgMap = null;
    if (!bg || !img) return;
    const next = alignBackground(bg, img.aspect, a1, a2, b1, b2);
    if (next) this.updateFloor({ background: next });
  }

  /** The button and its words in the picture section. */
  renderBgMapButton(this: Fp3dEditor, floor: Floor) {
    if (!this.canAlignToMap(floor)) return nothing;
    return html`<button
        class="fp3d-btn fp3d-wide ${this._bgMap ? "fp3d-primary" : ""}"
        aria-pressed=${!!this._bgMap}
        @click=${() => {
          this._bgMap = this._bgMap ? null : [];
          this._bgLevel = null;
          this._bgRuler = null;
          this._bgEdit = false;
        }}
      >
        🗺 ${this.t(this._bgMap ? "bg_map_cancel" : "bg_map")}
      </button>
      <p class="fp3d-sub fp3d-wide">${this._bgMap ? this.bgMapStep() : this.t("bg_map_hint")}</p>`;
  }
}
