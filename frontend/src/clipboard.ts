/**
 * The editor's own clipboard for items (#74) and outdoor areas (#400): Ctrl+C copies the chosen items and areas,
 * Ctrl+V pastes them on the floor being edited, so they go to another floor (or another home) as copies (the item
 * panel's floor dropdown, #73, moves them). It lives in memory only, never in the system clipboard, and keeps what
 * was copied as it was when copied.
 */

import type { I18nKey } from "./i18n.ts";
import type { Floor, Furniture, OutdoorArea, Vec2 } from "./model.ts";

export interface ItemClip {
  /** The floor the items were copied from. */
  floor: string;
  items: Furniture[];
  /** Outdoor areas and pools copied with the items (#400); missing in a clip of items only. */
  areas?: OutdoorArea[];
  /** Pastes so far per floor: each one sits a step further off. */
  pastes: Record<string, number>;
}

/** What one paste adds: the copied items and areas, with new ids. */
export interface Pasted {
  items: Furniture[];
  areas: OutdoorArea[];
}

/** How far (m, along x and z) each paste sits from the one before. */
export const PASTE_STEP = 0.3;

/** The items `ids` and the outdoor areas `areaIds` of a floor, copied; null when none of them is there. */
export function copyItems(floor: Floor, ids: readonly string[], areaIds: readonly string[] = []): ItemClip | null {
  const set = new Set(ids);
  const items = floor.furniture.filter((m) => set.has(m.id)).map((m) => structuredClone(m));
  const areaSet = new Set(areaIds);
  const areas = floor.outdoor.filter((a) => areaSet.has(a.id)).map((a) => structuredClone(a));
  if (!items.length && !areas.length) return null;
  return areas.length ? { floor: floor.id, items, areas, pastes: {} } : { floor: floor.id, items, pastes: {} };
}

/** How many things the clipboard holds (items and areas), for "Paste (n)". */
export function clipSize(clip: ItemClip): number {
  return clip.items.length + (clip.areas?.length ?? 0);
}

/** The middle of what the clipboard holds: of the items' centres and the areas' corners. */
export function clipCentre(clip: ItemClip): Vec2 {
  const pts: Vec2[] = [...clip.items.map((m): Vec2 => [m.x, m.z]), ...(clip.areas ?? []).flatMap((a) => a.points)];
  if (!pts.length) return [0, 0];
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

/**
 * Copies of everything in the clipboard for floor `floorId` (#400), with new ids. Without `at` they sit as
 * `pasteItems` puts items: right above or below the originals on another floor, a step off on the same floor, a step
 * more with every paste. With `at` (the pointer on the plan) the copies are centred there, on the grid `grid` (m).
 * A pasted area has no Home Assistant area (as a duplicated room, #186); a pasted pool keeps its shape, its entities
 * and its ports, not its pipes and T-pieces (they join items and walls that were not copied).
 */
export function pasteClip(clip: ItemClip, floorId: string, newId: (prefix: string) => string, at: Vec2 | null = null, grid = 0): Pasted {
  const done = clip.pastes[floorId] ?? 0;
  clip.pastes[floorId] = done + 1;
  let dx = (done + (floorId === clip.floor ? 1 : 0)) * PASTE_STEP;
  let dz = dx;
  if (at) {
    const [cx, cz] = clipCentre(clip);
    const step = (v: number) => (grid > 0 ? Math.round(v / grid) * grid : v);
    dx = step(at[0] - cx);
    dz = step(at[1] - cz);
  }
  const blocks = new Map<string, string>();
  const block = (g: string) => blocks.get(g) ?? blocks.set(g, newId("block")).get(g)!;
  const items = clip.items.map((m) => ({
    ...structuredClone(m),
    id: newId("furniture"),
    x: round(m.x + dx),
    z: round(m.z + dz),
    group: m.group ? block(m.group) : null,
    locked: null,
  }));
  const areas = (clip.areas ?? []).map((a) => {
    const copy: OutdoorArea = { ...structuredClone(a), id: newId("outdoor"), area_id: null, points: a.points.map(([x, z]) => [round(x + dx), round(z + dz)] as Vec2) };
    if (copy.pool) {
      const { pipes: _pipes, joints: _joints, ...links } = copy.pool;
      copy.pool = links;
      if (links.ports) links.ports = links.ports.map((q) => ({ ...q, id: newId("port"), x: round(q.x + dx), z: round(q.z + dz) }));
    }
    return copy;
  });
  return { items, areas };
}

/**
 * Copies of the clipboard's items for floor `floorId`, with new ids (`newId("furniture")`, blocks `newId("block")`):
 * on another floor they first land right above or below the originals, on the same floor a step off, and every
 * further paste a step more. A copied block is a block of its own; copies are never fixed. Links stay, as for Ctrl+D.
 */
export function pasteItems(clip: ItemClip, floorId: string, newId: (prefix: string) => string): Furniture[] {
  return pasteClip(clip, floorId, newId).items;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export interface ClipboardShortcut {
  keys: string[];
  text: I18nKey;
}

/** Rows for the '?' help overlay's shortcut table (help.ts SHORTCUTS, #95): same shape, add them as they are. */
export const CLIPBOARD_SHORTCUTS: ClipboardShortcut[] = [
  { keys: ["Ctrl+C"], text: "help_key_copy" },
  { keys: ["Ctrl+V"], text: "help_key_paste" },
  { keys: ["Ctrl+A"], text: "help_key_select_all" },
];

/** A button's tooltip with its shortcut: "Copy (Ctrl+C)". */
export function withKeys(text: string, keys: readonly string[]): string {
  return `${text} (${keys.join(", ")})`;
}

export type ClipboardAction = "copy" | "paste" | "select_all";

/** Ctrl (Cmd on a Mac) with C, V or A, without Shift or Alt; anything else is not a clipboard key. */
export function clipboardKey(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">): ClipboardAction | null {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return null;
  const k = e.key.toLowerCase();
  return k === "c" ? "copy" : k === "v" ? "paste" : k === "a" ? "select_all" : null;
}
