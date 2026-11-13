// The styles dialog (#441, from NeonPlan 3D 3.1, MIT, (c) 2026 Mastershort): every style as a tile, the house in the
// chosen one shown large (the live 3D view behind the dialog takes the style while a tile or a setting is picked), and
// "Make an own style from it" with every setting of a style: a colour palette or natural materials, the dark feet of
// walls, the evening dimming, the floor structure, dark cut wall tops and the background. Own styles are kept in the
// plan (`settings.styles_custom`, up to 40, ids `my_*`) and appear in every style list and by name in voice and a
// helper entity. A lazy chunk of the main bundle (load-parts.ts): it loads when the View panel's Styles button is
// pressed. The light by direction (`sun`) is kept in the data but the shader does not use it (#436), so it is not
// offered here.
//
// Events (all bubble): `styles-preview` {style: StyleDef | null} shows a style in the house for now, `styles-change`
// {styles} the plan's own styles after a save or a delete (editors only), `view-change` {id: "theme"} after "Use on
// this device", `styles-close`.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from "lit";
import { translate, type I18nKey } from "../i18n.ts";
import { allStyles, cleanOwnStyle, MAX_OWN_STYLES, newStyleId, ownStyleFrom, setCustomStyles, STYLE_GROUPS, styleById, type CustomStyle, type StyleDef } from "../looks.ts";
import { colourReset, colourResetCss } from "../colour-reset.ts";
import { colourField } from "../colour-field-tag.ts";
import { loadColourField } from "../load-parts.ts";
import { need } from "../lazy-part.ts";
import { controls, tokens } from "../styles.ts";
import type { HomeAssistant } from "../types.ts";

const DEFAULT_PALETTE = { line: "#8a8f98", dark: "#cfcac2", light: "#fbfaf7", hue: 0.1, lift: 0.3, contrast: 3 };

