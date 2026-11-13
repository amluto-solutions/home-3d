// Room panel: controls for the devices of the room's area (lights, covers, heating, media, switches,
// scenes and scripts). Shown next to the 3D view when a room is selected.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { areaEntities, coverControls, slatTilt, slatsInverted, entityName, groupByDevice, isUnavailable, kindOf, roomClimateSensors, roomClimateValue, roomPanelEntities, fromCelsius, tempUnit, type DeviceKind } from "../devices.ts";
import { askConfirm } from "../ask.ts";
import { callServiceSafe } from "../failure.ts";
import { confirmGroup } from "../confirm-group.ts";
import "./ask-dialog.ts";
import { formatNumber, translate, type I18nKey } from "../i18n.ts";
import { released } from "../features.ts";
import { locatedPersons, personsShown } from "../presence.ts";
import { iconPath } from "../icons.ts";
import { openMoreInfo, stateText } from "../markers.ts";
import type { Building, Floor, Room } from "../model.ts";
import { roofWindowsOver } from "../solar.ts";
import { arrangePanel, groupOrder, type ArrangedPanel, type PanelGroup } from "../panel-layout.ts";
import { controls, tokens } from "../styles.ts";
import { FloatResize, SheetResize, type Edge } from "../float-panel.ts";
import type { HassEntity, HomeAssistant } from "../types.ts";

const CAMERA_REFRESH_MS = 3000;

/** Colour presets offered for colour lights (warm white first). */
const SWATCHES: [number, number, number][] = [
  [255, 181, 71],
  [255, 236, 210],
  [55, 224, 255],
  [91, 124, 255],
  [255, 95, 210],
  [120, 255, 150],
];

const icon = (kind: DeviceKind) =>
  html`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d=${iconPath(kind)} />
  </svg>`;

/** Filled transport icons (the Unicode symbols turn into emoji on some systems). */
const TRANSPORT = {
  previous: "M6 6h2v12H6zM20 6v12l-10-6z",
  play: "M8 5v14l11-7z",
  pause: "M7 5h4v14H7zM13 5h4v14h-4z",
  next: "M16 6h2v12h-2zM4 6v12l10-6z",
};
const transport = (d: string) =>
  html`<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d=${d} /></svg>`;

