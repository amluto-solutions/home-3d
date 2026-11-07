// Lovelace card (loaded automatically by the integration, no resource needed).

import { defineElement } from "./define.ts";
import { zonesOf, type Building } from "./model.ts";
import { confirmEntities } from "./devices.ts";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { uiIcon } from "./ui-icons.ts";
import { BuildingController, type PlanChange } from "./building-controller.ts";
import { loadView, readyView } from "./load-view.ts";
import { loadColourField, loadRoomPanel } from "./load-parts.ts";
import { need } from "./lazy-part.ts";
import { languageReady, loadLanguage, translate, uiLanguage, type I18nKey } from "./i18n.ts";
import { controls, tokens } from "./styles.ts";
import type { HomeAssistant } from "./types.ts";
import { showsPlan2d, type CardConfig, type CardControl } from "./card-config.ts";
import { fitBar, type BarItem } from "./card-fit.ts";
import { preload3d } from "./load3d.ts";
import { nightActive } from "./kiosk.ts";
import { lookOf } from "./themes.ts";
import { contrastChrome, lightChrome } from "./scheme.ts";
import { accentVars, shownAccent, shownLook } from "./ha-theme.ts";
import { loadCardEditor } from "./load-card-editor.ts";
import type { WallMode } from "./viewer/viewer3d.ts";
import { TimeTravel } from "./load-timetravel.ts";
import { withDemo } from "./demo.ts";
import { forwardHass, HASS_CHILDREN, HassWatch } from "./hass-watch.ts";
import type { HistorySpec } from "./timetravel/types.ts";

type HeatMode = NonNullable<CardConfig["heatmap"]>;

function savedWalls(): WallMode | null {
  try {
    const v = localStorage.getItem("home3d.card_walls");
    return v === "auto" || v === "cut" ? v : null;
  } catch {
    return null;
  }
}

