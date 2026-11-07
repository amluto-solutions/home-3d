/**
 * The phone layout rule (#93): one width below which the viewer folds its settings, slims its bars and
 * keeps touch targets at 44 px. Components reuse PHONE_MEDIA in their CSS (via unsafeCSS) and
 * isPhoneWidth in code, so the breakpoint lives in one place.
 */

/** Widest screen (CSS px) treated as a phone. */
export const PHONE_MAX_PX = 600;

/** The same rule as a media query, for `@media ${unsafeCSS(PHONE_MEDIA)}`. */
export const PHONE_MEDIA = `(max-width: ${PHONE_MAX_PX}px)`;

export function isPhoneWidth(width: number): boolean {
  return width <= PHONE_MAX_PX;
}

/** Whether the floor pictures at the side show as plain buttons: the stored choice ("1"/"0"), else folded on phones. */
export function thumbsCompact(saved: string | null, phone: boolean): boolean {
  return saved === "1" || saved === "0" ? saved === "1" : phone;
}

/** Share of a phone's view kept clear at the top (Walk) and the bottom (the bar) when the house is fitted. */
export const PHONE_FIT_MARGIN = { x: 0, y: 0.1 } as const;
export const NO_FIT_MARGIN = { x: 0, y: 0 } as const;

/** Widest screen (CSS px) that gets the slim header (#216): title, version and the Extensions word are dropped. */
export const PHONE_NARROW_MAX_PX = 480;
export const PHONE_NARROW_MEDIA = `(max-width: ${PHONE_NARROW_MAX_PX}px)`;

/**
 * Size classes (#246, the menus redesign #219): every layout rule picks one of these instead of its own width.
 * phone up to 600 px, compact 601 to 1024 px (a tablet in landscape, a small laptop), wide above that; short is any
 * screen up to 500 px high (a phone held sideways) and goes with any of the three. A wall tablet in kiosk mode is a
 * mode (kiosk.ts), not a size.
 */
export type SizeClass = "phone" | "compact" | "wide";

/** Widest screen (CSS px) in the compact class. */
export const COMPACT_MAX_PX = 1024;
/** Highest screen (CSS px) that counts as short. */
export const SHORT_MAX_PX = 500;

export const COMPACT_MEDIA = `(min-width: ${PHONE_MAX_PX + 1}px) and (max-width: ${COMPACT_MAX_PX}px)`;
export const WIDE_MEDIA = `(min-width: ${COMPACT_MAX_PX + 1}px)`;
export const SHORT_MEDIA = `(max-height: ${SHORT_MAX_PX}px)`;

export function sizeClass(width: number): SizeClass {
  return isPhoneWidth(width) ? "phone" : width <= COMPACT_MAX_PX ? "compact" : "wide";
}

export function isShortHeight(height: number): boolean {
  return height <= SHORT_MAX_PX;
}
