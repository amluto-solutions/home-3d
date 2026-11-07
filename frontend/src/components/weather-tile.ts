// The weather tile by the clock (#333): the current temperature and a symbol of the condition from a weather entity, as
// a small button; a tap opens today's forecast under (or over) it. A chunk of its own, loaded when the option is on; the
// forecast list (weather-forecast.ts) is another, loaded on the first tap.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing } from "lit";
import { CLOCK_LOOK, type ClockLook } from "../clock.ts";
import { loadWeatherForecast } from "../load-parts.ts";
import { formatNumber, translate, type I18nKey } from "../i18n.ts";
import { need } from "../lazy-part.ts";
import { tokens } from "../styles.ts";
import type { HomeAssistant } from "../types.ts";
import { weatherIcon } from "../weather-icon.ts";

/** The reading of a weather entity: its temperature (null when it has none), unit and condition. */
export function weatherReading(hass: HomeAssistant | undefined, entity: string): { temperature: number | null; unit: string; condition: string; label: string } | null {
  const st = hass?.states[entity];
  if (!st || st.state === "unavailable" || st.state === "unknown") return null;
  const t = (st.attributes as Record<string, unknown>).temperature;
  const f = (hass as { formatEntityState?: (s: unknown) => string } | undefined)?.formatEntityState;
  return {
    temperature: typeof t === "number" ? t : null,
    unit: String((st.attributes as Record<string, unknown>).temperature_unit ?? hass?.config?.unit_system?.temperature ?? "°C"),
    condition: st.state,
    label: f ? f(st) : st.state,
  };
}

export class Fp3dWeatherTile extends LitElement {
  static properties = {
    hass: { attribute: false },
    entity: { attribute: false },
    look: { attribute: false },
    pos: { attribute: false },
    light: { type: Boolean, reflect: true },
    _open: { state: true },
  };
  declare hass: HomeAssistant | undefined;
  declare entity: string;
  declare look: ClockLook | null;
  /** The clock's corner (tl, tr, bl, br): the forecast opens away from the screen's edge. */
  declare pos: string;
  /** The Day look: the tile takes the light surface with dark text, as the clock does. */
  declare light: boolean;
  private declare _open: boolean;

  constructor() {
    super();
    this.look = null;
    this.pos = "tr";
    this.light = false;
    this._open = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("pointerdown", this.onOutside, true);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("pointerdown", this.onOutside, true);
  }

  /** A press anywhere else closes the forecast. */
  private readonly onOutside = (e: Event) => {
    if (this._open && !e.composedPath().includes(this)) this._open = false;
  };

  private toggle(): void {
    this._open = !this._open;
    if (this._open) need(loadWeatherForecast);
  }

  protected render() {
    const w = weatherReading(this.hass, this.entity);
    if (!w) return nothing;
    const t = (k: string) => translate(this.hass, k as I18nKey);
    const temp = w.temperature === null ? "" : `${formatNumber(this.hass, w.temperature, 0)}${w.unit}`;
    const label = [t("wx_label"), w.label, temp].filter(Boolean).join(", ");
    return html`<button type="button" class="tile" aria-expanded=${this._open} aria-controls="forecast" title=${t("wx_hint")} aria-label=${label} @click=${() => this.toggle()} @keydown=${(e: KeyboardEvent) => e.key === "Escape" && (this._open = false)}>
        <span class="ico" aria-hidden="true">${weatherIcon(w.condition)}</span>${temp ? html`<b>${temp}</b>` : nothing}
      </button>
      ${this._open
        ? html`<div id="forecast" class="pop pop-${this.pos}" role="dialog" aria-label=${t("wx_today")}>
            <fp3d-weather-forecast .hass=${this.hass} .entity=${this.entity} .look=${this.look ?? CLOCK_LOOK}></fp3d-weather-forecast>
          </div>`
        : nothing}`;
  }

  static styles = [
    tokens,
    css`
      :host {
        position: relative;
        display: block;
        pointer-events: auto;
      }
      .tile {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 100%;
        box-sizing: border-box;
        padding: 8px 14px;
        border: 0;
        border-radius: 14px;
        background: rgba(4, 16, 24, 0.55);
        color: var(--fp3d-text);
        font: inherit;
        cursor: pointer;
        backdrop-filter: blur(6px);
      }
      :host([light]) .tile {
        background: rgba(255, 255, 255, 0.88);
        color: #0f1c2e;
      }
      .tile:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 2px;
      }
      .ico {
        font-size: 26px;
        line-height: 1;
      }
      b {
        font-size: 26px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .pop {
        position: absolute;
        z-index: 2;
        width: 240px;
        max-width: calc(100vw - 24px);
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid var(--fp3d-line);
        background: var(--fp3d-chrome-solid);
        color: var(--fp3d-text);
        box-shadow: var(--fp3d-shadow);
      }
      .pop-tl,
      .pop-bl {
        left: 0;
      }
      .pop-tr,
      .pop-br {
        right: 0;
      }
      .pop-tl,
      .pop-tr {
        top: calc(100% + 6px);
      }
      .pop-bl,
      .pop-br {
        bottom: calc(100% + 6px);
      }
    `,
  ];
}

defineElement("fp3d-weather-tile", Fp3dWeatherTile);
