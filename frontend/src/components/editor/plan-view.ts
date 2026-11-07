// The plan document and view: every edit (change/setDoc), undo and redo, the view transform, fit and zoom,
// snapping, the grid and the snap guides.

import { html, nothing, svg } from "lit";
import { alignLines, itemBox, type AlignLines, type Box, type Guide } from "../../geometry/snap-guides.ts";
import { setCameraSensors } from "../../markers.ts";
import { announce } from "../../announce.ts";
import { syncCameraLooks } from "../../model.ts";
import type { I18nKey } from "../../i18n.ts";
import { furnitureName } from "../../furniture-names.ts";
import { bounds, centroid, polygonArea, type Building, type Floor, type Vec2 } from "../../model.ts";
import { BODY_FONT, clearLabels, itemRank, roomRank, textWidth, TITLE_FONT, type LabelBox } from "../../viewer/label-clear.ts";
import { type Guides, SNAP_PX, round } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** The names the plan last showed, and what they were worked out for (#341). */
const labelMemo = new WeakMap<Fp3dEditor, { key: unknown[]; shown: ReadonlySet<string> }>();

/** PlanViewPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class PlanViewPart {
  /**
   * The names the plan shows (#341): room, outdoor area and item names in one pass ("r:", "o:", "f:" + id). Where two
   * would touch, a room's beats an outdoor area's, that beats an item's, a larger one a smaller one; the selected one
   * always shows. Zooming in makes room until all show. Worked out once per view, floor and selection, from the text
   * widths at the plan's fonts (no layout read).
   */
  planLabels(this: Fp3dEditor, floor: Floor): ReadonlySet<string> {
    const k = this._view.scale;
    const key = [floor, this._view, this._roomId, this._furnitureId, this._outdoorId, this._hiddenItems, this.hass?.language, this.unit];
    const memo = labelMemo.get(this);
    if (memo && memo.key.every((v, i) => v === key[i])) return memo.shown;
    const ids: string[] = [];
    const boxes: LabelBox[] = [];
    const add = (id: string, [x, y]: [number, number], w: number, h: number, rank: number, keep: boolean) => {
      ids.push(id);
      boxes.push({ x, y, w, h, rank, keep });
    };
    for (const r of floor.rooms) {
      // the name (13 px) and the area under it (11.5 px)
      const [x, y] = this.toScreen(centroid(r.points));
      add(`r:${r.id}`, [x, y + 2], Math.max(textWidth(r.name, `600 13px ${TITLE_FONT}`), textWidth(this.area(polygonArea(r.points)), `500 11.5px ${BODY_FONT}`)), 30, roomRank(r), r.id === this._roomId);
    }
    for (const a of floor.outdoor) {
      const b = bounds(a.points);
      // a fence is a line round the plot: its middle is somewhere in the house, so it is named only when selected
      if (a.id !== this._outdoorId && (a.type === "fence" || Math.min(b.x1 - b.x0, b.z1 - b.z0) * k <= 40)) continue;
      add(`o:${a.id}`, this.toScreen(centroid(a.points)), textWidth(this.t(`out_${a.type}` as I18nKey), `11px ${BODY_FONT}`), 14, Math.abs(polygonArea(a.points)) + 1e6, a.id === this._outdoorId);
    }
    for (const f of floor.furniture) {
      if (this._hiddenItems.includes(f.id) || (f.id !== this._furnitureId && Math.min(f.w, f.d) * k <= 44)) continue;
      const [x, y] = this.toScreen([f.x, f.z]);
      add(`f:${f.id}`, [x, this.itemLabelY(f, y) - 4], textWidth(furnitureName(this.hass, f.type), `11px ${BODY_FONT}`), 14, itemRank(f.w, f.d), f.id === this._furnitureId);
    }
    const keep = clearLabels(boxes);
    const shown = new Set(ids.filter((_, i) => keep[i]));
    labelMemo.set(this, { key, shown });
    return shown;
  }

  /** Where an item's name sits (its baseline, px): in its middle, or below it when it is too small to hold it. */
  itemLabelY(this: Fp3dEditor, f: { w: number; d: number }, cy: number): number {
    const k = this._view.scale;
    return Math.min(f.w, f.d) * k > 44 ? cy + 4 : cy + (Math.max(f.w, f.d) * k) / 2 + 14;
  }

  /** Replace the document; `base` (the state before the change) goes into the undo history. */
  setDoc(this: Fp3dEditor, next: Building, base: Building | null = this._doc): void {
    if (base) this.history.push(base, this.mergeKey, this.mergeWithin);
    this.history.track(next);
    this._doc = next;
    setCameraSensors(next);
    this.showHistory();
    this.dispatchEvent(new CustomEvent("building-changed", { detail: { building: next }, bubbles: true, composed: true }));
  }

  /** Apply a change to a copy of the document (or of `base`) and store it. */
  change(this: Fp3dEditor, mutate: (doc: Building, floor: Floor) => void, base: Building = this._doc, history = true): void {
    const next = structuredClone(base);
    const floor = next.floors.find((f) => f.id === this._floorId);
    if (!floor && this._floorId) return;
    mutate(next, floor as Floor);
    syncCameraLooks(next, base);
    this.setDoc(next, history ? base : null);
  }

  /**
   * A change of the current floor alone, made on every pointer move of a drag (#130): only that floor is copied; the
   * other floors, the settings and the recipe copies (most of a big plan) are shared with `base`, which nothing edits
   * in place. No history step (the drag records one when it ends).
   */
  changeFloor(this: Fp3dEditor, mutate: (floor: Floor) => void, base: Building): void {
    const i = base.floors.findIndex((f) => f.id === this._floorId);
    if (i < 0) return;
    const floor = structuredClone(base.floors[i]);
    mutate(floor);
    const floors = base.floors.slice();
    floors[i] = floor;
    // camera looks follow their camera on this floor; the shared floors are not touched
    syncCameraLooks({ ...base, floors: [floor] }, base);
    this.setDoc({ ...base, floors }, null);
  }

  undo(this: Fp3dEditor): void {
    const prev = this.history.undo(this._doc);
    if (prev) {
      this.restore(prev);
      announce(this.t("announce_undo"));
    }
  }

  redo(this: Fp3dEditor): void {
    const next = this.history.redo(this._doc);
    if (next) {
      this.restore(next);
      announce(this.t("announce_redo"));
    }
  }

  /** The undo / redo buttons follow the history. */
  showHistory(this: Fp3dEditor): void {
    this._canUndo = this.history.canUndo;
    this._canRedo = this.history.canRedo;
  }

  restore(this: Fp3dEditor, doc: Building): void {
    this._doc = doc;
    if (!doc.floors.some((f) => f.id === this._floorId)) this._floorId = doc.floors[0]?.id ?? null;
    if (!this.floor?.rooms.some((r) => r.id === this._roomId)) this._roomId = null;
    this._vertex = null;
    this.showHistory();
    this.dispatchEvent(new CustomEvent("building-changed", { detail: { building: doc }, bubbles: true, composed: true }));
  }

  // ------------------------------------------------------------------ view transform

  toScreen(this: Fp3dEditor, p: Vec2): [number, number] {
    const { scale, ox, oy } = this._view;
    return [p[0] * scale + ox, p[1] * scale + oy];
  }

  toWorld(this: Fp3dEditor, sx: number, sy: number): Vec2 {
    const { scale, ox, oy } = this._view;
    return [(sx - ox) / scale, (sy - oy) / scale];
  }

  localPoint(this: Fp3dEditor, e: PointerEvent | WheelEvent): [number, number] {
    // the plan, not the first svg: the toolbar icons come first since #249 (#253)
    const rect = (this.renderRoot.querySelector("svg.fp3d-plan") as SVGSVGElement).getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  /** "Whole plan": the floor's rooms; `all` ("Fit everything", #91): the plot, items and devices in the garden too. */
  fit(this: Fp3dEditor, all = false): void {
    const pts = this.floor?.rooms.flatMap((r) => r.points) ?? [];
    // the garden too with the outdoor tools, the Outside panel or the list of outdoor areas open (#401); from upstairs the
    // garden of the floors below, drawn faintly
    const garden = all || this._tool === "outdoor" || this._tool === "pool" || this._toolMenu === "outside" || this.outdoorListOpen;
    if (garden) for (const a of this.floor?.outdoor ?? []) pts.push(...a.points);
    if (garden && this.floor) for (const f of this._doc.floors) if (f.elevation < this.floor.elevation) for (const a of f.outdoor) pts.push(...a.points);
    if (all) {
      for (const f of this.floor?.furniture ?? []) {
        const r = Math.max(f.w, f.d) / 2;
        pts.push([f.x - r, f.z - r], [f.x + r, f.z + r]);
      }
      for (const p of this.floor?.placements ?? []) pts.push([p.x, p.z]);
    }
    this.fittedAll = all;
    // the roof tool shows the roof sections too, which reach past the rooms
    if (this._tool === "roof") for (const s of this._doc.settings.roof.sections ?? []) pts.push([s.x0, s.z0], [s.x1, s.z1]);
    const b = pts.length ? bounds(pts) : { x0: 0, z0: 0, x1: 10, z1: 8 };
    const margin = 1.5;
    const w = b.x1 - b.x0 + 2 * margin;
    const h = b.z1 - b.z0 + 2 * margin;
    const scale = Math.max(8, Math.min(400, Math.min(this._size.w / w, this._size.h / h)));
    this._view = {
      scale,
      ox: this._size.w / 2 - ((b.x0 + b.x1) / 2) * scale,
      oy: this._size.h / 2 - ((b.z0 + b.z1) / 2) * scale,
    };
    this.fittedView = this._view;
  }

  /** Bring a plan point to the middle of the plan, zoomed in enough to see a small item there. */
  showPoint(this: Fp3dEditor, x: number, z: number): void {
    // already in view (with a margin): the plan stays where it is (#75)
    const [sx, sy] = this.toScreen([x, z]);
    const m = 32;
    if (sx >= m && sy >= m && sx <= this._size.w - m && sy <= this._size.h - m) return;
    const scale = Math.max(this._view.scale, 70);
    this._view = { scale, ox: this._size.w / 2 - x * scale, oy: this._size.h / 2 - z * scale };
  }

  zoomAt(this: Fp3dEditor, factor: number, sx: number, sy: number): void {
    const { scale, ox, oy } = this._view;
    const next = Math.max(8, Math.min(600, scale * factor));
    const k = next / scale;
    this._view = { scale: next, ox: sx - (sx - ox) * k, oy: sy - (sy - oy) * k };
  }

  /** Zoom about the middle of the plan (the navigation buttons, #234). */
  zoomBy(this: Fp3dEditor, factor: number): void {
    this.zoomAt(factor, this._size.w / 2, this._size.h / 2);
  }

  /** Move the view by (dx, dy) screen pixels: the plan follows (arrow keys without a selection, #234). */
  panBy(this: Fp3dEditor, dx: number, dy: number): void {
    this._view = { ...this._view, ox: this._view.ox + dx, oy: this._view.oy + dy };
  }

  /**
   * The navigation control on the plan (#234): zoom in, zoom out, whole plan. It sits on the right edge, half way
   * down, so it is clear of the hint bar (bottom left) and of the 3D toggles (top); the buttons are touch sized.
   */
  renderNav(this: Fp3dEditor) {
    const btn = (glyph: string, tip: I18nKey, act: () => void) => html`<button class="fp3d-nav-btn" title=${this.t(tip)} aria-label=${this.t(tip)} @click=${act}>${glyph}</button>`;
    return html`<div class="fp3d-nav" role="group" aria-label=${this.t("nav_label")}>
      ${btn("+", "nav_zoom_in", () => this.zoomBy(1.4))}${btn("−", "nav_zoom_out", () => this.zoomBy(1 / 1.4))}${btn("⤢", "fit_hint", () => this.fit(this.fittedAll))}
    </div>`;
  }

  // ------------------------------------------------------------------ snapping

  snap(this: Fp3dEditor, p: Vec2, skip?: { roomId: string; index?: number }, free = false): Vec2 {
    this._guides = {};
    if (free) return p;
    const thr = SNAP_PX / this._view.scale;
    const rooms = this.floor?.rooms ?? [];
    const others: Vec2[] = [];
    for (const r of rooms) {
      r.points.forEach((q, i) => {
        if (skip && r.id === skip.roomId && (skip.index === undefined || skip.index === i)) return;
        others.push(q);
      });
    }
    // 1. corners of rooms
    let best: Vec2 | null = null;
    let bestD = thr;
    for (const q of others) {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    if (best) {
      this._guides = { point: best };
      return [best[0], best[1]];
    }
    // 2. edges of other rooms (so walls can meet in a T)
    for (const r of rooms) {
      if (skip && r.id === skip.roomId) continue;
      for (let i = 0; i < r.points.length; i++) {
        const a = r.points[i];
        const b = r.points[(i + 1) % r.points.length];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const l2 = dx * dx + dz * dz;
        if (l2 < 1e-9) continue;
        const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2;
        if (t <= 0 || t >= 1) continue;
        const q: Vec2 = [a[0] + t * dx, a[1] + t * dz];
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const g = this._doc.settings.grid;
        if (Math.abs(dz) < 1e-9) q[0] = Math.min(Math.max(Math.round(q[0] / g) * g, Math.min(a[0], b[0])), Math.max(a[0], b[0]));
        if (Math.abs(dx) < 1e-9) q[1] = Math.min(Math.max(Math.round(q[1] / g) * g, Math.min(a[1], b[1])), Math.max(a[1], b[1]));
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
    }
    if (best) {
      this._guides = { point: best };
      return [round(best[0]), round(best[1])];
    }
    // 3. grid, with alignment to other corners per axis
    const g = this._doc.settings.grid;
    const out: Vec2 = [round(Math.round(p[0] / g) * g), round(Math.round(p[1] / g) * g)];
    let ax = thr;
    let az = thr;
    const guides: Guides = {};
    for (const q of others) {
      if (Math.abs(q[0] - p[0]) < ax) {
        ax = Math.abs(q[0] - p[0]);
        out[0] = q[0];
        guides.x = q[0];
      }
      if (Math.abs(q[1] - p[1]) < az) {
        az = Math.abs(q[1] - p[1]);
        out[1] = q[1];
        guides.z = q[1];
      }
    }
    this._guides = guides;
    return out;
  }

  pushHistory(this: Fp3dEditor, base: Building): void {
    this.history.push(base);
    this.showHistory();
  }

  /** A drag was cancelled: the plan as it was before it, with the history following (#184; else a reopen drops it). */
  restoreLive(this: Fp3dEditor, base: Building): void {
    this._doc = base;
    this.history.track(base);
    this.dispatchEvent(new CustomEvent("building-changed", { detail: { building: base }, bubbles: true, composed: true }));
  }

  /** Alignment lines on a floor (#143): every item's edges and centre (but `skip`'s) and the rooms' centre lines. */
  alignLinesFor(this: Fp3dEditor, floor: Floor, skip: string | null): AlignLines {
    const boxes: Box[] = [];
    for (const m of floor.furniture) if (m.id !== skip) boxes.push(itemBox(m));
    return alignLines(boxes, floor.rooms);
  }

  /** The guides shown on the plan (#143), labelled in the plan's unit ("mid", "= 0.60 m"); none: nothing drawn. */
  showGuides(this: Fp3dEditor, guides: readonly Guide[]): void {
    if (!guides.length) {
      if (this._guides.lines) this._guides = {};
      return;
    }
    this._guides = {
      lines: guides.map((q) => ({ a: q.a, b: q.b, label: this.t(`snap_${q.kind}` as I18nKey, q.value !== undefined ? { d: this.m(q.value) } : undefined) })),
    };
  }

  renderGrid(this: Fp3dEditor) {
    const { scale } = this._view;
    const { w, h } = this._size;
    const minor = scale >= 90 ? 0.1 : scale >= 30 ? 0.5 : 1;
    const major = scale >= 20 ? 1 : 5;
    const [x0, z0] = this.toWorld(0, 0);
    const [x1, z1] = this.toWorld(w, h);
    const lines: ReturnType<typeof svg>[] = [];
    const push = (step: number, cls: string) => {
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
        const sx = this.toScreen([x, 0])[0];
        lines.push(svg`<line class=${cls} x1=${sx} y1="0" x2=${sx} y2=${h} />`);
      }
      for (let z = Math.ceil(z0 / step) * step; z <= z1; z += step) {
        const sy = this.toScreen([0, z])[1];
        lines.push(svg`<line class=${cls} x1="0" y1=${sy} x2=${w} y2=${sy} />`);
      }
    };
    if (minor < major) push(minor, "fp3d-grid-minor");
    push(major, "fp3d-grid-major");
    const [ox, oy] = this.toScreen([0, 0]);
    lines.push(svg`<circle class="fp3d-origin" cx=${ox} cy=${oy} r="3" />`);
    return svg`<g pointer-events="none">${lines}</g>`;
  }

  renderGuides(this: Fp3dEditor) {
    const g = this._guides;
    const { w, h } = this._size;
    return svg`<g pointer-events="none">
      ${g.x !== undefined ? svg`<line class="fp3d-guide" x1=${this.toScreen([g.x, 0])[0]} y1="0" x2=${this.toScreen([g.x, 0])[0]} y2=${h} />` : nothing}
      ${g.z !== undefined ? svg`<line class="fp3d-guide" x1="0" y1=${this.toScreen([0, g.z])[1]} x2=${w} y2=${this.toScreen([0, g.z])[1]} />` : nothing}
      ${g.point ? svg`<circle class="fp3d-snap" cx=${this.toScreen(g.point)[0]} cy=${this.toScreen(g.point)[1]} r="9" />` : nothing}
      ${g.lines ? this.renderSnapLines(g.lines) : nothing}
    </g>`;
  }

  /** Snap guides (#143): thin dashed accent lines, each with its short label once ("mid", "= 0.60 m"). */
  renderSnapLines(this: Fp3dEditor, lines: NonNullable<Guides["lines"]>) {
    return lines.map((l, i) => {
      const [ax, ay] = this.toScreen(l.a);
      const [bx, by] = this.toScreen(l.b);
      // equal gaps repeat their label; a label already shown at an earlier line is not drawn again (but "= 0.60 m" twice is the point)
      const show = l.label && (lines.findIndex((q) => q.label === l.label) === i || l.label.startsWith("="));
      return svg`<line class="fp3d-snapline" x1=${ax} y1=${ay} x2=${bx} y2=${by} />${show
        ? svg`<text class="fp3d-snaplabel" x=${(ax + bx) / 2 + 6} y=${(ay + by) / 2 - 6}>${l.label}</text>`
        : nothing}`;
    });
  }
}
