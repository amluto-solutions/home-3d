// Card templates as a management page (#495, ported from NeonPlan 3D 4.0.0, MIT, Mastershort). A dashboard card set up
// once here (with the card's own visual editor, its form in tabs); a wall tablet or a phone only picks it
// (`template: hall_tablet`) and follows every change made here, as the plan reaches every open card.
// The templates stand on the left by kind (screens, phones, each with "+ New template"), the chosen one on the right:
// its name, how to use it on a dashboard (folded), the form and a preview that turns, zooms and opens rooms like the
// card but switches nothing (preview-hass.ts). One element of its own, hosted by Settings (and by any dialog that
// gives it room): it takes `hass`, the plan, whether this viewer may edit and the page's texts (`t`), and sends
// every change as "settings-edit" with the new plan, as the other Settings cards do.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { askConfirm } from "../ask.ts";
import { renameTemplate, templateId, templateIds, templateOptions, type CardConfig } from "../card-config.ts";
import type { Building, CardTemplate } from "../model.ts";
import { previewHass } from "../preview-hass.ts";
import { controls, tokens } from "../styles.ts";
import type { HomeAssistant } from "../types.ts";
import "./ask-dialog.ts";

const CARD_TYPE = "custom:home-3d-card";
const PREVIEW_KEY = "home3d.template_preview";
const SCREEN_KEY = "home3d.template_screen";
/** Home Assistant's header above a dashboard: what "fill the screen" leaves of a screen's height. */
const HEADER = 56;
/** At most this many templates in a plan (the backend's limit too). */
export const MAX_TEMPLATES = 30;

/** The screens the preview can stand for: a 10″ tablet, a 7″ one, a tablet upright and a phone. */
export const SCREENS = {
  tablet: { w: 1280, h: 800, label: "tpl_screen_tablet" },
  small: { w: 1024, h: 600, label: "tpl_screen_small" },
  upright: { w: 800, h: 1280, label: "tpl_screen_upright" },
  phone: { w: 390, h: 844, label: "tpl_screen_phone" },
} as const;
export type ScreenSize = keyof typeof SCREENS;

/** The screen the preview is laid out for: a phone template always on a phone. */
export function screenOf(tpl: CardTemplate, chosen: ScreenSize): ScreenSize {
  return tpl.config.phone ? "phone" : chosen;
}

/** The card's height in the preview: its own, or the screen below the header with "fill" (a phone always fills). */
export function previewHeight(tpl: CardTemplate, screen: ScreenSize): number {
  const s = SCREENS[screen];
  const c = tpl.config;
  return c.fill || c.phone ? s.h - HEADER : Math.min(s.h - HEADER, Math.max(150, c.height ?? 420));
}

/** The options the preview card gets: the template's, at the preview's size, without what would act outside it. */
export function previewConfig(tpl: CardTemplate, screen: ScreenSize, home: string | null): CardConfig {
  return {
    ...templateOptions(tpl.config),
    type: CARD_TYPE,
    ...(home ? { home } : {}),
    height: previewHeight(tpl, screen),
    fill: false,
    fullscreen_button: false,
    // the preview does not listen for Assist, and has no kiosk clock of its own
    voice: false,
    idle_return: 0,
  } as CardConfig;
}

/** What a dashboard card needs to show this template. */
export function templateYaml(tpl: CardTemplate, home: string | null): string {
  return `type: ${CARD_TYPE}\n${home ? `home: ${home}\n` : ""}template: ${tpl.id}`;
}

/** A new template: a copy of one, or an empty one for a tablet or large screen, or one for a phone (it fills the screen). */
export function newTemplate(list: readonly CardTemplate[], name: string, from?: CardTemplate, phone = false): CardTemplate {
  const id = templateId(name, list.flatMap(templateIds));
  return { id, name, config: from ? structuredClone(from.config) : phone ? { phone: true, fill: true } : {} };
}

function readPref<T extends string>(key: string, ok: (v: string) => boolean, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null && ok(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // no storage: the default again next time
  }
}

