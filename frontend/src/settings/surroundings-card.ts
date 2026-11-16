// Settings > Surroundings (#464): the neighbourhood map from OpenStreetMap (surroundings.ts, #462). Load it once at Home
// Assistant's location, turn and move it under the plan, hide or show single houses on a small map, draw the neighbours
// as outlines only. A chunk of the Settings bundle of its own, drawn only when the card is shown. The fetching and the
// best-fit alignment are in the map bundle (load-osm.ts), loaded when an admin taps Load surroundings or Align again.
// The texts come from the page (`t`). Ported from NeonPlan 3D 3.3.0 - 3.4.1 (MIT, Mastershort).
//
// The card only changes the plan it is given and tells the page (`settings-edit`), which saves it like any setting.

import { css, html, LitElement, nothing, svg } from "lit";
import { defineElement } from "../define.ts";
import { loadOsm } from "../load-osm.ts";
import type { Building, Surroundings, Vec2 } from "../model.ts";
import { controls, tokens } from "../styles.ts";
import { footprint, hiddenBuildings, homeBuilding, mapToPlan, OSM_ATTRIBUTION, OSM_COPYRIGHT, ownUnderPlan, planMiddle, SURROUND_RADII, turnMap } from "../surroundings.ts";
import { DEFAULT_RADIUS, errorKey, homeLocation, loaded } from "../surround-load.ts";
import type { HomeAssistant } from "../types.ts";
import { checkFits, messageBytes } from "../ws-size.ts";

/** What the card needs of the map bundle (tests hand in their own). */
export interface Osm {
  loadSurroundings(lat: number, lon: number, radius: number, b: Building, signal?: AbortSignal): Promise<{ surroundings: Surroundings; north: number }>;
  placeUnderPlan(s: Pick<Surroundings, "buildings">, own: number | null, b: Building): { x: number; z: number; north: number };
}

export { DEFAULT_RADIUS, errorKey, homeLocation, loaded };

/** One step of an arrow (m). */
export const STEP = 0.5;
/** The width of the small map (m). */
const SPAN = 70;

/** The plan with its map changed by `fn` (shallow copies: the map's lists are shared, a list `fn` changes is copied first). */
function withMap(b: Building, fn: (sur: Surroundings, next: Building) => void): Building {
  const s = b.settings.surroundings;
  if (!s) return b;
  const sur: Surroundings = { ...s };
  const next: Building = { ...b, settings: { ...b.settings, surroundings: sur } };
  fn(sur, next);
  return next;
}

/** Moved by hand: the house under the plan is the own house now (#1110); undefined while nothing is drawn. */
function follow(sur: Surroundings, next: Building): void {
  const own = ownUnderPlan(sur, next);
  if (own !== undefined) sur.own = own;
}

/** The plan with the map turned by `delta` degrees about the house's middle (north turns with it, so the sun follows). */
export function turned(b: Building, delta: number): Building {
  return withMap(b, (sur, next) => {
    const t = turnMap(sur, next.settings.north ?? 0, delta, planMiddle(next) ?? [0, 0]);
    sur.x = t.x;
    sur.z = t.z;
    next.settings.north = t.north;
    follow(sur, next);
  });
}

/** The plan with the map moved by (dx, dz) metres on the screen's axes (right and down are positive). */
export function shifted(b: Building, dx: number, dz: number): Building {
  return withMap(b, (sur, next) => {
    sur.x = Math.round((sur.x + dx) * 100) / 100;
    sur.z = Math.round((sur.z + dz) * 100) / 100;
    follow(sur, next);
  });
}

/** The plan with the map fitted under the rooms again (the map bundle's best fit). */
export function realigned(osm: Pick<Osm, "placeUnderPlan">, b: Building): Building {
  return withMap(b, (sur, next) => {
    // null: no house of the map under the plan (moved away from a wrong one by hand): the home's location then goes to the plan's middle
    const own = sur.own === undefined ? homeBuilding(sur) : sur.own;
    const place = osm.placeUnderPlan(sur, own, next);
    sur.own = own;
    sur.x = place.x;
    sur.z = place.z;
    next.settings.north = place.north;
  });
}

