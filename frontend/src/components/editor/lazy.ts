// Parts of the editor that its first paint does not need are one chunk of their own (#245, build.mjs splits the editor
// bundle, lazy-part.ts): the furniture library, the rack sheet, the Extensions page and the settings pickers (time of
// day, the searchable user list). One chunk, not one each: every chunk adds shared chunks the editor's first open has
// to fetch, and on a slow link each extra file is another wait. The editor draws a tag at once and starts loading the
// chunk; once the editor has drawn and the page is idle it loads anyway, so a panel that needs a part rarely waits.

import { css, html, LitElement, nothing, svg } from "lit";
import { once } from "../../lazy-part.ts";
import { defineElement } from "../../define.ts";
import { uiIcon } from "../../ui-icons.ts";
import { touchWording } from "../../editor-hint.ts";
import { fold, howKey, recentCards, RECENT_KEY, searchCards, useCard } from "../../tool-cards.ts";

export { need } from "../../lazy-part.ts";
const loadParts = once(() => import("./lazy-parts.ts"));
export const loadLibrary = loadParts;
export const loadRackSheet = loadParts;
export const loadMultiSelect = loadParts;
export const loadTimeField = loadParts;
/** The Extensions page (fp3d-extensions), drawn by the panel once the editor bundle and this chunk are there. */
export const loadExtensions = loadParts;
/** The item picker (#293): a chunk of its own, as only an open Item field draws it. */
export const loadItemPicker = once(() => import("../item-picker.ts"));
/** The icon picker (#327): a chunk of its own, drawn by every icon field. */
export const loadIconPicker = once(() => import("./icon-picker.ts"));
/** The Library's Browse tab (#336): a chunk of its own, as only an editor who opens the tab draws it. */
export const loadPackBrowser = once(() => import("../pack-browser.ts"));
/** A pet's panel (#337: its routine and triggers): a chunk of its own, as only an open pet draws it. */
export const loadPetPanel = once(() => import("../pet-panel.ts"));
/** Robot vacuum maps (#350): the floor's section and the alignment over the plan, a chunk of their own. */
export const loadVacuumPanel = once(() => import("../vacuum-panel.ts"));
/** The phone editor's bottom bar and More (#250): a chunk of its own, as only phone-wide screens draw it. */
export const loadPhoneBar = once(() => import("./phone-bar.ts").then((m) => m.definePhoneBar({ LitElement, html, css, nothing, uiIcon, defineElement })));
/** The Build and Outside panels (#402): a chunk of their own that borrows Lit and the card functions (tool-panel.ts). */
export const loadToolPanel = once(() =>
  import("../tool-panel.ts").then((m) => m.defineToolPanel({ LitElement, html, svg, css, nothing, defineElement, touchWording, cards: { fold, howKey, recentCards, RECENT_KEY, searchCards, useCard } })),
);

let preloaded = false;

/** Loads the lazy parts once the page is idle after the editor's first paint (Safari has no requestIdleCallback). */
export function preloadParts(): void {
  if (preloaded) return;
  preloaded = true;
  const all = () => {
    void loadParts().catch(() => (preloaded = false));
    void loadToolPanel().catch(() => undefined);
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(all, { timeout: 3000 });
  else setTimeout(all, 1000);
}
