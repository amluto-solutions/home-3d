// How a room's panel lists its entities (#229): an editor pins some to the top, orders the rows within their group and
// the groups themselves; everyone sees the same list. The choice is stored with the room (Room.panel_layout); ids of
// entities no longer in the room are ignored here, so a renamed or removed entity costs nothing.

import type { DeviceKind } from "./devices.ts";
import type { PanelLayout } from "./model.ts";

/** The panel's groups in their usual order. */
export const PANEL_GROUPS = ["lights", "covers", "climate", "media", "switches", "cameras", "sensors", "scenes"] as const;
export type PanelGroup = (typeof PANEL_GROUPS)[number];

const GROUP_OF: Record<DeviceKind, PanelGroup> = {
  light: "lights",
  cover: "covers",
  climate: "climate",
  media: "media",
  switch: "switches",
  fan: "switches",
  lock: "switches",
  camera: "cameras",
  sensor: "sensors",
  binary: "sensors",
  scene: "scenes",
  script: "scenes",
};

/** The group an entity of this kind is listed in (null: the panel does not list it). */
export function panelGroup(kind: DeviceKind | null): PanelGroup | null {
  return kind ? GROUP_OF[kind] : null;
}

/** The groups in the chosen order: the named ones first (unknown names and repeats ignored), the rest as usual. */
export function groupOrder(layout: PanelLayout | null | undefined): PanelGroup[] {
  const named = (layout?.groups ?? []).filter((g): g is PanelGroup => (PANEL_GROUPS as readonly string[]).includes(g));
  return [...new Set([...named, ...PANEL_GROUPS])];
}

/** `ids` sorted by their place in `order`; ids it does not name follow in their own order. */
export function sortByOrder(ids: readonly string[], order: readonly string[] | undefined): string[] {
  if (!order?.length) return [...ids];
  const at = new Map<string, number>();
  order.forEach((id, i) => !at.has(id) && at.set(id, i));
  const known = ids.filter((id) => at.has(id)).sort((a, b) => at.get(a)! - at.get(b)!);
  return [...known, ...ids.filter((id) => !at.has(id))];
}

export interface ArrangedPanel {
  /** The pinned entities, in the pinned order. */
  pinned: string[];
  /** Each group that has entities, in the chosen group order, its rows in the chosen order (pinned ones left out). */
  groups: { group: PanelGroup; ids: string[] }[];
}

/** The panel's list: `ids` (what the room shows) arranged by the layout. */
export function arrangePanel(ids: readonly string[], kindOf: (id: string) => DeviceKind | null, layout: PanelLayout | null | undefined): ArrangedPanel {
  const present = new Set(ids.filter((id) => panelGroup(kindOf(id))));
  const pinned = [...new Set(layout?.pinned ?? [])].filter((id) => present.has(id));
  const top = new Set(pinned);
  const rest = sortByOrder(
    [...present].filter((id) => !top.has(id)),
    layout?.order,
  );
  const groups = groupOrder(layout)
    .map((group) => ({ group, ids: rest.filter((id) => panelGroup(kindOf(id)) === group) }))
    .filter((g) => g.ids.length);
  return { pinned, groups };
}
