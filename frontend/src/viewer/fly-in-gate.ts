// Whether "Fly in from space" (#477) may play (a file of its own: the view component asks it without loading the 3D chunk).

/** Whether the fly-in may play here: a valid place, no reduced motion, not the tablet level, not time travel or the editor. */
export function flyInAllowed(o: { lat: unknown; lon: unknown; low: boolean; readOnly: boolean; walkable: boolean; plain: boolean; paced: boolean; reducedMotion: boolean }): boolean {
  if (typeof o.lat !== "number" || typeof o.lon !== "number" || !isFinite(o.lat) || !isFinite(o.lon)) return false;
  if (Math.abs(o.lat) > 90 || Math.abs(o.lon) > 180) return false;
  return !o.low && !o.readOnly && o.walkable && !o.plain && !o.paced && !o.reducedMotion;
}
