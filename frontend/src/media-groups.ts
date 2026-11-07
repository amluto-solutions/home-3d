/**
 * One TV reached through several integrations (Android TV, Cast, the TV's own) is several media players placed on
 * it. They share one now-playing card (#356). Only players of one TV group (#362): those on (or linked to) the same
 * TV item, or within GROUP_RADIUS of each other when both are TV players (device_class tv) or share a friendly name.
 * A speaker or a PC on the TV bench or a desk keeps its own card.
 */
export const GROUP_RADIUS = 0.5;

export interface MediaCandidate {
  id: string;
  floorId: string;
  x: number;
  z: number;
  /** The furniture item it is linked to or placed on, when there is one. */
  hostId?: string;
  /** The host item is a TV / screen item (isTvItemType). */
  hostTv?: boolean;
  /** The player is a TV (device_class tv, or on a TV item). */
  tv?: boolean;
  /** Its friendly name: players sharing one are the same device reached through several integrations. */
  name?: string;
  /** How much it deserves the card: 5 playing, 4 showing paused/source, 2 held in grace, 1 an idle TV, 0 nothing. */
  rank: number;
}

/** The furniture item (of the given ones) whose footprint holds the point, turned by its rotation in degrees. */
export function hostAt(items: readonly { id: string; x: number; z: number; w: number; d: number; rotation?: number }[], x: number, z: number): string | undefined {
  for (const f of items) {
    const a = ((f.rotation ?? 0) * Math.PI) / 180;
    const dx = x - f.x;
    const dz = z - f.z;
    const lx = dx * Math.cos(a) + dz * Math.sin(a);
    const lz = -dx * Math.sin(a) + dz * Math.cos(a);
    if (Math.abs(lx) <= f.w / 2 && Math.abs(lz) <= f.d / 2) return f.id;
  }
  return undefined;
}

/**
 * The players that give way to another of their group: the best-ranked of a group keeps the card (the playing one,
 * else a paused one with a title, else the first). A group without anything to show gets its card from the first.
 */
export function losers(list: readonly MediaCandidate[]): Set<string> {
  const parent = list.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  list.forEach((a, i) => {
    for (let j = 0; j < i; j++) {
      const b = list[j];
      if (a.floorId !== b.floorId) continue;
      const sameTvItem = !!a.hostId && a.hostId === b.hostId && !!a.hostTv && !!b.hostTv;
      const sameKind = (!!a.tv && !!b.tv) || (!!a.name && a.name === b.name);
      if (sameTvItem || (sameKind && Math.hypot(a.x - b.x, a.z - b.z) <= GROUP_RADIUS)) parent[find(i)] = find(j);
    }
  });
  const best = new Map<number, number>();
  list.forEach((c, i) => {
    const r = find(i);
    const cur = best.get(r);
    if (cur === undefined || c.rank > list[cur].rank) best.set(r, i);
  });
  const out = new Set<string>();
  list.forEach((c, i) => {
    if (best.get(find(i)) !== i) out.add(c.id);
  });
  return out;
}
