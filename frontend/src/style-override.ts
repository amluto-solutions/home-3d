// A style set from outside for one screen (#442): the action `home_3d.set_style` or a spoken "style cozy". It is kept
// on the device (a reload keeps it) until its time is up, until it is reset, or until a style is chosen anew for the
// screen (the newest setting wins). Pure helpers, no Lit and no three.js.

import { styleById, styleFromText } from "./looks.ts";

/** Where a style set from outside is kept on this device. */
export const STYLE_OVERRIDE_KEY = "home3d.style_override";

export interface StyleOverride {
  style: string;
  /** Epoch milliseconds when it ends; null: until changed. */
  until: number | null;
}

/** A style for the open screens (the action `home_3d.set_style`). */
export interface ScreenStyle {
  id: string;
  /** A style id or name; "" or "reset": back to the screen's own setting. */
  style: string;
  /** Only the views with these screen names (empty: every open view). */
  screens: string[];
  /** For this many minutes, then back (null: until changed). */
  minutes?: number | null;
}

const RESET = new Set(["", "reset", "auto_reset"]);

/** Whether a word asks to go back to the screen's own style. */
export function isReset(style: string): boolean {
  return RESET.has(style.trim().toLowerCase());
}

/** Whether a style for the screens named is for the screen with this name (none named: every screen). */
export function styleIsForScreen(screens: readonly string[] | null | undefined, screen: string | null | undefined): boolean {
  const named = (screens ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !named.length || named.includes((screen ?? "").trim().toLowerCase());
}

/**
 * The override a style word makes: an override, null to end the one set, undefined when the word names no style (the
 * override stays as it is). A style of the plan's own (`my_…`) counts once the plan is loaded.
 */
export function overrideFor(style: string, minutes: number | null | undefined, now: number, names: Record<string, string[]> = {}): StyleOverride | null | undefined {
  if (isReset(style)) return null;
  const id = styleById(style) ? style : styleFromText(style, names);
  return id ? { style: id, until: minutes && minutes > 0 ? now + minutes * 60000 : null } : undefined;
}

/** The style an override shows now (null: none set, or its time is up). */
export function liveOverride(o: StyleOverride | null | undefined, now: number): string | null {
  return o && (o.until === null || o.until > now) ? o.style : null;
}

/** The override kept on this device (unreadable, malformed or ended: none). */
export function readOverride(now: number, storage?: Pick<Storage, "getItem">): StyleOverride | null {
  try {
    const kept = JSON.parse((storage ?? localStorage).getItem(STYLE_OVERRIDE_KEY) ?? "null") as Partial<StyleOverride> | null;
    if (!kept || typeof kept.style !== "string" || !(kept.until === null || typeof kept.until === "number")) return null;
    return liveOverride(kept as StyleOverride, now) ? { style: kept.style, until: kept.until } : null;
  } catch {
    return null;
  }
}

/** Keeps the override on this device (none: forgets it). */
export function keepOverride(o: StyleOverride | null, storage?: Pick<Storage, "setItem" | "removeItem">): void {
  try {
    const s = storage ?? localStorage;
    if (o) s.setItem(STYLE_OVERRIDE_KEY, JSON.stringify(o));
    else s.removeItem(STYLE_OVERRIDE_KEY);
  } catch {
    // a private window or blocked storage: the style holds until the page closes
  }
}
