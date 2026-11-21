// "What's going on?" on a phone (#493, ported from NeonPlan 3D 4.0.0, MIT, Mastershort; the lines come from ../now.ts).
// Two shapes, chosen by the host (phone-shell.ts):
//   page   the whole list on a page of its own: a line per thing worth knowing, the most urgent first, with the obvious
//          thing to do beside it; a tap on a place closes the page and the house flies there
//   check  the house check: a small card under the house that steps through each open window, open lock and lit room
// The element only shows and asks: flying and switching belong to the host (events now-go, now-act, now-mode).
import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { defineElement } from "../define.ts";
import type { NowAction, NowItem, NowKind, NowStop, NowTarget } from "../now.ts";

const ICON: Record<NowKind, string> = { alert: "⚠️", open: "🪟", unlocked: "🔓", people: "👤", household: "🧺", lights: "💡", energy: "⚡", car: "🚗", calm: "✅" };
const STOP_ICON: Record<NowStop["kind"], string> = { open: "🪟", unlocked: "🔓", lights: "💡" };

/** The element's words, in the user's language. */
export interface NowLabels {
  title: string;
  close: string;
  lightsOff: string;
  lock: string;
  check: string;
  checkHint: string;
  next: string;
  done: string;
  checkDone: string;
  checkNothing: string;
  windowHint: string;
  /** "All {n} lights off" */
  allLightsOff: string;
}

/** bar: the list is closed (only the phone bar shows); page: the list; check: the house check. */
export type NowMode = "bar" | "page" | "check";

export class Fp3dNowList extends LitElement {
  static properties = {
    items: { attribute: false },
    stops: { attribute: false },
    labels: { attribute: false },
    favorites: { attribute: false },
    mode: { reflect: true },
    _open: { state: true },
    _step: { state: true },
  };

  declare items: NowItem[];
  /** The house check's stops, taken when it began (switching things off on the way must not reorder them). */
  declare stops: NowStop[];
  declare labels: NowLabels;
  /** The house's favourites (#494): big buttons on top of the page; a tap runs one (event now-fav). */
  declare favorites: { entity: string; name: string }[];
  declare mode: NowMode;
  /** The line whose places are listed. */
  private declare _open: number | null;
  private declare _step: number;

  constructor() {
    super();
    this.items = [];
    this.stops = [];
    this.favorites = [];
    this.mode = "page";
    this._open = null;
    this._step = 0;
  }

