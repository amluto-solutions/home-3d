// The editor's side of the floating item toolbar (#398): when it shows, its tag (the toolbar itself is a lazy chunk,
// item-bar-view.ts), Tab into it, and the side panel left alone while a drag moves the item.

import { html, nothing } from "lit";
import { once, need } from "../../lazy-part.ts";
import type { Fp3dEditor } from "../editor.ts";

/** The toolbar's code: a chunk of its own, loaded the first time one item is chosen in the plan. */
const loadItemBar = once(() => import("./item-bar-view.ts"));

/** Whether the toolbar is shown: one item (not a block or several) chosen in the plan of the editor. */
export function barShown(ed: Fp3dEditor): boolean {
  return !!(ed.isEditor && ed._furnitureId && !ed._multi.length && (ed._tool === "select" || ed._tool === "furniture") && ed.selection().length === 1 && !ed._hiddenItems.includes(ed._furnitureId) && !ed._wallView);
}

/** The floating toolbar's tag, drawn again with every render of the editor (it follows the item); or nothing. */
export function renderItemBar(ed: Fp3dEditor) {
  // a pinch has the plan, a menu is open: the toolbar steps aside until they end
  if (!barShown(ed) || ed._ctx || ed.pinch) return nothing;
  need(loadItemBar);
  return html`<fp3d-item-bar .host=${ed} .stamp=${{}}></fp3d-item-bar>`;
}

/** Tab from the selected item (#398): the keyboard goes into its toolbar; false when no toolbar is shown. */
export function focusItemBar(ed: Fp3dEditor): boolean {
  const button = (ed.renderRoot as ShadowRoot | undefined)?.querySelector?.<HTMLElement>(".fp3d-itembar button[tabindex='0']");
  if (typeof button?.focus !== "function") return false;
  button.focus();
  return true;
}

/** After the "⋯" menu: the keyboard back on the toolbar's "⋯", once the toolbar is drawn again. */
export function refocusItemBar(ed: Fp3dEditor): void {
  void ed.updateComplete.then(() => requestAnimationFrame(() => focusItemBar(ed)));
}

/**
 * What the side panel (or the phone's sheet) is drawn for while a drag edits the plan (#398): the drag itself, so the
 * panel is left as it was on every move and drawn once more when the drag ends; any other time a new key, so it is
 * drawn as usual. The plan and the toolbar follow the drag; the panel's numbers catch up on release.
 */
export function sideFreeze(ed: Fp3dEditor): object {
  const d = ed.drag;
  return d && "base" in d && d.moved ? d : {};
}
