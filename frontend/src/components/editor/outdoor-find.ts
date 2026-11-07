// Finding outdoor areas (#401): the list of every floor's areas (the floor page and the Outside panel), the lower
// floors' areas drawn faintly on the plan with an offer to go there, a wider pick margin for thin areas, and going to
// an area on any floor.

import { html, nothing, svg } from "lit";
import type { I18nKey } from "../../i18n.ts";
import { bounds, polygonArea, type Floor, type OutdoorArea, type Vec2 } from "../../model.ts";
import type { ItemRow } from "../item-list-view.ts";
import type { AreaRow } from "../tool-panel.ts";
import type { Fp3dEditor } from "../editor.ts";

/** Paths, fences and hedges, and anything less than a metre across: hit from a margin round their outline (#401). */
export function thinArea(a: OutdoorArea): boolean {
  if (a.type === "path" || a.type === "fence" || a.type === "hedge") return true;
  if (!a.points.length) return false;
  const b = bounds(a.points);
  return Math.min(b.x1 - b.x0, b.z1 - b.z0) < 1;
}

/** The pick margin of a thin area: an invisible line this wide (px) along its outline. */
export const THIN_HIT_PX = 18;

/** How long a line-like area is (a fence round the plot): its outline, without the closing edge of an open one. */
function outlineLength(a: OutdoorArea): number {
  const n = a.points.length;
  let len = 0;
  for (let i = 0; i < n - (a.open ? 1 : 0); i++) {
    const p = a.points[i]!;
    const q = a.points[(i + 1) % n]!;
    len += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return len;
}

/** OutdoorFindPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class OutdoorFindPart {
  /** An area's name in lists: its own, else its kind. */
  outdoorName(this: Fp3dEditor, a: OutdoorArea): string {
    return (a.name ?? "").trim() || this.t(`out_${a.type}` as I18nKey);
  }

  /** Every outdoor area of the home, this floor's first: name, size (a fence or hedge: its length) and floor. */
  outdoorRows(this: Fp3dEditor): AreaRow[] {
    const floors = [...this._doc.floors].sort((a, b) => Number(b.id === this._floorId) - Number(a.id === this._floorId));
    const chosen = this.areaSelection();
    return floors.flatMap((f) =>
      f.outdoor.map((a) => {
        const size = a.type === "fence" || a.type === "hedge" ? this.m(outlineLength(a), 1) : this.area(polygonArea(a.points));
        return { id: a.id, floor: f.id, name: this.outdoorName(a), note: `${size} · ${f.name}`, selected: f.id === this._floorId && chosen.includes(a.id) };
      }),
    );
  }

  /** Selects an area on its floor (switching floor if needed) and brings it into view; false when it is gone. */
  goToOutdoor(this: Fp3dEditor, floorId: string, id: string): boolean {
    const fl = this._doc.floors.find((f) => f.id === floorId);
    const a = fl?.outdoor.find((o) => o.id === id);
    if (!fl || !a) return false;
    this._toolMenu = null;
    if (this._tool !== "select" && this._tool !== "pool") this.setTool("select");
    if (this._floorId !== fl.id) this.selectFloor(fl.id);
    this.selectItem("outdoor", id);
    this.showArea(a.points);
    return true;
  }

  /** Brings an outline into view: as it is when all of it shows, else zoomed out (or in, up to 70 px/m) to fit it. */
  showArea(this: Fp3dEditor, points: readonly Vec2[]): void {
    if (!points.length) return;
    const b = bounds(points);
    const [x0, y0] = this.toScreen([b.x0, b.z0]);
    const [x1, y1] = this.toScreen([b.x1, b.z1]);
    const m = 24;
    if (x0 >= m && y0 >= m && x1 <= this._size.w - m && y1 <= this._size.h - m) return;
    const w = b.x1 - b.x0 + 3;
    const h = b.z1 - b.z0 + 3;
    const scale = Math.max(8, Math.min(70, this._size.w / w, this._size.h / h));
    this._view = { scale, ox: this._size.w / 2 - ((b.x0 + b.x1) / 2) * scale, oy: this._size.h / 2 - ((b.z0 + b.z1) / 2) * scale };
  }

  /** The floor page's list of outdoor areas (#401), styled like its items list: tap to select, hide, delete. */
  renderOutdoorList(this: Fp3dEditor) {
    const rows = this.outdoorRows();
    if (!rows.length) return nothing;
    const list: ItemRow[] = rows.map((r) => ({ id: `${r.floor}:${r.id}`, name: r.name, note: r.note, hidden: this._hiddenItems.includes(r.id), selected: r.selected }));
    const split = (e: CustomEvent<{ id: string }>) => e.detail.id.split(":") as [string, string];
    const open = this.outdoorListOpen;
    return this.foldRow("out-list", open, () => (this.outdoorListOpen = !open), `${this.t("out_list")} (${rows.length})`, "", 0, () => html`<fp3d-item-list
        .rows=${list}
        .texts=${{ hide: this.t("item_hide"), show: this.t("item_show"), remove: this.t("delete"), more: this.t("item_menu") }}
        ?editable=${this.isEditor}
        @item-select=${(e: CustomEvent<{ id: string }>) => this.goToOutdoor(...split(e))}
        @item-hide=${(e: CustomEvent<{ id: string }>) => this.toggleItemHidden(split(e)[1])}
        @item-delete=${(e: CustomEvent<{ id: string }>) => this.goToOutdoor(...split(e)) && void this.deleteOutdoor()}
      ></fp3d-item-list>`);
  }

  /** The floors below: their outdoor areas, faint, on this floor's plan (the garden seen from upstairs). */
  renderOutdoorGhosts(this: Fp3dEditor, floor: Floor) {
    if (this._tool !== "select") return nothing;
    const below = this._doc.floors.filter((f) => f.id !== floor.id && f.elevation < floor.elevation && f.outdoor.length);
    if (!below.length) return nothing;
    return svg`<g class="fp3d-out-ghosts">${below.flatMap((f) =>
      f.outdoor.map((a) => {
        const pts = a.points.map((p) => this.toScreen(p).join(",")).join(" ");
        return svg`<polygon class="fp3d-out-ghost" data-out-ghost=${`${f.id}:${a.id}`} points=${pts} />`;
      }),
    )}</g>`;
  }

  /** A tap on another floor's area: asks to go to that floor, and selects the area there. */
  async offerOutdoorFloor(this: Fp3dEditor, floorId: string, id: string): Promise<void> {
    const fl = this._doc.floors.find((f) => f.id === floorId);
    const a = fl?.outdoor.find((o) => o.id === id);
    if (!fl || !a) return;
    if (await this.ask(this.t("out_ghost_ask", { name: this.outdoorName(a), floor: fl.name }), this.t("out_ghost_go", { floor: fl.name }), false)) this.goToOutdoor(fl.id, id);
  }
}
