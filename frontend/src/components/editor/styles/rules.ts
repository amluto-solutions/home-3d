// The "Show and hide" rules of an item (#539, #544): one sentence per rule, opened in place with ready choices.
// Part of the editor's styles (fp3d-editor static styles, #202): the slices are applied in the order editor.ts lists them.

import { css } from "lit";

export const ruleStyles = css`
      /* "Show and hide" (#539, #544): each rule is one sentence; a tap opens it in place with ready choices */
      .fp3d-rules {
        margin-top: 16px;
      }
      .fp3d-rule {
        border-top: 1px solid var(--fp3d-line);
      }
      .fp3d-rules .fp3d-rule:last-child {
        border-bottom: 1px solid var(--fp3d-line);
      }
      .fp3d-rule-title {
        padding-top: 10px;
        font-weight: 600;
      }
      .fp3d-rule-say {
        display: flex;
        align-items: baseline;
        gap: 10px;
        width: 100%;
        min-height: 48px;
        padding: 12px 2px;
        border: 0;
        background: none;
        color: var(--fp3d-text);
        font: inherit;
        font-size: 14px;
        line-height: 1.35;
        text-align: start;
        cursor: pointer;
      }
      .fp3d-rule-say:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: -2px;
        border-radius: 6px;
      }
      .fp3d-rule-tag {
        flex: none;
        min-width: 5.2em;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .fp3d-rule-text {
        flex: 1 1 10em;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .fp3d-rule-text b {
        font-weight: 650;
        color: var(--fp3d-accent);
      }
      .fp3d-rule-plain {
        color: var(--fp3d-muted);
      }
      .fp3d-rule-hidden {
        display: inline-block;
        margin-inline-start: 4px;
        padding: 0 8px;
        font-weight: 400;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--fp3d-warm) 60%, transparent);
        color: var(--fp3d-warm);
        font-size: 11.5px;
        white-space: nowrap;
      }
      .fp3d-rule-add {
        flex: none;
        margin-inline-start: auto;
        color: var(--fp3d-accent);
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
      }
      .fp3d-rule-chev {
        flex: none;
        align-self: center;
        margin-inline-start: auto;
        width: 7px;
        height: 7px;
        border-right: 1.5px solid var(--fp3d-muted);
        border-bottom: 1.5px solid var(--fp3d-muted);
        transform: rotate(45deg) translateY(-2px);
        transition: transform 0.15s ease-out;
      }
      .fp3d-rule-open .fp3d-rule-chev {
        transform: rotate(-135deg) translate(-2px, 0);
      }
      .fp3d-rule-body {
        display: grid;
        gap: 10px;
        padding: 0 0 14px;
        min-width: 0;
      }
      .fp3d-rule-body > .fp3d-sub {
        margin: 0;
      }
      .fp3d-rule-choices,
      .fp3d-rule-match {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .fp3d-rule-chip {
        min-height: 40px;
        padding: 6px 12px;
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        background: none;
        color: var(--fp3d-text);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      .fp3d-rule-match .fp3d-rule-chip {
        flex: 1 1 0;
        min-width: 0;
      }
      .fp3d-rule-chip:hover:not(:disabled),
      .fp3d-rule-days button:hover:not(:disabled) {
        border-color: var(--fp3d-accent);
      }
      .fp3d-rule-chip[aria-pressed="true"],
      .fp3d-rule-days button[aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 22%, transparent);
        font-weight: 600;
      }
      .fp3d-rule-cond {
        display: grid;
        gap: 8px;
        padding: 10px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--fp3d-accent) 5%, transparent);
        min-width: 0;
      }
      .fp3d-rule-row {
        display: flex;
        gap: 8px;
        align-items: center;
        min-width: 0;
      }
      .fp3d-rule-row > select,
      .fp3d-rule-row > input {
        flex: 1 1 0;
        min-width: 0;
      }
      .fp3d-rule-cond select,
      .fp3d-rule-cond input {
        min-height: 40px;
      }
      .fp3d-rule-times {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 8px;
      }
      .fp3d-rule-time {
        display: grid;
        gap: 4px;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .fp3d-rule-days {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 4px;
      }
      .fp3d-rule-days button {
        min-width: 0;
        min-height: 44px;
        padding: 0 2px;
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        background: none;
        color: var(--fp3d-text);
        font: inherit;
        font-size: 12.5px;
        overflow: hidden;
        text-overflow: clip;
        cursor: pointer;
      }
      .fp3d-rule-hint {
        margin: -4px 0 0;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .fp3d-rule-tools {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 16px;
      }
      .fp3d-rule-link {
        min-height: 36px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--fp3d-accent);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .fp3d-rule-link:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .fp3d-rule-addc {
        justify-self: start;
      }
      /* the Object row (#547): its note beside the "i", and the number of each interval in Custom */
      .fp3d-rule-body .fp3d-with-info > .fp3d-sub {
        margin: 0;
      }
      .fp3d-rule-ivl {
        flex: 1 1 auto;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
`;