/** The dashboard card as the preview uses it (the main bundle defines it). */
type PreviewCard = HTMLElement & { setConfig(c: CardConfig): void; hass?: HomeAssistant; preview?: boolean };
type CardClass = CustomElementConstructor & { getConfigElement?: () => Promise<HTMLElement> };

export class Fp3dCardTemplates extends LitElement {
  static properties = {
    hass: { attribute: false },
    building: { attribute: false },
    home: { attribute: false },
    canEdit: { attribute: false },
    t: { attribute: false },
    initial: { attribute: false },
    _selected: { state: true },
    _ready: { state: true },
    _note: { state: true },
    _preview: { state: true },
    _scale: { state: true },
    _screen: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare building: Building | null;
  /** The home the plan belongs to (null: the active one); a card on a dashboard names it, the preview shows it. */
  declare home: string | null;
  /** May change the plan (an editor): else everything is shown, nothing can be changed. */
  declare canEdit: boolean;
  /** The page's texts. */
  declare t: (key: string, vars?: Record<string, string | number>) => string;
  /** The template to open first (a deep link names it). */
  declare initial: string | null;
  private declare _selected: string | null;
  /** The card editor's bundle is there. */
  private declare _ready: boolean;
  private declare _note: string | null;
  /** The live preview beside the form (one more 3D view while the page is open; can be switched off). */
  private declare _preview: boolean;
  /** The preview is drawn at the screen's size and shrunk to its column by this factor. */
  private declare _scale: number;
  private declare _screen: ScreenSize;
  private stageObserver: ResizeObserver | null = null;
  private previewCard: PreviewCard | null = null;
  private previewKey = "";
  /** What the card editor shows now (as text): a template changed elsewhere (undo, another browser) is handed to it again. */
  private shown = "";
  private noteTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.building = null;
    this.home = null;
    this.canEdit = false;
    this.t = (key) => key;
    this.initial = null;
    this._selected = null;
    this._ready = !!customElements.get("home-3d-card-editor");
    this._note = null;
    this._preview = readPref<string>(PREVIEW_KEY, () => true, "1") !== "0";
    this._scale = 0.5;
    this._screen = readPref<ScreenSize>(SCREEN_KEY, (v) => v in SCREENS, "tablet");
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this._ready) return;
    // the card's visual editor (and its colour field) come with the card's own loader
    const card = customElements.get("home-3d-card") as CardClass | undefined;
    if (!card?.getConfigElement) {
      this._note = this.t("tpl_no_editor");
      return;
    }
    card.getConfigElement().then(
      () => (this._ready = true),
      () => (this._note = this.t("tpl_no_editor")),
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stageObserver?.disconnect();
    this.stageObserver = null;
    clearTimeout(this.noteTimer);
  }

  private get templates(): CardTemplate[] {
    return this.building?.card_templates ?? [];
  }

  /** The template shown: the chosen one (by its id or an earlier one), else the first. */
  private get current(): CardTemplate | undefined {
    const list = this.templates;
    const want = this._selected ?? this.initial;
    return list.find((x) => x.id === want) ?? list.find((x) => !!want && x.aliases?.includes(want)) ?? list[0];
  }

  /** Changes the templates of a copy of the plan and sends it as the page's other cards do. */
  private editTemplates(fn: (list: CardTemplate[]) => void, key: string | null = null): void {
    if (!this.building || !this.canEdit) return;
    const next = structuredClone(this.building);
    const list = next.card_templates ?? [];
    fn(list);
    if (list.length) next.card_templates = list;
    else delete next.card_templates;
    this.dispatchEvent(new CustomEvent("settings-edit", { detail: { building: next, key }, bubbles: true, composed: true }));
  }

