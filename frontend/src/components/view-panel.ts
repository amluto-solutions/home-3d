// The one View panel on the 3D view (#247, the menus redesign #219): what you change while looking at the house, in one
// non-modal panel that stays open while you change several things. It replaces the header's View popover and the
// stage's Show popover. Its rows are the Settings page's own (settings/view-settings.ts, part of registry.ts), read
// from and written to this device's preferences under the same keys, so the two can never disagree. A lazy chunk of
// the main bundle (load-parts.ts): it loads when the View button is first pointed at or pressed.
//
// Wide and compact screens: a floating panel above the View button. Phones (phone.ts): a full screen page over the
// view, like Settings (#346, in place of #263's half height sheet), whose Appearance and Device icons sections start
// open and the others folded with a one-line summary; its Close button and Back (back-stack.ts, panel.ts) shut it.
// Escape (handled by the panel, panel.ts) closes it and puts the focus back on the View button.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, unsafeCSS, type PropertyValues, type TemplateResult } from "lit";
import { translate, type I18nKey } from "../i18n.ts";
import { colourReset } from "../colour-reset.ts";
import { colourField } from "../colour-field-tag.ts";
import { loadColourField } from "../load-parts.ts";
import { need, once } from "../lazy-part.ts";
import { PHONE_MEDIA } from "../phone.ts";
import { FloatDrag } from "../float-panel.ts";
import { controls, tokens } from "../styles.ts";
import type { HomeAssistant } from "../types.ts";
import type { DevicePrefs, Option, Setting, SettingsEnv } from "../settings/registry.ts";
import { optionGroups, optionText, viewSections, viewSetting, type ViewContext, type ViewRow, type ViewSection } from "../settings/view-settings.ts";

/** The searchable multi-select (a chunk of its own: nothing else on the View panel needs it). */
const loadMultiSelect = once(() => import("./multi-select.ts"));

/** This device's preferences, as the panel and the Settings page keep them ("home3d.<key>"). */
const prefs: DevicePrefs = {
  get(key) {
    try {
      return localStorage.getItem(`home3d.${key}`);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null) localStorage.removeItem(`home3d.${key}`);
      else localStorage.setItem(`home3d.${key}`, value);
    } catch {
      // storage unavailable (private mode): the choice just is not remembered
    }
  },
};

/** The tick on a chosen segment, so colour is not the only sign (a line icon in the text colour). */
const TICK = html`<svg class="vp-tick" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>`;

/** Whether a scrolling box has more below what it shows (1 px of rounding allowed) (#259). */
export const moreBelow = (top: number, height: number, scrollHeight: number): boolean => top + height < scrollHeight - 1;

