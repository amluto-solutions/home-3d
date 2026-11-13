// Following Home Assistant's theme (#38): each device shows the dark look under a dark HA theme and the light one under
// a light theme, unless the card or the panel sets a look itself. Pure helpers, no three.js and no Lit, so the main
// bundle, the 3D view and the 2D view can all use them.

import { baseOf, resolveStyle, type StylePlan } from "./looks.ts";
import type { Look, Theme } from "./themes.ts";
import type { HomeAssistant } from "./types.ts";

export type { Look } from "./themes.ts";

/** A card's own style settings beside its `theme` (#439): evening and night styles, a helper entity, localised names. */
export interface CardStyle {
  evening?: string | null;
  night?: string | null;
  entity?: string | null;
  names?: Record<string, string[]>;
  /** A style set from outside for this screen (an action, a voice command, #442): it wins over everything else. */
  override?: string | null;
}

/**
 * The style a device shows for a chosen look (#435): "theme" by HA's theme (Day under a light one, else Neon), "auto" by
 * the sun (Day while it is up, else Neon), a style as it is, "house" by the house's style plan (the sun, the clock or its helper entity). An own style the plan no longer has follows HA's theme.
 */
export function shownStyle(look: Look, hass: HomeAssistant | null | undefined, plan?: StylePlan | null, now: Date = new Date(), card?: CardStyle | null): string {
  const sun = hass?.states["sun.sun"]?.state;
  // a helper entity of the card's own names the style; the plan's one only for the screens that follow the plan
  const entity = card?.entity || (look === "house" ? plan?.style_entity : null);
  return resolveStyle({
    choice: look,
    evening: card?.evening,
    night: card?.night,
    plan,
    entityState: entity ? (hass?.states[entity]?.state ?? null) : null,
    names: card?.names,
    override: card?.override,
    now,
    sunUp: sun === "above_horizon" ? true : sun === "below_horizon" ? false : null,
    darkMode: hass?.themes?.darkMode ?? null,
  });
}

/** The classic look a device shows for a chosen look: the base under its style (a palette or homely style's chrome). */
export function shownLook(look: Look, hass: HomeAssistant | null | undefined, plan?: StylePlan | null, card?: CardStyle | null): Theme {
  return baseOf(shownStyle(look, hass, plan, new Date(), card));
}

/**
 * The look after switching a follow ("theme": Home Assistant's theme, "auto": the sun) on or off (#87). Off keeps the
 * look the device showed, so nothing jumps; switching off a follow that isn't the current one changes nothing.
 */
export function followLook(current: Look, follow: "theme" | "auto", on: boolean, hass: HomeAssistant | null | undefined): Look {
  if (on) return follow;
  return current === follow ? (shownStyle(current, hass) as Look) : current;
}

/** A CSS colour as "#rrggbb" (lower case): "#rgb", "#rrggbb" or "rgb(r, g, b)"; null for anything else. */
function hexOf(css: string): string | null {
  const v = css.trim().toLowerCase();
  let m = /^#([0-9a-f]{6})$/.exec(v);
  if (m) return `#${m[1]}`;
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.exec(v);
  if (!rgb) return null;
  const parts = rgb.slice(1, 4).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The accent a device's HA theme gives (#38): its primary colour, read from HA's CSS variables by `readVar` (for
 * example `getComputedStyle(el).getPropertyValue`). Null under HA's stock theme, so Home 3D keeps its own cyan there,
 * and null when the colour can't be read.
 */
export function themeAccent(hass: HomeAssistant | null | undefined, readVar: (name: string) => string): string | null {
  const name = hass?.themes?.theme;
  if (!name || name === "default") return null;
  return hexOf(readVar("--primary-color") ?? "");
}

/** Text drawn on an accent ("#rrggbb"): Home 3D's dark ink on a light accent, white on a dark one. */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // the brighter of the two contrasts wins
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? "#041018" : "#ffffff";
}

/** The accent shown: the card's or panel's own ("#rrggbb") wins; else the theme's while the look follows the theme. */
export function shownAccent(look: Look, own: string | null | undefined, hass: HomeAssistant | null | undefined, readVar: (name: string) => string): string | null {
  if (own && /^#[0-9a-f]{6}$/i.test(own)) return own;
  return look === "theme" ? themeAccent(hass, readVar) : null;
}

/**
 * The inline variables for an accent of the device's own or its HA theme's (#246): it takes the accent (text, icons,
 * outlines) and the primary fill, each with its readable text, so chosen controls follow the chosen colour.
 */
export function accentVars(accent: string | null | undefined): string {
  if (!accent) return "";
  const on = textOn(accent);
  return `--fp3d-accent:${accent};--fp3d-accent-text:${on};--fp3d-primary:${accent};--fp3d-primary-text:${on}`;
}
