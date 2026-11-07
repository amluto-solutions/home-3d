// Big racks stay fast (#121): a rack's gear is drawn in full detail (every part of every piece) only near the camera;
// further away each piece is one plain box in its body colour ("slab"), with the status LEDs (#119) unchanged.
// Pure: the distances and the switch rule. The viewer (viewer3d.ts) keeps one detail and one slab mesh per rack.

/**
 * Within this distance (m, camera to the rack's centre) the gear is drawn in detail. At 6 m a 1U face is about 7 px
 * high on a 680 px tall view (38° field of view), its ports 2 to 3 px: below that the detail is no longer seen.
 */
export const RACK_DETAIL_NEAR = 6;
/** A detailed rack turns back into slabs only beyond this distance: a camera resting in between flips nothing. */
export const RACK_DETAIL_FAR = 7;
/** The tablet level (low quality) draws the detail only this much closer (its GPU and CPU are far weaker). */
export const RACK_DETAIL_LOW = 0.6;

/** Should a rack at `distance` (m) from the camera show its gear in detail? `detailed`: it does now. */
export function rackDetailWanted(distance: number, detailed: boolean, low: boolean): boolean {
  const k = low ? RACK_DETAIL_LOW : 1;
  return distance < (detailed ? RACK_DETAIL_FAR : RACK_DETAIL_NEAR) * k;
}
