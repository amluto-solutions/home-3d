// Toolbar icons drawn as inline SVG (24 x 24, stroke = currentColor), so they look the same on every device. A font
// glyph such as a hollow square or a half-filled box shows as a plain box where the device's fonts lack it (#221).

import { svg, type TemplateResult } from "lit";

// the header's tabs and the editor's toolbar (#249) join the one line family of the redesign (#219)
export type UiIcon = "split-off" | "split-on" | "panel-left" | "panel-right" | "holo" | "flow" | "undo" | "redo" | "expand" | "cube" | "pencil" | "puzzle" | "gear" | "pointer" | "wall" | "tree" | "sofa" | "bolt" | "more" | "help" | "down" | "x" | "right" | "sliders" | "camera" | "back";

const PATHS: Record<UiIcon, TemplateResult> = {
  // a plan with a second pane beside it: outline, divider, the 3D pane filled when it is open
  "split-off": svg`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>`,
  "split-on": svg`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/><path d="M12 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7z" fill="currentColor" stroke="none" opacity=".45"/>`,
  "panel-left": svg`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 5v14"/><path d="M5 5h5v14H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="currentColor" stroke="none" opacity=".45"/>`,
  "panel-right": svg`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M14 5v14"/><path d="M14 5h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5z" fill="currentColor" stroke="none" opacity=".45"/>`,
  // a hologram card: a card with a base line under it
  holo: svg`<rect x="5" y="3" width="14" height="12" rx="2"/><path d="M8 7h8M8 11h5M3 19h18M7 21.5h10"/>`,
  flow: svg`<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>`,
  undo: svg`<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>`,
  redo: svg`<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>`,
  expand: svg`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,
  cube: svg`<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>`,
  pencil: svg`<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>`,
  puzzle: svg`<path d="M9 3h4v3a2 2 0 1 0 4 0V3h4v6h-3a2 2 0 1 0 0 4h3v8h-6v-3a2 2 0 1 0-4 0v3H3v-6h3a2 2 0 1 0 0-4H3V3z"/>`,
  gear: svg`<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>`,
  pointer: svg`<path d="m5 3 14 7-6 2-2 6z"/>`,
  wall: svg`<rect x="3" y="5" width="18" height="14"/><path d="M3 12h18M9 5v7M15 12v7"/>`,
  tree: svg`<path d="M12 3 6 11h3l-4 6h14l-4-6h3z"/><path d="M12 17v4"/>`,
  sofa: svg`<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z"/>`,
  bolt: svg`<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>`,
  more: svg`<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>`,
  help: svg`<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4V14M12 17.5v.01"/>`,
  down: svg`<path d="m6 9 6 6 6-6"/>`,
  // the phone editor's sheet and More (#250)
  x: svg`<path d="M6 6l12 12M18 6 6 18"/>`,
  right: svg`<path d="m9 6 6 6-6 6"/>`,
  // the phone's bottom bar (#346): the View panel, the camera wall and Back as symbols
  sliders: svg`<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`,
  camera: svg`<path d="M3 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m16 10.5 5-3v9l-5-3"/>`,
  back: svg`<path d="M19 12H5M11 6l-6 6 6 6"/>`,
};

/** A toolbar icon: sized by the font (1.15em), decorative (the button carries the label). */
export function uiIcon(name: UiIcon): TemplateResult {
  return svg`<svg class="fp3d-ui-icon" viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="vertical-align:-0.2em">${PATHS[name]}</svg>`;
}
