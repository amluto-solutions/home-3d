/** A swipe on a lamp or blind moves nothing within these pixels of where it began; let go there, it is a tap (#1208). */
export const SWIPE_SLACK = 18;

/** The finger's vertical travel with the slack taken off: 0 inside the slack, then growing from its edge. */
export function swipePast(dy: number): number {
  return Math.abs(dy) <= SWIPE_SLACK ? 0 : dy - Math.sign(dy) * SWIPE_SLACK;
}

/** The value (0..100) a swipe of `dy` pixels gives from `start`: the whole range over about 220 pixels, up = more. */
export function swipeValue(start: number, dy: number): number {
  return Math.round(Math.min(100, Math.max(0, start - (swipePast(dy) / 220) * 100)));
}

/** A swipe whose finger never went farther than the slack was a tap. */
export function swipeWasTap(far: number): boolean {
  return far <= SWIPE_SLACK;
}
