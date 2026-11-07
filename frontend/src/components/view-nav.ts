// On-screen zoom and pan for the 3D view and the 2D plan (#297), like the editor plan's navigation buttons (#234): zoom
// in, zoom out, four arrows that move the view and a middle button that brings the whole house back. A chunk of its own
// (view3d.ts loads it when the stage first draws), so the wall tablet's first paint does not carry it. It only says what
// was pressed ("nav" with the action); the stage moves the viewer it draws with.

import { defineElement } from "../define.ts";
import { css, html, LitElement } from "lit";
import { tokens } from "../styles.ts";

export type NavAction = "in" | "out" | "left" | "right" | "up" | "down" | "reset" | "turnLeft" | "turnRight";

type T = (key: string) => string;

export class Fp3dViewNav extends LitElement {
  static properties = { t: { attribute: false }, turn: { type: Boolean } };
  declare t: T;
  /** Show the turn buttons (the flat 2D plan does not turn). */
  declare turn: boolean;

  constructor() {
    super();
    this.t = (k) => k;
    this.turn = true;
  }

  private btn(act: NavAction, glyph: string, tip: string) {
    return html`<button type="button" class="b ${act}" title=${tip} aria-label=${tip} @click=${() => this.dispatchEvent(new CustomEvent<NavAction>("nav", { detail: act, bubbles: true, composed: true }))}>${glyph}</button>`;
  }

  protected render() {
    const t = this.t;
    return html`<div class="pad" role="group" aria-label=${t("nav_view_label")}>
      ${this.btn("in", "+", t("nav_zoom_in"))}${this.btn("up", "▲", t("nav_pan_up"))}${this.btn("out", "−", t("nav_zoom_out"))}
      ${this.btn("left", "◀", t("nav_pan_left"))}${this.btn("reset", "⤢", t("nav_reset"))}${this.btn("right", "▶", t("nav_pan_right"))}
      ${this.turn ? this.btn("turnLeft", "↺", t("nav_turn_left")) : html`<span class="gap"></span>`}${this.btn("down", "▼", t("nav_pan_down"))}${this.turn ? this.btn("turnRight", "↻", t("nav_turn_right")) : html`<span class="gap"></span>`}
    </div>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      .pad {
        display: grid;
        grid-template-columns: repeat(3, 40px);
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
        background: var(--fp3d-chrome-solid);
        box-shadow: var(--fp3d-shadow);
        overflow: hidden;
      }
      .b {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--fp3d-text);
        font: 600 17px/1 var(--fp3d-font);
        cursor: pointer;
        touch-action: manipulation;
      }
      .b.in,
      .b.out,
      .b.turnLeft,
      .b.turnRight {
        font-size: 20px;
      }
      .b:hover,
      .b:focus-visible {
        background: color-mix(in srgb, var(--fp3d-accent) 18%, transparent);
        outline: none;
      }
      @media (pointer: coarse) {
        .pad {
          grid-template-columns: repeat(3, 44px);
        }
        .b {
          width: 44px;
          height: 44px;
        }
      }
    `,
  ];
}

defineElement("fp3d-view-nav", Fp3dViewNav);