  private fire<T>(type: string, detail?: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has("mode")) {
      this._open = null;
      if (this.mode === "check") this._step = 0;
    }
  }

  protected updated(changed: PropertyValues): void {
    // each stop of the check shows in the house as it comes up
    if (this.mode === "check" && (changed.has("mode") || changed.has("_step"))) {
      const stop = this.stops[this._step];
      if (stop) this.fire<NowTarget>("now-go", stop.target);
    }
  }

  private tapRow(item: NowItem, index: number): void {
    if (!item.targets.length) return;
    if (item.targets.length === 1) return this.fire<NowTarget>("now-go", item.targets[0]);
    this._open = this._open === index ? null : index;
  }

  private actLabel(a: NowAction): string {
    return a.kind === "lock" ? this.labels.lock : this.labels.lightsOff;
  }

  private renderPage() {
    return html`<header>
        <h2>${this.labels.title}</h2>
        <button class="x" aria-label=${this.labels.close} @click=${() => this.fire<NowMode>("now-mode", "bar")}>✕</button>
      </header>
      ${this.favorites.length
        ? html`<div class="favs">${this.favorites.map((f) => html`<button @click=${() => this.fire<string>("now-fav", f.entity)}><span aria-hidden="true">★</span> ${f.name}</button>`)}</div>`
        : nothing}
      <ul>
        ${this.items.map((it, i) => {
          const many = it.targets.length > 1;
          const open = this._open === i;
          return html`<li class="level${it.level}">
            <div class="line">
              <button class="row" ?disabled=${!it.targets.length} aria-expanded=${many ? (open ? "true" : "false") : nothing} @click=${() => this.tapRow(it, i)}>
                <span class="icon" aria-hidden="true">${ICON[it.kind]}</span>
                <span class="text"><b>${it.title}</b>${it.detail ? html`<small>${it.detail}</small>` : nothing}</span>
                ${it.targets.length ? html`<span class="go" aria-hidden="true">${many ? (open ? "▾" : "▸") : "›"}</span>` : nothing}
              </button>
              ${it.action?.entities.length ? html`<button class="act" @click=${() => this.fire<NowAction>("now-act", it.action)}>${this.actLabel(it.action)}</button>` : nothing}
            </div>
            ${many && open
              ? html`<div class="places">
                  ${it.targets.map((t) => html`<button class="place" @click=${() => this.fire<NowTarget>("now-go", t)}>${t.label ?? ""}<span aria-hidden="true">›</span></button>`)}
                </div>`
              : nothing}
          </li>`;
        })}
      </ul>
      <footer>
        <button class="check" @click=${() => this.fire<NowMode>("now-mode", "check")}>
          <b>🚪 ${this.labels.check}</b>
          <small>${this.labels.checkHint}</small>
        </button>
      </footer>`;
  }

  private renderCheck() {
    const stop = this.stops[this._step];
    const close = html`<button class="x" aria-label=${this.labels.close} @click=${() => this.fire<NowMode>("now-mode", "bar")}>✕</button>`;
    if (!stop) {
      return html`<div class="card" role="status">
        <div class="card-top"><b>✅ ${this.stops.length ? this.labels.checkDone : this.labels.checkNothing}</b>${close}</div>
        <div class="card-btns"><button class="primary" @click=${() => this.fire<NowMode>("now-mode", "bar")}>${this.labels.done}</button></div>
      </div>`;
    }
    const next = () => (this._step += 1);
    // from the first lit room on, the lights still to come can all go off at once
    const lights = this.stops.slice(this._step).filter((st) => st.kind === "lights" && st.action);
    const allOff = stop.kind === "lights" && lights.length > 1 ? [...new Set(lights.flatMap((st) => st.action!.entities))] : null;
    return html`<div class="card" role="group" aria-label=${this.labels.check}>
      <div class="card-top">
        <span class="icon" aria-hidden="true">${STOP_ICON[stop.kind]}</span>
        <span class="text"><b>${stop.title}</b><small>${this._step + 1} / ${this.stops.length}${stop.kind === "open" ? ` · ${this.labels.windowHint}` : ""}</small></span>
        ${close}
      </div>
      <div class="card-btns">
        ${stop.action
          ? html`<button
              class="primary"
              @click=${() => {
                this.fire<NowAction>("now-act", stop.action);
                next();
              }}
            >
              ${this.actLabel(stop.action)}
            </button>`
          : nothing}
        <button @click=${next}>${this.labels.next}</button>
      </div>
      ${allOff
        ? html`<div class="card-btns">
            <button
              @click=${() => {
                this.fire<NowAction>("now-act", { kind: "lights_off", entities: allOff });
                this._step = this.stops.length;
              }}
            >
              ${this.labels.allLightsOff.replace("{n}", String(allOff.length))}
            </button>
          </div>`
        : nothing}
    </div>`;
  }

  render() {
    return this.mode === "check" ? this.renderCheck() : this.mode === "page" ? this.renderPage() : nothing;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      color: var(--fp3d-text, #e8f0ff);
      font: 14px/1.3 var(--fp3d-font, system-ui, sans-serif);
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    :host([mode="page"]) {
      background: var(--fp3d-chrome-solid, #0b1220);
    }
    header {
      display: flex;
      align-items: center;
      padding: calc(12px + env(safe-area-inset-top, 0px)) 8px 8px 18px;
    }
    h2 {
      flex: 1;
      margin: 0;
      font-size: 19px;
      font-family: var(--fp3d-title-font, inherit);
    }
    .x {
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: none;
      border: 0;
      font-size: 18px;
    }
    .favs {
      display: flex;
      flex: none;
      gap: 8px;
      padding: 0 10px 10px;
      overflow-x: auto;
    }
    .favs button {
      flex: none;
      min-height: 46px;
      padding: 8px 16px;
      border-radius: 14px;
      border: 1px solid var(--fp3d-line, rgba(120, 160, 255, 0.3));
      background: rgba(127, 160, 230, 0.12);
      font-weight: 600;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0 10px;
      overflow-y: auto;
      overscroll-behavior: contain;
      flex: 1;
      min-height: 0;
    }
    li {
      border-radius: 14px;
      margin-bottom: 6px;
      background: rgba(127, 160, 230, 0.1);
    }
    li.level2 {
      background: rgba(255, 70, 70, 0.18);
    }
    .line {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-right: 8px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
      min-height: 56px;
      padding: 10px 6px 10px 12px;
      background: none;
      border: 0;
      text-align: left;
    }
    .row:disabled {
      cursor: default;
    }
    .icon {
      flex: none;
      width: 28px;
      text-align: center;
      font-size: 19px;
    }
    .text {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 2px;
    }
    .text b {
      font-weight: 600;
      font-size: 15px;
    }
    .text small {
      color: var(--fp3d-muted, rgba(232, 240, 255, 0.75));
      font-size: 13px;
    }
    .level2 .text b {
      color: #ff9a9a;
    }
    .level1 .text b {
      color: #ffc46b;
    }
    .go {
      flex: none;
      opacity: 0.6;
    }
    .act {
      flex: none;
      min-height: 44px;
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid var(--fp3d-accent, #00e5ff);
      background: color-mix(in srgb, var(--fp3d-accent, #00e5ff) 14%, transparent);
      font-weight: 600;
    }
    .places {
      display: grid;
      gap: 2px;
      padding: 0 8px 8px 50px;
    }
    .place {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      min-height: 44px;
      align-items: center;
      padding: 6px 10px;
      border-radius: 10px;
      background: rgba(127, 160, 230, 0.12);
      border: 0;
      text-align: left;
    }
    footer {
      padding: 8px 10px 10px;
    }
    .check {
      display: grid;
      gap: 2px;
      width: 100%;
      padding: 12px 16px;
      border-radius: 14px;
      border: 1px solid var(--fp3d-line, rgba(120, 160, 255, 0.3));
      background: rgba(127, 160, 230, 0.12);
      text-align: left;
    }
    .check b {
      font-size: 15px;
    }
    .check small {
      color: var(--fp3d-muted, rgba(232, 240, 255, 0.75));
    }
    .card {
      background: var(--fp3d-chrome-solid, #0e1626);
      border: 1px solid var(--fp3d-line, rgba(120, 160, 255, 0.3));
      border-radius: 16px;
      padding: 8px 8px 10px 12px;
      box-shadow: var(--fp3d-shadow, 0 8px 24px rgba(0, 0, 0, 0.4));
    }
    .card-top {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .card-top > b {
      flex: 1;
      font-size: 15px;
      padding: 6px 0;
    }
    .card-btns {
      display: flex;
      gap: 8px;
      padding: 6px 4px 0 0;
    }
    .card-btns button {
      flex: 1;
      min-height: 44px;
      border-radius: 999px;
      border: 1px solid var(--fp3d-line, rgba(120, 160, 255, 0.35));
      background: rgba(127, 160, 230, 0.12);
      font-weight: 600;
    }
    .card-btns .primary {
      border-color: var(--fp3d-accent, #00e5ff);
      background: var(--fp3d-accent, #00e5ff);
      color: #06101c;
    }
  `;
}

defineElement("fp3d-now-list", Fp3dNowList);
