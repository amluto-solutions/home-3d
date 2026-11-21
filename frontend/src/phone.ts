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

/** Whether this device looks like a phone (#493): a touch screen whose short side is a phone's (`maxShort` CSS px). */
export function looksLikePhone(screenW: number, screenH: number, touchPoints: number, maxShort = PHONE_MAX_PX): boolean {
  return touchPoints > 0 && Math.min(screenW, screenH) > 0 && Math.min(screenW, screenH) <= maxShort;
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

/**
 * A notification's link into the panel (#494, ported from NeonPlan 3D 4.0.0, MIT, Mastershort):
 * `/home_3d?view=now` opens the list "What's going on?", `?room=<name or id>` a room, `?show=<entity>` flies to a
 * device. Null when the address asks for none of them. An entity id that is not one is dropped.
 */
export interface PhoneLink {
  now: boolean;
  room: string | null;
  show: string | null;
}

export function phoneLink(search: string): PhoneLink | null {
  const q = new URLSearchParams(search);
  const now = q.get("view") === "now";
  const room = q.get("room")?.trim() || null;
  const show = q.get("show")?.trim() || null;
  const entity = show && /^[a-z_]+\.[a-z0-9_]+$/.test(show) ? show : null;
  return now || room || entity ? { now, room, show: entity } : null;
}

/** The room a link names: by id first, else by its name (any case); null when the plan has none such. */
export function linkedRoom(floors: readonly { id: string; rooms: readonly { id: string; name?: string }[] }[], want: string): { floorId: string; roomId: string } | null {
  for (const f of floors) for (const r of f.rooms) if (r.id === want) return { floorId: f.id, roomId: r.id };
  const name = want.trim().toLowerCase();
  for (const f of floors) for (const r of f.rooms) if (r.name?.trim().toLowerCase() === name) return { floorId: f.id, roomId: r.id };
  return null;
}
