// Visual editor of the dashboard card: Home Assistant shows it in the card dialog, so nobody has to
// write YAML. It follows Home Assistant's colours (the dialog is light or dark with the user's theme).

import { defineElement } from "./define.ts";
import { css, html, LitElement, nothing } from "lit";
import { fetchBuilding, listHomes, type HomeInfo } from "./api.ts";
import { ACCENT_DEFAULT, colourReset, colourResetCss } from "./colour-reset.ts";
// the shared colour field (#403): its element loads with this bundle (card.ts getConfigElement)
import { colourField } from "./colour-field-tag.ts";
import { labOn, UNRELEASED } from "./features.ts";
import { CARD_CONTROLS, cardTemplate, isHaPath, PHONE_PARTS, PHONE_PLACE_KINDS, type CardConfig, type CardControl, type PhonePart, type PhonePlace } from "./card-config.ts";
import type { Building, CardTemplate } from "./model.ts";
import { languageReady, loadLanguage, translate, uiLanguage, type I18nKey } from "./i18n.ts";
import { setCustomStyles, styleById, styleChoices } from "./looks.ts";
import { ZOOM_LATE_DEFAULT, zoomChoices } from "./zoom-pref.ts";
import type { HomeAssistant } from "./types.ts";

/** Defaults of the card: options at their default are left out of the config. */
const DEFAULTS: Partial<CardConfig> = {
  height: 420,
  view: "3d",
  walls: "auto",
  explode: true,
  roof_fade: true,
  roof: true,
  camera_wall: false,
  quality: "auto",
  stats: false,
  markers: "important",
  heatmap: "none",
  theme: "theme",
  energy: true,
  room_panel: true,
  fill: false,
  phone: false,
  controls: false,
  fullscreen_button: false,
  room_names: true,
  surroundings: true,
  floor_stack: "dim",
  alerts: true,
  alert_jump: false,
  director: false,
  voice: false,
  scenes: true,
  motion_trail: false,
  time_travel: false,
  household_card: true,
  rack_cards: true,
  weather: true,
  idle_return: 0,
  controls_hidden: false,
  controls_hide_after: 0,
  marker_names: false,
  view_only: false,
  central: true,
  pets: true,
  ghost: true,
  night: "off",
  idle_orbit: false,
};

type Choice = [value: string, label: I18nKey];

/** A card's own options that stay when it picks a template (#495): the home belongs to the dashboard, not to the template. */
const CARD_OWN = ["home"] as const;

/** The tabs of the form inside Settings (#495); on a dashboard it is one page as before. */
export type CardTab = "for" | "view" | "show" | "features" | "kiosk";
const TABS: [CardTab, I18nKey][] = [
  ["for", "card_tab_for"],
  ["view", "card_section_view"],
  ["show", "card_section_show"],
  ["features", "card_section_features"],
  ["kiosk", "card_section_kiosk"],
];

