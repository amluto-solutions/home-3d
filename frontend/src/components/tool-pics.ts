// The small pictures of the Build and Outside cards (#402), drawn in code as SVG: no image files. The colours come
// from the scheme tokens through classes (tool-panel.ts styles), so every look (Neon, Day, Realistic, High contrast)
// draws them in its own colours. Part of the tool panel's lazy chunk: Lit's `svg` comes from the editor (the kit).

import type { svg as Svg, SVGTemplateResult } from "lit";

/** The pictures, drawn with the editor's `svg`: `pic(id)` and the ids that have one. */
export function toolPictures(svg: typeof Svg) {
  // classes: w = a wall (text colour, thick), l = a thin line, a = accent line, d = a corner dot, x = dashed outline,
  // g / s / k / m / p = green, soft blue, warm, muted and water fills
  const dots = (pts: [number, number][]) => pts.map(([x, y]) => svg`<circle class="d" cx=${x} cy=${y} r="2.4" />`);
  const wave = (y: number, x0: number, x1: number) => svg`<path class="a" d=${`M${x0} ${y}${"q3-3 6 0t6 0".repeat(Math.round((x1 - x0) / 12))}`} />`;
  const BLOB = "M10 24C8 12 22 6 32 10S56 8 54 22 40 34 28 32 12 34 10 24Z";

  const PICS: Record<string, () => SVGTemplateResult> = {
    rect: () => svg`<rect class="w" x="12" y="8" width="40" height="24" />${dots([[12, 8], [52, 8], [52, 32], [12, 32]])}`,
    polygon: () => svg`<path class="w" d="M12 8H36V18H52V32H12Z" />${dots([[12, 8], [36, 8], [36, 18], [52, 18], [52, 32], [12, 32]])}`,
    measure: () => svg`<path class="w" d="M12 14H52V34H12Z" /><path class="a" d="M12 6H52M12 3V9M52 3V9" />`,
    wall: () => svg`<path class="w wide" d="M10 30L54 10" />${dots([[10, 30], [54, 10]])}`,
    opening: () => svg`<path class="w wide" d="M4 30H22M42 30H60" /><path class="l" d="M22 30V12" /><path class="a dash" d="M22 12A18 18 0 0 1 40 30" />`,
    hole: () => svg`<rect class="x" x="14" y="7" width="36" height="26" /><path class="l" d="M18 13H46M18 19H46M18 25H46" />`,
    roof: () => svg`<path class="m" d="M14 19V35H50V19L32 8Z" /><path class="w" d="M8 22L32 6L56 22" />`,
    out_lawn: () => svg`<rect class="g" x="8" y="8" width="48" height="24" rx="4" /><path class="gl" d="M17 25l2-5 2 5M30 19l2-5 2 5M43 26l2-5 2 5" />`,
    out_terrace: () => svg`<rect class="s" x="8" y="8" width="48" height="24" /><path class="l" d="M8 16H56M8 24H56M20 8V32M32 8V32M44 8V32" />`,
    out_path: () => svg`<path class="band" d="M4 34C18 34 18 8 32 8S46 34 60 34" />`,
    out_driveway: () => svg`<path class="m" d="M14 36L22 4H42L50 36Z" /><path class="a dash" d="M32 8V34" />`,
    out_bed: () => svg`<ellipse class="k" cx="32" cy="20" rx="24" ry="12" /><circle class="d" cx="22" cy="18" r="2.4" /><circle class="d" cx="32" cy="23" r="2.4" /><circle class="d" cx="42" cy="17" r="2.4" />`,
    out_wild: () => svg`<path class="g x" d=${BLOB} /><path class="gl" d="M22 24l2-6 2 6M36 20l2-6 2 6" />`,
    out_hedge: () => svg`${[14, 25, 36, 47].map((x) => svg`<circle class="g" cx=${x + 1} cy="20" r="7.5" />`)}`,
    out_fence: () => svg`<path class="w" d="M12 9V33M24 9V33M36 9V33M48 9V33" /><path class="l" d="M7 16H53M7 26H53" />`,
    out_pergola: () => svg`<rect class="k" x="10" y="9" width="44" height="22" /><path class="l" d="M18 9V31M26 9V31M34 9V31M42 9V31" />`,
    out_balcony: () => svg`<path class="w wide" d="M4 9H60" /><rect class="s" x="14" y="9" width="36" height="20" /><path class="a" d="M14 29H50" />`,
    pool_rect: () => svg`<rect class="p" x="10" y="8" width="44" height="24" rx="2" />${wave(20, 16, 48)}`,
    pool_round: () => svg`<circle class="p" cx="32" cy="20" r="15" />${wave(20, 20, 44)}`,
    pool_oval: () => svg`<ellipse class="p" cx="32" cy="20" rx="25" ry="13" />${wave(20, 14, 50)}`,
    pool_free: () => svg`<path class="p" d=${BLOB} />${wave(21, 20, 44)}`,
    pool_pipes: () => svg`<path class="a wide" d="M8 30H24V12H42V26H56" />${dots([[24, 12], [42, 26]])}`,
  };

  /** The picture of a card (an empty frame for an id without one). */
  const pic = (id: string) =>
    svg`<svg class="fp3d-tc-svg" viewBox="0 0 64 40" aria-hidden="true" focusable="false">${PICS[id]?.() ?? svg`<rect class="x" x="12" y="8" width="40" height="24" />`}</svg>`;
  return { pic, ids: Object.keys(PICS) };
}
