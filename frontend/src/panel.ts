// Sidebar page: 3D view and editor.

import { defineElement } from "./define.ts";
import { formatImperial, lengthUnit, parseLength, unitLabel } from "./units.ts";
import { css, html, LitElement, nothing, unsafeCSS, type PropertyValues, type TemplateResult } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { uiIcon, type UiIcon } from "./ui-icons.ts";
import { COMPACT_MAX_PX, PHONE_MEDIA } from "./phone.ts";
import { BuildingController, type PlanChange } from "./building-controller.ts";
import { loadEditor, loadExtensionsPage } from "./load-editor.ts";
import { loadSettings } from "./load-settings.ts";
import { extensionAnchor } from "./settings/extension-anchor.ts";
import { loadLocate } from "./load-locate.ts";
import { loadView, readyView } from "./load-view.ts";
import { preload3d } from "./load3d.ts";
import { loadFind, loadHomeSwitcher, loadRoomPanel, loadRoomsPicker, loadStylesDialog, loadViewPanel } from "./load-parts.ts";
import { need } from "./lazy-part.ts";
import { setTimeFormat } from "./time-format.ts";
import { formatDateTime, timeStyleOf } from "./time-text.ts";
import { formatNumber, languageReady, loadLanguage, setChosenLanguage, translate, uiLanguage, type I18nKey } from "./i18n.ts";
import type { Building, Floor, StartView } from "./model.ts";
import type { SearchItem } from "./search.ts";
import type { RoomGroup } from "./components/rooms-picker.ts";
import { controls, tokens } from "./styles.ts";
import type { HomeAssistant } from "./types.ts";
import type { MarkerMode } from "./components/view3d.ts";
import type { ViewContext } from "./settings/view-settings.ts";
import type { HeatMode } from "./heatmap.ts";
import { lookOf, type Look } from "./themes.ts";
import { contrastChrome, lightChrome } from "./scheme.ts";
import { accentVars, shownAccent, shownLook, shownStyle } from "./ha-theme.ts";
import type { CustomStyle } from "./looks.ts";
import type { StylePlan } from "./looks.ts";
import { keepInRoom, snapToWall } from "./geometry/snap.ts";
import { furnitureName } from "./furniture-names.ts";
import { confirmEntities, defaultHeight, entityName, kindOf } from "./devices.ts";
import { canLift, zonesOf, type LampMount } from "./model.ts";
import { mountBase } from "./packs.ts";
import { labOn } from "./features.ts";
import { mountLocateLab } from "./locate-lab.ts";
import { directorOnHere } from "./director.ts";
import { loadVoice, micProbeDone, screenName, voiceOnHere } from "./load-voice.ts";
import type { ClockPos } from "./card-config.ts";
import { clockLookOf, type ClockLook } from "./clock.ts";
import { TimeTravel } from "./load-timetravel.ts";
import { IdleClock, tabletIdleSeconds, tabletMode } from "./kiosk.ts";
import type { SunHeight } from "./sun-path.ts";
import type { HistorySpec } from "./timetravel/types.ts";
import type { FloorStack, Quality, WallMode } from "./viewer/viewer3d.ts";
import { UndoHistory } from "./undo-history.ts";
import { showsDemo, withDemo } from "./demo.ts";
import { forwardHass, HASS_CHILDREN, HassWatch } from "./hass-watch.ts";
import { loadSampleHome } from "./api.ts";
import { tell } from "./ask.ts";
import { announce, lookAnnouncement, viewChange, type ViewSpot } from "./announce.ts";
import { BackLayers, navFollowAddress, navHost, navPage } from "./back-stack.ts";
import { DISPLAY_HIDDEN_KEY, hiddenText, parseHidden, SHOW_FURNITURE_KEY, type ObjectType } from "./display-pref.ts";

type Mode = "view" | "editor" | "extensions" | "settings";

/** "#settings/<section>/<id>" (#139): the Settings page's own address; the page checks the names. */
function settingsAddress(hash: string): { section: string | null; id: string | null } | null {
  const m = /^#settings(?:\/([a-z0-9_]+))?(?:\/([^/?#]+))?\/?$/.exec(hash);
  return m ? { section: m[1] ?? null, id: m[2] ? decodeURIComponent(m[2]) : null } : null;
}

/** The panel's page an address hash names (#322): "" the 3D view, "#editor", "#extensions", "#settings/…"; null: none. */
export function pageOf(hash: string): string | null {
  if (hash === "" || hash === "#") return "";
  if (hash === "#editor" || hash === "#extensions") return hash;
  return settingsAddress(hash) ? hash : null;
}

/** The mode a page shows. */
function modeOf(page: string): Mode {
  return page === "#editor" ? "editor" : page === "#extensions" ? "extensions" : page.startsWith("#settings") ? "settings" : "view";
}

/** What counts as someone using a wall tablet: its idle return waits again (#92). */
/** Whether a sideways-scrolling row has more past its start and its end (1 px of rounding allowed) (#259). */
export const navEdges = (left: number, scrollWidth: number, clientWidth: number): { start: boolean; end: boolean } => ({
  start: left > 1,
  end: left + clientWidth < scrollWidth - 1,
});
/** How long (ms) a notice's buttons wait after it appears before a tap acts (#258). */
export const NOTICE_ARM_MS = 800;
/** Whether a tap at `now` came too soon after the notices appeared at `shownAt` to have been aimed at them (#258). */
export const noticeTapTooSoon = (shownAt: number, now: number): boolean => now - shownAt < NOTICE_ARM_MS;

const TOUCHES = ["pointerdown", "keydown", "wheel"] as const;

/** View preferences belong to the device (a wall tablet wants other settings than a desktop). */
const prefs = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(`home3d.${key}`);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(`home3d.${key}`, value);
    } catch {
      // storage unavailable (private mode): the choice just is not remembered
    }
  },
};

