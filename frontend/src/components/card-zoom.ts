// The zoom view of a glass card (#541): the card near full screen. A chunk of its own (view3d.ts imports it the first
// time a card's zoom button is pressed), so the 3D view and the wall tablet carry only the button.
//
// The 3D view draws the card itself, with its own card code and data (cardBody, zoomDraw: unfolded, the solar card
// grown with its forecast), as this element's children; this element is only the frame: the dimmed page behind, the
// card's name, the close button, and the card scaled to fill the screen. It closes with the button, a tap outside,
// Escape, Back (the 3D view's back layer) and, when this device set a time, by itself after that time without a touch
// (home3d.card_zoom_close in seconds; none or 0: never). The focus goes in when it opens and back when it closes.

import { css, html, LitElement } from "lit";
import { defineElement } from "../define.ts";
import { focusables, pageFocus, wrapTab } from "../dialog-focus.ts";
import { translate } from "../i18n.ts";
import type { HomeAssistant } from "../types.ts";
import { devicePref, ZOOM_CLOSE_KEY, zoomCloseMs } from "../card-times.ts";
/** The card grows at most this much (a small card on a large screen would be a blur of glass). */
const MAX_SCALE = 4;

/** How much the card grows to fill the space: the smaller of the two ratios, never under 1, never over MAX_SCALE. */
export function zoomScale(cardW: number, cardH: number, spaceW: number, spaceH: number): number {
  if (!(cardW > 0) || !(cardH > 0) || !(spaceW > 0) || !(spaceH > 0)) return 1;
  return Math.max(1, Math.min(MAX_SCALE, spaceW / cardW, spaceH / cardH));
}

/**
 * The card's look inside the zoom view: it lives in the 3D view's shadow root (the 3D view draws it), so this sheet goes
 * there, once. The card stands still in the frame (no place on the screen, no anchor line), its artwork and curve larger; on a
 * phone it is narrower, so it grows more across the width.
 */
const CARD_CSS = `
fp3d-card-zoom > .fp3d-holo { position: relative !important; display: block !important; transform: none !important; cursor: default; will-change: auto; width: 260px; margin: auto; }
fp3d-card-zoom > .fp3d-holo-link, fp3d-card-zoom .fp3d-holo-hide, fp3d-card-zoom .fp3d-holo-minor-btn { display: none !important; }
fp3d-card-zoom .fp3d-holo-track { flex-direction: column; align-items: stretch; text-align: center; }
fp3d-card-zoom .fp3d-holo-cover { width: 100%; height: auto; max-height: 170px; aspect-ratio: 16 / 10; object-fit: contain; background: rgba(8, 16, 34, 0.4); }
fp3d-card-zoom .fp3d-holo-cover-none { height: 90px; aspect-ratio: auto; font-size: 40px; }
fp3d-card-zoom .fp3d-holo-titles b, fp3d-card-zoom .fp3d-holo-titles span { max-width: none; white-space: normal; overflow-wrap: anywhere; }
fp3d-card-zoom .fp3d-holo-curve { width: 100%; height: auto; }
fp3d-card-zoom .fp3d-holo-media-controls { justify-content: center; flex-wrap: wrap; }
@media (max-width: 600px) { fp3d-card-zoom > .fp3d-holo { width: 220px; } }
fp3d-card-zoom[tall] .fp3d-holo-curve { display: block; margin: 4px 0; }
fp3d-card-zoom[tall] .fp3d-holo-curve * { vector-effect: non-scaling-stroke; }
fp3d-card-zoom[tall] .fp3d-holo-curve circle { display: none; }
`;

export class Fp3dCardZoom extends LitElement {
  static properties = {
    hass: { attribute: false },
    label: {},
  };

  declare hass: HomeAssistant | undefined;
  declare label: string;
  /** Where the focus was when the view opened: it goes back there when it closes. */
  private back: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private sizes: ResizeObserver | null = null;
  private watched: Element | null = null;

  constructor() {
    super();
    this.label = "";
    // a tap on the card itself (not on one of its buttons or sliders) does nothing here: on the floating card it folds
    // or grows the card, which the zoom view always shows in full
    this.addEventListener(
      "click",
      (e) => {
        const hit = e.composedPath()[0];
        if (hit instanceof Element && hit !== this && this.contains(hit) && !hit.closest("button, input, select, a, label")) e.stopPropagation();
      },
      true,
    );
    this.addEventListener("keydown", (e) => this.onKey(e));
    for (const type of ["pointerdown", "keydown", "wheel"]) this.addEventListener(type, () => this.arm(), { passive: true });
  }

  connectedCallback(): void {
    super.connectedCallback();
    // the house behind stays still: a drag or the wheel on the zoom view is its own (#550, viewer/controls.ts)
    this.setAttribute("data-own-pointer", "");
    this.back = pageFocus();
    addEventListener("keydown", this.onEscape, true);
    addEventListener("resize", this.fit);
    this.addSheet();
    this.arm();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    removeEventListener("keydown", this.onEscape, true);
    removeEventListener("resize", this.fit);
    clearTimeout(this.timer);
    this.sizes?.disconnect();
    this.sizes = null;
    this.watched = null;
    const back = this.back;
    this.back = null;
    if (back?.isConnected) back.focus();
  }

  protected firstUpdated(): void {
    this.renderRoot.querySelector<HTMLElement>(".x")?.focus();
    if (typeof ResizeObserver === "function") {
      this.sizes = new ResizeObserver(() => this.fit());
      const body = this.renderRoot.querySelector(".body");
      if (body) this.sizes.observe(body);
    }
    this.fit();
  }

