// The colour schemes of the viewer's chrome (header, view settings, buttons, sheets): dark everywhere, light while the
// 3D view shows the Day look (#85). Plain data and a WCAG contrast helper, so tests can hold every pair to AA.
//
// Brand colours under Home 3D's own token names (#246, #219): `accent` (cyan on dark) carries text, icons, focus and
// selection outlines; `primary` (blue) is a fill only: main buttons, switches turned on, ticked boxes, the chosen
// segment, always with `primaryText` on it. Blue fails as text on the dark scene, so it never colours text. Neither
// colours alerts, heat maps, device states or colours users pick: those keep warm, danger, warning and success.

import type { Theme } from "./themes.ts";

export interface Scheme {
  bg: string;
  bg2: string;
  chrome: string;
  chromeSolid: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  /** Raised surface inside a menu or card: hover, the track of a segmented control. */
  panel: string;
  /** Fill of main buttons and chosen controls; `primaryText` on it. */
  primary: string;
  primaryText: string;
  link: string;
  soft: string;
  warm: string;
  danger: string;
  warning: string;
  success: string;
  shadow: string;
  colorScheme: "dark" | "light";
}

export const DARK: Scheme = {
  bg: "#070b14",
  bg2: "#0d1424",
  chrome: "rgba(15, 23, 42, 0.88)",
  chromeSolid: "#0f172a",
  line: "rgba(148, 163, 184, 0.2)",
  text: "#e2e8f0",
  muted: "#94a3b8",
  accent: "#48cdeb",
  accentText: "#041018",
  panel: "#1e293b",
  primary: "#1e6ebc",
  primaryText: "#ffffff",
  link: "#5d97cf",
  soft: "#5b7cff",
  warm: "#ffb547",
  danger: "#ff6b8b",
  warning: "#fbbf24",
  success: "#4ade80",
  shadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
  colorScheme: "dark",
};

/** Day: white glass on the pale sky, near-black text, a deep blue accent (cyan on white is decoration only, 1.9:1). */
export const LIGHT: Scheme = {
  bg: "#eef2f8",
  bg2: "#e3e9f2",
  chrome: "rgba(255, 255, 255, 0.9)",
  chromeSolid: "#ffffff",
  line: "rgba(15, 23, 42, 0.16)",
  text: "#1a1a1a",
  muted: "#58667a",
  accent: "#1c67b1",
  accentText: "#ffffff",
  panel: "#e2e8f0",
  primary: "#1e6ebc",
  primaryText: "#ffffff",
  link: "#1c67b1",
  soft: "#3d5bd9",
  warm: "#a35f00",
  danger: "#c4224a",
  warning: "#92400e",
  success: "#166534",
  shadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 28px -10px rgba(14, 37, 66, 0.14)",
  colorScheme: "light",
};

/**
 * High contrast (#216): pure white text on near-black glass, a yellow accent, strong outlines. Every text colour is 7:1
 * (WCAG AAA) on every background, translucent glass included.
 */
export const HIGH: Scheme = {
  bg: "#000000",
  bg2: "#050a14",
  chrome: "rgba(0, 0, 0, 0.94)",
  chromeSolid: "#000000",
  line: "rgba(255, 255, 255, 0.7)",
  text: "#ffffff",
  muted: "#dbe4f5",
  accent: "#ffe14d",
  accentText: "#000000",
  panel: "#111111",
  primary: "#ffe14d",
  primaryText: "#000000",
  link: "#9db4ff",
  soft: "#9db4ff",
  warm: "#ffc247",
  danger: "#ff8fa8",
  warning: "#ffc247",
  success: "#7ee8a6",
  shadow: "0 0 0 1px rgba(255, 255, 255, 0.5)",
  colorScheme: "dark",
};

/** The viewer's chrome turns light with the Day look only; the other looks sit on dark skies. */
export function lightChrome(theme: Theme): boolean {
  return theme === "day";
}

/** The viewer's chrome turns high contrast with the High contrast look (stored as "blueprint"). */
export function contrastChrome(theme: Theme): boolean {
  return theme === "blueprint";
}

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * linear((n >> 16) & 255) + 0.7152 * linear((n >> 8) & 255) + 0.0722 * linear(n & 255);
}

/** WCAG contrast ratio of two "#rrggbb" colours (1 to 21; AA body text needs 4.5). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The scheme as the inherited variables the shared tokens (styles.ts) read; `--fp3d-s-*`. */
export function schemeVars(s: Scheme): string {
  const name = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return Object.entries(s)
    .map(([k, v]) => `--fp3d-s-${name(k)}: ${v};`)
    .join("\n");
}