export class Floorplan3dCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _roomId: { state: true },
    _shutRoom: { state: true },
    _floorId: { state: true },
    _walls: { state: true },
    _heat: { state: true },
    _explode: { state: true },
    _plan2d: { state: true },
    _fullscreen: { state: true },
    _pseudoFull: { state: true },
    _vh: { state: true },
    _top: { state: true },
    _cameraWall: { state: true },
    _clean: { state: true },
    _night: { state: true },
    _orbit: { state: true },
    _barW: { state: true },
    _barMenu: { state: true },
  };

  /** Home Assistant as handed in; `hass` reads it through `hassWatch` while rendering (#177, as the editor #130).
   * Elements the render draws get the plain object. */
  private rawHass: HomeAssistant | undefined;
  private readonly hassWatch = new HassWatch({ entityLists: false });
  /** The hass the last render handed the 3D view and the room panel (the demo home's states over the live ones). */
  private shownHass: HomeAssistant | undefined;

  get hass(): HomeAssistant {
    const h = this.rawHass;
    return (h && this.hassWatch.recording ? this.hassWatch.wrap(h) : h) as HomeAssistant;
  }

  set hass(value: HomeAssistant) {
    this.rawHass = value;
  }
  private declare _config: CardConfig;
  private declare _roomId: string | null;
  /** The room whose panel was closed with its X (#354): the room stays selected and in view, only the panel goes. */
  private declare _shutRoom: string | null;
  /** The configured start room was applied once the building arrived. */
  private roomApplied = false;
  /** Floor chosen in the card (null: the house; undefined: none chosen, the configured floor applies). */
  private declare _floorId: string | null | undefined;
  /** Choices made with the card's own switches (null: as configured). */
  private declare _walls: WallMode | null;
  private declare _heat: HeatMode | null;
  private declare _explode: boolean | null;
  /** The card's 2D/3D switch (#41; null: as configured). */
  private declare _plan2d: boolean | null;
  private declare _fullscreen: boolean;
  /** Full screen made by the card itself (no Fullscreen API): spread over the page. */
  private declare _pseudoFull: boolean;
  /** The visible screen height and the card's distance from the page top (measured, #344). */
  private declare _vh: number;
  private declare _top: number | null;
  private declare _cameraWall: boolean;
  /** Clean view: only the stage (card option controls_hidden, the eye, or the hide-after timer). */
  private declare _clean: boolean;
  private cleanTimer: ReturnType<typeof setTimeout> | undefined;
  /** Kiosk: the night dimming is active; the screensaver turn runs (after an idle return). */
  private declare _night: boolean;
  private declare _orbit: boolean;
  /** The card's width (px, measured): what fits in the bar of switches (#263); 0 until measured. */
  private declare _barW: number;
  /** The bar's ⋯ menu is open. */
  private declare _barMenu: boolean;
  private barSizer: ResizeObserver | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private nightTimer: ReturnType<typeof setInterval> | undefined;

  private readonly data = new BuildingController(this);
  /** Time travel (Pro, card option time_travel): the last 24 hours replayed, read-only. */
  private readonly tt = new TimeTravel(this);

  constructor() {
    super();
    this._roomId = null;
    this._shutRoom = null;
    this._floorId = undefined;
    this._walls = savedWalls();
    this._heat = null;
    this._explode = null;
    this._plan2d = null;
    this._fullscreen = false;
    this._pseudoFull = false;
    this._vh = window.innerHeight;
    this._top = null;
    this._cameraWall = false;
    this._clean = false;
    this._night = false;
    this._orbit = false;
    this._barW = 0;
    this._barMenu = false;
  }

  /** Any touch ends the screensaver and restarts the idle clock. */
  private readonly touch = () => {
    if (this._orbit) this._orbit = false;
    this.armIdle();
    this.armClean(true);
  };

  /** controls_hide_after: the bars come back on a touch and go again after the quiet spell. */
  private armClean(touched = false): void {
    clearTimeout(this.cleanTimer);
    const s = this._config?.controls_hide_after ?? 0;
    if (!(s > 0)) return;
    if (touched && this._clean) this._clean = false;
    this.cleanTimer = setTimeout(() => (this._clean = true), s * 1000);
  }

  private armIdle(): void {
    clearTimeout(this.idleTimer);
    const s = this._config?.idle_return ?? 0;
    if (s > 0) this.idleTimer = setTimeout(() => this.returnHome(), s * 1000);
  }

  private view3d() {
    return readyView(this.shadowRoot) as (HTMLElement & { resetView(): void; lookThrough(entityId: string): void; historyEntities(): HistorySpec; roomSheets(roomId: string): { id: string; icon: string; title: string }[]; openRoomSheet(roomId: string, id: string): void }) | null;
  }

  /** Time travel on or off; without the Pro add-on its hint shows. */
  private toggleTimeTravel(): void {
    if (this.tt.active) {
      this.tt.stop();
      return;
    }
    const view = this.view3d();
    const b = this.data.building;
    if (!view || !b || !this.hass) return;
    this._cameraWall = false;
    const c = this._config;
    this.tt.start({ live: this.hass, building: b, spec: view.historyEntities(), quality: c?.quality ?? "auto", speed: c?.time_travel_speed ?? null, range: c?.time_travel_range ?? null, t: (k, vars) => translate(this.hass, k as I18nKey, vars) });
  }

  /** Esc leaves the time travel; any key counts as a touch. */
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.tt.stop();
    this.touch();
  };

  /** Back to the start view (room closed, start floor, camera reset); the screensaver may start. */
  private returnHome(): void {
    // a replay that plays on its own (a wall tablet showing the day) is not left alone; paused, it ends
    if (this.tt.session?.playing) {
      this.armIdle();
      return;
    }
    this.tt.stop();
    this._roomId = this._config?.room ?? null;
    this._floorId = undefined;
    this._plan2d = null;
    this.view3d()?.resetView();
    if (this._config?.idle_orbit) this._orbit = true;
  }

  /** Opens another dashboard or view the way Home Assistant's own links do (no page reload). */
  private openDashboard(path: string): void {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true, detail: { replace: false } }));
  }

  private readonly onFullscreen = () => {
    this._fullscreen = !!document.fullscreenElement && this.shadowRoot?.contains(document.fullscreenElement) === true;
    requestAnimationFrame(this.onViewport);
  };

  /**
   * Full screen and "fill the screen" follow the screen that is really visible: 100vh misses on some Android
   * tablets (the HA app in landscape), and the dashboard header may be hidden (kiosk mode) – a black bar stayed (#344).
   */
  private readonly onViewport = () => {
    const vh = Math.round(window.visualViewport?.height ?? window.innerHeight);
    if (Math.abs(vh - this._vh) > 1) this._vh = vh;
    if (this._config?.fill && !this._fullscreen) {
      const top = Math.round(this.getBoundingClientRect().top + window.scrollY);
      if (this._top === null || Math.abs(top - this._top) > 1) this._top = top;
    }
  };

  private viewportTimer?: ReturnType<typeof setTimeout>;

  connectedCallback(): void {
    super.connectedCallback();
    // the 3D view's code is a chunk of its own (#179); what the card asks of it waits until it is there. The 3D bundle
    // it starts is fetched alongside (run 6 speed)
    if (this._config && !showsPlan2d(this._config, this._plan2d)) preload3d();
    void loadView().then(
      () => this.requestUpdate(),
      (err: unknown) => console.error("Home 3D: the 3D view failed to load", err),
    );
    document.addEventListener("fullscreenchange", this.onFullscreen);
    window.addEventListener("resize", this.onViewport);
    window.visualViewport?.addEventListener("resize", this.onViewport);
    requestAnimationFrame(this.onViewport);
    // the dashboard may still be laying out: measure once more a moment later
    this.viewportTimer = setTimeout(this.onViewport, 600);
    this.armIdle();
    this.armClean();
    // a time range for the night needs a look at the clock now and then
    this.nightTimer = setInterval(() => (this._night = nightActive(this._config?.night, this.hass)), 60000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("fullscreenchange", this.onFullscreen);
    window.removeEventListener("resize", this.onViewport);
    window.visualViewport?.removeEventListener("resize", this.onViewport);
    this.tt.stop();
    clearTimeout(this.viewportTimer);
clearTimeout(this.cleanTimer);
        clearTimeout(this.idleTimer);
    clearInterval(this.nightTimer);
    this.barSizer?.disconnect();
    this.barSizer = null;
  }

  /**
   * Full screen: the browser's where it has one; where it has none or refuses (the iPad, the Home Assistant app on
   * iOS, #633) the card spreads over the whole page itself and the button brings it back.
   */
  private toggleFullscreen(): void {
    if (this._pseudoFull) {
      this._pseudoFull = false;
      this._fullscreen = false;
      requestAnimationFrame(this.onViewport);
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const card = this.shadowRoot?.querySelector("ha-card") as (HTMLElement & { requestFullscreen?: () => Promise<void> }) | null;
    const spread = () => {
      this._pseudoFull = true;
      this._fullscreen = true;
      requestAnimationFrame(this.onViewport);
    };
    if (card?.requestFullscreen) card.requestFullscreen().catch(spread);
    else spread();
  }

  /** Visual editor in the dashboard (no YAML needed). */
  static async getConfigElement(): Promise<HTMLElement> {
    // its accent colour field (#403) is a chunk of the main bundle
    await Promise.all([loadCardEditor(), loadColourField()]);
    return document.createElement("home-3d-card-editor");
  }

  static getStubConfig(): CardConfig {
    return { type: "custom:home-3d-card" };
  }

  /** A wall view picked on the card stays for the next visit on this device (#309). */
  private setWalls(mode: WallMode): void {
    this._walls = mode;
    try {
      localStorage.setItem("home3d.card_walls", mode);
    } catch {
      // no storage: not remembered
    }
  }

  setConfig(config: CardConfig): void {
    if (config.height !== undefined && !(config.height > 100)) throw new Error("height must be a number of pixels above 100");
    // another home or start room (the dashboard editor): the room open in the old one closes, the new one opens (#150)
    if (this._config && ((this._config.home || undefined) !== (config.home || undefined) || this._config.room !== config.room)) {
      this._roomId = null;
      this.roomApplied = false;
    }
    this._config = config;
    // a home of its own (#53), else the active home
    this.data.setHome(config.home || undefined);
    this._floorId = undefined;
    this._walls = savedWalls();
    this._heat = null;
    this._explode = null;
    this._plan2d = null;
    this._orbit = false;
    this._night = nightActive(config.night, this.hass);
    this._clean = config.controls_hidden === true;
    this.armClean();
    this.armIdle();
  }

  getCardSize(): number {
    return Math.ceil((this._config?.height ?? 420) / 50);
  }

  getGridOptions() {
    return { columns: "full", rows: this._config?.fill ? 12 : Math.ceil((this._config?.height ?? 420) / 56), min_rows: 4 };
  }

  /**
   * A new `hass` for a state change of nothing the last render read needs no render (#177): the plan's loader still
   * gets it, and so do the elements the render hands it to (the 3D view and the room panel then decide for themselves).
   */
  protected shouldUpdate(changed: PropertyValues): boolean {
    const old = changed.get("hass") as HomeAssistant | undefined;
    const hass = this.rawHass;
    // while travelling in time the session follows the live states and may move the replay: every update renders
    if (changed.size !== 1 || !changed.has("hass") || !old || !hass || this.tt.active || this.hassWatch.matters(old, hass) || nightActive(this._config?.night, hass) !== this._night) return true;
    this.takeHass(hass);
    const shown = this.shownHass;
    const next = shown && this.viewHass(hass, this.data.building);
    forwardHass(this.renderRoot, HASS_CHILDREN["card.ts"], [
      [old, hass],
      [shown, next],
    ]);
    this.shownHass = next;
    return false;
  }

  /** A render notes which states it reads (see shouldUpdate). */
  protected update(changed: PropertyValues): void {
    this.hassWatch.begin();
    try {
      super.update(changed);
    } finally {
      this.hassWatch.end();
    }
  }

  /** What a new hass is handed to besides the render. */
  private takeHass(hass: HomeAssistant): void {
    this.data.setHass(hass);
    this.tt.session?.setLive(hass);
    const night = nightActive(this._config?.night, hass);
    if (night !== this._night) this._night = night;
  }

  /** The hass the 3D view gets: the replayed past while travelling in time, a demo home's states over the live ones. */
  private viewHass(hass: HomeAssistant, b: Building | null | undefined): HomeAssistant {
    return withDemo(this.tt.hass(hass), b);
  }

  protected willUpdate(changed: PropertyValues): void {
    // another room (or none): its panel opens again (#354)
    if (changed.has("_roomId") && this._shutRoom !== this._roomId) this._shutRoom = null;
    if (changed.has("hass") && this.rawHass) {
      this.takeHass(this.rawHass);
      // a language other than English: its texts are loaded first, then everything renders
      if (!languageReady(this.rawHass.language)) void loadLanguage(this.rawHass.language, this.rawHass).then(() => this.requestUpdate());
    }
    // a room that is not in the plan shown now (another home became active, or it was removed) closes (#150)
    const b = this.data.building;
    if (b !== this.seenBuilding) {
      this.seenBuilding = b;
      if (b && this._roomId && !b.floors.some((f) => zonesOf(f).some((r) => r.id === this._roomId))) this._roomId = null;
    }
  }

  /** The plan the open room was last checked against. */
  private seenBuilding: Building | null = null;

  protected updated(): void {
    // the card's chrome goes light with the Day look (#85)
    this.toggleAttribute("light", lightChrome(shownLook(lookOf(this._config?.theme), this.hass)));
    this.toggleAttribute("contrast", contrastChrome(shownLook(lookOf(this._config?.theme), this.hass)));
    // the language its texts are in (#196)
    const lang = uiLanguage(this.hass);
    if (this.getAttribute("lang") !== lang) this.setAttribute("lang", lang);
    // the card's width decides what fits in the bar of switches (#263)
    const body = this.renderRoot.querySelector(".fp3d-card-body");
    if (body && !this.barSizer && typeof ResizeObserver === "function") {
      this.barSizer = new ResizeObserver(([e]) => {
        const w = Math.round(e?.contentRect.width ?? 0);
        if (Math.abs(w - this._barW) > 1) this._barW = w;
      });
      this.barSizer.observe(body);
    }
  }

  /** A press outside the bar's ⋯ menu closes it (#263). */
  private readonly closeBarMenu = (e: Event) => {
    if (!this._barMenu) return;
    const path = e.composedPath() as Element[];
    if (!path.some((n) => n.classList?.contains("fp3d-card-menu") || n.classList?.contains("fp3d-card-more"))) this._barMenu = false;
  };

  /** One level up: room -> floor -> house. */
  /** Floors can be switched (no fixed floor, or floor pictures to switch with). */
  private get canSwitch(): boolean {
    return !this._config?.floor || this.thumbs;
  }

  private get thumbs(): boolean {
    return this._config?.floor_thumbs ?? !this._config?.floor;
  }

  /** One level up: room -> floor -> house. */
  /** The floor shown now: the one chosen, else the configured one; a single floor is always shown. */
  private currentFloor(): string | null {
    const b = this.data.building;
    const chosen = this._floorId === undefined ? (this._config?.floor ?? null) : this._floorId;
    return b && b.floors.length === 1 ? b.floors[0].id : b?.floors.some((f) => f.id === chosen) ? chosen : null;
  }

  /** A change from the 3D view's settings or a module (#149): saved by the controller, which makes it again on a newer
   * plan when someone else saved meanwhile. */
  private onPlanChange(e: CustomEvent<{ change: PlanChange }>): void {
    e.preventDefault();
    this.data.update(e.detail.change);
  }

  private back(): void {
    if (this._roomId) this._roomId = null;
    else if (this.canSwitch) this._floorId = null;
  }

  protected render() {
    if (this.hass && !languageReady(this.hass.language)) return nothing;
    const b = this.data.building;
    const height = this._config?.height ?? 420;
    const c = this._config;
    // the configured room opens once, when the building is there; the kiosk return brings it back
    if (!this.roomApplied && b && c?.room) {
      this.roomApplied = true;
      if (b.floors.some((f) => zonesOf(f).some((r) => r.id === c.room))) this._roomId = c.room;
    }
    // the configured floor is where the card starts; with floor pictures the user can switch
    const floorId = this.currentFloor();
    // the floor pictures have a house button of their own; a room with its panel has a close button
    const canGoBack =
      (!!this._roomId && c?.room_panel === false) || (!this.thumbs && this.canSwitch && !this._roomId && !!floorId && (b?.floors.length ?? 0) > 1);
    const shows = (x: CardControl) => c?.controls === true || (Array.isArray(c?.controls) && c.controls.includes(x));
    const heats = (["temperature", "humidity", "co2"] as const).filter((m) => shows(m));
    const walls = this._walls ?? c?.walls ?? "auto";
    const heat = this._heat ?? c?.heatmap ?? "none";
    const explode = this._explode ?? c?.explode ?? true;
    const flat = showsPlan2d(c, this._plan2d);
    // full screen, the screen below the dashboard header, or a fixed height
    // full screen takes the whole screen by CSS (a measured height went stale on some screens, #426); "fill"
    // reaches the bottom edge exactly: the card's 1 px border above and below is all that is left (#344)
    const size = this._fullscreen
      ? "100%"
      : c?.fill
        ? this._top !== null
          ? `${Math.max(240, this._vh - this._top - 2)}px`
          : "calc(100vh - var(--header-height, 56px) - 2px)"
        : `${height}px`;
    // the bar of switches at the bottom (the back button belongs to it)
    const bar = !!b && !this._clean && (canGoBack || ((!!c?.controls || !!c?.time_travel) && !(this._roomId && this._shutRoom !== this._roomId && c.room_panel !== false)));
    const tt = this.tt.active;
    // a sample / demo home: devices this Home Assistant lacks show fixed demo states (#100)
    const hass = this.viewHass(this.rawHass!, b);
    this.shownHass = hass;
    const eye = c?.controls_hidden !== undefined || (c?.controls_hide_after ?? 0) > 0;
    const t = (k: Parameters<typeof translate>[1]) => translate(this.hass, k);
    // the card's own accent, else (while the look follows the HA theme) the theme's primary colour (#38)
    const accent = shownAccent(lookOf(c?.theme), c?.accent, this.hass, (n) => getComputedStyle(this).getPropertyValue(n));
    return html`<ha-card class="${this._night ? "fp3d-night" : ""} ${this._pseudoFull ? "fp3d-pseudo-full" : ""}" style=${accentVars(accent)} @pointerdown=${(e: PointerEvent) => (this.closeBarMenu(e), this.touch())} @keydown=${this.onKey} @wheel=${this.touch}>
      <div class="fp3d-card-body ${tt ? "fp3d-tt" : ""}" style="height:${size}">
        ${b && b.floors.some((f) => f.rooms.length)
          ? html`<fp3d-view3d
              .hass=${hass}
              .canEdit=${this.data.canEdit}
              .home=${this.data.homeId}
              .replay=${this.tt.session?.replay ?? null}
              .building=${b}
              .packs=${this.data.packs}
              .plan2d=${flat}
              .floorId=${floorId}
              .roomId=${this._roomId}
              .wallMode=${walls}
              .explode=${explode}
              .keepRoof=${c?.roof_fade === false}
              .hideRoof=${c?.roof === false}
              .quality=${this._config?.quality ?? "auto"}
              ?showStats=${this._config?.stats ?? false}
              .markerMode=${this._config?.markers ?? "important"}
              .pinSize=${this._config?.marker_size ?? "normal"}
              .markerNames=${this._config?.marker_names === true}
              .central=${this._config?.central !== false}
              .walkable=${this._config?.walk !== false}
              .petsOn=${this._config?.pets !== false}
              .ghostOn=${this._config?.ghost !== false}
              .buttons=${this._config?.buttons?.map((b, i) => ({ id: `card_${i}`, ...b })) ?? null}
              .heatMode=${heat}
              .theme=${lookOf(this._config?.theme)}
              .clock=${this._config?.clock ?? null}
              .accent=${accent}
              .showEnergy=${this._config?.energy ?? true}
              .flows=${this._config?.flows ?? null}
              .holograms=${this._config?.holograms ?? null}
              .floorThumbs=${this.thumbs}
              .roomLabels=${c?.room_names !== false}
              .controlsRight=${c?.controls_side === "right"}
              .keepView=${c?.keep_view === true}
              .angleLock=${c?.angle_lock === true}
              .floorStack=${c?.floor_stack ?? "dim"}
              .panelOpen=${!!this._roomId && this._shutRoom !== this._roomId && c?.room_panel !== false}
              .alerts=${c?.alerts !== false}
              .householdCard=${c?.household_card !== false}
              .rackCards=${c?.rack_cards !== false}
              .alertJump=${!!c?.alert_jump}
              .director=${!!c?.director}
              .voice=${!!c?.voice}
              .screen=${c?.screen?.trim() || null}
              .scenes=${c?.scenes !== false}
              ?trail=${!!c?.motion_trail}
              .cameraWall=${this._cameraWall && !tt}
              @camera-wall-close=${() => (this._cameraWall = false)}
              @camera-wall-open=${() => (this._cameraWall = true)}
              .clean=${this._clean}
              .cleanButton=${eye}
              @clean-toggle=${() => {
                this._clean = !this._clean;
                if (!this._clean) this.armClean();
                else clearTimeout(this.cleanTimer);
              }}
              .weather=${c?.weather !== false}
              .weatherEntityId=${c?.weather_entity ?? null}
              .dimmed=${this._night}
              .autoOrbit=${this._orbit}
              .startView=${c?.start_view ?? null}
              style=${tt ? `--fp3d-bottom-inset: ${bar ? "calc(52px + var(--fp3d-tt-h))" : "var(--fp3d-tt-h)"}` : bar ? "--fp3d-bottom-inset: 52px" : ""}
              @room-tap=${(e: CustomEvent<{ floorId: string; roomId: string | null }>) => {
                // in the house view (or on another floor) a tap first opens the whole floor; the floor as it is now,
                // not as rendered: a jump switches the floor and opens the room 60 ms later, before a slow tablet
                // has drawn again (#784)
                if (this.canSwitch && (b?.floors.length ?? 0) > 1 && e.detail.floorId && this.currentFloor() !== e.detail.floorId) {
                  this._floorId = e.detail.floorId;
                  this._roomId = null;
                  return;
                }
                if (!e.detail.roomId) return;
                // the room whose panel was closed (#354): a tap opens its panel again
                if (e.detail.roomId === this._roomId && this._shutRoom === this._roomId) {
                  this._shutRoom = null;
                  return;
                }
                this._roomId = e.detail.roomId === this._roomId ? null : e.detail.roomId;
              }}
              @floor-tap=${(e: CustomEvent<{ floorId: string | null }>) => {
                this._floorId = e.detail.floorId;
                this._roomId = null;
              }}
              @back=${() => this.back()}
              @plan-change=${this.onPlanChange}
            ></fp3d-view3d>`
          : html`<p class="fp3d-card-msg">${this.data.error ?? (b ? translate(this.hass, "no_building") : translate(this.hass, "loading"))}</p>`}
        ${this._roomId && this._shutRoom !== this._roomId && b && this._config?.room_panel !== false
          ? (need(loadRoomPanel), html`<fp3d-room-panel
              @camera-look=${(e: CustomEvent<{ entity: string }>) => this.view3d()?.lookThrough(e.detail.entity)}
              class="fp3d-card-panel"
              .hass=${hass}
              ?readOnly=${tt}
              ?noLook=${flat}
              ?canEdit=${this.data.canEdit}
              @plan-change=${this.onPlanChange}
              .room=${b.floors.flatMap((f) => zonesOf(f)).find((r) => r.id === this._roomId) ?? null}
              .floor=${b.floors.find((f) => zonesOf(f).some((r) => r.id === this._roomId)) ?? null}
              .building=${b}
              .confirmEntities=${confirmEntities(this.hass, b.floors)}
              .sheets=${this._roomId ? (this.view3d()?.roomSheets(this._roomId) ?? null) : null}
              @sheet-open=${(e: CustomEvent<{ id: string }>) => this._roomId && this.view3d()?.openRoomSheet(this._roomId, e.detail.id)}
              @close=${() => (this._shutRoom = this._roomId)}
            ></fp3d-room-panel>`)
          : nothing}
        ${bar && b ? this.renderBar(b, canGoBack, flat, walls, explode, floorId, heats, heat, t) : nothing}
        ${this.tt.session ? html`<fp3d-time-bar .session=${this.tt.session}></fp3d-time-bar>` : nothing}
        ${c?.fullscreen_button && !this._clean && !(this._roomId && this._shutRoom !== this._roomId && c.room_panel !== false)
          ? html`<button class="fp3d-card-full" title=${t(this._fullscreen ? "fullscreen_exit" : "fullscreen")} aria-label=${t(this._fullscreen ? "fullscreen_exit" : "fullscreen")} @click=${() => this.toggleFullscreen()}>
              ${this._fullscreen ? "✕" : uiIcon("expand")}
            </button>`
          : nothing}
        ${c?.dashboard && !this._clean && !(this._roomId && this._shutRoom !== this._roomId && c.room_panel !== false)
          ? html`<button class="fp3d-card-full fp3d-card-dash ${c.fullscreen_button ? "fp3d-card-dash-2" : ""}" title=${c.dashboard_label || c.dashboard} aria-label=${c.dashboard_label || c.dashboard} @click=${() => this.openDashboard(c.dashboard!)}>
              ${c.dashboard_label ? html`<span>${c.dashboard_label}</span>` : "⌂"}
            </button>`
          : nothing}
      </div>
    </ha-card>`;
  }

  /**
   * The bar of switches. On a narrow card the controls that don't fit go into a ⋯ menu at its end (#263); Back stays.
   */
  private renderBar(
    b: Building,
    canGoBack: boolean,
    flat: boolean,
    walls: WallMode,
    explode: boolean,
    floorId: string | null,
    heats: readonly HeatMode[],
    heat: HeatMode,
    t: (k: I18nKey) => string,
  ) {
    const c = this._config;
    const tt = this.tt.active;
    const shows = (x: CardControl) => c?.controls === true || (Array.isArray(c?.controls) && c.controls.includes(x));
    const heatKey = (m: HeatMode) => (m === "none" ? "heat_off" : (`heat_short_${m}` as I18nKey));
    const items: (BarItem & { tpl: unknown })[] = [];
    if (canGoBack) items.push({ id: "back", keep: true, texts: [t("back")], tpl: html`<button class="fp3d-chip" @click=${() => this.back()}>${t("back")}</button>` });
    if (c?.time_travel)
      items.push({
        id: "tt",
        texts: ["⏪ " + t("tt_chip")],
        tpl: html`<button class="fp3d-chip fp3d-tt-chip" aria-pressed=${tt} title=${t("tt_hint")} @click=${() => this.toggleTimeTravel()}>⏪ ${t("tt_chip")}</button>`,
      });
    if (c?.camera_wall)
      items.push({
        id: "cameras",
        texts: [t("cameras_short")],
        tpl: html`<button class="fp3d-chip" aria-pressed=${this._cameraWall} title=${t("camera_wall_hint")} @click=${() => (this._cameraWall = !this._cameraWall)}>${t("cameras_short")}</button>`,
      });
    if (shows("view"))
      items.push({
        id: "view",
        texts: [t("view_3d"), t("view_2d")],
        tpl: html`<div class="fp3d-seg" role="group" aria-label=${t("plan_view")}>
          <button aria-pressed=${!flat} @click=${() => (this._plan2d = false)}>${t("view_3d")}</button>
          <button aria-pressed=${flat} @click=${() => (this._plan2d = true)}>${t("view_2d")}</button>
        </div>`,
      });
    if (shows("walls") && !flat)
      items.push({
        id: "walls",
        texts: [t("walls_auto"), t("walls_cut")],
        tpl: html`<div class="fp3d-seg">
          <button aria-pressed=${walls === "auto"} @click=${() => this.setWalls("auto")}>${t("walls_auto")}</button>
          <button aria-pressed=${walls === "cut"} @click=${() => this.setWalls("cut")}>${t("walls_cut")}</button>
        </div>`,
      });
    if (shows("floors") && !flat && b.floors.length > 1 && !floorId)
      items.push({
        id: "floors",
        texts: [t("floors_apart"), t("floors_stacked")],
        tpl: html`<div class="fp3d-seg">
          <button aria-pressed=${explode} @click=${() => (this._explode = true)}>${t("floors_apart")}</button>
          <button aria-pressed=${!explode} @click=${() => (this._explode = false)}>${t("floors_stacked")}</button>
        </div>`,
      });
    if (heats.length) {
      const modes = ["none", ...heats] as HeatMode[];
      items.push({
        id: "heat",
        texts: modes.map((m) => t(heatKey(m))),
        tpl: html`<div class="fp3d-seg" role="group" aria-label=${t("heatmap")}>
          ${modes.map((m) => html`<button aria-pressed=${heat === m} @click=${() => (this._heat = m)}>${t(heatKey(m))}</button>`)}
        </div>`,
      });
    }
    // the bar sits between 60 px on the left and 10 px on the right; before the card is measured everything shows
    const fit = this._barW ? fitBar(items, this._barW - 70) : { bar: items.map((i) => i.id), menu: [] };
    const tpl = (id: string) => items.find((i) => i.id === id)!.tpl;
    const open = this._barMenu && fit.menu.length > 0;
    return html`<div class="fp3d-card-controls">
      ${fit.bar.map(tpl)}
      ${fit.menu.length
        ? html`<button class="fp3d-chip fp3d-card-more" aria-haspopup="true" aria-expanded=${open ? "true" : "false"} title=${t("more")} aria-label=${t("more")} @click=${() => (this._barMenu = !this._barMenu)}>⋯</button>`
        : nothing}
      ${open ? html`<div class="fp3d-card-menu" role="group" aria-label=${t("more")} @keydown=${(e: KeyboardEvent) => e.key === "Escape" && (this._barMenu = false)}>${fit.menu.map(tpl)}</div>` : nothing}
    </div>`;
  }

  static styles = [
    tokens,
    controls,
    css`
      .fp3d-card-controls {
        position: absolute;
        left: 60px;
        right: 10px;
        bottom: 10px;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        pointer-events: none;
      }
      .fp3d-card-controls > * {
        pointer-events: auto;
      }
      /* the ⋯ menu of a narrow card (#263): the controls that did not fit, one under the other above the bar */
      .fp3d-card-more {
        min-width: 44px;
        font-size: 18px;
        line-height: 1;
      }
      .fp3d-card-menu {
        position: absolute;
        right: 0;
        bottom: calc(100% + 8px);
        display: grid;
        justify-items: end;
        gap: 8px;
        padding: 8px;
        border-radius: 14px;
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        box-shadow: var(--fp3d-shadow);
        max-width: calc(100% - 16px);
      }
      .fp3d-card-menu .fp3d-seg {
        box-shadow: none;
        flex-wrap: wrap;
      }
      /* time travel: its bar at the bottom, the switches and the room panel above it */
      .fp3d-tt > * {
        --fp3d-tt-h: 64px;
      }
      .fp3d-tt .fp3d-card-controls {
        bottom: calc(var(--fp3d-tt-h) + 2px);
      }
      .fp3d-tt .fp3d-card-panel {
        bottom: calc(var(--fp3d-tt-h) + 4px);
      }
      .fp3d-tt-chip[aria-pressed="true"] {
        background: #ffb020;
        color: #1a1200;
      }
      .fp3d-card-dash {
        width: auto;
        min-width: 38px;
        padding: 0 12px;
        font-size: 14px;
        font-weight: 600;
      }
      .fp3d-card-dash-2 {
        right: 56px;
      }
      /* the view's walk button steps aside for the card's own buttons at the top right */
      fp3d-view3d {
        --fp3d-walk-right: 104px;
      }
      .fp3d-card-full {
        position: absolute;
        right: 10px;
        top: 10px;
        width: 38px;
        height: 38px;
        border: 0;
        border-radius: 12px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        box-shadow: var(--fp3d-shadow);
        font-size: 18px;
        cursor: pointer;
      }
      /* full screen made by the card itself (iPad, the app on iOS): over the whole page */
      ha-card.fp3d-pseudo-full {
        position: fixed;
        inset: 0;
        z-index: 9999;
        height: 100vh !important;
        max-height: none !important;
        border-radius: 0;
      }
      @supports (height: 100dvh) {
        ha-card.fp3d-pseudo-full {
          height: 100dvh !important;
        }
      }
      ha-card {
        overflow: hidden;
        background: var(--fp3d-bg);
        height: 100%;
      }
      ha-card:fullscreen {
        display: flex;
        flex-direction: column;
        width: 100vw;
        height: 100vh;
        border-radius: 0;
        border: 0;
      }
      ha-card:fullscreen .fp3d-card-body {
        flex: 1 1 auto;
        min-height: 0;
      }
      /* night (kiosk): the whole card dimmed */
      ha-card.fp3d-night .fp3d-card-body {
        filter: brightness(0.55);
      }
      .fp3d-card-body {
        position: relative;
        display: flex;
        height: 100%;
        container-type: size;
        container-name: fp3d;
      }
      fp3d-view3d {
        flex: 1;
      }
      .fp3d-card-msg {
        margin: auto;
        color: var(--fp3d-muted);
        padding: 16px;
        text-align: center;
      }
      .fp3d-card-panel {
        position: absolute;
        top: 10px;
        right: 10px;
        bottom: 10px;
        width: min(340px, calc(100% - 20px));
        display: flex;
        flex-direction: column;
        pointer-events: none;
        /* over the view's passive overlays, the clock among them (#313) */
        z-index: 2;
      }
      /* phones and portrait tablets: the room panel becomes a sheet at the bottom */
      @container fp3d ((max-width: 700px) or ((orientation: portrait) and (max-width: 1000px))) {
        .fp3d-card-panel {
          top: auto;
          left: 8px;
          right: 8px;
          bottom: 8px;
          width: auto;
          /* dragged taller or shorter by its grab bar (#353) */
          height: var(--fp3d-sheet-h, 55%);
          justify-content: flex-end;
        }
        /* the time bar takes two rows here (#257) */
        .fp3d-tt > * {
          --fp3d-tt-h: calc(120px + env(safe-area-inset-bottom, 0px));
        }
        @media (pointer: coarse) {
          .fp3d-tt > * {
            --fp3d-tt-h: calc(138px + env(safe-area-inset-bottom, 0px));
          }
        }
      }
    `,
  ];
}

if (defineElement("home-3d-card", Floorplan3dCard)) {
  const w = window as Window & { customCards?: unknown[] };
  w.customCards = w.customCards ?? [];
  w.customCards.push({
    type: "home-3d-card",
    name: translate(undefined, "card_name"),
    description: translate(undefined, "card_description"),
    preview: false,
  });
}