/** The colours a tile shows for a style: the stage, then three chips (the surfaces and the lines). */
export function swatch(s: StyleDef): { bg: [string, string]; chips: [string, string, string] } {
  const bg = s.bg ?? (s.base === "neon" ? ["#0a0f1c", "#141c30"] : s.base === "blueprint" ? ["#0b1b3a", "#10285a"] : ["#eef1f5", "#d8dde6"]);
  const dim = s.natural && s.dim ? 1 - s.dim * 0.6 : 1;
  const shade = (hex: string): string => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * dim).toString(16).padStart(2, "0")).join("")}`;
  if (s.palette) return { bg: bg as [string, string], chips: [s.palette.light, s.palette.dark, s.palette.line] };
  if (s.natural) return { bg: bg as [string, string], chips: [shade("#e9e2d6"), shade("#c9a37a"), shade("#7d6b5a")] };
  return { bg: bg as [string, string], chips: s.base === "neon" ? ["#39e0ff", "#1b4f66", "#0a2a38"] : s.base === "blueprint" ? ["#ffffff", "#9fb8e8", "#1b3a78"] : ["#ffffff", "#c9ced8", "#4a4e56"] };
}

/** An own style being made or changed. */
interface Draft extends CustomStyle {
  /** An existing own style (changing it) or none (a new one). */
  editing: boolean;
}

type NumberField = "hue" | "lift" | "contrast";

export class Fp3dStylesDialog extends LitElement {
  static properties = {
    hass: { attribute: false },
    styles: { attribute: false },
    current: {},
    canEdit: { type: Boolean },
    _picked: { state: true },
    _draft: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The plan's own styles (`settings.styles_custom`). */
  declare styles: CustomStyle[] | null | undefined;
  /** The style the screen shows now: the dialog starts on it. */
  declare current: string;
  /** Editors may keep own styles (the backend checks again). */
  declare canEdit: boolean;
  private declare _picked: string;
  private declare _draft: Draft | null;
  /** The style the draft started from (the resets go back to it). */
  private _origin: CustomStyle | null = null;

  constructor() {
    super();
    this.canEdit = false;
    this.current = "neon";
    this._picked = "";
    this._draft = null;
  }

  private t(key: string, vars?: Record<string, string | number>): string {
    return translate(this.hass, key as I18nKey, vars);
  }

  private emit(type: string, detail: unknown = null): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  protected willUpdate(changed: PropertyValues): void {
    // the lists and the names below read the plan's own styles from looks.ts
    if (changed.has("styles")) setCustomStyles(this.styles);
    if (!this._picked) this._picked = styleById(this.current) ? this.current : "neon";
  }

  protected firstUpdated(): void {
    this.renderRoot.querySelector<HTMLElement>(".sd")?.focus({ preventScroll: true });
    this.show(this._picked);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.emit("styles-preview", { style: null });
  }

  /** A style's name: an own style's, or the text of a built-in one. */
  private name(s: StyleDef): string {
    return s.name ?? this.t(`style_${s.id}`);
  }

  /** The house in a style (null: the screen's own). */
  private show(id: string | null): void {
    this.emit("styles-preview", { style: id ? (styleById(id) ?? null) : null });
  }

  private pick(id: string): void {
    this._picked = id;
    this.show(id);
  }

  private use(): void {
    try {
      localStorage.setItem("home3d.theme", this._picked);
    } catch {
      // storage unavailable (private mode): the choice just is not remembered
    }
    this.emit("view-change", { id: "theme" });
  }

  private close = (): void => this.emit("styles-close");

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    if (this._draft) this.cancel();
    else this.close();
  };

  // ------------------------------------------------------------------------------------------------ own styles

  private get own(): CustomStyle[] {
    return this.styles ?? [];
  }

  /** "Make an own style from it": a copy of the picked style, named, with every setting open to change. */
  private make(): void {
    const from = styleById(this._picked) ?? styleById("neon")!;
    const base = this.name(from);
    const copy = ownStyleFrom(from, this.t("own_style_new_name", { name: base }));
    this._origin = copy;
    this._draft = { ...copy, editing: false };
    this.preview();
  }

  private edit(): void {
    const s = this.own.find((c) => c.id === this._picked);
    if (!s) return;
    this._origin = s;
    this._draft = { ...structuredClone(s), editing: true };
    this.preview();
  }

  private preview(): void {
    const d = this._draft;
    const clean = d ? cleanOwnStyle(d) : null;
    if (clean) this.emit("styles-preview", { style: { ...clean, group: "custom", aliases: [clean.name] } });
  }

  private change(patch: Partial<CustomStyle>): void {
    if (!this._draft) return;
    this._draft = { ...this._draft, ...patch };
    this.preview();
  }

  private setMode(mode: "palette" | "natural" | "base"): void {
    const d = this._draft;
    if (!d) return;
    if (mode === "palette") this.change({ natural: false, palette: d.palette ?? { ...DEFAULT_PALETTE } });
    else if (mode === "natural") this.change({ natural: true, palette: null, floors: d.floors ?? 1, cutDark: d.cutDark ?? true });
    else this.change({ natural: false, palette: null });
  }

  private setPalette(patch: Partial<NonNullable<CustomStyle["palette"]>>): void {
    const d = this._draft;
    if (d?.palette) this.change({ palette: { ...d.palette, ...patch } });
  }

  /** The arrow keys move the choice of the three ways, like the View panel's segmented choices. */
  private readonly onModeKey = (e: KeyboardEvent): void => {
    const modes = ["palette", "natural", "base"] as const;
    const d = this._draft;
    const i = d ? modes.indexOf(d.natural ? "natural" : d.palette ? "palette" : "base") : 0;
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : null;
    if (to === null) return;
    e.preventDefault();
    this.setMode(modes[(to + 3) % 3]!);
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('.sd-modes [aria-checked="true"]')?.focus());
  };

  private cancel(): void {
    this._draft = null;
    this.show(this._picked);
  }

  private save(): void {
    const d = this._draft;
    const clean = d ? cleanOwnStyle(d) : null;
    if (!d || !clean) return;
    const id = d.editing ? clean.id : newStyleId();
    const saved = { ...clean, id };
    const styles = d.editing ? this.own.map((c) => (c.id === id ? saved : c)) : [...this.own, saved];
    this._draft = null;
    this.styles = styles;
    setCustomStyles(styles);
    this._picked = id;
    this.emit("styles-change", { styles });
    this.show(id);
  }

  private deleteOwn(): void {
    const id = this._picked;
    if (!this.own.some((c) => c.id === id)) return;
    const styles = this.own.filter((c) => c.id !== id);
    this.styles = styles;
    setCustomStyles(styles);
    this._picked = "neon";
    this.emit("styles-change", { styles });
    this.show("neon");
  }

  // ------------------------------------------------------------------------------------------------ drawing

  private tile(s: StyleDef): TemplateResult {
    const { bg, chips } = swatch(s);
    const on = s.id === this._picked;
    return html`<button type="button" class="sd-tile" aria-pressed=${on} title=${this.name(s)} @click=${() => this.pick(s.id)}>
      <span class="sd-sw" style="background:linear-gradient(${bg[0]},${bg[1]})" aria-hidden="true">
        ${chips.map((c) => html`<i style="background:${c}"></i>`)}
      </span>
      <span class="sd-name">${this.name(s)}</span>
    </button>`;
  }

  private renderTiles(): TemplateResult {
    const all = allStyles();
    return html`${STYLE_GROUPS.map((g) => {
      const list = all.filter((s) => s.group === g);
      if (!list.length) return nothing;
      return html`<section>
        <h3>${this.t(`style_group_${g}`)}</h3>
        <div class="sd-grid">${list.map((s) => this.tile(s))}</div>
      </section>`;
    })}`;
  }

  private slider(label: string, value: number, min: number, max: number, step: number, set: (v: number) => void): TemplateResult {
    return html`<label class="sd-row"
      ><span>${label}</span
      ><input type="range" aria-label=${label} min=${min} max=${max} step=${step} .value=${String(value)} @input=${(e: Event) => set(Number((e.target as HTMLInputElement).value))} /><output>${value.toFixed(2)}</output></label
    >`;
  }

  /** A colour row: the shared colour field and a reset to the colour the style started with. */
  private colour(label: string, value: string, fallback: string, set: (v: string) => void): TemplateResult {
    need(loadColourField);
    return html`<div class="sd-row">
      <span>${label}</span>
      ${colourField({ value, base: fallback, label, t: (k, v) => this.t(k, v), live: true, onChange: (hex) => hex && set(hex) })}
      ${colourReset({ value, fallback, label: this.t("own_style_reset"), onReset: () => set(fallback) })}
    </div>`;
  }

  private check(label: string, on: boolean, set: (v: boolean) => void): TemplateResult {
    return html`<button type="button" class="sd-row sd-switch" role="switch" aria-checked=${on} @click=${() => set(!on)}><span>${label}</span><i class="sd-knob" aria-hidden="true"></i></button>`;
  }

  private renderForm(d: Draft): TemplateResult {
    const mode = d.natural ? "natural" : d.palette ? "palette" : "base";
    const bg = d.bg ?? null;
    const swatchBg = swatch({ ...d, bg: null, group: "custom", aliases: [] }).bg;
    // the colours it started with, for the resets
    const o = { ...DEFAULT_PALETTE, ...(this._origin?.palette ?? {}) };
    const num = (field: NumberField, label: string, min: number, max: number) => this.slider(label, d.palette![field], min, max, 0.01, (v) => this.setPalette({ [field]: v }));
    return html`<div class="sd-form">
      <label class="sd-row"
        ><span>${this.t("own_style_name")}</span><input type="text" class="sd-field" maxlength="40" .value=${d.name} @input=${(e: Event) => this.change({ name: (e.target as HTMLInputElement).value })}
      /></label>
      <label class="sd-row"
        ><span>${this.t("own_style_base")}</span>
        <select class="sd-field" @change=${(e: Event) => this.change({ base: (e.target as HTMLSelectElement).value as CustomStyle["base"] })}>
          ${(["neon", "blueprint", "day", "realistic"] as const).map((b) => html`<option value=${b} ?selected=${d.base === b}>${this.t(`theme_${b}`)}</option>`)}
        </select></label
      >
      <div class="sd-modes" role="radiogroup" aria-label=${this.t("own_style_made_of")} @keydown=${this.onModeKey}>
        ${(["palette", "natural", "base"] as const).map((m) => html`<button type="button" role="radio" aria-checked=${mode === m} tabindex=${mode === m ? 0 : -1} @click=${() => this.setMode(m)}>${this.t(`own_style_mode_${m}`)}</button>`)}
      </div>
      ${mode === "palette" && d.palette
        ? html`${this.colour(this.t("own_style_line"), d.palette.line, o.line, (v) => this.setPalette({ line: v }))}
          ${this.colour(this.t("own_style_dark"), d.palette.dark, o.dark, (v) => this.setPalette({ dark: v }))}
          ${this.colour(this.t("own_style_light"), d.palette.light, o.light, (v) => this.setPalette({ light: v }))}
          ${num("hue", this.t("own_style_hue"), 0, 1)} ${num("lift", this.t("own_style_lift"), 0, 0.6)} ${num("contrast", this.t("own_style_contrast"), 0.5, 4)}`
        : nothing}
      ${mode === "natural"
        ? html`${this.slider(this.t("own_style_floors"), d.floors ?? 1, 0, 1, 0.05, (v) => this.change({ floors: v }))}
          ${this.slider(this.t("own_style_dim"), d.dim ?? 0, 0, 0.9, 0.05, (v) => this.change({ dim: v }))}
          ${this.check(this.t("own_style_cut"), d.cutDark !== false, (v) => this.change({ cutDark: v }))}`
        : nothing}
      ${this.slider(this.t("own_style_ao"), d.ao ?? 0, 0, 0.7, 0.05, (v) => this.change({ ao: v }))}
      ${this.check(this.t("own_style_shadows"), d.shadows !== false, (v) => this.change({ shadows: v }))}
      ${this.check(this.t("own_style_signal"), d.signal !== false, (v) => this.change({ signal: v }))}
      ${this.check(this.t("own_style_own_bg"), !!bg, (v) => this.change({ bg: v ? [swatchBg[0], swatchBg[1]] : null }))}
      ${bg
        ? html`${this.colour(this.t("own_style_bg_top"), bg[0], swatchBg[0], (v) => this.change({ bg: [v, bg[1]] }))}${this.colour(this.t("own_style_bg_bottom"), bg[1], swatchBg[1], (v) => this.change({ bg: [bg[0], v] }))}`
        : nothing}
      <div class="sd-actions">
        <button type="button" class="fp3d-btn fp3d-primary" ?disabled=${!d.name.trim()} @click=${() => this.save()}>${this.t("own_style_save")}</button>
        <button type="button" class="fp3d-btn" @click=${() => this.cancel()}>${this.t("cancel")}</button>
      </div>
    </div>`;
  }

  protected render(): TemplateResult {
    const d = this._draft;
    const ownPicked = this.own.some((c) => c.id === this._picked);
    const full = this.own.length >= MAX_OWN_STYLES;
    return html`<div class="sd" role="dialog" aria-modal="false" aria-labelledby="sd-title" tabindex="-1" @keydown=${this.onKey}>
      <header class="sd-head">
        <h2 id="sd-title">${this.t("styles_title")}</h2>
        <button type="button" class="sd-x" title=${this.t("close")} aria-label=${this.t("close")} @click=${this.close}>✕</button>
      </header>
      <div class="sd-body">
        ${d ? this.renderForm(d) : this.renderTiles()}
      </div>
      ${d
        ? nothing
        : html`<footer class="sd-foot">
            <button type="button" class="fp3d-btn fp3d-primary" @click=${() => this.use()}>${this.t("own_style_use")}</button>
            ${this.canEdit
              ? html`<button type="button" class="fp3d-btn" ?disabled=${full} title=${full ? this.t("own_style_full", { n: MAX_OWN_STYLES }) : ""} @click=${() => this.make()}>${this.t("own_style_make")}</button>
                ${ownPicked ? html`<button type="button" class="fp3d-btn" @click=${() => this.edit()}>${this.t("own_style_edit")}</button><button type="button" class="fp3d-btn fp3d-danger sd-danger" @click=${() => this.deleteOwn()}>${this.t("delete")}</button>` : nothing}`
              : nothing}
          </footer>`}
    </div>`;
  }

  static styles = [
    tokens,
    controls,
    colourResetCss,
    css`
      :host {
        position: absolute;
        z-index: 31;
        top: 56px;
        right: 12px;
        bottom: 64px;
        width: min(340px, calc(100% - 24px));
        display: flex;
        flex-direction: column;
        font-size: var(--fp3d-type-body);
      }
      .sd {
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
      .sd-head {
        display: flex;
        align-items: center;
        gap: var(--fp3d-space-3);
        padding: var(--fp3d-space-3) var(--fp3d-space-4) var(--fp3d-space-2);
        border-bottom: 1px solid var(--fp3d-line);
      }
      .sd-head h2 {
        flex: 1;
        margin: 0;
        font-family: var(--fp3d-title-font);
        font-size: var(--fp3d-type-card);
        font-weight: 600;
      }
      .sd-x {
        flex: none;
        font: inherit;
        font-size: 16px;
        line-height: 1;
        color: var(--fp3d-text);
        background: none;
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-control);
        min-width: 34px;
        min-height: 34px;
        cursor: pointer;
      }
      .sd-x:hover {
        border-color: var(--fp3d-accent);
      }
      .sd-body {
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: var(--fp3d-muted) transparent;
        padding: var(--fp3d-space-2) var(--fp3d-space-4) var(--fp3d-space-3);
      }
      h3 {
        margin: var(--fp3d-space-3) 0 var(--fp3d-space-2);
        font-size: var(--fp3d-type-label);
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .sd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: var(--fp3d-space-2);
      }
      .sd-tile {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 4px;
        text-align: left;
        border: 1px solid var(--fp3d-line);
        font: inherit;
        border-radius: var(--fp3d-radius-control);
        background: transparent;
        color: var(--fp3d-text);
        cursor: pointer;
      }
      .sd-tile:hover {
        border-color: var(--fp3d-accent);
      }
      .sd-tile[aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        box-shadow: 0 0 0 1px var(--fp3d-accent);
        background: var(--fp3d-chrome);
      }
      .sd-sw {
        display: flex;
        align-items: flex-end;
        gap: 3px;
        height: 40px;
        padding: 4px;
        border-radius: 6px;
      }
      .sd-sw i {
        flex: 1;
        height: 16px;
        border-radius: 3px;
        border: 1px solid rgba(128, 128, 128, 0.4);
      }
      .sd-name {
        font-size: var(--fp3d-type-hint);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sd-foot,
      .sd-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--fp3d-space-2);
      }
      .sd-foot {
        padding: var(--fp3d-space-3) var(--fp3d-space-4);
        border-top: 1px solid var(--fp3d-line);
      }
      .sd-actions {
        margin-top: var(--fp3d-space-3);
        padding-top: var(--fp3d-space-3);
        border-top: 1px solid var(--fp3d-line);
      }
      .fp3d-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .sd-danger {
        margin-left: auto;
      }
      /* the three ways to make a style: the View panel's segmented choice, the labels may wrap */
      .sd-modes {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2px;
        padding: 2px;
        margin: var(--fp3d-space-2) 0;
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-control);
      }
      .sd-modes button {
        font: inherit;
        font-size: var(--fp3d-type-hint);
        line-height: 1.25;
        border: 0;
        border-radius: 4px;
        background: none;
        color: var(--fp3d-muted);
        padding: 4px 6px;
        min-height: 44px;
        cursor: pointer;
      }
      .sd-modes button[aria-checked="true"] {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
      }
      .sd-form {
        display: flex;
        flex-direction: column;
        gap: var(--fp3d-space-1);
      }
      .sd-row {
        display: flex;
        align-items: center;
        gap: var(--fp3d-space-3);
        min-height: 44px;
      }
      .sd-row > span {
        flex: 0 0 38%;
        color: var(--fp3d-text);
      }
      .sd-field {
        flex: 1;
        min-width: 0;
        font: inherit;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-control);
        padding: 6px 8px;
        min-height: 36px;
        box-sizing: border-box;
      }
      .sd-row input[type="range"] {
        flex: 1;
        min-width: 0;
        height: 28px;
        margin: 0;
        background: none;
        appearance: none;
        accent-color: var(--fp3d-primary);
      }
      .sd-row input[type="range"]::-webkit-slider-runnable-track {
        height: 6px;
        border-radius: 3px;
        background: var(--fp3d-line);
      }
      .sd-row input[type="range"]::-moz-range-track {
        height: 6px;
        border-radius: 3px;
        background: var(--fp3d-line);
      }
      .sd-row input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        width: 20px;
        height: 20px;
        margin-top: -7px;
        border-radius: 50%;
        border: 2px solid var(--fp3d-primary-text);
        background: var(--fp3d-primary);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      }
      .sd-row input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid var(--fp3d-primary-text);
        background: var(--fp3d-primary);
      }
      .sd-row output {
        font-size: var(--fp3d-type-hint);
        font-variant-numeric: tabular-nums;
        color: var(--fp3d-muted);
        min-width: 2.8em;
        text-align: right;
      }
      /* a switch, as in the View panel */
      .sd-switch {
        width: 100%;
        font: inherit;
        color: inherit;
        text-align: left;
        border: 0;
        background: none;
        padding: 0;
        cursor: pointer;
      }
      .sd-switch > span {
        flex: 1;
      }
      .sd-knob {
        position: relative;
        flex: none;
        width: 40px;
        height: 24px;
        border-radius: 999px;
        background: var(--fp3d-line);
      }
      .sd-knob::after {
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
      .sd-switch[aria-checked="true"] .sd-knob {
        background: var(--fp3d-primary);
      }
      .sd-switch[aria-checked="true"] .sd-knob::after {
        transform: translateX(16px);
        background: var(--fp3d-primary-text);
      }
      @media (pointer: coarse) {
        .sd-x {
          min-width: var(--fp3d-touch, 44px);
          min-height: var(--fp3d-touch, 44px);
        }
        .sd-field,
        .fp3d-btn {
          min-height: var(--fp3d-touch, 44px);
        }
      }
      @media (max-width: 600px) {
        :host {
          top: auto;
          left: 12px;
          right: 12px;
          bottom: 64px;
          width: auto;
          max-height: 62%;
        }
        .sd-row > span {
          flex-basis: 36%;
        }
      }
    `,
  ];
}

defineElement("fp3d-styles-dialog", Fp3dStylesDialog);
