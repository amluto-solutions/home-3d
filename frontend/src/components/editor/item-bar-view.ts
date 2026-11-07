// The floating edit toolbar over the selected item on the plan (#398, design option D): turn left and right by 90°,
// duplicate, lock, delete and "⋯" (the item's right-click menu). Its buttons are the menu's own actions
// (SelectionPart.itemActions), so the two never differ. It follows the item with a CSS transform only, stays inside the
// plan (below the item when there is no room above) and takes the keyboard as a toolbar: one Tab stop, the arrows move
// between its buttons, Escape gives the keyboard back to the plan. A lazy chunk of its own (item-bar.ts loads it the
// first time an item is chosen); it draws in the editor's shadow root, so its styles come with it.

import { css, html, LitElement, nothing, svg, type TemplateResult } from "lit";
import { furnitureFootprint } from "../../model.ts";
import { furnitureName } from "../../furniture-names.ts";
import { touchOnly } from "../../editor-hint.ts";
import { nextPick } from "../../geometry/pick.ts";
import { defineElement } from "../../define.ts";
import type { Fp3dEditor } from "../editor.ts";

/** Which of an editor's toolbar buttons holds the toolbar's one Tab stop (roving focus). */
const focusAt = new WeakMap<Fp3dEditor, number>();

/** A screen box (px, plan coordinates): left, top, right, bottom. */
export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Room kept between the item and the toolbar, and between the toolbar and the plan's edges (px). */
const GAP = 10;
const EDGE = 4;

/**
 * Where the toolbar goes (its top left corner, px in the plan): centred above the item, below it when there is no room
 * above, always inside the plan. Null when the item is out of view (no toolbar then).
 */
export function barPlace(item: ScreenBox, plan: { w: number; h: number }, bar: { w: number; h: number }): { x: number; y: number; below: boolean } | null {
  if (item.x1 < 0 || item.y1 < 0 || item.x0 > plan.w || item.y0 > plan.h) return null;
  const x = Math.max(EDGE, Math.min((item.x0 + item.x1) / 2 - bar.w / 2, plan.w - bar.w - EDGE));
  const above = item.y0 - GAP - bar.h;
  const below = above < EDGE;
  const y = below ? Math.min(item.y1 + GAP, plan.h - bar.h - EDGE) : above;
  return { x: Math.round(x), y: Math.round(Math.max(EDGE, y)), below };
}

/** The toolbar's size (px) for `buttons` buttons: 32 px each, 44 px on touch. */
export function barSize(buttons: number, touch: boolean): { w: number; h: number } {
  const b = touch ? 44 : 32;
  // buttons and two 5 px separators, a 2 px gap between each, 4 px padding and a 1 px border on both sides
  return { w: buttons * b + (buttons + 1) * 2 + 2 * 5 + 10, h: b + 10 };
}

/** The roving focus of a toolbar (WAI-ARIA): the next button for a key, or -1 when the key is not one of its keys. */
export function barStep(key: string, at: number, count: number): number {
  if (!count) return -1;
  if (key === "ArrowRight") return (at + 1) % count;
  if (key === "ArrowLeft") return (at - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return -1;
}

// the toolbar's icons (24 x 24, stroke = currentColor), as the design drew them; editor-only, so not in ui-icons.ts
const ICONS: Record<string, TemplateResult> = {
  rotate_left: svg`<path d="M4 9a8 8 0 1 1 1.5 7"/><path d="M4 4v5h5"/>`,
  rotate: svg`<path d="M20 9a8 8 0 1 0-1.5 7"/><path d="M20 4v5h-5"/>`,
  duplicate: svg`<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>`,
  lock: svg`<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  unlock: svg`<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>`,
  delete: svg`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>`,
  more: svg`<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>`,
};
const icon = (name: string) =>
  svg`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

/** The buttons the toolbar shows, by action key; on a narrow plan "turn left" waits in "⋯" (#398). */
export function barKeys(narrow: boolean): string[] {
  return [...(narrow ? [] : ["rotate_left"]), "rotate", "duplicate", "lock", "delete"];
}

/** The item's box on screen: its footprint, the turn handle in front and the size label behind (both stay visible). */
function itemScreenBox(ed: Fp3dEditor): ScreenBox | null {
  const f = ed.furnitureItem;
  if (!f) return null;
  const k = ed._view.scale;
  const a = (f.rotation * Math.PI) / 180;
  const reach = f.d / 2 + Math.max(0.3, 26 / k) + 16 / k;
  const back = f.d / 2 + 26 / k;
  const pts = [...furnitureFootprint(f), [f.x - Math.sin(a) * reach, f.z + Math.cos(a) * reach] as const, [f.x + Math.sin(a) * back, f.z - Math.cos(a) * back] as const].map((p) => ed.toScreen([p[0], p[1]]));
  return { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) };
}

/** The floating toolbar (#398), or nothing (the item out of view). */
function renderBar(ed: Fp3dEditor) {
  const f = ed.furnitureItem!;
  const narrow = ed.narrow || ed._phone;
  const touch = touchOnly();
  const keys = barKeys(narrow);
  const acts = ed.itemActions("furniture", f.id);
  const shown = keys.map((key) => acts.find((a) => a.key === key)).filter((a) => !!a);
  const size = barSize(shown.length + 1, touch);
  const box = itemScreenBox(ed);
  const at = box ? barPlace(box, ed._size, size) : null;
  if (!at) return nothing;
  const focus = Math.min(focusAt.get(ed) ?? 0, shown.length);
  const sep = html`<span class="fp3d-itembar-sep" aria-hidden="true"></span>`;
  const more = (e: Event) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const plan = (ed.renderRoot.querySelector("svg.fp3d-plan") as SVGSVGElement | null)?.getBoundingClientRect();
    focusAt.set(ed, shown.length);
    ed._ctx = { x: r.left - (plan?.left ?? 0), y: r.bottom - (plan?.top ?? 0) + 4, kind: "furniture", id: f.id, bar: true };
    void ed.updateComplete.then(() => ed.renderRoot.querySelector<HTMLElement>(".fp3d-ctx button:not(:disabled)")?.focus());
  };
  // left/top stay 0: the position is a transform alone, so following a drag costs no layout (#398)
  return html`<div
    class="fp3d-itembar ${touch ? "fp3d-itembar-touch" : ""} ${at.below ? "fp3d-itembar-below" : ""}"
    role="toolbar"
    aria-label=${ed.t("bar_label", { name: f.name || furnitureName(ed.hass, f.type) })}
    style=${`transform:translate(${at.x}px,${at.y}px)`}
    @pointerdown=${(e: Event) => e.stopPropagation()}
    @contextmenu=${(e: Event) => e.preventDefault()}
    @keydown=${(e: KeyboardEvent) => onBarKey(ed, e)}
  >
    ${shown.map(
      (a, i) => html`${a.key === "duplicate" && i ? sep : nothing}<button
          class="fp3d-itembar-btn ${a.danger ? "fp3d-itembar-danger" : ""}"
          tabindex=${i === focus ? 0 : -1}
          aria-label=${a.label}
          title=${a.title ?? a.label}
          aria-pressed=${a.pressed ?? nothing}
          ?disabled=${a.disabled}
          @focus=${() => focusAt.set(ed, i)}
          @click=${() => a.run()}
        >
          ${icon(a.key === "lock" && a.pressed ? "lock" : a.key === "lock" ? "unlock" : a.key)}
        </button>`,
    )}${sep}<button
      class="fp3d-itembar-btn"
      tabindex=${focus === shown.length ? 0 : -1}
      aria-label=${ed.t("bar_more")}
      title=${ed.t("bar_more")}
      aria-haspopup="menu"
      @focus=${() => focusAt.set(ed, shown.length)}
      @click=${more}
    >
      ${icon("more")}
    </button>
  </div>`;
}

