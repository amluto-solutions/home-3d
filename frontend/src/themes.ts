// Looks of the 3D view, shared by the main bundle (settings, stage background) and the 3D bundle. A Theme is one of the
// classic looks the shader knows; the styles on top of them live in looks.ts.

import { isOwnStyleId, STYLE_IDS, type StyleId } from "./looks.ts";

export type Theme = "neon" | "blueprint" | "day" | "realistic";

export const THEMES: Theme[] = ["neon", "blueprint", "day", "realistic"];

/**
 * A look as a card or the panel stores it: a style (looks.ts, the classic looks among them), an own style (`my_*`),
 * "auto" (by the sun), "theme" (by the HA theme, #38) or "house" (the house's style plan, #435).
 */
export type Look = Theme | StyleId | "auto" | "theme" | "house" | `my_${string}`;

/**
 * A look as stored by a card or the panel: one this version knows; none (or an unknown one) follows the HA theme. An own
 * style's id is kept before the plan that holds it has loaded (it may be one); resolving it falls back if it isn't.
 */
export function lookOf(value: string | null | undefined): Look {
  return value === "auto" || value === "theme" || value === "house" || STYLE_IDS.includes(value as StyleId) || isOwnStyleId(value) ? (value as Look) : "theme";
}

/** Background of the 3D stage per look (sky in the middle, ground at the edges), night and day. */
export const STAGE: Record<Theme, { night: [number[], number[]]; day: [number[], number[]] }> = {
  neon: {
    night: [
      [11, 17, 32],
      [7, 11, 20],
    ],
    day: [
      [26, 44, 78],
      [12, 20, 36],
    ],
  },
  blueprint: {
    night: [
      [26, 70, 130],
      [10, 38, 78],
    ],
    day: [
      [34, 86, 150],
      [14, 48, 96],
    ],
  },
  day: {
    night: [
      [214, 224, 238],
      [176, 190, 210],
    ],
    day: [
      [242, 246, 251],
      [205, 216, 230],
    ],
  },
  // the realistic look draws its own sky from the weather (realistic.ts); these are its night and clear day
  realistic: {
    night: [
      [24, 32, 54],
      [8, 12, 26],
    ],
    day: [
      [178, 208, 234],
      [74, 140, 214],
    ],
  },
};
