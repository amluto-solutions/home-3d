// The editor's frame: host, settings links, layout, side strip, toolbar, picture rules, the 3D pane and the canvas.
// Part of the editor's styles (fp3d-editor static styles, #202): the slices are applied in the order editor.ts lists them.

import { css } from "lit";

export const shellStyles = css`
      :host {
        display: block;
        height: 100%;
      }
      /* a house-wide setting's way to the Settings page (#139), in a tool panel or an item form */
      .fp3d-settings-link {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 4px 10px;
        width: 100%;
        min-height: 40px;
        margin: 6px 0;
        padding: 8px 12px;
        border: 1px dashed var(--fp3d-line);
        border-radius: 10px;
        background: none;
        color: var(--fp3d-muted);
        font: inherit;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-settings-link b {
        color: var(--fp3d-accent);
        font-weight: 600;
        white-space: nowrap;
      }
      .fp3d-settings-link:hover {
        border-color: var(--fp3d-accent);
      }
      /* a part on the Settings page (#139): its row already names it */
      .fp3d-embed summary,
      .fp3d-embed > .fp3d-wide > h4.fp3d-lib-head:first-child,
      .fp3d-embed > .fp3d-wide > h4.fp3d-lib-head:first-child + .fp3d-sub,
      .fp3d-embed > section > h3:first-child,
      .fp3d-embed > section > h3:first-child + .fp3d-sub,
      .fp3d-embed > h4:first-child,
      .fp3d-embed > h4:first-child + .fp3d-sub {
        display: none;
      }
      .fp3d-embed details.fp3d-section {
        border: 0;
        padding: 0;
        margin: 0;
        background: none;
      }
      /* the toolbar is one row across the plan and the sidebar (#249); the plan and the sidebar share the row below */
      .fp3d-editor {
        position: relative;
        display: grid;
        grid-template-columns: 1fr var(--fp3d-side-w, 320px);
        grid-template-rows: auto minmax(0, 1fr);
        height: 100%;
        min-height: 0;
      }
      .fp3d-editor > .fp3d-toolbar {
        grid-column: 1 / -1;
      }
      .fp3d-editor:has(> .fp3d-side-strip) {
        grid-template-columns: 1fr 52px;
      }
      .fp3d-side-strip {
        padding: 10px 6px;
        gap: 8px;
        align-items: center;
      }
      .fp3d-strip-btn {
        width: 40px;
        height: 40px;
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        font-size: 18px;
        cursor: pointer;
      }
      .fp3d-strip-hot {
        border-color: var(--fp3d-accent);
        color: var(--fp3d-accent);
      }
      .fp3d-side-overlay {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(var(--fp3d-side-w, 340px), 60%);
        /* open over the 3D pane, under the toolbar row (#249: More and Fit stay in reach) */
        top: var(--fp3d-toolbar-h, 52px);
        z-index: 30;
        box-shadow: -12px 0 32px rgba(0, 0, 0, 0.45);
      }
      .fp3d-pin-row {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      /* the side panel moves by its header or navigation row (#421), like the View panel: a moved panel floats over
         the plan (which then takes the whole width), its place a translate from where it docks */
      .fp3d-drag-handle {
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      .fp3d-drag-handle:active {
        cursor: grabbing;
      }
      aside.fp3d-side[data-floating] {
        position: absolute;
        top: var(--fp3d-toolbar-h, 52px);
        right: 8px;
        bottom: auto;
        width: min(var(--fp3d-side-w, 320px), calc(100% - 16px));
        max-height: calc(100% - var(--fp3d-toolbar-h, 52px) - 16px);
        border: 1px solid var(--fp3d-line);
        border-radius: 14px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
        z-index: 30;
      }
      .fp3d-editor:has(> aside.fp3d-side[data-floating]:not(.fp3d-side-overlay)) {
        grid-template-columns: 1fr;
      }
      /* while the panel is dragged the plan and the 3D pane beside it do not take the pointer */
      :host([data-panel-drag]) .fp3d-stage-pair {
        pointer-events: none;
      }
      .fp3d-3d-size {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--fp3d-muted);
        font-size: 12px;
      }
      .fp3d-3d-size input {
        width: 58px;
        padding: 4px 6px;
        font: inherit;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
      }
      .fp3d-3d-select {
        font: inherit;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        padding: 4px 10px;
      }
      .fp3d-editor.fp3d-narrow {
        grid-template-columns: 1fr;
        grid-template-rows: auto minmax(360px, 62vh) auto;
        height: auto;
      }
      .fp3d-main {
        /* nothing of the plan column reaches over the sidebar (its menus still hang down) */
        overflow-x: clip;
        display: grid;
        grid-template-rows: minmax(0, 1fr);
        /* the column never grows with a wide toolbar (that would push the plan under the sidebar) */
        grid-template-columns: minmax(0, 1fr);
        min-height: 0;
        min-width: 0;
      }
      .fp3d-toolbar {
        position: relative;
        /* its menus open over the plan below */
        z-index: 20;
        display: flex;
        /* one row; only a long tool name on a compact screen may push the end onto a second */
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        min-width: 0;
        min-height: var(--fp3d-toolbar-h, 52px);
        box-sizing: border-box;
        padding: 6px 12px;
        border-bottom: 1px solid var(--fp3d-line);
        background: var(--fp3d-chrome-solid);
      }
      /* the drawn toolbar (#249): flat buttons with an icon and a label, hairlines between the groups; the tool in use
         has a light tint, not a fill; Fit, 3D beside and More are outlined at the end of the row */
      .fp3d-toolbar > .fp3d-seg {
        background: none;
        box-shadow: none;
        padding: 0;
        flex: none;
      }
      .fp3d-toolbar > .fp3d-seg > button,
      .fp3d-toolbar .fp3d-menu-wrap > button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: var(--fp3d-radius-control, 6px);
        color: var(--fp3d-text);
        font-weight: 600;
        padding: 6px 10px;
      }
      .fp3d-toolbar > .fp3d-seg > button[aria-pressed="true"],
      .fp3d-toolbar .fp3d-menu-wrap > button[aria-pressed="true"] {
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
        color: var(--fp3d-accent);
      }
      .fp3d-toolbar > .fp3d-seg > button:hover:not(:disabled),
      .fp3d-toolbar .fp3d-menu-wrap > button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--fp3d-accent) 8%, transparent);
      }
      .fp3d-seg-views > button,
      .fp3d-seg-more .fp3d-menu-wrap > button,
      .fp3d-seg-floor .fp3d-menu-wrap > button {
        border: 1px solid var(--fp3d-line);
      }
      .fp3d-seg-more .fp3d-menu-wrap > button[aria-expanded="true"] {
        border-color: var(--fp3d-accent);
      }
      .fp3d-seg-views {
        gap: 6px;
      }
      .fp3d-tb-sep {
        flex: none;
        width: 1px;
        height: 26px;
        background: var(--fp3d-line);
      }
      .fp3d-tb-grow {
        flex: 1 1 0;
      }
      /* 3D beside: in the row on wide screens, in More below that (#249) */
      .fp3d-more-split {
        display: none !important;
      }
      @media (max-width: 1024px) {
        .fp3d-toolbar {
          gap: 3px;
          padding: 6px 6px;
        }
        .fp3d-toolbar > .fp3d-seg > button,
        .fp3d-toolbar .fp3d-menu-wrap > button {
          padding: 5px 8px;
          font-size: 13px;
        }
        .fp3d-seg-undo .fp3d-tool-word,
        .fp3d-toolbar .fp3d-menu-label,
        .fp3d-tb-sep {
          display: none;
        }
        .fp3d-split-btn {
          display: none !important;
        }
        .fp3d-more-split {
          display: flex !important;
        }
      }
      /* the toolbar row, while it is drawn below the compact width, scrolls rather than pushing the page wider */
      @media (min-width: 601px) and (max-width: 1024px) {
        .fp3d-toolbar .fp3d-seg-tools > button .fp3d-ui-icon,
        .fp3d-toolbar .fp3d-seg-tools .fp3d-menu-wrap > button .fp3d-ui-icon {
          display: none;
        }
      }
      /* "Settings for this home" on the floor's page (#249): the old ⚙ menu's places, each a link */
      .fp3d-home-link-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
      }
      .fp3d-home-link {
        min-height: 32px;
      }
      .fp3d-pick-tip {
        position: absolute;
        z-index: 5;
        transform: translateX(-50%);
        white-space: nowrap;
        padding: 8px 12px;
        border-radius: 10px;
        background: var(--fp3d-accent);
        color: var(--fp3d-accent-text);
        font-weight: 700;
        font-size: 13px;
        box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45), 0 0 16px rgba(55, 224, 255, 0.45);
        cursor: pointer;
        animation: fp3d-tip-in 0.18s ease-out;
      }
      .fp3d-pick-tip::before {
        content: "";
        position: absolute;
        left: 50%;
        top: -6px;
        margin-left: -6px;
        border: 6px solid transparent;
        border-top: 0;
        border-bottom-color: var(--fp3d-accent);
      }
      @keyframes fp3d-tip-in {
        from {
          opacity: 0;
          transform: translate(-50%, -4px);
        }
      }
      /* the tool row scrolls sideways when it is wider than the plan (it must never push into the sidebar) */
      .fp3d-toolbar > .fp3d-seg {
        max-width: 100%;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .fp3d-toolbar > .fp3d-seg::-webkit-scrollbar {
        display: none;
      }
      .fp3d-toolbar > .fp3d-seg > button {
        flex: none;
      }
      .fp3d-warn {
        color: var(--fp3d-warm);
        font-size: 12.5px;
      }
      .fp3d-picture-group {
        display: grid;
        gap: 6px;
        margin: 6px 0 10px;
        padding: 8px;
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
      }
      .fp3d-picture-group > select {
        min-width: 0;
      }
      .fp3d-picture-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 6px;
        align-items: center;
        padding: 6px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--fp3d-line) 40%, transparent);
      }
      .fp3d-picture-row input[type="url"] {
        grid-column: 1 / -1;
        min-width: 0;
      }
      .fp3d-picture-row > .fp3d-sub,
      .fp3d-picture-row > .fp3d-picture-camera {
        grid-column: 1 / -1;
      }
      .fp3d-picture-row.fp3d-rule-hit {
        outline: 1px solid var(--fp3d-accent);
      }
      .fp3d-rule-now {
        grid-column: 1 / -1;
      }
      .fp3d-rule-hit {
        color: var(--fp3d-accent);
      }
      .fp3d-picture-reuse {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .fp3d-picture-reuse-btn {
        padding: 2px;
        border: 1px solid var(--fp3d-line);
        border-radius: 6px;
        background: var(--fp3d-chrome-solid);
        cursor: pointer;
      }
      .fp3d-picture-reuse-btn img {
        display: block;
        height: 28px;
        max-width: 60px;
        object-fit: contain;
      }
      .fp3d-picture-reuse-btn:hover {
        border-color: var(--fp3d-accent);
      }
      .fp3d-picture-thumb {
        max-height: 60px;
        max-width: 100%;
        border-radius: 6px;
        justify-self: start;
      }
      .fp3d-picture-pick {
        justify-self: start;
      }
      .fp3d-parking-row {
        display: flex;
        gap: 6px;
        align-items: center;
        margin: 4px 0;
      }
      .fp3d-parking-row input,
      .fp3d-parking-row select {
        flex: 1;
        min-width: 0;
      }
      .fp3d-stage-pair {
        display: flex;
        min-height: 0;
        min-width: 0;
      }
      .fp3d-stage-pair > .fp3d-canvas-wrap {
        flex: 1 1 var(--fp3d-split, 55%);
        min-width: 0;
      }
      .fp3d-split > .fp3d-canvas-wrap {
        flex: 0 0 var(--fp3d-split, 55%);
      }
      .fp3d-split-handle {
        flex: 0 0 8px;
        cursor: col-resize;
        background: var(--fp3d-line);
        touch-action: none;
      }
      .fp3d-split-handle:hover {
        background: var(--fp3d-accent);
      }
      .fp3d-editor-3d {
        position: relative;
        overflow: hidden;
        flex: 1 1 0;
        min-width: 240px;
        min-height: 0;
        border-left: 1px solid var(--fp3d-line);
        container-type: size;
        container-name: fp3d;
      }
      .fp3d-editor-3d fp3d-view3d {
        display: block;
        height: 100%;
      }
      /* folds the 3D pane away (the choice is remembered like the toolbar's "3D beside", #91) */
      .fp3d-3d-fold {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 3;
        min-height: 32px;
        padding: 4px 12px;
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        background: var(--fp3d-chrome);
        color: inherit;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .fp3d-3d-fold:hover,
      .fp3d-3d-fold:focus-visible {
        border-color: var(--fp3d-accent);
      }
      .fp3d-3d-walls {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 3;
      }
      .fp3d-3d-bar {
        position: absolute;
        left: 50%;
        bottom: 12px;
        transform: translateX(-50%);
        z-index: 3;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        max-width: calc(100% - 24px);
        padding: 6px 8px 6px 14px;
        border-radius: 999px;
        background: var(--fp3d-chrome);
        box-shadow: var(--fp3d-shadow);
        font-size: 13px;
      }
      .fp3d-danger-chip {
        color: var(--fp3d-danger, #ff6b7a);
      }
      .fp3d-narrow .fp3d-stage-pair.fp3d-split {
        flex-direction: column;
      }
      .fp3d-narrow .fp3d-split > .fp3d-canvas-wrap {
        flex: 1 1 auto;
      }
      .fp3d-narrow .fp3d-editor-3d {
        flex: 0 0 42%;
        min-width: 0;
        border-left: none;
        border-top: 1px solid var(--fp3d-line);
      }
      .fp3d-canvas-wrap {
        position: relative;
        min-height: 0;
        overflow: hidden;
        background: radial-gradient(ellipse at 50% 35%, var(--fp3d-bg2), var(--fp3d-bg) 75%);
      }
`;
