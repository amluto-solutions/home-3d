// The small pictures of the opening Type cards (#417): a door, window or garage door seen from the front, drawn in code
// as SVG like the Build cards (#402, tool-pics.ts). The colours come from the scheme tokens through classes
// (styles/type-cards.ts), so every look draws them in its own colours.

import { svg, type SVGTemplateResult } from "lit";

// classes: w = frame (text colour), l = thin line, a = accent, d = handle dot, x = dashed, s = glass, m = muted fill
const floor = svg`<path class="l" d="M4 37H60" />`;
const leaf = (x: number, w: number, handleAt: number) => svg`<rect class="w" x=${x} y="6" width=${w} height="31" /><circle class="d" cx=${handleAt} cy="23" r="1.8" />`;
const pane = (x: number, y: number, w: number, h: number) => svg`<rect class="s" x=${x} y=${y} width=${w} height=${h} />`;

const PICS: Record<string, () => SVGTemplateResult> = {
  door: () => svg`${floor}${leaf(24, 16, 37)}<path class="a dash" d="M20 4H44" />`,
  interior: () => svg`${floor}${leaf(24, 16, 37)}<rect class="l" x="27" y="10" width="10" height="10" /><rect class="l" x="27" y="24" width="10" height="10" />`,
  door_double: () => svg`${floor}${leaf(16, 16, 29)}${leaf(32, 16, 35)}`,
  front: () => svg`${floor}<rect class="m" x="20" y="4" width="24" height="33" />${leaf(24, 16, 37)}`,
  front_glass: () => svg`${floor}<rect class="m" x="20" y="4" width="24" height="33" />${leaf(24, 16, 37)}${pane(28, 10, 8, 14)}`,
  sidelight: () => svg`${floor}${pane(14, 6, 8, 31)}${leaf(24, 16, 37)}`,
  sidelights: () => svg`${floor}${pane(10, 6, 8, 31)}${leaf(24, 16, 37)}${pane(46, 6, 8, 31)}`,
  glass: () => svg`${floor}${pane(24, 6, 16, 31)}<rect class="w" x="24" y="6" width="16" height="31" />`,
  sliding: () => svg`${floor}${pane(18, 6, 16, 31)}<rect class="w" x="30" y="6" width="16" height="31" /><path class="a" d="M22 21H28M25 18L28 21L25 24" />`,
  passage: () => svg`${floor}<path class="w" d="M22 37V6H42V37" />`,
  window: () => svg`${pane(18, 8, 28, 22)}<rect class="w" x="18" y="8" width="28" height="22" />`,
  window_double: () => svg`${pane(12, 8, 40, 22)}<rect class="w" x="12" y="8" width="40" height="22" /><path class="w" d="M32 8V30" />`,
  window_bars: () => svg`${pane(18, 8, 28, 22)}<rect class="w" x="18" y="8" width="28" height="22" /><path class="l" d="M32 8V30M18 19H46" />`,
  cellar: () => svg`<path class="l" d="M4 4H60" />${pane(20, 7, 24, 10)}<rect class="w" x="20" y="7" width="24" height="10" /><path class="x" d="M4 30H60" />`,
  terrace: () => svg`${floor}${pane(22, 5, 20, 32)}<rect class="w" x="22" y="5" width="20" height="32" />`,
  terrace_double: () => svg`${floor}${pane(14, 5, 36, 32)}<rect class="w" x="14" y="5" width="36" height="32" /><path class="w" d="M32 5V37" />`,
  glass_wall: () => svg`${floor}${pane(6, 4, 52, 33)}<path class="l" d="M6 4H58M19 4V37M32 4V37M45 4V37" />`,
  garage: () => svg`${floor}<rect class="w" x="10" y="8" width="44" height="29" /><path class="l" d="M10 15H54M10 22H54M10 29H54" />`,
  up_and_over: () => svg`${floor}<rect class="w" x="10" y="8" width="44" height="29" /><path class="l" d="M16 12V33M22 12V33M28 12V33M36 12V33M42 12V33M48 12V33" />`,
};

/** The picture of an opening card (an empty frame for an id without one). */
export function openingPic(id: string) {
  return svg`<svg class="fp3d-oc-svg" viewBox="0 0 64 40" aria-hidden="true" focusable="false">${PICS[id]?.() ?? svg`<rect class="x" x="12" y="8" width="40" height="24" />`}</svg>`;
}

/** The ids that have a picture (tested: every card has one). */
export const OPENING_PIC_IDS = Object.keys(PICS);
