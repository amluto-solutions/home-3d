// What decides whether the floor pictures are drawn again (#453): the lamps' glow and the openings' state. A cover's
// slat tilt counts too, so a tilt-only change of a blind refreshes them.

interface Glowing {
  id: string;
  glow: { level: number; color: readonly number[] } | null;
}

interface OpeningLike {
  open: number;
  cover: number | null;
  slats?: number | null;
}

export function floorPictureKey(markers: readonly Glowing[], openings: Iterable<readonly [string, OpeningLike]>): string {
  const lamps = markers.map((m) => `${m.id}:${m.glow ? `${m.glow.level.toFixed(1)}/${m.glow.color.map((c) => c.toFixed(1)).join("/")}` : 0}`).join(";");
  const shut = [...openings].map(([id, o]) => `${id}:${o.open}:${o.cover === null ? "-" : o.cover.toFixed(1)}:${o.slats == null ? "-" : o.slats.toFixed(1)}`).join(";");
  return `${lamps}|${shut}`;
}
