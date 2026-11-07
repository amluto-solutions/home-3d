// Entity ids picked out of all states once (#393): a large home has thousands of states, and a 3D sync asked for the
// weather entity and the located persons' sensors by going through all of them every time. The ids are found again
// when an entity came or went (the count of states) or the entity registry changed, as the editor's entity lists are.

import { stateCount } from "./hass-watch.ts";
import type { HomeAssistant } from "./types.ts";

type States = HomeAssistant["states"];
type State = States[string];

const NO_REGISTRY = {};
const kept = new WeakMap<object, Map<string, { count: number; ids: string[] }>>();

/**
 * The ids whose state passes `test`, found in one pass and kept under `key` while the set of entities stays (`test`
 * must look at what does not change between state updates: the id, an attribute the entity always carries). Callers
 * still read the states of now for anything that changes.
 */
export function idsWhere(hass: Pick<HomeAssistant, "states" | "entities">, key: string, test: (id: string, st: State) => boolean): string[] {
  const reg = (hass.entities as object | undefined) ?? NO_REGISTRY;
  let byKey = kept.get(reg);
  if (!byKey) kept.set(reg, (byKey = new Map()));
  const count = stateCount(hass.states);
  const had = byKey.get(key);
  if (had && had.count === count) return had.ids;
  const ids: string[] = [];
  for (const id in hass.states) if (test(id, hass.states[id])) ids.push(id);
  byKey.set(key, { count, ids });
  return ids;
}
