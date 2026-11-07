// Robot vacuum maps in the editor (#350). Two elements, one lazy chunk of the editor (editor/lazy.ts):
// - <fp3d-vacuum-panel>, a section of the floor's side panel: the maps on this floor (a map camera each: dreame_vacuum's
//   camera.<name>_map or the Xiaomi Cloud Map Extractor's camera), their robot, opacity and View switch, and "Align".
// - <fp3d-vacuum-plan>, drawn over the plan while one map is aligned: the map's picture where it lies now, the picked
//   pairs, and a bar that says what to tap. Aligning takes pairs of taps: a spot on the map picture, then the same spot
//   on the plan (a wall corner, the dock). One pair moves the picture there, two turn and scale it, three also take out
//   any skew; a fourth replaces the oldest. The pairs are stored in the robot's own coordinates, so a new map picture
//   (or a turned one) stays aligned.
// Both draw in the editor's shadow root (no shadow root of their own) and change the plan through the editor
// (`host.change`), so undo, saving and the 3D pane work as for any edit. Taps reach the plan element through the
// editor's `_vacPick` (pointer.ts), the way a pet's place is picked.

import { css, html, LitElement, nothing, svg } from "lit";
import { defineElement } from "../define.ts";
import { uid, type Building, type Floor, type VacuumMap } from "../model.ts";
import type { HomeAssistant } from "../types.ts";
import { apply, compose, fetchMapImage, floorCentre, imageToPlan, invert, isMapCamera, readMapCamera, type Affine, type Pt } from "../vacuum-map.ts";
import type { Fp3dEditor } from "./editor.ts";

const DEFAULT_OPACITY = 0.6;
/** Rounded to 1/d (d = 10: tenths). */
const round = (v: number, d: number) => Math.round(v * d) / d;

const STYLE = css`
fp3d-vacuum-panel {
  display: block;
}
.fp3d-vac-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 10px;
  align-items: end;
  padding: 10px 0;
  border-top: 1px solid var(--fp3d-line, rgba(127, 127, 127, 0.25));
}
.fp3d-vac-row > .fp3d-wide,
.fp3d-vac-title {
  grid-column: 1 / -1;
}
.fp3d-vac-row select,
.fp3d-vac-row input[type="range"] {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
.fp3d-vac-title {
  font-weight: 600;
  overflow-wrap: anywhere;
}
fp3d-vacuum-plan {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}
fp3d-vacuum-plan img {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  image-rendering: pixelated;
  outline: 2px dashed var(--fp3d-accent, #16b4d8);
}
fp3d-vacuum-plan svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.fp3d-vac-pair circle {
  fill: var(--fp3d-accent, #16b4d8);
  stroke: #fff;
  stroke-width: 2;
}
.fp3d-vac-pair line {
  stroke: var(--fp3d-accent, #16b4d8);
  stroke-width: 2;
  stroke-dasharray: 4 3;
}
.fp3d-vac-pair text {
  fill: #fff;
  font: 600 11px system-ui, sans-serif;
  text-anchor: middle;
  dominant-baseline: central;
}
.fp3d-vac-pending {
  fill: none;
  stroke: #ff9f1c;
  stroke-width: 3;
}
.fp3d-vac-robot {
  fill: #fff;
  stroke: #1d2733;
  stroke-width: 2;
}
.fp3d-vac-dock {
  fill: #3ddc84;
  stroke: #1d2733;
  stroke-width: 2;
}
.fp3d-vac-bar {
  position: absolute;
  left: 50%;
  top: 10px;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 10px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--fp3d-panel, rgba(20, 26, 34, 0.92));
  color: var(--fp3d-text, #fff);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  font-size: 13px;
}
`.cssText;

type HostEditor = Fp3dEditor & { _vacAlign: string | null; _vacPick: ((p: Pt) => void) | null };

const mapsOf = (doc: Building) => doc.settings.vacuum_maps ?? [];

/** The map cameras Home Assistant has (sorted by name). */
export function mapCameras(hass: HomeAssistant | undefined): string[] {
  const states = hass?.states ?? {};
  return Object.keys(states)
    .filter((id) => isMapCamera(id, states[id]?.attributes as Record<string, unknown>))
    .sort();
}