export class Fp3dViewPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    context: { attribute: false },
    _phone: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare context: ViewContext;
  private declare _phone: boolean;
  private phoneQuery: MediaQueryList | null = null;
  private readonly onPhone = () => (this._phone = !!this.phoneQuery?.matches);

  constructor() {
    super();
    this.context = { floors: 1, floorOpen: false, roof: false, plan2d: false, kiosk: false };
    this._phone = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.phoneQuery = typeof matchMedia === "function" ? matchMedia(PHONE_MEDIA) : null;
    this.phoneQuery?.addEventListener?.("change", this.onPhone);
    this.onPhone();
    // a press anywhere outside the panel closes it (#265)
    window.addEventListener("pointerdown", this.onOutside, true);
    window.addEventListener("resize", this.onResize);
  }

  /** Where the panel was dragged to (#265), kept per device; null while it sits at its dock. */
  private readonly drag = new FloatDrag(this, "view", () => this.requestUpdate());
  private readonly onResize = () => this.drag.settle();

  /** A press outside the panel (and not on the View button, which toggles it) closes it; the focus stays where it was pressed. */
  private readonly onOutside = (e: Event) => {
    const path = e.composedPath();
    if (path.includes(this)) return;
    if (path.some((n) => (n as HTMLElement).classList?.contains("fp3d-view-btn"))) return;
    this.emit("view-close", { outside: true });
  };

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("pointerdown", this.onOutside, true);
    window.removeEventListener("resize", this.onResize);
    this.phoneQuery?.removeEventListener?.("change", this.onPhone);
    this.sizer?.disconnect();
    this.sizer = null;
  }

  /** A non-modal dialog takes the focus when it opens, so the keyboard and a screen reader are in it at once. */
  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.drag.load();
    this.renderRoot.querySelector<HTMLElement>(".vp")?.focus({ preventScroll: true });
    const body = this.renderRoot.querySelector<HTMLElement>(".vp-body");
    if (body && typeof ResizeObserver === "function") {
      this.sizer = new ResizeObserver(this.markMore);
      this.sizer.observe(body);
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    this.markMore();
  }

  private sizer: ResizeObserver | null = null;

  /** More of the panel below its foot: the foot fades out (#259, V17). */
  private readonly markMore = () => {
    const body = this.renderRoot?.querySelector<HTMLElement>(".vp-body");
    body?.toggleAttribute("data-more", moreBelow(body.scrollTop, body.clientHeight, body.scrollHeight));
  };

  private t(key: string, vars?: Record<string, string | number>): string {
    return translate(this.hass, key as I18nKey, vars);
  }

  private get env(): SettingsEnv {
    return { building: null, hass: this.hass, prefs };
  }

  private options(s: Setting): Option[] {
    const c = s.control;
    if (c.kind === "select") return c.options(this.env);
    if (c.kind === "segment") return typeof c.options === "function" ? c.options(this.env) : c.options;
    return [];
  }

  private text(o: Option): string {
    return optionText(o, (k, v) => this.t(k, v));
  }

  /** A row changed: written where the Settings page writes it, then the panel reads its preferences again. */
  private write(s: Setting, value: unknown): void {
    void s.write?.(this.env, value as never);
    this.emit("view-change", { id: s.id });
    this.requestUpdate();
  }

  private emit(type: string, detail: unknown = null): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  /** Opens the Settings page at a section (and row): the panel stays as it is, the page replaces the view. */
  private openSettings(section: string, id: string | null = null): void {
    this.emit("open-settings", { section, id });
  }

  // ------------------------------------------------------------------------------------------------ controls

  private renderSelect(s: Setting, label: string) {
    const value = s.read(this.env);
    return html`<select class="vp-select" aria-label=${label} @change=${(e: Event) => this.write(s, (e.target as HTMLSelectElement).value)}>
      ${optionGroups(this.options(s)).map(({ group, options }) => {
        const list = options.map((o) => html`<option value=${o.value} ?selected=${value === o.value}>${this.text(o)}</option>`);
        return group ? html`<optgroup label=${this.t(group)}>${list}</optgroup>` : list;
      })}
    </select>`;
  }

  /** A segmented choice as a radio group: the arrow keys, Home and End move the choice (#219's accessibility notes). */
  private renderSegment(s: Setting, label: string, disabled: boolean) {
    const value = s.read(this.env);
    const options = this.options(s);
    const chosen = options.findIndex((o) => o.value === value);
    const pick = (i: number) => {
      const o = options[(i + options.length) % options.length];
      if (o && o.value !== value) this.write(s, o.value);
      void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`[data-seg="${s.id}"] [aria-checked="true"]`)?.focus());
    };
    const onKey = (e: KeyboardEvent) => {
      const i = Math.max(0, chosen);
      const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : null;
      if (to === null || disabled) return;
      e.preventDefault();
      pick(to);
    };
    return html`<div class="vp-seg" role="radiogroup" aria-label=${label} aria-disabled=${disabled ? "true" : nothing} data-seg=${s.id} @keydown=${onKey}>
      ${options.map((o, i) => {
        const on = o.value === value;
        return html`<button type="button" role="radio" aria-checked=${on} tabindex=${on || (chosen < 0 && i === 0) ? 0 : -1} ?disabled=${disabled} @click=${() => this.write(s, o.value)}>
          ${on ? TICK : nothing}${this.text(o)}
        </button>`;
      })}
    </div>`;
  }

  private renderSwitch(label: string, on: boolean, toggle: () => void, hint?: string) {
    return html`<button type="button" class="vp-row vp-switch" role="switch" aria-checked=${on} title=${hint ?? nothing} @click=${toggle}>
      <span>${label}</span><i class="vp-sw" aria-hidden="true"></i>
    </button>`;
  }

  private renderAccent(s: Setting) {
    need(loadColourField);
    const value = s.read(this.env) as string | null;
    const fallback = s.control.kind === "colour" ? s.control.fallback : "#48cdeb";
    return html`<span class="vp-accent" title=${this.t("accent_hint")}>
      ${colourField({ value, base: fallback, label: this.t("accent"), t: (k, v) => this.t(k, v), live: true, onChange: (hex) => hex && this.write(s, hex) })}
      ${colourReset({ value, fallback, label: this.t("accent_reset"), onReset: () => this.write(s, null) })}
    </span>`;
  }

  /** "Display what" (#268): a searchable multi-select (#227) that reads "6 object types selected"; its code is a chunk of its own. */
  private renderDisplay(s: Setting, options: Option[], label: string, hint?: string) {
    need(loadMultiSelect);
    const shown = (s.read(this.env) as string[] | null) ?? [];
    return html`<div class="vp-row vp-display" title=${hint ?? nothing}>
      <span class="vp-label">${label}</span>
      <fp3d-multi-select
        .options=${options.map((o) => ({ id: o.value, label: this.t(o.label) }))}
        .value=${shown}
        .label=${label}
        .summary=${shown.length === 1 ? this.t("display_count_one") : this.t("display_count", { n: shown.length })}
        .searchLabel=${this.t("multi_search")}
        .noSearch=${true}
        .emptyText=${this.t("multi_none")}
        @change=${(e: CustomEvent<{ value: string[] }>) => this.write(s, e.detail.value)}
      ></fp3d-multi-select>
    </div>`;
  }

  private renderRow(row: ViewRow): TemplateResult | typeof nothing {
    const s = viewSetting(row.id);
    if (!s) return nothing;
    const label = this.t(s.label);
    const hint = s.hint ? this.t(s.hint) : undefined;
    switch (s.control.kind) {
      case "checks":
        return this.renderDisplay(s, s.control.options, label, hint);
      case "switch":
        return this.renderSwitch(label, !!s.read(this.env), () => this.write(s, !s.read(this.env)), hint);
      case "segment":
        return html`<div class="vp-row vp-seg-row" title=${hint ?? nothing}><span class="vp-label">${label}</span>${this.renderSegment(s, label, !!row.disabled)}</div>`;
      case "colour":
        return this.renderAccent(s);
      case "select":
        return html`<div class="vp-row"><span class="vp-label">${label}</span>${this.renderSelect(s, label)}</div>`;
      default:
        return nothing;
    }
  }

  // ------------------------------------------------------------------------------------------------ sections

  /** The one-line summary of a folded section on a phone. */
  private summary(section: ViewSection): string {
    const parts: string[] = [];
    for (const row of section.rows) {
      const s = viewSetting(row.id);
      if (!s) continue;
      const v = s.read(this.env);
      if (s.control.kind === "switch") {
        if (v) parts.push(this.t(s.label));
      } else if (s.control.kind === "select" || s.control.kind === "segment") {
        // the walls and every choice outside "What the 3D shows" always; the other choices there once changed
        const o = this.options(s).find((x) => x.value === v);
        if (o && (v !== s.default || section.id !== "show" || row.id === "walls")) parts.push(this.text(o));
      }
    }
    return parts.join(" · ");
  }

  /** The rows of a section in the order the drawing has them (Appearance and Device icons share a line with their extra). */
  private renderBody(section: ViewSection) {
    const rows = section.rows.map((r) => [r, viewSetting(r.id)] as const);
    if (section.id === "look") {
      const [theme, accent] = rows.map(([, s]) => s);
      return html`<div class="vp-line">${theme ? this.renderSelect(theme, this.t("theme")) : nothing}${accent ? this.renderAccent(accent) : nothing}</div>`;
    }
    if (section.id === "markers") {
      const [markers, size] = rows.map(([, s]) => s);
      return html`<div class="vp-line">
          ${markers ? this.renderSelect(markers, this.t("markers")) : nothing}
          ${size ? this.renderSegment(size, this.t(size.label), false) : nothing}
        </div>
        ${section.hint ? html`<p class="vp-help">${this.t(section.hint)}</p>` : nothing}`;
    }
    if (section.id === "clock") {
      const [clock, wx] = rows.map(([, s]) => s);
      // the weather tile sits beside the clock, so its switch shows while a clock does (#333)
      const shows = !!clock && clock.read(this.env) !== "off";
      return html`<div class="vp-line">
          ${clock ? this.renderSelect(clock, this.t(clock.label)) : nothing}
          <button type="button" class="vp-link" @click=${() => this.openSettings("look", "clock_hours")}>${this.t("view_clock_style")} ›</button>
        </div>
        ${wx && shows ? this.renderRow({ id: wx.id }) : nothing}`;
    }
    return html`${rows.map(([r]) => this.renderRow(r))}${section.hint ? html`<p class="vp-help">${this.t(section.hint)}</p>` : nothing}`;
  }

  private renderSection(section: ViewSection) {
    const title = this.t(section.title);
    if (this._phone) {
      return html`<details class="vp-sec vp-${section.id}" ?open=${section.openOnPhone}>
        <summary><span class="vp-h">${title}</span><small class="vp-sum">${this.summary(section)}</small></summary>
        <div class="vp-rows">${this.renderBody(section)}</div>
      </details>`;
    }
    return html`<section class="vp-sec vp-${section.id}" aria-label=${title}>
      <h3 class="vp-h">${title}</h3>
      <div class="vp-rows">${this.renderBody(section)}</div>
    </section>`;
  }

  /** The read-only quality line and the ways on to Settings (not on a wall tablet). */
  private renderFooter() {
    const quality = viewSetting("quality")?.read(this.env) ?? "auto";
    return html`<footer class="vp-foot">
      <div class="vp-line">
        <button type="button" class="vp-quiet" title=${this.t("st_sec_look")} @click=${() => this.openSettings("look", "quality")}>${this.t("view_quality_line", { quality: this.t(`quality_${String(quality)}`) })}</button>
        <button type="button" class="vp-link" @click=${() => this.openSettings("view3d")}>${this.t("view_more_settings")} ›</button>
      </div>
      <div class="vp-line">
        <span class="vp-help">${this.t("view_home_settings")}</span>
        <button type="button" class="vp-link" @click=${() => this.openSettings("scene")}>${this.t("st_open")} ›</button>
      </div>
    </footer>`;
  }

  protected render() {
    const sections = viewSections(this.context);
    return html`<div class="vp" role="dialog" aria-modal="false" aria-labelledby="vp-title" tabindex="-1">
      <header
        class="vp-head"
        title=${this._phone ? nothing : this.t("float_drag_hint")}
        @pointerdown=${(e: PointerEvent) => (this._phone ? undefined : this.drag.begin(e))}
        @pointermove=${(e: PointerEvent) => this.drag.move(e)}
        @pointerup=${() => this.drag.end()}
        @pointercancel=${() => this.drag.end()}
        @dblclick=${() => this.drag.reset()}
      >
        <span class="vp-grab" aria-hidden="true"></span>
        <h2 id="vp-title">${this.t("view_btn")}</h2>
        <span class="vp-scope">${this.t("view_scope")}</span>
        ${this.drag.offset && !this._phone ? html`<button type="button" class="vp-snap" title=${this.t("float_snap_back")} aria-label=${this.t("float_snap_back")} @click=${() => this.drag.reset()}>⤒</button>` : nothing}
        <button type="button" class="vp-close" title=${this.t("close")} aria-label=${this.t("close")} @click=${() => this.emit("view-close")}>✕</button>
      </header>
      <div class="vp-body" @scroll=${this.markMore}>
        <slot></slot>
        ${sections.map((s) => this.renderSection(s))}
        ${this.context.kiosk ? nothing : this.renderFooter()}
      </div>
    </div>`;
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        position: absolute;
        z-index: 30;
        bottom: 64px;
        left: 50%;
        transform: translateX(-50%);
        width: min(400px, calc(100% - 24px));
        max-height: calc(100% - 84px);
        display: flex;
        flex-direction: column;
        font-size: var(--fp3d-type-body);
      }
      .vp {
        display: flex;
        flex-direction: column;
        min-height: 0;
        max-height: 100%;
        background: var(--fp3d-panel, var(--fp3d-chrome-solid));
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-card);
        box-shadow: var(--fp3d-shadow);
        color: var(--fp3d-text);
        outline: none;
      }
      .vp-head {
        display: flex;
        align-items: baseline;
        gap: var(--fp3d-space-3);
        padding: var(--fp3d-space-3) var(--fp3d-space-4) var(--fp3d-space-2);
        border-bottom: 1px solid var(--fp3d-line);
      }
      .vp-head h2 {
        margin: 0;
        font-family: var(--fp3d-title-font);
        font-size: var(--fp3d-type-card);
        font-weight: 600;
      }
      .vp-scope {
        flex: 1;
        font-size: var(--fp3d-type-hint);
        color: var(--fp3d-muted);
      }
      .vp-grab {
        display: none;
      }
      /* the header moves the panel (#265): a grab cursor, no text selection while dragging */
      .vp-head {
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      .vp-head:active {
        cursor: grabbing;
      }
      .vp-close,
      .vp-snap {
        color: var(--fp3d-text);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
      }
      .vp-body {
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 0 var(--fp3d-space-4) var(--fp3d-space-2);
        /* a panel taller than the screen shows that it scrolls (#259, V17): a visible scroll bar, and the foot fades
           out while there is more below */
        scrollbar-width: thin;
        scrollbar-color: var(--fp3d-muted) transparent;
      }
      .vp-body[data-more]::after {
        content: "";
        position: sticky;
        bottom: calc(-1 * var(--fp3d-space-2));
        display: block;
        height: 40px;
        margin-top: -40px;
        background: linear-gradient(transparent, var(--fp3d-panel, var(--fp3d-chrome-solid)) 85%);
        pointer-events: none;
      }
      .vp-sec {
        padding: var(--fp3d-space-3) 0;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .vp-h {
        display: block;
        margin: 0 0 var(--fp3d-space-2);
        font-size: var(--fp3d-type-label);
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .vp-rows {
        display: grid;
        gap: var(--fp3d-space-1);
      }
      .vp-row,
      .vp-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--fp3d-space-3);
        min-height: 36px;
      }
      .vp-line {
        flex-wrap: wrap;
        row-gap: var(--fp3d-space-1);
      }
      .vp-line > .vp-select {
        flex: 1 1 140px;
        min-width: 0;
      }
      .vp-line > .vp-seg {
        margin-left: auto;
      }
      .vp-label {
        color: var(--fp3d-text);
      }
      .vp-select {
        font: inherit;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-control);
        padding: 6px 8px;
        min-height: 36px;
        max-width: 100%;
      }
      .vp-row .vp-select {
        min-width: 150px;
      }
      /* a choice that does not fit beside its label goes under it as a whole, never broken over two lines */
      .vp-display fp3d-multi-select {
        flex: 1 1 170px;
        min-width: 0;
      }
      .vp-seg-row {
        flex-wrap: wrap;
        row-gap: var(--fp3d-space-1);
      }
      .vp-seg-row .vp-seg {
        margin-left: auto;
      }
      .vp-seg {
        display: inline-flex;
        flex: none;
        flex-wrap: nowrap;
        gap: 2px;
        padding: 2px;
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-control);
      }
      .vp-seg button {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font: inherit;
        border: 0;
        border-radius: 4px;
        background: none;
        color: var(--fp3d-muted);
        padding: 4px 10px;
        min-height: 30px;
        cursor: pointer;
      }
      .vp-seg button[aria-checked="true"] {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
      }
      .vp-seg button:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .vp-switch {
        width: 100%;
        font: inherit;
        color: inherit;
        text-align: left;
        border: 0;
        background: none;
        padding: 0;
        cursor: pointer;
      }
      .vp-sw {
        position: relative;
        flex: none;
        width: 40px;
        height: 24px;
        border-radius: 999px;
        background: var(--fp3d-line);
      }
      .vp-sw::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--fp3d-muted);
        transition: transform 0.15s, background 0.15s;
      }
      .vp-switch[aria-checked="true"] .vp-sw {
        background: var(--fp3d-primary);
      }
      .vp-switch[aria-checked="true"] .vp-sw::after {
        transform: translateX(16px);
        background: var(--fp3d-primary-text);
      }
      .vp-accent {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .vp-help {
        margin: var(--fp3d-space-1) 0 0;
        font-size: var(--fp3d-type-hint);
        color: var(--fp3d-muted);
      }
      .vp-line .vp-help {
        margin: 0;
      }
      .vp-link,
      .vp-quiet,
      .vp-close,
      .vp-snap {
        flex: none;
        font: inherit;
        border: 0;
        background: none;
        padding: 0 var(--fp3d-space-1);
        min-height: 32px;
        color: var(--fp3d-accent);
        cursor: pointer;
        white-space: nowrap;
      }
      .vp-quiet {
        color: var(--fp3d-muted);
        font-size: var(--fp3d-type-hint);
        padding-left: 0;
      }
      .vp-quiet:hover {
        color: var(--fp3d-text);
        text-decoration: underline;
      }
      .vp-foot {
        display: grid;
        gap: var(--fp3d-space-1);
        padding: var(--fp3d-space-2) 0 var(--fp3d-space-1);
      }
      ::slotted(*) {
        margin-top: var(--fp3d-space-3);
      }
      /* touch screens: every control at least 44 px */
      @media (pointer: coarse) {
        .vp-select,
        .vp-seg button,
        .vp-row,
        .vp-line,
        .vp-link,
        .vp-quiet,
        .vp-close,
        .vp-snap {
          min-height: var(--fp3d-touch, 44px);
        }
        .vp-seg button {
          min-width: var(--fp3d-touch, 44px);
          justify-content: center;
        }
      }
      /* phones: a full screen page over the view like Settings (#346), sections fold */
      @media ${unsafeCSS(PHONE_MEDIA)} {
        :host {
          inset: 0;
          transform: none;
          width: auto;
          max-height: none;
          z-index: 40;
        }
        .vp {
          height: 100%;
          max-height: none;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          padding-bottom: max(env(safe-area-inset-bottom, 0px), 16px);
          animation: vp-up 0.18s ease-out;
        }
        .vp-head {
          align-items: center;
        }
        .vp-scope {
          display: none;
        }
        .vp-head h2 {
          flex: 1;
          font-size: 16px;
        }
        .vp-head {
          cursor: default;
          touch-action: none;
        }
        .vp-close {
          border: 1px solid var(--fp3d-line);
          border-radius: var(--fp3d-radius-control);
          min-width: var(--fp3d-touch);
        }
        .vp-sec summary {
          display: flex;
          align-items: baseline;
          gap: var(--fp3d-space-2);
          min-height: var(--fp3d-touch);
          align-items: center;
          cursor: pointer;
          list-style: none;
        }
        .vp-sec summary::-webkit-details-marker {
          display: none;
        }
        .vp-sec summary::after {
          content: "";
          margin-left: auto;
          width: 8px;
          height: 8px;
          border-right: 2px solid var(--fp3d-muted);
          border-bottom: 2px solid var(--fp3d-muted);
          transform: rotate(-45deg);
          flex: none;
        }
        .vp-sec[open] summary::after {
          transform: rotate(45deg);
        }
        .vp-sec summary .vp-h {
          margin: 0;
        }
        .vp-sum {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--fp3d-muted);
          font-size: var(--fp3d-type-hint);
        }
        .vp-sec[open] .vp-sum {
          display: none;
        }
      }
      @keyframes vp-up {
        from {
          transform: translateY(24px);
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .vp {
          animation: none;
        }
        .vp-sw::after {
          transition: none;
        }
      }
    `,
  ];
}

defineElement("fp3d-view-panel", Fp3dViewPanel);