export class Fp3dRoomPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    room: { attribute: false },
    floor: { attribute: false },
    building: { attribute: false },
    confirmEntities: { attribute: false },
    sheets: { attribute: false },
    readOnly: { type: Boolean },
    noLook: { type: Boolean },
    canEdit: { type: Boolean },
    _showAll: { state: true },
    _editing: { state: true },
    _tick: { state: true },
  };

  declare hass: HomeAssistant;
  declare room: Room | null;
  /** Floor of the room: the panel shows what the plan shows in the room. */
  declare floor: Floor | null;
  /** The whole building: the roof windows over the room show in its card too. */
  declare building: Building | null;
  /** Entities that ask before they are switched. */
  declare confirmEntities: Set<string> | null;
  /** Time travel: the panel shows the past and switches nothing. */
  declare readOnly: boolean;
  /** The 2D plan (#41) has no camera to look through: the button stays away. */
  declare noLook: boolean;
  /** What modules offer in this room (📢 an announcement …): a button each, a tap fires "sheet-open" with its id. */
  declare sheets: { id: string; icon: string; title: string }[] | null;
  /** On the editors list (#229): may change what the panel lists ("Edit list"), for every viewer. */
  declare canEdit: boolean;
  /** "Edit list" is open (#229); true once its lazy chunk has loaded. */
  private declare _editing: boolean;
  /** Show the other devices of the area as well (their main entities). */
  private declare _showAll: boolean;
  /** Bumped every few seconds while the panel is open, so camera snapshots refresh. */
  private declare _tick: number;
  private cameraTimer: ReturnType<typeof setInterval> | undefined;
  private memo: { entities: HomeAssistant["entities"]; floor: Floor | null; building: Building | null; room: Room; shown: string[]; more: string[] } | null = null;
  private hasCameras = false;

  constructor() {
    super();
    this.room = null;
    this.floor = null;
    this.building = null;
    this.sheets = null;
    this.readOnly = false;
    this.canEdit = false;
    this._editing = false;
    this._showAll = false;
    this._tick = 0;
  }

  /** The panel's own size, set by dragging its edges (#267), kept per device. */
  private readonly resizer = new FloatResize(this, "room_size");
  /** The sheet's height on phones, set by dragging its grab bar (#353), kept per device. */
  private readonly sheetSizer = new SheetResize(this, "room_sheet");
  private readonly onWindow = () => this.resizer.apply();

  connectedCallback(): void {
    super.connectedCallback();
    this.resizer.load();
    this.sheetSizer.load();
    window.addEventListener("resize", this.onWindow);
    // snapshots every few seconds are much lighter for a wall tablet than a permanent stream
    this.cameraTimer = setInterval(() => {
      if (this.hasCameras && !document.hidden) this._tick++;
    }, CAMERA_REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.onWindow);
    clearInterval(this.cameraTimer);
  }

  private t(key: I18nKey, vars?: Record<string, string | number>): string {
    return translate(this.hass, key, vars);
  }

  private call(domain: string, service: string, data: Record<string, unknown>): void {
    if (this.readOnly) return;
    callServiceSafe(this.hass, domain, service, data, (error) => this.t("service_failed", { error }));
  }

  private get areaName(): string | undefined {
    return this.room?.area_id ? this.hass.areas?.[this.room.area_id]?.name : undefined;
  }

  private name(id: string): string {
    return entityName(this.hass, id, this.areaName);
  }

  private nameButton(id: string) {
    return html`<button class="fp3d-rp-name" title=${this.readOnly ? nothing : this.t("details")} @click=${() => !this.readOnly && openMoreInfo(this, id)}>${this.name(id)}</button>`;
  }

  /** Ask first for devices marked so (a blind that must not move by accident). */
  private async askFor(id: string): Promise<boolean> {
    return !this.confirmEntities?.has(id) || (await askConfirm(this.t("confirm_switch", { name: this.name(id) }), { ok: this.t("action_confirm_ok"), cancel: this.t("cancel") }));
  }

  /** The group buttons ("All on", "All open" …) ask first once when any of the devices does (#162). */
  private async callAll(domain: string, service: string, ids: string[]): Promise<void> {
    if (this.readOnly) return;
    const ok = await confirmGroup(ids, this.confirmEntities, (id) => this.name(id), (names) =>
      askConfirm(this.t("confirm_switch", { name: names }), { ok: this.t("action_confirm_ok"), cancel: this.t("cancel") }),
    );
    if (ok) this.call(domain, service, { entity_id: ids });
  }

  private toggle(st: HassEntity, on: boolean, onToggle: () => void) {
    const guarded = async () => {
      if (this.readOnly) return;
      if (!(await this.askFor(st.entity_id))) return;
      onToggle();
    };
    return html`<button
      class="fp3d-switch"
      role="switch"
      aria-checked=${on ? "true" : "false"}
      aria-label=${this.name(st.entity_id)}
      ?disabled=${isUnavailable(st)}
      @click=${guarded}
    ></button>`;
  }

  /** Who is in the room now (locating), as a short line under the name. */
  private renderHere(room: Room) {
    if (!this.building || !released("locate") || !personsShown(this.building)) return nothing;
    const here = locatedPersons(this.hass, this.building).filter((p) => p.roomId === room.id);
    if (!here.length) return nothing;
    return html`<p class="fp3d-rp-facts fp3d-rp-here">
      ${here.map((p, i) => html`${i ? ", " : ""}<span style="color:${p.color}">●</span> ${p.name}`)}
    </p>`;
  }

  /** Focus moves to the room's name when the room was chosen from the Rooms picker (#259, V19). */
  async focusHeading(): Promise<void> {
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>(".fp3d-rp-head h2")?.focus();
  }

  protected render() {
    const room = this.room;
    if (!room || !this.hass) return nothing;
    const all = areaEntities(this.hass, room.area_id);
    // what the plan shows in the room; the rest of the area on request (each device's main entity);
    // worked out once per registry, room and floor (every state change renders the panel again)
    const m = this.memo;
    const { shown, more } =
      m && m.entities === this.hass.entities && m.floor === this.floor && m.building === this.building && m.room === room
        ? m
        : (this.memo = {
            entities: this.hass.entities,
            floor: this.floor,
            building: this.building,
            room,
            ...(this.floor ? roomPanelEntities(this.hass, this.floor, room, this.building ? roofWindowsOver(this.building, room.id) : []) : { shown: all, more: [] }),
          });
    const extra = groupByDevice(this.hass, more).map((g) => g.primary);
    const layout = room.panel_layout;
    const pins = new Set(layout?.pinned ?? []);
    // a pinned device of the area shows without "More devices" (#229)
    const hiddenCount = extra.filter((id) => !pins.has(id)).length;
    const ids = this._showAll ? [...shown, ...extra] : [...shown, ...extra.filter((id) => pins.has(id))];
    // an entity placed in the plan but since removed from Home Assistant has no state: left out (the panel threw)
    const live = ids.filter((id) => !!this.hass.states[id]);
    // pinned rows on top, then the groups, in the order an editor chose (#229)
    const arranged = arrangePanel(live, kindOf, layout);
    const of = (kinds: DeviceKind[]) => live.filter((id) => kinds.includes(kindOf(id)!)).map((id) => this.hass.states[id]);
    const lights = of(["light"]);
    const covers = of(["cover"]);
    const climates = of(["climate"]);
    this.hasCameras = of(["camera"]).length > 0;
    const facts = this.facts(climates);
    const lightsOn = lights.filter((l) => l.state === "on");
    const editable = this.canEdit && !this.readOnly && !!room.area_id;
    const editing = editable && this._editing;
    const sheet = this.sheetSizer;
    return html`<section class="fp3d-rp ${this.readOnly ? "fp3d-rp-ro" : ""}" aria-label=${room.name}>
      <div
        class="fp3d-rp-grab"
        role="separator"
        aria-orientation="horizontal"
        tabindex="0"
        aria-label=${this.t("room_sheet_hint")}
        title=${this.t("room_sheet_hint")}
        @pointerdown=${(e: PointerEvent) => sheet.begin(e)}
        @pointermove=${(e: PointerEvent) => sheet.move(e)}
        @pointerup=${() => sheet.end()}
        @pointercancel=${() => sheet.end()}
        @keydown=${(e: KeyboardEvent) => sheet.key(e)}
        @dblclick=${() => sheet.reset()}
      ><span aria-hidden="true"></span></div>
      <header
        class="fp3d-rp-head"
        @pointerdown=${(e: PointerEvent) => sheet.begin(e)}
        @pointermove=${(e: PointerEvent) => sheet.move(e)}
        @pointerup=${() => sheet.end()}
        @pointercancel=${() => sheet.end()}
      >
        <div>
          <h2 tabindex="-1">${room.name}</h2>
          ${facts.length ? html`<p class="fp3d-rp-facts">${facts.join(" · ")}</p>` : nothing}
          ${this.renderHere(room)}
          ${this.readOnly ? html`<p class="fp3d-rp-facts fp3d-rp-ro-note">⏪ ${this.t("tt_readonly")}</p>` : nothing}
          ${this.sheets?.length && !this.readOnly
            ? html`<div class="fp3d-rp-sheets">
                ${this.sheets.map(
                  (sh) => html`<button class="fp3d-rp-sheet" @click=${() => this.dispatchEvent(new CustomEvent("sheet-open", { detail: { id: sh.id }, bubbles: true, composed: true }))}>
                    <span aria-hidden="true">${sh.icon}</span>${sh.title}
                  </button>`,
                )}
              </div>`
            : nothing}
        </div>
        ${editable
          ? html`<button class="fp3d-btn fp3d-rp-small fp3d-rp-edit" aria-pressed=${editing ? "true" : "false"} @click=${() => this.toggleEdit()}>
              ${this.t(editing ? "done" : "panel_edit_list")}
            </button>`
          : nothing}
        <button class="fp3d-rp-close" aria-label=${this.t("close")} @click=${() => this.fire("close")}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <div class="fp3d-rp-body">
        <!-- time travel: one disabled fieldset greys out and disables every control inside it, with one tooltip (#210) -->
        <fieldset class="fp3d-rp-controls" ?disabled=${this.readOnly} title=${this.readOnly ? this.t("tt_past_no") : nothing}>
        ${!room.area_id
          ? html`<p class="fp3d-rp-note">${this.t(this.canEdit ? "panel_no_area" : "panel_no_area_viewer")}</p>`
          : !ids.length
            ? html`<p class="fp3d-rp-note">${this.t(this.canEdit ? "panel_empty" : "panel_empty_viewer")}</p>`
            : nothing}
        ${editing
          ? html`<fp3d-room-list-edit
              .hass=${this.hass}
              .roomId=${room.id}
              .arranged=${this.editList(room)}
              .hiddenIds=${room.hidden ?? []}
              .layout=${layout ?? null}
              .allGroups=${groupOrder(layout)}
              .nameOf=${(id: string) => this.name(id)}
              .iconOf=${(id: string) => {
                const kind = kindOf(id);
                return kind ? iconPath(kind) : null;
              }}
              .t=${(key: I18nKey) => this.t(key)}
            ></fp3d-room-list-edit>`
          : html`${arranged.pinned.length ? this.section("panel_pinned", arranged.pinned.map((id) => this.rowOf(this.hass.states[id]))) : nothing}
            ${arranged.groups.map((g) => this.groupSection(g.group, g.ids, lights, lightsOn, covers))}`}
        </fieldset>
        ${hiddenCount
          ? html`<button class="fp3d-btn fp3d-rp-small fp3d-rp-more" @click=${() => (this._showAll = !this._showAll)}>
              ${this._showAll ? this.t("panel_less") : this.t("panel_more", { n: hiddenCount })}
            </button>`
          : nothing}
      </div>
      ${(["w", "s", "sw"] as Edge[]).map((edge) => this.renderEdge(edge))}
    </section>`;
  }

  /** An edge or the corner to drag (arrow keys too); a double click puts the size back (#267). */
  private renderEdge(edge: Edge) {
    return html`<div
      class="fp3d-rz fp3d-rz-${edge}"
      role="separator"
      tabindex="0"
      aria-label=${this.t("room_resize_hint")}
      title=${this.t("room_resize_hint")}
      @pointerdown=${(e: PointerEvent) => this.resizer.begin(e, edge)}
      @pointermove=${(e: PointerEvent) => this.resizer.move(e)}
      @pointerup=${() => this.resizer.end()}
      @pointercancel=${() => this.resizer.end()}
      @keydown=${(e: KeyboardEvent) => this.resizer.key(e, edge)}
      @dblclick=${() => this.resizer.reset()}
    ></div>`;
  }

  /** Opens "Edit list" (its chunk loads the first time) or closes it (#229). */
  private toggleEdit(): void {
    if (this._editing) {
      this._editing = false;
      return;
    }
    void import("./listedit.ts").then(() => (this._editing = true));
  }

  /** What "Edit list" lists: what the panel can show, hidden entities too (#229). */
  private editList(room: Room): ArrangedPanel {
    const open = { ...room, hidden: [] };
    const { shown, more } = this.floor ? roomPanelEntities(this.hass, this.floor, open, this.building ? roofWindowsOver(this.building, room.id) : []) : { shown: areaEntities(this.hass, room.area_id), more: [] };
    const keep = new Set([...(room.hidden ?? []), ...(room.panel_layout?.pinned ?? [])]);
    const extra = groupByDevice(this.hass, more)
      .map((g) => g.primary)
      .filter((id) => this._showAll || keep.has(id));
    return arrangePanel([...new Set([...shown, ...extra])].filter((id) => !!this.hass.states[id]), kindOf, room.panel_layout);
  }

  /** One row of the panel, by the entity's kind (a pinned row looks like the row in its group). */
  private rowOf(st: HassEntity): TemplateResult {
    const kind = kindOf(st.entity_id);
    if (kind === "light") return this.lightRow(st);
    if (kind === "cover") return this.coverRow(st);
    if (kind === "climate") return this.climateRow(st);
    if (kind === "media") return this.mediaRow(st);
    if (kind === "camera") return this.cameraTile(st);
    if (kind === "sensor" || kind === "binary") return this.sensorRow(st);
    if (kind === "scene" || kind === "script") return html`<div class="fp3d-rp-scenes">${this.sceneButton(st)}</div>`;
    return this.switchRow(st);
  }

  private sceneButton(st: HassEntity) {
    return html`<button class="fp3d-btn" ?disabled=${isUnavailable(st)} @click=${() => this.call(kindOf(st.entity_id) === "scene" ? "scene" : "script", "turn_on", { entity_id: st.entity_id })}>
      ${this.name(st.entity_id)}
    </button>`;
  }

  /** A group's section; "All on/off" and "All up/down" act on every light or cover shown, pinned ones too. */
  private groupSection(group: PanelGroup, ids: string[], lights: HassEntity[], lightsOn: HassEntity[], covers: HassEntity[]) {
    const states = ids.map((id) => this.hass.states[id]);
    if (group === "lights")
      return this.section(
        "panel_lights",
        states.map((st) => this.lightRow(st)),
        html`${lightsOn.length < lights.length
          ? html`<button class="fp3d-btn fp3d-rp-small" @click=${() => this.callAll("light", "turn_on", lights.filter((l) => !isUnavailable(l)).map((l) => l.entity_id))}>
              ${this.t("panel_all_on")}
            </button>`
          : nothing}${lightsOn.length
          ? html`<button class="fp3d-btn fp3d-rp-small" @click=${() => this.callAll("light", "turn_off", lightsOn.map((l) => l.entity_id))}>
              ${this.t("panel_all_off")}
            </button>`
          : nothing}`,
      );
    if (group === "covers")
      return this.section(
        "panel_covers",
        states.map((st) => this.coverRow(st)),
        covers.filter((c) => coverControls(c).open || coverControls(c).close).length > 1
          ? html`<button class="fp3d-btn fp3d-rp-small" @click=${() => this.callAll("cover", "open_cover", covers.filter((c) => !isUnavailable(c) && coverControls(c).open).map((c) => c.entity_id))}>
                ${this.t("panel_all_open")}</button
              ><button class="fp3d-btn fp3d-rp-small" @click=${() => this.callAll("cover", "close_cover", covers.filter((c) => !isUnavailable(c) && coverControls(c).close).map((c) => c.entity_id))}>
                ${this.t("panel_all_close")}
              </button>`
          : nothing,
      );
    if (group === "scenes") return this.section("panel_scenes", [html`<div class="fp3d-rp-scenes">${states.map((st) => this.sceneButton(st))}</div>`]);
    const title: Record<Exclude<PanelGroup, "lights" | "covers" | "scenes">, I18nKey> = {
      climate: "panel_climate",
      media: "panel_media",
      switches: "panel_switches",
      cameras: "panel_cameras",
      sensors: "panel_sensors",
    };
    return this.section(title[group], states.map((st) => this.rowOf(st)));
  }

  /** Header facts: the room's temperature and humidity from its climate sensors (chosen or automatic). */
  private facts(climates: HassEntity[]): string[] {
    const out: string[] = [];
    const room = this.room!;
    const value = (key: "temperature" | "humidity", fallbackUnit: string) => {
      const v = roomClimateValue(this.hass, this.floor, room, key);
      if (v === null) return null;
      if (key === "temperature") return `${formatNumber(this.hass, fromCelsius(this.hass, v), 1)} ${tempUnit(this.hass)}`;
      const first = roomClimateSensors(this.hass, this.floor, room, key)[0];
      const unit = (this.hass.states[first]?.attributes.unit_of_measurement as string | undefined) ?? fallbackUnit;
      return `${formatNumber(this.hass, v, 1)} ${unit}`;
    };
    const climateTemp = climates.find((c) => typeof c.attributes.current_temperature === "number");
    const temp = value("temperature", "°C");
    if (temp) out.push(temp);
    else if (climateTemp && room.climate?.temperature !== "none") out.push(`${formatNumber(this.hass, climateTemp.attributes.current_temperature as number, 1)} ${tempUnit(this.hass)}`);
    const hum = value("humidity", "%");
    if (hum) out.push(hum);
    return out;
  }

  private section(title: I18nKey, rows: TemplateResult[], action: TemplateResult | typeof nothing = nothing) {
    return html`<div class="fp3d-rp-sec">
      <div class="fp3d-rp-sec-head"><h3>${this.t(title)}</h3>${action}</div>
      ${rows}
    </div>`;
  }

  private lightRow(st: HassEntity) {
    const a = st.attributes;
    const on = st.state === "on";
    const modes = (a.supported_color_modes as string[] | undefined) ?? [];
    const dimmable = modes.some((m) => m !== "onoff");
    const temp = modes.includes("color_temp");
    const color = modes.some((m) => ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(m));
    const pct = typeof a.brightness === "number" ? Math.round((a.brightness / 255) * 100) : 100;
    const kMin = (a.min_color_temp_kelvin as number | undefined) ?? 2200;
    const kMax = (a.max_color_temp_kelvin as number | undefined) ?? 6500;
    const id = st.entity_id;
    return html`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon ${on ? "fp3d-rp-on" : ""}">${icon("light")}</span>
      ${this.nameButton(id)}
      <span class="fp3d-rp-state">${this.stateOf(st)}</span>
      ${this.toggle(st, on, () => this.call("light", "toggle", { entity_id: id }))}
      ${on && dimmable
        ? html`<label class="fp3d-rp-slider"
            ><span>${this.t("brightness")}</span>
            <input
              type="range"
              min="1"
              max="100"
              .value=${String(pct)}
              @change=${(e: Event) => this.call("light", "turn_on", { entity_id: id, brightness_pct: Number((e.target as HTMLInputElement).value) })}
          /></label>`
        : nothing}
      ${on && temp
        ? html`<label class="fp3d-rp-slider fp3d-rp-ct"
            ><span>${this.t("color_temp")}</span>
            <input
              type="range"
              min=${kMin}
              max=${kMax}
              step="50"
              .value=${String((a.color_temp_kelvin as number | undefined) ?? kMin)}
              @change=${(e: Event) => this.call("light", "turn_on", { entity_id: id, color_temp_kelvin: Number((e.target as HTMLInputElement).value) })}
          /></label>`
        : nothing}
      ${on && color
        ? html`<div class="fp3d-rp-swatches" role="group" aria-label=${this.t("color")}>
            ${SWATCHES.map(
              (c) => html`<button
                class="fp3d-rp-swatch"
                style="--c: rgb(${c.join(",")})"
                aria-label="rgb(${c.join(", ")})"
                @click=${() => this.call("light", "turn_on", { entity_id: id, rgb_color: c })}
              ></button>`,
            )}
          </div>`
        : nothing}
    </div>`;
  }

  /** A cover's row: only the buttons and sliders its supported_features allow (#243, coverControls). */
  private coverRow(st: HassEntity) {
    const a = st.attributes;
    const c = coverControls(st);
    const id = st.entity_id;
    const na = isUnavailable(st);
    const button = (label: I18nKey, service: string, ask = false) =>
      html`<button class="fp3d-btn fp3d-rp-small" ?disabled=${na} @click=${async () => (!ask || (await this.askFor(id))) && this.call("cover", service, { entity_id: id })}>${this.t(label)}</button>`;
    // "Invert slats" on the blind's window (#453): its slats' tilt is shown and sent the other way round
    const inv = slatsInverted(this.building, id);
    const slider = (label: I18nKey, value: number, service: string, key: string, turn: (v: number) => number = (v) => v) =>
      html`<label class="fp3d-rp-slider"
        ><span>${this.t(label)}</span>
        <input
          type="range"
          min="0"
          max="100"
          ?disabled=${na}
          .value=${String(value)}
          @change=${(e: Event) => this.call("cover", service, { entity_id: id, [key]: turn(Number((e.target as HTMLInputElement).value)) })}
      /></label>`;
    return html`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon">${icon("cover")}</span>
      ${this.nameButton(id)}
      <span class="fp3d-rp-state">${this.stateOf(st)}</span>
      <div class="fp3d-rp-buttons">
        ${c.open ? button("cover_open", "open_cover", true) : nothing}${c.stop ? button("cover_stop", "stop_cover") : nothing}${c.close ? button("cover_close", "close_cover", true) : nothing}
      </div>
      ${c.position ? slider("position", a.current_position as number, "set_cover_position", "position") : nothing}
      ${c.tiltOpen || c.tiltStop || c.tiltClose
        ? html`<div class="fp3d-rp-buttons fp3d-rp-wide">
            ${c.tiltOpen ? button("cover_tilt_open", "open_cover_tilt") : nothing}${c.tiltStop ? button("cover_stop", "stop_cover_tilt") : nothing}${c.tiltClose ? button("cover_tilt_close", "close_cover_tilt") : nothing}
          </div>`
        : nothing}
      ${c.tiltPosition ? slider("cover_tilt", slatTilt(st, inv) ?? 0, "set_cover_tilt_position", "tilt_position", (v) => (inv ? 100 - v : v)) : nothing}
    </div>`;
  }

  private climateRow(st: HassEntity) {
    const a = st.attributes;
    const id = st.entity_id;
    const target = typeof a.temperature === "number" ? a.temperature : null;
    const step = (a.target_temp_step as number | undefined) ?? 0.5;
    const min = (a.min_temp as number | undefined) ?? 5;
    const max = (a.max_temp as number | undefined) ?? 30;
    const modes = (a.hvac_modes as string[] | undefined) ?? [];
    const set = (v: number) => this.call("climate", "set_temperature", { entity_id: id, temperature: Math.min(max, Math.max(min, Math.round(v / step) * step)) });
    return html`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon ${a.hvac_action === "heating" ? "fp3d-rp-on" : ""}">${icon("climate")}</span>
      ${this.nameButton(id)}
      <span class="fp3d-rp-state">${this.stateOf(st)}</span>
      ${target !== null
        ? html`<div class="fp3d-rp-stepper fp3d-rp-wide">
            <button class="fp3d-btn" aria-label=${this.t("temp_down")} @click=${() => set(target - step)}>−</button>
            <span><small>${this.t("target_temp")}</small> ${formatNumber(this.hass, target, 1)} ${tempUnit(this.hass)}</span>
            <button class="fp3d-btn" aria-label=${this.t("temp_up")} @click=${() => set(target + step)}>+</button>
          </div>`
        : nothing}
      ${modes.length > 1
        ? html`<div class="fp3d-rp-chips">
            ${modes.map(
              (m) => html`<button
                class="fp3d-chip"
                aria-pressed=${st.state === m}
                @click=${() => this.call("climate", "set_hvac_mode", { entity_id: id, hvac_mode: m })}
              >
                ${this.stateLabel(m)}
              </button>`,
            )}
          </div>`
        : nothing}
    </div>`;
  }

  /**
   * The state text of a row: left out when the room says so (D154) or when a device that is not a
   * sensor only reports "unknown" (covers without position feedback).
   */
  private stateOf(st: HassEntity, text = stateText(this.hass, st)): string {
    if (this.room?.no_state?.includes(st.entity_id)) return "";
    const kind = kindOf(st.entity_id);
    if (st.state === "unknown" && kind !== "sensor" && kind !== "binary") return "";
    return text;
  }

  private stateLabel(state: string): string {
    const key = `state_${state}` as I18nKey;
    const s = this.t(key);
    return s === key ? state : s;
  }

  private mediaRow(st: HassEntity) {
    const a = st.attributes;
    const id = st.entity_id;
    const na = isUnavailable(st) || st.state === "off";
    const title = [a.media_title, a.media_artist].filter((x) => typeof x === "string" && x).join(" · ");
    return html`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon ${st.state === "playing" ? "fp3d-rp-on" : ""}">${icon("media")}</span>
      ${this.nameButton(id)}
      <span class="fp3d-rp-state">${this.stateOf(st, this.stateLabel(st.state))}</span>
      ${title ? html`<p class="fp3d-rp-media fp3d-rp-wide">${title}</p>` : nothing}
      <div class="fp3d-rp-buttons fp3d-rp-wide">
        <button class="fp3d-btn fp3d-rp-small" aria-label=${this.t("previous")} ?disabled=${na} @click=${() => this.call("media_player", "media_previous_track", { entity_id: id })}>
          ${transport(TRANSPORT.previous)}
        </button>
        <button class="fp3d-btn fp3d-rp-small" aria-label=${this.t("play_pause")} ?disabled=${isUnavailable(st)} @click=${() => this.call("media_player", st.state === "playing" ? "media_pause" : "media_play", { entity_id: id })}>
          ${transport(st.state === "playing" ? TRANSPORT.pause : TRANSPORT.play)}
        </button>
        <button class="fp3d-btn fp3d-rp-small" aria-label=${this.t("next")} ?disabled=${na} @click=${() => this.call("media_player", "media_next_track", { entity_id: id })}>
          ${transport(TRANSPORT.next)}
        </button>
      </div>
      ${typeof a.volume_level === "number"
        ? html`<label class="fp3d-rp-slider"
            ><span>${this.t("volume")}</span>
            <input
              type="range"
              min="0"
              max="100"
              .value=${String(Math.round(a.volume_level * 100))}
              @change=${(e: Event) => this.call("media_player", "volume_set", { entity_id: id, volume_level: Number((e.target as HTMLInputElement).value) / 100 })}
          /></label>`
        : nothing}
    </div>`;
  }

  private switchRow(st: HassEntity) {
    const id = st.entity_id;
    const kind = kindOf(id)!;
    const domain = id.slice(0, id.indexOf("."));
    const on = kind === "lock" ? st.state === "unlocked" || st.state === "open" : st.state === "on";
    const act = () => (kind === "lock" ? this.call("lock", on ? "lock" : "unlock", { entity_id: id }) : this.call(domain, "toggle", { entity_id: id }));
    return html`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon ${on ? "fp3d-rp-on" : ""}">${icon(kind)}</span>
      ${this.nameButton(id)}
      <span class="fp3d-rp-state">${this.stateOf(st)}</span>
      ${this.toggle(st, on, act)}
    </div>`;
  }

  /** Camera snapshot (refreshed while the panel is open); a tap opens the live view of Home Assistant. */
  private cameraTile(st: HassEntity) {
    const picture = st.attributes.entity_picture as string | undefined;
    // a changing query parameter makes the browser fetch a fresh snapshot (not for inline pictures)
    const src = picture && !isUnavailable(st) ? (picture.startsWith("data:") ? picture : `${picture}${picture.includes("?") ? "&" : "?"}fp3d=${this._tick}`) : null;
    const placed = this.floor?.placements.some((p) => p.entity_id === st.entity_id);
    const shot = html`${src ? html`<img src=${src} alt=${this.name(st.entity_id)} loading="lazy" />` : html`<span class="fp3d-rp-note">${stateText(this.hass, st)}</span>`}
      <span class="fp3d-rp-camera-name">${this.name(st.entity_id)}</span>`;
    // time travel: there is no live view or camera to go to, so the picture is no button and "look through" is gone (#210)
    return html`<div class="fp3d-rp-camera-wrap">
      ${this.readOnly
        ? html`<div class="fp3d-rp-camera fp3d-rp-camera-still">${shot}</div>`
        : html`<button class="fp3d-rp-camera" title=${this.t("camera_live")} @click=${() => openMoreInfo(this, st.entity_id)}>${shot}</button>`}
      ${placed && !this.noLook && !this.readOnly
        ? html`<button
            class="fp3d-rp-look"
            title=${this.t("through_camera")}
            @click=${() => this.dispatchEvent(new CustomEvent("camera-look", { detail: { entity: st.entity_id }, bubbles: true, composed: true }))}
          >
            ${this.t("through_camera")}
          </button>`
        : nothing}
    </div>`;
  }

  private sensorRow(st: HassEntity) {
    const kind = kindOf(st.entity_id)!;
    const warn = kind === "binary" && st.state === "on";
    return html`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon ${warn ? "fp3d-rp-on" : ""}">${icon(kind)}</span>
      ${this.nameButton(st.entity_id)}
      <span class="fp3d-rp-state">${this.stateOf(st)}</span>
    </div>`;
  }

  /**
   * "Edit room" and "Edit floor" (#249, editors): the editor opens on this floor with the room chosen, or at the floor's
   * settings. Not while travelling in time or on a wall tablet (the panel hands canEdit false there).
   */
  private fire(type: string): void {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }));
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        display: block;
      }
      /* a size set by dragging an edge (#267): the card fills the host's height */
      :host([sized]) .fp3d-rp {
        height: 100%;
      }
      .fp3d-rz {
        position: absolute;
        z-index: 2;
        touch-action: none;
      }
      .fp3d-rz-w {
        left: 0;
        top: 18px;
        bottom: 18px;
        width: 8px;
        cursor: ew-resize;
      }
      .fp3d-rz-s {
        left: 18px;
        right: 18px;
        bottom: 0;
        height: 8px;
        cursor: ns-resize;
      }
      .fp3d-rz-sw {
        left: 0;
        bottom: 0;
        width: 18px;
        height: 18px;
        cursor: nesw-resize;
      }
      .fp3d-rz:hover,
      .fp3d-rz:focus-visible {
        background: var(--fp3d-accent);
        opacity: 0.45;
      }
      /* the sheet's grab bar (#353): phones and portrait tablets only */
      .fp3d-rp-grab {
        display: none;
      }
      /* a sheet (phones, portrait tablets) has no edges to drag: its grab bar sets its height (#353) */
      @container fp3d ((max-width: 700px) or ((orientation: portrait) and (max-width: 1000px))) {
        /* tells the size controllers this is a sheet (float-panel.ts isSheet) */
        :host {
          --fp3d-sheet: 1;
        }
        .fp3d-rz {
          display: none;
        }
        .fp3d-rp-grab {
          display: flex;
          justify-content: center;
          align-items: center;
          flex: none;
          height: 22px;
          cursor: ns-resize;
          touch-action: none;
        }
        .fp3d-rp-grab span {
          width: 40px;
          height: 5px;
          border-radius: 3px;
          background: var(--fp3d-muted);
          opacity: 0.6;
        }
        .fp3d-rp-grab:focus-visible {
          outline: 2px solid var(--fp3d-accent);
          outline-offset: -2px;
        }
        .fp3d-rp-head {
          touch-action: none;
        }
      }
      .fp3d-rp {
        position: relative;
        /* the host may be pointer-events: none so the 3D view stays usable around the panel */
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        max-height: 100%;
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 18px;
        box-shadow: var(--fp3d-shadow);
        overflow: hidden;
      }
      /* time travel: the controls are in a disabled fieldset, greyed out, with a tooltip (#210) */
      .fp3d-rp-controls {
        display: contents;
        border: 0;
        margin: 0;
        padding: 0;
        min-width: 0;
      }
      .fp3d-rp-ro .fp3d-rp-body :is(button, input, select):disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .fp3d-rp-camera-still {
        cursor: default;
      }
      .fp3d-rp-ro-note {
        color: #ffb020;
      }
      .fp3d-rp-head {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 14px 14px 10px 16px;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .fp3d-rp-head > div {
        flex: 1;
        min-width: 0;
      }
      .fp3d-rp-sheets {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .fp3d-rp-sheet {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 32px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid var(--fp3d-line);
        background: color-mix(in srgb, var(--fp3d-accent, #37e0ff) 12%, transparent);
        color: inherit;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      .fp3d-rp-sheet:hover {
        border-color: var(--fp3d-accent, #37e0ff);
      }
      h2:focus:not(:focus-visible) {
        outline: none;
      }
      h2 {
        margin: 0;
        font: 700 21px var(--fp3d-title-font);
        letter-spacing: -0.01em;
      }
      .fp3d-rp-facts {
        margin: 2px 0 0;
        color: var(--fp3d-muted);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      }
      .fp3d-rp-close {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.06);
        color: var(--fp3d-text);
        cursor: pointer;
      }
      .fp3d-rp-body {
        overflow-y: auto;
        padding: 6px 14px 16px 16px;
        display: grid;
        gap: 14px;
        overscroll-behavior: contain;
      }
      .fp3d-rp-note {
        color: var(--fp3d-muted);
        font-size: 13px;
        margin: 8px 0 0;
      }
      .fp3d-rp-sec-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 6px;
      }
      h3 {
        margin: 0;
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .fp3d-rp-row {
        display: grid;
        grid-template-columns: 28px 1fr auto auto;
        align-items: center;
        gap: 6px 10px;
        padding: 9px 0;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .fp3d-rp-row:last-child {
        border-bottom: none;
      }
      .fp3d-rp-row > :nth-child(n + 5),
      .fp3d-rp-row > .fp3d-rp-wide {
        grid-column: 2 / -1;
      }
      .fp3d-rp-icon {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        color: var(--fp3d-muted);
        background: rgba(91, 124, 255, 0.12);
      }
      .fp3d-rp-on {
        color: #2a1a00;
        background: var(--fp3d-warm);
        box-shadow: 0 0 14px rgba(255, 181, 71, 0.55);
      }
      .fp3d-rp-name {
        font: inherit;
        font-weight: 500;
        color: var(--fp3d-text);
        background: none;
        border: none;
        padding: 0;
        text-align: left;
        cursor: pointer;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .fp3d-rp-state {
        font-size: 12.5px;
        color: var(--fp3d-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        max-width: 110px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp3d-rp-row > .fp3d-rp-state:last-child {
        grid-column: 3 / -1;
        justify-self: end;
      }
      .fp3d-switch {
        position: relative;
        width: 44px;
        height: 26px;
        border-radius: 999px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        cursor: pointer;
      }
      .fp3d-switch::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #e6eefc;
        transition: transform 0.2s ease;
      }
      .fp3d-switch[aria-checked="true"] {
        background: var(--fp3d-warm);
      }
      .fp3d-switch[aria-checked="true"]::after {
        transform: translateX(18px);
      }
      .fp3d-switch:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .fp3d-rp-slider {
        display: grid;
        grid-template-columns: 110px 1fr;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .fp3d-rp-slider input {
        width: 100%;
        accent-color: var(--fp3d-accent);
      }
      .fp3d-rp-ct input {
        accent-color: var(--fp3d-warm);
      }
      .fp3d-rp-swatches,
      .fp3d-rp-buttons,
      .fp3d-rp-chips,
      .fp3d-rp-scenes {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .fp3d-rp-swatch {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: var(--c);
        box-shadow: 0 0 10px var(--c);
        cursor: pointer;
      }
      .fp3d-rp-camera {
        position: relative;
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        margin: 6px 0;
        padding: 0;
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
        overflow: hidden;
        background: #05080f;
        cursor: pointer;
      }
      .fp3d-rp-camera img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .fp3d-rp-camera-wrap {
        position: relative;
      }
      .fp3d-rp-look {
        position: absolute;
        right: 8px;
        bottom: 12px;
        padding: 4px 10px;
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        background: rgba(7, 11, 20, 0.8);
        color: var(--fp3d-accent);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .fp3d-rp-camera-name {
        position: absolute;
        left: 8px;
        bottom: 6px;
        padding: 2px 8px;
        border-radius: 8px;
        background: rgba(7, 11, 20, 0.75);
        color: var(--fp3d-text);
        font-size: 12px;
        font-weight: 600;
      }
      .fp3d-rp-more {
        justify-self: start;
      }
      .fp3d-rp-small {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 5px 10px;
        min-height: 30px;
        font-size: 13px;
      }
      .fp3d-rp-stepper {
        display: flex;
        align-items: center;
        gap: 10px;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
      .fp3d-rp-stepper small {
        color: var(--fp3d-muted);
        font-weight: 500;
        margin-right: 4px;
      }
      .fp3d-rp-stepper .fp3d-btn {
        width: 36px;
        padding: 4px 0;
        font-size: 17px;
      }
      .fp3d-rp-chips .fp3d-chip {
        box-shadow: none;
        border: 1px solid var(--fp3d-line);
        min-height: 30px;
        padding: 4px 11px;
        font-size: 13px;
      }
      .fp3d-rp-media {
        margin: 0;
        font-size: 12.5px;
        color: var(--fp3d-muted);
      }
      button:focus-visible,
      input:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 2px;
      }
      /* last, so it wins over the sizes above (#181) */
      @media (pointer: coarse) {
        .fp3d-rp-close,
        .fp3d-rp-icon,
        .fp3d-rp-swatch {
          width: 44px;
          height: 44px;
        }
        .fp3d-rp-stepper .fp3d-btn {
          width: 44px;
        }
        /* the 44 px icon gets a column as wide, so it keeps clear of the name (#260, V07) */
        .fp3d-rp-row {
          grid-template-columns: 44px 1fr auto auto;
        }
        .fp3d-rp-small,
        .fp3d-rp-sheet,
        .fp3d-rp-chips .fp3d-chip {
          min-height: 44px;
        }
      }
    `,
  ];
}

defineElement("fp3d-room-panel", Fp3dRoomPanel);
