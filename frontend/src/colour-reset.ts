// A reset button for a colour picker (#230): a small ↺ beside the picker that brings the default colour back. It is
// there only while the colour differs from the default, so a picker at its starting colour looks as it always did.
// One part for every picker: the view's accent, the card's accent, the Settings page, the item panel (colour roles,
// paint, bin colours) and the item editor.

import { css, html, nothing, type TemplateResult } from "lit";

/** The accent colour a picker starts from: the neon look's cyan (an accent of your own replaces it). */
export const ACCENT_DEFAULT = "#48cdeb";

/** Two colours are the same when their hex text is (case and spaces ignored); nothing is the same as nothing. */
export function sameColour(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/**
 * Whether a picker holding `value` has something to reset: a colour is set and it is not the default. `fallback` is
 * the default colour as a hex value; null when the default is "no colour of its own" (the look's colour), where any
 * set colour can be reset.
 */
export function colourDiffers(value: string | null | undefined, fallback: string | null | undefined): boolean {
  return !!value && !sameColour(value, fallback);
}

export interface ColourResetOptions {
  value: string | null | undefined;
  fallback: string | null | undefined;
  /** What the button says (its tooltip and accessible name): where the colour goes back to. */
  label: string;
  onReset: () => void;
  disabled?: boolean;
}

/** The ↺ button, or nothing while the colour is the default. */
export function colourReset(o: ColourResetOptions): TemplateResult | typeof nothing {
  if (!colourDiffers(o.value, o.fallback)) return nothing;
  return html`<button
    type="button"
    class="fp3d-colour-reset"
    title=${o.label}
    aria-label=${o.label}
    ?disabled=${o.disabled}
    @click=${(e: Event) => {
      // inside a label the click must not reopen the picker
      e.preventDefault();
      e.stopPropagation();
      o.onReset();
    }}
  >
    ↺
  </button>`;
}

export const colourResetCss = css`
  .fp3d-colour-reset {
    flex: none;
    border: none;
    background: none;
    color: var(--fp3d-muted, #8aa0b8);
    cursor: pointer;
    font: inherit;
    font-size: 15px;
    line-height: 1;
    padding: 4px 5px;
    border-radius: 6px;
  }
  .fp3d-colour-reset:hover:not(:disabled),
  .fp3d-colour-reset:focus-visible {
    color: var(--fp3d-accent, #37e0ff);
  }
  .fp3d-colour-reset:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;
