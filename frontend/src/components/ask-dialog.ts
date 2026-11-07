// The app's own ask / confirm / message dialog (#59): one per page, over everything, in the panel's look. The
// promise API lives in ../ask.ts (askConfirm, askText, tell); importing this module registers the dialog, which is
// created on the first question. Every bundle that asks imports it; the tag is defined once (whichever bundle comes
// first) and all copies of ask.ts share one host through globalThis.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing } from "lit";
import { live } from "lit/directives/live.js";
import { AskQueue, registerAskFactory, type AskAnswer, type AskHost, type AskRequest } from "../ask.ts";
import { trapTab } from "../dialog-focus.ts";
import { controls, tokens } from "../styles.ts";

const TAG = "fp3d-ask-dialog";

/** The element with focus, looking into shadow roots (so it can get the focus back after the dialog). */
function deepActive(): HTMLElement | null {
  let el = document.activeElement as HTMLElement | null;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement as HTMLElement;
  return el;
}

/**
 * The look of the part that asked (#263): the innermost Home 3D host along the focus with a scheme attribute (the
 * panel or a card under the Day look is "light", under High contrast "contrast"); null keeps the dark look. The
 * dialog sits on the page, outside the panel, so it can't inherit the scheme and copies it instead.
 */
export function focusScheme(start: Element | null = typeof document === "undefined" ? null : document.activeElement): "light" | "contrast" | null {
  let scheme: "light" | "contrast" | null = null;
  for (let el = start; el; el = el.shadowRoot?.activeElement ?? null) {
    if (el.hasAttribute("contrast")) scheme = "contrast";
    else if (el.hasAttribute("light")) scheme = "light";
  }
  return scheme;
}

/**
 * The look of the Home 3D host an element sits in (#420): the nearest one up the tree, through shadow roots, with a
 * scheme attribute ("light" under Day, "contrast" under High contrast); null: the dark look.
 */
export function hostScheme(start: Element | null | undefined): "light" | "contrast" | null {
  for (let el: Element | null = start ?? null; el; el = el.parentElement ?? ((el.getRootNode?.() as ShadowRoot | undefined)?.host ?? null)) {
    if (el.hasAttribute?.("contrast")) return "contrast";
    if (el.hasAttribute?.("light")) return "light";
  }
  return null;
}

/** Where the dialog goes: into the element shown full screen (a card on a wall tablet), else the page. */
function mountPoint(): Element {
  let fs: Element | null = document.fullscreenElement;
  while (fs?.shadowRoot?.fullscreenElement) fs = fs.shadowRoot.fullscreenElement;
  return fs ?? document.body;
}

export class Fp3dAskDialog extends LitElement implements AskHost {
  readonly queue = new AskQueue();
  private typed = "";
  /** A typed confirmation was tried with the wrong text: the error shows for a few seconds (#330). */
  private wrong = false;
  private wrongTimer: ReturnType<typeof setTimeout> | undefined;
  /** The pause after the last keystroke before a wrong name is called wrong (#344). */
  private pauseTimer: ReturnType<typeof setTimeout> | undefined;
  private shown: AskRequest | null = null;
  private returnFocus: HTMLElement | null = null;

  constructor() {
    super();
    this.queue.onChange = () => this.requestUpdate();
  }

  ask(req: AskRequest): Promise<AskAnswer> {
    return this.queue.ask(req);
  }

  /** Shows the mismatch error under the field for a few seconds. */
  private showWrong(sticky = false): void {
    this.wrong = true;
    clearTimeout(this.wrongTimer);
    // after a pause in typing it stays until the text is right or changes; after a tap or blur it goes in a few seconds
    if (!sticky)
      this.wrongTimer = setTimeout(() => {
        this.wrong = false;
        this.requestUpdate();
      }, 5000);
    this.requestUpdate();
  }

  private answer(ok: boolean): void {
    const req = this.queue.current;
    if (!req) return;
    // a typed confirmation stays open until the text matches (#330)
    if (ok && req.matches && !req.matches(this.typed)) {
      this.showWrong();
      return;
    }
    // a message has only OK: closing it any way counts as OK
    this.queue.answer(ok || req.cancel === undefined, req.input !== undefined ? this.typed : "");
  }

