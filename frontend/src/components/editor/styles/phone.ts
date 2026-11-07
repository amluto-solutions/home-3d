// The phone editor (#250, editor/phone.ts): the plan fills the screen between the header and the bottom bar, the floor
// menu floats as a chip, the toolbar's menus open as sheets above the bar, the side panel is the details sheet (also on
// a tablet held upright, .fp3d-sheeted, under its toolbar row).
// Part of the editor's styles (fp3d-editor static styles, #202): the slices are applied in the order editor.ts lists them.
// Class rules (.fp3d-phone), not a media query: the editor sets the class from the same width rule (phone.ts).

import { css } from "lit";

export const phoneStyles = css`
      /* the bar is 60 px plus the safe area under it, at least 16 px (the Home Assistant app on Android often reports
         0); the panel already ends above Home Assistant's own inset, so only what is left of the screen's is added */
      .fp3d-editor.fp3d-phone {
        --fp3d-bar-h: 76px;
        --fp3d-bar-h: calc(60px + max(16px, env(safe-area-inset-bottom, 0px) - var(--safe-area-inset-bottom, 0px)));
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) auto;
        height: 100%;
        overflow: hidden;
      }
      /* the keyboard is up: the bar steps aside, the sheet sits on the keyboard */
      .fp3d-editor.fp3d-phone.fp3d-typing {
        --fp3d-bar-h: 0px;
      }
      .fp3d-phone.fp3d-typing > fp3d-phone-bar {
        display: none;
      }
      .fp3d-phone > fp3d-phone-bar {
        grid-row: 2;
        min-height: var(--fp3d-bar-h);
        transition: transform 0.2s ease;
      }
      /* something is being moved on the plan: the bar slides away (its room stays, so the plan does not resize) */
      :host([data-dragging]) .fp3d-phone > fp3d-phone-bar {
        transform: translateY(100%);
        visibility: hidden;
      }
      .fp3d-phone > .fp3d-main {
        grid-row: 1;
      }
      .fp3d-editor.fp3d-sheeted .fp3d-canvas-wrap {
        min-height: 0;
      }
      /* a tablet held upright keeps its toolbar row; the plan fills the rest and the sheet comes up over it */
      .fp3d-editor.fp3d-sheeted:not(.fp3d-phone) {
        --fp3d-bar-h: 0px;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto minmax(0, 1fr);
        height: 100%;
        overflow: hidden;
      }
      /* the toolbar row is not drawn: its floor menu floats as a chip, its Build and Outside menus open above the bar */
      .fp3d-phone > .fp3d-toolbar,
      .fp3d-phone .fp3d-seg-tools,
      .fp3d-phone .fp3d-seg-tools > .fp3d-menu-wrap {
        display: contents;
      }
      .fp3d-phone > .fp3d-toolbar > :not(.fp3d-seg-floor):not(.fp3d-seg-tools):not(.fp3d-warn):not(.fp3d-pick-tip),
      .fp3d-phone .fp3d-seg-tools > button,
      .fp3d-phone .fp3d-seg-tools > .fp3d-menu-wrap > button {
        display: none;
      }
      /* the floor chip: top left, clear of the 16 px edge strip left for the system's swipes */
      .fp3d-phone .fp3d-seg-floor {
        position: absolute;
        top: 8px;
        left: 16px;
        z-index: 22;
        max-width: calc(100% - 96px);
      }
      .fp3d-phone .fp3d-seg-floor .fp3d-menu-wrap > button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 44px;
        max-width: 100%;
        padding: 0 12px;
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-control, 6px);
        background: var(--fp3d-chrome-solid);
        box-shadow: var(--fp3d-shadow);
        color: var(--fp3d-text);
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
      }
      .fp3d-phone .fp3d-seg-floor .fp3d-menu-label {
        display: none;
      }
      .fp3d-phone .fp3d-warn {
        position: absolute;
        top: 60px;
        left: 16px;
        z-index: 22;
        padding: 4px 10px;
        border-radius: 8px;
        background: var(--fp3d-chrome-solid);
      }
      .fp3d-phone .fp3d-pick-tip {
        left: 50% !important;
        top: auto !important;
        bottom: calc(var(--fp3d-bar-h) + 12px);
        white-space: normal;
        max-width: calc(100% - 32px);
      }
      .fp3d-phone .fp3d-pick-tip::before {
        display: none;
      }
      .fp3d-phone .fp3d-tool-note {
        top: 60px;
      }
      /* Build and Outside: a sheet above the bar */
      .fp3d-phone .fp3d-seg-tools .fp3d-menu {
        top: auto;
        left: 0;
        right: 0;
        bottom: var(--fp3d-bar-h);
        z-index: 31;
        min-width: 0;
        max-height: 70%;
        padding: 8px 8px 12px;
        border-width: 1px 0 0;
        border-radius: 14px 14px 0 0;
        box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
      }
      .fp3d-phone .fp3d-seg-tools .fp3d-menu-veil {
        background: rgba(2, 6, 14, 0.45);
      }
      .fp3d-phone .fp3d-menu .fp3d-menu-item,
      .fp3d-phone .fp3d-menu .fp3d-chip {
        min-height: 44px;
      }
      /* the zoom buttons: top right, out of the sheet's way */
      .fp3d-sheeted .fp3d-nav {
        top: 8px;
        right: 16px;
        transform: none;
      }
      /* the hint: one line, only while nothing is chosen (editor/toolbar.ts renderHint) */
      .fp3d-phone .fp3d-hint {
        left: 16px;
        right: 16px;
        bottom: 8px;
        max-width: none;
        font-size: 13px;
        padding: 4px 4px 4px 12px;
      }
      .fp3d-phone .fp3d-hint-text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .fp3d-phone .fp3d-hint-hide {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 0;
      }
      .fp3d-phone .fp3d-start {
        left: 16px;
        right: 16px;
        bottom: 8px;
        max-width: none;
      }
      /* the details sheet: a named region with peek, half and full heights over the plan, above the bar */
      .fp3d-editor.fp3d-sheeted > .fp3d-sheet {
        position: absolute;
        left: 0;
        right: 0;
        bottom: var(--fp3d-bar-h);
        z-index: 25;
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: 0;
        overflow: hidden;
        max-height: calc(100% - var(--fp3d-bar-h) - 8px);
        border: 0;
        border-top: 1px solid var(--fp3d-line);
        border-radius: 14px 14px 0 0;
        box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
        transition: height 0.2s ease;
      }
      .fp3d-sheeted > .fp3d-sheet[data-sheet="half"] {
        height: 50%;
      }
      .fp3d-sheeted > .fp3d-sheet[data-sheet="full"] {
        height: calc(100% - var(--fp3d-bar-h) - 8px);
      }
      /* under a toolbar row (a tablet held upright, a phone held sideways) the full sheet stops below it */
      .fp3d-editor.fp3d-sheeted:not(.fp3d-phone) > .fp3d-sheet {
        max-height: calc(100% - var(--fp3d-toolbar-h, 52px) - 16px);
      }
      .fp3d-sheeted:not(.fp3d-phone) > .fp3d-sheet[data-sheet="full"] {
        height: calc(100% - var(--fp3d-toolbar-h, 52px) - 16px);
      }
      .fp3d-sheet-head {
        flex: none;
        touch-action: none;
      }
      /* the grab bar sizes the sheet (#420, CONS-9): a button 96 x 24 px round the 40 x 4 px bar */
      .fp3d-sheet-grab {
        display: block;
        width: 96px;
        height: 24px;
        margin: 0 auto;
        padding: 0;
        border: 0;
        border-radius: 12px;
        background: none;
        cursor: pointer;
      }
      .fp3d-sheet-grab::before {
        content: "";
        display: block;
        width: 40px;
        height: 4px;
        margin: 0 auto;
        border-radius: 2px;
        background: var(--fp3d-muted);
        opacity: 0.7;
      }
      .fp3d-sheet-grab:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: -2px;
      }
      .fp3d-sheet-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 2px 14px 10px;
      }
      .fp3d-sheet-title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .fp3d-sheet-title b {
        font-size: 15px;
      }
      /* the panel's own header as the sheet's title row: name and "kind · place" on one line, lock, "⋯", Close */
      .fp3d-sheet-own {
        align-items: flex-start;
        padding: 0 10px 8px 14px;
      }
      .fp3d-sheet-own > .fp3d-panel-head {
        flex: 1;
        min-width: 0;
        position: static;
        margin: 0;
        padding: 0;
        background: none;
        border: 0;
        box-shadow: none;
        align-items: center;
      }
      .fp3d-sheet-own .fp3d-item-title {
        display: flex;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
      }
      .fp3d-sheet-own .fp3d-item-title h2 {
        flex: 0 1 auto;
        min-width: 0;
        font-size: 15px;
      }
      .fp3d-sheet-own .fp3d-item-title .fp3d-sub {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp3d-sheet-own .fp3d-item-title .fp3d-sub::before {
        content: "· ";
      }
      .fp3d-sheet-own .fp3d-icon-btn {
        min-width: 44px;
        min-height: 44px;
      }
      .fp3d-phone .fp3d-sheet-hint {
        display: block;
        overflow: visible;
        text-overflow: clip;
        white-space: normal;
        font-size: 12.5px;
        color: var(--fp3d-muted);
      }
      /* drawing by measure in the sheet (#301): the hint is in the sheet header; the length box and the arrows share a row */
      .fp3d-phone .fp3d-measure-hint {
        display: none;
      }
      .fp3d-phone .fp3d-measure-row {
        flex-direction: row;
        align-items: flex-end;
      }
      .fp3d-phone .fp3d-measure-len {
        flex: 1;
        min-width: 0;
      }
      .fp3d-phone .fp3d-arrows {
        grid-template-columns: repeat(4, var(--fp3d-touch, 44px));
        grid-template-areas: "left down up right";
        gap: 4px;
      }
      .fp3d-sheet-close {
        flex: none;
        min-height: 44px;
      }
      .fp3d-sheet-close {
        min-width: 44px;
        display: grid;
        place-items: center;
      }
      .fp3d-sheet-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: 18px;
        /* the last row clears the bottom bar (#396) */
        padding: 4px 14px calc(24px + var(--fp3d-bar-h, 0px));
        scroll-padding-bottom: calc(24px + var(--fp3d-bar-h, 0px));
      }
      /* "Back to the floor" is a small link here, so the name and area come first (#262) */
      .fp3d-sheet-body > .fp3d-nav-row {
        margin-bottom: -10px;
      }
      .fp3d-sheet-body > .fp3d-back {
        align-self: flex-start;
        min-height: 32px;
        margin-bottom: -10px;
        padding: 2px 10px;
        font-size: 13px;
      }
      .fp3d-sheet[data-sheet="peek"] > .fp3d-sheet-body {
        display: none;
      }
      /* 3D beside on a phone (#263): the 3D view takes the whole plan area, its button goes back to the 2D plan; the
         plan stays laid out under it, so it is where it was when the 3D view closes */
      .fp3d-phone .fp3d-stage-pair.fp3d-split {
        position: relative;
      }
      .fp3d-phone .fp3d-split > .fp3d-editor-3d {
        position: absolute;
        inset: 0;
        z-index: 6;
        border: 0;
        min-width: 0;
      }
      .fp3d-phone .fp3d-split > .fp3d-canvas-wrap {
        flex: 1 1 auto;
      }
      /* the floor chip floats at the top left: the wall switch goes to the right */
      .fp3d-phone .fp3d-3d-walls {
        left: auto;
        right: 12px;
      }
      .fp3d-phone .fp3d-split-handle {
        display: none;
      }
      .fp3d-phone .fp3d-3d-fold {
        top: auto;
        right: auto;
        left: 12px;
        bottom: 12px;
        min-height: 44px;
        padding: 6px 16px;
        font-weight: 600;
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
        border-color: transparent;
      }
      @media (prefers-reduced-motion: reduce) {
        .fp3d-editor.fp3d-sheeted > .fp3d-sheet,
        .fp3d-phone > fp3d-phone-bar {
          transition: none;
        }
      }
`;
