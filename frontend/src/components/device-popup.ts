// The small card that opens beside a device (#272 lights, #271 robot vacuums, #284 cameras): one element with one frame
// (name, state, close, a "More" link to Home Assistant's details) and a body per kind. A chunk of its own, loaded the
// first time one opens (view3d.ts). `mode="hover"` is the camera's floating preview: no controls, no pointer events.

import { formatDateTime, timeStyleOf } from "../time-text.ts";
import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing } from "lit";
import { entityName, isUnavailable } from "../devices.ts";
import { durationText, lightControls, popupKind, stillUrl, vacuumAreas, vacuumBusy, vacuumControls, vacuumRun } from "../device-popup-model.ts";
import { callServiceSafe } from "../failure.ts";
import { translate, type I18nKey } from "../i18n.ts";
import { openMoreInfo, stateText } from "../markers.ts";
import { tokens } from "../styles.ts";
import type { HassEntity, HomeAssistant } from "../types.ts";

const SWATCHES: [number, number, number][] = [
  [255, 181, 71],
  [255, 236, 210],
  [55, 224, 255],
  [91, 124, 255],
  [190, 90, 255],
  [255, 95, 210],
  [255, 70, 70],
  [120, 255, 150],
];

/** How long a camera still stays before the next one is fetched while the stream loads. */
const STILL_MS = 3000;

export class Fp3dDevicePopup extends LitElement {
  static properties = {
    hass: { attribute: false },
    entity: { attribute: false },
    mode: { reflect: true },
    noLook: { type: Boolean },
    low: { type: Boolean, reflect: true },
    _tick: { state: true },
    _areas: { state: true },
    _draft: { state: true },
    _streamUp: { state: true },
  };

