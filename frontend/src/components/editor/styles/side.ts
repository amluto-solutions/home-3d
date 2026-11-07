// The side panel: grip, headings, lists, form rows, meters, arrows, the library, item symbols, rack cards, outdoor areas.
// Part of the editor's styles (fp3d-editor static styles, #202): the slices are applied in the order editor.ts lists them.

import { css } from "lit";

export const sideStyles = css`
      .fp3d-side-grip {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 8px;
        cursor: col-resize;
        touch-action: none;
        z-index: 2;
      }
      .fp3d-side-grip:hover {
        background: linear-gradient(90deg, rgba(55, 224, 255, 0.35), transparent);
      }
      .fp3d-side {
        border-left: 1px solid var(--fp3d-line);
        background: var(--fp3d-chrome-solid);
        overflow-y: auto;
        padding: 12px 14px 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        min-height: 0;
      }
      /* the grip's containing block; the overlay keeps its absolute position (#658: "position: relative" on
         every side bar made the unpinned bar a third grid cell, which pushed the plan and the 3D pane aside) */
      .fp3d-side:not(.fp3d-side-overlay) {
        position: relative;
        z-index: 7;
      }
      .fp3d-narrow .fp3d-side {
        border-left: none;
        border-top: 1px solid var(--fp3d-line);
      }
      h3,
      summary {
        margin: 0 0 8px;
        font-size: 11.5px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--fp3d-muted);
        font-weight: 600;
      }
      summary {
        cursor: pointer;
        margin: 0;
      }
      details[open] > summary {
        margin-bottom: 8px;
      }
      summary:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 2px;
      }
      .fp3d-floor-list,
      /* align and distribute buttons of the multi-selection panel (#235) */
      .fp3d-align {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .fp3d-align-head {
        flex: 0 0 100%;
        font-size: 12px;
        font-weight: 600;
        opacity: 0.75;
      }
      .fp3d-align-txt {
        display: none;
      }
      .fp3d-align-btn {
        display: grid;
        place-items: center;
        min-width: 40px;
        min-height: 40px;
        padding: 0;
      }
      @media (pointer: coarse) {
        .fp3d-align-btn {
          flex: 1 1 45%;
          grid-auto-flow: column;
          justify-content: start;
          gap: 8px;
          padding: 0 10px;
          text-align: left;
          font-size: 13px;
        }
        .fp3d-align-txt {
          display: inline;
        }
      }
      .fp3d-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .fp3d-floor-list .fp3d-chip {
        box-shadow: none;
        border: 1px solid var(--fp3d-line);
      }
      .fp3d-form {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 10px;
      }
      .fp3d-wide {
        grid-column: 1 / -1;
      }
      .fp3d-room-list {
        display: grid;
        gap: 2px;
      }
      .fp3d-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font: inherit;
        color: var(--fp3d-text);
        background: none;
        border: none;
        border-bottom: 1px solid var(--fp3d-line);
        padding: 9px 2px;
        cursor: pointer;
        text-align: left;
      }
      .fp3d-row:hover {
        color: var(--fp3d-accent);
      }
      /* a check box is a switch row (#412, A11Y-1): the text, then the switch at the end; the whole row is the target,
         32 px high with a mouse, 44 px on touch (below) */
      .fp3d-check {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 32px;
        font-size: 13px;
        color: var(--fp3d-muted);
        cursor: pointer;
      }
      .fp3d-check.fp3d-indent {
        padding-left: 22px;
      }
      .fp3d-check input {
        accent-color: var(--fp3d-accent);
      }
      .fp3d-check > input[type="checkbox"] {
        order: 2;
        flex: none;
        appearance: none;
        -webkit-appearance: none;
        position: relative;
        width: 36px;
        height: 20px;
        margin: 0;
        border-radius: 999px;
        background: var(--fp3d-line);
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .fp3d-check > input[type="checkbox"]::before {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--fp3d-text);
        transition: transform 0.15s ease;
      }
      .fp3d-check > input[type="checkbox"]:checked {
        background: var(--fp3d-accent);
      }
      .fp3d-check > input[type="checkbox"]:checked::before {
        transform: translateX(16px);
        background: var(--fp3d-chrome-solid);
      }
      .fp3d-check > input[type="checkbox"]:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 2px;
      }
      .fp3d-check > input[type="checkbox"]:disabled {
        opacity: 0.45;
        cursor: default;
      }
      @media (pointer: coarse) {
        .fp3d-check {
          min-height: 44px;
        }
      }
      .fp3d-meter rect {
        fill: #2a2a10;
        stroke: #ffc633;
        stroke-width: 1.5;
      }
      .fp3d-meter path {
        fill: #ffc633;
      }
      .fp3d-packages {
        display: grid;
        gap: 6px;
        margin-top: 10px;
      }
      .fp3d-packages .fp3d-btn {
        display: grid;
        text-align: left;
        gap: 2px;
      }
      .fp3d-packages .fp3d-btn span {
        font-weight: 400;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .fp3d-arrows {
        display: grid;
        grid-template-columns: repeat(3, 52px);
        grid-template-areas: ". up ." "left . right" ". down .";
        gap: 6px;
        justify-content: center;
      }
      .fp3d-arrows .fp3d-btn {
        height: 40px;
        font-size: 20px;
        padding: 0;
      }
      @media (pointer: coarse) {
        .fp3d-arrows {
          grid-template-columns: repeat(3, var(--fp3d-touch, 44px));
        }
        .fp3d-arrows .fp3d-btn {
          min-width: var(--fp3d-touch, 44px);
          height: var(--fp3d-touch, 44px);
        }
      }
      .fp3d-arrow-up {
        grid-area: up;
      }
      .fp3d-arrow-left {
        grid-area: left;
      }
      .fp3d-arrow-right {
        grid-area: right;
      }
      .fp3d-arrow-down {
        grid-area: down;
      }
      .fp3d-measure-list {
        margin: 8px 0;
        padding-left: 22px;
        max-height: 120px;
        overflow-y: auto;
        color: var(--fp3d-muted);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      }
      /* the measure tool owns the side panel (#301) */
      .fp3d-measure {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .fp3d-measure > * {
        margin: 0;
      }
      .fp3d-measure-back {
        align-self: flex-start;
      }
      .fp3d-measure-start {
        padding: 8px 10px;
        font-size: 13px;
        color: var(--fp3d-text);
        border: 1px solid var(--fp3d-accent);
        border-radius: 8px;
        background: rgba(80, 200, 255, 0.08);
      }
      .fp3d-measure-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .fp3d-measure-input {
        min-height: 40px;
        box-sizing: border-box;
      }
      .fp3d-measure-gap {
        color: var(--fp3d-warm);
      }
      .fp3d-measure-sr {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      .fp3d-library {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
        gap: 6px;
        margin-top: 8px;
      }
      .fp3d-library .fp3d-btn {
        font-weight: 500;
        font-size: 13px;
      }
      /* the Library's Items / Browse packs tabs (#336) */
      .fp3d-lib-tabs {
        margin: 2px 0 6px;
      }
      /* the background picture while it is edited: a dashed frame and a corner handle */
      .fp3d-bg-frame {
        fill: none;
        stroke: var(--fp3d-accent);
        stroke-width: 1.5;
        stroke-dasharray: 6 4;
        pointer-events: none;
      }
      .fp3d-bg-handle {
        fill: var(--fp3d-accent);
        stroke: #041018;
        stroke-width: 2;
        cursor: nwse-resize;
      }
      .fp3d-furn-body {
        fill: rgba(91, 124, 255, 0.1);
        stroke: rgba(91, 124, 255, 0.55);
        stroke-width: 1.2;
        vector-effect: non-scaling-stroke;
        cursor: grab;
      }
      .fp3d-furn-sym * {
        fill: none;
        stroke: rgba(150, 175, 255, 0.55);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
      }
      .fp3d-furn-sym .fp3d-sym-fill {
        fill: rgba(91, 124, 255, 0.28);
      }
      .fp3d-furn-sym .fp3d-sym-strong {
        stroke: var(--fp3d-accent);
        stroke-width: 2;
      }
      /* the rack card's values (#120): one group per device, the value's kind, its entity and state */
      .fp3d-rack-card-group {
        border: 0;
        margin: 4px 0 8px;
        padding: 0;
        display: grid;
        gap: 4px;
      }
      .fp3d-rack-card-group legend {
        padding: 0;
        margin-bottom: 2px;
        font-size: 12px;
        font-weight: 600;
        color: var(--fp3d-text, #e6edf7);
      }
      .fp3d-rack-card-group small {
        opacity: 0.75;
      }
      .fp3d-rack-elev-box {
        max-height: 60vh;
        overflow: auto;
        border-radius: 8px;
      }
      .fp3d-rack-elev-pic {
        position: relative;
        width: fit-content;
        max-width: 100%;
        margin: 0 auto;
      }
      .fp3d-rack-elev-img {
        display: block;
        max-width: 100%;
        height: auto;
      }
      .fp3d-rack-elev-tip {
        position: absolute;
      }
      .fp3d-furn-sym .fp3d-sym-swing {
        stroke-dasharray: 4 3;
        opacity: 0.8;
      }
      .fp3d-out polygon {
        fill: rgba(91, 124, 255, 0.06);
        stroke: rgba(91, 124, 255, 0.4);
        stroke-width: 1;
        stroke-dasharray: 4 3;
        cursor: grab;
      }
      .fp3d-out-lawn polygon,
      .fp3d-out-bed polygon,
      .fp3d-out-wild polygon,
      .fp3d-out-hedge polygon {
        fill: rgba(61, 224, 160, 0.1);
        stroke: rgba(61, 224, 160, 0.5);
      }
      .fp3d-out-pool polygon {
        fill: rgba(55, 224, 255, 0.18);
        stroke: var(--fp3d-accent);
      }
      .fp3d-out-terrace polygon {
        fill: rgba(150, 130, 255, 0.12);
      }
      /* thin areas (paths, fences, hedges): an invisible margin round the outline takes the tap (#401) */
      .fp3d-out polygon.fp3d-out-hit {
        fill: none;
        stroke: transparent;
        stroke-dasharray: none;
        pointer-events: stroke;
      }
      /* the outdoor areas of a floor below, faint, seen from upstairs (#401): a tap offers to go there */
      .fp3d-out-ghost {
        fill: color-mix(in srgb, var(--fp3d-success) 6%, transparent);
        stroke: color-mix(in srgb, var(--fp3d-success) 45%, transparent);
        stroke-width: 1;
        stroke-dasharray: 2 4;
        cursor: pointer;
      }
      .fp3d-out-ghost:hover {
        stroke: var(--fp3d-success);
      }
      .fp3d-free-wall {
        cursor: grab;
      }
      .fp3d-vertex-no {
        fill: var(--fp3d-accent);
        font-size: 11px;
        font-weight: 700;
        pointer-events: none;
      }
`;
