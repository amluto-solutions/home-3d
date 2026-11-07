// The opening panel's Type row and its picture cards (#417): the same card look as the Build and Outside panels (#402,
// tool-panel.ts), from the scheme tokens only, so Neon, Day, Realistic and High contrast draw them in their own colours.
// Part of the editor's styles (fp3d-editor static styles, #202).

import { css } from "lit";

export const typeCardStyles = css`
      .fp3d-type-row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 44px;
        margin: 4px 0 8px;
        padding: 4px 10px 4px 4px;
        font: inherit;
        text-align: left;
        color: var(--fp3d-text);
        background: color-mix(in srgb, var(--fp3d-panel, #1e293b) 55%, transparent);
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-card, 8px);
        cursor: pointer;
      }
      .fp3d-type-row:hover,
      .fp3d-type-row[aria-expanded="true"] {
        border-color: var(--fp3d-accent);
      }
      .fp3d-type-row:focus-visible,
      .fp3d-oc:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 1px;
      }
      .fp3d-type-row .fp3d-oc-pic {
        flex: 0 0 56px;
        height: 36px;
      }
      .fp3d-type-text {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }
      .fp3d-type-label {
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .fp3d-type-value {
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .fp3d-type-chev {
        color: var(--fp3d-muted);
      }
      .fp3d-ocards {
        margin: 0 0 10px;
      }
      .fp3d-ocards-head {
        margin: 8px 0 6px;
        font-size: 12px;
        font-weight: 600;
        color: var(--fp3d-muted);
      }
      .fp3d-ocards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 8px;
      }
      .fp3d-oc {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        min-height: 44px;
        padding: 6px 6px 8px;
        font: inherit;
        font-size: 13px;
        text-align: left;
        color: var(--fp3d-text);
        background: color-mix(in srgb, var(--fp3d-panel, #1e293b) 55%, transparent);
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-card, 8px);
        cursor: pointer;
      }
      .fp3d-oc:hover {
        border-color: var(--fp3d-accent);
      }
      .fp3d-oc[aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
        color: var(--fp3d-accent);
        font-weight: 700;
      }
      .fp3d-oc-pic {
        display: block;
        height: 44px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--fp3d-bg, #070b14) 45%, transparent);
      }
      .fp3d-oc-svg {
        display: block;
        width: 100%;
        height: 100%;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .fp3d-oc-svg .w {
        stroke: var(--fp3d-text);
        stroke-width: 2.2;
      }
      .fp3d-oc-svg .l {
        stroke: var(--fp3d-muted);
        stroke-width: 1.2;
      }
      .fp3d-oc-svg .a {
        stroke: var(--fp3d-accent);
        stroke-width: 1.8;
      }
      .fp3d-oc-svg .dash {
        stroke-dasharray: 3 3;
      }
      .fp3d-oc-svg .x {
        stroke: var(--fp3d-muted);
        stroke-width: 1.6;
        stroke-dasharray: 4 3;
      }
      .fp3d-oc-svg .d {
        fill: var(--fp3d-accent);
      }
      .fp3d-oc-svg .s {
        fill: color-mix(in srgb, var(--fp3d-soft) 24%, transparent);
        stroke: var(--fp3d-soft);
        stroke-width: 1.5;
      }
      .fp3d-oc-svg .m {
        fill: color-mix(in srgb, var(--fp3d-muted) 22%, transparent);
        stroke: var(--fp3d-muted);
        stroke-width: 1.5;
      }
      /* Sill and Sill height side by side (ORDER-6) */
      .fp3d-pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        align-items: end;
      }
      .fp3d-pair > .fp3d-field {
        min-width: 0;
      }
      .fp3d-seg-field .fp3d-seg {
        display: flex;
      }
      .fp3d-seg-field .fp3d-seg > button {
        flex: 1;
        min-height: 32px;
      }
      .fp3d-phone .fp3d-seg-field .fp3d-seg > button {
        min-height: 44px;
      }
      @media (pointer: coarse) {
        .fp3d-seg-field .fp3d-seg > button {
          min-height: 44px;
        }
      }
`;