export class Floorplan3dPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    route: { attribute: false },
    panel: { attribute: false },
    _mode: { state: true },
    _viewOpen: { state: true },
    _stylesOpen: { state: true },
    _extFocus: { state: true },
    _editorReady: { state: true },
    _editorError: { state: true },
    _floorId: { state: true },
    _roomId: { state: true },
    _shutRoom: { state: true },
    _wallMode: { state: true },
    _explode: { state: true },
    _plan2d: { state: true },
    _keepRoof: { state: true },
    _quality: { state: true },
    _stats: { state: true },
    _markers: { state: true },
    _pinSize: { state: true },
    _heat: { state: true },
    _theme: { state: true },
    _clock: { state: true },
    _clockLook: { state: true },
    _furnish: { state: true },
    _selFurniture: { state: true },
    _selDevice: { state: true },
    _floorStack: { state: true },
    _roomNames: { state: true },
    _hidden: { state: true },
    _furnitureOn: { state: true },
    _pulse: { state: true },
    _controlsRight: { state: true },
    _keepView: { state: true },
    _floorPics: { state: true },
    _angleLock: { state: true },
    _windowSpill: { state: true },
    _sunHeight: { state: true },
    _clockWeather: { state: true },
    _navButtons: { state: true },
    _trail: { state: true },
    _cameraWall: { state: true },
    _clean: { state: true },
    _roomsOpen: { state: true },
    _findOpen: { state: true },
    _noticesHidden: { state: true },
    _accent: { state: true },
    _weather: { state: true },
    _flows: { state: true },
    _holos: { state: true },
    _doorPins: { state: true },
    _vacuumMaps: { state: true },
    _director: { state: true },
    _micProbe: { state: true },
    _voiceHere: { state: true },
    _screen: { state: true },
    _tablet: { state: true },
    _settingsReady: { state: true },
    _settingsError: { state: true },
    _settingsAt: { state: true },
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

  declare narrow: boolean;
  declare route: unknown;
  declare panel: unknown;
  private declare _mode: Mode;
  /** The View panel on the 3D view is open (#247): one panel for the look and what the 3D shows. */
  private declare _viewOpen: boolean;
  /** The styles dialog (#441) is open over the 3D view. */
  private declare _stylesOpen: boolean;
  /** The card of the Extensions tab to scroll to and light up (a Settings search hit, #302); null: none. */
  private declare _extFocus: string | null;
  /** The editor bundle is loaded (it is fetched the first time the editor opens). */
  private declare _editorReady: boolean;
  /** Why the editor bundle failed to load (shown on its tabs instead of "Loading …"; opening a tab again retries). */
  private declare _editorError: string | null;
  private declare _floorId: string | null;
  private declare _roomId: string | null;
  /** The room whose panel was closed with its X (#354): the room stays selected and in view, only the panel goes. */
  private declare _shutRoom: string | null;
  private declare _wallMode: WallMode;
  private declare _explode: boolean;
  /** The read-only 2D plan (#41) instead of the 3D view; remembered per browser, "?view=2d" in the address opens it. */
  private declare _plan2d: boolean;
  private declare _keepRoof: boolean;
  private declare _quality: Quality;
  /** Performance display (per device; also switched on by ?fp3d_stats in the URL). */
  private declare _stats: boolean;
  private declare _markers: MarkerMode;
  /** How large the device symbols are (this device). */
  private declare _pinSize: "small" | "normal" | "large";
  private declare _heat: HeatMode;
  private declare _theme: Look;
  private declare _clock: ClockPos;
  private declare _clockLook: ClockLook;
  private declare _furnish: boolean;
  private declare _selFurniture: string | null;
  private declare _selDevice: string | null;
  /** Floors below an opened floor, and whether room names show (both kept per device). */
  private declare _floorStack: FloorStack;
  private declare _roomNames: boolean;
  /** The kinds of objects this device hides (#268) and its Furniture switch (#269). */
  private declare _hidden: ReadonlySet<ObjectType>;
  private declare _furnitureOn: boolean;
  private declare _pulse: boolean;
  private declare _controlsRight: boolean;
  private declare _keepView: boolean;
  /** The floor pictures beside the 3D view (#250: a switch in Settings › Screen and controls, off by default). */
  private declare _floorPics: boolean;
  /** 3D lock on this device: the angle stays fixed. */
  private declare _angleLock: boolean;
  private declare _windowSpill: boolean;
  private declare _sunHeight: SunHeight;
  private declare _clockWeather: boolean;
  private declare _navButtons: boolean;
  /** Motion trail of the last half hour in 3D. */
  private declare _trail: boolean;
  private declare _cameraWall: boolean;
  /** Clean view (the eye): only the stage, remembered on this device. */
  private declare _clean: boolean;
  /** The Rooms picker on the floor bar is open (#249, option B of #219: one searchable list instead of a chip per room). */
  private declare _roomsOpen: boolean;
  /** The search beside the floor bar is open (#305). */
  private declare _findOpen: boolean;
  /** The notices (update, save failed …) the person put away (#249): their badge on the save line brings them back. */
  private declare _noticesHidden: string;
  /** Accent colour of the user's choice ("#rrggbb"), null for the stock cyan; remembered on this device. */
  private declare _accent: string | null;
  /** Weather outside the house in 3D. */
  private declare _weather: boolean;
  /** Power flow lines and hologram cards (#315): View panel switches, read from this device's preferences. */
  private declare _flows: boolean;
  private declare _holos: boolean;
  private declare _doorPins: boolean;
  /** Robot vacuum maps on the floors (#350), this device's View switch. */
  private declare _vacuumMaps: boolean;
  /** Kamera-Cockpit: the live director works on this device (its own switch, default off). */
  private declare _director: boolean;
  /** The microphone probe opened from the editor (the live director's section). */
  private declare _micProbe: boolean;
  /** Voice control (the microphone button) on this device. */
  private declare _voiceHere: boolean;
  private declare _screen: string;
  /**
   * Locked tablet mode (#92, wall displays): only the home name, the floors and the View menu; no Editor, no view
   * settings, and back to the whole house after a quiet spell. "?tablet" in the address or a tick for this HA user.
   */
  private declare _tablet: boolean;
  /** The Settings page's bundle is loaded (#139), or why it failed. */
  private declare _settingsReady: boolean;
  private declare _settingsError: string | null;
  /** The section and setting the Settings page opens at (a deep link, a "Settings" link elsewhere). */
  private declare _settingsAt: { section: string | null; id: string | null };
  /** The tab the Settings page was opened from: its "Back to …" link returns there (#248). */
  private settingsFrom: Mode = "view";
  /** The 3D view as it was when the view tab was left: the Settings page's "start view" takes it. */
  private lastView: StartView | null = null;

  private readonly data = new BuildingController(this);
  /** The editor's undo history (#66): kept here, as the editor element goes whenever another tab opens. */
  private readonly undoHistory = new UndoHistory();
  private locateLab: (() => void) | null = null;
  /** Time travel (Pro): the last 24 hours replayed, read-only. */
  private readonly tt = new TimeTravel(this);
  /** A ?tt= link was looked at (it starts the time travel once). */
  private ttLinked = false;
  /** The tablet's return to the whole house after no one touched it for a while (#92). */
  private readonly idle = new IdleClock(() => this.returnHome());
  private readonly onTouch = () => this.idle.touch();
  private idleSeconds = 0;
  private touchesHeard = false;


  constructor() {
    super();
    this.narrow = false;
    this._mode = "view";
    this._viewOpen = false;
    this._stylesOpen = false;
    this._extFocus = null;
    this._editorReady = !!customElements.get("fp3d-editor");
    this._editorError = null;
    this._floorId = null;
    this._roomId = null;
    this._shutRoom = null;
    this.readPrefs();
    this._furnish = false;
    this._selFurniture = null;
    this._selDevice = null;
    this._cameraWall = false;
    this._micProbe = false;
    this._tablet = false;
    this._roomsOpen = false;
    this._findOpen = false;
    this._noticesHidden = "";
    this._settingsReady = !!customElements.get("fp3d-settings-page");
    this._settingsError = null;
    const address = settingsAddress(location.hash);
    this._settingsAt = address ?? { section: null, id: null };
    // a deep link (#322): the page its address names opens, also after a reload
    this._mode = modeOf(pageOf(location.hash) ?? "");
  }

  /**
   * This device's view preferences (`home3d.<key>`), read when the panel starts and again after the Settings page
   * changed one or reset them (#139).
   */
  private readPrefs(): void {
    // the wall view stays as it was last set on this device (#309)
    this._wallMode = prefs.get("walls") === "cut" ? "cut" : "auto";
    this._explode = prefs.get("explode") !== "0";
    const asked = new URLSearchParams(location.search).get("view");
    this._plan2d = asked === "2d" || (asked !== "3d" && prefs.get("plan2d") === "1");
    this._keepRoof = prefs.get("roof") === "1";
    const quality = prefs.get("quality");
    this._quality = quality === "low" || quality === "high" ? quality : "auto";
    this._stats = prefs.get("stats") === "1" || new URLSearchParams(location.search).has("fp3d_stats");
    const markers = prefs.get("markers");
    this._markers = markers === "none" || markers === "all" || markers === "room" ? markers : "important";
    const pinSize = prefs.get("pinSize");
    this._pinSize = pinSize === "small" || pinSize === "large" ? pinSize : "normal";
    const heat = prefs.get("heat");
    this._heat = heat === "temperature" || heat === "humidity" || heat === "co2" || heat === "values" ? heat : "none";
    this._theme = lookOf(prefs.get("theme"));
    const clock = prefs.get("clock");
    this._clockLook = clockLookOf((k) => prefs.get(k));
    this._clock = clock === "tl" || clock === "tr" || clock === "bl" || clock === "br" ? clock : "off";
    const accent = prefs.get("accent");
    this._accent = accent && /^#[0-9a-f]{6}$/i.test(accent) ? accent : null;
    const stack = prefs.get("floor_stack");
    this._floorStack = stack === "stacked" || stack === "single" ? stack : "dim";
    const hidden = parseHidden(prefs.get(DISPLAY_HIDDEN_KEY), prefs.get("room_names"), prefs.get(SHOW_FURNITURE_KEY));
    // the very same set while nothing changed, so the 3D view does not look again
    if (!this._hidden || hiddenText(hidden) !== hiddenText(this._hidden)) this._hidden = hidden;
    this._roomNames = !this._hidden.has("room_names");
    // the Furniture switch is gone (#306): its old "off" is in the hidden kinds above, so every item is drawn here
    this._furnitureOn = true;
    this._pulse = prefs.get("pulse") !== "0";
    this._controlsRight = prefs.get("controls") === "right";
    this._keepView = prefs.get("keep_view") === "1";
    this._floorPics = prefs.get("floor_pictures") === "1";
    this._angleLock = prefs.get("angle_lock") === "1";
    this._windowSpill = prefs.get("window_spill") === "1";
    this._clockWeather = prefs.get("clock_weather") !== "0";
    const sunHeight = prefs.get("sun_height");
    this._sunHeight = sunHeight === "high" || sunHeight === "real" ? sunHeight : "auto";
    this._navButtons = prefs.get("nav") === "1";
    this._trail = prefs.get("trail") === "1";
    this._clean = prefs.get("clean") === "1";
    this._weather = prefs.get("weather") !== "0";
    this._flows = prefs.get("flows") === "1";
    this._holos = prefs.get("holos") !== "0";
    this._doorPins = prefs.get("door_pins") === "1";
    this._vacuumMaps = prefs.get("vacuum_maps") !== "0";
    this._director = directorOnHere();
    this._voiceHere = voiceOnHere();
    this._screen = screenName();
    // this device's own language (#292): its texts load now when it just changed
    setChosenLanguage(prefs.get("language"));
    setTimeFormat(prefs.get("time_format"));
    if (this.hass && !languageReady(this.hass.language)) void loadLanguage(this.hass.language, this.hass).then(() => this.requestUpdate());
  }

  private t(key: I18nKey, vars?: Record<string, string | number>): string {
    return translate(this.hass, key, vars);
  }

  /**
   * A new `hass` for a state change of nothing the last render read (most of the several updates a second on a wall
   * tablet) needs no render (#177): the plan's loader still gets it, and so do the elements the render hands it to (the
   * 3D view and the editor then decide for themselves).
   */
  protected shouldUpdate(changed: PropertyValues): boolean {
    const old = changed.get("hass") as HomeAssistant | undefined;
    const hass = this.rawHass;
    // while travelling in time the session follows the live states and may move the replay: every update renders
    if (changed.size !== 1 || !changed.has("hass") || !old || !hass || this.tt.active || this.hassWatch.matters(old, hass)) return true;
    this.takeHass(hass);
    const shown = this.shownHass;
    const next = shown && this.viewHass(hass, this.data.building);
    // a demo device that turned real (or went unavailable) changes the demo chip
    if (shown && next && showsDemo(shown) !== showsDemo(next)) return true;
    forwardHass(this.renderRoot, HASS_CHILDREN["panel.ts"], [
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
    if (!this.homeRestored) this.restoreHome();
    this.data.setHass(hass);
    this.tt.session?.setLive(hass);
  }

  /** The hass the 3D view gets: the replayed past while travelling in time, a demo home's states over the live ones. */
  private viewHass(hass: HomeAssistant, b: Building | null | undefined): HomeAssistant {
    return withDemo(this.tt.hass(hass), b);
  }

  protected willUpdate(changed: PropertyValues): void {
    // another room (or none): its panel opens again (#354)
    if (changed.has("_roomId") && this._shutRoom !== this._roomId) this._shutRoom = null;
    if (changed.has("hass") && this.rawHass) this.takeHass(this.rawHass);
    // a language other than English: its texts are loaded first, then everything renders
    if (changed.has("hass") && this.hass && !languageReady(this.hass.language)) void loadLanguage(this.hass.language, this.hass).then(() => this.requestUpdate());
    const b = this.data.building;
    this.followTablet(b);
    // someone not (or no longer) on the editors list has no home switcher to leave a remembered home with (#160)
    if (b && !this.data.canEdit && this.data.home !== undefined) this.openHome(undefined);
    if (b !== this.seenBuilding) this.dropStaleSelection(b);
  }

  /** The home this device remembers was looked up (once, when the panel first gets hass). */
  private homeRestored = false;

  /** Where this device keeps the home its user had open last (#160): per user, so another login starts on the active home. */
  private get homeKey(): string {
    return `home.${this.hass?.user?.id ?? ""}`;
  }

  /**
   * A reload opens the home this device and user had open last (#160), not the one on the displays: someone trying
   * things in a test home is not dropped back into the real house. A tablet shows the active home whatever was open.
   */
  private restoreHome(): void {
    this.homeRestored = true;
    const home = prefs.get(this.homeKey);
    if (!home || tabletMode(location.search, this.hass?.user?.id, undefined)) return;
    this.data.onHomeGone = () => prefs.set(this.homeKey, "");
    this.data.openRemembered(home);
  }

  /** Show a home in this view (the home switcher, the sample) and remember it on this device (#160); unset: the active home. */
  private openHome(home: string | undefined): void {
    prefs.set(this.homeKey, home ?? "");
    this.data.setHome(home);
  }

  /** The plan the selection was last checked against (a new one comes with every edit and every load). */
  private seenBuilding: Building | null = null;
  /** The home that plan belongs to. */
  private seenHome: string | null = null;

  /**
   * Nothing of the selection outlives its home (#150): another home starts with no floor, room, item or device chosen;
   * in the same home a floor, room or item that is gone is let go of (a single-floor home has no floor to miss).
   * Runs only when the plan object changes, not on every hass update.
   */
  private dropStaleSelection(b: Building | null): void {
    this.seenBuilding = b;
    if (!b) return;
    const home = this.data.homeId;
    if (this.seenHome !== null && home !== this.seenHome) {
      this._floorId = null;
      this._roomId = null;
      this._selFurniture = null;
      this._selDevice = null;
    }
    this.seenHome = home;
    if (this._floorId && !b.floors.some((f) => f.id === this._floorId)) {
      this._floorId = null;
      this._roomId = null;
    }
    if (this._roomId && !b.floors.some((f) => zonesOf(f).some((r) => r.id === this._roomId))) this._roomId = null;
    if (this._selFurniture && !b.floors.some((f) => f.furniture.some((m) => m.id === this._selFurniture))) this._selFurniture = null;
  }

  /** Tablet mode on or off as the address and this user's tick say; on, the view is all there is (#92). */
  private followTablet(b: Building | null): void {
    const search = location.search;
    const on = tabletMode(search, this.hass?.user?.id, b?.settings.tablet_users);
    if (on && this._mode !== "view") this.setMode("view", "replace");
    // a tablet shows the home on the displays (#160), also when this device remembered another one
    if (on && this.data.home !== undefined) this.data.setHome(undefined);
    if (on !== this._tablet) {
      this._tablet = on;
      this._viewOpen = false;
    }
    // armed again only when the spell changes: every hass update renders, and must not restart the wait
    const seconds = on ? tabletIdleSeconds(search, b?.settings.tablet_idle) : 0;
    if (seconds !== this.idleSeconds || on !== this.touchesHeard) {
      this.listenTouches(on);
      this.idleSeconds = seconds;
      this.idle.arm(seconds);
    }
  }

  /** Touches, keys and the wheel restart the tablet's wait; heard only while tablet mode is on. */
  private listenTouches(on: boolean): void {
    if (on === this.touchesHeard) return;
    this.touchesHeard = on;
    for (const type of TOUCHES) {
      if (on) window.addEventListener(type, this.onTouch, { capture: true, passive: true });
      else window.removeEventListener(type, this.onTouch, { capture: true });
    }
    if (!on) {
      this.idle.stop();
      this.idleSeconds = 0;
    }
  }

  /** The tablet after its quiet spell: the whole house again, menus shut, the camera at the start view (#92). */
  private returnHome(): void {
    this.tt.stop();
    this._roomId = null;
    this._floorId = null;
    this._viewOpen = false;
    this._cameraWall = false;
    this.view3d()?.resetView();
  }

  /** On the editors list (#7): sees the Editor and Extensions tabs. Everyone else views and controls devices. */
  private get canEdit(): boolean {
    return this.data.canEdit;
  }

  /** First run (#54): add the sample home as a home of its own and open it here; the displays keep their home (#58). */
  private async loadSample(): Promise<void> {
    try {
      const res = await loadSampleHome(this.hass);
      this.openHome(res.home.id);
    } catch (err) {
      await tell(this.t("home_failed", { error: String((err as { message?: string })?.message ?? err) }), { ok: this.t("ask_ok") });
    }
  }

  /** Another page; `how` the history follows (#322): a new entry, this one rewritten, or none (Back and Forward). */
  private setMode(mode: Mode, how: "push" | "replace" | "none" = "push"): void {
    if (mode === this._mode || (this._tablet && mode !== "view")) return;
    // the view as it stands is what the Settings page's "start view" takes (#139)
    if (this._mode === "view") this.lastView = this.view3d()?.currentView() ?? this.lastView;
    this.tt.stop();
    this._editorError = null;
    // each page is an entry of the history (#322): what is open over this one stays in its entry, Back opens it again
    if (how !== "none") navPage(this.pageNow(mode), how === "push");
    this._viewOpen = false;
    this.setStylesOpen(false);
    this._roomsOpen = false;
    this._findOpen = false;
    if (mode === "view") void this.data.flush();
    if (mode === "settings") this.settingsFrom = this._mode;
    if (mode !== "extensions") this._extFocus = null;
    this._mode = mode;
  }

  private settingsLink(section: string | null, id: string | null): string {
    return `#settings${section ? `/${section}${id ? `/${encodeURIComponent(id)}` : ""}` : ""}`;
  }

  /** The page (its address hash, #322) a mode shows; the Settings page's names its section and setting. */
  private pageNow(mode: Mode = this._mode): string {
    return mode === "view" ? "" : mode === "settings" ? this.settingsLink(this._settingsAt.section, this._settingsAt.id) : `#${mode}`;
  }

  /** Back, Forward or a link brought another page (#322): shown without an entry of its own. */
  private readonly showPage = (page: string): void => {
    const mode = modeOf(page);
    if (mode === "settings") {
      this._settingsAt = settingsAddress(page) ?? { section: null, id: null };
      if (!this._settingsAt.section && !this._settingsAt.id) this.settingsKey++;
    }
    this.setMode(mode, "none");
  };

  private navRelease: (() => void) | null = null;
  /** A new one draws the Settings page afresh. */
  private settingsKey = 0;

  /**
   * Opens the Settings page at a section and setting (#139): the editor's ⚙ menu, the view's popovers, the tool panels
   * and the Extensions page link here. Not in locked tablet mode.
   */
  private openSettings(section: string | null = null, id: string | null = null): void {
    if (this._tablet) return;
    this._settingsAt = { section, id };
    if (this._mode === "settings") navPage(this.pageNow());
    else this.setMode("settings");
  }

  private readonly onOpenSettings = (e: Event) => {
    const d = (e as CustomEvent<{ section?: string | null; id?: string | null }>).detail ?? {};
    e.stopPropagation();
    e.preventDefault();
    this.openSettings(d.section ?? null, d.id ?? null);
  };

  /** A module sheet's "Extension settings ›" (#248): its settings are on the Extensions tab (editors only). */
  private readonly onOpenExtensions = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    if (this.canEdit) this.setMode("extensions");
  };

  /** A link to #settings/… (or #editor, #extensions) typed or clicked while the panel is open (#322: back-stack.ts). */
  private readonly onHash = () => navFollowAddress();

  /** A button on the Settings page that leaves it or opens something of the panel's. */
  private settingsAction(e: CustomEvent<{ action: string; id?: string | null; focus?: string | null }>): void {
    const { action } = e.detail;
    if (action === "extensions") {
      this._extFocus = e.detail.focus ?? extensionAnchor(e.detail.id);
      this.setMode("extensions");
    } else if (action === "editor") this.setMode("editor");
    else if (action === "kerb") this.openBinKerb();
    else if (action === "mic_probe") void loadVoice().then(() => (this._micProbe = true)).catch(() => undefined);
    else if (action === "locate" && this.hass && this.data.building) {
      const b = this.data.building;
      void loadLocate().then((m) =>
        m.openLocateSetup(this.hass, b, () => this.hass, (look) => {
          const cur = this.data.building;
          if (cur) this.editPlan({ ...cur, settings: { ...cur.settings, person_look: look === "figure" ? null : look } });
        }),
      );
    }
  }

  /**
   * The Settings page's way to a bin's kerb spot (#226): the editor with the first bin selected, where "Set kerb spot"
   * is at the top of its panel. Without a bin it is the editor alone (add one from the Household items).
   */
  private openBinKerb(): void {
    const bin = this.data.building?.floors.flatMap((f) => f.furniture).find((m) => m.type === "waste_bin");
    this.setMode("editor");
    if (!bin) return;
    void loadEditor().then(async () => {
      this._editorReady = true;
      await this.updateComplete;
      const ed = this.renderRoot.querySelector<HTMLElement & { goToFurniture(id: string): boolean; updateComplete: Promise<unknown> }>("fp3d-editor");
      await ed?.updateComplete;
      ed?.goToFurniture(bin.id);
    }, () => undefined);
  }

  /** A change from the 3D view's settings or a module (#149): saved by the controller, which makes it again on a newer
   * plan when someone else saved meanwhile. */
  private onPlanChange(e: CustomEvent<{ change: PlanChange }>): void {
    e.preventDefault();
    this.updatePlan(e.detail.change);
  }

  /** A saved-at-once change (3D view settings, hiding a room): also one more step of the undo history, so an editor
   * opened next keeps its steps (#384). */
  private updatePlan(change: PlanChange): void {
    const b = this.data.building;
    if (!b) return;
    const next = structuredClone(b);
    change(next);
    this.undoHistory.record(b, next, this.data.homeId);
    this.data.update(change);
    // the controller made its own copy of the result: that one is the plan the steps now lead up to
    if (this.data.building) this.undoHistory.track(this.data.building);
  }

  private onRoomTap(e: CustomEvent<{ floorId: string; roomId: string | null }>): void {
    const { floorId, roomId } = e.detail;
    // in the house view (or on another floor) a tap first opens the whole floor; rooms come next
    if ((this.data.building?.floors.length ?? 0) > 1 && floorId && this._floorId !== floorId) {
      this._floorId = floorId;
      this._roomId = null;
      return;
    }
    if (!roomId) return;
    // the room whose panel was closed (#354): a tap opens its panel again
    if (roomId === this._roomId && this._shutRoom === roomId) {
      this._shutRoom = null;
      return;
    }
    this._roomId = roomId === this._roomId ? null : roomId;
  }

  /** A room is selected and its panel is showing (closing the panel keeps the room, #354). */
  private get roomPanelShown(): boolean {
    return !!this._roomId && this._shutRoom !== this._roomId;
  }

  private setPlan2d(on: boolean): void {
    this._plan2d = on;
    prefs.set("plan2d", on ? "1" : "0");
  }

  /**
   * A row of the View panel changed (#247): it wrote this device's preference where the Settings page does, so the
   * panel reads its preferences again; a new appearance is announced. The panel stays open (it is not a menu).
   */
  private onViewChange(e: CustomEvent<{ id: string }>): void {
    const before = this._theme;
    this.readPrefs();
    if (e.detail?.id === "theme" && before !== this._theme) announce(lookAnnouncement(before, this._theme, (k, v) => this.t(k as I18nKey, v)));
  }

  /** Opens or closes the View panel; closing puts the focus back on the View button. */
  private setViewOpen(open: boolean, refocus = false): void {
    this._viewOpen = open;
    if (!open && refocus) void this.updateComplete.then(() => this.renderRoot?.querySelector<HTMLElement>(".fp3d-view-btn")?.focus());
  }

  /** Opens or closes the styles dialog (#441); closing puts the screen's own style back in the house. */
  private setStylesOpen(open: boolean): void {
    if (open === this._stylesOpen) return;
    this._stylesOpen = open;
    if (!open) (this.renderRoot?.querySelector("fp3d-view3d") as (HTMLElement & { previewStyle?(s: unknown): void }) | null)?.previewStyle?.(null);
  }

  /** Some device of the home is a camera: the Cameras button (the camera wall, #266) is there. */
  private hasCameras(b: Building): boolean {
    return b.floors.some((f) => f.placements.some((p) => kindOf(p.entity_id) === "camera"));
  }

  /** Where the 3D view is, for what the View panel offers (as the Show menu did). */
  private viewContext(b: Building): ViewContext {
    return { floors: b.floors.length, floorOpen: !!this._floorId, roof: b.settings.roof.type !== "none", plan2d: this._plan2d, kiosk: this._tablet, vacuums: !!b.settings.vacuum_maps?.length };
  }

  /** A change made here or on the Extensions page: saved, and one more step of the editor's undo history (#66). */
  private editPlan(next: Building, mergeKey: string | null = null): void {
    const b = this.data.building;
    if (b) this.undoHistory.record(b, next, this.data.homeId, mergeKey);
    this.data.edit(next);
  }

  /** Change one furniture item of the building (furnishing in 3D) and save; `mergeKey` joins a run of moves. */
  private editFurniture(id: string, change: (f: Building["floors"][number]["furniture"][number], floor: Building["floors"][number]) => void, mergeKey: string | null = null): void {
    const b = this.data.building;
    if (!b) return;
    const next = structuredClone(b);
    for (const floor of next.floors) {
      const f = floor.furniture.find((m) => m.id === id);
      if (f) change(f, floor);
    }
    this.editPlan(next, mergeKey);
  }

  /** Change one placed device (furnishing in 3D) and save. */
  private editDevice(entityId: string, change: (p: Building["floors"][number]["placements"][number], floor: Building["floors"][number]) => void, mergeKey: string | null = null): void {
    const b = this.data.building;
    if (!b) return;
    const next = structuredClone(b);
    for (const floor of next.floors) {
      const p = floor.placements.find((x) => x.entity_id === entityId);
      if (p) change(p, floor);
    }
    this.editPlan(next, mergeKey);
  }

  private moveDevice(e: CustomEvent<{ id: string; x: number; z: number }>): void {
    const { id, x, z } = e.detail;
    // a device stays in its room (no dragging through walls)
    this.editDevice(id, (p, floor) => {
      const [nx, nz] = keepInRoom(floor, p.x, p.z, x, z);
      Object.assign(p, { x: nx, z: nz });
    }, `move:${id}`);
  }

  /** Cameras turn in finer steps than lamps (the rotation field sets where they look). */
  private turnStep(): number {
    return kindOf(this._selDevice ?? "") === "camera" ? 15 : 45;
  }

  private turnDevice(delta: number): void {
    if (!this._selDevice) return;
    this.editDevice(this._selDevice, (p) => (p.rotation = ((((p.rotation ?? 0) + delta) % 360) + 360) % 360));
  }

  private deleteDevice(): void {
    const id = this._selDevice;
    const b = this.data.building;
    if (!id || !b) return;
    const next = structuredClone(b);
    for (const floor of next.floors) floor.placements = floor.placements.filter((p) => p.entity_id !== id);
    this.editPlan(next);
    this._selDevice = null;
  }

  /** Height and, for lights, the mount of the selected device, editable in the furnish bar. */
  private renderDeviceFields(id: string) {
    const b = this.data.building;
    const floor = b?.floors.find((fl) => fl.placements.some((p) => p.entity_id === id));
    const p = floor?.placements.find((x) => x.entity_id === id);
    if (!floor || !p) return nothing;
    const kind = kindOf(id);
    const light = kind === "light";
    const camera = kind === "camera";
    const dome = p.mount === "ceiling";
    const auto = kind ? defaultHeight(kind, floor.height, light || camera ? (p.mount ?? (camera ? "wall" : "ceiling")) : null) : 1;
    // feet and inches where the plan or Home Assistant says so (#117); a length field (metres) follows it (#170)
    const unit = lengthUnit(this.hass, this.data.building?.settings.units);
    const imperial = unit === "imperial";
    const showLen = (v: number) => (imperial ? formatImperial(v) : String(Math.round(v * 100) / 100));
    const readLen = (text: string) => (imperial ? parseLength(text, "imperial") : parseFloat(text.replace(",", ".")));
    const numField = (label: string, value: number, step: number, min: number, max: number, set: (v: number) => void, length = false) =>
      html`<label class="fp3d-size" title=${length ? unitLabel(label, unit) : label}
        >${length ? unitLabel(label, unit) : label}
        <input
          type=${length && imperial ? "text" : "number"}
          inputmode="decimal"
          step=${step}
          min=${min}
          max=${max}
          .value=${length ? showLen(value) : String(Math.round(value * 100) / 100)}
          @change=${(e: Event) => {
            const v = length ? readLen((e.target as HTMLInputElement).value) : parseFloat((e.target as HTMLInputElement).value.replace(",", "."));
            if (v !== null && Number.isFinite(v)) set(Math.min(max, Math.max(min, v)));
          }}
        />
      </label>`;
    return html`${light
        ? html`<select class="fp3d-size-select" title=${this.t("lamp_mount")} @change=${(e: Event) => this.editDevice(id, (d) => Object.assign(d, { mount: (e.target as HTMLSelectElement).value as LampMount, y: null }))}>
            ${(["ceiling", "floor", "table", "wall"] as const).map((m) => html`<option value=${m} ?selected=${m === (p.mount ?? "ceiling")}>${this.t(`lamp_${m}`)}</option>`)}
          </select>`
        : nothing}
      ${camera
        ? html`<select class="fp3d-size-select" title=${this.t("camera_mount")} @change=${(e: Event) => this.editDevice(id, (d) => Object.assign(d, { mount: (e.target as HTMLSelectElement).value as LampMount, y: null }))}>
              <option value="wall" ?selected=${!dome}>${this.t("camera_mount_wall")}</option>
              <option value="ceiling" ?selected=${dome}>${this.t("camera_mount_ceiling")}</option>
            </select>
            ${numField(this.t("camera_fov_short"), p.fov ?? (dome ? 360 : 90), 5, 10, 360, (v) => this.editDevice(id, (d) => (d.fov = v)))}
            ${numField(this.t("camera_reach_short"), p.reach ?? (dome ? 3 : 4.5), 0.5, 0.5, 50, (v) => this.editDevice(id, (d) => (d.reach = v)), true)}
            ${numField(this.t("camera_tilt_short"), p.tilt ?? (dome ? 65 : 20), 5, 0, 90, (v) => this.editDevice(id, (d) => (d.tilt = v)))}`
        : nothing}
      <label class="fp3d-size" title=${unitLabel(this.t("marker_height"), unit)}
        >${this.t("size_short_h")}
        <input
          type=${imperial ? "text" : "number"}
          inputmode="decimal"
          step="0.05"
          min="0"
          .value=${showLen(p.y ?? auto)}
          @change=${(e: Event) => {
            const v = readLen((e.target as HTMLInputElement).value);
            if (v !== null && Number.isFinite(v) && v >= 0) this.editDevice(id, (d) => (d.y = Math.round(v * 1000) / 1000));
          }}
        />
      </label>
      ${p.y !== null ? html`<button class="fp3d-chip" @click=${() => this.editDevice(id, (d) => (d.y = null))}>${this.t("height_auto")}</button>` : nothing}`;
  }

  private furnitureName(id: string): string {
    const f = this.data.building?.floors.flatMap((fl) => fl.furniture).find((m) => m.id === id);
    return f ? furnitureName(this.hass, f.type) : "";
  }

  private moveFurniture(e: CustomEvent<{ id: string; x: number; z: number }>): void {
    const { id, x, z } = e.detail;
    const wall = this.data.building?.settings.wall_interior ?? 0.12;
    this.editFurniture(id, (f, floor) => {
      // the item stays in its room (no dragging through walls) …
      const [nx, nz] = keepInRoom(floor, f.x, f.z, x, z);
      Object.assign(f, { x: nx, z: nz });
      // … and near a wall it turns its back to it and sits flush, as in the editor
      const snap = snapToWall(floor, f, wall);
      if (snap) Object.assign(f, snap);
    }, `move:${id}`);
  }

  /** Width, depth and height of the selected item, editable in the furnish bar. */
  private renderSizeFields(id: string) {
    const f = this.data.building?.floors.flatMap((fl) => fl.furniture).find((m) => m.id === id);
    if (!f) return nothing;
    // feet and inches where the plan or Home Assistant says so (#117)
    const imperial = lengthUnit(this.hass, this.data.building?.settings.units) === "imperial";
    const show = (v: number) => (imperial ? formatImperial(v) : String(Math.round(v * 100) / 100));
    const read = (text: string) => (imperial ? parseLength(text, "imperial") : parseFloat(text.replace(",", ".")));
    const field = (key: "w" | "d" | "h", label: string) => html`<label class="fp3d-size" title=${this.t(`size_${key}` as I18nKey)}
      >${label}
      <input
        type=${imperial ? "text" : "number"}
        inputmode="decimal"
        step="0.05"
        min="0.05"
        .value=${show(f[key])}
        @change=${(e: Event) => {
          const v = read((e.target as HTMLInputElement).value) ?? NaN;
          if (Number.isFinite(v) && v > 0) this.editFurniture(id, (m) => (m[key] = Math.round(v * 1000) / 1000));
        }}
    /></label>`;
    const floor = this.data.building?.floors.find((fl) => fl.furniture.some((m) => m.id === id));
    return html`${field("w", this.t("size_short_w"))}${field("d", this.t("size_short_d"))}${field("h", this.t("size_short_h"))}
    ${floor && canLift(f)
      ? html`<label class="fp3d-size" title=${unitLabel(this.t("mount_height"), lengthUnit(this.hass, this.data.building?.settings.units))}
            >↕
            <input
              type=${imperial ? "text" : "number"}
              inputmode="decimal"
              step="0.05"
              min="0"
              .value=${show(f.mount_y ?? mountBase(floor, f))}
              @change=${(e: Event) => {
                const v = read((e.target as HTMLInputElement).value) ?? NaN;
                if (Number.isFinite(v) && v >= 0) this.editFurniture(id, (m) => (m.mount_y = Math.round(v * 1000) / 1000));
              }}
          /></label>
          ${f.mount_y != null ? html`<button class="fp3d-chip" @click=${() => this.editFurniture(id, (m) => (m.mount_y = null))}>${this.t("height_auto")}</button>` : nothing}`
      : nothing}`;
  }

  private turnFurniture(delta: number): void {
    if (!this._selFurniture) return;
    this.editFurniture(this._selFurniture, (f) => (f.rotation = (((f.rotation + delta) % 360) + 360) % 360));
  }

  private deleteFurniture(): void {
    const id = this._selFurniture;
    const b = this.data.building;
    if (!id || !b) return;
    const next = structuredClone(b);
    for (const floor of next.floors) floor.furniture = floor.furniture.filter((m) => m.id !== id);
    this.editPlan(next);
    this._selFurniture = null;
  }

  private view3d() {
    return readyView(this.renderRoot) as (HTMLElement & { resetView(): void; endWalk(): boolean; lookThrough(entityId: string): void; historyEntities(): HistorySpec; currentView(): StartView | null; roomSheets(roomId: string): { id: string; icon: string; title: string }[]; openRoomSheet(roomId: string, id: string): void }) | null;
  }

  /** Time travel on or off; without the Pro add-on its hint shows. `at`: a start moment from a link. */
  private toggleTimeTravel(at: string | null = null): void {
    if (this.tt.active) {
      this.tt.stop();
      return;
    }
    const view = this.view3d();
    const b = this.data.building;
    if (!view || !b || !this.hass) return;
    this._furnish = false;
    this._cameraWall = false;
    this.tt.start({ live: this.hass, building: b, spec: view.historyEntities(), quality: this._quality, at, t: (k, vars) => translate(this.hass, k as I18nKey, vars) });
  }

  /** The home and floor last announced (#196): a screen reader hears when either changes, not on the first load. */
  private announcedView: ViewSpot | null = null;

  private announceView(): void {
    const b = this.data.building;
    if (!b) return;
    const now = { home: this.data.homeId, floor: this._floorId };
    const change = viewChange(this.announcedView, now);
    this.announcedView = now;
    if (change === "home") announce(this.t("announce_home", { name: this.data.homeName ?? "Home 3D" }));
    else if (change === "floor") announce(now.floor ? this.t("announce_floor", { name: b.floors.find((f) => f.id === now.floor)?.name ?? "" }) : this.t("all_floors"));
  }

  /** Android's back gesture closes the View panel before it leaves the page (#250, back-stack.ts). */
  private readonly backLayers = new BackLayers("panel");

  /** What is open over the page follows Back and Forward (#322, back-stack.ts). */
  private syncBack(changed: PropertyValues | Map<string, unknown>): void {
    const rows: Parameters<BackLayers["syncAll"]>[0] = [];
    const row = (prop: string, ...r: (typeof rows)[number]) => changed.has(prop) && rows.push(r);
    row("_viewOpen", "view", this._viewOpen && this._mode === "view", () => this.setViewOpen(false, true), () => this.setViewOpen(true));
    // the Rooms picker, the search, the camera wall and the microphone check follow Back too (#322)
    row("_roomsOpen", "rooms", this._roomsOpen, () => (this._roomsOpen = false), () => (this._roomsOpen = true));
    row("_findOpen", "find", this._findOpen, () => (this._findOpen = false), () => (this._findOpen = true));
    row("_cameraWall", "cameras", this._cameraWall && this._mode === "view", () => (this._cameraWall = false), () => (this._cameraWall = true));
    row("_micProbe", "mic", this._micProbe, () => ((this._micProbe = false), micProbeDone()));
    // a picked floor and an open room are steps of their own (#346): Back (Android's gesture, the browser's) takes the
    // same steps as the Back button on the bar, the room first, then the floor, before it leaves the page
    const floor = this._floorId;
    const room = this._roomId;
    row("_floorId", "floor", !!floor && (this.data.building?.floors.length ?? 0) > 1, () => ((this._roomId = null), (this._floorId = null)), floor ? () => (this._floorId = floor) : undefined);
    row("_roomId", "room", !!room, () => (this._roomId = null), room ? () => (this._roomId = room) : undefined);
    this.backLayers.syncAll(rows);
  }

  protected updated(changed: PropertyValues): void {
    this.announceView();
    this.syncBack(changed);
    // the floor row scrolls sideways on a phone: the chosen floor stays in view (#249), also when the Rooms button
    // beside it grows with a room's name
    // both read the layout: once in the next frame, where it is laid out anyway, not straight after every update
    // (run 6 speed: the first update forced the whole panel's first layout in the middle of its load)
    if (changed.has("_floorId") || changed.has("_roomId")) this.navScroll = true;
    if (!this.navFrame)
      this.navFrame = requestAnimationFrame(() => {
        this.navFrame = 0;
        if (this.navScroll) {
          this.navScroll = false;
          const on = this.renderRoot.querySelector<HTMLElement>(".fp3d-floors [aria-pressed='true']");
          const row = on?.parentElement;
          if (on && row && row.scrollWidth > row.clientWidth) on.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        }
        this.markNavEdges();
      });
    // the page's language is the one its texts are in (#196): English while a language has no texts here
    const lang = uiLanguage(this.hass);
    if (this.getAttribute("lang") !== lang) this.setAttribute("lang", lang);
    // the chrome goes light with the Day look (#85); Settings, Extensions and the editor follow it too (#263)
    const chromeLook = shownLook(this._theme, this.hass, this.data.building?.settings as StylePlan | undefined);
    this.toggleAttribute("light", lightChrome(chromeLook));
    this.toggleAttribute("contrast", contrastChrome(chromeLook));
    // lab: the locating recorder box for admins (feasibility test, not a feature yet)
    if (!this.locateLab && this.hass?.user?.is_admin && this.data.building && labOn()) {
      this.locateLab = mountLocateLab(() => ({ hass: this.hass, building: this.data.building }));
    }
    // a link with ?tt=07:42 or ?tt=-3h opens the time travel there, once the plan is loaded (it brings the recipes of
    // its items; the view needs no library, #44)
    if (this.ttLinked || !this.data.building || this._mode !== "view" || !this.view3d()) return;
    this.ttLinked = true;
    const at = new URLSearchParams(location.search).get("tt");
    if (at !== null) this.toggleTimeTravel(at);
  }

  private back(): void {
    if (this.view3d()?.endWalk()) return;
    if (this._roomId) this._roomId = null;
    else if (this._floorId && (this.data.building?.floors.length ?? 0) > 1) this._floorId = null;
    else this.view3d()?.resetView();
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || this._mode !== "view") return;
    // Esc first closes the View panel (focus back on its button, #247), then leaves the time travel, then goes up a level
    if (this._stylesOpen) this.setStylesOpen(false);
    else if (this._viewOpen) this.setViewOpen(false, true);
    else if (this.tt.active) this.tt.stop();
    else this.back();
  };

  connectedCallback(): void {
    super.connectedCallback();
    // the 3D view's code is a chunk of its own (#179); what the panel asks of it waits until it is there. The 3D bundle
    // it starts is fetched alongside (run 6 speed)
    if (!this._plan2d) preload3d();
    // the browser's number formatting is set up on its first use (tens of milliseconds on a slow tablet): in a pause of
    // the load, not in the 3D view's first device sync (run 6 speed)
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => [0, 1, 2].forEach((d) => formatNumber(this.hass, 0.5, d)), { timeout: 2000 });
    void loadView().then(
      () => this.requestUpdate(),
      (err: unknown) => console.error("Home 3D: the 3D view failed to load", err),
    );
    window.addEventListener("keydown", this.onKey);
    // the panel's page follows Back, Forward and its address (#322); a page a link asked for while it was away opens
    const asked = pageOf(location.hash);
    if (asked) this.showPage(asked);
    this.navRelease = navHost(this.pageNow(), pageOf, this.showPage);
    window.addEventListener("hashchange", this.onHash);
    window.addEventListener("location-changed", this.onHash);
    this.addEventListener("open-settings", this.onOpenSettings);
    this.addEventListener("open-extensions", this.onOpenExtensions);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("hashchange", this.onHash);
    window.removeEventListener("location-changed", this.onHash);
    this.removeEventListener("open-settings", this.onOpenSettings);
    this.removeEventListener("open-extensions", this.onOpenExtensions);
    this.listenTouches(false);
    this.backLayers.closeAll();
    this.navRelease?.();
    this.navRelease = null;
    this.tt.stop();
    this.locateLab?.();
    this.locateLab = null;
  }

  protected render() {
    if (this.hass && !languageReady(this.hass.language)) return nothing;
    const b = this.data.building;
    if (this.canEdit && this.hass) need(loadHomeSwitcher);
    const notices = this.noticeList(this._clean && this._mode === "view");
    this.noticeKey = notices.map((n) => n.key).join("|");
    return html`
      <div class="fp3d-app ${this._clean && this._mode === "view" ? "fp3d-clean" : ""}" style=${this.accentStyle()}>
        ${this._micProbe && this.hass ? html`<fp3d-mic-probe .hass=${this.rawHass} .building=${b} @close=${() => ((this._micProbe = false), micProbeDone())}></fp3d-mic-probe>` : nothing}
        ${this._clean && this._mode === "view" ? nothing : this._tablet ? this.renderTabletHeader() : this.renderHeader(notices.length)}
        ${this.renderNotices(notices)}
        ${this.data.error && !b ? html`<p class="fp3d-message">${this.t("load_error")}: ${this.data.error}</p>` : nothing}
        ${!b && !this.data.error ? html`<p class="fp3d-message">${this.t("loading")}</p>` : nothing}
        ${b
          ? this._mode === "editor" && this.canEdit
            ? this.renderEditor(b)
            : this._mode === "extensions" && this.canEdit
              ? this.renderExtensions()
              : this._mode === "settings" && !this._tablet
                ? this.renderSettings(b)
                : this.renderView(b)
          : nothing}
      </div>
    `;
  }

  /** Tablet mode (#92): the home's name and nothing to mis-tap (no menu, switcher, tabs, view settings, version). */
  private renderTabletHeader() {
    return html`<header class="fp3d-header fp3d-tablet-head"><h1>${this.data.homeName || "Home 3D"}</h1></header>`;
  }

  /** Restart hint, save errors and unsaved edits from an earlier session. */
  /** This device's accent: the one picked here, else the HA theme's while the look follows it (#38). */
  private shownAccent(): string | null {
    return shownAccent(this._theme, this._accent, this.hass, (n) => getComputedStyle(this).getPropertyValue(n));
  }

  private accentStyle(): string {
    return accentVars(this.shownAccent());
  }

  /**
   * One header row (#249, the redesign #219): Home Assistant's menu, the title, one home control (name, a dot while the
   * displays show it, its menu), the tabs as underlined navigation and the save line. The version is in Settings ›
   * Advanced › About; a notice is a badge on the save line plus a pop-up message, never a banner pushing the plan down.
   */
  private renderHeader(noticeCount: number) {
    const tab = (mode: Mode, cls: string, icon: UiIcon, label: string, short: string | null, go: () => void) =>
      html`<button class="fp3d-tab ${cls}" aria-current=${this._mode === mode ? "page" : nothing} aria-label=${label} title=${short === null ? label : nothing} @click=${go}>
        ${uiIcon(icon)}<span class="fp3d-tab-word">${label}</span>${short ? html`<span class="fp3d-tab-short" aria-hidden="true">${short}</span>` : nothing}
      </button>`;
    return html`<header class="fp3d-header">
      <ha-menu-button .hass=${this.rawHass} .narrow=${this.narrow}></ha-menu-button>
      <h1>Home 3D</h1>
      ${this.canEdit && this.hass
        ? html`<fp3d-home-switcher
            .hass=${this.rawHass}
            .home=${this.data.homeId}
            @home-settings=${() => this.openSettings("homes", "homes")}
            @home-open=${(e: CustomEvent<{ home: string | null }>) => this.openHome(e.detail.home ?? undefined)}
          ></fp3d-home-switcher>`
        : nothing}
      <nav class="fp3d-tabs" aria-label=${this.t("modes")}>
        ${tab("view", "fp3d-tab-view", "cube", this.t("view"), "", () => this.setMode("view"))}
        ${this.canEdit
          ? html`${tab("editor", "fp3d-tab-editor", "pencil", this.t("editor"), this.t("editor_short"), () => this.setMode("editor"))}
            ${tab("extensions", "fp3d-tab-ext", "puzzle", this.t("ext_tab"), null, () => this.setMode("extensions"))}`
          : nothing}
        ${tab("settings", "fp3d-tab-settings", "gear", this.t("settings"), null, () => this.openSettings())}
      </nav>
      <span class="fp3d-grow"></span>
      ${this.renderSaveLine(noticeCount)}
    </header>`;
  }

  /**
   * The save line (#249): who the last change was saved for, a dot alone on a phone; the Settings page has its own
   * (#248). A badge with the number of notices brings back the messages put away.
   */
  private renderSaveLine(noticeCount: number) {
    const state = this.data.saveState;
    const text = state === "idle" || this._mode === "settings" ? "" : this.t(state === "saving" ? "saving" : state === "saved" ? "st_saved_home" : "save_error");
    const shown = noticeCount > 0 && this._noticesHidden !== this.noticeKey;
    return html`<span class="fp3d-save fp3d-save-${text ? state : "idle"}" role="status" aria-live="polite">
        ${text ? html`<span class="fp3d-save-dot" aria-hidden="true"></span><span class="fp3d-save-text">${text}</span>` : nothing}
      </span>
      ${noticeCount
        ? html`<button
            class="fp3d-note-badge"
            aria-expanded=${shown ? "true" : "false"}
            aria-label=${this.t("notices_badge", { n: noticeCount })}
            title=${this.t("notices_badge", { n: noticeCount })}
            @click=${() => (this._noticesHidden = shown ? this.noticeKey : "")}
          >
            <span>${noticeCount}</span>
          </button>`
        : nothing}`;
  }

  /** Which notices show now: a new one (another key) pops up again after the last ones were put away. */
  private noticeKey = "";

  /**
   * The notices (#249): update ready, restart needed, a repaired plan, a failed save, unsaved edits from an earlier
   * session. The clean view keeps only the update notice (#60). Each has a key, so a new one pops up again.
   */
  private noticeList(clean: boolean): { key: string; body: TemplateResult }[] {
    const d = this.data;
    const notices: { key: string; body: TemplateResult }[] = [];
    // an old bundle in the browser or the companion app: a reload helps, a restart does not
    const update = this.renderUpdateNotice();
    if (update) notices.push({ key: `update:${d.updateNotice}`, body: update });
    if (clean) return notices;
    if (d.needsRestart && d.versionGap !== "frontend") {
      notices.push({ key: "restart", body: html`<div class="fp3d-notice fp3d-notice-warn"><span>${d.backendVersion ? this.t("needs_restart", { version: d.backendVersion, frontend: d.frontendVersion }) : this.t("needs_restart_old")}</span></div>` });
    }
    // a stored plan the backend repaired or cannot read (#165)
    const problem = d.planProblem;
    if (problem && !this._tablet) {
      const text = problem.code === "plan_repaired" ? this.t("plan_repaired", { parts: (problem.dropped ?? []).length }) : problem.code === "plan_too_new" ? this.t("plan_too_new") : this.t("plan_invalid", { error: problem.message });
      notices.push({ key: `plan:${problem.code}`, body: html`<div class="fp3d-notice fp3d-notice-${problem.code === "plan_repaired" ? "warn" : "error"}" role="status"><span>${text}</span></div>` });
    }
    if (d.saveState === "error" && d.saveError) {
      notices.push({ key: "save", body: html`<div class="fp3d-notice fp3d-notice-error"><span>${this.t("save_failed_detail", { error: d.saveError })}</span></div>` });
    }
    if (d.draft && this.canEdit && !this._tablet) {
      const at = formatDateTime(d.draft.savedAt, timeStyleOf(this.hass));
      // edits that would replace a newer plan (#378) say so, and restoring keeps the plan shown as a restore point
      const newer = d.draftNewer;
      const found = !d.draft.home ? "draft_found_old" : newer ? "draft_found_newer" : "draft_found";
      notices.push({
        key: `draft:${d.draft.savedAt}`,
        body: html`<div class="fp3d-notice">
          <span>${d.conflict ? this.t("save_conflict") : this.t(found, { time: at })}</span>
          <button class="fp3d-btn fp3d-primary" @click=${() => void d.restoreDraft()}>${this.t(d.conflict ? "draft_restore_conflict" : newer ? "draft_restore_newer" : "draft_restore")}</button>
          <button class="fp3d-btn" @click=${() => d.discardDraft()}>${this.t("draft_discard")}</button>
        </div>`,
      });
    }
    return notices;
  }

  /** When the notices now showing appeared (ms, performance.now()): their buttons wait NOTICE_ARM_MS before they act. */
  private noticeShownAt = 0;
  private noticeShownKey = "";

  /**
   * The notices (#249) in a strip of their own under the header (#258): popped up over the page they covered Walk, the
   * floors row and the editor's toolbar. The plan and the 3D view are only made shorter, never covered. A tap aimed at a
   * control that the strip has just moved lands on it instead, so its buttons do nothing for NOTICE_ARM_MS after it
   * appears. "Hide" puts them away until another one comes; the badge on the save line brings them back.
   */
  private renderNotices(notices: { key: string; body: TemplateResult }[]) {
    if (!notices.length || this._noticesHidden === this.noticeKey) {
      this.noticeShownKey = "";
      return nothing;
    }
    if (this.noticeShownKey !== this.noticeKey) {
      this.noticeShownKey = this.noticeKey;
      this.noticeShownAt = performance.now();
    }
    return html`<div class="fp3d-notices" role="region" aria-label=${this.t("notices")} @click=${{ handleEvent: (e: Event) => this.guardNoticeTap(e), capture: true }}>
      <div class="fp3d-notices-list">${notices.map((n) => n.body)}</div>
      <button class="fp3d-btn fp3d-notices-hide" @click=${() => (this._noticesHidden = this.noticeKey)}>${this.t("notices_hide")}</button>
    </div>`;
  }

  /** Swallows a tap on the notices that came too soon after they appeared: it was aimed at what was there before (#258). */
  private guardNoticeTap(e: Event): void {
    if (noticeTapTooSoon(this.noticeShownAt, performance.now())) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  /**
   * "Updated, tap to reload" (#60): this page runs older JavaScript than Home Assistant serves now (a new version, or
   * the same one rebuilt). It never reloads by itself; the button waits for edits still being saved and does nothing
   * while the last save failed, so no edit is lost. Shown in the clean view too: wall tablets are never reloaded.
   */
  private renderUpdateNotice() {
    const d = this.data;
    const state = d.updateNotice;
    if (!state) return null;
    // a new version names both (with the companion-app hint); the same version rebuilt just says it was updated
    const text = d.backendVersion !== d.frontendVersion ? this.t("needs_reload", { frontend: d.frontendVersion, backend: d.backendVersion ?? "?" }) : this.t("update_ready");
    return html`<div class="fp3d-notice fp3d-notice-warn fp3d-notice-update" role="status">
      <span>${text}${state === "ready" ? nothing : html` ${this.t(state === "saving" ? "update_saving" : "update_unsaved")}`}</span>
      <button class="fp3d-btn" ?disabled=${state === "unsaved"} @click=${() => void d.reloadWhenSaved()}>${this.t("reload_page")}</button>
    </div>`;
  }

  /**
   * "Loading …" while the editor bundle (editor and extensions page) is fetched, or why it failed (#52: a failure used
   * to leave "Loading …" up for good); nothing once it is there.
   */
  private editorPending() {
    if (this._editorReady) return null;
    if (this._editorError) return html`<div class="fp3d-empty"><p>${this.t("load_error")}: ${this._editorError}</p></div>`;
    loadEditor().then(
      () => (this._editorReady = true),
      (err: unknown) => (this._editorError = String(err)),
    );
    return html`<div class="fp3d-empty"><p>${this.t("loading")}</p></div>`;
  }

  /** The extensions page (built-in features, fun extras, packs); it comes with the editor bundle. */
  private renderExtensions() {
    void this.data.loadLibrary();
    const pending = this.editorPending();
    if (pending) return pending;
    // a chunk of the editor bundle (#245): the page shows once its code is there
    if (!customElements.get("fp3d-extensions")) {
      loadExtensionsPage().then(
        () => this.requestUpdate(),
        (err: unknown) => console.error("Home 3D: the Extensions page failed to load", err),
      );
      return html`<div class="fp3d-empty"><p>${this.t("loading")}</p></div>`;
    }
    return html`<fp3d-extensions
      class="fp3d-body"
      .hass=${this.rawHass}
      .canEdit=${this.data.canEdit}
      .packs=${this.data.packs}
      .building=${this.data.building}
      .card=${this._extFocus}
      @building-edit=${(e: CustomEvent<Building>) => this.editPlan(e.detail)}
      @packs-changed=${() => void this.data.reloadPacks()}
    ></fp3d-extensions>`;
  }

  /** The Settings page (#139): its own bundle, loaded the first time the tab opens. */
  private renderSettings(b: Building) {
    if (!this._settingsReady) {
      if (this._settingsError) return html`<div class="fp3d-empty"><p>${this.t("load_error")}: ${this._settingsError}</p></div>`;
      loadSettings().then(
        () => (this._settingsReady = true),
        (err: unknown) => (this._settingsError = String(err)),
      );
      return html`<div class="fp3d-empty"><p>${this.t("loading")}</p></div>`;
    }
    // Back to the page's plain address (#322) is a fresh page: a phone's list of sections, the first section elsewhere
    return keyed(this.settingsKey, html`<fp3d-settings-page
      class="fp3d-body"
      .hass=${this.rawHass}
      .building=${b}
      .canEdit=${this.data.canEdit}
      .packs=${this.data.packs}
      .t=${this.translator}
      .section=${this._settingsAt.section}
      .focusId=${this._settingsAt.id}
      .saveState=${this.data.saveState}
      .homeName=${this.data.homeName ?? ""}
      .homeId=${this.data.homeId}
      .lastView=${this.lastView}
      .loadEditor=${loadEditor}
      .backTo=${this.settingsFrom === "settings" ? "view" : this.settingsFrom}
      .version=${this.versions()}
      @settings-back=${() => this.setMode(this.settingsFrom === "settings" ? "view" : this.settingsFrom)}
      @settings-edit=${(e: CustomEvent<{ building: Building; key: string | null }>) => this.editPlan(e.detail.building, e.detail.key)}
      @device-change=${() => (this.readPrefs(), this.requestUpdate())}
      @settings-action=${this.settingsAction}
      @home-reload=${() => void this.data.reopen()}
      @home-open=${(e: CustomEvent<{ home: string | null }>) => this.openHome(e.detail.home ?? undefined)}
      @settings-nav=${(e: CustomEvent<{ section: string | null; id: string | null }>) => {
        // each section of the Settings page is an entry of the history (#322)
        this._settingsAt = { section: e.detail.section, id: e.detail.id };
        navPage(this.pageNow());
      }}
    ></fp3d-settings-page>`);
  }

  private versionsMemo: { frontend: string; backend: string | null } | undefined;

  /** The versions for Settings › Advanced › About (#248), the same object while they stay the same. */
  private versions(): { frontend: string; backend: string | null } {
    const frontend = String(this.data.frontendVersion);
    const backend = this.data.backendVersion ?? null;
    if (this.versionsMemo?.frontend !== frontend || this.versionsMemo.backend !== backend) this.versionsMemo = { frontend, backend };
    return this.versionsMemo;
  }

  /** The main texts for the Settings page's bundle (it has no table of its own beyond its new texts). */
  private readonly translator = (key: string, vars?: Record<string, string | number>) => translate(this.hass, key as I18nKey, vars);

  private renderEditor(b: Building) {
    // the library (#44) is only loaded for the editor and the extensions page
    void this.data.loadLibrary();
    const pending = this.editorPending();
    if (pending) return pending;
    return html`<fp3d-editor
      class="fp3d-body"
      .hass=${this.rawHass}
      .canEdit=${this.data.canEdit}
      .home=${this.data.homeId}
      .homeName=${this.data.homeName}
      .history=${this.undoHistory}
      .building=${b}
      .narrow=${this.narrow}
      .packs=${this.data.packs}
      @packs-changed=${() => void this.data.reloadPacks()}
      @director-here=${() => (this._director = directorOnHere())}
      @voice-here=${() => {
        this._voiceHere = voiceOnHere();
        this._screen = screenName();
      }}
      @mic-probe=${() => loadVoice().then(() => (this._micProbe = true)).catch(() => undefined)}
      @open-extensions=${() => this.setMode("extensions")}
      @load-sample=${() => void this.loadSample()}
      @building-changed=${(e: CustomEvent<{ building: Building }>) => this.data.edit(e.detail.building)}
    ></fp3d-editor>`;
  }

  /** A single-row bar scrolls sideways with the mouse wheel (a desktop has no swipe). */
  /** Focus goes on to the room panel once the room is chosen, not back to the page (#259, V19). */
  private async focusRoomPanel(): Promise<void> {
    await this.updateComplete;
    await customElements.whenDefined("fp3d-room-panel");
    await (this.renderRoot.querySelector("fp3d-room-panel") as (HTMLElement & { focusHeading?: () => Promise<void> }) | null)?.focusHeading?.();
  }

  /**
   * A floors row wider than its room fades out at the end(s) with more chips (#259, V12/ND-11): a chip half under the
   * Rooms button reads as "scroll for more", not as a floor called "G". Written straight onto the row, no re-render.
   */
  private navFrame = 0;
  private navScroll = false;

  private readonly markNavEdges = () => {
    const row = this.renderRoot?.querySelector<HTMLElement>(".fp3d-floors");
    if (!row) return;
    const more = navEdges(row.scrollLeft, row.scrollWidth, row.clientWidth);
    row.toggleAttribute("data-more-start", more.start);
    row.toggleAttribute("data-more-end", more.end);
  };

  private readonly onNavWheel = (e: WheelEvent) => {
    if (!e.deltaY || e.deltaX) return;
    const nav = e.currentTarget as HTMLElement;
    if (nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft += e.deltaY;
    e.preventDefault();
  };

  /**
   * The floor bar (#249, option B of #219): the floors in one row ("Whole house" first, the top floor next), scrolling
   * sideways where it is too long, and one Rooms picker instead of a chip per room, so the bar never wraps. The picker
   * lists the picked floor's rooms, or every floor's under the whole house. Wall tablets get the floors only, as before.
   */
  private renderFloorBar(b: Building, floor: Floor | undefined) {
    const many = b.floors.length > 1;
    const pickFloor = (id: string | null) => {
      this._floorId = id;
      this._roomId = null;
      this._roomsOpen = false;
    };
    const room = this._roomId ? b.floors.flatMap((f) => zonesOf(f)).find((r) => r.id === this._roomId) : undefined;
    return html`<nav class="fp3d-nav" aria-label=${this.t("floors")}>
      ${many
        ? html`<div class="fp3d-seg fp3d-floors" role="group" aria-label=${this.t("floors")} @wheel=${this.onNavWheel} @scroll=${this.markNavEdges}>
            <button aria-pressed=${this._floorId === null} @click=${() => pickFloor(null)}>${this.t("all_floors")}</button>
            ${[...b.floors].reverse().map((f) => html`<button aria-pressed=${f.id === this._floorId} @click=${() => pickFloor(f.id)}>${f.name}</button>`)}
          </div>
          <label class="fp3d-floor-pick ${this._floorId ? "fp3d-floor-on" : ""}">
            <select aria-label=${this.t("floors")} @change=${(e: Event) => pickFloor((e.target as HTMLSelectElement).value || null)}>
              <option value="" ?selected=${this._floorId === null}>${this.t("all_floors")}</option>
              ${[...b.floors].reverse().map((f) => html`<option value=${f.id} ?selected=${f.id === this._floorId}>${f.name}</option>`)}
            </select>
            ${uiIcon("down")}
          </label>`
        : nothing}
      ${this._tablet
        ? nothing
        : html`${many ? html`<span class="fp3d-sep"></span>` : nothing}
            <div class="fp3d-rooms">
              <button
                class="fp3d-chip fp3d-rooms-btn ${room ? "fp3d-rooms-on" : ""}"
                aria-haspopup="dialog"
                aria-expanded=${this._roomsOpen}
                aria-label=${room ? this.t("rooms_open", { room: room.name }) : this.t("rooms")}
                @pointerenter=${() => need(loadRoomsPicker)}
                @focus=${() => need(loadRoomsPicker)}
                @click=${() => (this._roomsOpen = !this._roomsOpen)}
              >
                ${room?.name ?? this.t("rooms")} ${uiIcon("down")}
              </button>
              ${this._roomsOpen
                ? (need(loadRoomsPicker),
                  html`<fp3d-rooms-picker
                    .groups=${this.roomGroups(b, floor)}
                    .selected=${this._roomId}
                    .t=${this.translator}
                    .editFloor=${floor && this.canEdit ? floor.id : null}
                    .canHide=${this.canEdit}
                    @room-hide=${(e: CustomEvent<{ roomId: string; hide: boolean }>) => this.hideRoom(e.detail.roomId, e.detail.hide)}
                    @room-pick=${(e: CustomEvent<{ floorId: string; roomId: string }>) => {
                      if (many) this._floorId = e.detail.floorId;
                      this._roomId = e.detail.roomId;
                      this._shutRoom = null;
                      this._roomsOpen = false;
                      void this.focusRoomPanel();
                    }}
                    @edit-floor=${(e: CustomEvent<{ floorId: string }>) => this.openInEditor(e.detail.floorId, null)}
                    @picker-close=${(e: CustomEvent<{ focus?: boolean } | null>) => this.closeRooms(!!e.detail?.focus)}
                  ></fp3d-rooms-picker>`)
                : nothing}
            </div>`}
      ${this.renderFindBar(b)}
    </nav>`;
  }

  /**
   * The search at the bar's right end (#305): a magnifier that opens the field, the results dropping under it (a phone: the field
   * covers the row). The field is a chunk of its own; a pick flies the 3D view to the result like the old floating search did.
   */
  private renderFindBar(b: Building) {
    const open = this._findOpen;
    const close = () => {
      this._findOpen = false;
      void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(".fp3d-find-toggle")?.focus());
    };
    return html`<button
        class="fp3d-chip fp3d-find-toggle ${open ? "fp3d-rooms-on" : ""}"
        title=${this.t("find")}
        aria-label=${this.t("find")}
        aria-expanded=${open}
        @pointerenter=${() => need(loadFind)}
        @click=${() => (open ? close() : (this._findOpen = true))}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
      </button>
      ${open
        ? (need(loadFind),
          html`<fp3d-find
            variant="bar"
            .hass=${this.shownHass}
            .building=${b}
            @find-close=${close}
            @find-pick=${(e: CustomEvent<SearchItem>) => {
              this._findOpen = false;
              this.renderRoot.querySelector<HTMLElement & { goTo(item: SearchItem): void }>("fp3d-view3d")?.goTo(e.detail);
            }}
          ></fp3d-find>`)
        : nothing}`;
  }

  /** An editor hides a room from the selector, or brings it back (#298); the room stays drawn. Saved like any plan change. */
  private hideRoom(roomId: string, hide: boolean): void {
    this.updatePlan((b) => {
      for (const f of b.floors) for (const r of f.rooms) if (r.id === roomId) hide ? (r.hide_in_picker = true) : delete r.hide_in_picker;
    });
  }

  private roomGroupsMemo: { b: Building; floor: Floor | undefined; groups: RoomGroup[] } | null = null;

  /**
   * The Rooms picker's list: the picked floor's rooms, else every floor's (top floor first). A room without a name is
   * left out (#370); the outdoor areas acting as rooms follow the rooms (#100), several areas of one garden with the same
   * area and name as one line.
   */
  private roomGroups(b: Building, floor: Floor | undefined): RoomGroup[] {
    const m = this.roomGroupsMemo;
    if (m && m.b === b && m.floor === floor) return m.groups;
    const floors = floor ? [floor] : [...b.floors].reverse();
    const groups = floors
      .map((f) => ({
        id: f.id,
        name: f.name,
        rooms: zonesOf(f)
          .filter((r, i, all) => r.name.trim() && !(r.outdoor && all.findIndex((x) => x.outdoor && x.area_id === r.area_id && x.name === r.name) < i))
          .map((r) => ({ id: r.id, name: r.name, hidden: r.hide_in_picker === true })),
      }))
      .filter((g) => g.rooms.length);
    this.roomGroupsMemo = { b, floor, groups };
    return groups;
  }

  /** Closes the Rooms picker; from the keyboard (Escape) the focus goes back to its button. */
  private closeRooms(focus: boolean): void {
    this._roomsOpen = false;
    if (focus) void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(".fp3d-rooms-btn")?.focus());
  }

  /**
   * "Edit room" and "Edit floor" (#249) from the room panel and the Rooms picker: the editor opens on that floor with the
   * room chosen (it used to take about five taps and lost the place). Replaces the editor's old ⚙ menu as the way in.
   */
  private openInEditor(floorId: string | null, roomId: string | null): void {
    if (!this.canEdit || this._tablet) return;
    this._roomsOpen = false;
    this.setMode("editor");
    void loadEditor().then(async () => {
      this._editorReady = true;
      await this.updateComplete;
      const ed = this.renderRoot.querySelector<HTMLElement & { goToRoom(floor: string | null, room: string | null): boolean; updateComplete: Promise<unknown> }>("fp3d-editor");
      await ed?.updateComplete;
      ed?.goToRoom(floorId, roomId);
    }, () => undefined);
  }

  private renderView(b: Building) {
    if (!b.floors.length || !b.floors.some((f) => f.rooms.length)) {
      return html`<div class="fp3d-empty">
        <p>${this.t(this.canEdit ? "no_building_admin" : "no_building")}</p>
        ${this.canEdit
          ? html`<button class="fp3d-btn fp3d-primary" @click=${() => this.setMode("editor")}>${this.t("open_editor")}</button>
              <button class="fp3d-btn" @click=${() => void this.loadSample()}>${this.t("home_sample")}</button>
              <p class="fp3d-phone-only">${this.t("phone_hint")}</p>`
          : nothing}
      </div>`;
    }
    const floor = b.floors.find((f) => f.id === this._floorId);
    const tt = this.tt.active;
    // a sample / demo home: devices this Home Assistant lacks show fixed demo states (#100)
    const hass = this.viewHass(this.rawHass!, b);
    this.shownHass = hass;
    // 3D or the 2D plan: beside the View menu, inside it on a tablet (#92)
    const planView = html`<div class="fp3d-seg" role="group" aria-label=${this.t("plan_view")}>
      <button aria-pressed=${!this._plan2d} @click=${() => this.setPlan2d(false)}>${this.t("view_3d")}</button>
      <button aria-pressed=${this._plan2d} @click=${() => this.setPlan2d(true)}>${this.t("view_2d")}</button>
    </div>`;
    return html`
      ${this._clean || (this._tablet && b.floors.length < 2) ? nothing : this.renderFloorBar(b, floor)}
      <div class="fp3d-stage-wrap ${this.roomPanelShown ? "fp3d-room-open" : ""} ${this._controlsRight ? "fp3d-side-right" : ""} ${tt ? "fp3d-tt" : ""} ${this._cameraWall && !tt ? "fp3d-cams-open" : ""}">
        <!-- the floor bar picks the floor: the floor pictures beside the 3D view are a second picker, shown when Settings
             › Screen and controls says so (#249, #250; the card keeps its own switch) -->
        <fp3d-view3d
          class="fp3d-body"
          .findInBar=${!(this._clean || (this._tablet && b.floors.length < 2))}
          .canEdit=${this.data.canEdit && !this._tablet}
          .noSettings=${this._tablet}
          .home=${this.data.homeId}
          .hass=${hass}
          .replay=${this.tt.session?.replay ?? null}
          .building=${b}
          .packs=${this.data.packs}
          .plan2d=${this._plan2d}
          .floorThumbs=${this._floorPics}
          .floorStack=${this._floorStack}
          .roomLabels=${this._roomNames}
          .hiddenTypes=${this._hidden}
          .furnitureOn=${this._furnitureOn}
          .pulse=${this._pulse}
          .controlsRight=${this._controlsRight}
          .keepView=${this._keepView}
          .angleLock=${this._angleLock}
          .windowSpill=${this._windowSpill}
          .sunHeight=${this._sunHeight}
          .navButtons=${this._navButtons}
          ?trail=${this._trail}
          .cameraWall=${this._cameraWall && !tt}
          @camera-wall-close=${() => (this._cameraWall = false)}
          @camera-wall-open=${() => (this._cameraWall = true)}
          .clean=${this._clean}
          .cleanButton=${true}
          @clean-toggle=${() => {
            this._clean = !this._clean;
            prefs.set("clean", this._clean ? "1" : "0");
            // the Rooms list and the search close with the bar they hang from, so they do not come back open (#317)
            if (this._clean) this._roomsOpen = this._findOpen = false;
          }}
          .weather=${this._weather}
          .flows=${this._flows}
          .holograms=${this._holos}
          .doorPins=${this._doorPins}
          .vacuumMaps=${this._vacuumMaps}
          .director=${this._director}
          .voice=${this._voiceHere}
          .screen=${this._screen || null}
          .panelOpen=${this.roomPanelShown}
          .floorId=${b.floors.length > 1 ? this._floorId : (b.floors[0]?.id ?? null)}
          .roomId=${this._roomId}
          .wallMode=${this._wallMode}
          .explode=${this._explode}
          .keepRoof=${this._keepRoof}
          .markerMode=${this._markers}
          .pinSize=${this._pinSize}
          .heatMode=${this._heat}
          .theme=${this._theme}
          .clock=${this._clock}
          .clockLook=${this._clockLook}
          .clockWeather=${this._clockWeather}
          .accent=${this.shownAccent()}
          ?furnish=${this._furnish && !tt}
          .selectedFurniture=${this._selFurniture}
          @furniture-select=${(e: CustomEvent<{ id: string | null }>) => (this._selFurniture = e.detail.id)}
          @furniture-move=${this.moveFurniture}
          @device-select=${(e: CustomEvent<{ id: string | null }>) => (this._selDevice = e.detail.id)}
          @device-move=${this.moveDevice}
          .quality=${this._quality}
          ?showStats=${this._stats}
          @room-tap=${this.onRoomTap}
          @open-extensions=${() => this.setMode("extensions")}
          @floor-tap=${(e: CustomEvent<{ floorId: string | null }>) => {
            this._floorId = e.detail.floorId;
            this._roomId = null;
          }}
          @back=${() => this.back()}
          @plan-change=${this.onPlanChange}
        ></fp3d-view3d>
        ${this.roomPanelShown
          ? (need(loadRoomPanel), html`<fp3d-room-panel
              class="fp3d-room-panel"
              @camera-look=${(e: CustomEvent<{ entity: string }>) => this.view3d()?.lookThrough(e.detail.entity)}
              .hass=${hass}
              ?readOnly=${tt}
              ?noLook=${this._plan2d}
              ?canEdit=${this.canEdit && !this._tablet}
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
        ${this.tt.session ? html`<fp3d-time-bar .session=${this.tt.session} ?demo=${showsDemo(hass)}></fp3d-time-bar>` : nothing}
        ${showsDemo(hass) && !this.tt.session ? html`<div class="fp3d-demo-chip" title=${this.t("demo_hint")}>${this.t("demo_chip")}</div>` : nothing}
        ${this._clean ? nothing : html`<div class="fp3d-overlay">
          ${this._tablet ? nothing : planView}
          ${this._tablet
            ? nothing
            : html`<button class="fp3d-chip fp3d-plan-toggle" title=${this.t("plan_view")} aria-label=${`${this.t("plan_view")}: ${this.t(this._plan2d ? "view_3d" : "view_2d")}`} @click=${() => this.setPlan2d(!this._plan2d)}>
                ${this.t(this._plan2d ? "view_3d" : "view_2d")}
              </button>`}
          <button
            class="fp3d-chip fp3d-view-btn"
            aria-haspopup="dialog"
            aria-expanded=${this._viewOpen}
            aria-controls="fp3d-view-panel"
            aria-label=${this.t("view_btn")}
            @pointerenter=${() => need(loadViewPanel)}
            @focus=${() => need(loadViewPanel)}
            @click=${() => this.setViewOpen(!this._viewOpen)}
          >
            <span class="fp3d-bar-icon">${uiIcon("sliders")}</span><span class="fp3d-bar-word">${this.t("view_btn")}</span> <span class="fp3d-caret" aria-hidden="true">${this._viewOpen ? "▴" : "▾"}</span>
          </button>
          ${!tt && this.hasCameras(b)
            ? html`<button class="fp3d-chip fp3d-cam-btn" aria-pressed=${this._cameraWall} aria-label=${this.t("cameras_short")} title=${this.t("camera_wall_hint")} @click=${() => (this._cameraWall = !this._cameraWall)}>
                <span class="fp3d-bar-icon">${uiIcon("camera")}</span><span class="fp3d-bar-word">${this.t("cameras_short")}</span>
              </button>`
            : nothing}
          ${this._tablet ? nothing : html`<button class="fp3d-chip fp3d-tt-chip" aria-pressed=${tt} title=${this.t("tt_hint")} aria-label=${this.t("tt_chip")} @click=${() => this.toggleTimeTravel()}>
            ⏪ <span class="fp3d-tt-label">${this.t("tt_chip")}</span>
          </button>`}
          ${this._roomId || (this._floorId && b.floors.length > 1)
            ? html`<button class="fp3d-chip fp3d-back-btn" aria-label=${this.t("back")} @click=${() => this.back()}><span class="fp3d-bar-icon">${uiIcon("back")}</span><span class="fp3d-bar-word">${this.t("back")}</span></button>`
            : nothing}
        </div>`}
        ${this._viewOpen && !this._clean
          ? (need(loadViewPanel), html`<fp3d-view-panel
              id="fp3d-view-panel"
              .hass=${this.rawHass}
              .context=${this.viewContext(b)}
              @view-change=${this.onViewChange}
              @styles-open=${() => (this.setViewOpen(false), (this._stylesOpen = true))}
              @view-close=${(e: CustomEvent<{ outside?: boolean } | null>) => this.setViewOpen(false, !e.detail?.outside)}
              >${this._tablet ? planView : nothing}</fp3d-view-panel
            >`)
          : nothing}
        ${this._stylesOpen && !this._clean && this._mode === "view"
          ? (need(loadStylesDialog),
            html`<fp3d-styles-dialog
              .hass=${this.rawHass}
              .styles=${b.settings.styles_custom}
              .canEdit=${this.canEdit}
              .current=${shownStyle(this._theme, this.hass, b.settings as StylePlan | undefined)}
              @view-change=${this.onViewChange}
              @styles-preview=${(e: CustomEvent<{ style: unknown }>) => (this.view3d() as (HTMLElement & { previewStyle?(s: unknown): void }) | null)?.previewStyle?.(e.detail.style)}
              @styles-change=${(e: CustomEvent<{ styles: CustomStyle[] }>) => this.editPlan({ ...b, settings: { ...b.settings, styles_custom: e.detail.styles.length ? e.detail.styles : null } }, "styles_custom")}
              @styles-close=${() => this.setStylesOpen(false)}
            ></fp3d-styles-dialog>`)
          : nothing}
        ${this._furnish
          ? html`<div class="fp3d-furnish-bar">
              ${this._selFurniture
                ? html`<span>${this.furnitureName(this._selFurniture)}</span>
                    ${this.renderSizeFields(this._selFurniture)}
                    <button class="fp3d-chip" @click=${() => this.turnFurniture(-45)}>↺ 45°</button>
                    <button class="fp3d-chip" @click=${() => this.turnFurniture(45)}>↻ 45°</button>
                    <button class="fp3d-chip" title=${this.t("furn_mirror_hint")} @click=${() => this.editFurniture(this._selFurniture!, (f) => (f.mirror = !f.mirror))}>⇋ ${this.t("furn_mirror")}</button>
                    <button class="fp3d-chip fp3d-danger-chip" @click=${() => this.deleteFurniture()}>${this.t("delete")}</button>`
                : this._selDevice
                  ? html`<span>${entityName(this.hass, this._selDevice)}</span>
                      ${this.renderDeviceFields(this._selDevice)}
                      <button class="fp3d-chip" @click=${() => this.turnDevice(-this.turnStep())}>↺ ${this.turnStep()}°</button>
                      <button class="fp3d-chip" @click=${() => this.turnDevice(this.turnStep())}>↻ ${this.turnStep()}°</button>
                      <button class="fp3d-chip fp3d-danger-chip" @click=${() => this.deleteDevice()}>${this.t("delete")}</button>`
                  : html`<span>${this.t("furnish_hint")}</span>`}
              <button class="fp3d-chip fp3d-chip-on" @click=${() => ((this._furnish = false), (this._selFurniture = null), (this._selDevice = null))}>${this.t("done")}</button>
            </div>`
          : nothing}
      </div>
    `;
  }

  static styles = [
    tokens,
    controls,
    css`
      .fp3d-badge {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 8px;
        border-radius: 999px;
        background: #ffb547;
        color: #1a1204;
        font-size: 0.78em;
        font-weight: 700;
        line-height: 1.5;
        box-shadow: 0 0 10px rgba(255, 181, 71, 0.7);
        vertical-align: middle;
        white-space: nowrap;
        animation: fp3d-badge-in 1.6s ease-out 2;
      }
      @keyframes fp3d-badge-in {
        0% {
          box-shadow: 0 0 0 0 rgba(255, 181, 71, 0.9);
        }
        100% {
          box-shadow: 0 0 0 10px rgba(255, 181, 71, 0);
        }
      }
      :host {
        display: block;
        /* HA gives the custom panel's parent no explicit height, so 100% collapses. The parent may pad itself by the
           screen's safe areas (notches; some themes set them on every screen): those are taken off, or the panel is
           taller than the window and its bottom is cut off (#529). */
        height: calc(100vh - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px));
        background: var(--fp3d-bg);
      }
      /* dvh only where the browser knows it: a line with var() is not dropped while it is read, so a WebView without
         dvh (Chrome before 108, the Fire 7) lost the height altogether and the 3D view stayed empty (idea: CasaNeon) */
      @supports (height: 100dvh) {
        :host {
          height: calc(100dvh - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px));
        }
      }
      .fp3d-app {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      /* one header row (#249): 56 px, nothing wraps; the tabs reach its foot for their underline */
      .fp3d-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 12px 0 4px;
        height: 56px;
        box-sizing: border-box;
        border-bottom: 1px solid var(--fp3d-line);
        background: var(--fp3d-chrome-solid);
        flex: none;
        min-width: 0;
      }
      .fp3d-tablet-head {
        padding-left: 14px;
      }
      fp3d-home-switcher {
        flex: 0 1 auto;
        min-width: 0;
      }
      /* the tabs are navigation (aria-current), so they are underlined, not filled like a choice (#219) */
      .fp3d-tabs {
        display: flex;
        align-self: stretch;
        gap: 2px;
        flex: none;
      }
      .fp3d-tab {
        font: inherit;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 3px 12px 0;
        min-width: 44px;
        justify-content: center;
        border: none;
        border-bottom: 3px solid transparent;
        background: none;
        color: var(--fp3d-muted);
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
      }
      .fp3d-tab:hover {
        color: var(--fp3d-text);
      }
      .fp3d-tab[aria-current="page"] {
        color: var(--fp3d-text);
        border-bottom-color: var(--fp3d-accent);
      }
      .fp3d-tab[aria-current="page"] .fp3d-ui-icon {
        color: var(--fp3d-accent);
      }
      .fp3d-tab:focus-visible {
        outline-offset: -2px;
      }
      .fp3d-tab-short {
        display: none;
      }
      /* the save line (#249): who it saved for, a dot before it; a notice is a badge beside it */
      .fp3d-save {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        min-width: 0;
      }
      .fp3d-save-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--fp3d-ok, #4ade80);
        flex: none;
      }
      .fp3d-save-saving .fp3d-save-dot {
        background: var(--fp3d-muted);
      }
      .fp3d-save-error .fp3d-save-dot {
        background: var(--fp3d-danger);
      }
      .fp3d-note-badge {
        font: inherit;
        flex: none;
        display: inline-grid;
        place-items: center;
        min-width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
      }
      .fp3d-note-badge span {
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        box-sizing: border-box;
        border-radius: 999px;
        background: #ffb547;
        color: #1a1204;
        font-size: 12px;
        font-weight: 800;
        line-height: 22px;
        text-align: center;
      }
      ha-menu-button {
        color: var(--fp3d-text);
      }
      h1 {
        font-family: var(--fp3d-title-font);
        font-weight: 700;
        font-size: 19px;
        letter-spacing: -0.01em;
        margin: 0 4px 0 8px;
        white-space: nowrap;
      }
      /* notices in a strip of their own under the header (#258, were pop-ups over the page, #249): they cover no
         control; the plan and the 3D view below only get shorter */
      .fp3d-notices {
        flex: none;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 6px 12px;
        border-bottom: 1px solid var(--fp3d-line);
        background: var(--fp3d-chrome-solid);
      }
      .fp3d-notices-list {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 6px;
      }
      .fp3d-notices-hide {
        flex: none;
      }
      /* inside the strip a notice is a line of text and its buttons: the strip is its frame */
      .fp3d-notices .fp3d-notice {
        flex-wrap: nowrap;
        padding: 0 0 0 10px;
        border: 0;
        border-left: 3px solid var(--fp3d-line);
        border-radius: 0;
        background: none;
      }
      .fp3d-notices .fp3d-notice span {
        min-width: 0;
      }
      .fp3d-notices .fp3d-notice-warn {
        border-left-color: rgba(255, 181, 71, 0.8);
      }
      .fp3d-notices .fp3d-notice-error {
        border-left-color: rgba(255, 107, 139, 0.8);
      }
      .fp3d-notice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        padding: 9px 12px;
        border-radius: 10px;
        border: 1px solid var(--fp3d-line);
        background: var(--fp3d-chrome-solid);
        font-size: 13.5px;
      }
      .fp3d-notice span {
        flex: 1;
        min-width: 200px;
      }
      .fp3d-notice-warn {
        border-color: rgba(255, 181, 71, 0.6);
        color: var(--fp3d-warm);
      }
      .fp3d-notice-error {
        border-color: rgba(255, 107, 139, 0.6);
        color: var(--fp3d-danger);
        word-break: break-word;
      }
      .fp3d-chip-on {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
      }
      .fp3d-furnish-bar {
        position: absolute;
        left: 50%;
        bottom: 16px;
        transform: translateX(-50%);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        max-width: calc(100% - 24px);
        padding: 8px 10px 8px 16px;
        border-radius: 999px;
        background: var(--fp3d-chrome);
        box-shadow: var(--fp3d-shadow);
        font-size: 13.5px;
      }
      .fp3d-size-select {
        font: inherit;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        padding: 4px 10px;
      }
      .fp3d-size {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .fp3d-size input {
        width: 58px;
        padding: 5px 6px;
        border: 1px solid rgba(127, 127, 127, 0.35);
        border-radius: 8px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 13px;
      }
      .fp3d-danger-chip {
        color: var(--fp3d-danger);
      }
      .fp3d-grow {
        flex: 1;
      }
      .fp3d-save {
        font-size: 12.5px;
        color: var(--fp3d-muted);
      }
      /* compact (#246 size classes): no title, the home's name alone, a short save line */
      @media (max-width: ${unsafeCSS(String(COMPACT_MAX_PX))}px) {
        .fp3d-header {
          gap: 8px;
          padding-right: 8px;
        }
        .fp3d-header h1 {
          display: none;
        }
        .fp3d-tab {
          padding-left: 9px;
          padding-right: 9px;
        }
        .fp3d-tab .fp3d-ui-icon {
          display: none;
        }
        .fp3d-save-text {
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
      /* phones (#249): one 52 px row: "3D" and "Edit" as words, Extensions and Settings as named icons (the open one
         shows its word), the save line a dot */
      @media ${unsafeCSS(PHONE_MEDIA)} {
        .fp3d-header {
          height: 52px;
          gap: 2px;
          padding: 0 4px 0 0;
        }
        .fp3d-tab {
          padding-left: 8px;
          padding-right: 8px;
          gap: 5px;
        }
        .fp3d-tab .fp3d-ui-icon {
          display: inline;
        }
        .fp3d-tab-view .fp3d-ui-icon,
        .fp3d-tab-editor .fp3d-ui-icon,
        .fp3d-tab-editor .fp3d-tab-word,
        .fp3d-tab-ext:not([aria-current]) .fp3d-tab-word,
        .fp3d-tab-settings:not([aria-current]) .fp3d-tab-word {
          display: none;
        }
        .fp3d-tab-editor .fp3d-tab-short {
          display: inline;
        }
        .fp3d-save-text {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }
        .fp3d-notices {
          padding: 6px 8px;
        }
      }
      .fp3d-save-error {
        color: var(--fp3d-danger);
      }
      .fp3d-body {
        flex: 1;
        min-height: 0;
      }
      /* the floor bar (#249): the floors in one row that scrolls sideways, then the Rooms picker; it never wraps */
      .fp3d-nav {
        position: relative;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        min-height: 50px;
        box-sizing: border-box;
        flex: none;
        min-width: 0;
        border-bottom: 1px solid var(--fp3d-line);
        background: var(--fp3d-chrome-solid);
      }
      .fp3d-floors {
        flex: 0 1 auto;
        min-width: 0;
        overflow-x: auto;
        scrollbar-width: none;
        box-shadow: none;
      }
      /* a desktop keeps the thin scrollbar's room all the time (an invisible thumb) and only colours it on hover, so the
         row does not grow and the 3D view below does not jump (#451); touch screens keep their overlay scrollbars */
      @media (hover: hover) and (pointer: fine) {
        .fp3d-floors {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
          padding-bottom: 3px;
        }
        .fp3d-floors:hover {
          scrollbar-color: color-mix(in srgb, var(--fp3d-text) 35%, transparent) transparent;
        }
      }
      @media not all and (hover: hover) and (pointer: fine) {
        .fp3d-floors:hover {
          scrollbar-width: thin;
        }
      }
      /* more chips past an edge: that edge fades out; the chosen chip scrolls clear of the fade (#259) */
      .fp3d-floors {
        scroll-padding-inline: 28px;
      }
      .fp3d-floors[data-more-end] {
        mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);
      }
      .fp3d-floors[data-more-start] {
        mask-image: linear-gradient(to left, #000 calc(100% - 28px), transparent);
      }
      .fp3d-floors[data-more-start][data-more-end] {
        mask-image: linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent);
      }
      .fp3d-floors > button {
        flex: none;
      }
      /* phones (#346): the floor as a dropdown instead of a row of chips cut off at the edge */
      .fp3d-floor-pick {
        display: none;
        position: relative;
        flex: 0 1 auto;
        min-width: 0;
      }
      .fp3d-floor-pick select {
        appearance: none;
        width: 100%;
        max-width: 14em;
        min-height: 44px;
        padding: 0 34px 0 14px;
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        font: inherit;
        font-weight: 500;
        text-overflow: ellipsis;
        cursor: pointer;
      }
      .fp3d-floor-pick option {
        background: var(--fp3d-chrome-solid);
        color: var(--fp3d-text);
      }
      .fp3d-floor-on select {
        color: var(--fp3d-accent);
        border-color: var(--fp3d-accent);
      }
      .fp3d-floor-pick svg {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: var(--fp3d-muted);
      }
      .fp3d-rooms {
        position: relative;
        flex: none;
      }
      .fp3d-nav .fp3d-chip {
        box-shadow: none;
        border: 1px solid var(--fp3d-line);
      }
      .fp3d-rooms-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-width: 14em;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp3d-rooms-on,
      .fp3d-rooms-btn[aria-expanded="true"] {
        color: var(--fp3d-accent);
        border-color: var(--fp3d-accent) !important;
      }
      .fp3d-find-toggle {
        flex: none;
        margin-left: auto;
        display: inline-grid;
        place-items: center;
        min-width: 36px;
      }
      .fp3d-find-toggle[aria-expanded="true"] {
        border-color: var(--fp3d-accent) !important;
      }
      .fp3d-sep {
        flex: none;
        width: 1px;
        margin: 4px 4px;
        background: var(--fp3d-line);
      }
      .fp3d-demo-chip {
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 3;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 11px;
        letter-spacing: 0.04em;
        color: var(--fp3d-s-text, #e8f4ff);
        background: var(--fp3d-s-chrome, rgba(10, 20, 35, 0.72));
        border: 1px solid var(--fp3d-s-line, rgba(120, 200, 255, 0.35));
        pointer-events: auto;
        cursor: help;
      }
      .fp3d-stage-wrap {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        container-type: size;
        container-name: fp3d;
      }
      .fp3d-stage-wrap fp3d-view3d {
        flex: 1;
      }
      .fp3d-room-panel {
        position: absolute;
        top: 58px;
        right: 14px;
        bottom: 14px;
        width: min(360px, calc(100% - 28px));
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        pointer-events: none;
        /* over the view's passive overlays, the clock among them (#313) */
        z-index: 2;
      }
      /* the switches sit at the bottom (as in the card), where they never meet the energy values or warnings */
      fp3d-view3d {
        --fp3d-bottom-inset: 52px;
      }
      .fp3d-clean fp3d-view3d {
        --fp3d-bottom-inset: 0px;
      }
      /* the floor bar goes with the other controls (#317) */
      .fp3d-clean .fp3d-nav {
        display: none;
      }
      .fp3d-furnish-bar {
        bottom: 68px;
      }
      /* time travel: its bar at the bottom; the switches, the buttons of the view and the room panel above it */
      .fp3d-tt > * {
        --fp3d-tt-h: 64px;
      }
      .fp3d-tt fp3d-view3d {
        --fp3d-bottom-inset: calc(52px + var(--fp3d-tt-h));
      }
      .fp3d-tt .fp3d-overlay {
        bottom: calc(var(--fp3d-tt-h) + 4px);
      }
      .fp3d-tt .fp3d-room-panel {
        bottom: calc(var(--fp3d-tt-h) + 6px);
      }
      .fp3d-tt-chip[aria-pressed="true"] {
        background: #ffb020;
        color: #1a1200;
      }
      /* phones and portrait tablets: panel as a sheet at the bottom, the switches step aside */
      @container fp3d ((max-width: 700px) or ((orientation: portrait) and (max-width: 1000px))) {
        .fp3d-room-panel {
          top: auto;
          left: 8px;
          right: 8px;
          bottom: 8px;
          width: auto;
          /* dragged taller or shorter by its grab bar (#353) */
          height: var(--fp3d-sheet-h, 55%);
          justify-content: flex-end;
        }
        .fp3d-room-open .fp3d-overlay,
        .fp3d-room-open fp3d-view-panel {
          display: none;
        }
        /* the view's own buttons (search, eye) step up above the sheet */
        .fp3d-room-open fp3d-view3d {
          --fp3d-bottom-inset: calc(var(--fp3d-sheet-h, 55%) + 8px);
        }
        /* phones: the time bar takes two rows (its height here, the safe area included); the switches, the time
           travel chip among them, stay on the screen above it (#257) */
        .fp3d-tt > * {
          --fp3d-tt-h: calc(120px + env(safe-area-inset-bottom, 0px));
        }
        @media (pointer: coarse) {
          .fp3d-tt > * {
            --fp3d-tt-h: calc(138px + env(safe-area-inset-bottom, 0px));
          }
        }
      }
      /* search and eye on the right (#285): the bar leaves room there instead */
      .fp3d-side-right .fp3d-overlay {
        left: 12px;
        right: 100px;
      }
      /* an open room panel and the View panel side by side where the stage is not wide enough to centre it (#247) */
      @container fp3d (max-width: 1180px) {
        .fp3d-room-open fp3d-view-panel {
          left: 12px;
          transform: none;
        }
      }
      /* an open room panel keeps the switches beside it, not over its last rows */
      .fp3d-room-open .fp3d-overlay {
        right: calc(min(360px, 100% - 28px) + 26px);
      }
      .fp3d-overlay {
        position: absolute;
        right: 12px;
        bottom: 12px;
        /* room for the search button and the eye beside it */
        left: 100px;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        align-items: center;
        pointer-events: none;
      }
      .fp3d-overlay > * {
        pointer-events: auto;
      }
      /* the View button opens the View panel (#247, components/view-panel.ts) above the bar; an open View panel marks it */
      /* open: the shared pressed fill with its dark text (#314); the accent colour on that fill hid the label */
      .fp3d-cam-btn[aria-pressed="true"] {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
      }
      .fp3d-view-btn[aria-expanded="true"] {
        color: var(--fp3d-accent);
        box-shadow: inset 0 0 0 1px var(--fp3d-accent), var(--fp3d-shadow);
      }
      /* the time bar is under the bar: the panel goes up with it */
      .fp3d-tt fp3d-view-panel {
        bottom: calc(var(--fp3d-tt-h) + 64px);
      }
      .fp3d-caret {
        font-size: 0.8em;
        opacity: 0.7;
      }
      /* the phone bar's symbols and its one 3D/2D button (#346); wider screens show the words and the segment */
      .fp3d-bar-icon,
      .fp3d-plan-toggle {
        display: none;
      }
      .fp3d-message,
      .fp3d-empty {
        padding: 32px 20px;
        color: var(--fp3d-muted);
        text-align: center;
      }
      .fp3d-phone-only {
        display: none;
      }
      @media (max-width: 600px) {
        .fp3d-phone-only {
          display: block;
        }
      }
      .fp3d-empty {
        display: grid;
        justify-items: center;
        gap: 12px;
        margin: auto;
      }
      /* phones (#93): the bottom bar keeps one row (time travel as its symbol); touch targets 44 px */
      @media ${unsafeCSS(PHONE_MEDIA)} {
        .fp3d-header {
          position: relative;
        }
        .fp3d-tt-label {
          display: none;
        }
        .fp3d-nav {
          position: relative;
          padding: 4px 8px;
        }
        .fp3d-nav .fp3d-floors {
          display: none;
        }
        .fp3d-floor-pick {
          display: block;
        }
        /* the Rooms picker opens from the bar's left edge, so it stays on the screen */
        .fp3d-rooms {
          position: static;
        }
        fp3d-rooms-picker {
          left: 8px;
        }
        .fp3d-tab,
        .fp3d-overlay .fp3d-chip,
        .fp3d-overlay .fp3d-seg button,
        fp3d-view-panel .fp3d-seg button,
        .fp3d-nav .fp3d-chip {
          min-height: 44px;
        }
        .fp3d-overlay .fp3d-tt-chip {
          min-width: 44px;
          justify-content: center;
        }
        /* the View panel is a full screen page on a phone (#346), the time bar under it too */
        .fp3d-tt fp3d-view-panel {
          bottom: 0;
        }
        /* so is the camera wall (view3d.ts): the bar's buttons go while it is open, its Close and Back shut it */
        .fp3d-cams-open .fp3d-overlay {
          display: none;
        }
        /* one bar along the foot (#346): the star and the eye (view3d.ts) at its start, then 3D/2D, View, Cameras, time
           travel and Back, each a 44 px square at the same pitch; it never wraps (seven fit a 360 px phone) */
        .fp3d-overlay {
          left: 108px;
          right: 8px;
          bottom: calc(8px + env(safe-area-inset-bottom, 0px));
          flex-wrap: nowrap;
          justify-content: flex-start;
          gap: 6px;
        }
        .fp3d-side-right .fp3d-overlay {
          left: 8px;
          right: 108px;
          justify-content: flex-end;
        }
        .fp3d-overlay > .fp3d-seg {
          display: none;
        }
        .fp3d-overlay .fp3d-chip {
          flex: none;
          display: inline-grid;
          place-items: center;
          width: 44px;
          min-width: 44px;
          height: 44px;
          padding: 0;
          border-radius: 14px;
        }
        .fp3d-overlay .fp3d-bar-icon {
          display: contents;
        }
        .fp3d-overlay :is(.fp3d-bar-word, .fp3d-caret) {
          display: none;
        }
        .fp3d-overlay .fp3d-bar-icon svg {
          width: 22px;
          height: 22px;
        }
        /* the 3D view's star and eye join the bar (view3d.ts reads these; without them, as in a card, they keep their corner) */
        fp3d-view3d {
          --fp3d-dock-left: 8px;
          --fp3d-dock-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
          --fp3d-dock-menu: calc(60px + env(safe-area-inset-bottom, 0px));
        }
        /* time travel has no star (nothing is switched): the eye takes its place and the bar moves up to it */
        .fp3d-tt fp3d-view3d {
          --fp3d-dock-left: -42px;
          --fp3d-dock-bottom: calc(var(--fp3d-tt-h) + 4px);
          --fp3d-dock-menu: calc(var(--fp3d-tt-h) + 56px);
        }
        .fp3d-tt .fp3d-overlay {
          left: 58px;
        }
        .fp3d-side-right.fp3d-tt .fp3d-overlay {
          left: 8px;
          right: 58px;
        }
        /* a room sheet: the pair waits in one row above it */
        .fp3d-room-open fp3d-view3d {
          --fp3d-dock-bottom: calc(var(--fp3d-sheet-h, 55%) + 18px);
          --fp3d-dock-menu: calc(var(--fp3d-sheet-h, 55%) + 70px);
        }
        .fp3d-clean fp3d-view3d {
          --fp3d-dock-left: initial;
          --fp3d-dock-bottom: initial;
          --fp3d-dock-menu: initial;
        }
      }
      /* touch screens, a tablet as much as a phone (#181): 44 px, and room for three rows of floor chips */
      @media (pointer: coarse), ${unsafeCSS(PHONE_MEDIA)} {
        .fp3d-view-btn,
        .fp3d-rooms-btn,
        .fp3d-find-toggle,
        .fp3d-note-badge {
          min-width: 44px;
        }
        .fp3d-note-badge {
          height: 44px;
        }
        .fp3d-tab,
        .fp3d-floors button,
        .fp3d-overlay .fp3d-chip,
        .fp3d-overlay .fp3d-seg button,
        fp3d-view-panel .fp3d-seg button,
        .fp3d-nav .fp3d-chip {
          min-height: 44px;
        }
      }
    `,
  ];
}

defineElement("home-3d-panel", Floorplan3dPanel);