const nameOf = (hass: HomeAssistant | undefined, id: string) => (hass?.states[id]?.attributes?.friendly_name as string | undefined) || id;

/** A guess at the robot of a map camera: camera.<name>_map(_N) -> vacuum.<name>, when Home Assistant has it. */
export function guessVacuum(hass: HomeAssistant | undefined, camera: string): string | null {
  const id = `vacuum.${camera.slice(7).replace(/_map(_\d+)?$/, "")}`;
  return hass?.states[id] ? id : null;
}

/** Change one map of the plan through the editor. */
function changeMap(host: HostEditor, id: string, patch: (m: VacuumMap) => void): void {
  host.change((doc) => {
    const m = doc.settings.vacuum_maps?.find((x) => x.id === id);
    if (m) patch(m);
  });
}

export class VacuumPanel extends LitElement {
  static properties = {
    host: { attribute: false },
    doc: { attribute: false },
    floor: { attribute: false },
    hass: { attribute: false },
    align: { attribute: false },
    _open: { state: true },
  };

  declare host: HostEditor;
  declare doc: Building;
  declare floor: Floor;
  declare hass: HomeAssistant | undefined;
  declare align: string | null;
  private declare _open: boolean;

  constructor() {
    super();
    this.align = null;
    this._open = false;
  }

  protected createRenderRoot() {
    return this;
  }

  private t(key: string, vars?: Record<string, string | number>): string {
    return this.host.t(key as never, vars);
  }

  private add(camera: string): void {
    if (!camera) return;
    const floorId = this.floor.id;
    const map: VacuumMap = { id: uid("vac"), camera, floor_id: floorId, vacuum: guessVacuum(this.hass, camera), points: [], opacity: DEFAULT_OPACITY, show: true };
    this.host.change((doc) => {
      doc.settings.vacuum_maps = [...mapsOf(doc), map];
    });
    // a new map is aligned straight away
    this.host._vacAlign = map.id;
  }

  private dropMap(id: string): void {
    if (this.host._vacAlign === id) this.host._vacAlign = null;
    this.host.change((doc) => {
      doc.settings.vacuum_maps = mapsOf(doc).filter((m) => m.id !== id);
    });
  }

  render() {
    const here = mapsOf(this.doc).filter((m) => m.floor_id === this.floor.id);
    const cameras = mapCameras(this.hass);
    const used = new Set(mapsOf(this.doc).map((m) => m.camera));
    const free = cameras.filter((c) => !used.has(c));
    const vacuums = Object.keys(this.hass?.states ?? {})
      .filter((id) => id.startsWith("vacuum."))
      .sort();
    const editable = this.host.isEditor;
    return html`<style>${STYLE}</style>
      <details class="fp3d-section" ?open=${this._open || here.length > 0 || !!this.align} @toggle=${(e: Event) => (this._open = (e.target as HTMLDetailsElement).open)}>
        <summary>${this.t("st_vacuum_maps")}</summary>
        <div class="fp3d-form">
          ${here.map((m) => {
            const cam = readMapCamera(this.hass?.states[m.camera]?.attributes as Record<string, unknown>);
            const aligning = this.align === m.id;
            const pairs = m.points?.length ?? 0;
            return html`<div class="fp3d-vac-row">
              <div class="fp3d-vac-title">🧹 ${nameOf(this.hass, m.camera)}</div>
              ${!cam.calibration ? html`<p class="fp3d-sub fp3d-wide">${this.t("vac_no_map")}</p>` : nothing}
              <label class="fp3d-field"
                >${this.t("vac_vacuum")}
                <select ?disabled=${!editable} @change=${(e: Event) => changeMap(this.host, m.id, (x) => (x.vacuum = (e.target as HTMLSelectElement).value || null))}>
                  <option value="" ?selected=${!m.vacuum}>${this.t("no_ha_floor")}</option>
                  ${[...new Set([...vacuums, ...(m.vacuum ? [m.vacuum] : [])])].map((id) => html`<option value=${id} ?selected=${m.vacuum === id}>${nameOf(this.hass, id)}</option>`)}
                </select></label
              >
              <label class="fp3d-field"
                >${this.t("background_opacity")}
                <input type="range" min="0.1" max="1" step="0.05" .value=${String(m.opacity ?? DEFAULT_OPACITY)} ?disabled=${!editable} @change=${(e: Event) => changeMap(this.host, m.id, (x) => (x.opacity = parseFloat((e.target as HTMLInputElement).value)))}
              /></label>
              <label class="fp3d-check fp3d-wide"
                ><input type="checkbox" .checked=${m.show !== false} ?disabled=${!editable} @change=${(e: Event) => changeMap(this.host, m.id, (x) => (x.show = (e.target as HTMLInputElement).checked))} />
                ${this.t("vac_show")}</label
              >
              ${editable
                ? html`<button class="fp3d-btn fp3d-wide ${aligning ? "fp3d-primary" : ""}" aria-pressed=${aligning} ?disabled=${!cam.calibration} @click=${() => (this.host._vacAlign = aligning ? null : m.id)}>
                      📐 ${this.t(aligning ? "done" : "vac_align")}
                    </button>
                    <p class="fp3d-sub fp3d-wide">${this.t("vac_pairs", { n: pairs })}</p>
                    <button class="fp3d-btn" ?disabled=${!pairs} @click=${() => changeMap(this.host, m.id, (x) => (x.points = []))}>${this.t("vac_align_reset")}</button>
                    <button class="fp3d-btn fp3d-danger" @click=${() => this.dropMap(m.id)}>${this.t("delete")}</button>`
                : nothing}
            </div>`;
          })}
          ${editable && free.length
            ? html`<label class="fp3d-field fp3d-wide"
                >${this.t("vac_add")}
                <select @change=${(e: Event) => {
                  const sel = e.target as HTMLSelectElement;
                  this.add(sel.value);
                  sel.value = "";
                }}>
                  <option value="" selected>…</option>
                  ${free.map((id) => html`<option value=${id}>${nameOf(this.hass, id)}</option>`)}
                </select></label
              >`
            : nothing}
        </div>
      </details>`;
  }
}

