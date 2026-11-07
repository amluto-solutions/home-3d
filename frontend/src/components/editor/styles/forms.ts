// Item, device and pool forms, context menu, previews, floor menu, selection frame, openings, device rows; touch sizes last.
// Part of the editor's styles (fp3d-editor static styles, #202): the slices are applied in the order editor.ts lists them.

import { css } from "lit";

export const formStyles = css`
      .fp3d-dev-area {
        margin: 10px 0 2px;
        color: var(--fp3d-muted);
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      /* the item panel (#396, #397): only the header is pinned (name, live state, Lock position, "⋯"); -12px = the
         side bar's top padding, so nothing shows above it. Position scrolls with the rest. */
      .fp3d-item-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .fp3d-item-head {
        position: sticky;
        top: -12px;
        z-index: 3;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: 4px 8px;
        background: var(--fp3d-chrome-solid);
        padding: 4px 0 8px;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .fp3d-sheet-body .fp3d-item-head {
        top: -4px;
      }
      /* the same header on every panel (#409); outside the item panel's flex column it keeps a gap under it */
      .fp3d-panel-head {
        margin-bottom: 8px;
      }
      .fp3d-item-panel > .fp3d-panel-head {
        margin-bottom: 0;
      }
      .fp3d-item-title {
        min-width: 0;
      }
      .fp3d-item-title h2 {
        margin: 0;
        font-size: 17px;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp3d-item-tools {
        display: flex;
        gap: 6px;
      }
      .fp3d-icon-btn {
        min-width: 36px;
        min-height: 36px;
        padding: 0;
        display: inline-grid;
        place-items: center;
      }
      .fp3d-live {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .fp3d-live-chip {
        padding: 2px 9px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        color: var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
      }
      .fp3d-menu-wrap {
        position: relative;
      }
      /* opens to the left of the "⋯" at the panel's right edge; beats .fp3d-ctx's plan position */
      .fp3d-ctx.fp3d-item-menu {
        left: auto;
        right: 0;
        top: calc(100% + 4px);
        z-index: 6;
      }
      .fp3d-item-menu button {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        min-height: 36px;
      }
      .fp3d-item-menu kbd {
        font: inherit;
        font-size: 11.5px;
        color: var(--fp3d-muted);
      }
      .fp3d-item-pos h3,
      .fp3d-link-block h3,
      .fp3d-fold-h {
        margin: 0;
      }
      .fp3d-pos-row {
        margin-top: 6px;
      }
      .fp3d-turn {
        grid-column: 1 / -1;
        display: flex;
        align-items: flex-end;
        gap: 6px;
      }
      .fp3d-turn > .fp3d-field {
        flex: 1 1 auto;
        min-width: 0;
      }
      .fp3d-plan-hint {
        margin: 6px 0 0;
      }
      /* the side panel is a flex column: the row keeps its own height there, so a short panel starts at the top
         (#406: "flex: 1" gave it the free height, with the back link in its middle); beside the pin it grows sideways */
      .fp3d-nav-row {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 36px;
      }
      .fp3d-pin-row > .fp3d-nav-row {
        flex: 1 1 auto;
      }
      .fp3d-nav-row .fp3d-side-fold {
        margin-left: auto;
      }
      .fp3d-crumb {
        min-height: 32px;
        padding: 0 4px;
        font-size: 13.5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* a fold: a full-width button row, at least 44 px, with its summary and badge while closed */
      .fp3d-fold {
        border-top: 1px solid var(--fp3d-line);
      }
      .fp3d-fold-btn {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
        width: 100%;
        min-height: 44px;
        padding: 6px 28px 6px 2px;
        border: 0;
        background: none;
        color: var(--fp3d-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-fold-top {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
      }
      .fp3d-fold-sum {
        font-size: 12px;
        font-weight: 400;
        color: var(--fp3d-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .fp3d-fold-chev {
        position: absolute;
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--fp3d-muted);
        transition: transform 0.15s ease;
      }
      .fp3d-fold[data-open] .fp3d-fold-chev {
        transform: translateY(-50%) rotate(90deg);
      }
      .fp3d-fold-body {
        padding-bottom: 10px;
      }
      /* a tool panel's list row (#418, A11Y-3): a 44 px button with a chevron and a selected style */
      .fp3d-pick-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 6px 0;
      }
      .fp3d-pick-row {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 1px;
        width: 100%;
        min-height: 44px;
        padding: 6px 28px 6px 10px;
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        background: none;
        color: var(--fp3d-text);
        font: inherit;
        font-size: 13.5px;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-pick-row:hover {
        background: color-mix(in srgb, var(--fp3d-accent) 8%, transparent);
      }
      .fp3d-pick-row[aria-current="true"] {
        border-color: var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 16%, transparent);
        font-weight: 600;
      }
      .fp3d-pick-sub {
        font-size: 12px;
        font-weight: 400;
        color: var(--fp3d-muted);
      }
      /* "Falls towards" (#418): the four arrows of the measure tool, left-aligned under the label */
      .fp3d-slope-dir {
        grid-column: 1 / -1;
      }
      .fp3d-slope-dir .fp3d-arrows {
        justify-content: start;
        margin-top: 4px;
      }
      .fp3d-slope-dir .fp3d-btn[aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 22%, transparent);
      }
      .fp3d-field-note {
        margin-top: -4px;
      }
      .fp3d-fold-badge {
        padding: 1px 7px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        color: var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
        text-transform: none;
        letter-spacing: 0;
      }
      /* help on demand (#412, ORDER-2): the "i" is the last thing on its field's label line (top right), its text
         under the field once opened */
      .fp3d-with-info {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: 4px 6px;
        min-width: 0;
      }
      .fp3d-with-info > :first-child {
        grid-column: 1;
        grid-row: 1;
        min-width: 0;
      }
      .fp3d-with-info > .fp3d-info {
        grid-column: 2;
        grid-row: 1;
      }
      .fp3d-with-info > .fp3d-help-text {
        grid-column: 1 / -1;
      }
      .fp3d-info {
        flex: none;
        width: 24px;
        height: 24px;
        margin: 0;
        padding: 0;
        border: 1px solid var(--fp3d-line);
        border-radius: 50%;
        background: none;
        color: var(--fp3d-muted);
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        font-style: italic;
        cursor: pointer;
      }
      .fp3d-info[aria-expanded="true"] {
        color: var(--fp3d-accent);
        border-color: var(--fp3d-accent);
      }
      .fp3d-help-text {
        flex: 1 0 100%;
        margin: 0;
      }
      /* field rules (#412): a label on one line (CUT-2), its unit inside the input as a suffix ("1.79 m") */
      .fp3d-field-label {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .fp3d-unit-box {
        position: relative;
        display: grid;
        min-width: 0;
      }
      .fp3d-unit-box > input {
        width: 100%;
        box-sizing: border-box;
        padding-right: 2.6em;
      }
      .fp3d-unit {
        position: absolute;
        right: 9px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 13px;
        color: var(--fp3d-muted);
        pointer-events: none;
      }
      /* sub-heads inside a fold are never bigger than the fold's title: label size, muted (#412, ORDER-1) */
      .fp3d-fold-body h3,
      .fp3d-fold-body h4 {
        margin: 10px 0 4px;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.3;
        letter-spacing: 0;
        text-transform: none;
        color: var(--fp3d-muted);
      }
      .fp3d-found {
        display: grid;
        gap: 2px;
        margin: 8px 0 4px;
      }
      .fp3d-found-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 13px;
      }
      .fp3d-found-row dt {
        color: var(--fp3d-muted);
      }
      .fp3d-found-row dd {
        margin: 0;
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .fp3d-found-row[data-missing] dd {
        color: var(--fp3d-muted);
      }
      /* the colour rows (#410): one full-width row per part (name, hex field, finish chip); on a narrow panel the chip
         goes under the field rather than being cut */
      .fp3d-parts {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-top: 6px;
      }
      .fp3d-parts-head h4 {
        margin: 0;
      }
      .fp3d-part-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
        min-height: 40px;
      }
      .fp3d-part-name {
        flex: 1 1 5.5em;
        min-width: 5.5em;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .fp3d-part-row .fp3d-colour-row {
        flex: none;
      }
      .fp3d-part-finish {
        flex: none;
        margin-left: auto;
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid var(--fp3d-line);
        border-radius: 7px;
        background: none;
        color: var(--fp3d-text);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      .fp3d-part-finish.fp3d-part-usual {
        color: var(--fp3d-muted);
      }
      .fp3d-part-finish[aria-expanded="true"] {
        border-color: var(--fp3d-accent);
      }
      .fp3d-part-finish:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 1px;
      }
      /* a part's popover, under its row: preset tiles (option C's), the hex field, the finish */
      .fp3d-part-pop {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 2px 0 8px;
        padding: 10px;
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        background: var(--fp3d-chrome-solid);
        box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.35);
      }
      .fp3d-part-pop-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .fp3d-tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
        gap: 6px;
      }
      .fp3d-tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        min-width: 0;
        padding: 2px;
        border: none;
        border-radius: 8px;
        background: none;
        color: var(--fp3d-muted);
        font: inherit;
        font-size: 11px;
        line-height: 1.2;
        text-align: center;
        overflow-wrap: anywhere;
        cursor: pointer;
      }
      .fp3d-tile-sw {
        display: block;
        width: 100%;
        height: 28px;
        border-radius: 6px;
        border: 1px solid var(--fp3d-line);
      }
      .fp3d-tile[aria-pressed="true"] {
        color: var(--fp3d-text);
      }
      .fp3d-tile[aria-pressed="true"] .fp3d-tile-sw {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 1px;
      }
      .fp3d-tile:focus-visible {
        outline: 2px solid var(--fp3d-accent);
      }
      .fp3d-tile:disabled,
      .fp3d-part-pop .fp3d-seg button:disabled {
        cursor: default;
        opacity: 0.6;
      }
      .fp3d-link-block {
        margin: 10px 0 4px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .fp3d-link-title {
        margin: 0 0 6px;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .fp3d-h3row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .fp3d-h3row h3 {
        margin-bottom: 0;
      }
      .fp3d-fix {
        min-height: 30px;
        padding: 4px 10px;
        font-size: 13px;
      }
      .fp3d-pipe,
      .fp3d-pipe-hit {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .fp3d-pipe {
        stroke: #37a8ff;
        stroke-width: 3;
        opacity: 0.85;
        pointer-events: none;
      }
      .fp3d-pipe-sel {
        stroke-width: 5;
        opacity: 1;
        filter: drop-shadow(0 0 4px #37a8ff);
      }
      .fp3d-pipe-draft {
        stroke-dasharray: 6 5;
      }
      .fp3d-pipe-hit {
        stroke: transparent;
        stroke-width: 16;
        cursor: pointer;
      }
      .fp3d-pipe-seg {
        stroke: transparent;
        stroke-width: 14;
        cursor: copy;
      }
      .fp3d-pipe-arrow {
        fill: #37a8ff;
        pointer-events: none;
      }
      .fp3d-pool-node {
        cursor: grab;
      }
      .fp3d-pool-node circle:not(.fp3d-hit) {
        fill: #0b1a2e;
        stroke: #37e0ff;
        stroke-width: 2;
      }
      .fp3d-pool-node.fp3d-pool-dev circle:not(.fp3d-hit) {
        stroke: #5b7cff;
      }
      .fp3d-pool-node.fp3d-pool-closed circle:not(.fp3d-hit) {
        stroke: #ff4d40;
      }
      .fp3d-pool-node text {
        fill: #e6f6ff;
        font-size: 10px;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
      }
      .fp3d-conn {
        grid-template-columns: 1fr;
      }
      .fp3d-conn select {
        width: 100%;
      }
      .fp3d-pool-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin: 4px 0;
        font-size: 13px;
      }
      .fp3d-pool-row > span,
      .fp3d-pool-row > .fp3d-link {
        flex: 1;
        text-align: left;
      }
      .fp3d-pool-row-sel {
        background: rgba(55, 224, 255, 0.1);
        border-radius: 8px;
        box-shadow: inset 3px 0 0 var(--fp3d-accent);
        padding-left: 6px;
      }
      .fp3d-outdoor-type {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--fp3d-muted);
      }
      .fp3d-outdoor-type select {
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid var(--fp3d-line, rgba(160, 200, 255, 0.25));
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        font: inherit;
        font-weight: 600;
      }
      .fp3d-fix[aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        color: var(--fp3d-accent);
      }
      .fp3d-lock {
        font-size: 13px;
        text-anchor: middle;
        pointer-events: none;
      }
      .fp3d-hint-fixed {
        color: var(--fp3d-accent);
        border-color: var(--fp3d-accent);
      }
      .fp3d-ctx {
        position: absolute;
        z-index: 5;
        display: flex;
        flex-direction: column;
        min-width: 170px;
        padding: 4px;
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        background: var(--fp3d-panel, #111a2e);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      }
      .fp3d-ctx button {
        padding: 8px 12px;
        border: none;
        border-radius: 7px;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-ctx button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--fp3d-accent) 16%, transparent);
      }
      .fp3d-ctx button:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .fp3d-ctx-danger {
        color: var(--fp3d-danger, #ff6b7a) !important;
      }
      .fp3d-edge-hi {
        stroke: var(--fp3d-accent);
        stroke-width: 6;
        stroke-linecap: round;
        filter: drop-shadow(0 0 6px var(--fp3d-accent));
      }
      .fp3d-room-id code {
        user-select: all;
        cursor: copy;
      }
      .fp3d-open .fp3d-open-hit {
        stroke: transparent;
        stroke-width: 26;
      }
      .fp3d-free-wall .fp3d-hit {
        stroke: transparent;
        stroke-width: 18;
      }
      .fp3d-free-wall-line {
        stroke: transparent;
        stroke-width: 1;
      }
      .fp3d-free-wall-sel .fp3d-free-wall-line {
        stroke: var(--fp3d-accent);
        stroke-width: 2;
        stroke-dasharray: 6 4;
      }
      .fp3d-draft-wall {
        stroke-width: 4;
      }
      .fp3d-open-passage {
        stroke-dasharray: 4 4;
      }
      .fp3d-out-sel polygon {
        stroke: var(--fp3d-accent);
        stroke-width: 2;
        stroke-dasharray: none;
      }
      .fp3d-out text {
        fill: var(--fp3d-muted);
        font-size: 11px;
        text-anchor: middle;
        pointer-events: none;
      }
      .fp3d-furn-lit .fp3d-furn-body {
        fill: rgba(255, 181, 71, 0.35);
        stroke: var(--fp3d-warm);
      }
      .fp3d-rotate {
        cursor: grab;
      }
      .fp3d-preview {
        position: fixed;
        z-index: 20;
        width: 180px;
        padding: 8px 8px 10px;
        border-radius: 16px;
        background: radial-gradient(circle at 50% 40%, #1d2c4d, #0b1222 75%);
        box-shadow: var(--fp3d-shadow), 0 0 0 1px var(--fp3d-line);
        text-align: center;
        pointer-events: none;
        animation: fp3d-pop 120ms ease-out;
      }
      @keyframes fp3d-pop {
        from {
          opacity: 0;
          transform: translateX(8px);
        }
      }
      .fp3d-preview img,
      .fp3d-preview-wait {
        display: block;
        width: 164px;
        height: 164px;
      }
      .fp3d-preview-wait {
        margin: 0 auto;
        border-radius: 12px;
        background: rgba(127, 127, 127, 0.1);
      }
      .fp3d-preview b {
        display: block;
        margin-top: 2px;
        font-size: 13px;
        color: #e8eeff;
      }
      .fp3d-lib-badge {
        margin-left: 4px;
        color: #37e0ff;
        vertical-align: -2px;
      }
      .fp3d-ext-teaser {
        display: grid;
        gap: 6px;
        margin: 12px 0;
        padding: 12px;
        border: 1px solid var(--fp3d-accent);
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(55, 224, 255, 0.08), rgba(91, 124, 255, 0.08));
      }
      .fp3d-pin {
        border: 0;
        background: none;
        padding: 2px 6px;
        min-width: 36px;
        min-height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        line-height: 1;
        color: var(--fp3d-muted);
        cursor: pointer;
      }
      .fp3d-dev-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        margin: 0 0 8px;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .fp3d-dev-legend span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .fp3d-pin-on {
        color: var(--fp3d-warm);
      }
      .fp3d-back {
        margin-bottom: 12px;
      }
      .fp3d-presets {
        /* a fixed grid: the chips keep their places whichever kind is picked (#63) */
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        margin-bottom: 10px;
      }
      .fp3d-presets .fp3d-chip {
        min-height: 40px;
        padding: 3px 4px;
        line-height: 1.2;
        overflow-wrap: anywhere;
      }
      .fp3d-resize {
        cursor: nwse-resize;
      }
      .fp3d-resize rect {
        fill: var(--fp3d-accent);
        stroke: #0b1222;
        stroke-width: 1.5;
      }
      .fp3d-code {
        display: block;
        font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace;
        padding: 6px 8px;
        border-radius: 8px;
        background: rgba(127, 127, 127, 0.12);
        user-select: all;
        word-break: break-all;
      }
      .fp3d-shift {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .fp3d-shift > span {
        flex: 1 0 100%;
        font-size: 13px;
        font-weight: 600;
      }
      /* X and Z side by side on one row, the Shift button after them (#236) */
      .fp3d-shift-xz {
        flex: 1 0 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .fp3d-shift-xz input {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }
      .fp3d-headroom {
        stroke: rgba(255, 214, 90, 0.55);
        stroke-width: 1;
        stroke-dasharray: 6 4;
        pointer-events: none;
      }
      .fp3d-headroom-label {
        font-size: 10px;
        fill: rgba(255, 214, 90, 0.75);
        text-anchor: middle;
        pointer-events: none;
      }
      .fp3d-split-mark {
        stroke: rgba(55, 224, 255, 0.9);
        stroke-width: 2;
        pointer-events: none;
      }
      .fp3d-floor-menu {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 8px 0;
        padding: 10px;
        border-radius: 12px;
        background: rgba(127, 127, 127, 0.1);
        max-width: 100%;
        box-sizing: border-box;
      }
      .fp3d-icon-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .fp3d-icon-row input {
        flex: 1;
        min-width: 0;
      }
      .fp3d-icon-row ha-icon {
        --mdc-icon-size: 22px;
        color: var(--fp3d-accent);
      }
      .fp3d-floor-menu .fp3d-btn {
        text-align: left;
        width: 100%;
        min-width: 0;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .fp3d-rotate line {
        stroke: var(--fp3d-accent);
        stroke-dasharray: 3 3;
      }
      .fp3d-rotate circle:not(.fp3d-hit) {
        fill: #0b1222;
        stroke: var(--fp3d-accent);
        stroke-width: 2;
      }
      .fp3d-rotate path {
        fill: none;
        stroke: var(--fp3d-accent);
        stroke-width: 1.5;
        stroke-linecap: round;
      }
      .fp3d-lib-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 6px 0;
        border: 0;
        background: none;
        font: inherit;
        cursor: pointer;
        text-align: left;
      }
      .fp3d-lib-toggle:hover {
        color: var(--fp3d-text);
      }
      .fp3d-lib-caret {
        width: 12px;
        color: var(--fp3d-accent);
      }
      .fp3d-lib-count {
        margin-left: auto;
        font-weight: 500;
        letter-spacing: 0;
        text-transform: none;
        opacity: 0.7;
      }
      .fp3d-lib-head {
        margin: 10px 0 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .fp3d-furn-front {
        stroke: var(--fp3d-accent);
        stroke-width: 2.5;
        vector-effect: non-scaling-stroke;
        opacity: 0.8;
        pointer-events: none;
      }
      .fp3d-furn text {
        fill: var(--fp3d-muted);
        font-size: 11px;
        text-anchor: middle;
        pointer-events: none;
      }
      .fp3d-furn .fp3d-lbl-off {
        display: none;
      }
      .fp3d-furn:hover .fp3d-lbl-off {
        display: inline;
      }
      .fp3d-furn-ghost {
        opacity: 0.35;
      }
      /* "When it shows" sits below the help paragraph before it, not against it (#344) */
      details.fp3d-when-section {
        margin-top: 16px;
      }
      .fp3d-furn-sel .fp3d-furn-body {
        fill: rgba(55, 224, 255, 0.16);
        stroke: var(--fp3d-accent);
        stroke-width: 2;
      }
      /* furniture blocks and multi selections: a dashed frame with its name, the frame being drawn */
      .fp3d-selframe rect {
        fill: none;
        stroke: var(--fp3d-accent);
        stroke-width: 1.5;
        stroke-dasharray: 6 4;
        pointer-events: none;
      }
      .fp3d-selframe-block rect {
        stroke: #ffb547;
      }
      .fp3d-selframe text {
        fill: var(--fp3d-accent);
        font-size: 11px;
        font-weight: 600;
        pointer-events: none;
      }
      .fp3d-selframe-block text {
        fill: #ffb547;
      }
      .fp3d-marquee {
        fill: rgba(55, 224, 255, 0.08);
        stroke: var(--fp3d-accent);
        stroke-width: 1;
        stroke-dasharray: 4 3;
        pointer-events: none;
      }
      .fp3d-block-parts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 6px 0 10px;
      }
      .fp3d-block-note {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .fp3d-multi-toggle {
        margin-top: 8px;
      }
      .fp3d-open {
        cursor: grab;
      }
      .fp3d-open-gap {
        fill: #0b1222;
        stroke: none;
      }
      .fp3d-open path,
      .fp3d-open line {
        fill: none;
        stroke-width: 1.6;
        stroke-linecap: round;
      }
      .fp3d-open-door path {
        stroke: var(--fp3d-warm);
        stroke-dasharray: 3 3;
      }
      .fp3d-open .fp3d-open-swing {
        pointer-events: stroke;
      }
      .fp3d-open-door line.fp3d-open-leaf {
        stroke-width: 2;
      }
      .fp3d-open-front line.fp3d-open-leaf {
        stroke-width: 3;
      }
      .fp3d-open-front path,
      .fp3d-open-door line {
        stroke: var(--fp3d-warm);
        stroke-width: 3;
        stroke-dasharray: none;
      }
      .fp3d-open-door line.fp3d-open-pane {
        stroke: var(--fp3d-accent);
        stroke-width: 2;
      }
      .fp3d-open-garage line {
        stroke: var(--fp3d-warm);
        stroke-width: 3;
      }
      .fp3d-open-track {
        stroke: var(--fp3d-warm);
        stroke-dasharray: 4 4;
        opacity: 0.6;
      }
      .fp3d-open-window line {
        stroke: var(--fp3d-accent);
        stroke-width: 2;
      }
      .fp3d-open-sel .fp3d-open-gap {
        fill: rgba(55, 224, 255, 0.35);
      }
      .fp3d-open-ring {
        fill: none;
        stroke: var(--fp3d-accent);
        stroke-width: 2;
        stroke-dasharray: 5 3;
        pointer-events: none;
      }
      .fp3d-open-sel path,
      .fp3d-open-sel line {
        stroke-width: 2.4;
      }
      .fp3d-bg-rotate {
        cursor: grab;
      }
      .fp3d-bg-ruler line {
        stroke: #ffb020;
        stroke-width: 2.5;
        stroke-dasharray: 6 4;
      }
      .fp3d-bg-ruler circle {
        fill: #ffb020;
        stroke: #1a1000;
        stroke-width: 1.5;
      }
      /* the up, down and remove buttons of a reorderable Settings list: a fixed column at the right (#326) */
      .fp3d-row.fp3d-ord-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
      }
      .fp3d-ord-row .fp3d-dev-name {
        min-width: 0;
      }
      .fp3d-ord-row .fp3d-dev-name span {
        white-space: nowrap;
      }
      .fp3d-ord {
        display: inline-grid;
        grid-template-columns: repeat(3, 32px);
        gap: 2px;
        justify-self: end;
      }
      .fp3d-ord-v {
        grid-template-columns: 32px;
        align-self: start;
        padding-top: 10px;
      }
      .fp3d-ord-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: start;
        grid-auto-flow: dense;
      }
      .fp3d-ord-card > .fp3d-ord {
        grid-column: 2;
        grid-row: 1;
      }
      .fp3d-ord-card > .fp3d-form {
        grid-column: 1;
        grid-row: 1;
        min-width: 0;
      }
      .fp3d-ord-btn {
        width: 32px;
        height: 32px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--fp3d-muted);
        background: none;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
      }
      .fp3d-ord-btn:hover:not(:disabled) {
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.08);
      }
      .fp3d-ord-btn:disabled {
        opacity: 0.3;
        cursor: default;
      }
      .fp3d-ord-remove:hover:not(:disabled) {
        color: #ff6b6b;
      }
      .fp3d-bin-kerb {
        padding: 10px;
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
      }
      .fp3d-bin-kerb .fp3d-kerb-btn {
        border-color: var(--fp3d-accent);
      }
      .fp3d-bin-kerb.fp3d-kerb-picking {
        border-color: var(--fp3d-accent);
        background: rgba(55, 224, 255, 0.08);
      }
      .fp3d-own-button {
        padding: 10px 0;
        border-top: 1px solid var(--fp3d-line);
      }
      .fp3d-own-button textarea {
        font: 12px/1.4 ui-monospace, monospace;
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
      }
      .fp3d-search {
        position: sticky;
        top: 0;
        z-index: 2;
        background-color: var(--fp3d-chrome-solid);
        width: 100%;
        box-sizing: border-box;
        font: inherit;
        font-size: 14px;
        color: var(--fp3d-text);
        /* opaque: the rows scrolling under it must not show through (#262) */
        background: linear-gradient(rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.04)), var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        padding: 7px 9px;
        margin: 0 0 6px;
        box-shadow: 0 -8px 0 var(--fp3d-chrome-solid), 0 6px 0 var(--fp3d-chrome-solid);
      }
      .fp3d-dev-all {
        display: block;
        padding: 2px 26px 6px;
        font-size: 12px;
      }
      .fp3d-more {
        font: inherit;
        font-size: 12px;
        color: var(--fp3d-muted);
        background: none;
        border: none;
        text-align: left;
        padding: 2px 26px 8px;
        cursor: pointer;
      }
      .fp3d-more:hover {
        color: var(--fp3d-accent);
      }
      .fp3d-dev-hidden .fp3d-dev-name {
        opacity: 0.45;
        text-decoration: line-through;
      }
      .fp3d-dev-extra {
        padding-left: 18px;
        font-size: 13px;
      }
      .fp3d-dev-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 8px;
        font-weight: 600;
      }
      .fp3d-notice {
        color: var(--fp3d-accent);
      }
      .fp3d-resize-note {
        margin: 0 0 10px;
        padding: 6px 10px;
        border: 1px solid var(--fp3d-accent);
        border-radius: 8px;
      }
      .fp3d-resize-note p {
        margin: 4px 0;
        color: var(--fp3d-accent);
      }
      .fp3d-device-sel circle:not(.fp3d-hit) {
        stroke: var(--fp3d-accent);
        stroke-width: 3;
      }
      /* roaming pets (#337): the numbers on the open pet's places, and its panel's rows */
      .fp3d-pet-n {
        font: 700 11px system-ui, sans-serif;
        fill: var(--fp3d-accent);
        pointer-events: none;
      }
      .fp3d-dev-row {
        align-items: center;
        cursor: default;
      }
      /* an unplaced entity is dragged onto the plan (#83) */
      .fp3d-unplaced-row {
        cursor: grab;
      }
      .fp3d-unplaced-row .fp3d-dev-name {
        flex: 1;
        min-width: 0;
      }
      .fp3d-room-btn {
        flex: 1;
        min-width: 0;
        border-bottom: none;
        padding: 0;
      }
      .fp3d-dev-row:hover {
        color: var(--fp3d-text);
      }
      .fp3d-dev-name {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        font: inherit;
        color: inherit;
        background: none;
        border: none;
        padding: 0;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-dev-name:disabled {
        cursor: default;
      }
      .fp3d-dev-name span {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp3d-dev-name svg {
        flex: none;
      }
      .fp3d-link {
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--fp3d-accent);
        background: none;
        border: none;
        padding: 4px 2px;
        cursor: pointer;
        white-space: nowrap;
      }
      .fp3d-wide-btn {
        width: 100%;
        margin-bottom: 6px;
      }
      .fp3d-device {
        cursor: grab;
      }
      .fp3d-device circle:not(.fp3d-hit) {
        fill: #111a2e;
        stroke: var(--fp3d-soft);
        stroke-width: 1.5;
        vector-effect: non-scaling-stroke;
      }
      .fp3d-device path {
        fill: none;
        stroke: var(--fp3d-text);
        stroke-width: 2.6;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .fp3d-device-on circle:not(.fp3d-hit) {
        fill: var(--fp3d-warm);
        stroke: var(--fp3d-warm);
      }
      .fp3d-device-on path {
        stroke: #2a1a00;
      }
      .fp3d-muted {
        color: var(--fp3d-muted);
        font-variant-numeric: tabular-nums;
      }
      .fp3d-points {
        margin: 12px 0;
      }
      .fp3d-point {
        display: grid;
        grid-template-columns: 18px 1fr 1fr auto;
        gap: 6px;
        align-items: end;
        padding: 4px 0;
      }
      .fp3d-point-sel .fp3d-muted {
        color: var(--fp3d-accent);
      }
      .fp3d-point .fp3d-btn {
        min-height: 34px;
        padding: 4px 10px;
      }
      .fp3d-upload {
        position: relative;
        text-align: center;
        overflow: hidden;
      }
      .fp3d-upload input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
      .fp3d-sub {
        margin: 8px 0 0;
        font-size: 12.5px;
        color: var(--fp3d-muted);
      }
      .fp3d-note {
        margin: 0;
        font-size: 12.5px;
        color: var(--fp3d-warm);
      }
      /* phones: the phone editor (#250) has its own layout, styles/phone.ts */

      /* touch screens (#181): the editor's small buttons and selects reach 44 px */
      @media (pointer: coarse) {
        .fp3d-fix,
        .fp3d-3d-fold,
        .fp3d-wv-kit .fp3d-wv-pick,
        .fp3d-outdoor-type select,
        .fp3d-point .fp3d-btn,
        .fp3d-seg .fp3d-menu-sub .fp3d-chip,
        .fp3d-presets .fp3d-chip,
        .fp3d-settings-link,
        .fp3d-icon-btn,
        .fp3d-crumb,
        .fp3d-part-row,
        .fp3d-part-finish,
        .fp3d-tile {
          min-height: 44px;
        }
        .fp3d-icon-btn,
        .fp3d-info {
          min-width: 44px;
        }
        .fp3d-info {
          height: 44px;
          margin-bottom: 0;
          border-radius: 22px;
        }
        .fp3d-pin {
          min-width: 44px;
          min-height: 44px;
        }
        .fp3d-ord {
          grid-template-columns: repeat(3, 44px);
        }
        .fp3d-ord-v {
          grid-template-columns: 44px;
        }
        .fp3d-ord-btn {
          width: 44px;
          height: 44px;
        }
        .fp3d-more-btn,
        .fp3d-wv-zoom .fp3d-btn,
        .fp3d-strip-btn {
          min-width: 44px;
          min-height: 44px;
        }
      }
`;
