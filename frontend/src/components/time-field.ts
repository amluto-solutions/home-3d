// A time of day picker (#225): hour and minute lists (with AM/PM in 12-hour profiles) instead of a bare number box. The
// value is "HH:MM" whatever is shown. Built for reuse (the settings redesign): lists are native selects, so touch,
// keyboard and screen readers work as everywhere; the lists follow Home Assistant's 12 or 24 hour setting.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing } from "lit";
import { minutesOf, timeOf } from "../time-of-day.ts";
import { tokens } from "../styles.ts";

export class TimeField extends LitElement {
  static properties = {
    value: { attribute: false },
    hour12: { type: Boolean },
    disabled: { type: Boolean },
    clearable: { type: Boolean },
    step: { type: Number },
    label: { attribute: false },
    hourLabel: { attribute: false },
    minuteLabel: { attribute: false },
    periodLabel: { attribute: false },
  };

  /** "HH:MM", or "" for none. */
  declare value: string;
  /** Show 1-12 with AM/PM instead of 0-23. */
  declare hour12: boolean;
  declare disabled: boolean;
  /** An empty choice is offered (the time is optional). */
  declare clearable: boolean;
  /** Minutes between the choices (the current value is kept even when it is off the grid). */
  declare step: number;
  declare label: string;
  declare hourLabel: string;
  declare minuteLabel: string;
  declare periodLabel: string;

  constructor() {
    super();
    this.value = "";
    this.hour12 = false;
    this.disabled = false;
    this.clearable = false;
    this.step = 5;
    this.label = "";
    this.hourLabel = "Hour";
    this.minuteLabel = "Minute";
    this.periodLabel = "AM/PM";
  }

  /** Change one part: the other parts stay (an empty time starts at 00:00 or 12:00 AM). */
  private set(part: "h" | "m" | "p", raw: string): void {
    const now = minutesOf(this.value);
    if (part === "h" && raw === "") return this.send("");
    const h24 = now === null ? 0 : Math.floor(now / 60);
    const m = now === null ? 0 : now % 60;
    let hour = h24;
    let minute = m;
    if (part === "m") minute = Number(raw);
    else if (part === "h") hour = this.hour12 ? (Number(raw) % 12) + (h24 >= 12 ? 12 : 0) : Number(raw);
    else hour = (h24 % 12) + (raw === "pm" ? 12 : 0);
    this.send(timeOf(hour * 60 + minute));
  }

  private send(value: string): void {
    this.value = value;
    this.dispatchEvent(new CustomEvent("change", { detail: { value }, bubbles: true, composed: true }));
  }

  protected render() {
    const at = minutesOf(this.value);
    const h24 = at === null ? null : Math.floor(at / 60);
    const minute = at === null ? null : at % 60;
    const step = Math.max(1, Math.round(this.step) || 5);
    const minutes = [...new Set([...Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step), ...(minute === null ? [] : [minute])])].sort((a, b) => a - b);
    const hours = this.hour12 ? [12, ...Array.from({ length: 11 }, (_, i) => i + 1)] : Array.from({ length: 24 }, (_, i) => i);
    const shownHour = h24 === null ? "" : String(this.hour12 ? h24 % 12 || 12 : h24);
    const two = (n: number) => String(n).padStart(2, "0");
    const none = h24 === null;
    return html`<span class="t" role="group" aria-label=${this.label}>
      <select aria-label=${this.hourLabel} ?disabled=${this.disabled} @change=${(e: Event) => this.set("h", (e.target as HTMLSelectElement).value)}>
        ${none ? html`<option value="" selected>${this.clearable ? "–" : two(0)}</option>` : nothing}
        ${this.clearable && !none ? html`<option value="">–</option>` : nothing}
        ${hours.map((h) => html`<option value=${h} ?selected=${String(h) === shownHour}>${this.hour12 ? h : two(h)}</option>`)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label=${this.minuteLabel} ?disabled=${this.disabled || (none && this.clearable)} @change=${(e: Event) => this.set("m", (e.target as HTMLSelectElement).value)}>
        ${minutes.map((m) => html`<option value=${m} ?selected=${m === minute || (none && m === 0)}>${two(m)}</option>`)}
      </select>
      ${this.hour12
        ? html`<select aria-label=${this.periodLabel} ?disabled=${this.disabled || (none && this.clearable)} @change=${(e: Event) => this.set("p", (e.target as HTMLSelectElement).value)}>
            <option value="am" ?selected=${h24 === null || h24 < 12}>AM</option>
            <option value="pm" ?selected=${h24 !== null && h24 >= 12}>PM</option>
          </select>`
        : nothing}
    </span>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: inline-block;
      }
      .t {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--fp3d-text);
      }
      select {
        min-height: 36px;
        padding: 4px 6px;
        font: inherit;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
      }
      select:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: -1px;
      }
    `,
  ];
}

defineElement("fp3d-time-field", TimeField);
