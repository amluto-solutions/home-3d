// The checklist an empty home shows in the editor (#193): the three steps to a first room and the two shortcuts
// (rooms from Home Assistant areas, the sample home). Pure logic, no DOM.

import type { Building } from "./model.ts";

export type StartStep = "floor" | "room" | "furniture";

export interface StartChecklist {
  /** Show the checklist: the home has no room on any floor yet. */
  show: boolean;
  steps: { step: StartStep; done: boolean }[];
}

/** The steps of a home and which are done; shown only while no floor has a room. */
export function startChecklist(doc: Pick<Building, "floors">): StartChecklist {
  const rooms = doc.floors.some((f) => f.rooms.length > 0);
  return {
    show: !rooms,
    steps: [
      { step: "floor", done: doc.floors.length > 0 },
      { step: "room", done: rooms },
      { step: "furniture", done: doc.floors.some((f) => f.furniture.length > 0) },
    ],
  };
}

/**
 * Should the 3D half stay shut while the editor opens (#193)? A home without rooms has nothing to show there: the
 * plan gets the full width. A stored choice for 3D beside is kept, and applies once the home has rooms.
 */
export function startsFullWidth(doc: Pick<Building, "floors">, split: boolean): boolean {
  return split && startChecklist(doc).show;
}
