// Outdoor areas in a multi selection (#400): chosen alone or with items (Shift + click, a frame, Select several), they
// are copied, pasted, moved and deleted together with the items.

import { html, nothing } from "lit";
import { furnitureName } from "../../furniture-names.ts";
import { withKeys } from "../../clipboard.ts";
import { touchOnly, touchWording } from "../../editor-hint.ts";
import type { I18nKey } from "../../i18n.ts";
import { bounds, type Floor, type Vec2 } from "../../model.ts";
import { round } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** Moves the areas `ids` of a floor (and a pool's ports) by dx, dz, as the drag of one area does. */
export function moveAreas(floor: Floor, base: Floor, ids: readonly string[], dx: number, dz: number): void {
  for (const id of ids) {
    const from = base.outdoor.find((o) => o.id === id);
    const o = floor.outdoor.find((x) => x.id === id);
    if (!from || !o) continue;
    o.points = from.points.map(([x, z]) => [round(x + dx), round(z + dz)] as Vec2);
    if (o.pool?.ports && from.pool?.ports) o.pool.ports = from.pool.ports.map((q) => ({ ...q, x: round(q.x + dx), z: round(q.z + dz) }));
  }
}

/** The areas of a floor that lie wholly inside a frame (a drawn frame takes an area only when it holds all of it). */
export function areasInFrame(floor: Floor, a: Vec2, b: Vec2): string[] {
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [z0, z1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  return floor.outdoor
    .filter((o) => {
      if (!o.points.length) return false;
      const r = bounds(o.points);
      return r.x0 >= x0 && r.x1 <= x1 && r.z0 >= z0 && r.z1 <= z1;
    })
    .map((o) => o.id);
}

/** AreaSelectPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class AreaSelectPart {
  /** The outdoor areas chosen now: those of a multi selection, else the one selected area. */
  areaSelection(this: Fp3dEditor): string[] {
    return this._multiOut.length ? this._multiOut : this._outdoorId ? [this._outdoorId] : [];
  }

  /** Chooses items and outdoor areas together; one area alone is a plain selection, nothing at all the room. */
  selectMixed(this: Fp3dEditor, items: string[], areas: string[]): void {
    if (items.length) {
      this.setMulti(items);
      if (areas.length) this._multiOut = areas;
    } else if (areas.length) {
      this.selectItem("outdoor", areas[0]);
      if (areas.length > 1) this._multiOut = areas;
    } else this.selectItem("room", this._roomId);
  }

  /** Shift + click on an outdoor area: it joins the selection (with the items chosen) or leaves it. */
  toggleAreaMulti(this: Fp3dEditor, id: string): void {
    const items = this._furnitureId ? this.selection() : [];
    const cur = this.areaSelection();
    this.selectMixed(items, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  /** Delete of a selection with outdoor areas in it: the items and the areas, after one question, in one undo step. */
  async deleteMixed(this: Fp3dEditor): Promise<void> {
    if (!this.isEditor) return;
    const items = new Set(this._furnitureId ? this.selection() : []);
    const areas = new Set(this.areaSelection());
    const n = items.size + areas.size;
    if (!n || !(await this.ask(this.t("mixed_delete", { n })))) return;
    this.change((_, floor) => {
      floor.furniture = floor.furniture.filter((f) => !items.has(f.id));
      floor.outdoor = floor.outdoor.filter((o) => !areas.has(o.id));
    });
    this.selectItem("room", this._roomId);
  }

  /** The side panel for a selection with outdoor areas in it: what is chosen, Copy, Paste and Delete. */
  renderMixedForm(this: Fp3dEditor) {
    const floor = this.floor;
    if (!floor) return nothing;
    const ids = this._furnitureId ? this.selection() : [];
    const items = floor.furniture.filter((m) => ids.includes(m.id));
    const areas = floor.outdoor.filter((o) => this._multiOut.includes(o.id));
    const n = items.length + areas.length;
    return html`<section>
      <div class="fp3d-h3row"><h3>${this.t("mixed_title", { n })}</h3></div>
      <p class="fp3d-sub">${touchOnly() && this._multiMode ? this.t("multi_hint_on_touch") : touchWording(touchOnly(), "mixed_hint", (k, p) => this.t(k, p))}</p>
      <div class="fp3d-block-parts">
        ${items.map((m) => html`<button class="fp3d-chip" @click=${() => this.selectItem("furniture", m.id)}>${m.name || furnitureName(this.hass, m.type)}</button>`)}
        ${areas.map((o) => html`<button class="fp3d-chip" @click=${() => this.selectItem("outdoor", o.id)}>${o.name || this.t(`out_${o.type}` as I18nKey)}</button>`)}
      </div>
      ${this.isEditor
        ? html`<div class="fp3d-actions">
            <button class="fp3d-btn" title=${withKeys(this.t("help_key_copy"), ["Ctrl+C"])} @click=${() => this.copySelection()}>${this.t("copy_items")}</button>
            ${this.renderPasteButton()}
            <button class="fp3d-btn fp3d-danger" title=${withKeys(this.t("delete"), ["Del"])} @click=${() => void this.deleteMixed()}>${this.t("delete")}</button>
          </div>`
        : nothing}
    </section>`;
  }
}
