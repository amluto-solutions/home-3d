/** The editor's items list (#75): items grouped by room, and the window of rows a long list draws. */
import { pointInPolygon, polygonArea, type Furniture, type Room } from "./model.ts";

/**
 * The floor's items by room id, in the floor's order. An item belongs to the smallest room its centre lies in
 * (as the plan picks rooms); items outside every room are listed under `null`.
 */
export function itemsByRoom(rooms: readonly Room[], items: readonly Furniture[]): Map<string | null, Furniture[]> {
  const bySize = [...rooms].sort((a, b) => polygonArea(a.points) - polygonArea(b.points));
  const out = new Map<string | null, Furniture[]>();
  for (const f of items) {
    const id = bySize.find((r) => pointInPolygon([f.x, f.z], r.points))?.id ?? null;
    const list = out.get(id);
    if (list) list.push(f);
    else out.set(id, [f]);
  }
  return out;
}

/**
 * Which rows of a list of `count` fixed-height rows to draw, scrolled to `scrollTop` in a box `viewport` px
 * high, with `overscan` extra rows either side. `before` / `after` are the spacer heights above and below them.
 */
export function listWindow(count: number, scrollTop: number, viewport: number, rowH: number, overscan = 4): { start: number; end: number; before: number; after: number } {
  const visible = Math.ceil(viewport / rowH);
  const first = Math.max(0, Math.min(Math.floor(scrollTop / rowH), count - visible));
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visible + overscan);
  return { start, end, before: start * rowH, after: (count - end) * rowH };
}