export class VacuumPlan extends LitElement {
  static properties = {
    host: { attribute: false },
    view: { attribute: false },
    doc: { attribute: false },
    hass: { attribute: false },
    mapId: { attribute: false },
    _url: { state: true },
    _size: { state: true },
    _pending: { state: true },
    _error: { state: true },
  };

  declare host: HostEditor;
  declare view: { scale: number; ox: number; oy: number };
  declare doc: Building;
  declare hass: HomeAssistant | undefined;
  declare mapId: string;
  private declare _url: string | null;
  private declare _size: Pt | null;
  /** The first tap of a pair: the spot on the robot's map (its own coordinates), waiting for its place on the plan. */
  private declare _pending: Pt | null;
  private declare _error: boolean;
  private loadedFor = "";

  constructor() {
    super();
    this._url = null;
    this._size = null;
    this._pending = null;
    this._error = false;
  }

  protected createRenderRoot() {
    return this;
  }

  private get map(): VacuumMap | undefined {
    return mapsOf(this.doc).find((m) => m.id === this.mapId);
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.host) this.host._vacPick = (p) => this.pick(p);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.host?._vacPick) this.host._vacPick = null;
    if (this._url) URL.revokeObjectURL(this._url);
    this._url = null;
    this.loadedFor = "";
  }

  protected willUpdate(): void {
    if (this.host) this.host._vacPick = (p) => this.pick(p);
    const cam = this.map?.camera ?? "";
    if (cam && cam !== this.loadedFor) {
      this.loadedFor = cam;
      void this.load(cam);
    }
  }

  private async load(camera: string): Promise<void> {
    try {
      const blob = await fetchMapImage(this.hass as never, camera, this.hass?.states[camera]?.attributes?.access_token);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      await img.decode();
      if (this.loadedFor !== camera) return URL.revokeObjectURL(url);
      if (this._url) URL.revokeObjectURL(this._url);
      this._url = url;
      this._size = [img.naturalWidth, img.naturalHeight];
      this._error = false;
    } catch {
      this._error = true;
    }
  }

  private t(key: string, vars?: Record<string, string | number>): string {
    return this.host.t(key as never, vars);
  }

  /** image -> plan and vacuum -> plan as the map lies now (null: no calibration or no picture yet). */
  private transforms(): { ip: Affine; vp: Affine } | null {
    const m = this.map;
    if (!m || !this._size) return null;
    const cal = readMapCamera(this.hass?.states[m.camera]?.attributes as Record<string, unknown>).calibration;
    const floor = this.doc.floors.find((f) => f.id === m.floor_id);
    const ip = imageToPlan(cal, this._size, m.points ?? [], floorCentre(floor?.rooms ?? []));
    return ip && cal ? { ip, vp: compose(ip, cal) } : null;
  }

  /** A tap in the plan: the spot on the map, then the same spot on the plan (a pair, the oldest of four dropped). */
  private pick(world: Pt): void {
    const tr = this.transforms();
    const m = this.map;
    if (!tr || !m) return;
    if (!this._pending) {
      const pv = invert(tr.vp);
      if (!pv) return;
      const v = apply(pv, world);
      this._pending = [round(v[0], 10), round(v[1], 10)];
      return;
    }
    const pair = { v: this._pending, p: [round(world[0], 1000), round(world[1], 1000)] as Pt };
    this._pending = null;
    changeMap(this.host, m.id, (x) => (x.points = [...(x.points ?? []), pair].slice(-3)));
  }

  private undo(): void {
    if (this._pending) {
      this._pending = null;
      return;
    }
    const m = this.map;
    if (m?.points?.length) changeMap(this.host, m.id, (x) => (x.points = (x.points ?? []).slice(0, -1)));
  }

  render() {
    const m = this.map;
    if (!m) return nothing;
    const { scale, ox, oy } = this.view;
    const screen: Affine = [scale, 0, 0, scale, ox, oy];
    const tr = this.transforms();
    const toScreen = (p: Pt) => apply(screen, p);
    const cam = readMapCamera(this.hass?.states[m.camera]?.attributes as Record<string, unknown>);
    const pairs = m.points ?? [];
    const step = !tr ? (this._error || !cam.calibration ? "vac_no_map" : "") : this._pending ? "vac_tap_plan" : "vac_tap_map";
    let img: unknown = nothing;
    let marks: unknown = nothing;
    if (tr && this._url) {
      const s = compose(screen, tr.ip);
      img = html`<img src=${this._url} alt="" style=${`transform:matrix(${s.join(",")});opacity:${Math.max(0.35, m.opacity ?? DEFAULT_OPACITY)}`} />`;
      const spot = (sp: { x: number; y: number } | null, cls: string, r: number) => {
        if (!sp) return nothing;
        const [x, y] = toScreen(apply(tr.vp, [sp.x, sp.y]));
        return svg`<circle class=${cls} cx=${x} cy=${y} r=${r} />`;
      };
      marks = svg`${spot(cam.dock, "fp3d-vac-dock", 6)}${spot(cam.robot, "fp3d-vac-robot", 7)}
        ${pairs.map((pr, i) => {
          const [ax, ay] = toScreen(apply(tr.vp, pr.v));
          const [bx, by] = toScreen(pr.p);
          return svg`<g class="fp3d-vac-pair"><line x1=${ax} y1=${ay} x2=${bx} y2=${by} /><circle cx=${bx} cy=${by} r="9" /><text x=${bx} y=${by}>${i + 1}</text></g>`;
        })}
        ${this._pending ? (() => {
          const [px, py] = toScreen(apply(tr.vp, this._pending));
          return svg`<circle class="fp3d-vac-pending" cx=${px} cy=${py} r="10" />`;
        })() : nothing}`;
    }
    return html`<style>${STYLE}</style>${img}<svg aria-hidden="true">${marks}</svg>
      <div class="fp3d-vac-bar" role="status">
        <span>${step ? `${this.t(step)} · ` : "… "}${this.t("vac_pairs", { n: pairs.length })}</span>
        <button class="fp3d-btn" ?disabled=${!this._pending && !pairs.length} @click=${() => this.undo()}>${this.t("undo")}</button>
        <button class="fp3d-btn fp3d-primary" @click=${() => (this.host._vacAlign = null)}>${this.t("done")}</button>
      </div>`;
  }
}

defineElement("fp3d-vacuum-panel", VacuumPanel);
defineElement("fp3d-vacuum-plan", VacuumPlan);
