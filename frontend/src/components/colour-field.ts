// The one colour field of the editor and Settings (#403): a swatch that opens the browser's colour picker, the colour as
// a hex value to read, type or paste ("#1e6ebc"; "#rgb", "rrggbb" and "rgb(r, g, b)" are taken too), and a copy button.
// A value that is no colour shows a short error and keeps the colour as it was. Built for reuse (the panels' redesign,
// #405): it knows nothing of items or settings; the host gives it a value, a name and its translate function and
// listens to two events (colour-field-tag.ts colourField does all that):
// - `colour-change` once per change (the swatch's picker closed, a hex value entered or pasted): one undo step;
// - `colour-input` for every change, and while the swatch's picker is dragged: for hosts that preview live.
// Both carry `detail.value`: "#rrggbb", or null when a clearable field is emptied.
// With `menu` set (the item panel's colour rows, #410), the swatch is a button that sends `colour-menu` instead of
// opening the browser's picker: the host opens its own popover (presets, finish) and says so by `expanded`.
// Its code goes into several bundles (editor, Settings, View panel, card editor), so it is kept small: the styles are
// written compactly and use the host's colour tokens (--fp3d-*), which reach into the field, with plain fallbacks
// (the card editor has no tokens).

import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { defineElement } from "../define.ts";
import { parseColour } from "../colour-text.ts";
import type { ColourTexts } from "../colour-field-tag.ts";

export class ColourField extends LitElement {
  static properties = {
    value: { attribute: false },
    base: { attribute: false },
    label: { attribute: false },
    t: { attribute: false },
    disabled: { type: Boolean, reflect: true },
    clearable: { type: Boolean },
    menu: { type: Boolean },
    expanded: { type: Boolean },
    draft: { state: true },
    invalid: { state: true },
    copied: { state: true },
  };

