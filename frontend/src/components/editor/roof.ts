// The roof tool: roof sections and dormers, roof windows, the roof panel and section form, the whole-roof basics.

import { html, nothing, svg } from "lit";
import { sectionFloor, dormerParent, effectiveDormer, proposeDormer, sectionGeometry, floorOutline, polygonBox, ridgeHeight, roofSectionsFromRooms, sectionFrame, sectionTurn, turnSectionAbout, wallTopUnder } from "../../roof-sections.ts";
import { bestFace, clampField, pointOnFace, proposeWindow, roofFaces, windowAsField, windowCorners, type RoofFace } from "../../solar.ts";
import type { I18nKey } from "../../i18n.ts";
import { uid, type Building, type RoofSection, type RoofShape, type RoofEnd, ROOF_ENDS, type RoofWindow, ROOF_SHAPES, type RoofType, type Vec2 } from "../../model.ts";
import { turnBy, round, numberish, binaryish } from "./helpers.ts";
import { chosenPoint, pointKeys, renderMids } from "./points.ts";
import type { Fp3dEditor } from "../editor.ts";

/** RoofPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class RoofPart {
  // ------------------------------------------------------------------ roof sections

  /** A section is fixed by its own lock or by the plan lock. */
  roofFixed(this: Fp3dEditor, sec: RoofSection | undefined): boolean {
    return !!sec && (!!sec.locked || !!this._doc.settings.lock_plan);
  }

  /** Floor buttons in the roof tool: the plan below shows that floor's rooms to draw along. */
  renderRoofFloors(this: Fp3dEditor) {
    const floors = [...this._doc.floors].sort((a, b) => b.elevation - a.elevation);
    if (floors.length < 2) return nothing;
    // these only pick the floor the plan shows to draw along: the roof itself is the whole building's (#68)
    return html`<div class="fp3d-roof-floors" title=${this.t("roof_floor_pick_hint")}>
      <span class="fp3d-sub">${this.t("roof_floor_pick")}</span>
      <div class="fp3d-seg fp3d-dev-source">
        ${floors.map((f) => html`<button aria-pressed=${f.id === this._floorId} @click=${() => (this._floorId = f.id)}>${f.name}</button>`)}
      </div>
    </div>`;
  }

  /** Switch to a roof of sections; without sections yet, propose them from the rooms. */
  async useRoofSections(this: Fp3dEditor, regenerate = false): Promise<void> {
    if (!this.isEditor) return;
    const has = (this._doc.settings.roof.sections ?? []).length > 0;
    if (regenerate && has && !(await this.ask(this.t("roof_regen_confirm"), this.t("ask_ok")))) return;
    this.change((doc) => {
      doc.settings.roof.type = "custom";
      if (regenerate || !has) doc.settings.roof.sections = roofSectionsFromRooms(doc, () => uid("roof"));
    });
    this._roofId = null;
  }

  addRoofSection(this: Fp3dEditor, lo: Vec2, hi: Vec2): void {
    if (!this.isEditor) return;
    // eaves on the walls of the rooms below (a garage), whatever floor the plan shows; over no room
    // (a terrace, a carport) a canopy: a flat pent roof on posts, 2.4 m above the ground floor
    const walls = wallTopUnder(this._doc, lo[0], lo[1], hi[0], hi[1]);
    const ground = Math.min(...this._doc.floors.map((f) => f.elevation));
    const canopy = walls === null;
    const top = round(walls ?? ground + 2.4);
    const pitch = canopy ? 6 : this._doc.settings.roof.pitch || 35;
    const sec: RoofSection = {
      id: uid("roof"),
      x0: round(lo[0]),
      z0: round(lo[1]),
      x1: round(hi[0]),
      z1: round(hi[1]),
      shape: canopy ? "pent" : "gable",
      axis: hi[0] - lo[0] >= hi[1] - lo[1] ? "x" : "z",
      eave_a: top,
      eave_b: top,
      pitch_a: pitch,
      pitch_b: pitch,
      base: top,
      overhang: canopy ? 0.15 : null,
      ...(canopy ? { open: true } : {}),
    };
    this.change((doc) => {
      doc.settings.roof.type = "custom";
      doc.settings.roof.sections = [...(doc.settings.roof.sections ?? []), sec];
    });
    this._roofId = sec.id;
  }

  /** A flat section takes the outline of the floor shown (its rooms at the outer wall faces) as its shape. */
  takeRoofOutline(this: Fp3dEditor): void {
    const floor = this.floor;
    const id = this._roofId;
    if (!floor || !id || !this.isEditor) return;
    const outline = floorOutline(floor.rooms, floor.walls ?? [], this._doc.settings.wall_exterior, this._doc.settings.wall_interior);
    if (!outline) return;
    const points = outline.map(([x, z]) => [round(x), round(z)] as Vec2);
    this.updateRoofSection({ shape: "flat", points, ...polygonBox(points) });
  }

  /** A dormer on a side of the selected section, in its middle; then the dormer is selected. */
  addDormer(this: Fp3dEditor, side: "a" | "b"): void {
    const parent = this.roofSection;
    if (!parent || !this.isEditor) return;
    const d = proposeDormer(parent, side, uid("roof"));
    this.change((doc) => {
      doc.settings.roof.sections = [...(doc.settings.roof.sections ?? []), d];
    });
    this._roofId = d.id;
  }

  updateRoofSection(this: Fp3dEditor, patch: Partial<RoofSection>): void {
    const id = this._roofId;
    if (!id || !this.isEditor) return;
    if (patch.locked === false) this._fixedHint = false;
    this.change((doc) => {
      const sec = doc.settings.roof.sections?.find((x) => x.id === id);
      if (sec) Object.assign(sec, patch);
    });
  }

  /** Turn the selected section to `angle` degrees (clockwise in the plan); its dormers and cross gables come along (#634, #724). */
  turnRoofSection(this: Fp3dEditor, angle: number): void {
    const id = this._roofId;
    if (!id || !this.isEditor) return;
    this.change((doc) => {
      const sections = doc.settings.roof.sections ?? [];
      const sec = sections.find((x) => x.id === id);
      if (!sec || (sec.points && sec.points.length >= 3)) return;
      const delta = angle - (sec.rotation ?? 0);
      if (!delta) return;
      const p: Vec2 = sec.pivot ?? [round((sec.x0 + sec.x1) / 2), round((sec.z0 + sec.z1) / 2)];
      const along = new Set(sections.filter((d) => d !== sec && dormerParent(sections, d) === sec).map((d) => d.id));
      doc.settings.roof.sections = sections.map((x) => {
        if (x !== sec && !along.has(x.id)) return x;
        const t = turnSectionAbout(x, delta, p);
        return { ...t, x0: round(t.x0), x1: round(t.x1), z0: round(t.z0), z1: round(t.z1), pivot: t.pivot && ([round(t.pivot[0]), round(t.pivot[1])] as Vec2), rotation: round(t.rotation ?? 0) };
      });
    });
  }

  deleteRoofSection(this: Fp3dEditor): void {
    const id = this._roofId;
    if (!id || !this.isEditor) return;
    this.change((doc) => (doc.settings.roof.sections = (doc.settings.roof.sections ?? []).filter((x) => x.id !== id)));
    this._roofId = null;
  }

  duplicateRoofSection(this: Fp3dEditor): void {
    const sec = this.roofSection;
    if (!sec || !this.isEditor) return;
    const copy = { ...structuredClone(sec), id: uid("roof"), x0: round(sec.x0 + 1), x1: round(sec.x1 + 1), z0: round(sec.z0 + 1), z1: round(sec.z1 + 1) };
    if (sec.pivot) copy.pivot = [round(sec.pivot[0] + 1), round(sec.pivot[1] + 1)];
    this.change((doc) => (doc.settings.roof.sections = [...(doc.settings.roof.sections ?? []), copy]));
    this._roofId = copy.id;
  }

  /** The sections over the plan: outline, ridge (and hips), a label; the selected one with corner handles. */
  renderRoofSections(this: Fp3dEditor) {
    const roof = this._doc.settings.roof;
    const sections = roof.type === "custom" ? (roof.sections ?? []) : [];
    return svg`<g class="fp3d-roof-layer">${sections.map((sec, i) => {
      const sel = sec.id === this._roofId;
      const fr = sectionFrame(sec);
      const shape = sec.shape === "flat" && sec.points && sec.points.length >= 3 ? sec.points : null;
      // a dormer or cross gable shows as deep as it is drawn (its ridge meets the slope there)
      const parent = dormerParent(sections, sec);
      const dfr = parent ? sectionFrame(effectiveDormer(parent, sec)) : fr;
      const pts = (shape ?? [dfr.at(dfr.u0, 0), dfr.at(dfr.u1, 0), dfr.at(dfr.u1, dfr.w), dfr.at(dfr.u0, dfr.w)]).map((p) => this.toScreen(p));
      const line = (a: Vec2, b: Vec2) => {
        const [ax, ay] = this.toScreen(a);
        const [bx, by] = this.toScreen(b);
        return svg`<line x1=${ax} y1=${ay} x2=${bx} y2=${by} />`;
      };
      const geom = sec.shape === "flat" || sec.shape === "parapet" ? null : sectionGeometry(sec, { u0: 0, u1: 0, a: 0, b: 0 });
      const ridge = geom ? svg`${geom.ridges.map(([p, q]) => line(fr.at(p[0], p[1]), fr.at(q[0], q[1])))}` : nothing;
      const [cx, cy] = this.toScreen(fr.at((fr.u0 + fr.u1) / 2, fr.w / 2));
      const label = `${this.roofFixed(sec) ? "🔒 " : ""}${i + 1} · ${sec.dormer ? this.t("roof_dormer") : sec.open ? this.t("roof_open_short") : this.t(`roof_shape_${sec.shape}` as I18nKey)} · ${this.m(ridgeHeight(sec), 1)}`;
      return svg`<g data-roof=${sec.id} class=${`fp3d-roof-sec${sel ? " fp3d-roof-sel" : ""}`}>
          <polygon points=${pts.map((p) => p.join(",")).join(" ")} />
          <g class="fp3d-roof-ridge">${ridge}</g>
          <text x=${cx} y=${cy - 14}>${label}</text>
        </g>
        ${sel && this.isEditor && !this.roofFixed(sec) && shape
          ? svg`${renderMids(this, "data-roof-mid", sec.id, shape)}${shape.map((p, k) => {
              const [x, y] = this.toScreen(p);
              // a "+" on every edge adds a point (#395); the points take the keyboard: Tab, the arrows, Delete
              const keys = pointKeys(this, { kind: "roof", id: sec.id, index: k }, shape.length);
              const pt = chosenPoint(this);
              const on = pt?.kind === "roof" && pt.id === sec.id && pt.index === k;
              return svg`<g class=${on ? "fp3d-vertex fp3d-vertex-sel" : "fp3d-vertex"} data-roof-vertex=${`${sec.id}:${k}`} tabindex="0" role="button" aria-label=${keys.label} @focus=${keys.focus}><circle cx=${x} cy=${y} r="16" class="fp3d-hit" /><circle cx=${x} cy=${y} r="6" /></g>`;
            })}`
          : nothing}
        ${sel && this.isEditor && !this.roofFixed(sec) && !shape && !sectionTurn(sec)
          ? ([[0, 0], [1, 0], [1, 1], [0, 1]] as const).map(([kx, kz]) => {
              const [x, y] = this.toScreen([kx ? Math.max(sec.x0, sec.x1) : Math.min(sec.x0, sec.x1), kz ? Math.max(sec.z0, sec.z1) : Math.min(sec.z0, sec.z1)]);
              return svg`<g class="fp3d-vertex" data-roof-corner=${`${sec.id}:${kx}:${kz}`}><circle cx=${x} cy=${y} r="16" class="fp3d-hit" /><circle cx=${x} cy=${y} r="6" /></g>`;
            })
          : nothing}`;
    })}</g>`;
  }

  /** Where a plan point lies on a face; on a house wall only along it (s = NaN: the height stays). */
  faceHit(this: Fp3dEditor, face: RoofFace, p: Vec2): { u: number; s: number } | null {
    if (!face.wall) return pointOnFace(face, p);
    return { u: (p[0] - face.o[0]) * face.eu[0] + (p[1] - face.o[2]) * face.eu[2], s: Number.NaN };
  }

  /** Roof windows over the plan (roof tool), the selected one highlighted. */
  renderRoofWindows(this: Fp3dEditor) {
    const windows = this._doc.settings.roof.windows ?? [];
    if (!windows.length) return nothing;
    const faces = new Map(roofFaces(this._doc).map((f) => [f.key, f]));
    return svg`<g class="fp3d-roofwin-layer">${windows.map((w) => {
      const face = faces.get(w.face);
      const c = face ? windowCorners(face, w) : null;
      if (!c) return nothing;
      return svg`<g data-roofwin=${w.id} class=${`fp3d-roofwin${w.id === this._roofWinId ? " fp3d-roofwin-sel" : ""}`}><polygon points=${c.map((p) => this.toScreen([p[0], p[2]]).join(",")).join(" ")} /></g>`;
    })}</g>`;
  }

  addRoofWindow(this: Fp3dEditor): void {
    if (!this.isEditor) return;
    const faces = roofFaces(this._doc).filter((f) => !f.flat);
    const face = bestFace(faces, this._doc.settings.north ?? 0) ?? roofFaces(this._doc)[0];
    if (!face) return;
    const w = proposeWindow(face, uid("rwin"));
    this.change((doc) => (doc.settings.roof.windows = [...(doc.settings.roof.windows ?? []), w]));
    this._roofWinId = w.id;
    this._roofId = null;
  }

  updateRoofWindow(this: Fp3dEditor, patch: Partial<RoofWindow>): void {
    const id = this._roofWinId;
    if (!id || !this.isEditor) return;
    this.change((doc) => {
      const w = doc.settings.roof.windows?.find((x) => x.id === id);
      if (!w) return;
      Object.assign(w, patch);
      const face = roofFaces(doc).find((x) => x.key === w.face);
      if (face) Object.assign(w, clampField(face, windowAsField(w)));
    });
  }

  deleteRoofWindow(this: Fp3dEditor): void {
    const id = this._roofWinId;
    if (!id || !this.isEditor) return;
    this.change((doc) => (doc.settings.roof.windows = (doc.settings.roof.windows ?? []).filter((x) => x.id !== id)));
    this._roofWinId = null;
  }

  renderRoofWindowList(this: Fp3dEditor) {
    const windows = this._doc.settings.roof.windows ?? [];
    const faces = new Map(roofFaces(this._doc).map((f) => [f.key, f]));
    return html`<section>
      <h3>🪟 ${this.t("roof_windows")}</h3>
      <p class="fp3d-sub">${this.t(faces.size ? "roof_windows_hint" : "solar_no_roof")}</p>
      ${windows.length
        ? html`<div class="fp3d-room-list">
            ${windows.map((w, i) => {
              const face = faces.get(w.face);
              return html`<div class="fp3d-row">
                <button class="fp3d-dev-name" @click=${() => {
                  this._roofWinId = w.id;
                  this._roofId = null;
                }}>
                  <span>${this.t("roof_window")} ${i + 1} · ${face ? this.faceLabel(face) : this.t("solar_face_gone")}</span>
                </button>
              </div>`;
            })}
          </div>`
        : nothing}
      <div class="fp3d-actions"><button class="fp3d-btn" ?disabled=${!this.isEditor || !faces.size} @click=${() => this.addRoofWindow()}>+ ${this.t("roof_window")}</button></div>
    </section>`;
  }

  renderRoofWindowForm(this: Fp3dEditor, w: RoofWindow) {
    const admin = this.isEditor;
    const faces = roofFaces(this._doc);
    const set = (patch: Partial<RoofWindow>) => this.updateRoofWindow(patch);
    const index = (this._doc.settings.roof.windows ?? []).findIndex((x) => x.id === w.id) + 1;
    const covers = this.entityOptions((id) => id.startsWith("cover."));
    const contacts = this.entityOptions((id) => binaryish(id) || numberish(id));
    return html`<section>
        ${this.renderPanelHeader({
          id: `roof-window:${w.id}`,
          title: w.name || `${this.t("roof_window")} ${index}`,
          kind: this.t("roof_window"),
          where: (() => {
            const face = faces.find((x) => x.key === w.face);
            return face ? this.faceLabel(face) : null;
          })(),
          lock: this.ownLock(w.locked, () => set({ locked: !w.locked })),
          menu: [{ label: this.t("delete"), keys: ["Del"], danger: true, run: () => this.deleteRoofWindow() }],
        })}
        <div class="fp3d-form">
          <label class="fp3d-field fp3d-wide"
            >${this.t("solar_face")}
            <select ?disabled=${!admin} @change=${(e: Event) => {
              const next = faces.find((x) => x.key === (e.target as HTMLSelectElement).value);
              if (next) set({ ...proposeWindow(next, w.id), w: w.w, h: w.h, cover: w.cover, contact: w.contact, tilt: w.tilt, window: w.window, name: w.name, float: w.float });
            }}>
              ${faces.map((x) => html`<option value=${x.key} ?selected=${x.key === w.face}>${this.faceLabel(x)}</option>`)}
            </select></label
          >
          ${this.len(this.t("width"), w.w ?? 0.78, (v) => set({ w: Math.max(0.3, Math.min(4, round(v))) }), 0.01, 0.3)}
          ${this.len(this.t("height_m"), w.h ?? 1.18, (v) => set({ h: Math.max(0.3, Math.min(4, round(v))) }), 0.01, 0.3)}
          ${this.len(this.t("solar_u"), w.u, (v) => set({ u: round(v) }), 0.05)}
          ${this.len(this.t("solar_v"), w.v, (v) => set({ v: round(v) }), 0.05)}
          ${this.entitySelect(this.t("cover_entity"), w.cover ?? null, undefined, covers, (v) => set({ cover: v === "none" ? null : v }))}
          ${this.entitySelect(this.t("contact_entity"), w.contact ?? null, undefined, contacts, (v) => set({ contact: v === "none" ? null : v }))}
          ${this.entitySelect(this.t("roof_window_tilt"), w.tilt ?? null, undefined, contacts, (v) => set({ tilt: v === "none" ? null : v }))}
          ${this.entitySelect(this.t("roof_window_motor"), w.window ?? null, undefined, covers, (v) => set({ window: v === "none" ? null : v }))}
          <label class="fp3d-field fp3d-wide"
            >${this.t("roof_window_name")}
            <input .value=${w.name ?? ""} ?disabled=${!admin} maxlength="64" @change=${(e: Event) => set({ name: (e.target as HTMLInputElement).value.trim() || null })}
          /></label>
        </div>
        <label class="fp3d-check"
          ><input type="checkbox" ?disabled=${!admin} .checked=${!!w.float} @change=${(e: Event) => set({ float: (e.target as HTMLInputElement).checked || undefined })} />
          ${this.t("roof_window_float")}</label
        >
        <p class="fp3d-sub">${this.t("roof_window_float_hint")}</p>
        <p class="fp3d-sub">${this.t("roof_window_motor_hint")}</p>
        <p class="fp3d-sub">${this.t("roof_window_hint")}</p>
      </section>`;
  }

  /** Sidebar of the roof tool: the selected section's form, or the overview of all sections. */
  renderRoofPanel(this: Fp3dEditor) {
    const roof = this._doc.settings.roof;
    const admin = this.isEditor;
    const sec = roof.type === "custom" ? this.roofSection : undefined;
    const win = this._roofWinId ? roof.windows?.find((x) => x.id === this._roofWinId) : undefined;
    if (win) return this.renderRoofWindowForm(win);
    if (sec) return this.renderRoofSectionForm(sec);
    const sections = roof.type === "custom" ? (roof.sections ?? []) : [];
    return html`${this.renderRoofBasics()}
    <section>
      ${this.renderRoofFloors()}
      <h3>${this.t("roof_sections")}</h3>
      <p class="fp3d-sub">${this.t("roof_sections_hint")}</p>
      ${roof.type !== "custom"
        ? html`<div class="fp3d-actions"><button class="fp3d-btn fp3d-primary" ?disabled=${!admin} @click=${() => this.useRoofSections()}>${this.t("roof_sections_start")}</button></div>`
        : html`<div class="fp3d-room-list">
              ${sections.map(
                (x, i) => html`<div class="fp3d-row">
                  <button class="fp3d-dev-name" @click=${() => (this._roofId = x.id)}>
                    <span>${i + 1} · ${x.dormer ? this.t("roof_dormer") : this.t(`roof_shape_${x.shape}` as I18nKey)} · ${this.m(Math.abs(x.x1 - x.x0), 1)} × ${this.m(Math.abs(x.z1 - x.z0), 1)} · ${this.t("roof_ridge_height")} ${this.m(ridgeHeight(x), 1)}</span>
                  </button>
                </div>`,
              )}
            </div>
            <div class="fp3d-actions">
              <button class="fp3d-btn" ?disabled=${!admin} @click=${() => this.useRoofSections(true)}>${this.t("roof_sections_regen")}</button>
              <button class="fp3d-btn" ?disabled=${!admin} @click=${() => this.change((doc) => (doc.settings.roof.type = "gable"))}>${this.t("roof_sections_off")}</button>
            </div>`}
    </section>
    ${this.renderRoofWindowList()}`;
  }

  renderRoofSectionForm(this: Fp3dEditor, sec: RoofSection) {
    const admin = this.isEditor;
    const set = (patch: Partial<RoofSection>) => this.updateRoofSection(patch);
    // side a is the top (ridge across the plan) or the left (ridge up and down the plan)
    const sides = sec.axis === "x" ? [this.t("roof_side_top"), this.t("roof_side_bottom")] : [this.t("roof_side_left"), this.t("roof_side_right")];
    const [sideA, sideB] = sec.flip ? [sides[1], sides[0]] : sides;
    const flat = sec.shape === "flat" || sec.shape === "parapet";
    const pent = sec.shape === "pent";
    const n = (sections: RoofSection[]) => sections.findIndex((x) => x.id === sec.id) + 1;
    const num = (label: string, value: number, apply: (v: number) => void, step = 0.05, min = 0) => this.len(label, value, (v) => apply(Math.max(min, round(v))), step, min);
    const deg = (label: string, value: number, apply: (v: number) => void) => this.num(label, value, (v) => apply(Math.max(0, round(v))), 1, 0);
    // the kind's own actions are in "⋯" with Duplicate and Delete (#409): Swap sides, a dormer on either side
    const dormers = !flat && !sec.dormer && !sec.open;
    return html`<section>
        ${this.renderPanelHeader({
          id: `roof:${sec.id}`,
          title: `${sec.dormer ? this.t("roof_dormer") : this.t("roof_section")} ${n(this._doc.settings.roof.sections ?? [])}`,
          kind: this.t(`roof_shape_${sec.shape}` as I18nKey),
          where: sectionFloor(this._doc, sec)?.name,
          lock: this.ownLock(sec.locked, () => set({ locked: !sec.locked })),
          menu: [
            !flat && { label: this.t("roof_swap"), run: () => set({ flip: !sec.flip }) },
            dormers && { label: `+ ${this.t("roof_dormer")} ${sideA}`, run: () => this.addDormer("a") },
            dormers && !pent && { label: `+ ${this.t("roof_dormer")} ${sideB}`, run: () => this.addDormer("b") },
            { label: this.t("duplicate"), run: () => this.duplicateRoofSection() },
            { label: this.t("delete"), keys: ["Del"], danger: true, run: () => this.deleteRoofSection() },
          ],
        })}
        ${this.renderRoofFloors()}
        <label class="fp3d-field fp3d-wide"
          >${this.t("roof_shape")}
          <select ?disabled=${!admin} @change=${(e: Event) => set({ shape: (e.target as HTMLSelectElement).value as RoofShape })}>
            ${ROOF_SHAPES.map((shape) => html`<option value=${shape} ?selected=${sec.shape === shape}>${this.t(`roof_shape_${shape}` as I18nKey)}</option>`)}
          </select>
        </label>
        ${flat
          ? nothing
          : html`<div class="fp3d-seg fp3d-dev-source">
              <button aria-pressed=${sec.axis === "x"} ?disabled=${!admin} @click=${() => set({ axis: "x" })}>${this.t("roof_axis_x")}</button>
              <button aria-pressed=${sec.axis === "z"} ?disabled=${!admin} @click=${() => set({ axis: "z" })}>${this.t("roof_axis_z")}</button>
            </div>`}
        ${sec.points || sec.dormer
          ? nothing
          : html`<div class="fp3d-form" title=${this.t("roof_turn_hint")}>
              ${this.num(`${this.t("roof_turn")} (°)`, sec.rotation ?? 0, (v) => this.turnRoofSection(Math.max(-180, Math.min(180, round(v)))), 1)}
              ${admin && !this.roofFixed(sec)
                ? html`<div class="fp3d-actions">
                    <button class="fp3d-btn" aria-label=${this.t("turn_left_15")} title=${this.t("turn_left_15")} @click=${() => this.turnRoofSection(turnBy(sec.rotation ?? 0, -15))}>↺ 15°</button>
                    <button class="fp3d-btn" aria-label=${this.t("turn_right_15")} title=${this.t("turn_right_15")} @click=${() => this.turnRoofSection(turnBy(sec.rotation ?? 0, 15))}>↻ 15°</button>
                  </div>`
                : nothing}
            </div>`}
        ${sec.shape === "gable" || sec.shape === "hip" || sec.shape === "halfhip"
          ? html`<div class="fp3d-form fp3d-roof-ends">
              ${([0, 1] as const).map((end) => {
                // the u0 end is the left one (ridge across the plan) or the top one (ridge up and down)
                const where = this.t(sec.axis === "x" ? (end === 0 ? "roof_side_left" : "roof_side_right") : end === 0 ? "roof_side_top" : "roof_side_bottom");
                const value = (end === 0 ? sec.end_u0 : sec.end_u1) ?? "";
                return html`<label class="fp3d-field"
                  >${this.t("roof_end")} ${where}
                  <select
                    ?disabled=${!admin}
                    @change=${(e: Event) => {
                      const v = ((e.target as HTMLSelectElement).value || null) as RoofEnd | null;
                      set(end === 0 ? { end_u0: v } : { end_u1: v });
                    }}
                  >
                    <option value="" ?selected=${value === ""}>${this.t("roof_end_auto_of", { shape: this.t(`roof_shape_${sec.shape}` as I18nKey) })}</option>
                    ${ROOF_ENDS.map((e) => html`<option value=${e} ?selected=${value === e}>${this.t(e === "gable" ? "roof_end_gable" : `roof_shape_${e}`)}</option>`)}
                  </select></label
                >`;
              })}
              <div class="fp3d-with-info fp3d-wide"><span class="fp3d-sub">${this.t("roof_end_short")}</span>${this.infoButton("roof_end_hint", this.t("roof_end"))}</div>
            </div>`
          : nothing}
        <label class="fp3d-check fp3d-wide" title=${this.t("roof_open_hint")}
          ><input type="checkbox" .checked=${!!sec.open} ?disabled=${!admin} @change=${(e: Event) => set({ open: (e.target as HTMLInputElement).checked })} />
          ${this.t("roof_open")}</label
        >
        <div class="fp3d-form">
          ${flat
            ? num(this.t("roof_height"), sec.eave_a, (v) => set({ eave_a: v, eave_b: v }))
            : html`${num(`${this.t("roof_eave")} ${pent ? "" : sideA}`, sec.eave_a, (v) => set({ eave_a: v }))}
              ${pent ? nothing : num(`${this.t("roof_eave")} ${sideB}`, sec.eave_b, (v) => set({ eave_b: v }))}
              ${deg(`${this.t("roof_pitch_short")} ${pent ? "" : sideA}`, sec.pitch_a, (v) => set({ pitch_a: Math.min(75, v) }))}
              ${pent ? nothing : deg(`${this.t("roof_pitch_short")} ${sideB}`, sec.pitch_b, (v) => set({ pitch_b: Math.min(75, v) }))}`}
          ${num(this.t("roof_base"), sec.base, (v) => set({ base: v }))}
          <label class="fp3d-field" title=${this.t("roof_on_floor_hint")}
            >${this.t("roof_on_floor")}
            <select
              ?disabled=${!admin}
              @change=${(e: Event) => {
                const f = this._doc.floors.find((x) => x.id === (e.target as HTMLSelectElement).value);
                if (!f) return;
                // the section moves onto that floor's wall tops: base and eaves shift by the same amount
                const top = round(f.elevation + f.height);
                const shift = top - sec.base;
                set({ base: top, eave_a: round(sec.eave_a + shift), eave_b: round(sec.eave_b + shift) });
              }}
            >
              ${[...this._doc.floors]
                .filter((f) => f.rooms.length)
                .sort((p, q) => q.elevation - p.elevation)
                .map((f) => html`<option value=${f.id} ?selected=${sectionFloor(this._doc, sec)?.id === f.id}>${f.name}</option>`)}
            </select></label
          >
          <p class="fp3d-sub fp3d-wide">${this.t("roof_base_hint")}</p>
          ${num(this.t("roof_overhang"), sec.overhang ?? this._doc.settings.roof.overhang, (v) => set({ overhang: Math.min(2, v) }), 0.05, 0)}
        </div>
        ${flat && admin
          ? html`<div class="fp3d-actions">
              <button class="fp3d-btn" title=${this.t("roof_outline_hint")} @click=${() => this.takeRoofOutline()}>${this.t("roof_outline")}</button>
              ${sec.points ? html`<button class="fp3d-btn" @click=${() => set({ points: null })}>${this.t("roof_rect")}</button>` : nothing}
            </div>
            <p class="fp3d-sub">${this.t(sec.points ? "roof_points_hint" : "roof_outline_hint")}</p>`
          : nothing}
        <p class="fp3d-sub">${this.t("roof_ridge_height")}: ${this.m(ridgeHeight(sec), 2)} · ${this.t("roof_section_hint")}</p>
        ${dormers && admin ? html`<p class="fp3d-sub">${this.t("roof_dormer_hint")}</p>` : nothing}
      </section>`;
  }

  /** The roof's basics – its kind, ridge, pitch and overhang – in the roof tool (sections and windows live there too). */
  renderRoofBasics(this: Fp3dEditor) {
    const s = this._doc.settings;
    const set = (patch: Partial<Building["settings"]>) => this.setSettings(patch);
    return html`<section>
      <h3>${this.t("roof_whole")}</h3>
      <p class="fp3d-sub">${this.t("roof_whole_hint")}</p>
      <div class="fp3d-form">
        <label class="fp3d-field fp3d-wide"
          >${this.t("roof_basics")}
          <select
            @change=${(e: Event) => {
              const type = (e.target as HTMLSelectElement).value as RoofType;
              // roof sections: propose them from the rooms and open the roof tool
              if (type === "custom") {
                this.useRoofSections();
                this._tool = "roof";
              } else set({ roof: { ...s.roof, type } });
            }}
          >
            ${(["none", "flat", "gable", "custom"] as const).map((t) => html`<option value=${t} ?selected=${t === s.roof.type}>${this.t(`roof_${t}`)}</option>`)}
          </select></label
        >
        ${s.roof.type === "gable"
          ? html`<label class="fp3d-field fp3d-wide"
              >${this.t("roof_ridge")}
              <select @change=${(e: Event) => set({ roof: { ...s.roof, ridge: (e.target as HTMLSelectElement).value === "short" ? "short" : null } })}>
                <option value="long" ?selected=${s.roof.ridge !== "short"}>${this.t("roof_ridge_long")}</option>
                <option value="short" ?selected=${s.roof.ridge === "short"}>${this.t("roof_ridge_short")}</option>
              </select></label
            >`
          : nothing}
        ${s.roof.type === "gable" ? this.num(this.t("roof_pitch"), s.roof.pitch, (v) => set({ roof: { ...s.roof, pitch: Math.min(60, Math.max(5, v)) } }), 1, 5) : nothing}
        ${s.roof.type !== "none" ? this.len(this.t("roof_overhang"), s.roof.overhang, (v) => set({ roof: { ...s.roof, overhang: Math.min(2, Math.max(0, v)) } }), 0.05, 0) : nothing}
      </div>
    </section>`;
  }
}