  /** The card's sheet in the 3D view's shadow root, added once. */
  private addSheet(): void {
    const root = this.getRootNode();
    if (!(root instanceof ShadowRoot) || root.querySelector("style[data-fp3d-zoom]")) return;
    const style = document.createElement("style");
    style.dataset.fp3dZoom = "";
    style.textContent = CARD_CSS;
    root.appendChild(style);
  }

  /** (Re)starts the auto close time, read each time (the setting may have changed); none: no timer. */
  private arm(): void {
    clearTimeout(this.timer);
    const ms = zoomCloseMs(devicePref(ZOOM_CLOSE_KEY));
    if (ms) this.timer = setTimeout(() => this.close(), ms);
  }

  private close(): void {
    clearTimeout(this.timer);
    this.dispatchEvent(new CustomEvent("close"));
  }

  private onEscape = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    this.close();
  };

  /** Tab and Shift+Tab stay in the view: the close button, then the card's controls. */
  private onKey(e: KeyboardEvent): void {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
    const x = this.renderRoot.querySelector<HTMLElement>(".x");
    const list = [...(x ? [x] : []), ...focusables(this as HTMLElement)];
    const inner = (this.renderRoot as ShadowRoot).activeElement as HTMLElement | null;
    const outer = (this.getRootNode() as ShadowRoot | Document).activeElement as HTMLElement | null;
    const current = inner ?? (outer && outer !== this && this.contains(outer) ? outer : null);
    const to = wrapTab(list, current, e.shiftKey, !!current);
    if (!to) return;
    e.preventDefault();
    to.focus();
  }

  /**
   * Scales the card to the space (CSS zoom keeps the text sharp; a browser without it shows the card at its own size).
   * The card's own folds and buttons are its own; it is only no longer a button that folds it.
   */
  private fit = (): void => {
    const card = this.querySelector<HTMLElement>(":scope > .fp3d-holo");
    const body = this.renderRoot.querySelector<HTMLElement>(".body");
    if (!card || !body) return;
    if (card !== this.watched) {
      if (this.watched) this.sizes?.unobserve(this.watched);
      this.watched = card;
      this.sizes?.observe(card);
      // the zoom view is not a toggle: the card's own role and focus stop go
      for (const el of [card, ...card.querySelectorAll<HTMLElement>(".fp3d-holo-head[role=button]")]) {
        el.removeAttribute("role");
        el.removeAttribute("tabindex");
        el.removeAttribute("aria-expanded");
      }
    }
    const style = card.style as CSSStyleDeclaration & { zoom: string };
    style.zoom = "";
    // a phone upright (#546): the card fills the width, and its curve (or a TV's artwork) takes the height left over
    const grow = card.querySelector<HTMLElement>(".fp3d-holo-curve, .fp3d-holo-cover");
    if (grow) grow.style.height = grow.style.maxHeight = "";
    const w = body.clientWidth - 16;
    const h = body.clientHeight - 16;
    const tall = h > w * 1.25;
    this.toggleAttribute("tall", tall);
    let k = zoomScale(card.offsetWidth, card.offsetHeight, w, h);
    if (tall) {
      const across = zoomScale(card.offsetWidth, 1, w, Infinity);
      const room = h / across - card.offsetHeight;
      if (room >= 0) {
        k = across;
        if (grow) {
          const now = grow.getBoundingClientRect().height;
          // artwork no taller than wide; the curve as tall as there is room
          const to = grow.tagName === "svg" ? now + room : Math.min(now + room, grow.offsetWidth);
          grow.style.height = grow.style.maxHeight = `${to}px`;
          grow.setAttribute("preserveAspectRatio", "none");
        }
      }
    }
    style.zoom = k > 1 ? k.toFixed(3) : "";
  };

  protected render() {
    const t = (k: "close") => translate(this.hass, k);
    return html`<div class="dim" @click=${() => this.close()}></div>
      <div class="box" role="dialog" aria-modal="true" aria-label=${this.label}>
        <div class="top">
          <h2>${this.label}</h2>
          <button class="x" title=${t("close")} aria-label=${t("close")} @click=${() => this.close()}>✕</button>
        </div>
        <div class="body"><slot @slotchange=${this.fit}></slot></div>
      </div>`;
  }

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: block;
      font-family: var(--fp3d-font, inherit);
    }
    .dim {
      position: absolute;
      inset: 0;
      background: rgba(2, 8, 20, 0.62);
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
    }
    .box {
      position: absolute;
      inset: max(12px, 3vh) max(12px, 3vw);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      border-radius: 20px;
      border: 1px solid rgba(160, 240, 255, 0.45);
      background: radial-gradient(ellipse at 50% 30%, rgba(30, 70, 120, 0.55), rgba(6, 14, 30, 0.88) 70%);
      box-shadow: 0 0 40px rgba(55, 224, 255, 0.25);
      color: #e6fbff;
      overflow: hidden;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 8px 0 18px;
    }
    h2 {
      flex: 1;
      min-width: 0;
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8ff0ff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .x {
      flex: none;
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 50%;
      background: rgba(8, 16, 34, 0.6);
      color: inherit;
      font-size: 18px;
      cursor: pointer;
    }
    .x:hover {
      background: rgba(8, 16, 34, 0.9);
    }
    .x:focus-visible {
      outline: 2px solid #8ff0ff;
      outline-offset: 2px;
    }
    .body {
      display: grid;
      place-items: center;
      padding: 8px;
      overflow: auto;
    }
    @media (max-width: 600px) {
      .box {
        inset: 8px;
        border-radius: 16px;
      }
    }
  `;
}

defineElement("fp3d-card-zoom", Fp3dCardZoom);