/** The plan with house `i` of the map hidden when it is shown, shown when it is hidden; only a choice that differs from the automatic one is kept. */
export function toggled(b: Building, i: number): Building {
  return withMap(b, (sur, next) => {
    const wantHidden = !hiddenBuildings(sur, next).has(i);
    const auto = hiddenBuildings({ ...sur, hide: [], show: [] }, next).has(i);
    const hide = (sur.hide ?? []).filter((k) => k !== i);
    const show = (sur.show ?? []).filter((k) => k !== i);
    if (wantHidden !== auto) (wantHidden ? hide : show).push(i);
    if (hide.length) sur.hide = hide;
    else delete sur.hide;
    if (show.length) sur.show = show;
    else delete sur.show;
  });
}

export class Fp3dSurroundSettings extends LitElement {
  static properties = {
    hass: { attribute: false },
    building: { attribute: false },
    t: { attribute: false },
    osm: { attribute: false },
    _radius: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare building: Building | null;
  /** The page's texts (the panel's translate). */
  declare t: (key: string, vars?: Record<string, string | number>) => string;
  /** Where the map bundle comes from (tests hand in their own). */
  declare osm: () => Promise<Osm>;
  private declare _radius: number | null;
  private declare _busy: boolean;
  private declare _error: string | null;
  private abort: AbortController | null = null;

  constructor() {
    super();
    this.building = null;
    this.t = (key) => key;
    this.osm = loadOsm;
    this._radius = null;
    this._busy = false;
    this._error = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.abort?.abort();
  }

  private get map(): Surroundings | null {
    return this.building?.settings.surroundings ?? null;
  }

  /** Saves a new plan: refused with a clear message when it would not fit in one message to Home Assistant (#375). */
  private commit(next: Building, key: string | null = null): boolean {
    try {
      checkFits({ type: "home_3d/building/save", building: next });
    } catch {
      this._big = (messageBytes({ type: "home_3d/building/save", building: next }) / 1048576).toFixed(1);
      this._error = "surround_err_big";
      return false;
    }
    this._error = null;
    this.dispatchEvent(new CustomEvent("settings-edit", { detail: { building: next, key }, bubbles: true, composed: true }));
    return true;
  }

  /** The size of the plan that did not fit (MB), for the message. */
  private _big = "";

  /** Load surroundings / Load again: the tap that sends the location to the public map servers. */
  async load(): Promise<void> {
    const b = this.building;
    const at = homeLocation(this.hass);
    if (!b || !at || this._busy) return;
    this._busy = true;
    this._error = null;
    this.abort = new AbortController();
    try {
      const osm = await this.osm();
      const res = await osm.loadSurroundings(at.lat, at.lon, this._radius ?? this.map?.radius ?? DEFAULT_RADIUS, b, this.abort.signal);
      // the plan may have changed while the map came in: the map goes under the newest one
      const now = this.building ?? b;
      this.commit(loaded(now, { surroundings: res.surroundings, north: res.north }));
    } catch (e) {
      if (!this.abort?.signal.aborted) this._error = errorKey(e);
    } finally {
      this._busy = false;
      this.abort = null;
    }
  }

  private cancel(): void {
    this.abort?.abort();
  }

  async realign(): Promise<void> {
    const b = this.building;
    if (!b?.settings.surroundings) return;
    try {
      const osm = await this.osm();
      this.commit(realigned(osm, this.building ?? b));
    } catch (e) {
      this._error = errorKey(e);
    }
  }

  private removeMap(): void {
    const b = this.building;
    if (b) this.commit({ ...b, settings: { ...b.settings, surroundings: null } });
  }

  private set(change: (s: Surroundings) => Partial<Surroundings>): void {
    const b = this.building;
    const s = this.map;
    if (b && s) this.commit({ ...b, settings: { ...b.settings, surroundings: { ...s, ...change(s) } } });
  }

  private nudge(next: (b: Building) => Building): void {
    const b = this.building;
    if (b) this.commit(next(b), "surround:move");
  }

  /** A small map of the house and the houses next to it: tapping one hides or shows it. Hidden ones are dashed yellow. */
  private renderPick(s: Surroundings, b: Building) {
    const north = b.settings.north ?? 0;
    const mid = planMiddle(b) ?? ([s.x, s.z] as Vec2);
    const [x0, z0] = [mid[0] - SPAN / 2, mid[1] - SPAN / 2];
    const place = (ring: Vec2[]) => ring.map((p) => mapToPlan(s, north, p));
    // whether a line or outline reaches into the picture (a long street has its ends far outside)
    const near = (q: Vec2[]) => !(q.every((p) => p[0] < x0) || q.every((p) => p[0] > x0 + SPAN) || q.every((p) => p[1] < z0) || q.every((p) => p[1] > z0 + SPAN));
    const pts = (q: Vec2[]) => q.map((p) => p.join(",")).join(" ");
    const hidden = hiddenBuildings(s, b);
    const flip = (i: number) => {
      const cur = this.building;
      if (cur) this.commit(toggled(cur, i));
    };
    return html`<svg class="pick" viewBox="${x0} ${z0} ${SPAN} ${SPAN}" role="group" aria-label=${this.t("surround_pick")}>
      ${s.areas.map((a) => ({ k: a.k, q: place(a.p) })).filter((a) => near(a.q)).map((a) => svg`<polygon class=${`area ${a.k}`} points=${pts(a.q)} />`)}
      ${s.ways.map((w) => ({ k: w.k, w: w.w, q: place(w.p) })).filter((w) => near(w.q)).map((w) => svg`<polyline class=${`way ${w.k}`} points=${pts(w.q)} stroke-width=${Math.max(0.6, w.w)} />`)}
      ${footprint(b).map((r) => svg`<polygon class="room" points=${pts(r)} />`)}
      ${s.buildings.map((bd, i) => {
        const q = place(bd.p);
        if (!near(q)) return nothing;
        const off = hidden.has(i);
        const label = this.t(off ? "surround_pick_show" : "surround_pick_hide");
        return svg`<polygon
          class=${off ? "house hid" : "house"}
          data-i=${i}
          points=${pts(q)}
          role="button"
          tabindex="0"
          aria-pressed=${off ? "true" : "false"}
          aria-label=${label}
          @click=${() => flip(i)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              flip(i);
            }
          }}
        ><title>${label}</title></polygon>`;
      })}
    </svg>`;
  }

  protected render() {
    const b = this.building;
    if (!b) return nothing;
    const t = this.t;
    const s = this.map;
    const at = homeLocation(this.hass);
    const radius = this._radius ?? s?.radius ?? DEFAULT_RADIUS;
    const busy = this._busy;
    const when = s ? new Date(s.at * 1000).toLocaleDateString(this.hass?.language) : "";
    const north = Math.round(b.settings.north ?? 0);
    const turn = (deg: number, key: string, glyph: string) =>
      html`<button class="fp3d-btn" title=${t(key, { deg: Math.abs(deg) })} aria-label=${t(key, { deg: Math.abs(deg) })} @click=${() => this.nudge((cur) => turned(cur, deg))}>${glyph} ${Math.abs(deg)}°</button>`;
    const move = (dx: number, dz: number, key: string, glyph: string) =>
      html`<button class="fp3d-btn" title=${t(key)} aria-label=${t(key)} @click=${() => this.nudge((cur) => shifted(cur, dx, dz))}>${glyph}</button>`;
    return html`<p class="sub">${t("surround_privacy")}</p>
      <p class="sub">${t("surround_old_versions")}</p>
      ${at ? nothing : html`<p class="warn" role="alert">${t("surround_no_location")}</p>`}
      <div class="row">
        <span class="lbl" id="radius">${t("surround_radius")}</span>
        <div class="fp3d-seg" role="group" aria-labelledby="radius">
          ${SURROUND_RADII.map((r) => html`<button aria-pressed=${r === radius ? "true" : "false"} ?disabled=${busy} @click=${() => (this._radius = r)}>${r} m</button>`)}
        </div>
      </div>
      <div class="row">
        <button class="fp3d-btn fp3d-primary" ?disabled=${!at || busy} @click=${() => void this.load()}>${busy ? t("surround_loading") : s ? t("surround_reload") : t("surround_load")}</button>
        ${busy ? html`<button class="fp3d-btn" @click=${() => this.cancel()}>${t("cancel")}</button>` : nothing}
        ${s && !busy ? html`<button class="fp3d-btn fp3d-danger" @click=${() => this.removeMap()}>${t("surround_remove")}</button>` : nothing}
      </div>
      ${this._error ? html`<p class="warn" role="alert">${t(this._error, { mb: this._big })}</p>` : nothing}
      ${s
        ? html`<label class="check"><input type="checkbox" .checked=${s.on} @change=${(e: Event) => this.set(() => ({ on: (e.target as HTMLInputElement).checked }))} /> ${t("surround_show")}</label>
            <label class="check"><input type="checkbox" .checked=${s.flat === true} @change=${(e: Event) => this.set(() => ({ flat: (e.target as HTMLInputElement).checked }))} /> ${t("surround_flat")}</label>
            <p class="sub">${t("surround_stats", { buildings: s.buildings.length - hiddenBuildings(s, b).size, ways: s.ways.length, trees: s.trees.length, date: when })}</p>
            <h4>${t("surround_align")}</h4>
            <p class="sub">${t(typeof s.own === "number" ? "surround_align_hint" : "surround_no_own")}</p>
            <div class="row">${turn(-90, "surround_turn_left", "↺")}${turn(-1, "surround_turn_left", "↺")}${turn(1, "surround_turn_right", "↻")}${turn(90, "surround_turn_right", "↻")}</div>
            <div class="row">
              ${move(-STEP, 0, "surround_move_left", "←")}${move(0, -STEP, "surround_move_up", "↑")}${move(0, STEP, "surround_move_down", "↓")}${move(STEP, 0, "surround_move_right", "→")}
              <button class="fp3d-btn" @click=${() => void this.realign()}>${t("surround_realign")}</button>
            </div>
            <p class="sub">${t("surround_north", { deg: north })}</p>
            <h4>${t("surround_pick")}</h4>
            <p class="sub">${t("surround_pick_hint")}</p>
            ${this.renderPick(s, b)}`
        : nothing}
      <p class="sub credit"><a href=${OSM_COPYRIGHT} target="_blank" rel="noopener">${OSM_ATTRIBUTION}</a></p>`;
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        display: block;
      }
      .sub {
        color: var(--fp3d-muted, #94a3b8);
        font-size: 12.5px;
        margin: 0 0 10px;
      }
      .warn {
        margin: 0 0 10px;
        padding: 8px 10px;
        border: 1px solid var(--fp3d-warn, #ffd166);
        border-radius: 8px;
        font-size: 13px;
      }
      h4 {
        margin: 16px 0 4px;
        font-size: 14px;
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin: 0 0 10px;
      }
      .lbl {
        font-size: 13px;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 8px;
        font-size: 13.5px;
      }
      .credit a {
        color: inherit;
      }
      .pick {
        display: block;
        width: 100%;
        max-width: 360px;
        aspect-ratio: 1;
        border-radius: 8px;
        background: #0a0e1c;
      }
      .pick polygon,
      .pick polyline {
        vector-effect: non-scaling-stroke;
      }
      .area {
        fill: rgba(61, 224, 160, 0.1);
        stroke: none;
      }
      .area.water {
        fill: rgba(55, 160, 255, 0.2);
      }
      .way {
        fill: none;
        stroke: rgba(150, 160, 190, 0.3);
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .way.water {
        stroke: rgba(55, 160, 255, 0.4);
      }
      .room {
        fill: rgba(55, 224, 255, 0.25);
        stroke: #37e0ff;
        pointer-events: none;
      }
      .house {
        fill: rgba(91, 124, 255, 0.18);
        stroke: #5b7cff;
        stroke-width: 1.5;
        cursor: pointer;
      }
      .house.hid {
        fill: none;
        stroke: #ffd166;
        stroke-width: 2;
        stroke-dasharray: 6 4;
      }
      .house:focus-visible {
        outline: 2px solid var(--fp3d-accent, #37e0ff);
      }
    `,
  ];
}

defineElement("fp3d-surround-settings", Fp3dSurroundSettings);
