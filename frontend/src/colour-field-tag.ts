// How a host draws the shared colour field (#403, components/colour-field.ts): its tag with the value, the colour's name
// and the host's translate function, and one callback. Kept apart from the field's code, so a host whose bundle loads
// the field later (Settings) or finds it defined by the bundle that opened it (the item editor, opened by the editor)
// carries only this.

import { html, type TemplateResult } from "lit";

/** The field's texts by key (in the main table and the language packs); a host hands its own `t`. */
export type ColourTexts = (key: "colour_hex_of" | "colour_copy_of" | "colour_copied" | "colour_invalid" | "colour_default", vars: { label: string }) => string;

export interface ColourFieldOptions {
  /** "#rrggbb", or null when it has none of its own. */
  value: string | null | undefined;
  /** The colour's name: the swatch's, and in the hex field's and copy button's names. */
  label: string;
  /** The host's translate function. */
  t: ColourTexts;
  /** Called once per change (one undo step), or with `live` on every change, the picker's drag included. */
  onChange: (hex: string | null) => void;
  live?: boolean;
  disabled?: boolean;
  /** Emptying the hex field clears the colour (calls onChange with null). */
  clearable?: boolean;
  /** The colour it has without one of its own (a part's colour in the look, a setting's default): shown muted and copied while there is no value. */
  base?: string | null;
  /** The swatch opens the host's popover (#410) instead of the browser's picker: called on its click. */
  onMenu?: () => void;
  /** The host's popover is open. */
  expanded?: boolean;
}

/** The shared colour field (#403) in a host's template. */
export function colourField(o: ColourFieldOptions): TemplateResult {
  const take = (e: Event) => o.onChange((e as CustomEvent<{ value: string | null }>).detail.value);
  // prettier-ignore
  return html`<fp3d-colour-field .value=${o.value ?? null} .label=${o.label} .t=${o.t} .base=${o.base ?? null} ?clearable=${!!o.clearable} ?disabled=${!!o.disabled} @colour-change=${o.live ? null : take} @colour-input=${o.live ? take : null} ?menu=${!!o.onMenu} ?expanded=${!!o.expanded} @colour-menu=${o.onMenu ?? null}></fp3d-colour-field>`;
}
