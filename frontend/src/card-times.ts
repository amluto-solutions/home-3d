// This device's card times, kept as "home3d.<key>" in seconds and read each time they are used (a changed setting
// counts at once). No Lit and no texts, so the 3D view, the zoom view and the Settings rows share them.
//
// - The hold (#543): a glass card the viewer touched stays while its card rule would hide it; after this time without
//   a touch on it, it obeys its rule again. A card open in the zoom view is never taken by its rule; its time starts
//   again when the zoom view closes. Default 30 s; 0: the card follows its rule as soon as the touch is over.
// - The zoom view's auto close (#541): a card opened near full screen closes by itself after this time without a
//   touch. Default off.

/** The hold after a touch on a card (#543), in seconds. */
export const CARD_HOLD_KEY = "card_hold";
export const CARD_HOLD_DEFAULT = 30;
/** The zoom view's auto close (#541), in seconds; none or 0: it stays open. */
export const ZOOM_CLOSE_KEY = "card_zoom_close";
/** The largest time a card time takes (one hour). */
export const CARD_TIME_MAX = 3600;

/** A stored preference of this device, or null (none stored, or storage blocked). */
export function devicePref(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(`home3d.${key}`) ?? null;
  } catch {
    return null;
  }
}

/** Seconds from a stored text (a number from 0 to CARD_TIME_MAX), else null. */
function seconds(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const s = Number(raw);
  return Number.isFinite(s) && s >= 0 ? Math.min(s, CARD_TIME_MAX) : null;
}

/** The zoom view's auto close in milliseconds (0: never). */
export function zoomCloseMs(raw: string | null): number {
  return (seconds(raw) ?? 0) * 1000;
}

/** How long a touched card is held against its rule (#543), in milliseconds (none stored: the default). */
export function cardHoldMs(raw: string | null): number {
  return (seconds(raw) ?? CARD_HOLD_DEFAULT) * 1000;
}