export class Floorplan3dCardEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    building: { attribute: false },
    embedded: { type: Boolean, reflect: true },
    _tab: { state: true },
    _templates: { state: true },
    _config: { state: true },
    _floors: { state: true },
    _styles: { state: true },
    _hasMap: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** Inside Settings (a card template, #495): the plan being edited, and no template choice of its own. */
  declare building: Building | null;
  declare embedded: boolean;
  /** The open tab inside Settings. */
  private declare _tab: CardTab;
  /** The card templates of the card's home (#495), for the dashboard's template choice. */
  private declare _templates: CardTemplate[];
  /** The plan the floors were last taken from (inside Settings). */
  private seenPlan: Building | null = null;
  private declare _config: CardConfig;
  private declare _floors: { id: string; name: string }[];
  /** The plan's own styles (`styles_custom`) of the card's home, for the style lists (#1077). */
  private declare _styles: readonly unknown[];
  /** Whether the card's home has surroundings from the map, so the card form offers the switch (#492). */
  private declare _hasMap: boolean;
  /** The homes to choose from (#53; editors only, empty for anyone else or a backend before #53). */
  private declare _homes: HomeInfo[];
  /** The home whose floors are loaded (or loading): undefined for none yet, "" for the active one. */
  private floorsOf: string | undefined = undefined;
  private homesAsked = false;

  constructor() {
    super();
    this._config = { type: "custom:home-3d-card" };
    this.building = null;
    this.embedded = false;
    this._tab = "for";
    this._templates = [];
    this._floors = [];
    this._styles = [];
    this._hasMap = false;
    this._homes = [];
  }

  setConfig(config: CardConfig): void {
    this._config = config;
  }

  protected willUpdate(): void {
    // a language other than English: its texts are loaded first, then everything renders
    if (this.hass && !languageReady(this.hass.language)) void loadLanguage(this.hass.language, this.hass).then(() => this.requestUpdate());
    // the language its texts are in (#196)
    const lang = uiLanguage(this.hass);
    if (this.getAttribute("lang") !== lang) this.setAttribute("lang", lang);
    // inside Settings the plan being edited is handed in (#495): nothing to fetch
    if (this.embedded) {
      if (this.building !== this.seenPlan) {
        this.seenPlan = this.building;
        if (this.building) this.takePlan(this.building);
      }
      return;
    }
    // the floors of the card's home, for the floor choice
    const home = this._config.home ?? "";
    if (this.hass && this.floorsOf !== home) {
      this.floorsOf = home;
      fetchBuilding(this.hass, home || undefined).then(
        (res) => {
          if (this.floorsOf !== home) return;
          this.takePlan(res.building);
        },
        () => undefined,
      );
    }
    if (this.hass && !this.homesAsked) {
      this.homesAsked = true;
      listHomes(this.hass).then(
        (res) => (this._homes = res.homes),
        () => undefined,
      );
    }
  }

  /** What the form takes from the card's plan: its floors, own styles, map and card templates. */
  private takePlan(b: Building): void {
    this._floors = b.floors.map((f) => ({ id: f.id, name: f.name }));
    this._styles = b.settings?.styles_custom ?? [];
    this._hasMap = !!b.settings?.surroundings;
    this._templates = b.card_templates ?? [];
  }

  private t(key: I18nKey, vars?: Record<string, string | number>): string {
    return translate(this.hass, key, vars);
  }

  private get value(): Required<Omit<CardConfig, "floor" | "flows" | "holograms">> & Pick<CardConfig, "floor" | "flows" | "holograms"> {
    return { ...(DEFAULTS as Required<CardConfig>), ...this._config };
  }

  /** Change one option; options back at their default disappear from the YAML. */
  private set<K extends keyof CardConfig>(key: K, value: CardConfig[K] | undefined): void {
    const next: CardConfig = { ...this._config };
    if (value === undefined || value === "" || DEFAULTS[key] === value) delete next[key];
    else next[key] = value;
    this.emit(next);
  }

  private emit(next: CardConfig): void {
    this._config = next;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
  }

  /** The options written in the card besides its type, template and own ones: they win over the template's. */
  private ownOptions(): string[] {
    return Object.keys(this._config).filter((k) => k !== "type" && k !== "template" && !(CARD_OWN as readonly string[]).includes(k));
  }

  /** A template picked (or none): the card's other options go, its home stays (#495). */
  private pickTemplate(id: string | undefined): void {
    const own = Object.fromEntries(CARD_OWN.filter((k) => this._config[k] !== undefined).map((k) => [k, this._config[k]]));
    this.emit({ type: this._config.type, ...own, ...(id ? { template: id } : {}) });
  }

  /** The home choice (#53), above everything else on a dashboard. */
  private renderHome() {
    const v = this.value;
    if (!(this._homes.length > 1 || this._config.home)) return nothing;
    return html`<div class="grid home">
      <label class="field wide"
        >${this.t("card_home")}
        <select
          @change=${(e: Event) => {
            // another home has other floors, rooms and templates
            const next: CardConfig = { ...this._config };
            delete next.floor;
            delete next.room;
            delete next.template;
            const home = (e.target as HTMLSelectElement).value;
            if (home) next.home = home;
            else delete next.home;
            this.emit(next);
          }}
        >
          <option value="" ?selected=${!v.home}>${this.t("card_home_active")}</option>
          ${this._homes.map((h) => html`<option value=${h.id} ?selected=${h.id === v.home}>${h.name}</option>`)}
          ${v.home && !this._homes.some((h) => h.id === v.home) ? html`<option value=${v.home} selected>${v.home}</option>` : nothing}
        </select>
      </label>
    </div>`;
  }

  /**
   * The card template (#495, ported from NeonPlan 3D 4.0.0, MIT, Mastershort): a card on a dashboard may take every
   * option from one set up in Settings; the form folds away then. Shown when the home has templates or the card names one.
   */
  private renderTemplate() {
    const id = this._config.template;
    if (!id && !this._templates.length) return nothing;
    // a card set up with an earlier id of a renamed template shows that template
    const tpl = cardTemplate({ card_templates: this._templates } as Building, id);
    const chosen = tpl?.id ?? id;
    const own = id ? this.ownOptions() : [];
    return html`<h3>${this.t("card_template")}</h3>
      <label class="field wide">
        <select aria-label=${this.t("card_template")} @change=${(e: Event) => this.pickTemplate((e.target as HTMLSelectElement).value || undefined)}>
          <option value="" ?selected=${!id}>${this.t("card_template_none")}</option>
          ${this._templates.map((x) => html`<option value=${x.id} ?selected=${x.id === chosen}>${x.name || x.id}</option>`)}
          ${id && !tpl ? html`<option value=${id} selected>${id}</option>` : nothing}
        </select>
      </label>
      <p class="hint">${this.t(id ? "card_template_on" : "card_template_hint")}</p>
      ${own.length
        ? html`<p class="hint own">
            ${this.t("card_template_own", { list: own.join(", ") })}
            <button type="button" class="link" @click=${() => this.pickTemplate(id)}>${this.t("card_template_own_clear")}</button>
          </p>`
        : nothing}`;
  }

  /**
   * What the card is for (#495): a tablet or a large screen, or a phone – the phone view with its bar at the bottom, and
   * the bar's own options right below. A phone fills the screen.
   */
  private renderPurpose() {
    const phone = this.value.phone === true;
    return html`<h3>${this.t("card_for")}</h3>
      <div class="purpose">
        <button type="button" aria-pressed=${!phone} @click=${() => this.set("phone", undefined)}>${this.t("card_for_large")}</button>
        <button type="button" aria-pressed=${phone} @click=${() => this.emit({ ...this._config, phone: true, fill: true })}>${this.t("card_for_phone")}</button>
      </div>
      <p class="hint">${this.t(phone ? "card_for_phone_hint" : "card_for_large_hint")}</p>
      ${phone ? this.renderPhoneBar() : nothing}`;
  }

  private select<K extends keyof CardConfig>(key: K, label: I18nKey, choices: Choice[], current: string) {
    return html`<label class="field"
      >${this.t(label)}
      <select @change=${(e: Event) => this.set(key, (e.target as HTMLSelectElement).value as CardConfig[K])}>
        ${choices.map(([value, text]) => html`<option value=${value} ?selected=${value === current}>${this.t(text)}</option>`)}
      </select>
    </label>`;
  }

  /**
   * A style choice, grouped like the panel's (#439): automatic, neon, homely, designed and the plan's own styles (#1077,
   * read with the plan the card shows). An empty choice removes the option. A stored id this plan does not know stays
   * listed, so opening the dialog never changes it.
   */
  private styleSelect(key: "theme" | "theme_evening" | "theme_night" | "zoom_style", label: I18nKey, current: string, opts: { auto?: boolean; theme?: boolean; house?: boolean; none?: boolean }) {
    setCustomStyles(this._styles);
    const auto: Record<string, I18nKey> = { theme: "theme_theme", auto: "theme_auto", house: "style_house" };
    const option = (value: string) => {
      const own = styleById(value)?.group === "custom" ? styleById(value) : undefined;
      const text = value === "" ? this.t(key === "zoom_style" ? "zoom_style_off" : "style_none") : auto[value] ? this.t(auto[value]) : own ? (own.name ?? value) : this.t(`style_${value}` as I18nKey);
      return html`<option value=${value} ?selected=${value === current}>${text}</option>`;
    };
    const groups = key === "zoom_style" ? zoomChoices() : styleChoices(opts);
    const known = groups.some((g) => g.values.includes(current));
    return html`<label class="field"
      >${this.t(label)}
      <select @change=${(e: Event) => this.set(key, (e.target as HTMLSelectElement).value || undefined)}>
        ${groups.map((g) => (g.group === "none" || !g.group ? g.values.map(option) : html`<optgroup label=${this.t(`style_group_${g.group}` as I18nKey)}>${g.values.map(option)}</optgroup>`))}
        ${known ? nothing : html`<option value=${current} selected>${current}</option>`}
      </select>
    </label>`;
  }

  private toggle(key: "explode" | "roof_fade" | "roof" | "camera_wall" | "energy" | "room_panel" | "stats" | "fullscreen_button" | "room_names" | "surroundings" | "alerts" | "alert_jump" | "director" | "voice" | "scenes" | "idle_orbit" | "motion_trail" | "time_travel" | "household_card" | "rack_cards" | "weather" | "phone", label: I18nKey, hint?: I18nKey) {
    const on = this.value[key];
    return html`<label class="toggle">
      <input type="checkbox" .checked=${on} @change=${(e: Event) => this.set(key, (e.target as HTMLInputElement).checked)} />
      <span>${this.t(label)}${hint ? html`<small>${this.t(hint)}</small>` : nothing}</span>
    </label>`;
  }

  /**
   * The bar on the phone (#494, shown with the phone view; ported from NeonPlan 3D 4.0.0, MIT, Mastershort): which parts
   * it keeps, up to two own places, and whether the card opens with the list.
   */
  private renderPhoneBar() {
    const hidden = new Set(this._config.phone_hide ?? []);
    const part = (id: PhonePart) =>
      html`<label class="toggle">
        <input
          type="checkbox"
          .checked=${!hidden.has(id)}
          @change=${(e: Event) => {
            const next = new Set(hidden);
            if ((e.target as HTMLInputElement).checked) next.delete(id);
            else next.add(id);
            this.set("phone_hide", next.size ? PHONE_PARTS.filter((x) => next.has(x)) : undefined);
          }}
        />
        <span>${this.t(`card_phone_${id}`)}<small>${this.t(`card_phone_${id}_hint`)}</small></span>
      </label>`;
    return html`<h3>${this.t("card_section_phone")}</h3>
      ${PHONE_PARTS.map(part)} ${[0, 1].map((i) => this.renderPlace(i))}
      <p class="hint">${this.t("card_phone_place_hint")}</p>
      <label class="toggle">
        <input type="checkbox" .checked=${this._config.phone_start === "now"} @change=${(e: Event) => this.set("phone_start", (e.target as HTMLInputElement).checked ? "now" : undefined)} />
        <span>${this.t("card_phone_start_now")}<small>${this.t("card_phone_start_now_hint")}</small></span>
      </label>
      <label class="toggle">
        <input type="checkbox" .checked=${this._config.phone_solo === true} @change=${(e: Event) => this.set("phone_solo", (e.target as HTMLInputElement).checked || undefined)} />
        <span>${this.t("nav_solo")}<small>${this.t("card_phone_solo_hint")}</small></span>
      </label>`;
  }

  /** One of the two own places in the phone bar: its kind, word and symbol, and its scene or page. The second comes after the first. */
  private renderPlace(index: number) {
    const list = [...(this._config.phone_places ?? [])];
    const place = list[index];
    if (index > 0 && !list[index - 1]) return nothing;
    const save = (next: PhonePlace | null) => {
      if (next) list[index] = next;
      else list.splice(index, 1);
      this.set("phone_places", list.length ? list : undefined);
    };
    const runnable = Object.keys(this.hass?.states ?? {})
      .filter((id) => /^(scene|script)\./.test(id))
      .sort();
    const text = (key: I18nKey, value: string | undefined, max: number, placeholder: string, apply: (v: string) => void) =>
      html`<label class="field"
        >${this.t(key)}
        <input type="text" maxlength=${max} placeholder=${placeholder} .value=${value ?? ""} @change=${(e: Event) => apply((e.target as HTMLInputElement).value.trim())} />
      </label>`;
    return html`<div class="grid place">
      <label class="field"
        >${this.t("card_phone_place", { n: index + 1 })}
        <select
          @change=${(e: Event) => {
            const kind = (e.target as HTMLSelectElement).value as PhonePlace["kind"] | "";
            save(kind ? { kind, name: place?.name, icon: place?.icon, ...(kind === "action" ? { entity: runnable[0] } : kind === "link" ? { path: "/lovelace/0" } : {}) } : null);
          }}
        >
          <option value="" ?selected=${!place}>${this.t("card_phone_place_none")}</option>
          ${PHONE_PLACE_KINDS.map((k) => html`<option value=${k} ?selected=${place?.kind === k}>${this.t(`card_phone_place_${k}`)}</option>`)}
        </select>
      </label>
      ${place
        ? html`${text("card_phone_place_name", place.name, 24, "", (name) => save({ ...place, name: name || undefined }))}
          ${text("card_phone_place_icon", place.icon, 4, "💡", (icon) => save({ ...place, icon: icon || undefined }))}
          ${place.kind === "action"
            ? html`<label class="field"
                >${this.t("card_phone_place_entity")}
                <select @change=${(e: Event) => save({ ...place, entity: (e.target as HTMLSelectElement).value })}>
                  ${place.entity && !runnable.includes(place.entity) ? html`<option value=${place.entity} selected>${place.entity}</option>` : nothing}
                  ${runnable.map((id) => html`<option value=${id} ?selected=${id === place.entity}>${(this.hass?.states[id]?.attributes.friendly_name as string | undefined) ?? id}</option>`)}
                </select>
              </label>`
            : place.kind === "link"
              ? text("card_phone_place_path", place.path, 200, "/lovelace/energy", (path) => isHaPath(path) && save({ ...place, path }))
              : nothing}`
        : nothing}
    </div>`;
  }

  /** Floor pictures: on by default without a start floor, off with one (but can be switched on). */
  private renderThumbsToggle() {
    const auto = !this._config.floor;
    const on = this._config.floor_thumbs ?? auto;
    return html`<label class="toggle">
      <input
        type="checkbox"
        .checked=${on}
        @change=${(e: Event) => {
          const checked = (e.target as HTMLInputElement).checked;
          const next: CardConfig = { ...this._config };
          if (checked === auto) delete next.floor_thumbs;
          else next.floor_thumbs = checked;
          this._config = next;
          this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
        }}
      />
      <span>${this.t("card_floor_thumbs")}<small>${this.t(this._config.floor ? "card_floor_thumbs_hint_start" : "card_floor_thumbs_hint")}</small></span>
    </label>
    ${on ? this.renderTabsChoice() : nothing}`;
  }

  /** The floor switcher as tabs or as pictures (#548): unset is tabs on a phone-sized card, pictures on a larger one. */
  private renderTabsChoice() {
    const tabs = this._config.floor_tabs;
    const current = tabs === true ? "on" : tabs === false ? "off" : "auto";
    return html`<label class="field"
      >${this.t("card_floor_tabs")}
      <select @change=${(e: Event) => this.set("floor_tabs", { auto: undefined, on: true, off: false }[(e.target as HTMLSelectElement).value as "auto" | "on" | "off"])}>
        ${(["auto", "on", "off"] as const).map((v) => html`<option value=${v} ?selected=${v === current}>${this.t(`card_floor_tabs_${v}`)}</option>`)}
      </select>
    </label>`;
  }

  /** Switches in the card: on/off, and which of them. */
  private renderControls() {
    const c = this._config.controls;
    const on = !!c && (c === true || c.length > 0);
    const list: CardControl[] = c === true ? [...CARD_CONTROLS] : Array.isArray(c) ? c : [];
    const setList = (next: CardControl[]) => this.set("controls", next.length === CARD_CONTROLS.length ? true : next.length ? next : undefined);
    const v = this.value;
    const hideAfter = [0, 10, 30, 60, 120];
    return html`<label class="toggle">
        <input type="checkbox" .checked=${on} @change=${(e: Event) => this.set("controls", (e.target as HTMLInputElement).checked ? true : undefined)} />
        <span>${this.t("card_controls")}<small>${this.t("card_controls_hint")}</small></span>
      </label>
      <label class="toggle">
        <input type="checkbox" .checked=${v.central} @change=${(e: Event) => this.set("central", (e.target as HTMLInputElement).checked ? undefined : false)} />
        <span>${this.t("card_central")}<small>${this.t("card_central_hint")}</small></span>
      </label>
      ${!UNRELEASED.includes("fun_pets") || labOn()
        ? html`<label class="toggle">
            <input type="checkbox" .checked=${v.pets} @change=${(e: Event) => this.set("pets", (e.target as HTMLInputElement).checked ? undefined : false)} />
            <span>${this.t("card_pets")}<small>${this.t("card_pets_hint")}</small></span>
          </label>`
        : nothing}
      ${!UNRELEASED.includes("fun_halloween") || labOn()
        ? html`<label class="toggle">
            <input type="checkbox" .checked=${v.ghost} @change=${(e: Event) => this.set("ghost", (e.target as HTMLInputElement).checked ? undefined : false)} />
            <span>${this.t("card_ghost")}<small>${this.t("card_ghost_hint")}</small></span>
          </label>`
        : nothing}
      <label class="toggle">
        <input type="checkbox" .checked=${v.marker_names} @change=${(e: Event) => this.set("marker_names", (e.target as HTMLInputElement).checked ? true : undefined)} />
        <span>${this.t("card_marker_names")}<small>${this.t("card_marker_names_hint")}</small></span>
      </label>
      <label class="toggle">
        <input type="checkbox" .checked=${v.view_only} @change=${(e: Event) => this.set("view_only", (e.target as HTMLInputElement).checked ? true : undefined)} />
        <span>${this.t("card_view_only")}<small>${this.t("card_view_only_hint")}</small></span>
      </label>
      <label class="toggle">
        <input type="checkbox" .checked=${v.controls_hidden} @change=${(e: Event) => this.set("controls_hidden", (e.target as HTMLInputElement).checked ? true : undefined)} />
        <span>${this.t("card_controls_hidden")}<small>${this.t("card_controls_hidden_hint")}</small></span>
      </label>
      <label class="field"
        >${this.t("card_controls_hide_after")}
        <select @change=${(e: Event) => this.set("controls_hide_after", Number((e.target as HTMLSelectElement).value) || undefined)}>
          ${hideAfter.map((n) => html`<option value=${n} ?selected=${v.controls_hide_after === n}>${n ? this.t("card_hide_after_s", { n }) : this.t("card_idle_off")}</option>`)}
        </select>
      </label>
      ${on
        ? html`<div class="sub">
            ${CARD_CONTROLS.map(
              (x) => html`<label class="chip">
                <input
                  type="checkbox"
                  .checked=${list.includes(x)}
                  @change=${(e: Event) => setList((e.target as HTMLInputElement).checked ? CARD_CONTROLS.filter((y) => y === x || list.includes(y)) : list.filter((y) => y !== x))}
                />
                ${this.t(`card_control_${x}` as I18nKey)}
              </label>`,
            )}
          </div>`
        : nothing}`;
  }

  /** Kiosk: idle return, night dimming (sun or a time range) and the screensaver turn. */
  private renderKiosk() {
    const v = this.value;
    const night = v.night === "off" || v.night === "sun" ? v.night : "time";
    const minutes = [0, 1, 2, 5, 10];
    return html`<h3>${this.t("card_section_kiosk")}</h3>
      <div class="grid">
        <label class="field"
          >${this.t("card_idle_return")}
          <select @change=${(e: Event) => this.set("idle_return", Number((e.target as HTMLSelectElement).value) || undefined)}>
            ${minutes.map((m) => html`<option value=${m * 60} ?selected=${v.idle_return === m * 60}>${m ? this.t("card_idle_min", { n: m }) : this.t("card_idle_off")}</option>`)}
          </select>
        </label>
        <label class="field"
          >${this.t("card_night")}
          <select @change=${(e: Event) => this.set("night", { off: undefined, sun: "sun", time: "22:00-06:00" }[(e.target as HTMLSelectElement).value])}>
            <option value="off" ?selected=${night === "off"}>${this.t("card_night_off")}</option>
            <option value="sun" ?selected=${night === "sun"}>${this.t("card_night_sun")}</option>
            <option value="time" ?selected=${night === "time"}>${this.t("card_night_time")}</option>
          </select>
        </label>
        ${night === "time"
          ? html`<label class="field wide"
              >${this.t("card_night_range")}
              <input
                type="text"
                pattern="\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2}"
                placeholder="22:00-06:00"
                .value=${v.night}
                @change=${(e: Event) => this.set("night", (e.target as HTMLInputElement).value.trim() || undefined)}
              />
            </label>`
          : nothing}
      </div>
      <p class="hint">${this.t("card_idle_hint")}</p>
      ${this.toggle("idle_orbit", "card_idle_orbit", "card_idle_orbit_hint")}
      <div class="grid">
        <label class="field wide"
          >${this.t("card_dashboard")}
          <input type="text" placeholder="/lovelace/home" .value=${v.dashboard ?? ""} @change=${(e: Event) => this.set("dashboard", (e.target as HTMLInputElement).value.trim() || undefined)} />
        </label>
        <label class="field wide"
          >${this.t("card_dashboard_label")}
          <input type="text" .value=${v.dashboard_label ?? ""} @change=${(e: Event) => this.set("dashboard_label", (e.target as HTMLInputElement).value.trim() || undefined)} />
        </label>
      </div>
      <p class="hint">${this.t("card_dashboard_hint")}</p>`;
  }

  /** Warnings, scenes and the Pro add-ons (motion trail, weather with its entity). */
  private renderFeatures() {
    const v = this.value;
    const weathers = Object.keys(this.hass?.states ?? {})
      .filter((id) => id.startsWith("weather."))
      .sort();
    return html`<h3>${this.t("card_section_features")}</h3>
      ${this.toggle("alerts", "card_alerts", "card_alerts_hint")} ${this.toggle("alert_jump", "card_alert_jump", "card_alert_jump_hint")}
      ${this.toggle("director", "card_director", "card_director_hint")}
      ${this.toggle("voice", "card_voice", "card_voice_hint")}
      <div class="grid">
        <label class="field wide"
          >${this.t("screen_name")}
          <input type="text" placeholder=${this.t("screen_name_placeholder")} .value=${v.screen ?? ""} @change=${(e: Event) => this.set("screen", (e.target as HTMLInputElement).value.trim() || undefined)} />
        </label>
      </div>
      <p class="hint">${this.t("screen_name_hint")}</p>
      ${this.toggle("scenes", "card_scenes", "card_scenes_hint")}
      ${this.toggle("motion_trail", "card_motion_trail", "card_motion_trail_hint")} ${this.toggle("camera_wall", "card_camera_wall", "card_camera_wall_hint")}
      ${this.toggle("time_travel", "card_time_travel", "card_time_travel_hint")}
      ${this.toggle("household_card", "card_household", "card_household_hint")}
      ${this.toggle("rack_cards", "card_rack_cards", "card_rack_cards_hint")}
      ${this.toggle("weather", "card_weather", "card_weather_hint")}
      ${v.weather !== false
        ? html`<div class="grid">
            <label class="field wide"
              >${this.t("weather_entity")}
              <select @change=${(e: Event) => this.set("weather_entity", (e.target as HTMLSelectElement).value || undefined)}>
                <option value="" ?selected=${!v.weather_entity}>${this.t("card_weather_plan")}</option>
                ${weathers.map((id) => html`<option value=${id} ?selected=${id === v.weather_entity}>${String(this.hass?.states[id]?.attributes.friendly_name ?? id)}</option>`)}
              </select>
            </label>
          </div>`
        : nothing}`;
  }

  protected render() {
    if (this.hass && !languageReady(this.hass.language)) return nothing;
    const v = this.value;
    const flows = v.flows === undefined ? "switch" : v.flows ? "on" : "off";
    const holos = v.holograms === undefined ? "switch" : v.holograms ? "on" : "off";
    const head = this.embedded ? nothing : html`${this.renderHome()}${this.renderTemplate()}`;
    // a card with a template takes its options from there: the form folds away (#495)
    if (!this.embedded && v.template) return head;
    const phone = v.phone === true;
    // a phone has no wall tablet's kiosk options; inside Settings the form stands in tabs (#495)
    const tabs = TABS.filter(([id]) => id !== "kiosk" || !phone);
    const tab = tabs.some(([id]) => id === this._tab) ? this._tab : "for";
    const on = (id: CardTab) => !this.embedded || tab === id;
    return html`
      ${head}
      ${this.embedded
        ? html`<div class="tabs" role="tablist">
            ${tabs.map(([id, label]) => html`<button type="button" role="tab" aria-selected=${tab === id} @click=${() => (this._tab = id)}>${this.t(label)}</button>`)}
          </div>`
        : nothing}
      <section ?hidden=${!on("for")}>${this.renderPurpose()}</section>
      <section ?hidden=${!on("view")}>
      <h3>${this.t("card_section_view")}</h3>
      <div class="grid">
        <label class="field wide"
          >${this.t("card_floor")}
          <select @change=${(e: Event) => this.set("floor", (e.target as HTMLSelectElement).value || undefined)}>
            <option value="" ?selected=${!v.floor}>${this.t("card_floor_house")}</option>
            ${this._floors.map((f) => html`<option value=${f.id} ?selected=${f.id === v.floor}>${f.name}</option>`)}
            ${v.floor && !this._floors.some((f) => f.id === v.floor) ? html`<option value=${v.floor} selected>${v.floor}</option>` : nothing}
          </select>
        </label>
        <label class="field"
          >${this.t("card_size")}
          <select @change=${(e: Event) => this.set("fill", (e.target as HTMLSelectElement).value === "fill")}>
            <option value="fixed" ?selected=${!v.fill}>${this.t("card_size_fixed")}</option>
            <option value="fill" ?selected=${v.fill}>${this.t("card_size_fill")}</option>
          </select>
        </label>
        <label class="field" ?hidden=${v.fill}
          >${this.t("card_height")}
          <input
            type="number"
            min="150"
            max="2000"
            step="10"
            .value=${String(v.height)}
            @change=${(e: Event) => {
              const h = Math.round(Number((e.target as HTMLInputElement).value));
              if (h > 100) this.set("height", h);
            }}
          />
        </label>
        ${this.styleSelect("theme", "theme", v.theme, { theme: true, auto: true, house: true })}
        ${this.styleSelect("theme_evening", "card_theme_evening", this._config.theme_evening ?? "", { none: true })}
        ${this.styleSelect("theme_night", "card_theme_night", this._config.theme_night ?? "", { none: true })}
        <label class="field"
          >${this.t("card_style_entity")}
          <input type="text" placeholder="input_select.style" .value=${this._config.style_entity ?? ""} @change=${(e: Event) => this.set("style_entity", (e.target as HTMLInputElement).value.trim() || undefined)} />
        </label>
        ${this.styleSelect("zoom_style", "zoom_style", this._config.zoom_style ?? "", {})}
        ${this._config.zoom_style
          ? html`<label class="field" title=${this.t("zoom_late_hint")}
                >${this.t("zoom_late")} (${this.t("zoom_late_early")} … ${this.t("zoom_late_late")})
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  .value=${String(this._config.zoom_late ?? ZOOM_LATE_DEFAULT)}
                  @change=${(e: Event) => {
                    const n = Math.round(Number((e.target as HTMLInputElement).value));
                    this.set("zoom_late", n === ZOOM_LATE_DEFAULT ? undefined : n);
                  }}
                />
              </label>
              <label class="toggle">
                <input type="checkbox" .checked=${this._config.zoom_scope === "room"} @change=${(e: Event) => this.set("zoom_scope", (e.target as HTMLInputElement).checked ? "room" : undefined)} />
                <span>${this.t("zoom_scope_room")}<small>${this.t("zoom_scope_hint")}</small></span>
              </label>
              <p class="hint">${this.t("zoom_style_hint")}</p>`
          : nothing}
        ${this.select("clock", "clock", [["off", "clock_off"], ["tl", "clock_tl"], ["tr", "clock_tr"], ["bl", "clock_bl"], ["br", "clock_br"]], v.clock ?? "off")}
        <label class="field"
          >${this.t("accent")}
          <span class="accent-pick"
            >${colourField({ value: this._config.accent ?? null, base: ACCENT_DEFAULT, label: this.t("accent"), t: (k, v) => this.t(k, v), live: true, onChange: (hex) => hex && this.set("accent", hex) })}
            ${colourReset({ value: this._config.accent, fallback: ACCENT_DEFAULT, label: this.t("accent_reset"), onReset: () => this.set("accent", undefined) })}</span
          >
        </label>
        ${this.select("view", "card_view", [["3d", "card_view_3d"], ["2d", "card_view_2d"]], v.view)}
        ${this.select("walls", "card_walls", [["auto", "walls_auto"], ["cut", "walls_cut"]], v.walls)}
        ${this.select("quality", "quality", [["auto", "quality_auto"], ["low", "quality_low"], ["high", "quality_high"]], v.quality)}
        ${this.select("floor_stack", "card_floor_stack", [["dim", "floor_stack_dim"], ["stacked", "floor_stack_stacked"], ["single", "floor_stack_single"]], v.floor_stack)}
      </div>
      ${v.fill ? html`<p class="hint">${this.t("card_fill_hint")}</p>` : nothing}
      <p class="hint">${this.t("card_quality_hint")}</p>
      </section>
      <section ?hidden=${!on("show")}>
      <h3>${this.t("card_section_show")}</h3>
      <div class="grid">
        ${this.select("markers", "markers", [["none", "markers_none"], ["room", "markers_room"], ["important", "markers_important"], ["all", "markers_all"]], v.markers)}
        ${this.select("marker_size", "pin_size", [["small", "pin_size_small"], ["normal", "pin_size_normal"], ["large", "pin_size_large"]], v.marker_size ?? "normal")}
        ${this.select("heatmap", "heatmap", [["none", "heat_off"], ["temperature", "heat_temperature"], ["humidity", "heat_humidity"], ["co2", "heat_co2"], ["values", "heat_values"]], v.heatmap)}
        <label class="field wide"
          >${this.t("flows")}
          <select @change=${(e: Event) => {
            const c = (e.target as HTMLSelectElement).value;
            this.set("flows", c === "switch" ? undefined : c === "on");
          }}>
            <option value="switch" ?selected=${flows === "switch"}>${this.t("card_flows_switch")}</option>
            <option value="on" ?selected=${flows === "on"}>${this.t("card_flows_on")}</option>
            <option value="off" ?selected=${flows === "off"}>${this.t("card_flows_off")}</option>
          </select>
        </label>
        <label class="field wide"
          >${this.t("holos")}
          <select @change=${(e: Event) => {
            const c = (e.target as HTMLSelectElement).value;
            this.set("holograms", c === "switch" ? undefined : c === "on");
          }}>
            <option value="switch" ?selected=${holos === "switch"}>${this.t("card_flows_switch")}</option>
            <option value="on" ?selected=${holos === "on"}>${this.t("card_flows_on")}</option>
            <option value="off" ?selected=${holos === "off"}>${this.t("card_flows_off")}</option>
          </select>
        </label>
      </div>
      ${phone ? nothing : this.renderControls()}
      ${phone ? nothing : this.renderThumbsToggle()} ${this.toggle("room_names", "card_room_names")}
      ${this._hasMap ? this.toggle("surroundings", "card_surroundings", "card_surroundings_hint") : nothing}
      ${this.toggle("energy", "card_energy")} ${this.toggle("room_panel", "card_room_panel", "card_room_panel_hint")}
      ${this.toggle("fullscreen_button", "card_fullscreen_button", "card_fullscreen_button_hint")}
      ${this.toggle("explode", "card_explode")} ${this.toggle("roof", "card_roof", "card_roof_hint")} ${this.toggle("roof_fade", "card_roof_fade", "card_roof_fade_hint")} ${this.toggle("stats", "card_stats", "card_stats_hint")}
      </section>
      <section ?hidden=${!on("features")}>${this.renderFeatures()}</section>
      ${phone ? nothing : html`<section ?hidden=${!on("kiosk")}>${this.renderKiosk()}</section>`}
    `;
  }

  static styles = css`
    .accent-pick {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    ${colourResetCss}
    :host {
      display: block;
      color: var(--primary-text-color);
    }
    h3 {
      margin: 18px 0 8px;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--secondary-text-color);
    }
    h3:first-child {
      margin-top: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 12px;
    }
    [hidden] {
      display: none;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .place {
      margin: 6px 0 12px;
    }
    .home {
      margin-bottom: 12px;
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--divider-color, #8884);
    }
    .tabs button {
      padding: 10px 14px;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      background: none;
      color: var(--secondary-text-color);
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .tabs button[aria-selected="true"] {
      color: var(--primary-text-color);
      border-bottom-color: var(--primary-color);
      font-weight: 600;
    }
    :host([embedded]) section > h3:first-child {
      display: none;
    }
    .purpose {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .purpose button {
      flex: 1 1 160px;
      min-height: 44px;
      padding: 12px 10px;
      border: 1px solid var(--divider-color, #8884);
      border-radius: 10px;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .purpose button[aria-pressed="true"] {
      border-color: var(--primary-color);
      box-shadow: inset 0 0 0 1px var(--primary-color);
      font-weight: 600;
    }
    .link {
      padding: 0;
      border: none;
      background: none;
      color: var(--primary-color);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
    .field {
      display: grid;
      gap: 4px;
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    select,
    input[type="number"],
    input[type="text"] {
      box-sizing: border-box;
      width: 100%;
      min-height: 40px;
      padding: 8px 10px;
      border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
      border-radius: 8px;
      background: var(--card-background-color, transparent);
      color: var(--primary-text-color);
      font: inherit;
      font-size: 14px;
    }
    .toggle {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 0;
      font-size: 14px;
      cursor: pointer;
    }
    .toggle input {
      flex: none;
      width: 18px;
      height: 18px;
      margin: 1px 0 0;
      accent-color: var(--primary-color);
    }
    .sub {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      margin: -2px 0 6px 28px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .chip input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--primary-color);
    }
    .toggle small,
    .hint {
      display: block;
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    @media (max-width: 450px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}

defineElement("home-3d-card-editor", Floorplan3dCardEditor);
