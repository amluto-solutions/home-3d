// Outdoor areas: adding, editing and drawing them, their devices and form, and the bins' kerb spot.

import { html, nothing, svg } from "lit";
import { areaEntities, entityName, groupByDevice, isPlaceable, kindOf } from "../../devices.ts";
import { OUTDOOR_TOP, poolShapePoints } from "../../model.ts";
import type { I18nKey } from "../../i18n.ts";
import { iconPath } from "../../icons.ts";
import { bounds, centroid, isLamp, isAxisRect, OUTDOOR_TYPES, outdoorStanding, outdoorZones, type SlopeDir, pointInPolygon, uid, type Floor, type OutdoorArea, type OutdoorType, type Vec2 } from "../../model.ts";
import { round, patchItem } from "./helpers.ts";
import { thinArea, THIN_HIT_PX } from "./outdoor-find.ts";
import { chosenPoint, pointKeys, renderMids } from "./points.ts";
import type { Fp3dEditor } from "../editor.ts";

/** OutdoorPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class OutdoorPart {
  addOutdoor(this: Fp3dEditor, points: Vec2[]): void {
    if (!this.floor) return;
    const type = this._tool === "pool" ? "pool" : (this._outdoorType ?? "lawn");
    const area: OutdoorArea = { id: uid("outdoor"), type, points: points.map(([x, z]) => [round(x), round(z)]) };
    const shape = type === "pool" && !this._outdoorFree ? this._poolShape : "rect";
    if (shape === "round" || shape === "oval") {
      const b = bounds(area.points);
      area.points = poolShapePoints(shape, b.x0, b.z0, b.x1, b.z1);
      area.pool_shape = shape;
    }
    // a new pool comes with its links when a module draws pools (the pool module: its entities are found by name)
    if (type === "pool" && this.pipeRules) area.pool = {};
    this.change((_, floor) => floor.outdoor.push(area));
    this.selectItem("outdoor", area.id);
    // the tool stays: the next area (or the pool's ports and pipes) right away; Esc or "Select" ends it
  }

  updateOutdoor(this: Fp3dEditor, patch: Partial<OutdoorArea>): void {
    const id = this._outdoorId;
    this.change((_, floor) => patchItem(floor.outdoor.find((o) => o.id === id), patch));
  }

  async deleteOutdoor(this: Fp3dEditor): Promise<void> {
    const id = this._outdoorId;
    if (!id || !this.isEditor || !(await this.confirmFixedDelete("outdoor", id))) return;
    // a pool with its pipes is a lot of work: ask first
    const a = this.floor?.outdoor.find((o) => o.id === id);
    const pipes = a?.pool?.pipes?.length ?? 0;
    if (a?.type === "pool" && pipes && !(await this.ask(this.t("pool_delete_confirm", { n: pipes })))) return;
    this.change((_, floor) => (floor.outdoor = floor.outdoor.filter((o) => o.id !== id)));
    this._outdoorId = null;
  }

  duplicateOutdoor(this: Fp3dEditor): void {
    const a = this.outdoorArea;
    if (!a || !this.isEditor) return;
    // like a duplicated room, the copy has no area of its own until one is picked (#186)
    const copy: OutdoorArea = { ...a, id: uid("outdoor"), area_id: null, points: a.points.map(([x, z]) => [round(x + 0.5), round(z + 0.5)]) };
    this.change((_, floor) => floor.outdoor.push(copy));
    this.selectItem("outdoor", copy.id);
  }

  /** The tapped point becomes the selected bin's kerb spot (#142). */
  setKerb(this: Fp3dEditor, world: Vec2): void {
    this._kerbPick = false;
    if (!this.isEditor) return;
    this.updateFurniture({ bin_kerb: { x: Math.round(world[0] * 100) / 100, z: Math.round(world[1] * 100) / 100 } });
  }

  /** The selected bin's kerb spot (#142): a dashed line from the bin to a ring on the spot. */
  renderKerb(this: Fp3dEditor, floor: Floor) {
    const f = this._furnitureId ? floor.furniture.find((x) => x.id === this._furnitureId) : undefined;
    const k = f?.type === "waste_bin" ? f.bin_kerb : null;
    if (!f || !k) return nothing;
    const [ax, ay] = this.toScreen([f.x, f.z]);
    const [bx, by] = this.toScreen([k.x, k.z]);
    return svg`<g pointer-events="none" class="fp3d-kerb">
      <line x1=${ax} y1=${ay} x2=${bx} y2=${by} />
      <circle cx=${bx} cy=${by} r="8" />
    </g>`;
  }

  /** Corner handles of the selected outdoor area (a rectangle stays a rectangle while dragging). */
  renderOutdoorHandles(this: Fp3dEditor, floor: Floor) {
    const a = this._outdoorId && !this._multiOut.length ? floor.outdoor.find((x) => x.id === this._outdoorId) : undefined;
    if (!a || !this.isEditor || (this._tool !== "select" && !(this._tool === "pool" && !this._pipeMode)) || this._doc.settings.lock_plan) return nothing;
    if (a.pool_shape) {
      // a round or oval pool: the corners of its box (it keeps its shape while it grows)
      const b = bounds(a.points);
      const corners: Vec2[] = [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]];
      return svg`${corners.map((p, i) => {
        const [x, y] = this.toScreen(p);
        return svg`<g class="fp3d-vertex fp3d-box-corner" data-out-box=${`${a.id}:${i}`}><circle cx=${x} cy=${y} r="16" class="fp3d-hit" /><rect x=${x - 5} y=${y - 5} width="10" height="10" /></g>`;
      })}`;
    }
    // a "+" on every edge adds a point (#395); the points take the keyboard: Tab, the arrows, Delete
    const sel = chosenPoint(this);
    return svg`${renderMids(this, "data-out-mid", a.id, a.points, !!a.open)}${a.points.map((p, i) => {
      const [x, y] = this.toScreen(p);
      const keys = pointKeys(this, { kind: "out", id: a.id, index: i }, a.points.length);
      const on = sel?.kind === "out" && sel.index === i;
      return svg`<g class=${on ? "fp3d-vertex fp3d-vertex-sel" : "fp3d-vertex"} data-out-vertex=${`${a.id}:${i}`} tabindex="0" role="button" aria-label=${keys.label} @focus=${keys.focus}><circle cx=${x} cy=${y} r="16" class="fp3d-hit" /><circle cx=${x} cy=${y} r="6" /></g>`;
    })}`;
  }

  renderOutdoor(this: Fp3dEditor, floor: Floor) {
    // one pass for every name on the plan (#341): an area's name shows when it has room
    const shown = this.planLabels(floor);
    const hidden = this._hiddenItems;
    return svg`<g>${floor.outdoor.map((a) => {
      if (hidden.length && hidden.includes(a.id)) return nothing;
      const pts = a.points.map((p) => this.toScreen(p).join(",")).join(" ");
      const [cx, cy] = this.toScreen(centroid(a.points));
      return svg`<g data-outdoor=${a.id} class=${`fp3d-out fp3d-out-${a.type}${a.id === this._outdoorId || this._multiOut.includes(a.id) ? " fp3d-out-sel" : ""}`}>
        ${thinArea(a) ? svg`<polygon class="fp3d-out-hit" points=${pts} style=${`stroke-width:${THIN_HIT_PX}px`} />` : nothing}
        <polygon points=${pts} />
        ${shown.has(`o:${a.id}`) ? svg`<text x=${cx} y=${cy + 4}>${this.t(`out_${a.type}` as I18nKey)}</text>` : nothing}
      </g>`;
    })}</g>`;
  }

  /** An outdoor area like a room (#100): a Home Assistant area (with its devices) and a name for chip and 3D. */
  renderOutdoorZone(this: Fp3dEditor, a: OutdoorArea) {
    const admin = this.isEditor;
    const areas = Object.values(this.hass?.areas ?? {}).sort((x, y) => x.name.localeCompare(y.name));
    return html`<label class="fp3d-field fp3d-wide" title=${this.t("outdoor_area_hint")}
        >${this.t("area")}
        <select
          ?disabled=${!admin}
          @change=${(e: Event) => {
            const id = (e.target as HTMLSelectElement).value || null;
            // the area's name is a good first name for the garden or terrace
            const name = (a.name ?? "").trim() || (id ? (this.hass?.areas?.[id]?.name ?? null) : null);
            this.updateOutdoor({ area_id: id, name: id ? name : a.name ?? null });
          }}
        >
          <option value="" ?selected=${!a.area_id}>${this.t("no_area")}</option>
          ${areas.map((x) => html`<option value=${x.area_id} ?selected=${x.area_id === a.area_id}>${x.name}</option>`)}
        </select></label
      >
      ${a.area_id
        ? html`<label class="fp3d-field fp3d-wide"
            >${this.t("room_name")}
            <input .value=${a.name ?? ""} ?disabled=${!admin} @change=${(e: Event) => this.updateOutdoor({ name: (e.target as HTMLInputElement).value.trim() || null })}
          /></label>`
        : nothing}
      <p class="fp3d-sub fp3d-wide">${this.t("outdoor_area_hint")}</p>
      ${a.area_id ? this.renderOutdoorDevices(a) : nothing}`;
  }

  /** The devices of an outdoor area's Home Assistant area, to place on it like a room's (#100). */
  renderOutdoorDevices(this: Fp3dEditor, a: OutdoorArea) {
    const hass = this.hass;
    const floor = this.floor;
    const zone = floor ? outdoorZones(floor).find((z) => z.id === a.id) : undefined;
    if (!hass || !floor || !zone) return nothing;
    const areaName = zone.area_id ? hass.areas?.[zone.area_id]?.name : undefined;
    const groups = groupByDevice(hass, areaEntities(hass, zone.area_id).filter((id) => isPlaceable(kindOf(id))));
    // placed as a pin, or as a lamp (a path light, a garden spot) with this light
    const placed = new Set([
      ...floor.placements.filter((pl) => pointInPolygon([pl.x, pl.z], zone.points)).map((pl) => pl.entity_id),
      ...floor.furniture.filter((m) => isLamp(m.type) && m.entity && pointInPolygon([m.x, m.z], zone.points)).map((m) => m.entity!),
    ]);
    const open = groups.map((g) => g.primary).filter((id) => !placed.has(id));
    const pinned = new Set(a.panel ?? []);
    const hidden = new Set(a.hidden ?? []);
    const noState = new Set(a.no_state ?? []);
    const flip = (list: Set<string>, id: string) => (list.has(id) ? [...list].filter((x) => x !== id) : [...list, id]);
    if (!groups.length) return html`<p class="fp3d-sub fp3d-wide">${this.t("devices_none")}</p>`;
    return html`<div class="fp3d-wide">
      <h4 class="fp3d-lib-head">${this.t("devices")}</h4>
      ${groups.map(
        (g) => html`<div class="fp3d-row fp3d-dev-row ${hidden.has(g.primary) ? "fp3d-dev-hidden" : ""}">
          <button class="fp3d-dev-name ${placed.has(g.primary) ? "" : "fp3d-muted"}" ?disabled=${!placed.has(g.primary)} @click=${() => this.selectItem("device", g.primary)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d=${iconPath(kindOf(g.primary)!)} />
            </svg>
            <span>${entityName(hass, g.primary, areaName)}</span>
          </button>
          ${this.isEditor
            ? html`<button
                  class="fp3d-pin ${hidden.has(g.primary) ? "fp3d-pin-on" : ""}"
                  aria-pressed=${hidden.has(g.primary)}
                  title=${this.t(hidden.has(g.primary) ? "panel_unhide" : "panel_hide")}
                  @click=${() => this.updateOutdoor({ hidden: flip(hidden, g.primary) })}
                >
                  ${hidden.has(g.primary) ? "🙈" : "👁"}
                </button>
                ${hidden.has(g.primary)
                  ? nothing
                  : html`<button
                      class="fp3d-pin ${noState.has(g.primary) ? "fp3d-pin-on" : ""}"
                      aria-pressed=${noState.has(g.primary)}
                      title=${this.t(noState.has(g.primary) ? "panel_state_show" : "panel_state_hide")}
                      @click=${() => this.updateOutdoor({ no_state: flip(noState, g.primary) })}
                    >
                      ${noState.has(g.primary) ? "∅" : "Aa"}
                    </button>`}
                ${placed.has(g.primary)
                  ? nothing
                  : html`<button
                      class="fp3d-pin ${pinned.has(g.primary) ? "fp3d-pin-on" : ""}"
                      aria-pressed=${pinned.has(g.primary)}
                      title=${this.t(pinned.has(g.primary) ? "panel_unpin" : "panel_pin")}
                      @click=${() => this.updateOutdoor({ panel: flip(pinned, g.primary) })}
                    >
                      ${pinned.has(g.primary) ? "★" : "☆"}
                    </button>`}`
            : nothing}
          ${this.isEditor
            ? placed.has(g.primary)
              ? html`<button class="fp3d-link" @click=${() => this.removeDevice(g.primary)}>${this.t("devices_remove")}</button>`
              : html`<button class="fp3d-link" @click=${() => this.placeDevices([g.primary], zone)}>${this.t("devices_place")}</button>`
            : nothing}
        </div>`,
      )}
      ${this.isEditor && open.length > 1
        ? html`<button class="fp3d-link fp3d-place-all" @click=${() => this.placeDevices(open, zone)}>${this.t("devices_place_all_n", { n: open.length })}</button>`
        : nothing}
    </div>`;
  }

  renderOutdoorForm(this: Fp3dEditor, a: OutdoorArea) {
    if (this._multiOut.length > 1) return this.renderMixedForm();
    const admin = this.isEditor;
    const rect = isAxisRect(a.points);
    const b = bounds(a.points);
    const setRect = (field: "x" | "z" | "w" | "d", v: number) => {
      let { x0, z0, x1, z1 } = b;
      if (field === "x") [x0, x1] = [v, v + (x1 - x0)];
      if (field === "z") [z0, z1] = [v, v + (z1 - z0)];
      if (field === "w") x1 = x0 + Math.max(0.1, v);
      if (field === "d") z1 = z0 + Math.max(0.1, v);
      this.updateOutdoor({ points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => [round(x), round(z)] as Vec2) });
    };
    return html`<section>
      ${this.renderPanelHeader({
        id: `outdoor:${a.id}`,
        title: this.t(`out_${a.type}` as I18nKey),
        kind: this.t("outdoor"),
        where: this.floor?.name,
        lock: this.fixLock("outdoor", a.id),
        menu: [
          { label: this.t("duplicate"), keys: ["Ctrl+D"], run: () => this.duplicateOutdoor() },
          { label: this.t("copy_items"), keys: ["Ctrl+C"], run: () => void this.copySelection() },
          this.pasteAction(),
          { label: this.t("delete"), keys: ["Del"], danger: true, run: () => this.deleteOutdoor() },
        ],
      })}
      <div class="fp3d-form">
        <label class="fp3d-field fp3d-wide"
          >${this.t("outdoor_type")}
          <select ?disabled=${!admin} @change=${(e: Event) => this.updateOutdoor({ type: (e.target as HTMLSelectElement).value as OutdoorType })}>
            ${OUTDOOR_TYPES.map((t) => html`<option value=${t} ?selected=${t === a.type}>${this.t(`out_${t}` as I18nKey)}</option>`)}
          </select></label
        >
        ${outdoorStanding(a.type) ? nothing : this.renderOutdoorZone(a)}
        ${rect
          ? html`${this.len(this.t("x"), b.x0, (v) => setRect("x", v))} ${this.len(this.t("z"), b.z0, (v) => setRect("z", v))}
            ${this.len(this.t("width"), b.x1 - b.x0, (v) => setRect("w", v), 0.01, 0.1)} ${this.len(this.t("depth"), b.z1 - b.z0, (v) => setRect("d", v), 0.01, 0.1)}`
          : nothing}
        ${outdoorStanding(a.type)
          ? this.len(this.t("outdoor_height"), a.height ?? OUTDOOR_TOP[a.type], (v) => this.updateOutdoor({ height: Math.min(6, Math.max(0.1, round(v))) }), 0.05, 0.1)
          : a.type === "balcony"
            ? this.len(this.t("balcony_rail"), a.height ?? 1, (v) => this.updateOutdoor({ height: Math.min(2, Math.max(0.4, round(v))) }), 0.05, 0.4)
            : nothing}
        ${this.len(this.t("outdoor_offset"), a.offset ?? 0, (v) => this.updateOutdoor({ offset: Math.min(10, Math.max(-10, round(v))) || null }), 0.05)}
        <p class="fp3d-sub fp3d-wide fp3d-field-note">${this.t("outdoor_offset_note")}</p>
        ${a.type !== "pool"
          ? html`${this.len(this.t("outdoor_slope"), a.slope ?? 0, (v) => this.updateOutdoor({ slope: Math.min(20, Math.max(0, round(v))) || null }), 0.05, 0)}
              ${this.renderSlopeDir(a.slope_dir ?? "x", admin, (d) => this.updateOutdoor({ slope_dir: d }))}`
          : nothing}
        ${a.type === "pool" ? this.renderPoolShape(a) : nothing}
        <label class="fp3d-check fp3d-wide" title=${this.t("outdoor_outline_hint")}
          ><input type="checkbox" .checked=${a.outline !== false} ?disabled=${!admin} @change=${(ev: Event) => this.updateOutdoor({ outline: (ev.target as HTMLInputElement).checked ? undefined : false })} />
          ${this.t("outdoor_outline")}</label
        >
        ${a.type === "fence" || a.type === "pergola"
          ? html`<label class="fp3d-check fp3d-wide" title=${this.t("outdoor_open_hint")}
              ><input type="checkbox" .checked=${!!a.open} ?disabled=${!admin} @change=${(ev: Event) => this.updateOutdoor({ open: (ev.target as HTMLInputElement).checked || undefined })} />
              ${this.t("outdoor_open")}</label
            >`
          : nothing}
        ${a.type === "pergola"
          ? html`<label class="fp3d-check fp3d-wide"
              ><input type="checkbox" .checked=${!!a.bracing} ?disabled=${!admin} @change=${(ev: Event) => this.updateOutdoor({ bracing: (ev.target as HTMLInputElement).checked || undefined })} />
              ${this.t("outdoor_bracing")}</label
            >`
          : nothing}
        <label class="fp3d-check fp3d-wide" title=${this.t("outdoor_cut_hint")}
          ><input type="checkbox" .checked=${!!a.cut} ?disabled=${!admin} @change=${(ev: Event) => this.updateOutdoor({ cut: (ev.target as HTMLInputElement).checked || undefined })} />
          ${this.t("outdoor_cut")}</label
        >
      </div>
      ${a.slope ? html`<p class="fp3d-sub">${this.t("outdoor_slope_hint")}</p>` : nothing}
      <p class="fp3d-sub">${this.t("outdoor_hint")}</p>
      ${this.renderModuleFields(a)}
    </section>`;
  }

  /**
   * "Falls towards" as four arrow buttons on the plan's directions (#418, WORD-9): the arrow points the way the
   * ground runs down; each button is named ("Falls towards the right") and pressed while chosen.
   */
  renderSlopeDir(this: Fp3dEditor, value: SlopeDir, enabled: boolean, set: (d: SlopeDir) => void) {
    const arrows: Record<SlopeDir, [string, string]> = { "-z": ["↑", "up"], "-x": ["←", "left"], x: ["→", "right"], z: ["↓", "down"] };
    return html`<div class="fp3d-field fp3d-slope-dir" role="group" aria-label=${this.t("outdoor_slope_dir")}>
      <span>${this.t("outdoor_slope_dir")}</span>
      <span class="fp3d-arrows">
        ${(["-z", "-x", "x", "z"] as const).map((d) => {
          const name = this.t(`slope_${d.replace("-", "n")}` as I18nKey);
          return html`<button type="button" class="fp3d-btn fp3d-arrow-${arrows[d][1]}" aria-pressed=${d === value ? "true" : "false"} ?disabled=${!enabled} aria-label=${`${this.t("outdoor_slope_dir")} ${name}`} title=${name} @click=${() => set(d)}><span aria-hidden="true">${arrows[d][0]}</span></button>`;
        })}
      </span>
    </div>`;
  }
}
