// The editor's side panel moves like the View panel (#421): dragged by its shared header (#409) or its navigation row
// with FloatDrag (float-panel.ts, #265), its place kept per device ("home3d.float.editor-side"), put back by a
// double-click or the snap-back button, and settled back inside the editor when the window changes size. While it is
// moved it floats over the plan (the plan takes the whole width); phones keep the bottom sheet and never drag.

import { html, nothing } from "lit";
import { FloatDrag, parseOffset } from "../../float-panel.ts";
import type { Fp3dEditor } from "../editor.ts";

/** Where the side panel's place is kept in this browser (float-panel.ts adds the "home3d.float." prefix). */
export const SIDE_DRAG_NAME = "editor-side";

interface SideDrag {
  host: HTMLElement;
  drag: FloatDrag;
  /** A drag by the handle is under way. */
  dragging: boolean;
}
const drags = new WeakMap<object, SideDrag>();

/** The side panel can move: a desktop or tablet side bar, not the phone's bottom sheet nor a part on the Settings page. */
export function sideCanDrag(ed: Fp3dEditor): boolean {
  return !ed.narrow && !ed._sheeted && !ed._phone && !ed.topic;
}

/** The side panel's drag, while it has one. */
export function sideDrag(ed: Fp3dEditor): FloatDrag | null {
  return sideCanDrag(ed) ? (drags.get(ed)?.drag ?? null) : null;
}

/** Marks a moved panel ("data-floating"), so it floats over the plan and the plan takes the whole width. */
function reflect(s: SideDrag): void {
  s.host.toggleAttribute("data-floating", !!s.drag.offset);
}

/**
 * After a render: the drag follows the <aside> drawn now. A new aside (the bar unfolded, the 3D pane opened beside)
 * gets this device's place again; on a phone the drag is let go and nothing stays moved.
 */
export function syncSideDrag(ed: Fp3dEditor): void {
  const host = sideCanDrag(ed) ? ((ed.renderRoot as ParentNode | undefined)?.querySelector?.<HTMLElement>("aside.fp3d-side:not(.fp3d-side-strip)") ?? null) : null;
  const now = drags.get(ed);
  if (now?.host === host) return;
  if (now) {
    now.host.style.translate = "";
    now.host.removeAttribute("data-floating");
    drags.delete(ed);
  }
  if (!host) return;
  // the editor draws again only when the snap-back button comes or goes, not on every move (#391: one render per edit)
  let moved = false;
  const s: SideDrag = {
    host,
    dragging: false,
    drag: new FloatDrag(host, SIDE_DRAG_NAME, () => {
      reflect(s);
      if (moved !== !!s.drag.offset) {
        moved = !!s.drag.offset;
        ed.requestUpdate();
      }
    }),
  };
  drags.set(ed, s);
  // a kept place floats before it is measured, so it settles against the floating box, not the full-height column
  if (storedOffset()) host.setAttribute("data-floating", "");
  s.drag.load();
  moved = !!s.drag.offset;
  reflect(s);
  // drawn once more with the handles marked (and the snap-back button for a place kept from an earlier visit)
  ed.requestUpdate();
}

/** This device's kept place, if any. */
function storedOffset() {
  try {
    return parseOffset(localStorage.getItem(`home3d.float.${SIDE_DRAG_NAME}`));
  } catch {
    return null;
  }
}

/** Back inside the editor after the window (or the editor) changed size. */
export function settleSideDrag(ed: Fp3dEditor): void {
  sideDrag(ed)?.settle();
}

/** Puts the side panel back where it docks. */
export function resetSideDrag(ed: Fp3dEditor): void {
  const s = drags.get(ed);
  if (!s) return;
  s.drag.reset();
  reflect(s);
}

/**
 * The pointer listeners of a drag handle (the shared header, the navigation row). Its buttons and fields keep their
 * own clicks (FloatDrag.begin); the plan and the 3D pane beside it do not take the pointer while the panel moves
 * (pointer capture, and "data-panel-drag" on the editor turns their pointer events off).
 */
export function sideDragHandle(ed: Fp3dEditor) {
  const host = ed as unknown as HTMLElement;
  const end = () => {
    const s = drags.get(ed);
    if (!s?.dragging) return;
    s.dragging = false;
    s.drag.end();
    host.removeAttribute?.("data-panel-drag");
    reflect(s);
  };
  return {
    down: (e: PointerEvent) => {
      const s = sideDrag(ed) ? drags.get(ed) : undefined;
      if (!s) return;
      s.drag.begin(e);
      if (!e.defaultPrevented) return;
      s.dragging = true;
      host.setAttribute?.("data-panel-drag", "");
    },
    move: (e: PointerEvent) => {
      const s = drags.get(ed);
      if (!s?.dragging) return;
      // it floats from the first move on, so the drag measures the floating box (not the full-height column)
      if (!s.host.hasAttribute("data-floating")) s.host.setAttribute("data-floating", "");
      s.drag.move(e);
    },
    up: end,
    dblclick: (e: MouseEvent) => {
      if (!sideDrag(ed) || (e.target as HTMLElement | null)?.closest?.("button, input, select, a")) return;
      resetSideDrag(ed);
    },
  };
}

/** The snap-back button, while the panel is moved (in the navigation row). */
export function sideSnapBack(ed: Fp3dEditor) {
  if (!sideDrag(ed)?.offset) return nothing;
  return html`<button type="button" class="fp3d-btn fp3d-icon-btn fp3d-side-snap" aria-label=${ed.t("float_snap_back")} title=${ed.t("float_snap_back")} @click=${() => resetSideDrag(ed)}>⤒</button>`;
}

/** Forgets the drag of an editor (tests). */
export function forgetSideDrag(ed: object): void {
  drags.delete(ed);
}