  private add(from?: CardTemplate, phone = false): void {
    if (this.templates.length >= MAX_TEMPLATES) {
      this.note(this.t("tpl_full", { n: MAX_TEMPLATES }));
      return;
    }
    const name = from ? this.t("tpl_copy_name", { name: from.name }) : this.t(phone ? "tpl_new_name_phone" : "tpl_new_name");
    const tpl = newTemplate(this.templates, name, from, phone);
    this.editTemplates((list) => list.push(tpl));
    this._selected = tpl.id;
    this.shown = "";
  }

  private async deleteTemplate(tpl: CardTemplate): Promise<void> {
    if (!(await askConfirm(this.t("tpl_delete_ask", { name: tpl.name }), { ok: this.t("delete"), cancel: this.t("cancel"), danger: true }))) return;
    this.editTemplates((list) => list.splice(list.findIndex((x) => x.id === tpl.id), 1));
    this._selected = null;
    this.shown = "";
  }

  private rename(tpl: CardTemplate, name: string): void {
    if (!name || name === tpl.name) return;
    let id = tpl.id;
    this.editTemplates((list) => (id = renameTemplate(list, tpl.id, name)?.id ?? id));
    this._selected = id;
    this.shown = "";
  }

  private note(text: string): void {
    this._note = text;
    clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => (this._note = null), 5000);
  }

  private setScreen(size: ScreenSize): void {
    this._screen = size;
    this.previewKey = "";
    writePref(SCREEN_KEY, size);
  }

  private togglePreview(): void {
    this._preview = !this._preview;
    if (!this._preview) this.previewCard = null;
    this.previewKey = "";
    writePref(PREVIEW_KEY, this._preview ? "1" : "0");
  }

  /** The form changed the template: the dashboard's card dialog is not here, the change goes into the plan. */
  private changed(tpl: CardTemplate, e: CustomEvent<{ config: CardConfig }>): void {
    e.stopPropagation();
    const config = templateOptions(e.detail.config);
    this.shown = JSON.stringify([tpl.id, config]);
    this.editTemplates((list) => {
      const x = list.find((y) => y.id === tpl.id);
      if (x) x.config = config;
    }, `card_templates:${tpl.id}`);
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    // the preview's column is measured (the stage itself is only as wide as the shrunk screen)
    const column = this.renderRoot.querySelector(".tpl-preview");
    const tpl = this.current;
    if (column && !this.stageObserver && typeof ResizeObserver === "function") {
      this.stageObserver = new ResizeObserver(([entry]) => {
        const shown = this.current;
        const w = SCREENS[shown ? screenOf(shown, this._screen) : this._screen].w;
        const scale = Math.min(1, (entry?.contentRect.width ?? 0) / w);
        if (scale > 0 && Math.abs(scale - this._scale) > 0.005) this._scale = scale;
      });
      this.stageObserver.observe(column);
    } else if (!column && this.stageObserver) {
      this.stageObserver.disconnect();
      this.stageObserver = null;
    }
    // another screen: measured again for its width
    if (changed.has("_screen") && this.stageObserver && column) {
      this.stageObserver.unobserve(column);
      this.stageObserver.observe(column);
    }
    // the card editor shows the open template; again when it changed from outside (undo, another browser)
    const el = this.renderRoot.querySelector("home-3d-card-editor") as (HTMLElement & { setConfig?: (c: CardConfig) => void }) | null;
    if (!tpl || !el?.setConfig) return;
    const key = JSON.stringify([tpl.id, tpl.config]);
    if (key === this.shown) return;
    this.shown = key;
    el.setConfig({ ...tpl.config, type: CARD_TYPE } as CardConfig);
  }

  /** The preview: the real dashboard card with the template's options, at the chosen screen's size, shrunk to fit. */
  private renderPreview(tpl: CardTemplate) {
    if (!this._preview) return nothing;
    if (!customElements.get("home-3d-card")) return html`<p class="fp3d-sub">${this.t("tpl_no_preview")}</p>`;
    if (!this.previewCard) {
      this.previewCard = document.createElement("home-3d-card") as PreviewCard;
      this.previewCard.preview = true;
    }
    const screen = screenOf(tpl, this._screen);
    const key = JSON.stringify([tpl.config, screen, this.home]);
    if (key !== this.previewKey) {
      this.previewKey = key;
      try {
        this.previewCard.setConfig(previewConfig(tpl, screen, this.home));
      } catch {
        // an option the card refuses: the form shows it, the preview keeps the last good one
      }
    }
    // it turns and zooms like the card, but switches nothing: its service calls go nowhere
    if (this.hass) this.previewCard.hass = previewHass(this.hass);
    const h = previewHeight(tpl, screen);
    const w = SCREENS[screen].w;
    return html`<div class="tpl-stage" style="height:${Math.round(h * this._scale)}px;max-width:${Math.round(w * this._scale)}px">
        <div class="tpl-screen" style="width:${w}px;height:${h}px;transform:scale(${this._scale})">${this.previewCard}</div>
      </div>
      <span class="fp3d-sub">${this.t("tpl_preview_look")}</span>`;
  }

  private renderSide(list: CardTemplate[], tpl: CardTemplate | undefined) {
    return html`<nav class="tpl-side" aria-label=${this.t("tpl_title")}>
      ${[false, true].map((phone) => {
        const own = list.filter((x) => !!x.config.phone === phone);
        return html`<div class="tpl-group">
          <h4>${this.t(phone ? "tpl_phones" : "tpl_screens")}</h4>
          ${own.map((x) => html`<button class="tpl-item" aria-current=${x.id === tpl?.id ? "true" : "false"} @click=${() => (this._selected = x.id)}>${x.name || x.id}</button>`)}
          ${!own.length ? html`<span class="fp3d-sub">${this.t("tpl_none")}</span>` : nothing}
          ${this.canEdit ? html`<button class="tpl-item tpl-add" @click=${() => this.add(undefined, phone)}>+ ${this.t("tpl_new")}</button>` : nothing}
        </div>`;
      })}
    </nav>`;
  }

  private renderTemplate(tpl: CardTemplate) {
    const yaml = templateYaml(tpl, this.home);
    const edit = this.canEdit;
    const screen = screenOf(tpl, this._screen);
    return html`<div class="tpl-card">
      <div class="tpl-head">
        <label class="fp3d-field tpl-name"
          >${this.t("tpl_name")}
          <input type="text" maxlength="80" .value=${tpl.name} ?disabled=${!edit} @change=${(e: Event) => this.rename(tpl, (e.target as HTMLInputElement).value.trim())} />
        </label>
        ${edit
          ? html`<button class="fp3d-btn" @click=${() => this.add(tpl)}>${this.t("duplicate")}</button>
              <button class="fp3d-btn fp3d-danger" @click=${() => void this.deleteTemplate(tpl)}>${this.t("delete")}</button>`
          : nothing}
      </div>
      <details class="tpl-use">
        <summary>${this.t("tpl_use_title")}</summary>
        <span class="fp3d-sub">${this.t("tpl_use")}</span>
        <pre>${yaml}</pre>
        <div class="tpl-row">
          <button class="fp3d-btn" @click=${() => void navigator.clipboard?.writeText(yaml).then(() => this.note(this.t("tpl_copied")), () => undefined)}>${this.t("tpl_copy")}</button>
        </div>
      </details>
      <div class="tpl-split ${this._preview ? "" : "tpl-nopreview"}">
        ${this._ready
          ? html`<home-3d-card-editor
              class="tpl-form"
              embedded
              ?inert=${!edit}
              .hass=${this.hass}
              .building=${this.building}
              @config-changed=${(e: CustomEvent<{ config: CardConfig }>) => this.changed(tpl, e)}
            ></home-3d-card-editor>`
          : html`<p class="fp3d-sub">${this._note ?? this.t("loading")}</p>`}
        <div class="tpl-preview">
          <div class="tpl-row">
            <b>${this.t("tpl_preview")}</b>
            ${this._preview && !tpl.config.phone
              ? html`<select class="tpl-size" aria-label=${this.t("tpl_screen")} @change=${(e: Event) => this.setScreen((e.target as HTMLSelectElement).value as ScreenSize)}>
                  ${(Object.keys(SCREENS) as ScreenSize[]).map((k) => html`<option value=${k} ?selected=${k === screen}>${this.t(SCREENS[k].label)}</option>`)}
                </select>`
              : nothing}
            <button class="fp3d-btn" @click=${() => this.togglePreview()}>${this.t(this._preview ? "tpl_preview_off" : "tpl_preview_on")}</button>
          </div>
          ${this.renderPreview(tpl)}
        </div>
      </div>
    </div>`;
  }

  protected render() {
    const list = this.templates;
    const tpl = this.current;
    return html`<div class="tpl">
      <p class="fp3d-sub">${this.t("tpl_intro")}</p>
      <div class="tpl-layout">
        ${this.renderSide(list, tpl)}
        <div class="tpl-main">
          ${!list.length ? html`<p class="fp3d-sub">${this.t("tpl_empty")}</p>` : nothing}
          ${tpl ? this.renderTemplate(tpl) : nothing}
        </div>
      </div>
      ${this._note && this._ready ? html`<p class="tpl-note" role="status">${this._note}</p>` : nothing}
    </div>`;
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        display: block;
      }
      .tpl {
        display: grid;
        gap: 12px;
      }
      .tpl-layout {
        display: grid;
        grid-template-columns: 200px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      .tpl-side {
        position: sticky;
        top: 0;
        display: grid;
        gap: 16px;
        padding: 10px;
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
      }
      .tpl-group {
        display: grid;
        gap: 4px;
      }
      .tpl-group h4 {
        margin: 0 0 4px;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .tpl-item {
        min-height: 40px;
        padding: 8px 10px;
        border: 1px solid transparent;
        border-radius: 8px;
        background: none;
        color: var(--fp3d-text);
        font: inherit;
        font-size: 14px;
        text-align: left;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tpl-item:hover {
        background: color-mix(in srgb, var(--fp3d-accent) 8%, transparent);
      }
      .tpl-item[aria-current="true"] {
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
        border-color: var(--fp3d-accent);
        font-weight: 600;
      }
      .tpl-add {
        color: var(--fp3d-accent);
      }
      .tpl-main {
        min-width: 0;
        display: grid;
        gap: 12px;
      }
      .tpl-card {
        display: grid;
        gap: 12px;
      }
      .tpl-head,
      .tpl-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: end;
      }
      .tpl-row {
        align-items: center;
      }
      .tpl-name {
        flex: 1;
        min-width: 160px;
      }
      .tpl-use {
        display: grid;
        gap: 6px;
      }
      .tpl-use > summary {
        cursor: pointer;
        font-weight: 600;
        margin-bottom: 4px;
      }
      pre {
        margin: 0;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--fp3d-line);
        font-size: 13px;
        white-space: pre-wrap;
        user-select: all;
      }
      /* the form on the left, the preview on the right (it stays in sight while the form scrolls) */
      .tpl-split {
        display: grid;
        grid-template-columns: minmax(320px, 1fr) minmax(0, 1.3fr);
        gap: 16px;
        align-items: start;
      }
      .tpl-split.tpl-nopreview {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .tpl-form {
        min-width: 0;
      }
      .tpl-preview {
        position: sticky;
        top: 0;
        display: grid;
        gap: 8px;
        min-width: 0;
      }
      .tpl-size {
        margin-left: auto;
      }
      .tpl-stage {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
      }
      .tpl-screen {
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
      }
      .tpl-screen > * {
        display: block;
        height: 100%;
      }
      .tpl-note {
        margin: 0;
        color: var(--fp3d-accent);
      }
      @media (max-width: 1000px) {
        .tpl-layout,
        .tpl-split {
          grid-template-columns: minmax(0, 1fr);
        }
        .tpl-side,
        .tpl-preview {
          position: static;
        }
        .tpl-side {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ];
}

defineElement("fp3d-card-templates", Fp3dCardTemplates);