  /** The colour, "#rrggbb"; null or "" when it has none of its own (the field then shows `base`). */
  declare value: string | null;
  /**
   * The colour it has without one of its own ("#rrggbb", the look's colour of an item part, a setting's default), or
   * null when there is none to name. While there is no value the field shows it, muted, and copies it.
   */
  declare base: string | null;
  /** The colour's name, for the swatch, the hex field and the copy button. */
  declare label: string;
  /** The host's translate function (its `t`): the field's texts are in the main table and the language packs. */
  declare t: ColourTexts | null;
  declare disabled: boolean;
  /** Emptying the hex field clears the colour (null); otherwise an empty field goes back to the colour. */
  declare clearable: boolean;
  /** The swatch opens the host's popover (`colour-menu`) instead of the browser's picker. */
  declare menu: boolean;
  /** The host's popover is open (the swatch button says so). */
  declare expanded: boolean;
  /** The text typed and not yet entered; null while the field shows the value. */
  declare draft: string | null;
  declare invalid: boolean;
  declare copied: boolean;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.value = null;
    this.base = null;
    this.label = "";
    this.t = null;
    this.disabled = false;
    this.clearable = false;
    this.menu = false;
    this.expanded = false;
    this.draft = null;
    this.invalid = false;
    this.copied = false;
  }

  /** The colour as the field shows it, "#rrggbb"; "" when there is none. */
  get hex(): string {
    return parseColour(this.value ?? "") ?? "";
  }

  /** The colour the field shows: its own, else its base; "" when there is neither. */
  get shown(): string {
    return this.hex || (parseColour(this.base ?? "") ?? "");
  }

  /** One of the field's texts in the host's language. */
  text(key: Parameters<ColourTexts>[0]): string {
    return this.t?.(key, { label: this.label }) ?? key;
  }

  protected willUpdate(changed: PropertyValues): void {
    // a new value from outside (an undo, another item) replaces what was typed
    if (changed.has("value") && changed.get("value") !== undefined) this.draft = null;
    if (this.draft === null) this.invalid = false;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.timer);
  }

  private send(value: string | null, done: boolean): void {
    const init = { detail: { value }, bubbles: true, composed: true };
    this.dispatchEvent(new CustomEvent("colour-input", init));
    if (done) this.dispatchEvent(new CustomEvent("colour-change", init));
  }

  /**
   * Enters a typed or pasted value: a colour is taken (nothing is sent when it is the colour already), anything else
   * shows the error and keeps the colour. Returns whether it was taken.
   */
  commit(text: string): boolean {
    const hex = parseColour(text);
    if (!hex && text.trim()) {
      this.draft = text;
      this.invalid = true;
      return false;
    }
    this.draft = null;
    this.invalid = false;
    // empty: a clearable colour is cleared, any other stays
    if (!hex) {
      if (this.clearable && this.hex) this.send(null, true);
    } else if (hex !== this.hex) {
      this.value = hex;
      this.send(hex, true);
    }
    return true;
  }

  /** Puts the hex value on the clipboard (the system's, or by selecting it where that is not allowed). */
  async copy(): Promise<void> {
    // a colour on its default copies the default: what the item, the setting shows now
    const hex = this.shown;
    if (!hex) return;
    let done = false;
    try {
      await navigator.clipboard.writeText(hex);
      done = true;
    } catch {
      // no clipboard access (an http page, an old WebView): select the text and copy it the old way
      const input = this.renderRoot.querySelector<HTMLInputElement>(".hex");
      if (input) {
        input.value = hex;
        input.select();
        try {
          done = document.execCommand("copy");
        } catch {
          done = false;
        }
      }
    }
    if (!done) return;
    this.copied = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.copied = false), 1500);
  }

  private onSwatch(e: Event, done: boolean): void {
    const hex = parseColour((e.target as HTMLInputElement).value);
    if (!hex) return;
    this.draft = null;
    if (done) this.value = hex;
    this.send(hex, done);
  }

  /** The swatch as a button that asks the host for its popover. */
  private swatchButton(cls: string, shown: string, dflt: boolean) {
    // prettier-ignore
    return html`<button type="button" class=${`${cls} sb`} aria-label=${this.label} aria-haspopup="true" aria-expanded=${this.expanded ? "true" : "false"} title=${dflt ? this.text("colour_default") : nothing} ?disabled=${this.disabled} @click=${() => this.dispatchEvent(new CustomEvent("colour-menu", { detail: { value: this.hex || null }, bubbles: true, composed: true }))}><span style=${`background:${shown || "#808080"}`}></span></button>`;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      this.commit((e.target as HTMLInputElement).value);
    } else if (e.key === "Escape" && this.draft !== null) {
      // back to the colour; the key does not close the panel as well
      e.preventDefault();
      e.stopPropagation();
      this.draft = null;
    }
  }

  private onPaste(e: ClipboardEvent): void {
    // a pasted colour is taken at once; other text is pasted as usual and checked when entered
    const text = e.clipboardData?.getData("text") ?? "";
    if (parseColour(text)) {
      e.preventDefault();
      this.commit(text);
    }
  }

  protected render() {
    const hex = this.hex;
    const shown = this.shown;
    // on its default: the default's colour and hex, muted and dashed, and named so
    const dflt = !hex && !!shown;
    const label = this.label;
    const copy = this.text("colour_copy_of");
    const hexName = dflt ? `${this.text("colour_hex_of")} (${this.text("colour_default")})` : this.text("colour_hex_of");
    const off = this.disabled;
    const sw =hex ? "sw" : dflt ? "sw dflt" : "sw unset";
    // prettier-ignore
    return html`<span class="cf" role="group" aria-label=${label}>${this.menu ? this.swatchButton(sw, shown, dflt) : html`<input type="color" class=${sw} aria-label=${label} title=${dflt ? this.text("colour_default") : nothing} .value=${shown || "#808080"} ?disabled=${off} @input=${(e: Event) => this.onSwatch(e, false)} @change=${(e: Event) => this.onSwatch(e, true)}>`}<input class=${dflt ? "hex dflt" : "hex"} maxlength="24" spellcheck="false" autocomplete="off" placeholder="#rrggbb" aria-label=${hexName} title=${dflt ? this.text("colour_default") : nothing} aria-invalid=${this.invalid ? "true" : "false"} aria-describedby=${this.invalid ? "err" : nothing} .value=${this.draft ?? shown} ?disabled=${off} @focus=${(e: Event) => (e.target as HTMLInputElement).select()} @input=${(e: Event) => (this.draft = (e.target as HTMLInputElement).value)} @keydown=${this.onKey} @paste=${this.onPaste} @change=${(e: Event) => this.commit((e.target as HTMLInputElement).value)}><button type="button" class="cp" title=${copy} aria-label=${copy} ?disabled=${!shown} @click=${this.copy}>${this.copied ? "✓" : "⧉"}</button><span class="sr" aria-live="polite">${this.copied ? this.text("colour_copied") : ""}</span>${this.invalid ? html`<span id="err" class="err" role="alert">${this.text("colour_invalid")}</span>` : nothing}</span>`;
  }

  // prettier-ignore
  static styles = css`:host{display:inline-block;min-width:0;max-width:100%}.cf{display:inline-flex;flex-wrap:wrap;align-items:center;gap:2px;max-width:100%}input,button{box-sizing:border-box;height:30px;border:1px solid var(--fp3d-line,#8888);border-radius:7px;font:inherit;color:var(--fp3d-text,inherit)}.sw{flex:none;width:30px;padding:2px;background:none;cursor:pointer}.sw::-webkit-color-swatch-wrapper{padding:0}.sw::-webkit-color-swatch{border:none;border-radius:5px}.sb span{display:block;width:100%;height:100%;border-radius:5px}.sb[aria-expanded=true]{border-color:var(--fp3d-accent,#37e0ff)}.unset{opacity:.35}.dflt{border-style:dashed}.hex.dflt{color:var(--fp3d-muted,#888);font-style:italic}.hex{flex:none;width:calc(7ch + 8px);min-width:0;padding:0 3px;font:12px ui-monospace,Menlo,Consolas,monospace;background:var(--fp3d-bg2,transparent)}.hex::placeholder{color:var(--fp3d-muted,#888)}.hex[aria-invalid=true]{border-color:var(--fp3d-danger,#ff6b6b)}.cp{flex:none;width:20px;padding:0;border:none;background:none;color:var(--fp3d-muted,#888);font-size:14px;cursor:pointer}.cp:hover:not(:disabled){color:var(--fp3d-accent,#37e0ff)}.cp:disabled{opacity:.35;cursor:default}:focus-visible{outline:2px solid var(--fp3d-accent,#37e0ff);outline-offset:1px}:host([disabled]) input{opacity:.5;cursor:default}.err{flex-basis:100%;font-size:11px;line-height:1.3;color:var(--fp3d-danger,#ff6b6b)}.sr{position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}`;
}

defineElement("fp3d-colour-field", ColourField);

declare global {
  interface HTMLElementTagNameMap {
    "fp3d-colour-field": ColourField;
  }
}
