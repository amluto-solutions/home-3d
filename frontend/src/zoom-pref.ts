// The zoom style's settings (#456): how late it sets in and where, as a card or this device keeps them. Plain values,
// no three.js, no Lit: the card, the card dialog, the settings and the 3D viewer read them alike.

import { isOwnStyleId, styleById, styleChoices } from "./looks.ts";

/** The default for how late the zoom style sets in (0 early … 100 late): late. */
export const ZOOM_LATE_DEFAULT = 70;

/** A stored or configured "how late" (0–100, a number or its text) as 0–1; anything else the default. */
export function zoomLateOf(v: unknown): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : typeof v === "number" ? v : NaN;
  return (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : ZOOM_LATE_DEFAULT) / 100;
}

/** Where the zoom style applies: every room at once, or only the room zoomed into. */
export type ZoomScope = "all" | "room";

/**
 * The zoom style's choices, grouped like the style menus (#439): none, the house's plan, then every style but
 * Realistic (its lit look is no colour mapping), the plan's own ones too.
 */
export function zoomChoices(): ReturnType<typeof styleChoices> {
  return styleChoices({ none: true, house: true })
    .map((g) => ({ ...g, values: g.values.filter((v) => v !== "realistic") }))
    .filter((g) => g.values.length);
}

/** Whether a stored zoom style can be one: the house's plan, a style other than Realistic, or an own style's id. */
export function zoomStyleOk(v: string | null | undefined): v is string {
  return !!v && v !== "realistic" && (v === "house" || !!styleById(v) || isOwnStyleId(v));
}
