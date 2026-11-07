// When the flat plans (the editor's and the read-only 2D view) draw their device markers (#220). Zoomed out, the round
// markers of a whole floor sit on top of each other and hide the rooms; from a zoom on they sit apart.
// The cut-off is a device preference (a phone wants another one than a wall tablet): `home3d.planPinZoom`, in screen
// pixels per metre of plan. 0 = markers always. Pure and tiny: both plan bundles import it.

/** The zoom (pixels per metre) from which markers show, when the device has not set one. A whole floor of an ordinary house fits a phone at ~25 px/m, a wall tablet at 60+. */
export const PLAN_PIN_ZOOM_DEFAULT = 40;
export const PLAN_PIN_ZOOM_MAX = 400;
/** The device preference key (without the `home3d.` prefix the stores add). */
export const PLAN_PIN_ZOOM_KEY = "planPinZoom";

/** A stored preference as a cut-off: anything that is not a number from 0 up is the default. */
export function parsePinZoom(stored: string | null | undefined): number {
  if (stored === null || stored === undefined || stored.trim() === "") return PLAN_PIN_ZOOM_DEFAULT;
  const n = Number(stored);
  return Number.isFinite(n) && n >= 0 ? Math.min(PLAN_PIN_ZOOM_MAX, n) : PLAN_PIN_ZOOM_DEFAULT;
}

/** This device's cut-off, read from the browser's storage (unavailable storage: the default). */
export function readPinZoom(): number {
  try {
    return parsePinZoom(localStorage.getItem(`home3d.${PLAN_PIN_ZOOM_KEY}`));
  } catch {
    return PLAN_PIN_ZOOM_DEFAULT;
  }
}

/** Whether markers show at this zoom (pixels per metre). */
export function pinsShown(scale: number, cutoff: number): boolean {
  return cutoff <= 0 || scale >= cutoff;
}