  private key(e: KeyboardEvent): void {
    e.stopPropagation(); // the editor's shortcuts (Delete, arrows, Ctrl+Z) stay out of the dialog
    if (e.key === "Escape") {
      e.preventDefault();
      this.answer(false);
    } else if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      this.answer(true);
    } else trapTab(e, e.currentTarget as HTMLElement); // Tab stays in the dialog (#196)
  }

  protected willUpdate(): void {
    const req = this.queue.current;
    if (req === this.shown) return;
    if (req && !this.shown) {
      this.returnFocus = deepActive();
      // the dialog shows in the look of the screen that asked (#263): New home in Settings under the Day look is light
      const scheme = focusScheme();
      this.toggleAttribute("light", scheme === "light");
      this.toggleAttribute("contrast", scheme === "contrast");
    }
    this.typed = req?.input ?? "";
    this.wrong = false;
    clearTimeout(this.wrongTimer);
    clearTimeout(this.pauseTimer);
    this.toggleAttribute("open", !!req);
  }

  /** Back answers the question with Cancel before it leaves the page (#322); its history entry's release. */
  private backRelease: (() => void) | null = null;

  protected updated(): void {
    const req = this.queue.current;
    // the panel's history (back-stack.ts) lends its hook while it is the host; a dashboard has none. Not imported, so
    // the bundles that ask (items, Settings) stay as small as they were
    const open = (globalThis as { __fp3dNavOpen?: (close: () => void, key: string) => () => void }).__fp3dNavOpen;
    if (req && !this.backRelease && open) this.backRelease = open(() => ((this.backRelease = null), this.answer(false)), "ask:question");
    else if (!req && this.backRelease) {
      const release = this.backRelease;
      this.backRelease = null;
      release();
    }
    if (req === this.shown) return;
    this.shown = req;
    if (!req) {
      this.returnFocus?.focus?.();
      this.returnFocus = null;
      return;
    }
    // the text field, else the safe button of a warning, else OK
    const input = this.renderRoot.querySelector("input");
    if (input) {
      input.focus();
      input.select();
    } else (this.renderRoot.querySelector(req.danger && req.cancel !== undefined ? ".ask-cancel" : ".ask-ok") as HTMLElement | null)?.focus();
  }

  protected render() {
    const req = this.queue.current;
    if (!req) return nothing;
    return html`<div class="backdrop" @click=${() => this.answer(false)}></div>
      <div class="box ${req.detail !== undefined ? "wide" : ""}" role=${req.cancel === undefined ? "dialog" : "alertdialog"} aria-modal="true" aria-describedby="ask-text" @keydown=${(e: KeyboardEvent) => this.key(e)}>
        <p id="ask-text" class="text">${req.text}</p>
        ${req.detail !== undefined ? html`<textarea class="detail" readonly rows="14" spellcheck="false" aria-labelledby="ask-text" .value=${req.detail}></textarea>` : nothing}
        ${req.input !== undefined
          ? html`<label class="fp3d-field"><input type="text" aria-labelledby="ask-text" .value=${live(this.typed)} @input=${(e: Event) => {
              this.typed = (e.target as HTMLInputElement).value;
              if (req.matches) {
                if (req.matches(this.typed) || !this.typed.trim()) this.wrong = false;
                // a wrong name is called wrong once typing pauses, not only on Enter or leaving the field (#344)
                clearTimeout(this.pauseTimer);
                if (this.typed.trim() && !req.matches(this.typed)) this.pauseTimer = setTimeout(() => this.showWrong(true), 900);
                this.requestUpdate();
              }
            }} @blur=${() => req.matches && this.typed.trim() && !req.matches(this.typed) && this.showWrong()} aria-invalid=${this.wrong ? "true" : "false"} aria-describedby=${this.wrong ? "ask-error" : "ask-text"} /></label>
            ${this.wrong && req.mismatch ? html`<p id="ask-error" class="ask-error" role="alert">${req.mismatch}</p>` : nothing}`
          : nothing}
        <div class="buttons">
          ${req.cancel !== undefined ? html`<button class="fp3d-btn ask-cancel" @click=${() => this.answer(false)}>${req.cancel}</button>` : nothing}
          <button class="fp3d-btn ask-ok ${req.danger ? "ask-danger" : "fp3d-primary"}" aria-disabled=${!!req.matches && !req.matches(this.typed) ? "true" : "false"} @click=${() => this.answer(true)}>${req.ok}</button>
        </div>
      </div>`;
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: none;
      }
      :host([open]) {
        display: block;
      }
      .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(4, 8, 16, 0.55);
      }
      .box {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(400px, calc(100% - 32px));
        max-height: calc(100% - 40px);
        overflow-y: auto;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px 18px 16px;
        border: 1px solid var(--fp3d-line);
        border-radius: 18px;
        background: var(--fp3d-chrome-solid);
        box-shadow: var(--fp3d-shadow);
      }
      .box.wide {
        width: min(720px, calc(100% - 32px));
      }
      .detail {
        font: 12px/1.45 ui-monospace, monospace;
        color: var(--fp3d-text);
        background: rgba(127, 127, 127, 0.08);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        padding: 8px 10px;
        min-height: 160px;
        max-height: 55vh;
        resize: vertical;
      }
      .text {
        margin: 0;
        font-size: 1rem;
        line-height: 1.45;
        white-space: pre-line;
        overflow-wrap: anywhere;
      }
      .fp3d-field input {
        font-size: 16px; /* 16 px: phones do not zoom into the field */
        padding: 9px 10px;
      }
      .buttons {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }
      .buttons .fp3d-btn {
        min-height: 40px;
        min-width: 88px;
      }
      .ask-error {
        margin: -6px 0 0;
        font-size: 0.9rem;
        line-height: 1.4;
        color: var(--fp3d-danger);
      }
      .ask-ok[aria-disabled="true"] {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ask-danger {
        background: var(--fp3d-danger);
        color: #1a0208;
        border-color: transparent;
      }
      button:focus-visible,
      textarea:focus-visible,
      input:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 2px;
      }
    `,
  ];
}

defineElement(TAG, Fp3dAskDialog);

// only the first bundle's factory is used, so this one element serves the whole page
let dialog: Fp3dAskDialog | null = null;
registerAskFactory(() => {
  if (typeof document === "undefined") return null;
  return {
    ask(req) {
      dialog ??= document.createElement(TAG) as Fp3dAskDialog;
      const at = mountPoint();
      // a card went full screen since the last question: the dialog follows it (an open question keeps its place)
      if (dialog.parentNode !== at && !dialog.queue?.current) at.appendChild(dialog);
      return dialog.ask(req);
    },
  };
});
