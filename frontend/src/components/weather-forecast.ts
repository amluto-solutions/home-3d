// Today's forecast of a weather entity (#333), the part of the weather tile that loads when the tile is tapped: Home
// Assistant's weather.get_forecasts (hourly if the entity has it, else daily), as a small list. A chunk of its own, so
// the view's first paint carries none of it. Times go through the clock's own formatter (clock.ts digitalText), so the
// 12 or 24 hour setting applies here as it does to the clock.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { CLOCK_LOOK, digitalText, type ClockLook } from "../clock.ts";
import { formatNumber, translate, type I18nKey } from "../i18n.ts";
import { tokens } from "../styles.ts";
import type { HomeAssistant } from "../types.ts";
import { weatherIcon } from "../weather-icon.ts";

export interface ForecastEntry {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation_probability?: number;
}

type Kind = "hourly" | "daily";

/** The entries of a get_forecasts answer for one entity (an answer without the entity or the list gives none). */
export function forecastOf(answer: unknown, entity: string): ForecastEntry[] {
  const list = (answer as { response?: Record<string, { forecast?: unknown }> } | null)?.response?.[entity]?.forecast;
  return Array.isArray(list) ? (list as ForecastEntry[]).filter((e) => e && typeof e.datetime === "string") : [];
}

/** The calendar day (YYYY-MM-DD) of a moment in a time zone (the browser's when the zone is missing or unknown). */
export function dayOf(ms: number, timeZone?: string): string {
  try {
    return new Date(ms).toLocaleDateString("en-CA", timeZone ? { timeZone } : undefined);
  } catch {
    return new Date(ms).toLocaleDateString("en-CA");
  }
}

/** What to list of today: the hourly entries of today still to come (now's hour first), at most `max`; the daily list: today's entry. */
export function todayEntries(list: readonly ForecastEntry[], kind: Kind, now: number, timeZone?: string, max = 12): ForecastEntry[] {
  const today = dayOf(now, timeZone);
  const mine = list.filter((e) => dayOf(Date.parse(e.datetime), timeZone) === today);
  if (kind === "daily") return mine.slice(0, 1);
  return mine.filter((e) => Date.parse(e.datetime) >= now - 3600_000).slice(0, max);
}

export class Fp3dWeatherForecast extends LitElement {
  static properties = {
    hass: { attribute: false },
    entity: { attribute: false },
    look: { attribute: false },
    _kind: { state: true },
    _list: { state: true },
    _state: { state: true },
  };
  declare hass: HomeAssistant | undefined;
  declare entity: string;
  /** The clock's look: its 12 or 24 hour choice formats the times here. */
  declare look: ClockLook | null;
  private declare _kind: Kind;
  private declare _list: ForecastEntry[];
  private declare _state: "loading" | "ready" | "none";
  private asked = "";

  constructor() {
    super();
    this.look = null;
    this._kind = "hourly";
    this._list = [];
    this._state = "loading";
  }

  protected willUpdate(changed: PropertyValues): void {
    // asked once per entity: the tile opens this element each time it is tapped open
    if ((changed.has("entity") || changed.has("hass")) && this.hass && this.entity && this.asked !== this.entity) {
      this.asked = this.entity;
      void this.load(this.hass, this.entity);
    }
  }

  private async load(hass: HomeAssistant, entity: string): Promise<void> {
    for (const kind of ["hourly", "daily"] as const) {
      try {
        const answer = await hass.callWS({ type: "call_service", domain: "weather", service: "get_forecasts", service_data: { type: kind }, target: { entity_id: entity }, return_response: true });
        const today = todayEntries(forecastOf(answer, entity), kind, Date.now(), hass.config?.time_zone);
        if (today.length) {
          this._kind = kind;
          this._list = today;
          this._state = "ready";
          return;
        }
      } catch {
        // this entity has no such forecast: the next kind
      }
    }
    this._state = "none";
  }

  private t(key: string): string {
    return translate(this.hass, key as I18nKey);
  }

  private time(iso: string): string {
    const hass = this.hass;
    const look = { ...(this.look ?? CLOCK_LOOK), seconds: false };
    return digitalText({ now: new Date(iso), lang: (hass?.language || "en").replace("_", "-"), timeZone: hass?.config?.time_zone, locale: hass?.locale }, look);
  }

  private deg(v: number | undefined, unit: string): string {
    return typeof v === "number" ? `${formatNumber(this.hass, v, 0)}${unit}` : "";
  }

  protected render() {
    const unit = String(this.hass?.states[this.entity]?.attributes.temperature_unit ?? this.hass?.config?.unit_system?.temperature ?? "°C");
    if (this._state !== "ready") return html`<p class="note">${this.t(this._state === "loading" ? "wx_loading" : "wx_none")}</p>`;
    return html`<ul aria-label=${this.t("wx_today")}>
      ${this._list.map(
        (e) => html`<li>
          <span class="when">${this._kind === "hourly" ? this.time(e.datetime) : this.t("wx_today")}</span>
          <span class="ico" aria-hidden="true">${weatherIcon(e.condition)}</span>
          <b>${this._kind === "daily" && typeof e.templow === "number" ? `${this.deg(e.temperature, unit)} / ${this.deg(e.templow, unit)}` : this.deg(e.temperature, unit)}</b>
          ${typeof e.precipitation_probability === "number" && e.precipitation_probability > 0 ? html`<span class="rain" title=${this.t("wx_rain_chance")}>💧 ${Math.round(e.precipitation_probability)}%</span>` : nothing}
        </li>`,
      )}
    </ul>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 4px;
      }
      li {
        display: grid;
        grid-template-columns: 4.2em 1.6em 1fr auto;
        align-items: center;
        gap: 6px;
        font-variant-numeric: tabular-nums;
      }
      .when,
      .rain {
        color: var(--fp3d-muted);
        font-size: 12px;
      }
      .ico {
        text-align: center;
      }
      .note {
        margin: 0;
        color: var(--fp3d-muted);
        font-size: 13px;
      }
    `,
  ];
}

defineElement("fp3d-weather-forecast", Fp3dWeatherForecast);
