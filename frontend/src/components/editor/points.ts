// The points of a drawn outline (#395): rooms, outdoor areas and roof outlines. A "+" at the middle of every edge
// adds a point there (a press, or a drag that then moves it); right-click, a long press or Delete on a point removes
// it, never below three. Each add or remove is one undo step. The points take the keyboard: Tab to one, the arrows
// move it, Delete removes it.

import { nothing, svg } from "lit";
import { polygonBox } from "../../roof-sections.ts";
import type { Building, Vec2 } from "../../model.ts";
import { round } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** A point of an outline: a room's corner, an outdoor area's point, a flat roof section's point. */
export interface PlanPoint {
  kind: "room" | "out" | "roof";
  id: string;
  index: number;
}

/** An outline keeps at least this many points. */
export const MIN_POINTS = 3;

/** Edges shorter than this on screen (px) get no "+": it would sit on the points. */
const MID_MIN_PX = 36;

/** The point a plan element stands for: a room corner (of the selected room), an outdoor or roof outline point. */
export function pointOf(target: Element, roomId: string | null): PlanPoint | null {
  const room = target.closest("[data-vertex]")?.getAttribute("data-vertex");
  if (room != null && roomId) return { kind: "room", id: roomId, index: Number(room) };
  for (const [attr, kind] of [["data-out-vertex", "out"], ["data-roof-vertex", "roof"]] as const) {
    const v = target.closest(`[${attr}]`)?.getAttribute(attr);
    if (!v) continue;
    const at = v.lastIndexOf(":");
    return { kind, id: v.slice(0, at), index: Number(v.slice(at + 1)) };
  }
  return null;
}

/** The outline a point belongs to, in `doc` on the floor being edited; null when it is gone. */
export function outlineOf(ed: Fp3dEditor, p: Pick<PlanPoint, "kind" | "id">, doc: Building = ed._doc): Vec2[] | null {
  if (p.kind === "roof") return doc.settings.roof.sections?.find((s) => s.id === p.id)?.points ?? null;
  const floor = doc.floors.find((f) => f.id === ed._floorId);
  if (p.kind === "room") return floor?.rooms.find((r) => r.id === p.id)?.points ?? null;
  return floor?.outdoor.find((a) => a.id === p.id)?.points ?? null;
}

/** The point chosen now (a room's corner, or an outdoor or roof point of the selected area); null when none is. */
export function chosenPoint(ed: Fp3dEditor): PlanPoint | null {
  if (ed._vertex !== null && ed._roomId && !ed._outdoorId && !ed._furnitureId) return { kind: "room", id: ed._roomId, index: ed._vertex };
  const p = ed._point;
  if (!p) return null;
  const owner = p.kind === "out" ? ed._outdoorId : ed._roofId;
  const pts = owner === p.id ? outlineOf(ed, p) : null;
  return pts && p.index < pts.length ? p : null;
}

/** Choose a point (the area it belongs to stays selected). */
export function choosePoint(ed: Fp3dEditor, p: PlanPoint): void {
  if (p.kind === "room") {
    if (ed._roomId !== p.id) ed.selectItem("room", p.id);
    ed._vertex = p.index;
    ed._point = null;
    return;
  }
  if (p.kind === "out" && ed._outdoorId !== p.id) ed.selectItem("outdoor", p.id);
  if (p.kind === "roof") ed._roofId = p.id;
  ed._point = p;
}

/** Whether a point can go: its outline keeps at least three points. */
export function canRemovePoint(ed: Fp3dEditor, p: PlanPoint): boolean {
  return (outlineOf(ed, p)?.length ?? 0) > MIN_POINTS && ed.isEditor;
}

/** Remove a point (one undo step); a room's corner asks first when doors or wall settings go with it (#206). */
export async function removePoint(ed: Fp3dEditor, p: PlanPoint): Promise<void> {
  if (!canRemovePoint(ed, p)) return;
  if (p.kind === "room") {
    if (ed._roomId !== p.id) ed.selectItem("room", p.id);
    await ed.deleteVertex(p.index);
    return;
  }
  ed.change((doc, floor) => {
    if (p.kind === "roof") {
      const sec = doc.settings.roof.sections?.find((s) => s.id === p.id);
      if (!sec?.points) return;
      sec.points.splice(p.index, 1);
      Object.assign(sec, polygonBox(sec.points));
    } else floor.outdoor.find((a) => a.id === p.id)?.points.splice(p.index, 1);
  });
  ed._point = null;
}

/**
 * Add a point in the middle of edge `edge` (from point `edge` to the next) of an outdoor or roof outline, without a
 * history step: the press that adds it records the plan before it when it is let go. Returns the new point.
 */
export function addPoint(ed: Fp3dEditor, p: { kind: "out" | "roof"; id: string; edge: number }): PlanPoint | null {
  const pts = outlineOf(ed, p);
  if (!pts || !ed.isEditor) return null;
  const a = pts[p.edge];
  const b = pts[(p.edge + 1) % pts.length];
  if (!a || !b) return null;
  const mid: Vec2 = [round((a[0] + b[0]) / 2), round((a[1] + b[1]) / 2)];
  ed.change(
    (doc, floor) => {
      if (p.kind === "roof") {
        const sec = doc.settings.roof.sections?.find((s) => s.id === p.id);
        sec?.points?.splice(p.edge + 1, 0, mid);
      } else floor.outdoor.find((x) => x.id === p.id)?.points.splice(p.edge + 1, 0, mid);
    },
    ed._doc,
    false,
  );
  const at = { kind: p.kind, id: p.id, index: p.edge + 1 };
  ed._point = at;
  return at;
}

/**
 * The "+" at the middle of every edge of an outline (`attr`="id:edge"); an open outline (a fence against the house)
 * has none on its missing closing edge.
 */
export function renderMids(ed: Fp3dEditor, attr: "data-out-mid" | "data-roof-mid", id: string, pts: readonly Vec2[], open = false) {
  const n = pts.length;
  return pts.map((a, i) => {
    if (open && i === n - 1) return nothing;
    const [ax, ay] = ed.toScreen(a);
    const [bx, by] = ed.toScreen(pts[(i + 1) % n]);
    if (Math.hypot(bx - ax, by - ay) <= MID_MIN_PX) return nothing;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const at = `${id}:${i}`;
    // one attribute name per kind, as the press reads it
    const g =
      attr === "data-out-mid"
        ? svg`<g class="fp3d-mid" data-out-mid=${at}>${midMark(mx, my)}</g>`
        : svg`<g class="fp3d-mid" data-roof-mid=${at}>${midMark(mx, my)}</g>`;
    return g;
  });
}

const midMark = (x: number, y: number) => svg`<circle cx=${x} cy=${y} r="14" class="fp3d-hit" /><circle cx=${x} cy=${y} r="6" /><path d="M${x - 3} ${y}h6M${x} ${y - 3}v6" />`;

/** What a point handle says to a screen reader, and choosing it when it takes the keyboard. */
export function pointKeys(ed: Fp3dEditor, p: PlanPoint, count: number) {
  return {
    label: ed.t("point_n_of", { n: p.index + 1, m: count }),
    focus: () => {
      const cur = chosenPoint(ed);
      if (!cur || cur.kind !== p.kind || cur.id !== p.id || cur.index !== p.index) choosePoint(ed, p);
    },
  };
}
