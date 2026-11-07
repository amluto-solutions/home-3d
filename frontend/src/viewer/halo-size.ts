// The glow points around lit lamps are sized in metres (three.js size attenuation), so a small garden or wall
// light's glow shrank to a few pixels in the default whole-house view (#89). Zoomed out, the glow grows to keep a
// minimum size on screen; close up it keeps its own size.

/** A lamp's glow in metres, close up. */
export const HALO_SIZE = 0.9;
/** The least a glow shows on screen (CSS pixels across). */
const MIN_PX = 20;
/** Never more than this (metres): far away a glow should not become a disc over the house. */
const MAX_SIZE = 3;

/**
 * The points material's size for a camera `distance` metres from what it looks at, in a view `height` CSS pixels
 * tall. three.js draws a size-attenuated point `size * (height / 2) / depth` pixels across.
 */
export function haloSize(distance: number, height: number): number {
  if (!(height > 0) || !(distance > 0)) return HALO_SIZE;
  return Math.min(MAX_SIZE, Math.max(HALO_SIZE, (MIN_PX * 2 * distance) / height));
}
