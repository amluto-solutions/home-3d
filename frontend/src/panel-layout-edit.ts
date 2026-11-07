// Editing a room panel's list (#229): the steps the "Edit list" mode makes, as plain functions on the stored choice
// (Room.hidden and Room.panel_layout). Only the lazy edit mode (components/listedit.ts) loads this.

import type { Building, PanelLayout } from "./model.ts";
import type { ArrangedPanel, PanelGroup } from "./panel-layout.ts";

// as the schema allows (schema.py _PANEL_LAYOUT; hidden: MAX_HIDDEN)
const MAX_ORDER = 2000;
const MAX_PINNED = 100;

/** `list` with the entry at `from` moved to `to`. */
export function moveIn<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, item);
  return out;
}

/** The layout with empty lists left out; null when nothing is chosen. */
export function tidyLayout(layout: PanelLayout): PanelLayout | null {
  const out: PanelLayout = {};
  if (layout.pinned?.length) out.pinned = layout.pinned.slice(0, MAX_PINNED);
  if (layout.order?.length) out.order = layout.order.slice(0, MAX_ORDER);
  if (layout.groups?.length) out.groups = layout.groups;
  return Object.keys(out).length ? out : null;
}

/**
 * The row order after a move in `group`: every group's rows as listed now (that group's as `ids`), then the ids of
 * the old order that are not listed now (an entity that is away for a while keeps its place when it is back).
 */
export function withRowOrder(layout: PanelLayout | null | undefined, arranged: ArrangedPanel, group: PanelGroup, ids: readonly string[]): PanelLayout | null {
  const listed = arranged.groups.flatMap((g) => (g.group === group ? ids : g.ids));
  const seen = new Set(listed);
  const order = [...listed, ...(layout?.order ?? []).filter((id) => !seen.has(id) && !arranged.pinned.includes(id))];
  return tidyLayout({ ...layout, order });
}

/** The group order with the groups listed now in `shown` order, the others after them as before (`all`: every group in
 * the current order, panel-layout.ts groupOrder; given in, so the edit chunk shares no code with the main bundle). */
export function withGroupOrder(layout: PanelLayout | null | undefined, shown: readonly PanelGroup[], all: readonly PanelGroup[]): PanelLayout | null {
  const rest = all.filter((g) => !shown.includes(g));
  return tidyLayout({ ...layout, groups: [...shown, ...rest] });
}

/** The pinned entities in a new order (pinned ones not listed now stay, after them). */
export function withPinnedOrder(layout: PanelLayout | null | undefined, pinned: readonly string[]): PanelLayout | null {
  const rest = (layout?.pinned ?? []).filter((id) => !pinned.includes(id));
  return tidyLayout({ ...layout, pinned: [...pinned, ...rest] });
}

/** Pins `id` to the end of the pinned section, or unpins it. */
export function togglePinned(layout: PanelLayout | null | undefined, id: string): PanelLayout | null {
  const pinned = layout?.pinned ?? [];
  return tidyLayout({ ...layout, pinned: pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id] });
}

/** The room's hidden list with `id` hidden or shown again. */
export function toggleHidden(hidden: readonly string[] | undefined, id: string): string[] {
  const list = hidden ?? [];
  return list.includes(id) ? list.filter((h) => h !== id) : [...list, id];
}

/** A plan change that stores the choice on the room, or on the outdoor area acting as one. */
export function storePanelChoice(roomId: string, choice: { hidden?: string[]; layout?: PanelLayout | null }): (b: Building) => void {
  return (b) => {
    for (const floor of b.floors) {
      const target = floor.rooms.find((r) => r.id === roomId) ?? floor.outdoor?.find((a) => a.id === roomId);
      if (!target) continue;
      if (choice.hidden) target.hidden = choice.hidden;
      if (choice.layout !== undefined) {
        if (choice.layout) target.panel_layout = choice.layout;
        else delete target.panel_layout;
      }
      return;
    }
  };
}