/** The toolbar's keys: arrows, Home and End between its buttons; Escape and Shift+Tab back to the plan, Tab on to the next item. */
function onBarKey(ed: Fp3dEditor, e: KeyboardEvent): void {
  const bar = e.currentTarget as HTMLElement;
  const buttons = [...bar.querySelectorAll<HTMLButtonElement>("button")];
  const at = buttons.indexOf((bar.getRootNode() as ShadowRoot).activeElement as HTMLButtonElement);
  const to = barStep(e.key, at, buttons.length);
  if (to >= 0) {
    e.preventDefault();
    e.stopPropagation();
    focusAt.set(ed, to);
    buttons[to]?.focus();
    return;
  }
  if (e.key === "Escape" || e.key === "Tab") {
    e.preventDefault();
    e.stopPropagation();
    const active = (ed.renderRoot as ShadowRoot).activeElement;
    if (active instanceof HTMLElement) active.blur();
    // Tab goes on to the room's next item (#75 keeps working, with the toolbar as one stop per item)
    const next = e.key === "Tab" && !e.shiftKey ? nextPick(ed.tabItems(), ed._furnitureId, 1) : null;
    if (next) ed.selectFromList(next);
  }
}


// placed by a transform only; its gaps let pinch and pan through to the plan
const STYLE = css`
  .fp3d-itembar {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--fp3d-line);
    border-radius: 12px;
    background: var(--fp3d-panel, #111a2e);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    pointer-events: none;
    will-change: transform;
  }
  .fp3d-itembar-btn {
    pointer-events: auto;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--fp3d-text);
    cursor: pointer;
    touch-action: manipulation;
  }
  .fp3d-itembar-touch .fp3d-itembar-btn {
    width: 44px;
    height: 44px;
  }
  .fp3d-itembar-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--fp3d-accent) 16%, transparent);
  }
  .fp3d-itembar-btn:focus-visible {
    outline: 2px solid var(--fp3d-accent);
    outline-offset: 1px;
  }
  .fp3d-itembar-btn[aria-pressed="true"] {
    color: var(--fp3d-accent);
  }
  .fp3d-itembar-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .fp3d-itembar-danger {
    color: var(--fp3d-danger, #ff6b7a);
  }
  .fp3d-itembar-sep {
    width: 1px;
    height: 20px;
    margin: 0 2px;
    background: var(--fp3d-line);
  }
`;

/** <fp3d-item-bar>: the toolbar for `host`'s selected item, drawn again with every render of the editor (`stamp`). */
export class ItemBar extends LitElement {
  static properties = { host: { attribute: false }, stamp: { attribute: false } };
  declare host: Fp3dEditor | undefined;
  declare stamp: unknown;

  protected createRenderRoot() {
    return this;
  }

  render() {
    return this.host ? html`<style>${STYLE}</style>${renderBar(this.host)}` : nothing;
  }
}

defineElement("fp3d-item-bar", ItemBar);
