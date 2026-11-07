// Solar fields in the energy tool: on roof faces, walls and the ground, their strings, cells, list and form.

import { html, nothing, svg } from "lit";
import { entityName, furnitureEntities } from "../../devices.ts";
import { bestFace, clampField, faceCompass, fieldFace, fieldModules, GROUND, moveField, proposeField, proposeGroundField, proposeWallField, roofFaces, rowCounts, turnGroundField, fieldCenter, wallFaces, type RoofFace } from "../../solar.ts";
import { formatNumber, type I18nKey } from "../../i18n.ts";
import { uid, type SolarField, type SolarString, type Vec2 } from "../../model.ts";
import { energyRole } from "../../packs.ts";
import { round } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";
import { stateChip } from "./panel-head.ts";

/** SolarPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class SolarPart {
  /** Draw roof solar fields faint over the plan (or at full strength); remembered on this device (#89). */
  setSolarDim(this: Fp3dEditor, on: boolean): void {
    this._solarDim = on;
    try {
      localStorage.setItem("home3d.solarDim", on ? "on" : "off");
    } catch {
      // no storage: this session only
    }
  }

  /** Solar fields over the plan: every module as a small rectangle; the selected field highlighted. */
  renderSolarFields(this: Fp3dEditor) {
    const fields = this._doc.settings.roof.solar ?? [];
    if (!fields.length) return nothing;
    const faces = roofFaces(this._doc);
    return svg`<g class="fp3d-solar-layer">${fields.map((f) => {
      const face = fieldFace(this._doc, f, faces);
      if (!face || (face.wall && face.wall.floorId !== this._floorId)) return nothing;
      const sel = f.id === this._solarId;
      // a field on the roof lies over every floor's plan: faint unless chosen, so the rooms under it stay readable
      const dim = this._solarDim && !sel && !face.wall && !face.unbounded;
      let handle: unknown = nothing;
      if (sel && face.unbounded && this.isEditor && !f.locked) {
        const [cx, cz] = fieldCenter(face, f);
        const r = ((f.rotation ?? 0) * Math.PI) / 180;
        const reach = 0.9 + Math.max(...fieldModules(face, f, true).flatMap((m) => m.corners.map((p) => Math.hypot(p[0] - cx, p[2] - cz)))) * 0.5;
        const [fx, fy] = this.toScreen([cx, cz]);
        const [hx, hy] = this.toScreen([cx + Math.sin(r) * reach, cz - Math.cos(r) * reach]);
        handle = svg`<g class="fp3d-rotate" data-solar-turn=${f.id}>
          <line x1=${fx} y1=${fy} x2=${hx} y2=${hy} />
          <circle cx=${hx} cy=${hy} r="16" class="fp3d-hit" />
          <circle cx=${hx} cy=${hy} r="8" />
          <path d="M${hx - 4} ${hy - 1}a4 4 0 1 1 2 3.5" />
        </g>`;
      }
      // the selected field also shows its switched-off modules (dashed), so they can be switched on again
      return svg`<g data-solar=${f.id} class=${`fp3d-solar${sel ? " fp3d-solar-sel" : ""}${dim ? " fp3d-solar-dim" : ""}${sel && this._solarPick ? " fp3d-solar-pick" : ""}`}>${fieldModules(face, f, sel).map(
        (m) => {
          // on a wall the modules stand upright: in the plan a strip just outside the wall
          // as deep as the modules stand off the wall (tilted ones further), at least 30 cm to grab
          const depth = face.wall ? Math.max(0.3, ...m.corners.map((p) => (p[0] - face.o[0]) * face.n[0] + (p[2] - face.o[2]) * face.n[2])) : 0;
          const pts: Vec2[] = face.wall
            ? [m.corners[0], m.corners[1]].flatMap((p, i) => {
                const q: Vec2 = [p[0], p[2]];
                const o: Vec2 = [p[0] + face.n[0] * depth, p[2] + face.n[2] * depth];
                return i === 0 ? [q, o] : [o, q];
              })
            : m.corners.map((p) => [p[0], p[2]] as Vec2);
          return svg`<polygon data-cell=${m.cell} class=${m.skipped ? "fp3d-solar-off" : ""} points=${pts.map((p) => this.toScreen(p).join(",")).join(" ")} />`;
        },
      )}</g>${handle}`;
    })}</g>`;
  }

  /** "Main roof · south · 35°" or "Section 2 · flat roof". */
  faceLabel(this: Fp3dEditor, face: RoofFace): string {
    if (face.key === GROUND) return this.t("solar_ground");
    if (face.wall) {
      // named by its room and the room's corner numbers in the plan (short walls look alike otherwise, #295)
      const { floorId, room: roomId, edge, free } = face.wall;
      const floor = this._doc.floors.find((x) => x.id === floorId);
      const room = floor?.rooms.find((r) => r.id === roomId);
      const where = free ? this.t("solar_wall_free") : room ? `${room.name}${edge != null ? ` ${edge + 1}–${((edge + 1) % room.points.length) + 1}` : ""}` : "";
      return `${this.t("solar_wall")} ${floor?.name ?? ""} · ${where ? `${where} · ` : ""}${this.t(`compass_${faceCompass(face, this._doc.settings.north ?? 0)}` as I18nKey)} · ${this.m(face.lu, 2)}`;
    }
    const sections = this._doc.settings.roof.sections ?? [];
    const part = face.section ? this.t("solar_section", { n: sections.findIndex((x) => x.id === face.section) + 1 }) : this.t("solar_main");
    if (face.flat) return `${part} · ${this.t("solar_flat")}`;
    // the triangular ends of a hip or pyramid section say so, they are easy to overlook in the list (#302)
    const end = face.side === "c" || face.side === "d" ? ` · ${this.t("roof_shape_hip")}` : "";
    return `${part} · ${this.t(`compass_${faceCompass(face, this._doc.settings.north ?? 0)}` as I18nKey)} · ${Math.round(face.pitch)}°${end}`;
  }

  addSolarField(this: Fp3dEditor): void {
    if (!this.isEditor) return;
    const faces = roofFaces(this._doc);
    const used = new Set((this._doc.settings.roof.solar ?? []).map((f) => f.face));
    // the sunniest face that has no field yet, else the sunniest one
    const north = this._doc.settings.north ?? 0;
    const face = bestFace(faces.filter((f) => !used.has(f.key)), north) ?? bestFace(faces, north);
    if (!face) return;
    const field = proposeField(face, uid("pv"));
    this.change((doc) => (doc.settings.roof.solar = [...(doc.settings.roof.solar ?? []), field]));
    this._solarId = field.id;
    this._roofId = null;
  }

  /** Select a solar field; one on a house wall brings up its floor in the plan. */
  selectSolar(this: Fp3dEditor, id: string): void {
    this._solarId = id;
    this._roofId = null;
    const f = this._doc.settings.roof.solar?.find((x) => x.id === id);
    if (f?.face.startsWith("wall:")) this._floorId = f.face.split(":")[1];
  }

  addWallField(this: Fp3dEditor): void {
    if (!this.isEditor) return;
    const floorId = this._floorId ?? this._doc.floors[0]?.id;
    const field = floorId ? proposeWallField(this._doc, uid("pv"), floorId) : null;
    if (!field) return;
    this.change((doc) => (doc.settings.roof.solar = [...(doc.settings.roof.solar ?? []), field]));
    this._solarId = field.id;
  }

  addGroundField(this: Fp3dEditor): void {
    if (!this.isEditor) return;
    const field = proposeGroundField(this._doc, uid("pv"));
    this.change((doc) => (doc.settings.roof.solar = [...(doc.settings.roof.solar ?? []), field]));
    this._solarId = field.id;
  }

  updateSolar(this: Fp3dEditor, patch: Partial<SolarField>): void {
    const id = this._solarId;
    if (!id || !this.isEditor) return;
    if (patch.locked === false) this._fixedHint = false;
    this.change((doc) => {
      const f = doc.settings.roof.solar?.find((x) => x.id === id);
      if (!f) return;
      Object.assign(f, patch);
      // a larger field (more rows, landscape …) moves back so that it stays on its face where it can
      const face = fieldFace(doc, f);
      if (face) Object.assign(f, clampField(face, f));
    });
  }

  /** Put the selected field into a string ("new" makes one), or take it out (null). */
  setSolarString(this: Fp3dEditor, value: string | null): void {
    const id = this._solarId;
    if (!id || !this.isEditor) return;
    this.change((doc) => {
      const roof = doc.settings.roof;
      const f = roof.solar?.find((x) => x.id === id);
      if (!f) return;
      if (value === "new") {
        const strings = roof.strings ?? [];
        const s: SolarString = { id: uid("str"), name: this.t("solar_string_n", { n: strings.length + 1 }), entity: f.entity ?? null, inverter: null };
        roof.strings = [...strings, s];
        f.string = s.id;
      } else f.string = value;
      // strings without fields go away
      const used = new Set((roof.solar ?? []).map((x) => x.string).filter(Boolean));
      roof.strings = (roof.strings ?? []).filter((x) => used.has(x.id));
    });
  }

  updateSolarString(this: Fp3dEditor, patch: Partial<SolarString>): void {
    const field = this._doc.settings.roof.solar?.find((x) => x.id === this._solarId);
    const sid = field?.string;
    if (!sid || !this.isEditor) return;
    this.change((doc) => {
      const s = doc.settings.roof.strings?.find((x) => x.id === sid);
      if (s) Object.assign(s, patch);
    });
  }

  toggleSolarCell(this: Fp3dEditor, cell: string): void {
    this.updateSolarField((f) => {
      const skip = new Set(f.skip ?? []);
      if (skip.has(cell)) skip.delete(cell);
      else skip.add(cell);
      f.skip = skip.size ? [...skip].sort() : null;
    });
  }

  updateSolarField(this: Fp3dEditor, edit: (f: SolarField) => void): void {
    const id = this._solarId;
    if (!id || !this.isEditor) return;
    this.change((doc) => {
      const f = doc.settings.roof.solar?.find((x) => x.id === id);
      if (f) edit(f);
    });
  }

  deleteSolar(this: Fp3dEditor): void {
    const id = this._solarId;
    if (!id || !this.isEditor) return;
    this.change((doc) => {
      const roof = doc.settings.roof;
      roof.solar = (roof.solar ?? []).filter((x) => x.id !== id);
      const used = new Set(roof.solar.map((x) => x.string).filter(Boolean));
      roof.strings = (roof.strings ?? []).filter((x) => used.has(x.id));
    });
    this._solarId = null;
  }

  /** The energy panel's Solar fold (#418, MANY-7): the fields as 44 px rows, add buttons and the strings, one line of help. */
  renderSolarList(this: Fp3dEditor) {
    const fields = this._doc.settings.roof.solar ?? [];
    const roofList = roofFaces(this._doc);
    const faces = new Map(fields.map((f) => [f.id, fieldFace(this._doc, f, roofList)] as const));
    const admin = this.isEditor;
    const modules = (f: SolarField) => {
      const face = faces.get(f.id);
      return face ? fieldModules(face, f).length : 0;
    };
    const kwp = fields.reduce((a, f) => a + (modules(f) * (f.wp ?? 400)) / 1000, 0);
    const summary = fields.length ? this.t("solar_fold_sum", { n: fields.length, kwp: formatNumber(this.hass, kwp, 1) }) : this.t("solar_fold_none");
    return this.sideFold("energy-solar", "", true, `☀ ${this.t("solar_fields")} (${fields.length})`, summary, 0, () => html`
      <div class="fp3d-with-info"><p class="fp3d-sub">${this.t(roofList.length ? "solar_hint_short" : "solar_no_roof")}</p>${roofList.length ? this.infoButton("solar_hint", this.t("solar_fields")) : nothing}</div>
      ${fields.length
        ? html`<label class="fp3d-check fp3d-solar-dim-toggle"
            ><input type="checkbox" .checked=${this._solarDim} @change=${(e: Event) => this.setSolarDim((e.target as HTMLInputElement).checked)} />
            ${this.t("solar_dim")}</label
          >`
        : nothing}
      ${fields.length
        ? html`<div class="fp3d-pick-list">
            ${fields.map((f, i) => {
              const face = faces.get(f.id);
              const n = modules(f);
              return this.pickRow(
                f.name || `${this.t("solar_field")} ${i + 1}`,
                `${face ? this.faceLabel(face) : this.t("solar_face_gone")} · ${this.t("solar_summary", { n, kwp: formatNumber(this.hass, (n * (f.wp ?? 400)) / 1000, 1) })}`,
                f.id === this._solarId,
                () => this.selectSolar(f.id),
              );
            })}
          </div>`
        : nothing}
      <div class="fp3d-actions">
        <button class="fp3d-btn fp3d-primary" ?disabled=${!admin || !roofList.length} @click=${() => this.addSolarField()}>+ ${this.t("solar_add")}</button>
        <button class="fp3d-btn" ?disabled=${!admin} @click=${() => this.addGroundField()}>+ ${this.t("solar_add_ground")}</button>
        <button class="fp3d-btn" ?disabled=${!admin || !this._floorId} @click=${() => this.addWallField()}>+ ${this.t("solar_add_wall")}</button>
      </div>
      ${(this._doc.settings.roof.strings ?? []).length
        ? html`<h4 class="fp3d-lib-head">${this.t("solar_strings")}</h4>
            ${(this._doc.settings.roof.strings ?? []).map((st) => {
              const own = fields.filter((f) => f.string === st.id);
              const counts = own.map((f) => modules(f));
              const n = counts.reduce((a, b) => a + b, 0);
              const sum = own.reduce((a, f, k) => a + (counts[k] * (f.wp ?? 400)) / 1000, 0);
              return html`<p class="fp3d-sub">🔗 <b>${st.name}</b> · ${this.t("solar_string_sum", { fields: own.length, n, kwp: formatNumber(this.hass, sum, 1) })}</p>`;
            })}`
        : nothing}`);
  }

  renderSolarForm(this: Fp3dEditor, f: SolarField) {
    const admin = this.isEditor;
    const faces = roofFaces(this._doc);
    const walls = wallFaces(this._doc);
    const face = fieldFace(this._doc, f, faces);
    const ground = f.face === GROUND;
    const n = face ? fieldModules(face, f).length : 0;
    const counts = rowCounts(f);
    const total = counts.reduce((a, b) => a + b, 0) - (f.skip?.length ?? 0);
    const power = this.entityOptions((id) => this.isPowerSensor(id));
    const set = (patch: Partial<SolarField>) => this.updateSolar(patch);
    const index = (this._doc.settings.roof.solar ?? []).findIndex((x) => x.id === f.id) + 1;
    return html`<section>
        ${this.renderPanelHeader({
          id: `solar:${f.id}`,
          title: f.name || `${this.t("solar_field")} ${index}`,
          kind: this.t("solar_field"),
          where: face ? this.faceLabel(face) : ground ? this.t("solar_ground") : null,
          live: [f.entity && f.entity !== "none" ? stateChip(this.hass, this.hass?.states[f.entity]) : ""],
          lock: this.ownLock(f.locked, () => this.updateSolar({ locked: !f.locked })),
          menu: [
            face && { label: this.t("solar_fit"), run: () => set({ ...proposeField(face, f.id), portrait: f.portrait }) },
            { label: this.t("delete"), keys: ["Del"], danger: true, run: () => this.deleteSolar() },
          ],
        })}
        ${this.renderRoofFloors()}
        <div class="fp3d-form">
          <label class="fp3d-field fp3d-wide"
            >${this.t("solar_name")}
            <input
              type="text"
              ?disabled=${!admin}
              .value=${f.name ?? ""}
              placeholder=${this.t("solar_name_hint")}
              @change=${(e: Event) => set({ name: (e.target as HTMLInputElement).value.trim() || null })}
          /></label>
          <label class="fp3d-field fp3d-wide"
            >${this.t("solar_face")}
            <select
              ?disabled=${!admin}
              @change=${(e: Event) => {
                const key = (e.target as HTMLSelectElement).value;
                const keep = { portrait: f.portrait, look: f.look, name: f.name, string: f.string, entity: f.entity, module_w: f.module_w, module_h: f.module_h, wp: f.wp };
                // on another face the field keeps its modules and is laid out anew there (#258)
                if (key === GROUND) set({ ...proposeGroundField(this._doc, f.id), ...keep, rows: f.rows, cols: f.cols });
                const next = faces.find((x) => x.key === key);
                if (next) set(moveField(next, { ...f, ...keep }));
                const wall = walls.find((x) => x.key === key);
                if (wall) set(moveField(wall, { ...f, ...keep, rows: 1 }));
              }}
            >
              ${face ? nothing : html`<option selected>${this.t("solar_face_gone")}</option>`}
              ${faces.map((x) => html`<option value=${x.key} ?selected=${x.key === f.face}>${this.faceLabel(x)}</option>`)}
              <option value=${GROUND} ?selected=${ground}>${this.t("solar_ground")}</option>
              ${walls.map((x) => html`<option value=${x.key} ?selected=${x.key === f.face}>${this.faceLabel(x)}</option>`)}
            </select></label
          >
          ${this.num(this.t("solar_rows"), counts.length, (v) => {
            const rows = Math.max(1, Math.min(40, Math.round(v)));
            // rows of their own length keep their counts; new rows take the last row's
            set(f.layout?.length ? { layout: Array.from({ length: rows }, (_, i) => f.layout![i] ?? f.layout![f.layout!.length - 1]), rows } : { rows });
          }, 1, 1)}
          <label class="fp3d-field"
            >${this.t("solar_cols")}
            <input
              type="text"
              inputmode="numeric"
              ?disabled=${!admin}
              .value=${f.layout?.length ? f.layout.join(", ") : String(f.cols)}
              title=${this.t("solar_cols_hint")}
              @change=${(e: Event) => {
                const parts = (e.target as HTMLInputElement).value.split(/[,;\s]+/).map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x) && x >= 0);
                if (!parts.length) return;
                // one number: every row the same; a list: each row its own (4, 4, 3)
                if (parts.length === 1) set({ cols: Math.max(1, Math.min(60, parts[0])), layout: null, skip: null });
                else set({ layout: parts.slice(0, 40).map((x) => Math.min(60, x)), rows: Math.min(40, parts.length), cols: Math.max(1, ...parts), skip: null });
              }}
          /></label>
        </div>
        <p class="fp3d-sub">
          ${face && !face.unbounded ? html`${this.t("solar_face_size", { w: formatNumber(this.hass, face.lu, 1), h: formatNumber(this.hass, face.ls, 1) })} · ` : nothing}${this.t("solar_cols_hint")}
        </p>
        ${f.layout?.length && new Set(f.layout).size > 1
          ? html`<div class="fp3d-seg fp3d-dev-source">
              ${(["left", "center", "right"] as const).map((a) => html`<button aria-pressed=${(f.align ?? "left") === a} ?disabled=${!admin} @click=${() => set({ align: a })}>${this.t(`solar_align_${a}` as I18nKey)}</button>`)}
            </div>`
          : nothing}
        <div class="fp3d-seg fp3d-dev-source">
          <button aria-pressed=${f.portrait !== false} ?disabled=${!admin} @click=${() => set({ portrait: true })}>${this.t("solar_portrait")}</button>
          <button aria-pressed=${f.portrait === false} ?disabled=${!admin} @click=${() => set({ portrait: false })}>${this.t("solar_landscape")}</button>
        </div>
        <div class="fp3d-seg fp3d-dev-source">
          <button aria-pressed=${f.look !== "blue"} ?disabled=${!admin} @click=${() => set({ look: "black" })}>${this.t("solar_look_black")}</button>
          <button aria-pressed=${f.look === "blue"} ?disabled=${!admin} @click=${() => set({ look: "blue" })}>${this.t("solar_look_blue")}</button>
        </div>
        <div class="fp3d-form">
          ${this.len(this.t("solar_module_w"), f.module_w ?? 1.13, (v) => set({ module_w: Math.max(0.3, Math.min(3, round(v))) }), 0.01, 0.3)}
          ${this.len(this.t("solar_module_h"), f.module_h ?? 1.72, (v) => set({ module_h: Math.max(0.3, Math.min(3, round(v))) }), 0.01, 0.3)}
          ${this.num(this.t("solar_wp"), f.wp ?? 400, (v) => set({ wp: Math.max(50, Math.min(1500, Math.round(v))) }), 5, 50)}
        </div>
        <div class="fp3d-actions">
          <button class="fp3d-btn" aria-pressed=${this._solarPick} ?disabled=${!admin} @click=${() => (this._solarPick = !this._solarPick)}>${this._solarPick ? "✓ " : ""}${this.t("solar_pick")}</button>
          ${f.skip?.length ? html`<button class="fp3d-btn" ?disabled=${!admin} @click=${() => set({ skip: null })}>${this.t("solar_pick_all")}</button>` : nothing}
        </div>
        ${this._solarPick ? html`<p class="fp3d-sub">${this.t("solar_pick_hint")}</p>` : nothing}
        <div class="fp3d-form">
          ${ground
            ? html`${this.len(this.t("solar_base"), f.base ?? 0, (v) => set({ base: v > 0.001 ? Math.min(60, round(v)) : null }), 0.05, 0)}
                ${this.num(this.t("solar_rotation"), f.rotation ?? 0, (v) => set(turnGroundField(this._doc, f, v)), 5)}
                <div class="fp3d-actions">
                  <button class="fp3d-chip" aria-label=${this.t("turn_left_15")} title=${this.t("turn_left_15")} ?disabled=${!admin} @click=${() => set(turnGroundField(this._doc, f, (f.rotation ?? 0) - 15))}>↺ 15°</button>
                  <button class="fp3d-chip" aria-label=${this.t("turn_right_15")} title=${this.t("turn_right_15")} ?disabled=${!admin} @click=${() => set(turnGroundField(this._doc, f, (f.rotation ?? 0) + 15))}>↻ 15°</button>
                </div>`
            : html`${this.len(this.t("solar_u"), f.u, (v) => set({ u: round(v) }), 0.05)} ${this.num(this.t(face?.wall ? "solar_v_wall" : "solar_v"), f.v, (v) => set({ v: round(v) }), 0.05)}`}
          ${face?.wall
            ? html`${this.num(this.t("solar_tilt_wall"), f.tilt ?? 0, (v) => set({ tilt: Math.max(0, Math.min(90, Math.round(v))) }), 5, 0)}
                <label class="fp3d-check fp3d-wide"
                  ><input type="checkbox" ?disabled=${!admin} .checked=${!!f.flip} @change=${(e: Event) => set({ flip: (e.target as HTMLInputElement).checked })} />
                  ${this.t("solar_flip_wall")}</label
                >`
            : nothing}
          ${face?.flat
            ? html`${this.num(this.t("solar_tilt"), f.tilt ?? 15, (v) => set({ tilt: Math.max(0, Math.min(45, Math.round(v))) }), 1, 0)}
                <label class="fp3d-check fp3d-wide"
                  ><input type="checkbox" ?disabled=${!admin} .checked=${!!f.flip} @change=${(e: Event) => set({ flip: (e.target as HTMLInputElement).checked })} />
                  ${this.t("solar_flip")}</label
                >`
            : nothing}
        </div>
        <p class="fp3d-sub">
          ${this.t("solar_summary", { n, kwp: formatNumber(this.hass, (n * (f.wp ?? 400)) / 1000, 1) })}${n < total ? html` · <b>${this.t("solar_partial", { n, total })}</b>` : nothing}
        </p>
        <h4 class="fp3d-lib-head">🔗 ${this.t("solar_string")}</h4>
        <div class="fp3d-form">
          <label class="fp3d-field fp3d-wide"
            >${this.t("solar_string")}
            <select ?disabled=${!admin} @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              this.setSolarString(v === "" ? null : v);
            }}>
              <option value="" ?selected=${!f.string}>${this.t("solar_string_none")}</option>
              ${(this._doc.settings.roof.strings ?? []).map((st) => html`<option value=${st.id} ?selected=${st.id === f.string}>${st.name}</option>`)}
              <option value="new">+ ${this.t("solar_string_new")}</option>
            </select></label
          >
          ${(() => {
            const st = this._doc.settings.roof.strings?.find((x) => x.id === f.string);
            if (!st) return this.entitySelect(this.t("solar_entity"), f.entity ?? null, undefined, power, (v) => set({ entity: v === "none" ? null : v }));
            // each inverter by its own name, else its entity's name, numbered across the house only as a last resort (#213)
            const linked = this.hass ? furnitureEntities(this.hass, this._doc.floors) : null;
            // the inverters, and the batteries with a solar input of their own (a power station, D410)
            const named = (type: "inverter" | "home_battery") =>
              this._doc.floors
                .flatMap((fl) => fl.furniture.filter((m) => energyRole(m.type) === type).map((m) => ({ m, fl })))
                .map(({ m, fl }, i) => {
                  const entity = linked?.get(m.id)?.entity;
                  const own = m.name?.trim() || (entity && this.hass ? entityName(this.hass, entity) : "");
                  return { id: m.id, label: `${own || `${this.t(`furn_${type}`)} ${i + 1}`} · ${fl.name}` };
                });
            const inverters = [...named("inverter"), ...named("home_battery")];
            return html`<label class="fp3d-field fp3d-wide"
                >${this.t("solar_string_name")}
                <input type="text" ?disabled=${!admin} .value=${st.name} @change=${(e: Event) => this.updateSolarString({ name: (e.target as HTMLInputElement).value.trim() || st.name })}
              /></label>
              ${this.entitySelect(this.t("solar_string_entity"), st.entity ?? null, undefined, power, (v) => this.updateSolarString({ entity: v === "none" ? null : v }))}
              <label class="fp3d-field fp3d-wide"
                >${this.t("solar_string_inverter")}
                <select ?disabled=${!admin} @change=${(e: Event) => this.updateSolarString({ inverter: (e.target as HTMLSelectElement).value || null })}>
                  <option value="" ?selected=${!st.inverter}>${this.t(inverters.length ? "solar_string_inverter_none" : "solar_string_inverter_missing")}</option>
                  ${inverters.map((x) => html`<option value=${x.id} ?selected=${x.id === st.inverter}>${x.label}</option>`)}
                </select></label
              >`;
          })()}
        </div>
        <p class="fp3d-sub">${this.t("solar_string_hint")}</p>
        <p class="fp3d-sub">${this.t("solar_form_hint")}</p>
      </section>`;
  }
}
