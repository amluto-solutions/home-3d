// The Settings page's line icons (#248, the menus redesign #219; fixes the glyphs of #221 there): one family on a 24 x 24
// grid, 1.75 stroke, round caps, drawn in the text's colour at 18 px (16 px with class "s"). Decorative: the label
// beside each one says what it is. Drawn for Home 3D in the style of the free lucide set (ISC). An element of the
// page's pickers chunk (pickers.ts), so the page's first open stays within its budget: the box keeps its size until
// the icon arrives.

import { defineElement } from "../define.ts";
import { css, html, LitElement, svg, type TemplateResult } from "lit";

const PATHS: Record<string, TemplateResult> = {
  home: svg`<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>`,
  sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>`,
  zap: svg`<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>`,
  star: svg`<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>`,
  sparkles: svg`<path d="m10 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2zm8 11v6m-3-3h6"/>`,
  alert: svg`<path d="M12 3 2 20h20zm0 6v5m0 3v.1"/>`,
  waves: svg`<path d="M2 8q3.5-3 7 0t7 0 6 0M2 15q3.5-3 7 0t7 0 6 0"/>`,
  camera: svg`<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="3.5"/>`,
  calendar: svg`<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4m8-4v4"/>`,
  users: svg`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7m2 3a6.5 6.5 0 0 1 3.5 5.5"/>`,
  key: svg`<circle cx="8" cy="15" r="4.5"/><path d="m11.5 11.5 8.5-8.5M16 7l3 3"/>`,
  tablet: svg`<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M11 18h2"/>`,
  package: svg`<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5m-9 5v8"/>`,
  history: svg`<path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3.5 2"/>`,
  sliders: svg`<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>`,
  palette: svg`<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.5-2.5S14 15 16 15h2a3 3 0 0 0 3-3c0-5-4-9-9-9z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7" r="1"/>`,
  cube: svg`<path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7zM3.5 7l8.5 4.5L20.5 7M12 11.5v10"/>`,
  monitor: svg`<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>`,
  mic: svg`<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>`,
  search: svg`<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>`,
  back: svg`<path d="m15 18-6-6 6-6"/>`,
  next: svg`<path d="m9 18 6-6-6-6"/>`,
  lock: svg`<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>`,
};

/** `<fp3d-line-icon name="sun">`: one icon of the family, hidden from screen readers. */
export class LineIcon extends LitElement {
  static properties = { name: {} };
  declare name: string;

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("aria-hidden", "true");
  }

  protected render() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${PATHS[this.name] ?? ""}</svg>`;
  }

  static styles = css`
    :host {
      display: inline-flex;
      flex: none;
      width: 18px;
      height: 18px;
    }
    :host(.s) {
      width: 16px;
      height: 16px;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `;
}

defineElement("fp3d-line-icon", LineIcon);

/** The names drawn (a test checks every section's icon is one of them). */
export const SETTINGS_ICONS: readonly string[] = Object.keys(PATHS);