  declare hass: HomeAssistant;
  declare entity: string;
  /** "card": a card with controls. "hover": a camera's floating live preview, nothing to press. */
  declare mode: "card" | "hover";
  /** The 2D plan has no camera to look through. */
  declare noLook: boolean;
  /** Tablet level: no blur. */
  declare low: boolean;
  private declare _tick: number;
  /** Rooms of a vacuum that Home Assistant can clean by name: [area id, name]. */
  private declare _areas: [string, string][];
  /** A slider being dragged, shown at once: its value by name. */
  private declare _draft: Record<string, number>;
  private declare _streamUp: boolean;
  private areasFor = "";
  private stream: (HTMLElement & { hass?: unknown }) | null = null;
  private streamFor = "";
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && this.mode !== "hover") this.close();
  };

  constructor() {
    super();
    this.mode = "card";
    this._tick = 0;
    this._areas = [];
    this._draft = {};
    this._streamUp = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("keydown", this.onKey);
    // a camera's still is refreshed while the stream loads or when it cannot play
    this.timer = setInterval(() => {
      if (popupKind(this.entity) === "camera" && !document.hidden) this._tick++;
    }, STILL_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.onKey);
    clearInterval(this.timer);
    // the stream ends with its element: nothing keeps playing behind a closed preview
    this.stream = null;
    this.streamFor = "";
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("entity")) this._draft = {};
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has("hass") && this.stream) this.stream.hass = this.hass;
    if (popupKind(this.entity) === "camera") this.startStream();
    if (popupKind(this.entity) === "vacuum") void this.loadAreas();
  }

  private t(key: I18nKey, vars?: Record<string, string | number>): string {
    return translate(this.hass, key, vars);
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  private more(): void {
    openMoreInfo(this, this.entity);
    this.close();
  }

  private call(domain: string, service: string, data: Record<string, unknown> = {}): void {
    callServiceSafe(this.hass, domain, service, { entity_id: this.entity, ...data }, (error) => this.t("service_failed", { error }));
  }

  /** A camera plays at once: Home Assistant's own player (HLS or WebRTC) in a picture-entity card; the still shows until it is there. */
  private startStream(): void {
    if (this.streamFor === this.entity) return;
    this.streamFor = this.entity;
    this.stream = null;
    this._streamUp = false;
    const id = this.entity;
    const w = window as unknown as { loadCardHelpers?: () => Promise<{ createCardElement: (c: unknown) => HTMLElement & { hass?: unknown } }> };
    if (!w.loadCardHelpers) return;
    w.loadCardHelpers()
      .then((h) => {
        if (this.streamFor !== id || !this.isConnected) return;
        const el = h.createCardElement({ type: "picture-entity", entity: id, camera_view: "live", show_name: false, show_state: false, tap_action: { action: "none" }, hold_action: { action: "none" } });
        el.hass = this.hass;
        this.stream = el;
        this._streamUp = true;
      })
      .catch(() => undefined);
  }

  private async loadAreas(): Promise<void> {
    const id = this.entity;
    const st = this.hass?.states[id];
    if (this.areasFor === id || !st || !vacuumControls(st).cleanArea) return;
    this.areasFor = id;
    try {
      const entry = await this.hass.callWS<{ options?: unknown }>({ type: "config/entity_registry/get", entity_id: id });
      if (this.entity === id) this._areas = vacuumAreas(this.hass, entry?.options);
    } catch {
      // not an admin, or an older Home Assistant: no room buttons
      if (this.entity === id) this._areas = [];
    }
  }

  // --- lights ---

  private renderLight(st: HassEntity) {
    const c = lightControls(st);
    const draft = this._draft;
    const pct = draft.bri ?? c.pct;
    const kelvin = draft.kelvin ?? c.kelvin ?? (c.temp ? Math.round((c.temp.min + c.temp.max) / 2) : 0);
    const hue = draft.hue ?? c.hue ?? 0;
    const slide = (name: string, set: (v: number) => void) => ({
      input: (e: Event) => (this._draft = { ...this._draft, [name]: Number((e.target as HTMLInputElement).value) }),
      change: (e: Event) => {
        set(Number((e.target as HTMLInputElement).value));
        const { [name]: _gone, ...rest } = this._draft;
        this._draft = rest;
      },
    });
    const bri = slide("bri", (v) => this.call("light", "turn_on", { brightness_pct: v }));
    const temp = slide("kelvin", (v) => this.call("light", "turn_on", { color_temp_kelvin: v }));
    const col = slide("hue", (v) => this.call("light", "turn_on", { hs_color: [v, 100] }));
    return html`<div class="dp-row">
        <button class="dp-power ${c.on ? "dp-on" : ""}" aria-pressed=${c.on} @click=${() => this.call("light", "toggle")}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>
          <span>${this.t(c.on ? "state_on" : "state_off")}</span>
        </button>
      </div>
      ${c.dim
        ? html`<label class="dp-field"
            ><span>${this.t("brightness")} <b>${pct} %</b></span>
            <input type="range" min="1" max="100" .value=${String(Math.max(1, pct))} aria-label=${this.t("brightness")} @input=${bri.input} @change=${bri.change}
          /></label>`
        : nothing}
      ${c.temp
        ? html`<label class="dp-field"
            ><span>${this.t("color_temp")} <b>${kelvin} K</b></span>
            <input class="dp-kelvin" type="range" min=${c.temp.min} max=${c.temp.max} step="50" .value=${String(kelvin)} aria-label=${this.t("color_temp")} @input=${temp.input} @change=${temp.change}
          /></label>`
        : nothing}
      ${c.color
        ? html`<label class="dp-field"
              ><span>${this.t("color")}</span>
              <input class="dp-hue" type="range" min="0" max="360" .value=${String(Math.round(hue))} aria-label=${this.t("color")} @input=${col.input} @change=${col.change}
            /></label>
            <div class="dp-swatches">
              ${SWATCHES.map(
                (s) => html`<button class="dp-swatch" style="background:rgb(${s.join(",")})" aria-label=${`RGB ${s.join(", ")}`} @click=${() => this.call("light", "turn_on", { rgb_color: s })}></button>`,
              )}
            </div>`
        : nothing}`;
  }

  // --- robot vacuums ---

  private vacuumState(state: string): string {
    const key = `dp_vac_${state}` as I18nKey;
    const text = this.t(key);
    return text === key ? state.replace(/_/g, " ") : text;
  }

  private renderVacuum(st: HassEntity) {
    const can = vacuumControls(st);
    const run = vacuumRun(this.hass, st);
    const busy = vacuumBusy(st.state);
    const lines: [string, string][] = [];
    if (run.battery !== null) lines.push([this.t("dp_vac_battery"), `${run.battery} %`]);
    if (run.when) lines.push([this.t("dp_vac_last_run"), formatDateTime(new Date(run.when), timeStyleOf(this.hass))]);
    if (run.area) lines.push([this.t("dp_vac_area"), run.area]);
    if (run.seconds !== null) lines.push([this.t("dp_vac_duration"), durationText(run.seconds)]);
    const btn = (label: string, act: () => void, on = false) => html`<button class="dp-btn ${on ? "dp-on" : ""}" @click=${act}>${label}</button>`;
    return html`<p class="dp-status">${this.vacuumState(st.state)}</p>
      ${lines.length ? html`<dl class="dp-facts">${lines.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>` : nothing}
      <div class="dp-buttons">
        ${can.start && (!busy || st.state === "paused" || st.state === "returning") ? btn(this.t(st.state === "paused" ? "dp_vac_resume" : "dp_vac_start"), () => this.call("vacuum", can.start === "start" ? "start" : "turn_on")) : nothing}
        ${can.pause && st.state === "cleaning" ? btn(this.t("dp_vac_pause"), () => this.call("vacuum", "pause")) : nothing}
        ${can.stop && busy ? btn(this.t("dp_vac_stop"), () => this.call("vacuum", "stop")) : nothing}
        ${can.home && st.state !== "docked" ? btn(this.t("dp_vac_home"), () => this.call("vacuum", "return_to_base"), st.state === "returning") : nothing}
        ${can.locate ? btn(this.t("dp_vac_locate"), () => this.call("vacuum", "locate")) : nothing}
      </div>
      ${can.cleanArea && this._areas.length
        ? html`<p class="dp-head">${this.t("dp_vac_rooms")}</p>
            <div class="dp-chips">${this._areas.map(([id, name]) => html`<button class="dp-chip" @click=${() => this.call("vacuum", "clean_area", { cleaning_area_id: [id] })}>${name}</button>`)}</div>`
        : nothing}`;
  }

  // --- cameras ---

  private renderCamera(st: HassEntity) {
    const src = isUnavailable(st) ? null : stillUrl(st, this._tick);
    const live = this._streamUp && this.stream;
    return html`<div class="dp-cam">
        ${src ? html`<img class=${live ? "dp-cam-under" : ""} src=${src} alt=${entityName(this.hass, this.entity)} />` : html`<span class="dp-note">${stateText(this.hass, st)}</span>`}
        ${live ? html`<div class="dp-cam-live">${this.stream}</div>` : nothing}
        <span class="dp-cam-badge">${live ? `● ${this.t("dp_cam_live")}` : this.t("dp_cam_loading")}</span>
      </div>
      ${this.mode === "hover" || this.noLook
        ? nothing
        : html`<button class="dp-more dp-look" @click=${() => this.dispatchEvent(new CustomEvent("camera-look", { detail: { entity: this.entity }, bubbles: true, composed: true }))}>${this.t("through_camera")}</button>`}`;
  }

  protected render() {
    const st = this.hass?.states[this.entity];
    if (!st) return nothing;
    const kind = popupKind(this.entity);
    const hover = this.mode === "hover";
    const body = isUnavailable(st) && kind !== "camera" ? html`<p class="dp-note">${stateText(this.hass, st) || this.t("state_unavailable")}</p>` : kind === "light" ? this.renderLight(st) : kind === "vacuum" ? this.renderVacuum(st) : kind === "camera" ? this.renderCamera(st) : nothing;
    return html`<div class="dp ${hover ? "dp-hover" : ""} dp-${kind ?? "other"}" role=${hover ? "presentation" : "dialog"} aria-label=${entityName(this.hass, this.entity)}>
      <div class="dp-top">
        <div class="dp-title">${entityName(this.hass, this.entity)}</div>
        ${hover ? nothing : html`<button class="dp-x" aria-label=${this.t("close")} @click=${() => this.close()}>✕</button>`}
      </div>
      ${body}
      ${hover ? nothing : html`<button class="dp-more" @click=${() => this.more()}>${this.t("dp_more")} …</button>`}
    </div>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
        position: absolute;
        z-index: 7;
      }
      :host([mode="hover"]) {
        pointer-events: none;
        z-index: 8;
      }
      .dp {
        width: 252px;
        box-sizing: border-box;
        padding: 12px 14px 8px;
        border-radius: 20px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        box-shadow: var(--fp3d-shadow), 0 0 0 1px var(--fp3d-line);
        backdrop-filter: blur(10px);
        animation: dp-in 140ms ease-out;
      }
      :host([low]) .dp {
        backdrop-filter: none;
        animation: none;
      }
      .dp-camera {
        width: 320px;
      }
      .dp-hover {
        width: 300px;
        padding-bottom: 12px;
      }
      @keyframes dp-in {
        from {
          opacity: 0;
          transform: scale(0.92);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .dp {
          animation: none;
        }
      }
      .dp-top {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dp-title {
        flex: 1;
        min-width: 0;
        font: 700 14.5px var(--fp3d-title-font);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dp-x {
        border: 0;
        background: none;
        color: var(--fp3d-muted);
        font: inherit;
        font-size: 15px;
        min-width: 32px;
        min-height: 32px;
        cursor: pointer;
        border-radius: 50%;
      }
      .dp-x:hover {
        color: var(--fp3d-text);
      }
      .dp-row {
        display: flex;
        margin: 8px 0 4px;
      }
      .dp-power {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 0 16px;
        border: 0;
        border-radius: 999px;
        background: var(--fp3d-bg2, #16223a);
        color: var(--fp3d-text);
        box-shadow: inset 0 0 0 2px var(--fp3d-line);
        font: 600 14px var(--fp3d-title-font);
        cursor: pointer;
      }
      .dp-on {
        color: #1a1204;
        background: var(--fp3d-warm);
        box-shadow: 0 0 18px rgba(255, 181, 71, 0.45);
      }
      .dp-field {
        display: grid;
        gap: 2px;
        margin-top: 8px;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .dp-field b {
        color: var(--fp3d-text);
        font-variant-numeric: tabular-nums;
      }
      .dp-field input[type="range"] {
        width: 100%;
        margin: 2px 0;
        accent-color: var(--fp3d-accent);
        min-height: 28px;
      }
      .dp-kelvin,
      .dp-hue {
        appearance: none;
        height: 10px;
        border-radius: 5px;
        min-height: 10px !important;
        background: linear-gradient(90deg, #ffb347, #fff1dc, #cfe3ff);
      }
      .dp-hue {
        background: linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
      }
      .dp-kelvin::-webkit-slider-thumb,
      .dp-hue::-webkit-slider-thumb {
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid #fff;
        background: rgba(0, 0, 0, 0.35);
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
      }
      .dp-kelvin::-moz-range-thumb,
      .dp-hue::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid #fff;
        background: rgba(0, 0, 0, 0.35);
      }
      .dp-swatches {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      .dp-swatch {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.25);
        cursor: pointer;
      }
      .dp-status {
        margin: 6px 0 2px;
        font: 600 15px var(--fp3d-title-font);
      }
      .dp-facts {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 2px 12px;
        margin: 6px 0;
        font-size: 12.5px;
      }
      .dp-facts dt {
        color: var(--fp3d-muted);
      }
      .dp-facts dd {
        margin: 0;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .dp-buttons,
      .dp-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .dp-btn,
      .dp-chip {
        min-height: 36px;
        padding: 0 12px;
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        background: var(--fp3d-bg2, #16223a);
        color: var(--fp3d-text);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      .dp-chip {
        min-height: 30px;
        font-size: 12.5px;
      }
      .dp-head {
        margin: 10px 0 0;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .dp-cam {
        position: relative;
        margin: 8px 0 4px;
        border-radius: 12px;
        overflow: hidden;
        background: #000;
        aspect-ratio: 16 / 9;
      }
      .dp-cam img,
      .dp-cam-live {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .dp-cam-live > * {
        display: block;
        width: 100%;
        height: 100%;
      }
      .dp-cam-badge {
        position: absolute;
        left: 8px;
        bottom: 6px;
        padding: 1px 7px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        font-size: 11px;
      }
      .dp-more {
        display: block;
        margin: 4px 0 0 auto;
        border: 0;
        background: none;
        color: var(--fp3d-accent);
        font: inherit;
        font-size: 13px;
        padding: 6px 2px;
        min-height: 32px;
        cursor: pointer;
      }
      .dp-look {
        width: 100%;
        margin-top: 2px;
        text-align: center;
      }
      .dp-note {
        color: var(--fp3d-muted);
        margin: 8px 0;
      }
      button:focus-visible,
      input:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 2px;
      }
      @media (pointer: coarse) {
        .dp-btn,
        .dp-chip,
        .dp-power {
          min-height: 44px;
        }
        .dp-swatch {
          width: 44px;
          height: 44px;
        }
        .dp-x {
          min-width: 44px;
          min-height: 44px;
        }
      }
    `,
  ];
}

defineElement("fp3d-device-popup", Fp3dDevicePopup);
