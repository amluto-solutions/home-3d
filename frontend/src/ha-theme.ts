// Following Home Assistant's theme (#38): each device shows the dark look under a dark HA theme and the light one under
// a light theme, unless the card or the panel sets a look itself. Pure helpers, no three.js and no Lit, so the main
// bundle, the 3D view and the 2D view can all use them.

import type { Look, Theme } from "./themes.ts";
import type { HomeAssistant } from "./types.ts";

export type { Look } from "./themes.ts";

/** The look a device shows for a chosen look. */
export function shownLook(look: Look, hass: HomeAssistant | null | undefined): Theme {
  if (look === "theme") return hass?.themes?.darkMode === false ? "day" : "neon";
  if (look === "auto") return hass?.states["sun.sun"]?.state === "above_horizon" ? "day" : "neon";
  return look;
}

/**
 * The look after switching a follow ("theme": Home Assistant's theme, "auto": the sun) on or off (#87). Off keeps the
 * look the device showed, so nothing jumps; switching off a follow that isn't the current one changes nothing.
 */
export function followLook(current: Look, follow: "theme" | "auto", on: boolean, hass: HomeAssistant | null | undefined): Look {
  if (on) return follow;
  return current === follow ? shownLook(current, hass) : current;
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
