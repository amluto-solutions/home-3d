// Walls on the plan: free walls, wall heights, slopes and splits (the Walls fold of the room form, one row per
// wall), the edge highlight.

import { html, nothing, svg } from "lit";
import type { FreeWall } from "../../model.ts";
import { generateWalls, type Wall } from "../../geometry/walls.ts";
import { wallSummary } from "../../geometry/room-walls.ts";
import { isFixed, uid, type Floor, type Room, type Vec2 } from "../../model.ts";
import { round } from "./helpers.ts";
import { setSideFold, sideFoldOpen } from "./item-sections.ts";
import type { Fp3dEditor } from "../editor.ts";

/** WallsPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class WallsPart {
  /** A free-standing wall from a to b (a partition through part of a room). */
  addFreeWall(this: Fp3dEditor, a: Vec2, b: Vec2): void {
    if (!this.floor) return;
    const wall: FreeWall = { id: uid("wall"), a: [round(a[0]), round(a[1])], b: [round(b[0]), round(b[1])], thickness: null };
    this.change((_, floor) => (floor.walls = [...(floor.walls ?? []), wall]));
    this.selectItem("wall", wall.id);
  }

  updateFreeWall(this: Fp3dEditor, patch: Partial<FreeWall>): void {
    const id = this._wallId;
    if (!id) return;
    this.change((_, floor) => Object.assign((floor.walls ?? []).find((w) => w.id === id)!, patch));
  }

  async deleteFreeWall(this: Fp3dEditor): Promise<void> {
    const id = this._wallId;
    if (!id || !this.isEditor || !(await this.confirmFixedDelete("wall", id))) return;
    this.change((_, floor) => {
      floor.walls = (floor.walls ?? []).filter((w) => w.id !== id);
      floor.openings = floor.openings.filter((o) => o.wall !== id);
    });
    this._wallId = null;
  }

  /** The plan symbol of free walls: a wide invisible hit line, and end handles when selected. */
  renderFreeWalls(this: Fp3dEditor, floor: Floor) {
    return svg`<g>${(floor.walls ?? []).map((w) => {
      const [x0, y0] = this.toScreen(w.a);
      const [x1, y1] = this.toScreen(w.b);
      const sel = w.id === this._wallId;
      return svg`<g data-free-wall=${w.id} class=${`fp3d-free-wall${sel ? " fp3d-free-wall-sel" : ""}`}>
        <line class="fp3d-hit" x1=${x0} y1=${y0} x2=${x1} y2=${y1} />
        <line class="fp3d-free-wall-line" x1=${x0} y1=${y0} x2=${x1} y2=${y1} />
      </g>
      ${sel && this.isEditor && !isFixed(w, true, this._doc.settings)
        ? svg`<g class="fp3d-vertex" data-wall-end=${`${w.id}:a`}><circle cx=${x0} cy=${y0} r="16" class="fp3d-hit" /><circle cx=${x0} cy=${y0} r="6" /></g>
            <g class="fp3d-vertex" data-wall-end=${`${w.id}:b`}><circle cx=${x1} cy=${y1} r="16" class="fp3d-hit" /><circle cx=${x1} cy=${y1} r="6" /></g>`
        : nothing}`;
    })}</g>`;
  }

  renderFreeWallForm(this: Fp3dEditor, w: FreeWall) {
    const length = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const setLength = (v: number) => {
      const l = Math.max(0.1, v);
      const k = l / (length || 1);
      this.updateFreeWall({ b: [round(w.a[0] + (w.b[0] - w.a[0]) * k), round(w.a[1] + (w.b[1] - w.a[1]) * k)] });
    };
    // X/Y name the wall's middle like a piece of furniture's; typing moves the whole wall, off the grid (#315)
    const mid: Vec2 = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
    const moveTo = (i: 0 | 1, v: number) => {
      const d = v - mid[i];
      const shift = (p: Vec2): Vec2 => (i === 0 ? [round(p[0] + d), p[1]] : [p[0], round(p[1] + d)]);
      this.updateFreeWall({ a: shift(w.a), b: shift(w.b) });
    };
    return html`<section>
      ${this.renderPanelHeader({
        id: `wall:${w.id}`,
        title: this.t("free_wall"),
        where: this.roomAt(mid) ? this.floor?.rooms.find((r) => r.id === this.roomAt(mid))?.name : this.floor?.name,
        lock: this.fixLock("wall", w.id),
        menu: [{ label: this.t("delete"), keys: ["Del"], danger: true, run: () => this.deleteFreeWall() }],
      })}
      <div class="fp3d-form">
        ${this.len(this.t("x"), mid[0], (v) => moveTo(0, v))} ${this.len(this.t("z"), mid[1], (v) => moveTo(1, v))}
        <p class="fp3d-sub fp3d-wide">${this.t("wall_pos_hint")}</p>
        ${this.len(this.t("wall_length"), length, setLength, 0.01, 0.1)}
        ${this.len(this.t("wall_thickness"), w.thickness ?? this._doc.settings.wall_interior, (v) => this.updateFreeWall({ thickness: Math.min(1, Math.max(0.02, v)) }), 0.01, 0.02)}
        ${this.len(this.t("wall_height"), w.height ?? this.floor?.height ?? 2.5, (v) => this.updateFreeWall({ height: v >= (this.floor?.height ?? 2.5) - 0.005 ? null : Math.max(0.05, v) }), 0.05, 0.05)}
      </div>
      <p class="fp3d-sub">${this.t("free_wall_hint")}</p>
    </section>`;
  }

  renderWalls(this: Fp3dEditor, walls: Wall[]) {
    const H = this.floor?.height ?? 2.5;
    return svg`<g pointer-events="none">${walls.map((w) => {
      const low = w.height !== undefined && w.height < H - 0.01;
      const cls = `fp3d-wall${w.exterior ? " fp3d-wall-ext" : ""}${low ? " fp3d-wall-low" : ""}`;
      return svg`<polygon class=${cls} points=${w.footprint.map((p) => this.toScreen(p).join(",")).join(" ")} />`;
    })}</g>`;
  }

  /** Sets the height of one edge of a room, and of every wall piece shared with it. */
  /** The parts another room splits an edge into (start distances along the edge), in order; one part when whole. */
  edgeParts(this: Fp3dEditor, room: Room, edge: number): number[] {
    const floor = this.floor;
    if (!floor) return [0];
    // the parts a per-part height list follows (#157): also the ones whose walls merged or are left out ("No wall")
    const starts = generateWalls(floor.rooms, { exterior: this._doc.settings.wall_exterior, interior: this._doc.settings.wall_interior }, floor.walls ?? []).parts.get(`${room.id}:${edge}`) ?? [];
    return starts.length ? [...new Set(starts)].sort((a, b) => a - b) : [0];
  }

  /** A sloping wall on a room edge: its heights at the edge's start and end corner, or null for a plain wall (D569). */
  setEdgeSlope(this: Fp3dEditor, room: Room, edge: number, slope: [number, number] | null): void {
    if (!this.isEditor) return;
    this.change((_, f) => {
      const r = f.rooms.find((x) => x.id === room.id);
      if (!r) return;
      const list = (r.wall_slopes ?? []).slice(0, r.points.length);
      while (list.length < r.points.length) list.push(null);
      list[edge] = slope ? [Math.round(Math.max(0.05, slope[0]) * 1000) / 1000, Math.round(Math.max(0.05, slope[1]) * 1000) / 1000] : null;
      r.wall_slopes = list.every((x) => !x) ? undefined : list;
    });
  }

  /** Set a wall height on a room edge (and on the rooms sharing it), or on one part of a split edge only. */
  setEdgeHeight(this: Fp3dEditor, room: Room, edge: number, height: number | null, part?: number): void {
    const floor = this.floor;
    if (!floor || !this.isEditor) return;
    if (part !== undefined) {
      const n = this.edgeParts(room, edge).length;
      this.change((_, f) => {
        const r = f.rooms.find((x) => x.id === room.id);
        if (!r) return;
        const list = (r.wall_heights ?? []).slice(0, r.points.length);
        while (list.length < r.points.length) list.push(null);
        const cur = list[edge];
        const parts: (number | null)[] = Array.isArray(cur) ? [...cur] : new Array<number | null>(n).fill(typeof cur === "number" ? cur : null);
        while (parts.length < n) parts.push(null);
        parts[part] = height;
        list[edge] = parts.every((h) => h === parts[0]) ? parts[0] : parts;
        r.wall_heights = list.every((h) => h === null) ? undefined : list;
      });
      return;
    }
    const walls = generateWalls(floor.rooms, { exterior: this._doc.settings.wall_exterior, interior: this._doc.settings.wall_interior }, floor.walls ?? []).walls;
    const sources = walls.filter((w) => w.sources.some((s) => s.room_id === room.id && s.edge === edge)).flatMap((w) => w.sources);
    if (!sources.some((s) => s.room_id === room.id && s.edge === edge)) sources.push({ room_id: room.id, edge, t0: 0, t1: 0 });
    this.change((_, f) => {
      for (const s of sources) {
        const r = f.rooms.find((x) => x.id === s.room_id);
        if (!r) continue;
        const list = (r.wall_heights ?? []).slice(0, r.points.length);
        while (list.length < r.points.length) list.push(null);
        list[s.edge] = height;
        r.wall_heights = list.every((h) => h === null) ? undefined : list;
      }
    });
  }

  /** Cut a wall (or one part of it) in the middle: a split point of its own, the new part keeps the height. */
  splitEdge(this: Fp3dEditor, room: Room, edge: number, part: number | undefined): void {
    if (!this.isEditor) return;
    const pts = room.points;
    const len = Math.hypot(pts[(edge + 1) % pts.length][0] - pts[edge][0], pts[(edge + 1) % pts.length][1] - pts[edge][1]);
    const starts = this.edgeParts(room, edge);
    const s0 = part === undefined ? 0 : starts[part];
    const s1 = part === undefined ? len : (starts[part + 1] ?? len);
    if (s1 - s0 < 0.4) return;
    const at = Math.round(((s0 + s1) / 2) * 100) / 100;
    this.change((_, f) => {
      const r = f.rooms.find((x) => x.id === room.id);
      if (!r) return;
      const splits = (r.wall_splits ?? []).slice(0, r.points.length);
      while (splits.length < r.points.length) splits.push(null);
      splits[edge] = [...(splits[edge] ?? []), at].sort((a, b) => a - b);
      r.wall_splits = splits;
      // a per-part height list grows by the new part, which starts with the height of the one it was cut from
      const cur = r.wall_heights?.[edge];
      if (Array.isArray(cur)) {
        const k = part ?? 0;
        cur.splice(k + 1, 0, cur[k] ?? null);
      }
    });
  }

  /** Move a split point along its edge (kept clear of the ends and of other stops). */
  moveSplit(this: Fp3dEditor, room: Room, edge: number, from: number, to: number): void {
    const pts = room.points;
    const len = Math.hypot(pts[(edge + 1) % pts.length][0] - pts[edge][0], pts[(edge + 1) % pts.length][1] - pts[edge][1]);
    const others = this.edgeParts(room, edge).filter((s) => Math.abs(s - from) > 1e-3 && s > 0);
    let at = Math.max(0.1, Math.min(len - 0.1, Math.round(to * 100) / 100));
    if (others.some((s) => Math.abs(s - at) < 0.1)) at = from;
    this.change((_, f) => {
      const r = f.rooms.find((x) => x.id === room.id);
      const list = r?.wall_splits?.[edge];
      if (!list) return;
      const k = list.findIndex((d) => Math.abs(d - from) < 1e-3);
      if (k >= 0) list[k] = at;
      list.sort((a, b) => a - b);
    });
  }

  /** Remove a split point: the part behind it joins the one before (whose height stays). */
  joinSplit(this: Fp3dEditor, room: Room, edge: number, at: number, part: number): void {
    this.change((_, f) => {
      const r = f.rooms.find((x) => x.id === room.id);
      if (!r?.wall_splits?.[edge]) return;
      const list = r.wall_splits[edge]!.filter((d) => Math.abs(d - at) > 1e-3);
      r.wall_splits[edge] = list.length ? list : null;
      if (r.wall_splits.every((l) => !l)) r.wall_splits = undefined;
      const cur = r.wall_heights?.[edge];
      if (Array.isArray(cur)) {
        cur.splice(part, 1);
        if (cur.every((h) => h === cur[0])) r.wall_heights![edge] = cur[0] ?? null;
      }
    });
  }

  /** Marks on the selected room's edges where a wall is split by hand. */
  renderSplitMarks(this: Fp3dEditor, room: Room) {
    const pts = room.points;
    return svg`${(room.wall_splits ?? []).flatMap((list, i) => {
      if (!list || i >= pts.length) return [];
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / l;
      const uz = (b[1] - a[1]) / l;
      return list.map((d) => {
        const [x, y] = this.toScreen([a[0] + ux * d, a[1] + uz * d]);
        // a short tick across the wall
        return svg`<line class="fp3d-split-mark" x1=${x - uz * 7} y1=${y + ux * 7} x2=${x + uz * 7} y2=${y - ux * 7} />`;
      });
    })}`;
  }

  /**
   * The room's Walls fold (#416, MANY-4): one row per wall ("Wall 1–2 · 4 m · 2.5 m high") that opens that wall's
   * height, slope, thickness, split and wall view. Every button says what it does; the help is behind "i" (HELP-2).
   * Hovering or focusing a wall's row lights the wall up on the plan.
   */
  renderEdgeHeights(this: Fp3dEditor, room: Room) {
    const sum = wallSummary(room);
    const special = [sum.open ? this.t("walls_open_n", { n: sum.open }) : "", sum.sloping ? this.t("walls_sloping_n", { n: sum.sloping }) : ""].filter(Boolean).join(", ");
    const own = room.points.filter((_, i) => this.wallOwnSettings(room, i) > 0).length;
    const open = this._wallsOpen;
    return this.foldRow("walls", open, () => this.setWallsOpen(!open), this.t("walls_section", { n: sum.walls }), special, own, () =>
      html`<div class="fp3d-with-info fp3d-walls-top">
          <button class="fp3d-btn fp3d-wv-open" title=${this.t("wall_view_open")} @click=${() => this.openRoomWalls(room)}>${this.t("wall_view_room")}</button>
          ${this.infoButton("room_wall_hint", this.t("walls_section", { n: sum.walls }))}
        </div>
        ${room.points.map((_, i) => this.renderWallRow(room, i))}`,
    );
  }

  /** How many settings of its own one wall of a room has (height, slope, thickness, split points). */
  wallOwnSettings(this: Fp3dEditor, room: Room, i: number): number {
    const h = room.wall_heights?.[i] ?? null;
    const height = Array.isArray(h) ? h.some((x) => x !== null) : h !== null;
    return (height ? 1 : 0) + (room.wall_slopes?.[i] ? 1 : 0) + (room.wall_thickness?.[i] != null ? 1 : 0) + (room.wall_splits?.[i]?.length ? 1 : 0);
  }

  /** What a closed wall row says (#416): its length and height ("4 m · 2.5 m high"), sloping, no wall or its parts. */
  wallRowSummary(this: Fp3dEditor, room: Room, i: number): string {
    const H = this.floor?.height ?? 2.5;
    const n = room.points.length;
    const a = room.points[i];
    const b = room.points[(i + 1) % n];
    const len = this.m(Math.hypot(b[0] - a[0], b[1] - a[1]), 2);
    const entry = room.wall_heights?.[i] ?? null;
    const slope = room.wall_slopes?.[i] ?? null;
    const parts = this.edgeParts(room, i).length;
    const heights = Array.isArray(entry) ? entry : [entry];
    const height = heights.every((h) => h === 0)
      ? this.t("wall_none")
      : slope
        ? this.t("wall_row_sloping", { a: this.m(slope[0]), b: this.m(slope[1]) })
        : this.t("wall_row_high", { h: this.m(heights.find((h) => h !== null && h !== 0) ?? H) });
    return [len, height, parts > 1 ? this.t("wall_row_parts", { n: parts }) : ""].filter(Boolean).join(" · ");
  }

  /** One wall of the room as a fold row; open, it shows that wall's settings, one block per part of a split wall. */
  renderWallRow(this: Fp3dEditor, room: Room, i: number) {
    const n = room.points.length;
    const key = `wall:${room.id}:${i}`;
    const open = sideFoldOpen(this, key, false);
    const on = () => (this._edgeHi = i);
    const off = () => (this._edgeHi = null);
    return html`<div class="fp3d-wall-row${i === this._edgeHi ? " fp3d-edge-on" : ""}" @mouseenter=${on} @mouseleave=${off} @focusin=${on} @focusout=${off}>
      ${this.foldRow(`wall-${i}`, open, () => setSideFold(this, key, !open), this.t("wall_n", { a: i + 1, b: ((i + 1) % n) + 1 }), this.wallRowSummary(room, i), this.wallOwnSettings(room, i), () => this.renderWallBody(room, i))}
    </div>`;
  }

  /** The settings of one wall (#416): height or the two slope heights, Sloping, Full room height, No wall, split, thickness, wall view. */
  renderWallBody(this: Fp3dEditor, room: Room, i: number) {
    const H = this.floor!.height;
    const n = room.points.length;
    const s = this._doc.settings;
    const a = room.points[i];
    const b = room.points[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const entry = room.wall_heights?.[i] ?? null;
    const slope = room.wall_slopes?.[i] ?? null;
    // an outer wall's default thickness is the exterior one
    const outer = generateWalls(this.floor!.rooms, { exterior: s.wall_exterior, interior: s.wall_interior }, this.floor!.walls ?? []).walls.some(
      (w) => w.exterior && w.sources.some((src) => src.room_id === room.id && src.edge === i),
    );
    const def = outer ? s.wall_exterior : s.wall_interior;
    const setThick = (v: number | null) =>
      this.change((_, f) => {
        const r = f.rooms.find((x) => x.id === room.id);
        if (!r) return;
        const list = (r.wall_thickness ?? []).slice(0, r.points.length);
        while (list.length < r.points.length) list.push(null);
        list[i] = v;
        r.wall_thickness = list.every((t) => t === null) ? undefined : list;
      });
    // an edge another room splits: one block per part, each with its own height (#77)
    const starts = this.edgeParts(room, i);
    const parts = starts.length > 1 ? starts.map((_, k) => k) : [undefined];
    const first = Array.isArray(entry) ? (entry[0] ?? null) : entry;
    return html`${parts.map((part) => {
        const h = part === undefined ? first : Array.isArray(entry) ? (entry[part] ?? null) : entry;
        const partLen = part === undefined ? len : (starts[part + 1] ?? len) - starts[part];
        const set = (v: number | null) => this.setEdgeHeight(room, i, v, part);
        return html`<div class="fp3d-edge-height${h !== null ? " fp3d-edge-low" : ""}" data-part=${part ?? "all"}>
          ${part === undefined ? nothing : html`<span class="fp3d-wide"><b>${this.t("wall_part", { n: part + 1 })}</b> <span class="fp3d-muted">${this.m(partLen, 2)}</span></span>`}
          ${h === 0
            ? html`<span class="fp3d-muted">${this.t("wall_none")}</span>`
            : slope && part === undefined
              ? html`${this.len(this.t("wall_slope_start", { n: i + 1 }), slope[0], (v) => this.setEdgeSlope(room, i, [v, slope[1]]), 0.05, 0.05)}
                ${this.len(this.t("wall_slope_end", { n: ((i + 1) % n) + 1 }), slope[1], (v) => this.setEdgeSlope(room, i, [slope[0], v]), 0.05, 0.05)}`
              : this.len(this.t("wall_height"), h ?? H, (v) => set(v >= H - 0.005 ? null : Math.max(0.05, v)), 0.05, 0.05)}
          ${this.isEditor && part === undefined && h !== 0
            ? html`<button class="fp3d-btn" aria-pressed=${!!slope} title=${this.t("wall_slope_hint")} @click=${() => this.setEdgeSlope(room, i, slope ? null : [h ?? H, h ?? H])}>${this.t("wall_slope")}</button>`
            : nothing}
          ${this.isEditor && h !== null ? html`<button class="fp3d-btn" @click=${() => set(null)}>${this.t("wall_height_full")}</button>` : nothing}
          ${this.isEditor && h !== 0 ? html`<button class="fp3d-btn" title=${this.t("wall_none_hint")} @click=${() => set(0)}>${this.t("wall_none")}</button>` : nothing}
          ${this.isEditor && partLen >= 0.4 ? html`<button class="fp3d-btn" title=${this.t("wall_split_hint")} @click=${() => this.splitEdge(room, i, part)}>${this.t("wall_split")}</button>` : nothing}
          ${part !== undefined && part > 0 && (room.wall_splits?.[i] ?? []).some((d) => Math.abs(d - starts[part]) < 1e-3)
            ? html`<span class="fp3d-wide fp3d-split-row"
                >${this.len(this.t("wall_split_at"), starts[part], (v) => this.moveSplit(room, i, starts[part], v), 0.05, 0.1)}
                ${this.isEditor ? html`<button class="fp3d-btn" title=${this.t("wall_join_hint")} @click=${() => this.joinSplit(room, i, starts[part], part)}>${this.t("wall_join")}</button>` : nothing}</span
              >`
            : nothing}
        </div>`;
      })}
      ${first !== 0
        ? html`<div class="fp3d-edge-height fp3d-wall-extra">
            <span class="fp3d-wide fp3d-split-row"
              >${this.withInfo(
                this.len(this.t("edge_thickness"), room.wall_thickness?.[i] ?? def, (v) => {
                  const t = Math.min(1.5, Math.max(0.02, Math.round(v * 1000) / 1000));
                  setThick(Math.abs(t - def) < 0.0005 ? null : t);
                }, 0.01, 0.02),
                "wall_thickness_hint",
                this.t("edge_thickness"),
                false,
              )}
              ${this.isEditor && room.wall_thickness?.[i] != null ? html`<button class="fp3d-btn" @click=${() => setThick(null)}>${this.t("wall_thickness_reset")}</button>` : nothing}</span
            >
            <button class="fp3d-btn" title=${this.t("wall_view_open")} @click=${() => this.openWallView(room.id, i)}>${this.t("wall_view")}</button>
          </div>`
        : nothing}`;
  }

  setWallsOpen(this: Fp3dEditor, open: boolean): void {
    if (this._wallsOpen === open) return;
    this._wallsOpen = open;
    try {
      localStorage.setItem("home3d.wallsOpen", open ? "1" : "0");
    } catch {
      // no storage (private mode): open for this visit only
    }
  }

  /** The wall of the selected room whose row in the wall height list is hovered. */
  renderEdgeHighlight(this: Fp3dEditor) {
    const r = this.room;
    const i = this._edgeHi;
    if (!r || i === null || i >= r.points.length) return nothing;
    const [x1, y1] = this.toScreen(r.points[i]);
    const [x2, y2] = this.toScreen(r.points[(i + 1) % r.points.length]);
    return svg`<line class="fp3d-edge-hi" pointer-events="none" x1=${x1} y1=${y1} x2=${x2} y2=${y2} />`;
  }
}
