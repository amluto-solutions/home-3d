// Keyboard helpers (the window keydown handler `onKey` itself stays on the element): Escape, focus guards and the
// arrow-key nudge.

import { openingHost } from "../../geometry/walls.ts";
import { deepActive, releaseTyping, takesTyping } from "../../focus-release.ts";
import { escapeStep } from "../../editor-keys.ts";
import { pointInPolygon, type Vec2 } from "../../model.ts";
import { round } from "./helpers.ts";
import { chosenPoint } from "./points.ts";
import { polygonBox } from "../../roof-sections.ts";
import type { Fp3dEditor } from "../editor.ts";

/** KeysPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class KeysPart {
  /** Whether one of the side panel's entity pickers shows its list (#132). */
  pickerOpen(this: Fp3dEditor): boolean {
    const pickers = (this.renderRoot as ShadowRoot | undefined)?.querySelectorAll?.("fp3d-entity-picker") ?? [];
    return [...pickers].some((p) => (p as unknown as { open?: boolean }).open);
  }

  /** One step back per Escape (#70): the box with the cursor, a menu, a pipe or outline, the item, the tool, the room. */
  escape(this: Fp3dEditor): void {
    if (this._kerbPick) {
      this._kerbPick = false;
      return;
    }
    const step = escapeStep({
      typing: takesTyping(deepActive(this.renderRoot as ShadowRoot)),
      menu: !!this._ctx,
      placing: !!this._placing,
      pipeDraft: !!this._pipeDraft,
      pipeMode: this._pipeMode,
      drawing: this._draft.length > 0,
      item: !!(this._furnitureId || this._openingId || this._deviceId || this._outdoorId || this._wallId),
      tool: this._tool,
      room: !!this._roomId,
    });
    if (step === "release") releaseTyping(this.renderRoot as ShadowRoot);
    else if (step === "close_menu") this._ctx = null;
    else if (step === "cancel_place") this.cancelPlacing();
    else if (step === "cancel_pipe") this._pipeDraft = null;
    else if (step === "end_pipe_mode") this._pipeMode = false;
    else {
      if (step === "clear_draft") this._draft = [];
      // back to the library (furnishing) or to the item's room, the tool stays
      else if (step === "deselect_item") this.selectItem("room", this._roomId);
      else if (step === "select_tool") this._tool = "select";
      else this.selectItem("room", null);
      this._cursor = null;
    }
  }

  /**
   * Nothing that uses Tab itself has the keyboard (#75): no button, link or field is focused, so Tab may step
   * through items instead of moving the focus.
   */
  keysFree(this: Fp3dEditor, path: EventTarget[]): boolean {
    const top = path[0];
    if (!top) return true;
    if (top === this || (typeof document !== "undefined" && (top === document.body || top === document.documentElement))) return true;
    return typeof SVGElement !== "undefined" && top instanceof SVGElement;
  }

  // ------------------------------------------------------------------ actions

  /**
   * Moves the selected item by (dx, dz) metres; false when nothing movable is selected. Nudges of the same selection
   * in quick succession are one undo step (#66).
   */
  nudge(this: Fp3dEditor, dx: number, dz: number): boolean {
    const key = ["nudge", this._furnitureId ? this.selection().join(",") : "", this._deviceId, this._openingId, this._wallId, this._outdoorId, this._roomId, this._vertex, this._point?.id, this._point?.index].join("|");
    this.mergeKey = key;
    try {
      return this.nudgeBy(dx, dz);
    } finally {
      this.mergeKey = null;
    }
  }

  nudgeBy(this: Fp3dEditor, dx: number, dz: number): boolean {
    const floor = this.floor;
    if (!floor || !this.isEditor) return false;
    const fix = this.selectedFix;
    const set = this._furnitureId ? this.selection() : [];
    if ((fix && this.isFixedItem(fix.kind, fix.id)) || set.some((id) => this.isFixedItem("furniture", id))) {
      this._fixedHint = true;
      return true;
    }
    const mv = (p: Vec2): Vec2 => [round(p[0] + dx), round(p[1] + dz)];
    if (set.length > 1) {
      const ids = new Set(set);
      this.change((_, f) => {
        for (const m of f.furniture) if (ids.has(m.id)) [m.x, m.z] = mv([m.x, m.z]);
      });
      return true;
    }
    const pt = chosenPoint(this);
    if (pt && pt.kind !== "room") {
      // an outdoor area's or a roof outline's chosen point moves alone (#395)
      this.change((doc, f) => {
        const sec = pt.kind === "roof" ? doc.settings.roof.sections?.find((s) => s.id === pt.id) : undefined;
        const pts = pt.kind === "roof" ? sec?.points : f.outdoor.find((a) => a.id === pt.id)?.points;
        if (pts?.[pt.index]) pts[pt.index] = mv(pts[pt.index]);
        if (sec?.points) Object.assign(sec, polygonBox(sec.points));
      });
      return true;
    }
    if (this._deviceId) {
      const id = this._deviceId;
      if (!floor.placements.some((p) => p.entity_id === id)) return false;
      this.change((_, f) => {
        const p = f.placements.find((x) => x.entity_id === id)!;
        [p.x, p.z] = mv([p.x, p.z]);
      });
    } else if (this._furnitureId) {
      const id = this._furnitureId;
      this.change((_, f) => {
        const m = f.furniture.find((x) => x.id === id);
        if (m) [m.x, m.z] = mv([m.x, m.z]);
      });
    } else if (this._openingId) {
      const o = this.opening;
      const host = o ? openingHost(o, floor.rooms, floor.walls ?? []) : null;
      if (!o || !host) return false;
      const a = host.room.points[host.edge];
      const b = host.room.points[(host.edge + 1) % host.room.points.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      // along the wall: the arrow's share in the wall direction
      const along = (dx * (b[0] - a[0]) + dz * (b[1] - a[1])) / len;
      if (Math.abs(along) < 1e-9) return true;
      this.updateOpening({ offset: this.clampOffset(host.room, host.edge, o.width, o.offset + along) });
    } else if (this._wallId) {
      const id = this._wallId;
      this.change((_, f) => {
        const w = (f.walls ?? []).find((x) => x.id === id);
        if (w) [w.a, w.b] = [mv(w.a), mv(w.b)];
      });
    } else if (this._outdoorId) {
      const id = this._outdoorId;
      this.change((_, f) => {
        const area = f.outdoor.find((x) => x.id === id);
        if (area) area.points = area.points.map(mv);
      });
    } else if (this._roomId) {
      const id = this._roomId;
      const vertex = this._vertex;
      const room = floor.rooms.find((r) => r.id === id);
      if (!room) return false;
      // a selected corner moves alone; otherwise the room moves with the devices in it
      const inside = new Set(floor.placements.filter((pl) => pointInPolygon([pl.x, pl.z], room.points)).map((pl) => pl.entity_id));
      this.change((_, f) => {
        const r = f.rooms.find((x) => x.id === id)!;
        if (vertex !== null && vertex < r.points.length) {
          r.points[vertex] = mv(r.points[vertex]);
          return;
        }
        r.points = r.points.map(mv);
        for (const pl of f.placements) if (inside.has(pl.entity_id)) [pl.x, pl.z] = mv([pl.x, pl.z]);
      });
    } else return false;
    return true;
  }
}
