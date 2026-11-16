// "Start with the map" (#465): the note on an empty ground floor of the editor that offers the house from OpenStreetMap
// as the template to draw on. Its text says what is sent, when and to whom before anything is (the same privacy text as
// Settings > Surroundings); the Load button is the only thing that fetches. Loaded, the house's outline is the template
// (turned square to the grid, a corner at the origin, north set: surround-align.ts placeUnderPlan with nothing drawn) and
// the note says how to draw on it. The element changes nothing itself: it tells the editor (`map-start-loaded` with the
// new plan, `map-start-off` for "not now"), which saves, fits the view and remembers. Draws in the editor's shadow root
// (no shadow root of its own). A lazy chunk of its own (editor/lazy.ts), drawn only on an empty ground floor of an admin.

import { css, html, LitElement, nothing } from "lit";
import { defineElement } from "../define.ts";
import { loadOsm } from "../load-osm.ts";
import type { Building, Surroundings } from "../model.ts";
import { DEFAULT_RADIUS, errorKey, homeLocation, loaded } from "../surround-load.ts";
import { ownOutline } from "../surroundings.ts";
import type { HomeAssistant } from "../types.ts";
import { checkFits, messageBytes } from "../ws-size.ts";

/** What the note needs of the map bundle (tests hand in their own). */
export interface Osm {
  loadSurroundings(lat: number, lon: number, radius: number, b: Building, signal?: AbortSignal): Promise<{ surroundings: Surroundings; north: number }>;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const STYLE = css`
fp3d-map-start {
  display: block;
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 3;
  max-width: min(460px, calc(100% - 24px));
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--fp3d-accent);
  border-radius: 12px;
  background: var(--fp3d-chrome-solid);
  box-shadow: var(--fp3d-shadow);
  color: var(--fp3d-text);
  font-size: 13.5px;
}
fp3d-map-start h3 {
  margin: 0 0 6px;
  font-size: 15px;
}
fp3d-map-start p {
  margin: 0 0 8px;
}
fp3d-map-start .fp3d-map-start-small {
  color: var(--fp3d-muted, #94a3b8);
  font-size: 12px;
}
fp3d-map-start .fp3d-map-start-warn {
  color: var(--fp3d-warn, #ffd166);
}
fp3d-map-start .fp3d-map-start-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 700px) {
  fp3d-map-start {
    top: 6px;
    left: 8px;
    right: 8px;
    max-width: none;
    max-height: 60%;
    overflow: auto;
  }
}
`.cssText;

export class MapStart extends LitElement {
  static properties = {
    hass: { attribute: false },
    building: { attribute: false },
    t: { attribute: false },
    osm: { attribute: false },
    _busy: { state: true },
    _error: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare building: Building | null;
  declare t: Translate;
  /** Where the map bundle comes from (tests hand in their own). */
  declare osm: () => Promise<Osm>;
  private declare _busy: boolean;
  private declare _error: string | null;
  private _big = "";
  private abort: AbortController | null = null;

  constructor() {
    super();
    this.building = null;
    this.t = (k) => k;
    this.osm = loadOsm;
    this._busy = false;
    this._error = null;
  }

  protected createRenderRoot() {
    return this;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.abort?.abort();
  }

  /** The tap on Load: the one thing here that sends the location to the public map servers. */
  async load(): Promise<void> {
    const b = this.building;
    const at = homeLocation(this.hass);
    if (!b || !at || this._busy) return;
    this._busy = true;
    this._error = null;
    this.abort = new AbortController();
    try {
      const osm = await this.osm();
      const res = await osm.loadSurroundings(at.lat, at.lon, b.settings.surroundings?.radius ?? DEFAULT_RADIUS, b, this.abort.signal);
      // the plan may have changed while the map came in: the map goes under the newest one
      const next = loaded(this.building ?? b, res);
      try {
        checkFits({ type: "home_3d/building/save", building: next });
      } catch {
        this._big = (messageBytes({ type: "home_3d/building/save", building: next }) / 1048576).toFixed(1);
        this._error = "surround_err_big";
        return;
      }
      this.dispatchEvent(new CustomEvent("map-start-loaded", { detail: { building: next }, bubbles: true, composed: true }));
    } catch (e) {
      if (!this.abort?.signal.aborted) this._error = errorKey(e);
    } finally {
      this._busy = false;
      this.abort = null;
    }
  }

  private off(): void {
    this.dispatchEvent(new CustomEvent("map-start-off", { bubbles: true, composed: true }));
  }

  protected render() {
    const b = this.building;
    if (!b) return nothing;
    const t = this.t;
    const s = b.settings.surroundings;
    const ready = !!ownOutline(b);
    const none = !ready && !!s?.on && s.buildings.length > 0;
    const at = homeLocation(this.hass);
    const style = html`<style>
      ${STYLE}
    </style>`;
    if (ready || none) {
      return html`${style}<div role="note">
        <h3>🗺 ${t("map_start_title")}</h3>
        <p>${t(ready ? "map_start_ready" : "map_start_nohouse")}</p>
        <div class="fp3d-map-start-buttons"><button class="fp3d-btn fp3d-primary" @click=${() => this.off()}>${t("map_start_ok")}</button></div>
      </div>`;
    }
    return html`${style}<div role="note">
      <h3>🗺 ${t("map_start_title")}</h3>
      <p>${t("map_start_text")}</p>
      <p class="fp3d-map-start-small">${t("surround_privacy")}</p>
      ${at ? nothing : html`<p class="fp3d-map-start-warn" role="alert">${t("surround_no_location")}</p>`}
      ${this._error ? html`<p class="fp3d-map-start-warn" role="alert">${t(this._error, { mb: this._big })}</p>` : nothing}
      <div class="fp3d-map-start-buttons">
        <button class="fp3d-btn fp3d-primary" ?disabled=${!at || this._busy} @click=${() => void this.load()}>${this._busy ? t("surround_loading") : t("map_start_load")}</button>
        ${this._busy ? html`<button class="fp3d-btn" @click=${() => this.abort?.abort()}>${t("cancel")}</button>` : html`<button class="fp3d-btn" @click=${() => this.off()}>${t("map_start_later")}</button>`}
      </div>
    </div>`;
  }
}

defineElement("fp3d-map-start", MapStart);
