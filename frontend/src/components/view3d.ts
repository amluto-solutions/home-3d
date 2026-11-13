// Lit wrapper around the lazily loaded 3D viewer.

import { defineElement } from "../define.ts";
import { hostAt, losers, type MediaCandidate } from "../media-groups.ts";
import { css, html, LitElement, nothing, svg, unsafeCSS, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { actionIndex, gestureAction, runItemAction, TapSequencer, type ActionOwner, type ItemAction } from "../item-actions.ts";
import { carState, type CarState, heatSensorOn, roomClimateValue,
  appColor,
  areaEntities,
  entityName,
  furnitureEntities,
  alarmTriggered,
  isActive,
  isUnavailable,
  kindOf,
  lightGlow,
  openingEntities,
  openingState,
  slatsInverted,
  TOGGLE_KINDS,
  type FurnitureLinks,
  type OpeningEntities, awningStates, confirmEntities, fridgeDoors, hasScreen, isMediaFurniture, isTvItemType, pictureRuleMatches,
  fromCelsius,
  tempUnit,
  robotRoom,
  robotRoomSensor,
  vacuumCleaning,
  roomNamed,
  carEntities,
  isStatusSensor,
  favoriteCall,
  runButton,
  climateModeGlow,
  cooktopLevel,
  onlyColor,
  fanSpeed,
  apOnline,
  isPulseDrive,
  entityAreaId,
} from "../devices.ts";
import { linkedContactIds } from "../opening-links.ts";
import { effectSettings, itemShade, motionRooms, tempShade } from "../room-effects.ts";
import { alertEntities, alertKey, alertSources, alertText, alertTint, clearedSnoozes, dismissAlert, findAlerts, HOUSE_ALERTS, isOutage, mayIgnoreAlert, shownAlerts, snoozeKey, type Alert, type AlertSources } from "../alerts.ts";
import { iconSvg, mdiIcon } from "../icons.ts";
import { uiIcon } from "../ui-icons.ts";
import { applianceIdle, binColors, binDue, binNext, binOut, binOutToggleable, binPlace, binTagsShown, doorsOf, fetchPickups, FinishedMemory, fridgeOpenTooLong, groupTags, hassCountry, isFinishedState, mailboxPost, nextFridgeCheck, plantThirsty, remainingMinutes, remainingText, servicesDue, sameHousehold, setHouseholdCountry, wasteCalendars, isPackPlant, type HouseholdItem, type HouseholdTag, type Pickup } from "../household.ts";
import { BAR_RGB, CHARGE_BAR_COUNT, chargeBars, DARK_BAR_RGB } from "../charge-bars.ts";
import { batteryCharge, deviceSensors, energySummary, fetchSolarRows, fetchTodayChange, type EnergyPrefs, fieldLevels, fieldPowers, findConsumers, flowDots, isLoad, flowSegments, mixColor, sourceMix, gridPoint, powerSensorFor, readPower, solarCurvePath, solarDayFromStats, type Consumer, type EnergySummary, type SolarDay, type FlowKind, type StatRow } from "../energy.ts";
import { fieldFace, fieldSize, roofFaces, roofWindowRoom } from "../solar.ts";
import { type CustomButton, type EnergySettings, type EntityRef, DEFAULT_HOLOGRAM, lockAlong, type PoolPipe, type RoofWindow, type SolarField, uid } from "../model.ts";

/** A service call from the 3D view; a refused one shows a short message instead of doing nothing (#171). */
function safeCall(hass: HomeAssistant, domain: string, service: string, data: Record<string, unknown>): void {
  callServiceSafe(hass, domain, service, data, (error) => translate(hass, "service_failed", { error }));
}

/** A hologram card: the house's balance on the main plant, one plant (a balcony plant) on its own, or a device. */
/** The unit a meter counts in (m³ when it does not say). */
function meterUnit(hass: HomeAssistant, id: string | null | undefined): string {
  return String((id && hass.states[id]?.attributes.unit_of_measurement) || "m³");
}

/** Today's water: litres while it is less than 10 m³ (a household's day), else in the meter's unit. */
/** A module card's small curve (the last hours) in its colour. */
function sparkLine(values: readonly number[], color: string) {
  return html`<svg class="fp3d-holo-spark" viewBox="0 0 120 22" preserveAspectRatio="none" aria-hidden="true">${svg`<polyline points=${sparkPoints(values, 120, 22)} style=${`stroke:${color}`} />`}</svg>`;
}

function waterText(hass: HomeAssistant, v: number, unit: string): string {
  if ((unit === "m³" || unit === "m3") && v < 10) return `${formatNumber(hass, v * 1000, 0)} l`;
  return `${formatNumber(hass, v, v < 10 ? 2 : 0)} ${unit}`;
}

interface HoloCard {
  kind: "main" | "plant" | "device" | "media" | "car" | "module" | "bin" | "rack";
  /** Racks (#120): the rack's chosen live values and its gear's names (slot id -> name). */
  rack?: { id: string; values: RackCardValue[]; names: Record<string, string> };
  /**
   * Household: the tag of a waste bin that goes out – its colour and when ("Tomorrow") – or of bins standing
   * together (one line each, in pickup order), a mailbox with post or a thirsty plant (a round symbol from afar).
   */
  bin?: { lines: { color: string; when: string; name: string; soon: boolean; out: boolean }[]; soon: boolean; icon: "mail" | "plant" | null };
  /** A module's small label, drawn like a bin's tag. */
  tag?: boolean;
  /** A module's card (the pool module: the pool), drawn by the host from what the module says. */
  module?: ModuleCard;
  name: string;
  /** Cars: the car in its parking spot (charge, range, charging, lock, climate). */
  car?: { spot: string; soc: number | null; range: number | null; rangeUnit: string; chargingW: number | null; charging: boolean; locked: boolean | null; climateOn: boolean | null; lock: string | null; climate: string | null; charge: string | null };
  /** Klang & Kino: what the player plays right now. */
  media?: { id: string; title: string; artist: string; picture: string | null; volume: number; playing: boolean; /** A TV's card (#281): always shown, can be hidden. */ tv?: boolean; /** The TV is off: the card shows a power button only. */ off?: boolean };
  /** The plant's power now (W); null on the main card (it shows the house). */
  w: number | null;
  /** Sensors whose statistics give today's curve. */
  dayIds: string[];
  /** A battery of this plant (the nearest one on its floor). */
  battery: { soc: number | null; w: number | null } | null;
}

/** How long a tapped solar card stays grown on a touch screen (#144). */
const HOLO_BIG_MS = 20000;
/** How long the grown solar card's forecast and statistics are kept before it fetches them again. */
const SOLAR_MORE_MS = 300000;

/** How far back a rack card's sparklines reach (#120). */
const RACK_SPARK_MS = 6 * 3600000;

/** How long a detection pin stays after its sensor dropped back. */
const DETECT_LINGER_MS = 120000;
/** How long a paused player keeps its now-playing card. */
const PAUSED_CARD_MS = 10 * 60 * 1000;
/** The TV or player card's width while hovered (#335), as the stylesheet has it: the card is placed and kept on screen for it. */
const MEDIA_HOVER_W = 288;

/** Pins of what a camera detects (Frigate and the like): a person, a vehicle, an animal, motion. */
const DETECT_ICONS: Record<string, string> = {
  person: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6m-3 7h6a2 2 0 0 1 2 2v6h-2v6H9v-6H7v-6a2 2 0 0 1 2-2"/></svg>',
  car: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11a2 2 0 0 1 2 2v5h-2v2h-3v-2H8v2H5v-2H3v-5a2 2 0 0 1 2-2m1.1 0h11.8l-1-3H7.1zM6.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m11 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"/></svg>',
  pet: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8.3 3.5a2 1.6 0 1 1 0 3.2 2 1.6 0 0 1 0-3.2m7.4 0a2 1.6 0 1 1 0 3.2 2 1.6 0 0 1 0-3.2M4.5 8a1.8 1.5 0 1 1 0 3 1.8 1.5 0 0 1 0-3m15 0a1.8 1.5 0 1 1 0 3 1.8 1.5 0 0 1 0-3M12 10c2.5 0 4.6 1.9 5.3 4.3.6 2 .2 3.7-1.3 4.5-1.4.8-2.6-.2-4-.2s-2.6 1-4 .2c-1.5-.8-1.9-2.5-1.3-4.5C7.4 11.9 9.5 10 12 10"/></svg>',
  motion: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4M9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6z"/></svg>',
};

/** The pin at the street end of the grid cable. */
const GRID_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>';
/** The grid connection during a power outage: the bolt crossed out (#214). */
const GRID_OFF_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/><path d="M3 3l18 18"/></svg>';
import { STAGE, type Look, type Theme } from "../themes.ts";
import { shownLook, shownStyle, type CardStyle } from "../ha-theme.ts";
import { allStyles, setCustomStyles, styleById, type StyleDef, type StylePlan } from "../looks.ts";
import { keepOverride, liveOverride, overrideFor, readOverride, styleIsForScreen, type ScreenStyle, type StyleOverride } from "../style-override.ts";
import { contrastChrome, lightChrome } from "../scheme.ts";
import { HEAT_SCALES, heatColor, heatGradient, roomValues, type HeatMode } from "../heatmap.ts";
import { furnitureName } from "../furniture-names.ts";
import type { RackDraw, RackElevation } from "../rack-elevation.ts";

/** A rack's front view as the sheet shows it: the drawing and the rack's name (#115). */
type RackView = RackElevation & { name: string };
import { fetchImage } from "../api.ts";
import { FallbackPlanSaver } from "../plan-fallback.ts";
import { PictureCache } from "../picture-cache.ts";
import { formatNumber, translate, type I18nKey } from "../i18n.ts";
import { timeStyleOf } from "../time-text.ts";
import { holdTarget } from "../hold.ts";
import { popupKind, popupPosition } from "../device-popup-model.ts";
import { floorPictureKey } from "../floor-sig.ts";
import { buildWhere, elsewhere, tapInRoomOn, type Where, type WhereIndex, type WhereInput } from "../tap-room.ts";
import { loadDevicePopup, loadFind, loadQuickMenu, loadViewNav, loadWeatherTile } from "../load-parts.ts";
import { need } from "../lazy-part.ts";
import { energyRole, getPacks, getPlanRecipes, isPackCooktop, isPackHeater, isPackType, isRobotVacuum, isThermostatItem, mountBase, packAmbilight, packItem, packRobotCentre, packItemName, packMotion, packsVersion } from "../packs.ts";
import { parkedVehicle, PRESENT_STATES, parkedVehicles, vehicleFurniture } from "../parking.ts";
import { TRAIL_ICON, TRAIL_WINDOW_MS, trailEvents, trailPoints, trailSources, trailTime, type HistoryRow } from "../trail.ts";
import { limitEffects, weatherEntity, weatherState } from "../weather.ts";
import { realisticSky, type RealisticSky } from "../realistic.ts";
import { SHOW_PRESENCE } from "../flags.ts";
import { projectionOn, released } from "../features.ts";
import { searchIndex, type SearchItem } from "../search.ts";
import type { Shown } from "../voice/targets.ts";
import type { SpokenRack } from "../voice/racks.ts";
import { anyModule, moduleAlerts, moduleCards, moduleMenuSheets, modulePools, moduleRoomSheets, moduleScene, modulesWithSettings, moduleVoice, moduleWatched, syncModules, type ModuleCard, type ModuleHost, type ModuleSheet, type ScenePiece, type SpokenAlert, type SpokenCar, type SpokenDevice, type SpokenOpening, type VoiceAnswer } from "../modules.ts";
import { lineFlows, majorOnly, markerEmoji, markerPath, sparkPoints } from "../module-scene.ts";
import { generateWalls, openingHost, placeWallPlate, pointOnRoomEdge, type Wall } from "../geometry/walls.ts";
import { signedArea } from "../model.ts";
import { coverPositionable, lightAbilities } from "../light-abilities.ts";
import { load3d } from "../load3d.ts";
import { load2d } from "../load2d.ts";
import { pinIn2d } from "../plan2d/pins.ts";
import type { ViewerSurface } from "../viewer-surface.ts";
import { loadFun } from "../load-fun.ts";
import { seasonNow } from "../seasons.ts";
import { detectionKind, scaleGlow, buildMarkers, cameraMotionSensors, cameraRedUntil, openMoreInfo, setCameraSensors, stateText, toggleEntity } from "../markers.ts";
import { RACK_STATUS_COLOURS, rackLedStates, slotEntities, slotStatus } from "../rack-links.ts";
import { fetchRackSpark, RACK_HOTTEST, RACK_ONLINE, rackCardValues, rackSpark, type RackCardValue } from "../rack-card.ts";
import { activeSections, roofUnderAt, sectionAbove, sectionCutsBelow } from "../roof-sections.ts";
import { centroid, furnitureFootprint, gangEntities, gangsOf, GANG_TYPES, TECH_TYPES, isLamp, setTerrain, poolFloorY, LAMP_MODEL, LIFT_SPOTS, outdoorGround, pointInPolygon, poolWaterY, roomHolding, spotDepth, surfaceHeight, zonesOf, type Building, type Floor, type Furniture, type Pet, type StartView, type Vec2 } from "../model.ts";

import { pathLength, pipePath, pointAlong, type P3 } from "../geometry/runs.ts";
import { pipePieces, poolAreas, poolNodeAt, poolWallNormal, underBasin, PIPE_IDLE, type PipePiece } from "../pool-runs.ts";
import type { PipeTube } from "../viewer/viewer3d.ts";
import type { PoolPiece } from "../viewer/pool-water.ts";
import { EDITOR_SENSOR_SYNC_MS, pacedSyncDelay, sensorSyncDelay } from "../viewer/pace.ts";
import { nextTask } from "../viewer/slices.ts";
import { flowWidth } from "../viewer/flow-style.ts";
import { roomSentence, sceneSummary, type FloorSummary } from "../room-summary.ts";
import { floorCounts, floorInfoText, locatedPersons, personLook, personsInRooms, personsShown } from "../presence.ts";
import { controls, tokens } from "../styles.ts";
import type { HassEntity, HomeAssistant } from "../types.ts";
import { activateKey } from "../activate-key.ts";
import { callServiceSafe } from "../failure.ts";
import { forwardHass, HASS_CHILDREN, HassWatch } from "../hass-watch.ts";
import type { BinCue, DeviceMarker, FloorplanViewer, FloorStack, RobotInfo, Quality, ScreenState, SoundSource, SurfaceGrab, ViewerStats, WallMode } from "../viewer/viewer3d.ts";
import { wallLayout } from "../camera-wall.ts";
import type { Grip, WallWindow } from "../float-window.ts";
import { watchedEntities } from "../watched.ts";
import { isPrinter, printerFaces, printerState } from "../printer.ts";
import type { NavAction } from "./view-nav.ts";
import { hiddenItemIds, typeOfEntity, type ObjectType } from "../object-types.ts";
import { hasTimedRules, planHiddenItems, shownBuilding, stateHiddenItems } from "../show-when.ts";
import { backdropCss } from "../backdrop.ts";
import { loadVoice, micProbeAsked, micProbeDone, voicePipeline } from "../load-voice.ts";
import { answerAsk, subscribeAsk, type Ask } from "../api.ts";
import { pipePlanner } from "../pipe-planner.ts";
import type { ClockPos } from "../card-config.ts";
import { CLOCK_LOOK, renderClock, type ClockLook } from "../clock.ts";
import { Director, HOLD_DEFAULT, directorAny, doorbellCamera, doorbellEntities, doorbellRang, triggerFired, type DirectorSettings, type Shot } from "../director.ts";
import type { HistorySpec, ReplayInfo } from "../timetravel/types.ts";
import { sunPath, type SunHeight, type SunPath } from "../sun-path.ts";
import { cheapRate, ratesFromSensors } from "../cheap-rate.ts";
import { askConfirm } from "../ask.ts";
import "./ask-dialog.ts";
import { BackLayers, navHosted } from "../back-stack.ts";
import { fetchTodayKwh, wireEnds, type WireEnd } from "../wire-ends.ts";
import { forecastCurvePath, forecastSplit, solarMoreRows, solarPrefsInfo, type SolarForecast, type SolarPrefsInfo } from "../solar-more.ts";
import { isPhoneWidth, NO_FIT_MARGIN, PHONE_FIT_MARGIN, PHONE_MEDIA, thumbsCompact } from "../phone.ts";

/** Walking through the house (and the pets' floor map) is a chunk of its own (#179): it needs no three.js. */
const loadWalk = () => import("../viewer/walk.ts");

const NO_TYPES: ReadonlySet<ObjectType> = new Set();

/** Which HTML markers are shown: none, only what has no 3D object or shows a value, or all. */
/** "room": no symbols in the house and floor views, in a room only that room's (D477, D595). */
export type MarkerMode = "none" | "important" | "all" | "room";



/**
 * An own button lights up while the entity it works on is active (#188): the entity of "more info", or the
 * entity_id a service call targets (a single one).
 */
/** The room a point of a floor lies in (for device cards shown in their room). */
function roomAt(floor: { rooms: readonly { id: string; points: [number, number][] }[] }, x: number, z: number): string | null {
  return roomHolding(floor, x, z)?.id ?? null;
}

function ownButtonOn(hass: HomeAssistant, btn: CustomButton): boolean {
  const target = btn.action === "more_info" ? btn.target : btn.data?.entity_id;
  return typeof target === "string" && isActive(hass.states[target]);
}

/** A remembered switch of this browser (storage may be blocked: then off). */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* the switch is only not remembered */
  }
}

/** The TV cards this browser hid (#281), by player entity; storage may be blocked: none. */
function readTvHidden(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem("home3d.tv_hidden") ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function writeTvHidden(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem("home3d.tv_hidden", JSON.stringify([...ids]));
  } catch {
    /* hidden only until the page reloads */
  }
}

/** A roof window's sash and blind as the 3D view shows them: its contact and tilt sensors, or its window motor. */
function roofWindowState(hass: HomeAssistant, w: RoofWindow): { open: number; tilt: number; cover: number } {
  const ref = (e: string | null | undefined) => (e && e !== "none" ? e : null);
  const s = openingState(hass, { cover: ref(w.cover), contact: ref(w.contact), tilt: ref(w.tilt) }, "window");
  // a window motor: its position (0–100) opens the sash that far; a plain open/closed state fully
  const motor = ref(w.window) ? hass.states[ref(w.window)!] : undefined;
  let open = s.open;
  if (motor && !isUnavailable(motor)) {
    const pos = motor.attributes.current_position;
    open = typeof pos === "number" ? Math.min(1, Math.max(0, pos / 100)) : motor.state === "open" || motor.state === "opening" ? 1 : 0;
  }
  return { open, tilt: s.tilt, cover: s.cover ?? 0 };
}

export class Fp3dView3d extends LitElement {
  static properties = {
    hass: { attribute: false },
    building: { attribute: false },
    canEdit: { attribute: false },
    noSettings: { attribute: false },
    home: { attribute: false },
    floorId: { attribute: false },
    roomId: { attribute: false },
    wallMode: { attribute: false },
    explode: { type: Boolean },
    keepRoof: { attribute: false },
    markerMode: { attribute: false },
    pinSize: { attribute: false },
    markerNames: { attribute: false },
    heatMode: { attribute: false },
    theme: { attribute: false },
    themeEvening: { attribute: false },
    themeNight: { attribute: false },
    styleEntity: { attribute: false },
    clock: { attribute: false },
    clockLook: { attribute: false },
    clockWeather: { attribute: false },
    _clockTick: { state: true },
    accent: { attribute: false },
    packs: { attribute: false },
    showEnergy: { attribute: false },
    flows: { attribute: false },
    holograms: { attribute: false },
    doorPins: { attribute: false },
    furnish: { type: Boolean },
    surfaceGrab: { attribute: false },
    furnishTypes: { attribute: false },
    trail: { type: Boolean },
    cameraWall: { attribute: false },
    weather: { type: Boolean },
    weatherEntityId: { attribute: false },
    _flash: { state: true },
    selectedFurniture: { attribute: false },
    selectedSet: { attribute: false },
    selectedDevice: { attribute: false },
    _sky: { state: true },
    _realSky: { state: true },
    quality: { attribute: false },
    showStats: { type: Boolean },
    plan2d: { attribute: false },
    _stats: { state: true },
    _error: { state: true },
    _energy: { state: true },
    _holos: { state: true },
    _rows: { state: true },
    _meters: { state: true },
    _cheap: { state: true },
    _costs: { state: true },
    _wires: { state: true },
    _wireKwh: { state: true },
    _wireOpen: { state: true },
    _holoOpen: { state: true },
    _wallboxW: { state: true },
    _plants: { state: true },
    _holoBig: { state: true },
    _solarMore: { state: true },
    _flows: { state: true },
    _legendMin: { state: true },
    _holoShow: { state: true },
    _energyFold: { state: true },
    _swipe: { state: true },
    _menu: { state: true },
    _popup: { state: true },
    _through: { state: true },
    _blend: { state: true },
    _wallBig: { state: true },
    _find: { state: true },
    findInBar: { type: Boolean },
    _walk: { state: true },
    walkable: { attribute: false },
    pivotMark: { attribute: false },
    petsOn: { attribute: false },
    ghostOn: { attribute: false },
    vacuumMaps: { attribute: false },
    _central: { state: true },
    _sheet: { state: true },
    _rackView: { state: true },
    _note: { state: true },
    _thumbsCompact: { state: true },
    central: { attribute: false },
    buttons: { attribute: false },
    _thumbs: { state: true },
    floorThumbs: { attribute: false },
    clean: { attribute: false },
    cleanButton: { attribute: false },
    roomLabels: { attribute: false },
    hiddenTypes: { attribute: false },
    furnitureOn: { attribute: false },
    pulse: { attribute: false },
    floorStack: { attribute: false },
    panelOpen: { attribute: false },
    controlsRight: { attribute: false },
    keepView: { attribute: false },
    angleLock: { attribute: false },
    windowSpill: { attribute: false },
    sunHeight: { attribute: false },
    navButtons: { attribute: false },
    alerts: { attribute: false },
    alertJump: { attribute: false },
    director: { attribute: false },
    hideRoof: { attribute: false },
    voice: { attribute: false },
    screen: { attribute: false },
    _voice: { state: true },
    scenes: { attribute: false },
    dimmed: { attribute: false },
    autoOrbit: { attribute: false },
    startView: { attribute: false },
    _low: { state: true },
    _micProbe: { state: true },
    _narrowStage: { state: true },
    _phoneStage: { state: true },
    _alerts: { state: true },
    _dismissing: { state: true },
    _household: { state: true },
    _hhFolded: { state: true },
    _binInfo: { state: true },
    _gangMenu: { state: true },
    householdCard: { attribute: false },
    rackCards: { attribute: false },
    _rackRows: { state: true },
    _sceneFired: { state: true },
    replay: { attribute: false },
    _info: { state: true },
    _styleOverride: { state: true },
  };

  /**
   * Home Assistant as handed in; `hass` reads it through `hassWatch` during an update (#177): its render and the
   * director note the states they read. Elements it draws get the plain object.
   */
  private rawHass: HomeAssistant | undefined;
  private readonly hassWatch = new HassWatch({ entityLists: false });

  get hass(): HomeAssistant {
    const h = this.rawHass;
    return (h && this.hassWatch.recording ? this.hassWatch.wrap(h) : h) as HomeAssistant;
  }

  set hass(value: HomeAssistant) {
    this.rawHass = value;
  }

  declare building: Building | null;
  /** On the editors list (#7): may change the plan's settings from the view. Unset: admins may (a backend before #7). */
  declare canEdit: boolean | undefined;
  /** Locked tablet mode (#92): the central menu offers no view settings. */
  declare noSettings: boolean;
  /** The home shown (#53): its pictures are fetched and its settings saved there; unset: the active home. */
  declare home: string | null | undefined;
  /** Time travel: the replayed moment (hass is then the past, read-only); null = live. */
  declare replay: ReplayInfo | null;
  /** Time travel: a tapped device's state at the replayed moment, next to the finger. */
  private declare _info: { entity: string; x: number; y: number } | null;
  private infoTimer: ReturnType<typeof setTimeout> | undefined;
  /** The replay's jump counter as last seen (a jump sets doors and blinds at once). */
  private seenSeek = 0;
  /** The replayed moment as last seen; the replay's ticks reach the view through its listener. */
  private seenT = 0;
  private replayTicked = false;
  /** The replay's focus counter as last seen (an event was tapped: the view shows where). */
  private seenFocus = 0;
  private unlistenReplay: (() => void) | null = null;
  /** The last sync showed something that follows the clock (a camera's detection pin). */
  private detecting = false;
  /** How long the last full sync took (ms, smoothed), shown with the stats. */
  private syncMs = 0;
  declare floorId: string | null;
  declare roomId: string | null;
  declare wallMode: WallMode;
  declare explode: boolean;
  /** The roof stays while zooming in (no lift, no fade). */
  declare keepRoof: boolean;
  declare markerMode: MarkerMode;
  /** How large the device symbols are (D596). */
  declare pinSize: "small" | "normal" | "large";
  /** Card option marker_names: every device with an own name shows it under its pin. */
  declare markerNames: boolean;
  declare heatMode: HeatMode;
  /** Imported furniture packs (a new list rebuilds pack furniture). */
  declare packs: unknown;
  /** The look; "auto" is Day while the sun is up and Neon at night (D623), "theme" follows the HA theme (#38). */
  declare theme: Look;
  /** The card's own evening and night styles (with `theme` as its day style) and a helper entity that names the style (#439). */
  declare themeEvening: string | null;
  declare themeNight: string | null;
  declare styleEntity: string | null;
  /** A style set from outside for this device (the action `home_3d.set_style`, a spoken style), until a time (#442). */
  private declare _styleOverride: StyleOverride | null;
  /** The styles dialog's try-out (#441), shown instead of the chosen style while it is open. */
  private _stylePreview: StyleDef | null = null;
  private styleTimer: ReturnType<typeof setTimeout> | undefined;
  /** Date and time in a corner of the view (D631); null or "off": none. */
  declare clock: ClockPos | null;
  /** What the clock looks like (#232); the default is digits with the date. */
  declare clockLook: ClockLook | null;
  /** A weather tile by the clock (#333; a device preference, on by default since #347). */
  declare clockWeather: boolean;
  private declare _clockTick: number;
  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private clockEvery = 0;
  /** Seasonal and conditional items (#15): the plan the viewer shows (hidden items left out), what it was made of, and the minute tick. */
  private shownPlan: { from: Building; hidden: string; plan: Building } | null = null;
  private showTimer: ReturnType<typeof setTimeout> | undefined;
  /** Accent colour for the neon look ("#rrggbb"), null for the stock cyan. */
  declare accent: string | null;
  /** Show the energy values at the top (cards can switch them off). */
  declare showEnergy: boolean;
  /** Power flow lines fixed on or off (cards); null: the viewer's own toggle decides. */
  declare flows: boolean | null;
  /** Energy holograms always on or off (card option); null = the bar's own switch. */
  declare holograms: boolean | null;
  /** View option "Door sensor pins" (#349): off, the contact sensors linked to a door or window show on the opening only. */
  declare doorPins: boolean;
  private declare _holoShow: boolean;
  /** The energy row is folded to the Consumption tile (#348; kept per device). */
  private declare _energyFold: boolean;
  /** Furnishing: furniture and lamps are dragged in 3D (admins, panel only). */
  declare furnish: boolean;
  /** Editor: moves solar fields and roof windows with rays from the camera (null: none). */
  declare surfaceGrab: SurfaceGrab | null;
  /** Editor: only these furniture types can be moved in 3D (null: all). */
  declare furnishTypes: readonly string[] | null;
  /** Motion trail: where motion was reported in the last half hour, with times. */
  declare trail: boolean;
  /** The camera wall: every placed camera's live picture at once (Pro). */
  declare cameraWall: boolean;
  /** Weather outside: rain, snow, fog and clouds from a weather entity, sun and moon from sun.sun. */
  declare weather: boolean;
  /** The weather entity to use (null: the first one). */
  declare weatherEntityId: string | null;
  /** A lightning flash lights the stage for a moment. */
  private declare _flash: boolean;
  /** A feature that is not available here was asked for: a short hint. */
  private flashTimer: ReturnType<typeof setTimeout> | undefined;
  private cloud = 0;
  /** The sun's way today, worked out once a day (see sunPathToday). */
  private sunPathKey = "";
  private sunPathCache: SunPath | null = null;
  /** Entities that ask before a tap switches them. */
  private confirmSet = new Set<string>();
  /** History rows of the trail's sensors (fetched while the trail is shown, again every minute). */
  private trailRows: Record<string, HistoryRow[]> = {};
  private trailTimer: ReturnType<typeof setInterval> | undefined;
  declare selectedFurniture: string | null;
  /** Further chosen pieces (a block): outlined too. */
  declare selectedSet: string[];
  declare selectedDevice: string | null;
  /** How much daylight there is (0 = night, 1 = day), from sun.sun. */
  private declare _sky: number;
  /** The realistic look's sky (#39): zenith, horizon and ground from the sun and the weather entity, as a CSS gradient. */
  private declare _realSky: RealisticSky | null;
  declare quality: Quality;
  declare showStats: boolean;
  private declare _stats: ViewerStats | null;
  private declare _error: string | null;
  private declare _energy: EnergySummary | null;
  /** The energy tile shown enlarged after a tap (touch has no hover), null = none (#90). */
  /** Energy: today's solar statistics for the hologram (kWh, peak and the day curve). */
  /** The hologram cards (main plant first) and today's statistics rows of their sensors. */
  private declare _holos: HoloCard[];
  private declare _rows: Record<string, StatRow[]> | null;
  private declare _holoOpen: boolean;
  /** Power of the wallboxes in the plan (W), for the hologram. */
  private declare _wallboxW: number | null;
  /** The inverters with their own sensors (name and W), for the hologram when there are several plants. */
  private declare _plants: { name: string; w: number }[];
  private holoTimer: ReturnType<typeof setInterval> | undefined;
  /** The heat legend is folded to a slim bar (#310), remembered on this device. */
  private declare _legendMin: boolean;
  /** The solar card has grown (#144): hovered, or tapped on a touch screen. */
  private declare _holoBig: boolean;
  /** What the grown solar card adds (fetched only when it grows, kept for a few minutes). */
  private declare _solarMore: { at: number; prefs: SolarPrefsInfo; forecast: SolarForecast | null; change: Map<string, number> | null } | null;
  private solarMoreLoading = false;
  /** The pointer type of the last press on the solar card (a touch opens it, a mouse click folds it). */
  private holoPress = "";
  /** A mouse click folded the hovered card: it stays small until the pointer leaves. */
  private holoHoverOff = false;
  private holoBigTimer: ReturnType<typeof setTimeout> | undefined;
  /** Which hologram cards are folded to their big number. */
  private holoFolded = new Set<number>();
  /** Media cards folded by the user, by player (positions shift as players start and stop). */
  private mediaFolded = new Set<string>();
  /** Module cards that show their minor values also on a narrow card or the tablet level (this device, #452). */
  private moduleFull = new Set<string>(readModuleFull());
  /** TV cards hidden on this device (#281); a click on the TV brings its card back. */
  private tvHidden = readTvHidden();
  /** A module card just opened from its marker (it lights up for a moment). */
  private cardPing: string | null = null;
  private cardPingTimer: ReturnType<typeof setTimeout> | undefined;
  /** Klang & Kino: the last card of each player and until when it may stand in for a short dropout. */
  private mediaGrace = new Map<string, { until: number; card: HoloCard; source: SoundSource; anchor: Parameters<FloorplanViewer["setAnchors"]>[0][number] }>();
  private mediaGraceTimer: ReturnType<typeof setTimeout> | undefined;
  /** The volume being dragged (shown at once; the player answers later, a cloud speaker slowly). */
  private mediaVolume = new Map<string, { v: number; at: number }>();
  /**
   * Play or pause as last pressed, until the player reports it (an Echo answers late, #400): otherwise a second
   * tap while it still says "playing" would send pause again instead of play.
   */
  private mediaIntent = new Map<string, { playing: boolean; at: number }>();
  /** What the loaded modules add to the stage right now (water, pipe flows, device glows), computed once per sync. */
  private scene: ScenePiece[] = [];
  private volumeSent = 0;
  private holoIds = "";
  /** When the day curves were last fetched, and a fetch for when the page shows again. */
  private holoFetched = 0;
  private holoRefetch: (() => void) | null = null;
  /** The start view last handed to the viewer (JSON), to notice a new one. */
  private shownStartView: string | undefined;
  /** A running swipe on a lamp or blind: the value shown next to the finger. */
  private declare _swipe: { entity: string; kind: "light" | "cover"; start: number; value: number; x: number; y: number } | null;
  /** Quick menu at a device (long press). */
  private declare _menu: { entity: string; x: number; y: number; car?: CarState; doorLock?: boolean } | null;
  /** The device popup (#272 #271 #284): a light's, a robot vacuum's or a camera's card; `hover`: a camera's floating live preview. */
  private declare _popup: { entity: string; x: number; y: number; hover?: boolean } | null;
  private popupTimer: ReturnType<typeof setTimeout> | undefined;
  /** Looking through a camera: its live picture lies over the 3D view; `back` is the view to return to. */
  /** Looking through a camera: which one, the view to go back to, and whether the flight there has arrived. */
  private declare _through: { entity: string; back: ReturnType<FloorplanViewer["getView"]>; ready?: boolean } | null;
  /** Camera wall: the camera shown big (null: all tiles). */
  private declare _wallBig: string | null;
  /** The edge of the view the camera wall is docked to (#266), kept per device. */
  /** The camera wall as a free window (#314): its own chunk, loaded when the wall first opens. */
  private wallWin: WallWindow | null = null;
  private wallWinLoading = false;
  /** The look-through was started from the camera wall: going back reopens the wall. */
  private throughWall = false;
  /** Camera wall, big picture: Home Assistant's own stream player (a picture-entity card in live view), one at a time. */
  private live: { id: string; el: (HTMLElement & { hass?: unknown }) | null; failed: boolean } | null = null;
  /** How strongly the camera picture covers the 3D view (0 = only 3D, 1 = only the picture). */
  private declare _blend: number;
  /** Floor switcher with small pictures of the floors (panel and card; off with a fixed floor). */
  declare floorThumbs: boolean;
  /** The read-only 2D plan (#41) instead of the 3D view: the same building, devices and actions, drawn flat. */
  declare plan2d: boolean;
  /** Clean view: only the stage – no energy values, thumbnails, legend, scene chips or search (the host hides its own bars). */
  declare clean: boolean;
  /** Show the eye button that toggles the clean view (the host listens for "clean-toggle"). */
  declare cleanButton: boolean;
  /** Room names in 3D (cards can switch them off). */
  declare roomLabels: boolean;
  /** Kinds of objects the View hides (#268; the old Furniture switch, #269, is its furniture and decor kinds, #306); hiding is a flag in the viewer, not a rebuild. */
  declare hiddenTypes: ReadonlySet<ObjectType>;
  declare furnitureOn: boolean;
  private hiddenIds: { sig: string; ids: ReadonlySet<string> } = { sig: "", ids: new Set() };
  /** Pins that can be tapped draw a faint outline now and then, staggered (#283); off in low quality and with reduced motion. */
  declare pulse: boolean;
  /** Floors below an opened floor: dimmed, stacked (the house up to it) or hidden. */
  declare floorStack: FloorStack;
  private declare _thumbs: { floorId: string; url: string }[];
  /** The viewer runs at the tablet level: heavy CSS effects are left out as well. */
  private declare _low: boolean;
  /** A room panel (or sheet) is open next to the view: on small screens the view's own controls hide. */
  declare panelOpen: boolean;
  /** The floor pictures, star, search and eye on the right instead of the left (#285). */
  declare controlsRight: boolean;
  /** Floor switches keep the camera (#191). */
  declare keepView: boolean;
  /** 3D lock: the angle stays fixed (a wall tablet nobody should turn the house on). */
  declare angleLock: boolean;
  /** The light out of lit windows at night (#274); off unless the device's setting is on. */
  declare windowSpill: boolean;
  /** How high the sun's way is drawn (#319; a device preference). */
  declare sunHeight: SunHeight;
  /** The zoom, move and turn pad (#297, #307); a device choice, off unless the host turns it on. */
  declare navButtons: boolean;
  /** The stage is narrower than 700 px (smaller floor pictures, phone layout). */
  private declare _narrowStage: boolean;
  /** The stage is phone-wide (#93): floor pictures folded, the house fitted clear of the bars. */
  private declare _phoneStage: boolean;
  /** The floor pictures' fold as the user left it ("1"/"0"; null: never touched, the stage width decides). */
  private thumbsSaved: string | null = null;
  private resizeObs: ResizeObserver | null = null;
  /** Warnings (smoke, water, alarm, window in the rain): pulsing rooms and a banner; jump to new ones. */
  declare alerts: boolean;
  declare alertJump: boolean;
  /** Kamera-Cockpit: this screen shows by itself what happens (the events chosen in the settings; default off). */
  declare director: boolean;
  /** The roof left out altogether (card option `roof: false`). */
  declare hideRoof: boolean;
  /** Voice control: a microphone button – "Show the living room" shows it, other sentences go to Assist (default off). */
  declare voice: boolean;
  /** This view's screen name: a sentence from Assist that names a screen is only for the view with that name. */
  declare screen: string | null;
  private declare _voice: { phase: "wait" | "listen" | "done" | "error"; text: string } | null;
  /** The subscription to the sentences Assist hands over (every open view listens, with or without a microphone). */
  private unsubAsk: Promise<() => Promise<void>> | null = null;
  /** The screen name the sentences are listened for under (#366): a new name listens again. */
  private askScreen = "";
  private voiceTimer: ReturnType<typeof setTimeout> | undefined;
  private declare _alerts: Alert[];
  /** The banner warning whose dismiss choices are open (its key), #138. */
  private declare _dismissing: string | null;
  /** Household: what is due in the household now (the glass card "Today in the household"). */
  private declare _household: HouseholdItem[];
  private declare _hhFolded: boolean;
  /** Household: the bin tapped – its next pickups in a small pop-up. */
  private declare _binInfo: { furnitureId: string; x: number; y: number } | null;
  /** A wall switch or socket with several gangs: its small menu (one button per gang). */
  private declare _gangMenu: { furnitureId: string; x: number; y: number } | null;
  private binInfoTimer: ReturnType<typeof setTimeout> | undefined;
  /** The glass card "Today in the household" (the household feature; the dashboard card can switch it off). */
  declare householdCard: boolean;
  /** Racks (#120): a glass card over every rack with linked gear (the dashboard card can switch them off). */
  declare rackCards: boolean;
  /** Rack cards unfolded by the user, by rack furniture id (folded they show a few values). */
  private rackOpen = new Set<string>();
  /** The unfolded rack cards' sparklines: the recorder's five-minute means of the last hours, by entity. */
  private declare _rackRows: Record<string, StatRow[]> | null;
  private rackSparkKey = "";
  private rackSparkAt = 0;
  private alertSrc: AlertSources | null = null;
  private alertTimer: ReturnType<typeof setInterval> | undefined;
  /** When the next room motion lit goes dark again (#10). */
  private motionTimer: ReturnType<typeof setTimeout> | undefined;
  /** When the next camera that saw motion turns back from red. */
  private redTimer: ReturnType<typeof setTimeout> | undefined;
  private seenAlerts = new Set<string>();
  /** A room briefly lit up after a double tap switched its lights. */
  private roomFlash: { roomId: string; until: number } | null = null;
  /** Scene and script chips of the selected room. */
  declare scenes: boolean;
  private declare _sceneFired: string | null;
  /** Night (kiosk): no effects, cables or floor pictures. */
  declare dimmed: boolean;
  /** Screensaver: the view turns slowly by itself. */
  declare autoOrbit: boolean;
  /** A start view of the card's own (YAML `start_view`); else the one remembered in the editor. */
  declare startView: StartView | null;
  /** Search index (rooms and devices), built when the search opens and reused while it is open. */
  private findIndex: SearchItem[] | null = null;
  /** The panel's floor bar has the search (#305): no floating button. */
  declare findInBar: boolean;
  /** The consumers of the last sync (the modules ask what draws power right now). */
  private lastConsumers: Consumer[] = [];
  /** A tour of the house (a module's answer): its stops run one after the other until a tap ends them. */
  private tourToken = 0;
  private tourTimer: ReturnType<typeof setTimeout> | undefined;
  /** Room colours (heatmap) as last sent to the viewer. */
  private tintSig = "";
  private thumbTimer: ReturnType<typeof setTimeout> | undefined;
  /** What the floor pictures show of the devices (lamps, blinds): they are drawn again when it changes. */
  private thumbSig = "";
  private thumbsAt = 0;
  /** Search ("where is …?"): null = closed. */
  private declare _find: string | null;
  /** Floor pictures folded to plain floor buttons (D177), remembered per device. */
  private declare _thumbsCompact: boolean;
  /** The central menu (all lights / blinds of the floor or house, favourites) is open (#145). */
  private declare _central: boolean;
  /** A module's sheet that is open (an announcement …): from a room's panel (with its room) or from the ⭐ menu. */
  private declare _sheet: { id: string; floorId: string | null; roomId: string | null } | null;
  /** The rack whose front view is open (#115; its furniture id and its drawing, from a tap in 2D or 3D) and the gear whose details show (#119). */
  private declare _rackView: { id: string; draw: RackDraw; slot: string | null } | null;
  /** That front view, by what it was drawn from: built on the tap, not per render (#115). */
  private rackViewMemo: { key: string; draw: RackDraw; view: RackView } | null = null;
  /** An own action asking first (#6): its question, and the answer to give. */
  /** Items with own tap, hold or double-tap actions, by the id a tap on them reports (#6). */
  private actionOwners = new Map<string, ActionOwner>();
  /** Tells a tap from a double tap on items that have a double-tap action. */
  private readonly taps = new TapSequencer();
  /** A short note at the bottom (a module's "sent"), with its timer. */
  private declare _note: string | null;
  private noteTimer: ReturnType<typeof setTimeout> | undefined;
  /** The people shown in the last sync (for the rooms someone is in). */
  private lastPersons: { floorId: string; roomId: string }[] = [];
  /** Show the star with the central menu (card option central; default on). */
  declare central: boolean;
  /** Offer the walk through the house at eye height (card option walk; default on). */
  declare walkable: boolean;
  /** The editor's 3D pane: a small cross marks the point the view turns about (it is always the middle, #733). */
  declare pivotMark: boolean;
  /** The card can leave the pets out (card option "pets: false"); the panel always shows them. */
  declare petsOn: boolean;
  /** The card can leave the Halloween ghost out (card option "ghost: false"). */
  declare ghostOn: boolean;
  /** Robot vacuum maps on the floors (#350): the View's switch (default on). */
  declare vacuumMaps: boolean;
  /** The maps' overlay (a lazy chunk, loaded only for a plan with maps while the switch is on). */
  private vacuums: { update(b: Building): void; setHass(h: HomeAssistant | undefined): void; dispose(): void } | null = null;
  private vacuumsFor: Building | null = null;
  private vacuumsLoading = false;
  /** The walk: the room one stands in (null between rooms), or false when not walking. */
  private declare _walk: { room: string | null; hint: boolean } | false;
  private walker: { dispose(): void; setStick(v: { x: number; y: number } | null): void } | null = null;
  /** The finger on the walk stick: kept on the element, so a redraw mid-drag (a room change) does not drop it (#311). */
  private walkStick: { id: number; cx: number; cy: number } | null = null;
  /** Fun pack "pets": the animals living in the house (their own bundle), and what they were last given. */
  private pets: { update(b: Building, pets: readonly Pet[]): void; dispose(): void } | null = null;
  private petsFor: Building | null = null;
  private petsLoading = false;
  /** Fun pack "Halloween": the ghost floating through the house now and then. */
  private ghost: { update(b: Building): void; dispose(): void } | null = null;
  private ghostLoading = false;
  /** Seasonal themes (#239): the holiday's glow, greeting and effect over the view (the fun bundle). */
  private season: { refresh(): void; dispose(): void } | null = null;
  private seasonLoading = false;
  private seasonTimer: ReturnType<typeof setTimeout> | undefined;
  private walkKeys: ((e: KeyboardEvent) => void) | null = null;
  /** The outline of the room one walks in (its glass cards show). */
  private walkRoomPts: [number, number][] | null = null;
  /** Own buttons from the card's YAML (replace the house's buttons when set). */
  declare buttons: CustomButton[] | null;
  private swipeSent = 0;
  private swipeTimer: ReturnType<typeof setTimeout> | undefined;
  /** Energy cables from the meter to the consumers (off unless switched on; kept per browser). */
  private declare _flows: boolean;

  private viewer: ViewerSurface | null = null;
  private starting = false;
  /** States of the placed entities as last sent to the viewer. */
  private shownStates = new Map<string, HassEntity | undefined>();
  private shownPacks = -1;
  /** Entities of each door and window, and the registry they were matched with. */
  private openingLinks: Map<string, OpeningEntities> | null = null;
  private linkedRegistry: HomeAssistant["entities"] | undefined;
  /** Entities of electric furniture (TV, fridge, …). */
  private furnitureLinks = new Map<string, FurnitureLinks>();
  /** Household: the pickups of the waste calendars (fetched every 10 minutes while bins read one). */
  private pickups = new Map<string, Pickup[]>();
  private pickupKey = "";
  private householdTimer: ReturnType<typeof setInterval> | undefined;
  /** Household: small holograms – bins that go out today or tomorrow, post, a thirsty plant (set by the furniture pass). */
  private binHolos: HouseholdTag[] = [];
  /** Household (#142): bins marked out stand at their kerb spot (id -> spot); due bins point at theirs. */
  private binSpots = new Map<string, Vec2>();
  private binCues: BinCue[] = [];
  /** 3D printers with a camera (#11): the camera a tap on the printer opens, by the id the tap reports. */
  private printerCams = new Map<string, string>();
  /** Household: appliances that ended their program while the page is open ("finished" until the door opens). */
  private finished = new FinishedMemory();
  /** Washers, dryers and dishwashers as last read: whether they run (the live director notices a program ending). */
  private appliances = new Map<string, { floorId: string; x: number; z: number; entity: string; running: boolean }>();
  private directing = new Director();
  /** Lab: the microphone probe ("?fp3d_mic=1" in the address). */
  private declare _micProbe: boolean;
  private directorTimer: ReturnType<typeof setTimeout> | undefined;
  private restTimer: ReturnType<typeof setTimeout> | undefined;
  private directorSrc: {
    registry: HomeAssistant["entities"];
    building: Building;
    sig: string;
    bells: { id: string; camera: string | null }[];
    motion: { sensor: string; cam: string }[];
  } | null = null;
  /** Where the view was before the director took it: it goes back there. */
  private directorBack: { floorId: string | null; roomId: string | null; view: ReturnType<FloorplanViewer["getView"]> } | null = null;
  /** Household: looks again when an open fridge door reaches its limit. */
  private fridgeTimer: ReturnType<typeof setTimeout> | undefined;
  /** Measured values alone are shown at most every second (2 s on the tablet level, pace.ts): the pending sync, the last one. */
  private sensorTimer: ReturnType<typeof setTimeout> | undefined;
  /** A module asked to be drawn again (its own state changed: a target just set, a simulation ticking). */
  private moduleTimer: ReturnType<typeof setTimeout> | undefined;
  private lastSync = 0;
  /**
   * The 3D view beside the editor's plan (#389): a state change (lamp, door, sensor) reaches it at most this often, in
   * ms, trailing; the plan, the look and the selection still show at once. 0: every change shows at once.
   */
  syncPace = 0;
  /** Room values of the current heatmap (for the legend). */
  private heatValues = new Map<string, number>();
  /** Entities whose state changes redraw markers, cables, people and floor labels. */
  private watched: string[] = [];
  /** Stored images used as screen pictures, as data URLs (fetched once); null while loading or missing. */
  private pictureUrls = new PictureCache();
  /** Screens showing a camera: their snapshots are refreshed every few seconds (a changing query parameter). */
  private cameraTick = 0;
  private cameraTimer: ReturnType<typeof setInterval> | undefined;
  private cameraScreens = 0;
  /** The look through a camera itself opens this floor: that floor change must not end it. */
  private throughFloor: string | null = null;

  constructor() {
    super();
    this.building = null;
    this.replay = null;
    this._info = null;
    this.floorId = null;
    this.roomId = null;
    this.wallMode = "auto";
    this.explode = true;
    this.keepRoof = false;
    this.markerMode = "important";
    this.pinSize = "normal";
    this.heatMode = "none";
    this.theme = "neon";
    this.themeEvening = null;
    this.themeNight = null;
    this.styleEntity = null;
    this._styleOverride = readOverride(Date.now());
    this.clock = null;
    this.clockLook = null;
    this.clockWeather = true;
    this._clockTick = 0;
    this.accent = null;
    this.furnish = false;
    this.trail = false;
    this.weather = true;
    this.weatherEntityId = null;
    this._flash = false;
    this.showEnergy = true;
    this.flows = null;
    this.selectedFurniture = null;
    this.selectedSet = [];
    this.selectedDevice = null;
    this._sky = 0;
    this._realSky = null;
    this.quality = "auto";
    this.showStats = false;
    this._stats = null;
    this._error = null;
    this._energy = null;
    this._holos = [];
    this._rows = null;
    this._holoOpen = true;
    this._wallboxW = null;
    this._plants = [];
    this._holoBig = false;
    this._solarMore = null;
    this._swipe = null;
    this._menu = null;
    this._popup = null;
    this._through = null;
    this._wallBig = null;
    this._blend = 0.6;
    this._find = null;
    this._central = false;
    this._sheet = null;
    this._rackView = null;
    this._note = null;
    try {
      this.thumbsSaved = localStorage.getItem("home3d.thumbs_compact");
    } catch {
      this.thumbsSaved = null;
    }
    this._thumbsCompact = thumbsCompact(this.thumbsSaved, false);
    this._phoneStage = false;
    this.central = true;
    this.walkable = true;
    this.pivotMark = false;
    this.petsOn = true;
    this.ghostOn = true;
    this.vacuumMaps = true;
    this._walk = false;
    this.buttons = null;
    this._thumbs = [];
    this.floorThumbs = true;
    this.plan2d = false;
    this.clean = false;
    this.cleanButton = false;
    this.noSettings = false;
    this.roomLabels = true;
    this.hiddenTypes = NO_TYPES;
    this.furnitureOn = true;
    this.pulse = true;
    this.floorStack = "dim";
    this._low = false;
    this.panelOpen = false;
    this.controlsRight = false;
    this.keepView = false;
    this.angleLock = false;
    this.windowSpill = false;
    this.sunHeight = "auto";
    this.navButtons = false;
    this._narrowStage = false;
    this.alerts = true;
    this.alertJump = false;
    this.director = false;
    this.hideRoof = false;
    this.voice = false;
    this.screen = null;
    this._voice = null;
    this._micProbe = micProbeAsked();
    this._alerts = [];
    this._dismissing = null;
    this._household = [];
    this._hhFolded = readFlag("home3d.hhFolded");
    this._binInfo = null;
    this._gangMenu = null;
    this.householdCard = true;
    this.rackCards = true;
    this._rackRows = null;
    this.scenes = true;
    this._sceneFired = null;
    this.dimmed = false;
    this.autoOrbit = false;
    this.startView = null;
    this.cameraWall = false;
    this.holograms = null;
    this.doorPins = false;
    try {
      this._flows = localStorage.getItem("home3d.flows") === "1";
      this._legendMin = localStorage.getItem("home3d.legendMin") === "1";
      this._holoShow = localStorage.getItem("home3d.holos") !== "0";
      this._energyFold = localStorage.getItem("home3d.energy_fold") === "1";
    } catch {
      this._energyFold = false;
      this._flows = false;
      this._legendMin = false;
      this._holoShow = true;
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.listenReplay();
    // the opt-in reports sample the frame rate the viewer measures for its stats anyway
    if (this.hasUpdated) {
      this.observeStage();
      if (!this.viewer) void this.start();
      // back in the page: the trail's history is fetched again (its timer stopped while away)
      this.watchTrail();
    }
    document.addEventListener("visibilitychange", this.onVisible);
    this.watchAsk();
    this.endStyleAt(this._styleOverride);
  }

  /** Listens to the sentences Assist and the service `home_3d.ask` hand to the views (once the connection is there). */
  private watchAsk(): void {
    const hass = this.hass;
    if (this.unsubAsk || !hass?.connection || !this.isConnected) return;
    this.askScreen = (this.screen ?? "").trim();
    this.unsubAsk = subscribeAsk(hass, this.askScreen, (ask) => void this.onAsk(ask), (st) => this.onStyle(st)).catch(() => {
      // a replay or an older backend: nothing to listen to
      this.unsubAsk = null;
      return async () => {};
    });
  }

  /** Names per style id for matching a word to a style: the localised ones and an own style's name. */
  private styleNames(): Record<string, string[]> {
    const names: Record<string, string[]> = {};
    for (const s of allStyles()) names[s.id] = [s.name ?? translate(this.hass, `style_${s.id}` as I18nKey)];
    return names;
  }

  /** Keeps a style set from outside for this device ("" or "reset": back to the setting); a word naming no style changes nothing. */
  private setStyleOverride(style: string, minutes: number | null): string | null {
    const next = overrideFor(style, minutes, Date.now(), this.styleNames());
    if (next === undefined) return null;
    this._styleOverride = next;
    keepOverride(next);
    this.endStyleAt(next);
    return next?.style ?? "";
  }

  /** The style set from outside ends when its time is up, with no other change to wake the view. */
  private endStyleAt(o: StyleOverride | null): void {
    clearTimeout(this.styleTimer);
    this.styleTimer = undefined;
    if (o?.until) this.styleTimer = setTimeout(() => this.setStyleOverride("reset", null), Math.min(o.until - Date.now(), 2 ** 31 - 1) + 50);
  }

  /** The action `home_3d.set_style` for the open screens: this view when it is named, or when none is. */
  private onStyle(st: ScreenStyle): void {
    if (this.replay || !styleIsForScreen(st.screens, this.screen)) return;
    this.setStyleOverride(st.style, st.minutes ?? null);
  }

  private unwatchAsk(): void {
    const sub = this.unsubAsk;
    this.unsubAsk = null;
    void sub?.then((unsub) => unsub()).catch(() => undefined);
  }

  /**
   * A finger on the house turns, moves and zooms it – nothing else: Home Assistant's dashboard would otherwise take
   * a swipe for a change of view and the iPad's browser for a step back (#635, #633).
   */
  private keepTouch = (e: TouchEvent): void => {
    e.stopPropagation();
  };

  /** A wall tablet's screen on again: stale day curves are fetched at once. */
  private onVisible = (): void => {
    if (!document.hidden) this.holoRefetch?.();
  };

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.backLayers.closeAll();
    clearInterval(this.wireTimer);
    clearInterval(this.meterTimer);
    this.meterTimer = undefined;
    clearInterval(this.costTimer);
    this.costTimer = undefined;
    this.costFetch = null;
    this.wireKey = "";
    this.meterKey = "";
    this.costKey = "";
    document.removeEventListener("visibilitychange", this.onVisible);
    this.wallWin?.dispose();
    this.taps.cancel();
    this.stopWalk();
    this.pets?.dispose();
    this.pets = null;
    this.petsFor = null;
    this.dropVacuums();
    this.ghost?.dispose();
    this.ghost = null;
    this.season?.dispose();
    this.season = null;
    clearTimeout(this.seasonTimer);
    this.unlistenReplay?.();
    this.unlistenReplay = null;
    this.unwatchAsk();
    clearTimeout(this.styleTimer);
    this.styleTimer = undefined;
    clearInterval(this.clockTimer);
    this.clockTimer = undefined;
    clearTimeout(this.showTimer);
    this.showTimer = undefined;
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    clearInterval(this.alertTimer);
    this.alertTimer = undefined;
    clearTimeout(this.motionTimer);
    this.motionTimer = undefined;
    clearTimeout(this.redTimer);
    this.redTimer = undefined;
    clearInterval(this.cameraTimer);
    this.cameraTimer = undefined;
    this.live = null;
    clearInterval(this.trailTimer);
    this.trailTimer = undefined;
    clearInterval(this.holoTimer);
    this.holoTimer = undefined;
    clearTimeout(this.holoBigTimer);
    this.holoBigTimer = undefined;
    clearInterval(this.householdTimer);
    this.householdTimer = undefined;
    clearTimeout(this.fridgeTimer);
    clearTimeout(this.sensorTimer);
    this.sensorTimer = undefined;
    clearTimeout(this.directorTimer);
    clearTimeout(this.restTimer);
    clearTimeout(this.voiceTimer);
    this.directing.clear();
    this.pickupKey = "";
    // back in the page (another dashboard view and back), the day curves are fetched and kept fresh again (#527)
    this.holoIds = "";
    clearTimeout(this.flashTimer);
    this.flashTimer = undefined;
    clearTimeout(this.infoTimer);
    this.viewer?.dispose();
    this.viewer = null;
  }

  protected firstUpdated(): void {
    this.observeStage();
    // the microphone probe lives in the voice bundle: it shows once that has loaded
    if (this._micProbe) loadVoice().catch(() => (this._micProbe = false));
    // a touch means someone uses the screen: the director leaves them the view (a shot on screen stays)
    const touched = () => this.directing.touch(Date.now());
    this.addEventListener("pointerdown", touched, { passive: true });
    this.addEventListener("wheel", touched, { passive: true });
    // the mouse wheel over a hologram card zooms the view like anywhere else on the stage (#239)
    this.renderRoot.addEventListener(
      "wheel",
      (e) => {
        const ev = e as WheelEvent;
        if (!(ev.target as Element | null)?.closest?.(".fp3d-holo")) return;
        const canvas = this.renderRoot.querySelector("canvas");
        if (!canvas) return;
        ev.preventDefault();
        canvas.dispatchEvent(new WheelEvent("wheel", ev));
      },
      { passive: false },
    );
    void this.start();
  }

  /** Follows the stage's width: the floor pictures shrink on narrow screens. */
  private observeStage(): void {
    const stage = this.renderRoot.querySelector(".fp3d-stage");
    if (!stage || this.resizeObs || typeof ResizeObserver !== "function") return;
    this.resizeObs = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 1000;
      const narrow = width < 700;
      const phone = isPhoneWidth(width);
      if (phone !== this._phoneStage) {
        this._phoneStage = phone;
        this._thumbsCompact = thumbsCompact(this.thumbsSaved, phone);
      }
      if (narrow === this._narrowStage) return;
      this._narrowStage = narrow;
      this.scheduleThumbs();
    });
    this.resizeObs.observe(stage);
  }

  private async start(): Promise<void> {
    if (this.starting || this.viewer) return;
    this.starting = true;
    const flat = this.plan2d;
    try {
      const mod = flat ? await load2d() : await load3d();
      // switched between 2D and 3D while loading: the other one starts instead
      if (!this.isConnected || flat !== this.plan2d) return;
      const host = this.renderRoot.querySelector(".fp3d-stage") as HTMLElement;
      // a tap into the 3D view closes the star menu, like any menu (#220)
      host.addEventListener("pointerdown", (e) => {
        if (this._central && !(e.target as Element | null)?.closest?.(".fp3d-central, .fp3d-central-btn")) this._central = false;
        if (this._info) this._info = null;
      });
      this.viewer = mod.createViewer(host, {
        quality: this.quality,
        explode: this.explode,
        onRoomTap: (floorId, roomId) => this.fire("room-tap", { floorId, roomId }),
        onFloorTap: (floorId) => this.fire("floor-tap", { floorId }),
        floorInfo: (floor) =>
          floor.rooms.length === 1 ? translate(this.hass, "floor_rooms_one") : translate(this.hass, "floor_rooms", { n: floor.rooms.length }),
        onBack: () => this.fire("back", {}),
        onDeviceTap: (id, x, y) => this.onDeviceTap(id, x, y),
        onRackTap: (id, draw, slot) => this.showRackView(id, draw, slot),
        onDeviceHold: (id, x, y) => this.onDeviceHold(id, x, y),
        onDeviceHover: (id, x, y) => this.onModelHover(id, x, y),
        onDeviceDoubleTap: (id) => !this.ro && this.taps.doubleTap(id),
        onRoomDoubleTap: (floorId, roomId) => this.onRoomDoubleTap(floorId, roomId),
        onDeviceSwipe: (id, phase, dy, x, y) => this.onDeviceSwipe(id, phase, dy, x, y),
        onFurnitureSelect: (id) => this.fire("furniture-select", { id }),
        onFurnitureMove: (id, x, z) => this.fire("furniture-move", { id, x, z }),
        onDeviceSelect: (id) => this.fire("device-select", { id }),
        onDeviceMove: (id, x, z) => this.fire("device-move", { id, x, z }),
        // stats can be switched on at any time; they only cause updates while shown
        onStats: (s) => {
          if (this.showStats) this._stats = s;
        },
      });
      this.viewer.setWallMode(this.wallMode);
      this.viewer.setKeepView(this.keepView);
      this.viewer.setAngleLock(this.angleLock);
      this.viewer.setWindowSpill(this.windowSpill);
      this.viewer.setSunHeight(this.sunHeight);
      this.viewer.setStyle(this.effectiveStyle());
      this.viewer.setDescription((this.sceneLabel = translate(this.hass, flat ? "sr_plan" : "sr_scene")));
      this.viewer.setAccent(this.accent ?? null);
      this.viewer.setFurnishMode(this.furnish);
      this.viewer.setSurfaceGrab(this.surfaceGrab ?? null);
      this.viewer.setFurnishTypes(this.furnishTypes ?? null);
      this.viewer.setAnchorCallback((i, x, y, on, scale, facing) => this.placeHolo(i, x, y, on, scale, facing));
      this.viewer.setFloorStack(this.floorStack);
      this.viewer.setStats(this.showStats);
      this.viewer.setAutoOrbit(this.autoOrbit ? 0.06 : 0);
      this.viewer.setKeepRoof(this.keepRoof);
      this.viewer.setHideRoof(this.hideRoof);
      this._low = this.viewer.low;
      this.viewer.setPacks([...getPacks()], getPlanRecipes());
      if (this.hass) void syncModules(this.hass, getPacks()).then(() => this.syncDevicesSoon());
      this.shownPacks = packsVersion();
      // the open floor is the one built first (run 6 speed)
      this.viewer.setFloor(this.floorId, false);
      if (this.building) {
        this.shownStartView = JSON.stringify(this.startViewOf());
        this.viewer.setStartView(this.startViewOf());
        this.viewer.setBuilding(this.viewPlan(this.building));
      }
      this.scheduleThumbs();
      this.syncDevicesSoon();
      void this.syncPets();
      void this.syncVacuums();
      void this.syncGhost();
      void this.syncSeason();
      this.viewer.setFloor(this.floorId, false);
      if (this.roomId) this.viewer.selectRoom(this.roomId);
    } catch (err) {
      this._error = String(err);
    } finally {
      this.starting = false;
      if (this.isConnected && !this.viewer && flat !== this.plan2d) void this.start();
    }
  }

  private deviceSyncQueued = false;

  /**
   * The devices synced in a task of their own (run 6 speed), once for any number of asks before it: on the 3D view's
   * start (the viewer models the floors in slices meanwhile) and when the modules have synced.
   */
  private syncDevicesSoon(): void {
    if (this.deviceSyncQueued) return;
    this.deviceSyncQueued = true;
    void nextTask().then(() => {
      this.deviceSyncQueued = false;
      if (this.viewer && this.isConnected) this.syncDevices(true);
    });
  }

  /** Between the 2D plan and the 3D view (#41): the one shown goes, the other starts with everything it shows. */
  private switchViewer(): void {
    this.stopWalk();
    this.pets?.dispose();
    this.pets = null;
    this.petsFor = null;
    this.dropVacuums();
    this.ghost?.dispose();
    this.ghost = null;
    this._through = null;
    this._menu = null;
    this._popup = null;
    this.viewer?.dispose();
    this.viewer = null;
    this.shownPacks = -1;
    this._thumbs = [];
    this.thumbsAt = 0;
    this._error = null;
    void this.start();
  }

  /**
   * A new `hass` that changes no state the last update read and none the 3D scene shows (most of the several a second
   * on a wall tablet) skips the whole update (#177): render, device sync and director. The quick menu, the microphone
   * probe and a camera's live player still get it, as a render would have handed it to them.
   */
  protected shouldUpdate(changed: PropertyValues): boolean {
    const old = changed.get("hass") as HomeAssistant | undefined;
    const hass = this.rawHass;
    // a replay ticks with updates of its own: it is never skipped
    // robot vacuum maps (#350): their markers follow every new state, rendered or not
    if (changed.has("hass")) this.vacuums?.setHass(hass);
    if (changed.size !== 1 || !changed.has("hass") || !old || !hass || this.replay) return true;
    // (so the show/hide check below only runs live, with the clock; a replay returned above and syncs with its own moment, #394)
    // beside the editor's plan (#389): a new hass alone updates the view at most once every `syncPace` ms (trailing),
    // whatever it changed – power sensors tick many times a second in a large home
    if (this.syncPace > 0 && this.pacedHold(old)) {
      forwardHass(this.renderRoot, HASS_CHILDREN["components/view3d.ts"], [[old, hass]]);
      return false;
    }
    if (this.hassWatch.matters(old, hass)) return this.pacedPass();
    if (old.states !== hass.states) {
      // what the scene shows (syncDevices notes no reads, see there): the watched entities and the items shown only
      // while a state holds (#15)
      if (this.watched.some((id) => old.states[id] !== hass.states[id])) return this.pacedPass();
      const b = this.building;
      if (b && !this.furnish && this.shownPlan?.from === b && planHiddenItems(b, hass.states, new Date()).join("|") !== this.shownPlan.hidden) return true;
    }
    forwardHass(this.renderRoot, HASS_CHILDREN["components/view3d.ts"], [[old, hass]]);
    if (this.live?.el) this.live.el.hass = hass;
    return false;
  }

  /** A paced hass update held back: the oldest hass it was not shown yet (the comparisons start there) and its timer. */
  private pacedOld: HomeAssistant | undefined;
  private pacedTimer: ReturnType<typeof setTimeout> | undefined;
  private pacedAt = -Infinity;

  /**
   * Whether a new hass alone waits (#389): within `syncPace` ms of the last hass update that went through, it is held,
   * and one update follows when the pace is over, with the hass of then compared with the oldest held one.
   */
  private pacedHold(old: HomeAssistant): boolean {
    const wait = pacedSyncDelay(performance.now() - this.pacedAt, this.syncPace);
    if (wait <= 0 && !this.pacedTimer) return false;
    this.pacedOld ??= old;
    this.pacedTimer ??= setTimeout(() => {
      this.pacedTimer = undefined;
      const from = this.pacedOld;
      this.pacedOld = undefined;
      // the held hass counts as just let through; one that changed nothing shown is still skipped by shouldUpdate
      this.requestUpdate("hass", from);
    }, Math.max(wait, 0));
    return true;
  }

  /** A hass update goes through: the pace counts from now. */
  private pacedPass(): true {
    if (this.syncPace > 0) this.pacedAt = performance.now();
    return true;
  }

  /** The update ends here (after `updated`): see willUpdate. */
  protected performUpdate(): void {
    try {
      super.performUpdate();
    } finally {
      this.hassWatch.end();
    }
  }

  protected willUpdate(changed: PropertyValues): void {
    // the states read from here to the end of `updated` decide whether the next hass needs an update (#177); an update
    // without a new hass runs only part of that work, so it adds to what the last one read
    this.hassWatch.begin(!changed.has("hass"));
    // this bundle's own copy of the ground: lamps and markers on a sloped lawn sit on it
    if (changed.has("home")) this.pictureUrls.clear();
    if (changed.has("building")) {
      setTerrain(this.building ?? null);
      setCameraSensors(this.building);
      // the plan's own styles resolve by id and by name from here on (#441)
      setCustomStyles(this.building?.settings?.styles_custom);
    }
    // waste bins start from the colours usual in the Home Assistant's country
    if (changed.has("hass") && this.hass) setHouseholdCountry(hassCountry(this.hass));
  }

  /** Back closes a device's controls, a sheet, a rack's front, the star menu and a socket's menu first (#322): in the panel only, never on a dashboard. */
  private readonly backLayers = new BackLayers("view3d", navHosted);

  private syncBack(changed: PropertyValues): void {
    const { _menu: menu, _sheet: sheet, _rackView: rack, _gangMenu: gang } = this;
    const rows: Parameters<BackLayers["syncAll"]>[0] = [];
    const row = (prop: string, ...r: (typeof rows)[number]) => changed.has(prop) && rows.push(r);
    row("_menu", "menu", !!menu, () => (this._menu = null), menu ? () => (this._menu = menu) : undefined);
    row("_sheet", "sheet", !!sheet, () => (this._sheet = null), sheet ? () => (this._sheet = sheet) : undefined);
    row("_rackView", "rack", !!rack, () => (this._rackView = null), rack ? () => (this._rackView = rack) : undefined);
    row("_gangMenu", "gang", !!gang, () => (this._gangMenu = null), gang ? () => (this._gangMenu = gang) : undefined);
    row("_central", "central", this._central, () => (this._central = false), () => (this._central = true));
    // Back ends a walk (#351)
    row("_walk", "walk", !!this._walk, () => this.stopWalk());
    this.backLayers.syncAll(rows);
  }

  protected updated(changed: PropertyValues): void {
    this.syncBack(changed);
    // the camera wall as a free window (#314): its place and size are put on the element after each render
    this.wallWin?.attach(this.renderRoot.querySelector<HTMLElement>(".fp3d-wall"));
    // the chrome goes light with the Day look (#85): the shared tokens read the attribute, nested parts inherit it
    if (changed.has("hass") || changed.has("theme") || changed.has("themeEvening") || changed.has("themeNight") || changed.has("styleEntity") || changed.has("_styleOverride")) {
      this.toggleAttribute("light", lightChrome(this.effectiveTheme()));
      this.toggleAttribute("contrast", contrastChrome(this.effectiveTheme()));
    }
    if (changed.has("plan2d") && changed.get("plan2d") !== undefined) this.switchViewer();
    if (changed.has("hass") && this.live?.el) this.live.el.hass = this.rawHass;
    if (changed.has("screen") && this.unsubAsk && (this.screen ?? "").trim() !== this.askScreen) this.unwatchAsk();
    if (changed.has("hass") || changed.has("screen")) this.watchAsk();
    // the star menu closes when a room or another floor is chosen (#220)
    if (this._central && ((changed.has("roomId") && changed.get("roomId") !== undefined) || (changed.has("floorId") && changed.get("floorId") !== undefined))) this._central = false;
    const v = this.viewer;
    if (!v) return;
    // a room or floor chosen elsewhere ends the look through a camera (the view is theirs now)
    if (this._through && (changed.has("roomId") || changed.has("floorId"))) {
      if (this.floorId === this.throughFloor) this.throughFloor = null;
      else this._through = null;
    }
    // however the look through a camera ended, the view gets its own field of view back
    if (changed.has("_through") && !this._through && changed.get("_through")) v.endLook();
    // new packs, parked cars and the plan itself each rebuild the scene: handed over together (a home switch brings
    // all three), it is built once (#131)
    let startChanged = false;
    let packsNew = false;
    // beside the editor's plan an edited floor is modelled in slices (#390)
    (v as { slicedEdits?: boolean }).slicedEdits = this.syncPace > 0;
    v.batch(() => {
      // packs arrive with the building (or after an import): the viewer rebuilds pack furniture
      if (this.shownPacks !== packsVersion()) {
        this.shownPacks = packsVersion();
        v.setPacks([...getPacks()], getPlanRecipes());
        if (this.hass) void syncModules(this.hass, getPacks()).then(() => this.syncDevices(true));
        // vehicles in parking spots come from packs too: look them up again now that the packs are here
        if (this.hass && this.building) v.setParked(parkedVehicles(this.hass, this.building));
        // a feature pack may have arrived with them (energy feature): the cables and modules follow (the sync below)
        packsNew = true;
      }
      if (changed.has("building") && this.building) {
        // an own style changed (#441): setStyle ignores one that looks the same
        v.setStyle(this.effectiveStyle());
        // a new start view (just remembered in the editor) shows right away in the house view
        const start = JSON.stringify(this.startViewOf());
        startChanged = this.shownStartView !== undefined && this.shownStartView !== start;
        this.shownStartView = start;
        v.setStartView(this.startViewOf());
        v.setBuilding(this.viewPlan(this.building));
      }
      if (changed.has("building") || changed.has("packs") || changed.has("petsOn")) void this.syncPets();
      if (changed.has("building") || changed.has("vacuumMaps")) void this.syncVacuums();
      if (changed.has("building") || changed.has("packs") || changed.has("ghostOn")) void this.syncGhost();
      if (changed.has("building") || changed.has("ghostOn")) void this.syncSeason();
      if (changed.has("startView") && changed.get("startView") !== undefined) {
        v.setStartView(this.startViewOf());
        if (this.floorId === null) v.resetView();
      }
      if (changed.has("building") || changed.has("theme") || changed.has("floorThumbs") || changed.has("packs")) this.scheduleThumbs();
      // with symbols only in rooms, opening or closing a room changes which ones show
      const forced = ["building", "hiddenTypes", "furnitureOn", "markerMode", "heatMode", "flows", "alerts", "dimmed", "doorPins"].some((k) => changed.has(k)) || (this.markerMode === "room" && changed.has("roomId"));
      // time travel: a tick moves the clock even when no replayed state changed – the trail and a camera's
      // detections follow it (one sync per tick at most, and only when they are shown)
      const ticked = this.replayTicked && !!this.replay;
      this.replayTicked = false;
      if (forced || packsNew || changed.has("hass") || ticked) this.syncDevices(forced || packsNew, ticked && (this.trail || this.detecting));
    });
    if (startChanged && this.floorId === null) v.resetView();
    if (changed.has("hass") || changed.has("director")) this.direct();
    if (changed.has("autoOrbit")) v.setAutoOrbit(this.autoOrbit ? 0.06 : 0);
    v.setFitMargin(this._phoneStage ? PHONE_FIT_MARGIN : NO_FIT_MARGIN);
    if (changed.has("_thumbs") || changed.has("_narrowStage")) v.setLabelInset(this._thumbs.length ? (this.narrowThumbs ? 136 : 184) : 0);
    if (changed.has("plan2d") || changed.has("hass") || !this.sceneLabel) {
      const label = translate(this.hass, this.plan2d ? "sr_plan" : "sr_scene");
      if (label !== this.sceneLabel) v.setDescription((this.sceneLabel = label));
    }
    if (changed.has("floorId")) v.setFloor(this.floorId);
    if (changed.has("roomId") && (this.roomId || changed.get("roomId"))) v.selectRoom(this.roomId);
    if (changed.has("wallMode")) v.setWallMode(this.wallMode);
    if (changed.has("keepView")) v.setKeepView(this.keepView);
    if (changed.has("angleLock")) v.setAngleLock(this.angleLock);
    if (changed.has("windowSpill")) v.setWindowSpill(this.windowSpill);
    if (changed.has("sunHeight")) v.setSunHeight(this.sunHeight);
    if (changed.has("explode")) v.setExplode(this.explode);
    if (changed.has("keepRoof")) v.setKeepRoof(this.keepRoof);
    if (changed.has("hideRoof")) v.setHideRoof(this.hideRoof);
    if (changed.has("floorStack")) v.setFloorStack(this.floorStack);
    // a look that follows HA's theme or the sun changes with hass alone (#85: a theme switch moves no watched entity,
    // so waiting for syncDevices left the scene neon under a Day sky); setTheme ignores a look it already shows
    if (changed.has("hass") && !changed.has("theme") && this.followsClock()) {
      const look = this.effectiveTheme();
      v.setStyle(this.effectiveStyle());
      // the floor pictures beside the view are drawn in the look too
      if (look !== shownLook(this.theme, changed.get("hass") as HomeAssistant | undefined, this.building?.settings as StylePlan | undefined, this.cardStyle())) this.scheduleThumbs();
    }
    // the newest setting wins: a style chosen anew for this screen (device, card) ends one set by voice or an action (#442)
    const restyled = (["theme", "themeEvening", "themeNight"] as const).some((k) => changed.has(k) && changed.get(k) !== undefined);
    if (restyled && this._styleOverride) this.setStyleOverride("reset", null);
    if (changed.has("theme") || changed.has("themeEvening") || changed.has("themeNight") || changed.has("styleEntity") || changed.has("_styleOverride")) {
      v.setStyle(this.effectiveStyle());
      // the realistic look's sky and the fog colour follow at once
      if (!changed.has("hass")) this.syncDevices(true);
    }
    if (changed.has("accent")) v.setAccent(this.accent ?? null);
    if (changed.has("surfaceGrab")) v.setSurfaceGrab(this.surfaceGrab ?? null);
    if (changed.has("furnishTypes")) v.setFurnishTypes(this.furnishTypes ?? null);
    if (changed.has("furnish")) {
      v.setFurnishMode(this.furnish);
      this.syncDevices(true);
    }
    if (changed.has("selectedFurniture")) v.selectFurniture(this.selectedFurniture);
    if (changed.has("selectedSet")) v.selectFurnitureSet(this.selectedSet ?? []);
    if (changed.has("selectedDevice")) v.setSelectedDevice(this.selectedDevice);
    if (changed.has("trail") || changed.has("replay")) this.watchTrail();
    if (changed.has("replay")) {
      this.listenReplay();
      if (!this.replay) this._info = null;
    }
    if (changed.has("weather") || changed.has("weatherEntityId")) this.syncDevices(true);
    if (changed.has("quality") && changed.get("quality") !== undefined) {
      v.setQuality(this.quality);
      this._low = v.low;
      // a replay ticks as often as the new quality allows
      this.replay?.setQuality(this.quality, v.low);
    }
    if (changed.has("showStats")) v.setStats(this.showStats);
    if (changed.has("building")) this.findIndex = null;
  }

  /** The ids of the items the View hides now; the very same set while nothing changed (the viewer compares it by identity). */
  private hiddenItemSet(b: Building): ReadonlySet<string> {
    const links = this.furnitureLinks;
    const ids = hiddenItemIds(b, this.hiddenTypes, this.furnitureOn, (f) => {
      const e = links?.get(f.id)?.entity ?? f.entity ?? null;
      return e === "none" ? null : e;
    });
    // items an entity's state hides (#338) collapse like the View's hidden kinds: no rebuild; the editor keeps them in sight
    if (!this.furnish && this.hass) for (const id of stateHiddenItems(b, this.hass.states)) ids.add(id);
    const sig = [...ids].sort().join("|");
    if (sig !== this.hiddenIds.sig) this.hiddenIds = { sig, ids };
    return this.hiddenIds.ids;
  }

  /** A pin or lamp of a hidden kind, or of a hidden item. */
  private markerHidden(m: { id: string; furnitureId?: string }, items: ReadonlySet<string>, contacts?: ReadonlySet<string>): boolean {
    if (m.furnitureId && items.has(m.furnitureId)) return true;
    // a contact sensor linked to a door or window shows on the opening itself, not as a pin (#349)
    if (contacts?.has(m.id)) return true;
    const kind = typeOfEntity(m.id);
    return kind !== null && this.hiddenTypes.has(kind);
  }

  /**
   * Send device markers, door/window states, energy cables, people and floor label texts to the viewer
   * when a watched entity changed (or the building). Openings are matched with entities again when
   * the building or the entity registry changes.
   */
  private syncDevices(force: boolean, timed = false): void {
    // a sync during an update notes no reads (#177): whether a new hass needs one is `watched` (shouldUpdate checks it),
    // and a full sync reads far more states than it shows (the locating goes through all of them)
    if (this.hassWatch.recording) return this.hassWatch.pause(() => this.syncDevices(force, timed));
    const v = this.viewer;
    const full = this.building;
    if (!v || !full || !this.hass) return;
    const hass = this.hass;
    // seasonal and conditional items (#15): one came or went – the viewer gets the plan without the hidden ones
    const before = this.shownPlan?.plan;
    const b = this.viewPlan(full);
    if (b !== before) {
      v.setBuilding(b);
      force = true;
    }
    if (hasTimedRules(full) && !this.replay) this.showTimer ??= setTimeout(() => {
      this.showTimer = undefined;
      this.syncDevices(false);
    }, 60050 - (Date.now() % 60000));
    if (force || !this.openingLinks || this.linkedRegistry !== hass.entities) {
      this.openingLinks = openingEntities(hass, b.floors);
      this.furnitureLinks = furnitureEntities(hass, b.floors);
      // what asks before it switches: the plan and the registry decide it, not the states (found once, not per sync, #389)
      this.confirmSet = confirmEntities(hass, b.floors);
      this.linkedRegistry = hass.entities;
      this.findIndex = null;
      this.alertSrc = this.alerts ? alertSources(hass, b, this.weatherEntityId) : null;
      this.watchHousehold(hass, b);
      this.watched = watchedEntities(hass, b, {
        openings: this.openingLinks,
        furniture: this.furnitureLinks,
        heat: this.heatMode !== "none" || this.roomLabels,
        warnings: this.alertSrc ? alertEntities(this.alertSrc) : [],
        weatherEntityId: this.weatherEntityId,
      });
      if (anyModule()) this.watched = [...new Set([...this.watched, ...moduleWatched(this.sceneHost(hass, b))])];
      force = true;
    }
    let changed = force || timed;
    // only measured values changed (sensor.*: power, temperature …), nothing switched, opened or alarmed
    let sensorsOnly = !changed;
    if (!changed) {
      for (const id of this.watched) {
        if (this.shownStates.get(id) === hass.states[id]) continue;
        changed = true;
        if (!id.startsWith("sensor.")) {
          sensorsOnly = false;
          break;
        }
      }
    }
    // time travel: after a jump doors and blinds stand at once instead of swinging there
    const jump = !!this.replay && this.replay.seek !== this.seenSeek;
    this.seenSeek = this.replay?.seek ?? 0;
    this.seenT = this.replay?.t ?? 0;
    if (!changed) return;
    // beside the editor's plan the states are context only: one sync at most every `syncPace` ms, so the input never
    // waits behind a run of them (#389)
    if (!force && !timed && this.syncPace > 0 && !this.replay) {
      // measured values alone (power, energy …) at most every EDITOR_SENSOR_SYNC_MS there (#393), as on the tablet level
      const wait = pacedSyncDelay(performance.now() - this.lastSync, sensorsOnly ? Math.max(this.syncPace, EDITOR_SENSOR_SYNC_MS) : this.syncPace);
      if (wait > 0) {
        this.sensorTimer ??= setTimeout(() => {
          this.sensorTimer = undefined;
          this.syncDevices(false);
        }, wait);
        return;
      }
    }
    // a change of measured values alone is shown at most once a second, every 2 s on the tablet level (power sensors
    // tick several times a second and each sync redoes markers, light, cables and cards, #131); a switch, door or
    // alarm shows at once
    if (sensorsOnly && !this.replay) {
      const wait = sensorSyncDelay(performance.now() - this.lastSync, this._low);
      if (wait > 0) {
        this.sensorTimer ??= setTimeout(() => {
          this.sensorTimer = undefined;
          this.syncDevices(false);
        }, wait);
        return;
      }
    }
    this.lastSync = performance.now();
    const began = this.showStats ? performance.now() : 0;
    this.shownStates = new Map(this.watched.map((id) => [id, hass.states[id]]));

    // what the modules add to the stage (the pool module: the water, the water in the pipes, the glow of the technical room)
    this.scene = anyModule() ? moduleScene(this.sceneHost(hass, b)) : [];
    // the energy devices' own sensors: no consumers (#43)
    const devices = deviceSensors(b, (f) => this.furnitureLinks?.get(f.id)?.power ?? null);
    const consumers = findConsumers(hass, b, devices);
    const now = this.now();
    const deviceMarkers = buildMarkers(hass, b, now);
    // a camera that saw motion stays red for the set time: the view looks again when the first one turns back
    clearTimeout(this.redTimer);
    this.redTimer = undefined;
    if (!this.replay) {
      const hold = effectSettings(b).camera_seconds * 1000;
      const next = Math.min(...deviceMarkers.filter((m) => m.motion).map((m) => cameraRedUntil(hass, m.id, hold, now) ?? Infinity));
      if (Number.isFinite(next)) this.redTimer = setTimeout(() => this.syncDevices(true), Math.max(50, next - now + 20));
    }
    const furniture = this.furnitureMarkers(hass, b, new Set(deviceMarkers.map((m) => m.id)), new Set(consumers.map((c) => c.powerEntity)));
    consumers.push(...furniture.consumers);
    this.lastConsumers = consumers;
    const summary = energySummary(hass, b, consumers, devices);
    // a placed power sensor shows its value as state text already, so only devices get a watt badge
    const byDevice = new Map(consumers.filter((c) => c.id !== c.powerEntity).map((c) => [c.id, c.power]));
    const trail = this.trail ? this.trailNow(hass, b) : [];
    const detections = !this.dimmed ? this.detectionPins(hass, deviceMarkers) : [];
    this.detecting = detections.length > 0;
    // Cars: spots whose car stands there get a card, so their pin steps aside
    const carSpots = new Set(
      b.floors.flatMap((fl) => fl.furniture.filter((f) => f.type === "parking" && f.car && parkedVehicle(hass, f)).map((f) => f.id)),
    );
    // the kinds the View hides (#268, #269): the items collapse in place, their pins and lamps are left out
    const hiddenItems = this.hiddenItemSet(b);
    v.setHiddenItems(hiddenItems);
    const linkedContacts = this.doorPins || this.furnish ? undefined : linkedContactIds(this.openingLinks?.values() ?? []);
    const placed = [...deviceMarkers, ...furniture.markers, ...this.lockMarkers(hass, b)];
    // where a tap can reach (#454): built when a tap needs it
    this.whereInput = { building: b, markers: placed, furnitureTargets: furniture.targets, openingTargets: this.openingTargets() };
    this.whereCache = null;
    v.setDevices([
      ...placed.filter((m) => !this.markerHidden(m, hiddenItems, linkedContacts)).map((m) => {
        // "without watts" drops the power badge (a plug shows only on / off)
        // below an item's own "running from" watts the standby draw is no badge either (#645)
        const power = m.show === "no_power" || ("energyDevice" in m && m.energyDevice) || ("standby" in m && m.standby) ? null : (byDevice.get(m.id) ?? null);
        // at night (kiosk) colour effects rest
        const marker = { ...m, power, powerText: power === null ? undefined : formatPower(hass, power), effect: this.dimmed ? false : m.effect };
        // the own name under the pin: per device, or for every named device (card option marker_names)
        const caption = m.ownName && (m.showName || this.markerNames) ? m.ownName : "";
        // Klang & Kino: while a card floats over the speaker, its pin steps aside (it comes back when the music stops)
        const carded = this.mediaCardUp(hass, m.id) || (!!m.furnitureId && carSpots.has(m.furnitureId));
        // a lock at its door asks for its text itself (full): the symbol mode does not take that away
        return { ...marker, pin: (this.plan2d ? pinIn2d(marker, this.markerMode, this.showPin(marker)) : this.showPin(marker)) && !carded, full: m.show === "always" || m.full === true, caption };
      }),
      // Energy: the street end of the grid cable carries a pin with what comes in or goes out
      ...((this.flows ?? this._flows) && !this.dimmed && summary.grid !== null ? [this.gridPin(hass, b, summary.grid)] : []).filter((m): m is NonNullable<typeof m> => !!m),
      // Kamera-Cockpit: what a camera detects right now stands in front of it as a pin
      ...detections,
      // trail spots carry a pin with the time of the motion; the same sensor again stacks its pins
      ...trail.map((p, i) => ({
        id: `trail:${i}`,
        floorId: p.floorId,
        roomId: null,
        x: p.x,
        z: p.z,
        y: 0.3 + 0.4 * trail.slice(0, i).filter((q) => q.entity === p.entity).length,
        icon: TRAIL_ICON,
        name: entityName(hass, p.entity),
        text: trailTime(hass, p.time),
        active: false,
        unavailable: false,
        glow: null,
        pin: true,
      })),
      // a module's symbol on its furniture (a technical device it shows); a tap opens the module's card
      ...this.moduleMarkers(b),
    ]);
    // a tap on the item itself does what a tap on its module marker does
    for (const m of this.scene) if (m.kind === "marker" && m.card && m.furnitureId && !furniture.targets.has(m.furnitureId)) furniture.targets.set(m.furnitureId, `module:${m.id}`);
    v.setTrail(trail, this.replay ? this.robotPaths(hass, b) : []);
    // own actions (#6): an item without an entity becomes tappable as "item:<id>"
    this.actionOwners = actionIndex(b.floors, (id) => furniture.targets.get(id), (f) => {
      const e = this.furnitureLinks?.get(f.id)?.entity;
      return e && e !== "none" ? e : null;
    });
    for (const floor of b.floors) for (const f of floor.furniture) if (!furniture.targets.has(f.id) && this.actionOwners.has(`item:${f.id}`)) furniture.targets.set(f.id, `item:${f.id}`);
    v.setPickTargets(furniture.targets, this.openingTargets());
    v.setScreens(furniture.screens);
    v.setFridgeDoors(fridgeDoors(hass, b.floors));
    // linked rack gear's status LEDs (#119): only colours change in 3D, never the racks' geometry
    v.setRackLeds(rackLedStates(hass, b.floors));
    v.setAwnings(awningStates(hass, b.floors));
    v.setProjections(this.projectedCameras(hass, b));
    v.setRobots(this.robotInfos(hass, b));
    // roof windows: sash and blind follow their contact and cover like windows do
    const roofWindows = new Map<string, { open: number; tilt: number; cover: number }>();
    for (const w of b.settings.roof?.windows ?? []) roofWindows.set(w.id, roofWindowState(hass, w));
    v.setRoofWindows(roofWindows);
    v.setParked(parkedVehicles(hass, b));
    v.setBinSpots(this.binSpots);
    v.setBinCues(this.binCues);
    const types = new Map(b.floors.flatMap((f) => f.openings.map((o) => [o.id, o.type] as const)));
    const openingStates = new Map([...this.openingLinks!].map(([id, e]) => [id, openingState(hass, e, types.get(id))]));
    v.setOpeningStates(openingStates, jump);
    const own = this.alertSrc ? findAlerts(hass, b, this.alertSrc, this.openingLinks!) : [];
    const modulesOn = this.alerts && anyModule();
    const fromModules = modulesOn ? moduleAlerts(this.sceneHost(hass, b)).map((a) => ({ kind: a.kind, entity: a.entity, roomId: a.roomId, floorId: a.floorId, text: a.text, color: a.color, quiet: !a.roomId })) : [];
    const active = [...own, ...fromModules];
    if (this.alertSrc) this.tidySnoozes(b, active, modulesOn);
    // dismissed warnings stay out of the banner, the rooms' pulse, the director and the voice answers (#138)
    this.setAlerts(shownAlerts(active, b.settings));
    // Household: an open fridge door warns once it stood open too long – look again at that moment
    clearTimeout(this.fridgeTimer);
    const fridgeWait = !this.replay ? nextFridgeCheck(b.floors.flatMap((f) => f.furniture), hass) : null;
    if (fridgeWait !== null) this.fridgeTimer = setTimeout(() => this.syncDevices(true), fridgeWait + 500);
    // the floor pictures follow lamps and blinds (not sensors), at most every few seconds
    const lampSig = floorPictureKey([...deviceMarkers, ...furniture.markers], openingStates);
    if (lampSig !== this.thumbSig) {
      const first = this.thumbSig === "";
      this.thumbSig = lampSig;
      if (!first) this.scheduleThumbs(1500);
    }
    // the battery cable ends at the home battery in the plan (older plans: at the placed battery sensor)
    const batteryPlaced =
      b.floors.flatMap((f) => f.furniture.filter((m) => energyRole(m.type) === "home_battery").map((m) => ({ floorId: f.id, x: m.x, z: m.z })))[0] ??
      (b.energy.battery ? b.floors.flatMap((f) => f.placements.filter((p) => p.entity_id === b.energy.battery).map((p) => ({ floorId: f.id, x: p.x, z: p.z })))[0] : null);
    const powers = fieldPowers(hass, b, summary.solar);
    // the holograms: the main one hangs over the chosen (else the biggest) solar field, moved as set up, and
    // every further plant (an inverter with fields of its own, say a balcony plant) gets a card over its field
    const holo = b.settings.roof.hologram ?? DEFAULT_HOLOGRAM;
    const fields = [...(b.settings.roof.solar ?? [])].sort((p, q) => q.rows * q.cols - p.rows * p.cols);
    const strings = b.settings.roof.strings ?? [];
    const inverterOf = (f: SolarField) => (f.string ? strings.find((x) => x.id === f.string)?.inverter : null) ?? null;
    // the house balance and the plant cards: the house view only, or also the floor of their field (#193)
    const plantViews = holo.plant_floor ? ("all" as const) : ("house" as const);
    const anchorOn = (f: SolarField, right: number, up: number, size: number) => {
      const face = fieldFace(b, f);
      if (!face) return null;
      const [fw, fd] = fieldSize(face, f);
      const u = f.u + fw / 2 + right;
      const sv = f.v + fd / 2 + up;
      const c: [number, number, number] = [face.o[0] + face.eu[0] * u + face.es[0] * sv, face.o[1] + face.eu[1] * u + face.es[1] * sv, face.o[2] + face.eu[2] * u + face.es[2] * sv];
      const floorId = face.wall?.floorId ?? (face.unbounded ? (b.floors.find((f) => f.elevation === Math.min(...b.floors.map((x) => x.elevation)))?.id ?? b.floors[0].id) : [...b.floors].sort((p, q) => q.elevation - p.elevation)[0].id);
      return { p: [c[0] + face.n[0] * 0.05, c[1] + face.n[1] * 0.05, c[2] + face.n[2] * 0.05] as [number, number, number], n: [face.n[0], face.n[1], face.n[2]] as [number, number, number], floorId, size, roof: true, views: plantViews };
    };
    const anchors: { p: [number, number, number]; n: [number, number, number]; floorId: string; size: number; roof: boolean; views: "house" | "all" | "floor"; room?: string | null; near?: number }[] = [];
    const cards: HoloCard[] = [];
    const anyEnergy = summary.grid !== null || summary.battery !== null || summary.solar !== null;
    const free = holo.place === "free" && Number.isFinite(holo.x) && Number.isFinite(holo.z);
    const first = summary.solar !== null && !free ? (fields.find((f) => f.id === holo.field) ?? fields[0]) : undefined;
    const mainInverter = first ? inverterOf(first) : null;
    // the plant whose field carries the main card keeps its own card on that field: the main card steps aside
    // (just right of the field) unless the editor moved it by hand
    const shared = !!first && !!mainInverter && !fields.some((f) => f.id !== first.id && inverterOf(f) === mainInverter) && holo.right === 0 && holo.up === 0;
    const sharedRight = (() => {
      if (!shared || !first) return 0;
      const face = fieldFace(b, first);
      return face ? fieldSize(face, first)[0] / 2 + 1.2 : 0;
    })();
    const mainAnchor = first ? anchorOn(first, holo.right + sharedRight, holo.up, holo.size) : null;
    const devicePower = this.devicePowers(hass, b);
    const solarIds = summary.solar !== null ? (b.energy.solar ? [b.energy.solar] : deviceSensors(b, (f) => this.furnitureLinks?.get(f.id)?.power ?? null).solar) : [];
    if (mainAnchor) {
      anchors.push(mainAnchor);
      cards.push({ kind: "main", name: translate(hass, "holo_title"), w: null, dayIds: solarIds, battery: null });
    } else if (anyEnergy && free) {
      // placed free in the plan: a point and a height, the card faces away from the house
      let cx = 0;
      let cz = 0;
      let n = 0;
      let ground = Infinity;
      let topFloor = b.floors[0];
      for (const f of b.floors) {
        if (f.rooms.length) ground = Math.min(ground, f.elevation);
        if (f.rooms.length && (!topFloor.rooms.length || f.elevation + f.height > topFloor.elevation + topFloor.height)) topFloor = f;
        for (const r of f.rooms) for (const [x, z] of r.points) {
          cx += x;
          cz += z;
          n++;
        }
      }
      if (n) {
        cx /= n;
        cz /= n;
      }
      const dx = holo.x! - cx;
      const dz = holo.z! - cz;
      const len = Math.hypot(dx, dz);
      anchors.push({ p: [holo.x!, (Number.isFinite(ground) ? ground : 0) + (holo.height ?? 3), holo.z!], n: len > 0.01 ? [dx / len, 0, dz / len] : [1, 0, 0], floorId: topFloor.id, size: holo.size, roof: true, views: plantViews });
      cards.push({ kind: "main", name: translate(hass, "holo_title"), w: null, dayIds: solarIds, battery: null });
    } else if (anyEnergy && b.floors.some((f) => f.rooms.length)) {
      // no solar field in the plan (a meter and a battery only): the hologram hangs beside the house
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      let top = 0;
      let topFloor = b.floors[0];
      for (const f of b.floors) {
        for (const r of f.rooms) for (const [x, z] of r.points) {
          x1 = Math.max(x1, x);
          z0 = Math.min(z0, z);
          z1 = Math.max(z1, z);
        }
        if (f.rooms.length && f.elevation + f.height > top) {
          top = f.elevation + f.height;
          topFloor = f;
        }
      }
      anchors.push({ p: [x1 + 0.6, top + 0.4, (z0 + z1) / 2], n: [1, 0, 0], floorId: topFloor.id, size: holo.size, roof: true, views: plantViews });
      cards.push({ kind: "main", name: translate(hass, "holo_title"), w: null, dayIds: solarIds, battery: null });
    }
    if (summary.solar !== null) {
      const seen = new Set<string>();
      for (const floor of b.floors) {
        for (const inv of floor.furniture.filter((m) => energyRole(m.type) === "inverter")) {
          // plant_card: false hides a plant's card (the editor's switch)
          if (inv.plant_card === false || seen.has(inv.id)) continue;
          seen.add(inv.id);
          // its card hangs on one of its own fields, preferably not the one the main card hangs on
          const own = fields.filter((f) => inverterOf(f) === inv.id);
          const field = (first && inv.id === mainInverter ? own.find((f) => f.id !== first.id) : null) ?? own[0];
          const sensor = this.furnitureLinks?.get(inv.id)?.power ?? null;
          const anchor = field ? anchorOn(field, inv.plant_right ?? 0, inv.plant_up ?? 0, holo.size * 0.85) : null;
          if (!anchor || !sensor) continue;
          // its battery: the nearest one on the same floor
          const bat = floor.furniture.filter((m) => energyRole(m.type) === "home_battery").sort((p, q) => Math.hypot(p.x - inv.x, p.z - inv.z) - Math.hypot(q.x - inv.x, q.z - inv.z))[0];
          const socRaw = bat?.soc && bat.soc !== "none" ? Number(hass.states[bat.soc]?.state) : NaN;
          anchors.push(anchor);
          cards.push({
            kind: "plant",
            name: inv.name || furnitureName(hass, inv.type),
            w: Math.max(0, readPower(hass.states[sensor]) ?? 0),
            dayIds: [sensor],
            battery: bat ? { soc: Number.isFinite(socRaw) ? socRaw : null, w: devicePower.get(bat.id) ?? null } : null,
          });
        }
      }
    }
    // device holograms: a small card over every device the editor marked, on its floor, in its room and – unless
    // switched off (#226) – in the house view
    const deviceViews = holo.device_house === false ? ("floor" as const) : ("all" as const);
    for (const floor of b.floors) {
      for (const f of floor.furniture) {
        if (!f.holo) continue;
        const sensor = this.furnitureLinks?.get(f.id)?.power ?? null;
        const c = consumers.find((k) => k.id === f.id);
        if (!sensor && !c) continue;
        // anchors are building coordinates: the floor's elevation plus the device's top on its floor (#151)
        const top = floor.elevation + mountBase(floor, f) + f.h;
        anchors.push({ p: [f.x, top + 0.1, f.z], n: [0, 1, 0], floorId: floor.id, size: holo.size * 0.7, roof: false, views: deviceViews, room: roomAt(floor, f.x, f.z) });
        cards.push({
          kind: "device",
          name: f.name || furnitureName(hass, f.type),
          w: c?.power ?? (sensor ? readPower(hass.states[sensor]) : null),
          dayIds: sensor ? [sensor] : [],
          battery: null,
        });
      }
      // placed devices too: a smart plug with its power (D178)
      for (const pl of floor.placements) {
        if (!pl.holo) continue;
        const sensor = powerSensorFor(hass, pl.entity_id);
        if (!sensor) continue;
        const top = floor.elevation + (pl.y ?? 0.4) + 0.2;
        anchors.push({ p: [pl.x, top, pl.z], n: [0, 1, 0], floorId: floor.id, size: holo.size * 0.7, roof: false, views: deviceViews, room: roomAt(floor, pl.x, pl.z) });
        cards.push({ kind: "device", name: pl.name || entityName(hass, pl.entity_id), w: readPower(hass.states[sensor]), dayIds: [sensor], battery: null });
      }
    }
    // Klang & Kino: a now-playing card over every speaker or media furniture that plays, rings around it,
    // and lines between the members of a multiroom group
    const sound: SoundSource[] = [];
    {
      const seenMedia = new Set<string>();
      // one card per TV or speaker group (#356): a first walk collects the players, the second draws
      let collect: MediaCandidate[] | null = [];
      let yields = new Set<string>();
      const holoSize = (b.settings.roof.hologram ?? DEFAULT_HOLOGRAM).size;
      const add = (floor: Building["floors"][number], id: string, x: number, z: number, top: number, name: string, tvItem = false, hostId?: string) => {
        const st = hass.states[id];
        if (!st || kindOf(id) !== "media") return;
        if (collect) {
          if (collect.some((c) => c.id === id)) return;
          const tvCard = tvItem || st.attributes.device_class === "tv";
          const host = hostId ?? hostAt(floor.furniture, x, z);
          const hostType = host ? floor.furniture.find((f) => f.id === host)?.type : undefined;
          const fn = st.attributes.friendly_name;
          const live = !isUnavailable(st);
          const rank = st.state === "playing" && live ? 5 : this.mediaCardUp(hass, id) || (live && st.state === "on" && !!st.attributes.source) ? 4 : !this.ro && (this.mediaGrace.get(id)?.until ?? 0) > Date.now() ? 2 : tvCard && live ? 1 : 0;
          collect.push({ id, floorId: floor.id, x, z, hostId: host, hostTv: !!hostType && isTvItemType(hostType), tv: st.attributes.device_class === "tv", name: typeof fn === "string" ? fn.trim().toLowerCase() : undefined, rank });
          return;
        }
        if (yields.has(id)) return;
        if (seenMedia.has(id)) {
          // a second speaker linked to the same player (a Sonos group or stereo pair known as one entity): it
          // plays along – its own rings, a line to the first, the one card stays with the first (#475)
          const first = sound.find((x) => x.id === id);
          if (first) sound.push({ ...first, id: `${id}#${sound.filter((x) => x.id.startsWith(`${id}#`)).length + 2}`, floorId: floor.id, x, z, members: [id] });
          return;
        }
        seenMedia.add(id);
        // a cloud speaker (Alexa, Google) drops out or reports "idle" for a moment between songs:
        // its last card stands in for a short while instead of blinking away
        // (not while travelling in time: the last live card does not belong into the past)
        const graced = this.ro ? undefined : this.mediaGrace.get(id);
        // what it plays: the title, else the app or the source (a receiver on "TV", a speaker on Bluetooth)
        const label = [st.attributes.media_title, st.attributes.app_name, st.attributes.source].find((v): v is string => typeof v === "string" && !!v.trim()) ?? "";
        // a TV (#281) keeps its card all the time, off or on; the owner can hide it on this device
        const tv = tvItem || st.attributes.device_class === "tv";
        const hide = tv && this.tvHidden.has(id);
        const showing = !isUnavailable(st) && (st.state === "playing" || (st.state === "paused" && !!label && this.pausedRecently(st)) || (st.state === "on" && !!st.attributes.source));
        if (!showing && tv && !isUnavailable(st)) {
          sound.push({ id, floorId: floor.id, x, z, level: 0, playing: false, members: [] });
          if (hide) return;
          anchors.push({ p: [x, floor.elevation + top + 0.12, z] as [number, number, number], n: [0, 1, 0] as [number, number, number], floorId: floor.id, size: holoSize * 0.7, roof: false, views: "all" as const });
          cards.push({ kind: "media", name, w: null, dayIds: [], battery: null, media: { id, title: translate(hass, "state_off"), artist: "", picture: null, volume: 0, playing: false, tv: true, off: st.state === "off" || st.state === "standby" } });
          return;
        }
        if (!showing) {
          if (graced && graced.until > Date.now()) {
            sound.push({ ...graced.source, playing: false, level: 0 });
            anchors.push(graced.anchor);
            cards.push({ ...graced.card, media: { ...graced.card.media!, playing: false } });
            clearTimeout(this.mediaGraceTimer);
            this.mediaGraceTimer = setTimeout(() => this.syncDevices(true), Math.max(500, graced.until - Date.now() + 100));
          } else if (!isUnavailable(st)) {
            this.mediaGrace.delete(id);
            sound.push({ id, floorId: floor.id, x, z, level: 0, playing: false, members: [] });
          }
          return;
        }
        const playing = st.state === "playing";
        const a = st.attributes;
        const vol = typeof a.volume_level === "number" ? Math.min(1, Math.max(0, a.volume_level)) : 0.5;
        const members = Array.isArray(a.group_members) ? (a.group_members as string[]).filter((m) => m !== id) : [];
        sound.push({ id, floorId: floor.id, x, z, level: playing ? 0.3 + 0.7 * vol : 0, playing, members });
        const title = label || translate(hass, "holo_media_playing");
        const anchor = { p: [x, floor.elevation + top + 0.12, z] as [number, number, number], n: [0, 1, 0] as [number, number, number], floorId: floor.id, size: holoSize * 0.7, roof: false, views: "all" as const };
        const card: HoloCard = {
          kind: "media",
          name,
          w: null,
          dayIds: [],
          battery: null,
          media: { id, title, artist: typeof a.media_artist === "string" ? a.media_artist : typeof a.media_album_name === "string" ? a.media_album_name : "", picture: typeof a.entity_picture === "string" ? a.entity_picture : null, volume: Math.round(vol * 100), playing, ...(tv ? { tv: true } : {}) },
        };
        if (hide) return;
        anchors.push(anchor);
        cards.push(card);
        // (a card of the past does not stand in for a live one afterwards)
        if (!this.ro) this.mediaGrace.set(id, { until: Date.now() + 45000, card, source: sound[sound.length - 1], anchor });
      };
      // one card per player: furniture linked to it by hand first (a wall speaker given the Echo Show),
      // then a device placed in the plan, then furniture that found the player by itself
      const furn = (floor: Building["floors"][number], byHand: boolean) => {
        for (const f of floor.furniture) {
          if ((f.entity != null && f.entity !== "none") !== byHand) continue;
          const e = this.furnitureLinks?.get(f.id)?.entity;
          if (e) add(floor, e, f.x, f.z, mountBase(floor, f) + f.h, f.name || furnitureName(hass, f.type), isMediaFurniture(f.type), f.id);
        }
      };
      const walk = () => {
        for (const floor of b.floors) furn(floor, true);
        for (const floor of b.floors) for (const pl of floor.placements) add(floor, pl.entity_id, pl.x, pl.z, pl.y ?? 1.1, pl.name || entityName(hass, pl.entity_id));
        for (const floor of b.floors) furn(floor, false);
      };
      walk();
      yields = losers(collect);
      collect = null;
      walk();
    }
    // Cars: a glass card over the car in its spot, in the same look as the energy and music cards
    {
      const holoSize = (b.settings.roof.hologram ?? DEFAULT_HOLOGRAM).size;
      for (const floor of b.floors) {
        for (const f of floor.furniture) {
          if (f.type !== "parking" || !f.car) continue;
          const vehicle = parkedVehicle(hass, f);
          if (!vehicle) continue;
          const car = carState(hass, f);
          if (car.soc === null && car.range === null && car.locked === null && car.climateOn === null) continue;
          const veh = vehicleFurniture(f, vehicle);
          const top = mountBase(floor, f) + (veh?.h ?? 1.6);
          anchors.push({ p: [f.x, floor.elevation + top + 0.25, f.z], n: [0, 1, 0], floorId: floor.id, size: holoSize * 0.7, roof: false, views: "all" });
          const e = car.entities;
          cards.push({
            kind: "car",
            name: f.name || furnitureName(hass, vehicle),
            w: null,
            dayIds: [],
            battery: null,
            car: {
              spot: f.id,
              soc: car.soc,
              range: car.range,
              rangeUnit: car.rangeUnit,
              chargingW: car.chargingW,
              charging: car.charging,
              locked: car.locked,
              climateOn: car.climateOn,
              lock: e.lock,
              climate: e.climate,
              charge: e.charging && /^(switch|input_boolean)\./.test(e.charging) ? e.charging : null,
            },
          });
        }
      }
    }
    // racks (#120): a glass card over every rack with linked gear, its chosen values
    for (const { anchor, card } of this.rackHolos(hass, b)) {
      anchors.push(anchor);
      cards.push(card);
    }
    // Pool module: living water (light colour, moving with the filter pump, warm shimmer while heating, the cover)
    // and a glass card over every pool with links
    // the modules' water (the pool module: living water, the cover) and their glass cards
    const water: PoolPiece[] = this.scene.filter((p): p is Extract<ScenePiece, { kind: "water" }> => p.kind === "water").map((p) => ({ ...p, level: this.dimmed ? p.level * 0.4 : p.level }));
    v.setPools(water);
    if (anyModule()) {
      const holoSize = (b.settings.roof.hologram ?? DEFAULT_HOLOGRAM).size;
      for (const card of moduleCards(this.sceneHost(hass, b))) {
        const floor = b.floors.find((f) => f.id === card.anchor.floorId);
        if (!floor) continue;
        let p: [number, number, number] | null = null;
        if (card.anchor.areaId) {
          const area = floor.outdoor.find((o) => o.id === card.anchor.areaId);
          if (!area || area.points.length < 3) continue;
          const [cx, cz] = centroid(area.points);
          const y = area.type === "pool" ? poolWaterY(floor, area) : outdoorGround(floor, cx, cz);
          p = [cx, floor.elevation + Math.max(y, 0) + (area.above ? 0.6 : 1.1), cz];
        } else if (card.anchor.furnitureId) {
          const f = floor.furniture.find((m) => m.id === card.anchor.furnitureId);
          if (!f) continue;
          p = [f.x, floor.elevation + mountBase(floor, f) + f.h + 0.25, f.z];
        }
        if (!p) continue;
        anchors.push({ p, n: [0, 1, 0], floorId: floor.id, size: holoSize * 0.7, roof: false, views: "all" });
        cards.push({ kind: "module", name: card.title, w: null, dayIds: [], battery: null, module: card });
      }
      // a module's small labels (a value at a point) look like the household tags
      for (const tag of this.scene) {
        if (tag.kind !== "tag") continue;
        const floor = b.floors.find((f) => f.id === tag.floorId);
        if (!floor) continue;
        anchors.push({ p: [tag.at[0], floor.elevation + tag.at[1], tag.at[2]], n: [0, 1, 0], floorId: floor.id, size: holoSize * 0.75, roof: false, views: tag.views ?? "all" });
        cards.push({ kind: "bin", name: tag.sub ?? "", w: null, dayIds: [], battery: null, bin: { lines: [{ color: tag.color ?? "#37e0ff", when: tag.text, name: tag.sub ?? "", soon: true, out: false }], soon: true, icon: null }, tag: true });
      }
    }
    // Household: a small tag on every bin that goes out today or tomorrow (and on a mailbox with post, a thirsty plant)
    {
      const holoSize = (b.settings.roof.hologram ?? DEFAULT_HOLOGRAM).size;
      // bins standing together share one tag, their lines in pickup order (their own tags covered each other)
      for (const g of groupTags(this.binHolos)) {
        const floor = b.floors.find((f) => f.id === g.floorId);
        if (!floor) continue;
        // a small tag sitting on the lid, always there: tiny from afar, a little larger close up
        anchors.push({ p: [g.x, floor.elevation + g.y + 0.04, g.z], n: [0, 1, 0], floorId: g.floorId, size: holoSize * 0.75, roof: false, views: "all" });
        const lines = g.lines.map((t) => ({ color: t.color, when: t.when, name: t.name, soon: !!t.soon && !t.out, out: !!t.out }));
        cards.push({ kind: "bin", name: g.lines.map((t) => t.name).join(", "), w: null, dayIds: [], battery: null, bin: { lines, soon: lines.some((l) => l.soon), icon: g.lines.length === 1 ? (g.lines[0].icon ?? null) : null } });
      }
    }
    v.setSound(sound);
    // walking: only the glass cards of the room one stands in (the others would float through the walls)
    const room = this._walk ? this.walkRoomPts : null;
    const keep = anchors.map((a) => !this._walk || (!!room && pointInPolygon([a.p[0], a.p[2]], room)));
    const shownCards = cards.filter((_, i) => keep[i]);
    // the energy cables' ends at the consumers (#29): hovered or tapped they tell today's kWh; their anchors follow the cards'
    const cables = !!(this.flows ?? this._flows) && !this.dimmed;
    const wires = cables && !this._walk ? wireEnds(hass, consumers).filter((w) => b.floors.some((f) => f.id === w.floorId)) : [];
    if (JSON.stringify(wires) !== JSON.stringify(this._wires)) this._wires = wires;
    this.holoCount = shownCards.length;
    const wireAnchors = wires.map((w) => ({ p: [w.x, b.floors.find((f) => f.id === w.floorId)!.elevation + 0.03, w.z] as [number, number, number], n: [0, 1, 0] as [number, number, number], floorId: w.floorId, size: 1, roof: false, views: "all" as const, plan: true }));
    v.setAnchors([...anchors.filter((_, i) => keep[i]), ...wireAnchors]);
    if (JSON.stringify(shownCards) !== JSON.stringify(this._holos)) this._holos = shownCards;
    this.watchRackSpark();
    // the modules live with their production (at night, and without Pro, they rest)
    v.setSolarLevels(powers && !this.dimmed ? fieldLevels(b, powers) : new Map());
    // the energy cables (energy feature) and the pool's pipes share the viewer's flow layer
    const mixes = (kind: FlowKind) => sourceMix(kind, summary);
    const energyFlows = !cables
        ? []
        : flowSegments({ building: b, consumers, summary, battery: batteryPlaced ?? null, fieldPower: powers, devicePower: this.devicePowers(hass, b) }).map((f) => ({
            floorId: f.floorId,
            a: f.a,
            b: f.b,
            dist: f.dist,
            power: f.power,
            // the colour of the sources feeding it, each source's own colour on its share of the dots; thicker with the watts (#28)
            color: mixColor(mixes(f.kind)),
            dots: flowDots(mixes(f.kind)),
            thick: flowWidth(f.power),
          }));
    const pool = this.poolPipes(b);
    // a module's lines (pipes, a loop in the ground) flow in the same layer; its surfaces lie over floors and lawns
    const lines = this.scene.filter((p): p is Extract<ScenePiece, { kind: "line" }> => p.kind === "line");
    v.setFlows(this.dimmed ? energyFlows : [...energyFlows, ...pool.flows, ...lineFlows(lines)]);
    v.setPipes(pool.tubes);
    v.setPatches(this.scene.filter((p): p is Extract<ScenePiece, { kind: "patch" }> => p.kind === "patch").map((p) => ({ floorId: p.floorId, points: p.points, y: p.y, color: p.color, opacity: this.dimmed ? p.opacity * 0.4 : p.opacity, ...(p.glow ? { glow: true } : {}) })));
    const roomSensors = SHOW_PRESENCE ? personsInRooms(hass, b) : [];
    const persons = released("locate") && personsShown(b) ? [...roomSensors, ...locatedPersons(hass, b, new Set(roomSensors.map((p) => p.id)))] : roomSensors;
    v.setPersonLook(personLook(b) === "pin" ? "pin" : "figure");
    v.setPersons(persons);
    this.lastPersons = persons.map((p) => ({ floorId: p.floorId, roomId: p.roomId }));
    const counts = floorCounts(hass, b, this.openingLinks!, persons);
    v.setFloorInfo(new Map([...counts].map(([id, c]) => [id, floorInfoText(hass, c)])));
    // daylight: sun through the windows and a lighter sky
    const sun = hass.states["sun.sun"]?.attributes;
    const elevation = typeof sun?.elevation === "number" ? sun.elevation : null;
    v.setSun(elevation !== null && typeof sun?.azimuth === "number" ? { elevation, azimuth: sun.azimuth } : null);
    // the compass ring's letters: the first letter of each direction in the user's language
    const letter = (k: I18nKey) => translate(hass, k).charAt(0).toUpperCase();
    v.setSunPath(this.sunPathToday(hass), [letter("compass_n"), letter("compass_e"), letter("compass_s"), letter("compass_w")], timeStyleOf(hass));
    // the automatic look follows the sun, the theme look this device's HA theme (setTheme ignores a look it already shows)
    if (this.followsClock()) v.setStyle(this.effectiveStyle());
    // the weather outside: clouds darken the sky, rain, snow and fog fall over the plot
    const raw = this.weather && !this.dimmed ? weatherState(hass, weatherEntity(hass, this.weatherEntityId ?? b.settings.weather_entity), b.settings.rain_entity) : null;
    const weather = raw ? limitEffects(raw, b.settings.weather_effects) : null;
    this.cloud = weather?.cloud ?? 0;
    this._sky = (elevation === null ? 0 : Math.min(1, Math.max(0, (elevation + 4) / 16))) * (1 - 0.45 * this.cloud);
    // the realistic look draws the sky the weather entity reports (a new object only when it changed)
    const real = this.effectiveTheme() === "realistic" ? realisticSky(elevation, weather) : null;
    if (JSON.stringify(real) !== JSON.stringify(this._realSky)) this._realSky = real;
    // with the feature on, the viewer always gets the weather (the sun and moon disc shows on clear days too)
    const disc = weather ? weather.sky : (b.settings.weather_effects ?? ["sky"]).includes("sky");
    v.setWeather(this.weather && !this.dimmed ? { ...(weather ?? { rain: 0, snow: 0, fog: 0, cloud: 0, wind: 0 }), sky: this.skyColor(), disc } : null);
    this.watchLightning(!!weather?.lightning);
    this.applyTint();
    this.applyMotion();
    // the cheap rate (#29): the configured entity or daily window; none configured, no badge
    const cheap = cheapRate(b.energy, hass.states, new Date(this.now()));
    if (cheap !== this._cheap) this._cheap = cheap;
    // existing sensors (#323): today's cost from the plan's cost sensors
    const costIds = ratesFromSensors(b.energy) ? [...(b.energy.cost_sensors ?? []), ...(b.energy.earning_sensors ?? [])] : [];
    this.watchCosts(costIds.length ? b.energy : null);
    const hasEnergy = summary.grid !== null || summary.solar !== null || summary.battery !== null || summary.tariff !== null || cheap !== null || costIds.length > 0;
    const energy = hasEnergy ? summary : null;
    // a new object would make Lit render again; only changed values do
    if (JSON.stringify(energy) !== JSON.stringify(this._energy)) this._energy = energy;
    const wallboxW = consumers.some((c) => c.wallbox) ? consumers.filter((c) => c.wallbox).reduce((s, c) => s + c.power, 0) : null;
    // several plants (a big roof plant and a balcony plant): each inverter's own power
    const plants = b.floors
      .flatMap((f) => f.furniture.filter((m) => energyRole(m.type) === "inverter"))
      .map((m) => {
        const sensor = this.furnitureLinks?.get(m.id)?.power;
        const w = sensor ? readPower(hass.states[sensor]) : null;
        return w === null ? null : { name: m.name || furnitureName(hass, m.type), w: Math.max(0, w) };
      })
      .filter((p): p is { name: string; w: number } => !!p);
    if (JSON.stringify(plants) !== JSON.stringify(this._plants)) this._plants = plants;
    if (wallboxW !== this._wallboxW) this._wallboxW = wallboxW;
    // the holograms' day curves: the sensors' statistics, fetched now and then while the sun is watched
    this.watchSolarDay([...new Set(cards.flatMap((c) => c.dayIds))]);
    // Energy: today's gas and water use on the house card
    this.watchMeters(b.energy.gas ?? null, b.energy.water ?? null);
    this.watchWireKwh(wires);
    if (began) this.syncMs = this.syncMs * 0.8 + (performance.now() - began) * 0.2;
  }

  /** Time travel: follows the replay's ticks (a moved clock renders again; the states come with the hass). */
  private listenReplay(): void {
    this.unlistenReplay?.();
    this.unlistenReplay = null;
    const r = this.replay;
    if (!r || !this.isConnected) return;
    this.seenT = r.t;
    this.seenFocus = r.focusSeq;
    this.unlistenReplay = r.listen(() => {
      if (this.replay !== r) return;
      if (r.focusSeq !== this.seenFocus) {
        this.seenFocus = r.focusSeq;
        if (r.focus) this.showEntity(r.focus);
      }
      if (r.t === this.seenT && r.seek === this.seenSeek) return;
      // a fast replay skipped a light that went on and off between two ticks: it flashes
      if (r.pulses.length) this.viewer?.flashDevices(r.pulses);
      this.seenT = r.t;
      // nothing on screen follows the clock: a tick costs nothing (a changed state comes with a new hass)
      if (r.seek === this.seenSeek && !this.trail && !this.detecting && !this._holos.length) return;
      // handled in updated(), after the host has handed over the new hass of the same tick
      this.replayTicked = true;
      this.requestUpdate();
    });
  }

  /**
   * Time travel: shows where an entity is (an event was tapped, or the camera follows the events) – its
   * device, else the room of its window or its area – flying there on its floor.
   */
  private showEntity(entity: string): void {
    const hass = this.hass;
    const b = this.building;
    if (!hass || !b) return;
    const item = (this.findIndex ??= searchIndex(hass, b)).find((it) => it.entity === entity);
    if (item) {
      this.goTo(item);
      return;
    }
    const area = hass.entities?.[entity]?.area_id ?? hass.devices?.[hass.entities?.[entity]?.device_id ?? ""]?.area_id ?? null;
    for (const floor of b.floors) {
      const opening = floor.openings.find((o) => {
        const l = this.openingLinks?.get(o.id);
        return !!l && [l.contact, l.tilt, l.contact2, l.tilt2, l.cover].includes(entity);
      });
      const room = floor.rooms.find((r) => r.points.length >= 3 && (opening ? r.id === opening.room_id : !!area && r.area_id === area));
      if (!room) continue;
      const [x, z] = centroid(room.points);
      this.goTo({ kind: "device", name: room.name, where: "", floorId: floor.id, roomId: room.id, entity, icon: null, x, z, y: 1 });
      return;
    }
  }

  /** Now – or, during time travel, the replayed moment. */
  private now(): number {
    return this.replay?.t ?? Date.now();
  }

  /** Read-only: the past is shown (time travel), nothing may be switched. */
  private get ro(): boolean {
    return !!this.replay;
  }

  /** Time travel: what the view shows and how it is linked, for the history to fetch and the events. */
  historyEntities(): HistorySpec {
    const b = this.building;
    const hass = this.hass;
    if (!b || !hass) return { entities: [], openings: [], furniture: [], low: this._low };
    const fresh = !this.openingLinks || this.linkedRegistry !== hass.entities;
    const openings = fresh ? openingEntities(hass, b.floors) : this.openingLinks!;
    const furniture = fresh ? furnitureEntities(hass, b.floors) : this.furnitureLinks;
    // the room sensors and the warnings always: the heatmap and the warnings can be switched on while travelling
    const warnings = alertEntities(alertSources(hass, b, this.weatherEntityId));
    const entities = watchedEntities(hass, b, { openings, furniture, heat: true, warnings, weatherEntityId: this.weatherEntityId });
    // Cars: the cars' own trackers (home or away only); a person's tracker is never one of them
    // (the people and trackers a show/hide rule follows are asked for in the request itself, #394)
    const cars = b.floors.flatMap((fl) =>
      fl.furniture
        .filter((f) => f.type === "parking")
        .flatMap((f) => [typeof f.entity === "string" ? f.entity : null, f.car ? carEntities(hass, f).tracker : null])
        .filter((id): id is string => !!id && id.startsWith("device_tracker.")),
    );
    return { entities, openings: [...openings], furniture: [...furniture], low: this._low, cars, energy: true, auto: true };
  }

  /** Time travel: a tap shows the device's state at the replayed moment ("on · 60 % · since 07:42"). */
  private showInfo(entity: string, x: number, y: number): void {
    this._menu = null;
    this._popup = null;
    this._info = { entity, x, y };
    clearTimeout(this.infoTimer);
    this.infoTimer = setTimeout(() => (this._info = null), 4000);
  }

  private renderInfo() {
    const i = this._info;
    if (!i || !this.hass) return nothing;
    const hass = this.hass;
    const st = hass.states[i.entity];
    const text = stateText(hass, st);
    const on = kindOf(i.entity) === "light" && st?.state === "on" && text.endsWith("%") ? `${translate(hass, "state_on")} · ${text}` : text;
    const since = st?.last_changed ? translate(hass, "tt_since", { time: trailTime(hass, Date.parse(st.last_changed)) }) : "";
    return html`<div class="fp3d-swipe fp3d-info" style="left:${i.x}px;top:${i.y}px">
      <span>${entityName(hass, i.entity)}</span>
      <b>${since ? `${on} · ${since}` : on}</b>
    </div>`;
  }

  /** The inverters', batteries' and solar panels' own power (W, a battery positive = discharging) by furniture id. */
  private devicePowers(hass: HomeAssistant, b: Building): Map<string, number> {
    const out = new Map<string, number>();
    for (const floor of b.floors) {
      for (const f of floor.furniture) {
        const role = energyRole(f.type);
        if (role !== "inverter" && role !== "home_battery" && role !== "solar") continue;
        const sensor = this.furnitureLinks?.get(f.id)?.power;
        // a battery with a separate charging sensor: the power sensor is its discharging, the charging is taken
        // off and the signs do not matter; a single signed sensor is inverted on request
        const charge = energyRole(f.type) === "home_battery" && f.charge && f.charge !== "none" ? readPower(hass.states[f.charge]) : null;
        let p = sensor ? readPower(hass.states[sensor], energyRole(f.type) === "home_battery" && b.energy.battery_invert && charge === null) : null;
        if (p !== null && charge !== null) p = Math.max(0, p) - Math.max(0, charge);
        else if (p === null && charge !== null) p = -Math.max(0, charge);
        if (p !== null) out.set(f.id, p);
      }
    }
    return out;
  }

  /**
   * Kamera-Cockpit: a pin in front of every camera for each detection its sensors report right now
   * (a person, a vehicle, an animal, motion – Frigate, UniFi Protect, Reolink and the like), with the time.
   */
  /** Detection sensors this page has seen on (only those linger after dropping back, #299). */
  private readonly detectSeenOn = new Set<string>();

  private detectionPins(hass: HomeAssistant, markers: DeviceMarker[]) {
    const out: (DeviceMarker & { pin: boolean })[] = [];
    // cameras whose detection pins are switched off: only the camera turns red (#267)
    const quiet = new Set(this.building?.floors.flatMap((f) => f.placements.filter((p) => p.detect_pins === false).map((p) => p.entity_id)) ?? []);
    for (const cam of markers) {
      if (!cam.model?.startsWith("camera") || quiet.has(cam.id)) continue;
      // a detection stays as a pin for two minutes after the sensor dropped back (Reolink and the like hold it
      // only for seconds), with the time it was seen – only one this page saw on: after a restart every sensor
      // comes back off with a fresh change time, which is no detection (#299)
      const now = this.now();
      const active = cameraMotionSensors(hass, cam.id).filter((id) => {
        const st = hass.states[id];
        if (!st) return false;
        if (st.state === "on") {
          this.detectSeenOn.add(id);
          return true;
        }
        return st.state === "off" && this.detectSeenOn.has(id) && !!st.last_changed && now - Date.parse(st.last_changed) < DETECT_LINGER_MS;
      });
      // one pin per kind (a person and a car at the same time), the plain motion only when nothing else is seen
      const kinds = new Map<string, string>();
      for (const id of active) {
        const kind = detectionKind(hass, id);
        if (!kinds.has(kind)) kinds.set(kind, id);
      }
      if (kinds.size > 1) kinds.delete("motion");
      const a = ((cam.rotation ?? 0) * Math.PI) / 180;
      const dir: [number, number] = [-Math.sin(a), Math.cos(a)];
      const dome = cam.model === "camera_ceiling";
      let n = 0;
      for (const [kind, id] of kinds) {
        const st = hass.states[id];
        const since = st?.last_changed ? trailTime(hass, Date.parse(st.last_changed)) : "";
        out.push({
          id: `detect:${id}`,
          floorId: cam.floorId,
          roomId: cam.roomId,
          x: cam.x + (dome ? 0 : dir[0] * 1.1),
          z: cam.z + (dome ? 0 : dir[1] * 1.1),
          y: 1.4 + 0.4 * n++,
          icon: DETECT_ICONS[kind] ?? DETECT_ICONS.motion,
          name: entityName(hass, id),
          text: `${translate(hass, `detect_${kind}` as I18nKey)}${since ? ` · ${since}` : ""}`,
          active: true,
          unavailable: false,
          glow: null,
          pin: true,
        });
      }
    }
    return out;
  }

  /** The pin at the street: grid import or export right now. */
  private gridPin(hass: HomeAssistant, b: Building, grid: number) {
    const g = gridPoint(b);
    if (!g) return null;
    const idle = Math.abs(grid) < 5;
    const outageId = b.settings.outage_entity;
    if (outageId && isOutage(hass.states[outageId])) {
      return { id: "grid", floorId: g.floorId, roomId: null, x: g.end[0], z: g.end[1], y: 0.9 + g.height, icon: GRID_OFF_ICON, name: translate(hass, "holo_grid"), text: translate(hass, "power_outage"), active: true, unavailable: false, glow: null, pin: true };
    }
    return {
      id: "grid",
      floorId: g.floorId,
      roomId: null,
      x: g.end[0],
      z: g.end[1],
      y: 0.9 + g.height,
      icon: GRID_ICON,
      name: translate(hass, "holo_grid"),
      text: idle ? formatPower(hass, 0) : `${translate(hass, grid < 0 ? "energy_grid_export" : "energy_grid_import")} ${formatPower(hass, Math.abs(grid))}`,
      active: !idle,
      unavailable: false,
      glow: null,
      pin: true,
    };
  }

  /** Energy: today's gas and water use (meter unit), fetched every five minutes. */
  private declare _meters: { gas: number | null; water: number | null } | null;
  private meterKey = "";
  private meterTimer?: ReturnType<typeof setInterval>;

  private watchMeters(gas: string | null, water: string | null): void {
    const ids = [gas, water].filter((x): x is string => !!x);
    const key = this.replay ? "" : ids.join(",");
    if (key === this.meterKey) return;
    this.meterKey = key;
    clearInterval(this.meterTimer);
    this.meterTimer = undefined;
    if (!key) {
      this._meters = null;
      return;
    }
    const fetch = async () => {
      if (!this.hass || document.hidden) return;
      const got = await fetchTodayChange(this.hass, ids);
      if (this.meterKey === key && got) this._meters = { gas: gas ? (got.get(gas) ?? null) : null, water: water ? (got.get(water) ?? null) : null };
    };
    void fetch();
    this.meterTimer = setInterval(() => void fetch(), 300000);
  }

  /**
   * Existing sensors (#323): today's cost (net of export earnings), fetched every five minutes, and again (at most once
   * a minute) when a cost sensor's state changes or one comes or goes.
   */
  private declare _costs: { net: boolean; value: string } | null;
  private costKey = "";
  private costLive = "";
  private costAt = 0;
  private costTimer?: ReturnType<typeof setInterval>;
  private costFetch: (() => Promise<void>) | null = null;

  private watchCosts(energy: EnergySettings | null): void {
    const ids = energy ? [...(energy.cost_sensors ?? []), ...(energy.earning_sensors ?? [])] : [];
    const key = this.replay || !energy ? "" : JSON.stringify([energy.cost_sensors ?? [], energy.earning_sensors ?? []]);
    const live = ids.map((id) => this.hass?.states[id]?.state ?? "").join("|");
    if (key === this.costKey) {
      if (key && live !== this.costLive && (this._costs === null || Date.now() - this.costAt >= 60000)) void this.costFetch?.();
      return;
    }
    this.costKey = key;
    clearInterval(this.costTimer);
    this.costTimer = undefined;
    this.costFetch = null;
    this._costs = null;
    if (!key || !energy) return;
    const fetch = async () => {
      if (!this.hass || document.hidden) return;
      this.costAt = Date.now();
      this.costLive = ids.map((id) => this.hass?.states[id]?.state ?? "").join("|");
      const { fetchCostsToday, costTile } = await import("../energy-rates.ts");
      const got = this.hass ? await fetchCostsToday(this.hass, energy) : null;
      if (this.costKey === key) this._costs = got ? costTile(this.hass, got) : null;
    };
    this.costFetch = fetch;
    void fetch();
    this.costTimer = setInterval(() => void fetch(), 300000);
  }

  /** Today's kWh at the wire ends (#29): fetched every five minutes while the cables show, by power sensor. */
  private declare _cheap: boolean | null;
  private declare _wires: WireEnd[];
  private declare _wireKwh: Map<string, number> | null;
  /** The wire end tapped open (its key), so a touch screen shows its kWh too. */
  private declare _wireOpen: string | null;
  /** How many of the viewer's anchors are glass cards; the wire ends' anchors follow them. */
  private holoCount = 0;
  private wireKey = "";
  private wireTimer?: ReturnType<typeof setInterval>;

  private watchWireKwh(wires: readonly WireEnd[]): void {
    const key = this.replay ? "" : wires.map((w) => `${w.key}=${w.energy ?? ""}`).join(",");
    if (key === this.wireKey) return;
    this.wireKey = key;
    clearInterval(this.wireTimer);
    this.wireTimer = undefined;
    if (!key) {
      this._wireKwh = null;
      return;
    }
    // the first look always (a page opened in the background shows them once it comes up), then while it is seen
    const fetch = async (always = false) => {
      if (!this.hass || (document.hidden && !always)) return;
      const got = await fetchTodayKwh(this.hass, wires);
      if (this.wireKey === key && got) this._wireKwh = got;
    };
    void fetch(true);
    this.wireTimer = setInterval(() => void fetch(), 300000);
  }

  /** A wire end follows its point on the cable (called with the cards' anchors). */
  private placeWire(index: number, x: number, y: number, on: boolean): void {
    const el = this.renderRoot.querySelector<HTMLElement>(`.fp3d-wire[data-wire="${index}"]`);
    if (!el) return;
    if (el.hidden !== !on) el.hidden = !on;
    if (on) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
  }

  /** The energy cables' ends (#29): a small dot at every consumer; hovered, focused or tapped it shows today's kWh. */
  private renderWires() {
    if (!this._wires?.length) return nothing;
    const hass = this.hass;
    return this._wires.map((w, i) => {
      const kwh = this._wireKwh?.get(w.key);
      const value = kwh === undefined ? "…" : `${formatNumber(hass, kwh, kwh < 10 ? 2 : 1)} kWh`;
      const name = entityName(hass, w.id);
      const open = this._wireOpen === w.key;
      return html`<button
        class="fp3d-wire ${open ? "fp3d-wire-open" : ""}"
        data-wire=${i}
        hidden
        aria-expanded=${open}
        aria-label=${`${name}: ${translate(hass, "wire_today")} ${value}`}
        @click=${(e: Event) => {
          e.stopPropagation();
          this._wireOpen = open ? null : w.key;
        }}
      >
        <span class="fp3d-wire-tip" aria-hidden="true">${name}<span>${translate(hass, "wire_today")} <b>${value}</b></span></span>
      </button>`;
    });
  }

  /**
   * The pipes of every pool – drawn for everyone; what flows in them (blue, warm after a heating heat pump, brown to
   * the waste drain) a module says (pool module), without one they rest.
   */
  private poolPipes(b: Building): { flows: PipePiece[]; tubes: PipeTube[] } {
    const out: PipePiece[] = [];
    const tubes: PipeTube[] = [];
    const flowing = new Map(this.scene.filter((p): p is Extract<ScenePiece, { kind: "pipeflow" }> => p.kind === "pipeflow").map((p) => [p.areaId, p.flows]));
    for (const { floor, area } of poolAreas(b.floors)) {
      const links = area.pool!;
      if (!links.pipes?.length && !links.joints?.length) continue;
      const ports = links.ports ?? [];
      const flows = new Map(Object.entries(flowing.get(area.id) ?? {}));
      const nodeAt = poolNodeAt(b, floor, area);
      // pipes at the bottom drain run under the pool's floor
      const shape = (path: P3[], p: PoolPipe) => underBasin(path, p, area, floor);
      out.push(...pipePieces(links.pipes ?? [], flows, nodeAt, shape));
      // inlet nozzles: a short spout from the wall into the pool, glowing in the water's colour while water flows
      for (const q of ports) {
        if (q.kind !== "inlet") continue;
        const at = nodeAt(`port:${q.id}`);
        const n = at && poolWallNormal(area, [at.x, at.z]);
        if (!at || !n) continue;
        const feed = (links.pipes ?? []).find((pp) => pp.to === `port:${q.id}`);
        const f = feed ? flows.get(feed.id) : undefined;
        tubes.push({ floorId: floor.id, points: [[at.x + n[0] * 0.03, at.y, at.z + n[1] * 0.03], [at.x - n[0] * 0.09, at.y, at.z - n[1] * 0.09]], radius: 0.035, water: f?.active ? f.color : null, fittings: [] });
      }
      // holes through a wall or the floor: a sleeve from the inside to the outside
      for (const j of links.joints ?? []) {
        if (j.kind !== "wall" && j.kind !== "floor") continue;
        const a = nodeAt(`joint:${j.id}:inside`)!;
        const o = nodeAt(`joint:${j.id}:outside`)!;
        const top = j.kind === "floor" ? 0.03 : a.y;
        tubes.push({ floorId: floor.id, points: [[a.x, top, a.z], [o.x, o.y, o.z]], radius: 0.05, water: null, fittings: [] });
      }
      for (const p of links.pipes ?? []) {
        const points = underBasin(pipePath(p, nodeAt), p, area, floor);
        if (points.length < 2) continue;
        const flow = flows.get(p.id);
        const fittings: PipeTube["fittings"] = [];
        // sleeves where the pipe meets a device or a T-piece
        const len = pathLength(points);
        for (const [node, at] of [
          [p.from, 0.04],
          [p.to, len - 0.04],
        ] as const) {
          const q = node.startsWith("dev:") || node.startsWith("joint:") ? pointAlong(points, at) : null;
          if (q) fittings.push({ kind: "sleeve", p: q.p, dir: q.dir });
        }
        for (const ft of p.fittings ?? []) {
          const q = pointAlong(points, ft.at);
          if (q) fittings.push({ kind: ft.kind, p: q.p, dir: q.dir, open: ft.open !== false });
        }
        tubes.push({ floorId: p.floor_id, points, radius: 0.025, water: flow?.active ? (flow.color ?? PIPE_IDLE) : null, fittings });
      }
    }
    return { flows: out, tubes };
  }

  /** Fetch today's solar statistics every five minutes while there are sensors to watch (none: the curve goes). */
  private watchSolarDay(ids: string[]): void {
    const r = this.replay;
    if (r) {
      // time travel: the replayed day's statistics up to the replayed moment (no fetching)
      clearInterval(this.holoTimer);
      this.holoTimer = undefined;
      const key = `tt|${ids.join(",")}|${Math.floor(r.t / 300000)}`;
      if (key === this.holoIds) return;
      this.holoIds = key;
      this._rows = ids.length ? r.stats(ids, new Date(r.t).setHours(0, 0, 0, 0), r.t + 1) : null;
      return;
    }
    const key = ids.join(",");
    if (key === this.holoIds) return;
    this.holoIds = key;
    clearInterval(this.holoTimer);
    this.holoTimer = undefined;
    if (!ids.length) {
      this._rows = null;
      return;
    }
    const fetch = async () => {
      if (!this.hass || document.hidden) return;
      this.holoFetched = Date.now();
      const rows = await fetchSolarRows(this.hass, ids);
      if (this.holoIds === key) this._rows = rows;
    };
    void fetch();
    // every five minutes, and at once when a wall tablet's screen comes back on after a longer pause
    this.holoTimer = setInterval(() => void fetch(), 300000);
    this.holoRefetch = () => {
      if (Date.now() - this.holoFetched > 300000) void fetch();
    };
  }

  /**
   * Hangs a hologram card on its anchor (called by the viewer after every frame): a thin line rises from
   * the solar field to the card's lower left corner; the card keeps its size in the world and, seen from
   * behind the field, shows its back (mirrored) or, switched off, hangs readable on the other side.
   */
  /** Cards placed in this frame (screen boxes), so the next one can step aside (D178). */
  private holoBoxes: { i: number; x0: number; x1: number; y0: number; y1: number }[] = [];
  private holoSizes = new Map<number, { w: number; h: number; at: number }>();

  /** The stage's size as last measured with the cards (#335's media cards stay inside it). */
  private holoStage = { w: 0, h: 0 };

  /**
   * A card's size, measured at most every 2 s (run 6 speed): when one is due, every shown card and the stage are read
   * in one go, before this frame writes any card. Read one by one between the writes, each read laid out the page again
   * (a first frame with a dozen cards took a quarter of a second on a 4x slower CPU).
   */
  private holoSize(index: number, now: number): { w: number; h: number; at: number } | undefined {
    const size = this.holoSizes.get(index);
    if (size && now - size.at <= 2000) return size;
    const stage = this.renderRoot.querySelector<HTMLElement>(".fp3d-stage");
    this.holoStage = { w: stage?.clientWidth ?? 0, h: stage?.clientHeight ?? 0 };
    for (const card of this.renderRoot.querySelectorAll<HTMLElement>(".fp3d-holo[data-holo]")) {
      const i = Number(card.dataset.holo);
      const had = this.holoSizes.get(i);
      if (card.hidden || (had && now - had.at <= 2000) || (this._holoBig && this._holos[i]?.kind === "main")) continue;
      const w = card.offsetWidth;
      if (w > 0) this.holoSizes.set(i, { w, h: card.offsetHeight || 1, at: now });
    }
    return this.holoSizes.get(index);
  }

  private placeHolo(index: number, x: number, y: number, on: boolean, scale: number, facing: boolean): void {
    if (index >= this.holoCount) return this.placeWire(index - this.holoCount, x, y, on);
    // a new frame starts with the first anchor again
    if (!this.holoBoxes.length || index <= this.holoBoxes[this.holoBoxes.length - 1].i) this.holoBoxes = [];
    const el = this.renderRoot.querySelector<HTMLElement>(`.fp3d-holo[data-holo="${index}"]`);
    const link = this.renderRoot.querySelector<SVGSVGElement>(`.fp3d-holo-link[data-holo="${index}"]`);
    const main = this._holos[index]?.kind === "main";
    if (!el) return;
    // a device card can stay away while its device is (nearly) off (#244)
    const card = this._holos[index];
    const minW = (this.building?.settings.roof.hologram ?? DEFAULT_HOLOGRAM).device_min_w ?? 0;
    if (card?.kind === "device" && minW > 0 && (card.w ?? 0) < minW) on = false;
    const hidden = !on;
    if (el.hidden !== hidden) el.hidden = hidden;
    if (link && link.hasAttribute("hidden") !== hidden) link.toggleAttribute("hidden", hidden);
    if (!on) return;
    if (card?.kind === "bin") {
      // a tag: centred on its point (the lid), standing on it, no link line; never smaller than readable
      let t = Math.max(0.6, scale * 0.8);
      // a mailbox's or a plant's tag from afar: a round symbol of its own size instead of tiny text
      const far = !!card.bin?.icon && scale * 0.8 < 0.62;
      if (el.classList.contains("fp3d-holo-far") !== far) {
        el.classList.toggle("fp3d-holo-far", far);
        this.holoSizes.delete(index);
      }
      if (far) t = 1;
      // tags that would cover one placed before step up above it (bins in two rows, a mailbox beside them)
      const now = performance.now();
      let size = this.holoSize(index, now);
      if (!size || now - size.at > 2000) {
        size = { w: el.offsetWidth || 90, h: el.offsetHeight || 40, at: now };
        this.holoSizes.set(index, size);
      }
      const w = size.w * t;
      const h = size.h * t;
      let bottom = y;
      for (let pass = 0; pass < 6; pass++) {
        const hit = this.holoBoxes.find((b) => x - w / 2 < b.x1 + 3 && x + w / 2 > b.x0 - 3 && bottom - h < b.y1 + 3 && bottom > b.y0 - 3);
        if (!hit) break;
        bottom = hit.y0 - 4;
      }
      this.holoBoxes.push({ i: index, x0: x - w / 2, x1: x + w / 2, y0: bottom - h, y1: bottom });
      el.style.transform = `translate(${x.toFixed(1)}px, ${bottom.toFixed(1)}px) scale(${t.toFixed(3)}) translate(-50%, -100%)`;
      if (link && !link.hasAttribute("hidden")) link.toggleAttribute("hidden", true);
      return;
    }
    const s = scale * 0.8;
    const dx = 34 * s;
    const dy = 46 * s;
    // the card's lower left corner (lower right seen from behind) sits up and to the side of the anchor
    let cx = x + (facing ? dx : -dx);
    let cy = y - dy;
    // cards that would cover one placed before step up above it (two devices side by side, D178);
    // the card's size is read now and then, not every frame
    const now = performance.now();
    let size = main && this._holoBig ? this.holoSizes.get(index) : this.holoSize(index, now);
    // the grown solar card (#144) overlays its neighbours: they keep stepping round its small size
    if (!size || (now - size.at > 2000 && !(main && this._holoBig))) {
      size = { w: el.offsetWidth || 184, h: el.offsetHeight || 90, at: now };
      this.holoSizes.set(index, size);
    }
    // a TV or player card grows wider under the mouse (#335): it is placed for that size and kept inside the stage
    const media = el.classList.contains("fp3d-holo-media");
    const w = (media ? Math.max(size.w, MEDIA_HOVER_W) : size.w) * s;
    const h = size.h * s;
    let x0 = facing ? cx : cx - w;
    let x1 = x0 + w;
    if (media) {
      const sw = this.holoStage.w;
      if (sw > 0) {
        const shift = x1 > sw - 6 ? sw - 6 - x1 : x0 < 6 ? 6 - x0 : 0;
        cx += shift;
        x0 += shift;
        x1 += shift;
      }
      const top = 6 - (cy - h);
      if (top > 0 && this.holoStage.h) cy += top;
    }
    for (let pass = 0; pass < 6; pass++) {
      const hit = this.holoBoxes.find((b) => x0 < b.x1 + 4 && x1 > b.x0 - 4 && cy - h < b.y1 + 4 && cy > b.y0 - 4);
      if (!hit) break;
      cy = hit.y0 - 6;
    }
    this.holoBoxes.push({ i: index, x0, x1, y0: cy - h, y1: cy });
    // seen from behind the field the card shows its back, mirrored like glass – or, switched off, it stays
    // readable on the other side (#271)
    const mirror = facing || (this.building?.settings.roof.hologram ?? DEFAULT_HOLOGRAM).mirror !== false;
    el.style.transform = mirror
      ? `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) scale(${(facing ? s : -s).toFixed(3)}, ${s.toFixed(3)}) translate(0, -100%)`
      : `translate(${x0.toFixed(1)}px, ${cy.toFixed(1)}px) scale(${s.toFixed(3)}) translate(0, -100%)`;
    if (link) {
      const line = link.firstElementChild as SVGLineElement | null;
      const dot = link.lastElementChild as SVGCircleElement | null;
      line?.setAttribute("x1", x.toFixed(1));
      line?.setAttribute("y1", y.toFixed(1));
      line?.setAttribute("x2", cx.toFixed(1));
      line?.setAttribute("y2", cy.toFixed(1));
      dot?.setAttribute("cx", x.toFixed(1));
      dot?.setAttribute("cy", y.toFixed(1));
    }
  }

  /**
   * Energy: the glass holograms – the house's balance on the main field and one card per further
   * plant (house view), and the device cards (house and floor view). The viewer hides every card whose
   * anchor is not in view, so every card renders, in the anchors' order.
   */
  private renderHologram() {
    const e = this._energy;
    // the household tags (bins, post, a thirsty plant) are no energy holograms: they show on their own
    // so are the rack cards (#120): they have their own switch in the dashboard card
    const tagsOnly = () => this._holos.map((card, i) => (card.kind === "bin" ? this.renderBinCard(card, i) : card.kind === "rack" ? this.renderRackCard(card, i) : nothing));
    // the editor keeps the energy bar off but asks for the holograms in its energy tool
    if ((this.roomId && !(this.building?.settings.roof.hologram ?? DEFAULT_HOLOGRAM).device_room) || !(this.showEnergy || this.holograms) || !this.holoVisible()) return tagsOnly();
    // the plants' cards belong to the house view – with a single floor that floor is the house view (#255)
    const house = this.floorId === null || (this.building?.floors.length ?? 0) <= 1;
    const plants = !!e && (e.solar !== null || e.grid !== null || e.battery !== null) && house;
    return this._holos.map((card, i) => (card.kind === "module" ? this.renderModuleCard(card, i) : card.kind === "bin" ? this.renderBinCard(card, i) : card.kind === "rack" ? this.renderRackCard(card, i) : card.kind === "car" ? this.renderCarCard(card, i) : card.kind === "media" ? this.renderMediaCard(card, i) : card.kind === "device" ? this.renderDeviceCard(card, i) : plants ? this.renderHoloCard(card, i, e!) : nothing));
  }

  /** Household: a waste bin's small hologram – when it goes out, in the bin's colour. */
  private renderBinCard(card: HoloCard, index: number) {
    const b = card.bin!;
    // light text on a dark plate, the colour only as its edge (blue text on glass was hard to read)
    const one = b.lines.length === 1 ? b.lines[0] : null;
    const label = b.lines.map((l) => `${l.name}: ${l.when}`).join(", ");
    return html`<div class="fp3d-holo fp3d-holo-bin ${b.soon ? "" : "fp3d-holo-later"} ${one?.out ? "fp3d-holo-out" : ""} ${one ? "" : "fp3d-holo-multi"} ${this._low ? "fp3d-holo-plain" : ""}" data-holo=${index} hidden role="note" aria-label=${label} style="--bin:${b.lines[0].color}">
      ${b.icon
        ? html`<span class="fp3d-holo-sym" aria-hidden="true"
            ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
              ><path d=${b.icon === "mail" ? "M3.5 6.5h17v11h-17z M3.5 7l8.5 6.5L20.5 7" : "M12 21v-9 M12 12c0-4.5 3-7 8-7 0 4.5-3 7-8 7z M12 14.5c0-3.5-2.4-6-6.5-6 0 3.5 2.4 6 6.5 6z M8 21h8"} /></svg
          ></span>`
        : nothing}
      ${one
        ? html`<div class="fp3d-holo-body"><b>${one.when}</b><span>${one.name}</span></div>`
        : html`<div class="fp3d-holo-body fp3d-holo-lines">
            ${b.lines.map((l) => html`<div class="fp3d-holo-line ${l.soon ? "" : "fp3d-holo-line-later"} ${l.out ? "fp3d-holo-line-out" : ""}" style="--bin:${l.color}"><b>${l.when}</b><span>${l.name}</span></div>`)}
          </div>`}
    </div>`;
  }

  /** Cars: the car's card – charge as a bar in its colour, range, charging power, lock and climate buttons. */
  private renderCarCard(card: HoloCard, index: number) {
    const hass = this.hass;
    const t = (k: Parameters<typeof translate>[1]) => translate(hass, k);
    const c = card.car!;
    const open = !this.mediaFolded.has(c.spot);
    const toggle = () => {
      if (this.mediaFolded.has(c.spot)) this.mediaFolded.delete(c.spot);
      else this.mediaFolded.add(c.spot);
      this.requestUpdate();
    };
    const svc = (domain: string, service: string, id: string) => safeCall(hass, domain, service, { entity_id: id });
    const onOff = (id: string, on: boolean) => (id.startsWith("climate.") ? svc("climate", on ? "turn_on" : "turn_off", id) : svc("homeassistant", on ? "turn_on" : "turn_off", id));
    const lockTap = async () => {
      if (!c.lock) return;
      const isLock = c.lock.startsWith("lock.");
      if (c.locked) {
        if (!(await this.ask(t("car_unlock_confirm")))) return;
        if (isLock) svc("lock", "unlock", c.lock);
        else svc("homeassistant", "turn_off", c.lock);
      } else if (isLock) svc("lock", "lock", c.lock);
      else svc("homeassistant", "turn_on", c.lock);
    };
    const col = c.soc === null ? "#37e0ff" : c.soc >= 50 ? "#4dff80" : c.soc >= 20 ? "#ffcc40" : "#ff4d40";
    const lockable = !!c.lock && /^(lock|input_boolean|switch)\./.test(c.lock);
    const climable = !!c.climate && /^(climate|switch|input_boolean)\./.test(c.climate);
    return html`<svg class="fp3d-holo-link" data-holo=${index} hidden aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0" /><circle cx="0" cy="0" r="3" /></svg>
      <div class="fp3d-holo fp3d-holo-dev fp3d-holo-car ${open ? "" : "fp3d-holo-min"} ${this._low ? "fp3d-holo-plain" : ""}" data-holo=${index} hidden role="group" aria-label=${card.name}>
        <div class="fp3d-holo-sheen"></div>
        <div class="fp3d-holo-scan"></div>
        <div class="fp3d-holo-body">
          <div class="fp3d-holo-head" role="button" tabindex="0" aria-expanded=${open ? "true" : "false"} @click=${toggle} @keydown=${activateKey(toggle)}>
            <span>🚗 ${card.name}</span><span class="fp3d-holo-live">${c.charging ? `⚡ ${t("car_charging_short")}` : c.locked === null ? "" : c.locked ? "🔒" : "🔓"}</span>
          </div>
          <div class="fp3d-holo-car-main">
            <b style="color:${col}">${c.soc !== null ? `${Math.round(c.soc)} %` : "–"}</b>
            <span>${c.range !== null ? `${formatNumber(hass, c.range, 0)} ${c.rangeUnit}` : ""}${c.charging && c.chargingW ? ` · ${formatPower(hass, c.chargingW)}` : ""}</span>
          </div>
          ${c.soc !== null ? html`<div class="fp3d-holo-car-bar"><i style="width:${Math.max(2, Math.min(100, c.soc))}%;background:${col}"></i></div>` : nothing}
          ${open && !this.ro && (lockable || climable || c.charge)
            ? html`<div class="fp3d-holo-media-controls fp3d-holo-car-controls">
                ${lockable ? html`<button title=${c.locked ? t("car_unlock_btn") : t("car_lock_btn")} @click=${lockTap}>${c.locked ? "🔒" : "🔓"}</button>` : nothing}
                ${climable ? html`<button class=${c.climateOn ? "fp3d-holo-on" : ""} title=${t("car_climate")} @click=${() => onOff(c.climate!, !c.climateOn)}>❄</button>` : nothing}
                ${c.charge ? html`<button class=${c.charging ? "fp3d-holo-on" : ""} title=${t("car_charging")} @click=${() => onOff(c.charge!, !c.charging)}>⚡</button>` : nothing}
              </div>`
            : nothing}
        </div>
      </div>`;
  }

  /** A module's glass card (the pool module: the pool), in the look of the house's own cards. */
  private renderModuleCard(card: HoloCard, index: number) {
    const m = card.module!;
    const open = !this.mediaFolded.has(m.id);
    const toggle = () => {
      if (this.mediaFolded.has(m.id)) this.mediaFolded.delete(m.id);
      else this.mediaFolded.add(m.id);
      this.requestUpdate();
    };
    const styled = (color?: string) => (color ? `color:${color}` : "");
    // the tablet level and narrow screens leave the minor parts out, unless asked for with "more" on the card (#452)
    const narrow = this._low || this.clientWidth < 600;
    const compact = narrow && !this.moduleFull.has(m.id);
    const minors = narrow && [...(m.rows ?? []), ...(m.cells ?? []), ...(m.chain?.items ?? []), ...(m.spark ? [m.spark] : [])].some((x) => x.minor);
    const more = () => {
      if (this.moduleFull.has(m.id)) this.moduleFull.delete(m.id);
      else this.moduleFull.add(m.id);
      try {
        localStorage.setItem(MODULE_FULL_KEY, JSON.stringify([...this.moduleFull]));
      } catch {
        // private window: for this page only
      }
      this.requestUpdate();
    };
    const rows = majorOnly(m.rows, compact);
    const cells = majorOnly(m.cells, compact);
    const chain = m.chain ? majorOnly(m.chain.items, compact) : [];
    const spark = m.spark && m.spark.values.length > 1 && !(compact && m.spark.minor) ? m.spark : null;
    const wide = !!(m.chain || m.cells?.length || m.status);
    return html`<svg class="fp3d-holo-link" data-holo=${index} hidden aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0" /><circle cx="0" cy="0" r="3" /></svg>
      <div class="fp3d-holo fp3d-holo-dev fp3d-holo-mod ${wide ? "fp3d-holo-mod-wide" : ""} ${this.cardPing === m.id ? "fp3d-holo-ping" : ""} ${open ? "" : "fp3d-holo-min"} ${this._low ? "fp3d-holo-plain" : ""}" data-holo=${index} hidden role="group" aria-label=${m.title}>
        <div class="fp3d-holo-sheen"></div>
        <div class="fp3d-holo-scan"></div>
        <div class="fp3d-holo-body">
          <div class="fp3d-holo-head" role="button" tabindex="0" aria-expanded=${open ? "true" : "false"} @click=${toggle} @keydown=${activateKey(toggle)}><span>${m.icon} ${m.title}</span><span class="fp3d-holo-live" style=${styled(m.liveColor)}>${m.live ?? ""}</span></div>
          ${m.status
            ? html`<div class="fp3d-holo-status" style=${m.status.color ? `--st:${m.status.color}` : ""}>
                ${m.status.icon ? html`<i>${m.status.icon}</i>` : nothing}<b>${m.status.text}</b>${m.status.since ? html`<span>${m.status.since}</span>` : nothing}
              </div>`
            : nothing}
          ${m.main
            ? html`<div class="fp3d-holo-car-main fp3d-holo-mod-main">
                <b style=${styled(m.main.color)}>${m.main.text}</b><span>${m.main.sub ?? ""}</span>
                ${m.main.side ? html`<em style=${styled(m.main.side.color)}><b>${m.main.side.text}</b>${m.main.side.sub ? html`<small>${m.main.side.sub}</small>` : nothing}</em>` : nothing}
              </div>`
            : nothing}
          ${open && chain.length
            ? html`<div class="fp3d-holo-chain">
                  ${chain.map((c, i) => html`${i ? html`<s>→</s>` : nothing}<div><small>${c.label}</small><b style=${styled(c.color)}>${c.value}</b></div>`)}
                </div>
                ${m.chain!.note ? html`<div class="fp3d-holo-chain-note" style=${styled(m.chain!.noteColor)}>${m.chain!.note}</div>` : nothing}`
            : nothing}
          ${open
            ? rows.map(
                (r) =>
                  html`<div class="fp3d-holo-mrow"><span>${r.label}</span><b style=${styled(r.color)}>${r.value}</b>${r.at !== undefined
                      ? r.fill
                        ? html`<i class="fp3d-holo-mrow-fill"><s style="width:${r.at}%;background:${r.color ?? "#37e0ff"}"></s></i>`
                        : html`<i><em style="left:${r.at}%;background:${r.color ?? "#37e0ff"};color:${r.color ?? "#37e0ff"}"></em></i>`
                      : html`<i class="fp3d-holo-mrow-none"></i>`}</div>`,
              )
            : nothing}
          ${open && cells.length ? html`<div class="fp3d-holo-cells">${cells.map((c) => html`<div><small>${c.label}</small><b style=${styled(c.color)}>${c.value}</b></div>`)}</div>` : nothing}
          ${open && m.hint ? html`<div class="fp3d-holo-hint" style=${m.hint.color ? `--hint:${m.hint.color}` : ""}>${m.hint.text}</div>` : nothing}
          ${open ? (m.lines ?? []).map((l) => html`<div class="fp3d-holo-mline">${l}</div>`) : nothing}
          ${open && spark ? html`${spark.label ? html`<div class="fp3d-holo-spark-label">${spark.label}</div>` : nothing}${sparkLine(spark.values, spark.color ?? "#ffb347")}` : nothing}
          ${open && m.chips?.length
            ? html`<div class="fp3d-holo-chips">
                ${m.chips.map(
                  (g) => html`<div class="fp3d-holo-mline">${g.title}</div>
                    <div class="fp3d-holo-chip-row">${g.items.map((c) => html`<button class=${c.on ? "fp3d-holo-on" : ""} title=${c.title ?? ""} @click=${() => c.onTap()}>${c.label}</button>`)}</div>`,
                )}
              </div>`
            : nothing}
          ${open && minors ? html`<button class="fp3d-holo-minor-btn" @click=${more}>${translate(this.hass, compact ? "holo_more" : "holo_less")}</button>` : nothing}
          ${open && !this.ro && m.buttons?.length
            ? html`<div class="fp3d-holo-media-controls fp3d-holo-car-controls">${m.buttons.map((bt) => html`<button class=${bt.on ? "fp3d-holo-on" : ""} title=${bt.title ?? ""} @click=${() => bt.onTap()}>${bt.label}</button>`)}</div>`
            : nothing}
        </div>
      </div>`;
  }

  /** A service call from a card was refused: Home Assistant shows the reason as a notice at the bottom. */
  private serviceFailed(service: string, err: unknown): void {
    const why = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
    this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message: `${service}: ${why}` }, bubbles: true, composed: true }));
  }

  /** Klang & Kino: what a speaker plays – cover, title, artist, volume, with play/pause, previous and next. */
  private renderMediaCard(card: HoloCard, index: number) {
    const hass = this.hass;
    const t = (k: Parameters<typeof translate>[1]) => translate(hass, k);
    const m = card.media!;
    const open = !this.mediaFolded.has(m.id);
    const toggle = () => {
      if (this.mediaFolded.has(m.id)) this.mediaFolded.delete(m.id);
      else this.mediaFolded.add(m.id);
      this.requestUpdate();
    };
    // a refused command shows as Home Assistant's own notice instead of failing silently (#400)
    const call = (service: string, data: Record<string, unknown> = {}) => safeCall(hass, "media_player", service, { entity_id: m.id, ...data });
    // the buttons act when the finger lifts (#400): while a speaker plays the view redraws all the time and
    // some tablets then drop the click; a click without a pointer (keyboard) still works
    // whichever comes, the lifted finger or the click: the button acts once (some browsers drop one of them)
    const press = {
      down: (e: PointerEvent) => ((e.currentTarget as HTMLElement).dataset.pressed = String(e.pointerId)),
      up: (fn: () => void) => (e: PointerEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (el.dataset.pressed !== String(e.pointerId)) return;
        delete el.dataset.pressed;
        e.stopPropagation();
        el.dataset.acted = String(Date.now());
        fn();
      },
      key: (fn: () => void) => (e: MouseEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (Date.now() - Number(el.dataset.acted ?? 0) < 700) return;
        el.dataset.acted = String(Date.now());
        fn();
      },
    };
    // play and pause by their own services: some players (an Echo through Alexa Media Player) ignore play_pause
    // what the player says it can do (supported_features): previous 16, next 32, pause 1, play 16384 – a button it
    // cannot serve is greyed out (#400: an Echo without "previous"); unknown features leave every button on
    const features = hass.states[m.id]?.attributes.supported_features;
    const can = (bit: number) => typeof features !== "number" || (features & bit) !== 0;
    const intent = this.mediaIntent.get(m.id);
    if (intent && (intent.playing === m.playing || Date.now() - intent.at > 30000)) this.mediaIntent.delete(m.id);
    const playing = this.mediaIntent.get(m.id)?.playing ?? m.playing;
    // a player that can pause but does not report "play" (an Echo through Alexa Media Player, #400) still resumes:
    // ▶ stays on and sends play_pause there – a greyed-out ▶ after ⏸ sent nothing at all
    const canPlay = can(16384) || can(1);
    const playPause = () => {
      this.mediaIntent.set(m.id, { playing: !playing, at: Date.now() });
      this.requestUpdate();
      call(playing ? "media_pause" : can(16384) ? "media_play" : "media_play_pause");
    };
    // the dragged volume shows at once and is sent while dragging (at most every 350 ms) and on release;
    // it stays until the player reports it (a cloud speaker like an Echo answers late), at most 30 s
    const local = this.mediaVolume.get(m.id);
    if (local && (Math.abs(local.v - m.volume) <= 2 || Date.now() - local.at > 30000)) this.mediaVolume.delete(m.id);
    const volume = this.mediaVolume.get(m.id)?.v ?? m.volume;
    const setVolume = (v: number, last: boolean) => {
      this.mediaVolume.set(m.id, { v, at: Date.now() });
      this.requestUpdate();
      if (last || Date.now() - this.volumeSent > 350) {
        this.volumeSent = Date.now();
        call("volume_set", { volume_level: v / 100 });
      }
    };
    return html`<svg class="fp3d-holo-link" data-holo=${index} hidden aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0" /><circle cx="0" cy="0" r="3" /></svg>
      <div class="fp3d-holo fp3d-holo-dev fp3d-holo-media ${open ? "" : "fp3d-holo-min"} ${this._low ? "fp3d-holo-plain" : ""}" data-holo=${index} hidden role="group" aria-label=${card.name}>
      <div class="fp3d-holo-sheen"></div>
      <div class="fp3d-holo-scan"></div>
      <div class="fp3d-holo-body">
        <div class="fp3d-holo-head" role="button" tabindex="0" aria-expanded=${open ? "true" : "false"} @click=${toggle} @keydown=${activateKey(toggle)}><span>${m.tv ? "▭" : "♪"} ${card.name}</span><span class="fp3d-holo-live">${m.off ? t("state_off") : playing ? `● ${t("holo_media_playing")}` : m.tv ? "" : t("holo_media_paused")}</span>${m.tv && !this.ro ? html`<button class="fp3d-holo-hide" title=${t("tv_hide")} aria-label=${t("tv_hide")} @click=${(e: Event) => { e.stopPropagation(); this.hideTvCard(m.id); }} @keydown=${(e: Event) => e.stopPropagation()}>✕</button>` : nothing}</div>
        <div class="fp3d-holo-track">
          ${m.picture ? html`<img class="fp3d-holo-cover" src=${m.picture} alt="" />` : html`<span class="fp3d-holo-cover fp3d-holo-cover-none">♪</span>`}
          <div class="fp3d-holo-titles"><b>${m.title}</b>${m.artist ? html`<span>${m.artist}</span>` : nothing}</div>
        </div>
        ${open && !this.ro && m.off
          ? html`<div class="fp3d-holo-media-controls"><button aria-label=${t("tv_on")} title=${t("tv_on")} @click=${() => call("turn_on")}>⏻</button></div>`
          : nothing}
        ${open && !this.ro && !m.off
          ? html`<div class="fp3d-holo-media-controls">
                <button aria-label=${t("previous")} ?disabled=${!can(16)} @pointerdown=${press.down} @pointerup=${press.up(() => call("media_previous_track"))} @click=${press.key(() => call("media_previous_track"))}>⏮</button>
                <button aria-label=${t("play_pause")} ?disabled=${playing ? !can(1) : !canPlay} @pointerdown=${press.down} @pointerup=${press.up(playPause)} @click=${press.key(playPause)}>${playing ? "⏸" : "▶"}</button>
                <button aria-label=${t("next")} ?disabled=${!can(32)} @pointerdown=${press.down} @pointerup=${press.up(() => call("media_next_track"))} @click=${press.key(() => call("media_next_track"))}>⏭</button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  .value=${String(volume)}
                  aria-label=${t("volume")}
                  @input=${(e: Event) => setVolume(Number((e.target as HTMLInputElement).value), false)}
                  @change=${(e: Event) => setVolume(Number((e.target as HTMLInputElement).value), true)}
                />
                <span class="fp3d-holo-vol">${volume} %</span>
              </div>`
          : nothing}
      </div>
    </div>`;
  }

  /** Racks (#120): the card of every rack with linked gear and something to show, hung over the rack's top. */
  private rackHolos(hass: HomeAssistant, b: Building): { anchor: Parameters<FloorplanViewer["setAnchors"]>[0][number]; card: HoloCard }[] {
    const out: { anchor: Parameters<FloorplanViewer["setAnchors"]>[0][number]; card: HoloCard }[] = [];
    if (!this.rackCards) return out;
    const size = (b.settings.roof.hologram ?? DEFAULT_HOLOGRAM).size * 0.7;
    for (const floor of b.floors)
      for (const f of floor.furniture) {
        const slots = f.rack?.slots;
        if (!slots?.length) continue;
        const values = rackCardValues(hass, slots, f.rack?.card?.metrics);
        if (!values.length) continue;
        const top = floor.elevation + mountBase(floor, f) + f.h;
        const names = Object.fromEntries(slots.map((s) => [s.id, s.name || furnitureName(hass, s.type)]));
        out.push({
          anchor: { p: [f.x, top + 0.15, f.z], n: [0, 1, 0], floorId: floor.id, size, roof: false, views: "all", room: roomAt(floor, f.x, f.z) },
          card: { kind: "rack", name: f.name || furnitureName(hass, f.type), w: null, dayIds: [], battery: null, rack: { id: f.id, values, names } },
        });
      }
    return out;
  }

  /**
   * The racks voice can answer about (#122): the card's values (the editor's pick), plus the hottest and the online
   * count even when the pick left them out. Computed per spoken sentence, not per frame.
   */
  private spokenRacks(hass: HomeAssistant, b: Building): SpokenRack[] {
    const out: SpokenRack[] = [];
    for (const floor of b.floors) {
      const zones = zonesOf(floor);
      for (const f of floor.furniture) {
        const slots = f.rack?.slots;
        if (!slots?.length) continue;
        const card = rackCardValues(hass, slots, f.rack?.card?.metrics);
        const extra = rackCardValues(hass, slots, [RACK_HOTTEST, RACK_ONLINE]).filter((x) => !card.some((c) => c.key === x.key));
        const zone = zones.find((r) => r.points.length >= 3 && pointInPolygon([f.x, f.z], r.points));
        out.push({
          id: f.id,
          name: f.name || furnitureName(hass, f.type),
          room: zone?.name ?? "",
          names: Object.fromEntries(slots.map((s) => [s.id, s.name || furnitureName(hass, s.type)])),
          values: [...card, ...extra].map((x) => ({ key: x.key, kind: x.kind, slot: x.slot, label: this.rackValueLabel(x), text: this.rackValueText(x), value: x.value, of: x.of })),
        });
      }
    }
    return out;
  }

  /** Folds or unfolds a rack card; unfolded it shows every value with its sparkline (fetched now). */
  private toggleRackCard(id: string): void {
    if (!this.rackOpen.delete(id)) this.rackOpen.add(id);
    this.watchRackSpark();
    this.requestUpdate();
  }

  /** The statistics the unfolded rack cards' sparklines need. */
  private rackSparkIds(): string[] {
    const ids = this._holos.filter((c) => c.rack && this.rackOpen.has(c.rack.id)).flatMap((c) => c.rack!.values.flatMap((v) => v.ids));
    return [...new Set(ids)];
  }

  /**
   * The rack cards' sparklines: fetched when a card unfolds and then at most every five minutes (on a Home Assistant
   * update), never per frame; time travel reads the replayed statistics.
   */
  private watchRackSpark(): void {
    const ids = this.rackSparkIds();
    const r = this.replay;
    const key = r ? `tt|${ids.join(",")}|${Math.floor(r.t / 300000)}` : ids.join(",");
    if (key === this.rackSparkKey && (r || Date.now() - this.rackSparkAt < 300000)) return;
    this.rackSparkKey = key;
    if (!ids.length) {
      this._rackRows = null;
      return;
    }
    if (r) {
      this._rackRows = r.stats(ids, r.t - RACK_SPARK_MS, r.t + 1);
      return;
    }
    if (!this.hass || globalThis.document?.hidden) return;
    this.rackSparkAt = Date.now();
    void fetchRackSpark(this.hass, ids, RACK_SPARK_MS).then((rows) => {
      if (this.rackSparkKey === key) this._rackRows = rows;
    });
  }

  /** A rack card value as text: "2/3" online, a runtime in minutes or hours, else the number with its unit. */
  private rackValueText(v: RackCardValue): string {
    const hass = this.hass;
    if (v.key === RACK_ONLINE) return v.text;
    if (v.value === null) return v.key === RACK_HOTTEST ? "–" : stateText(hass, hass.states[v.key]);
    if (v.kind === "runtime" && /^(s|min|h)$/.test(v.unit)) {
      const min = v.value * (v.unit === "s" ? 1 / 60 : v.unit === "h" ? 60 : 1);
      return min < 120 ? `${Math.round(min)} min` : `${formatNumber(hass, min / 60, 1)} h`;
    }
    const digits = Number.isInteger(v.value) ? 0 : Math.abs(v.value) < 10 ? 2 : 1;
    return `${formatNumber(hass, v.value, digits)}${v.unit ? ` ${v.unit}` : ""}`;
  }

  /** A rack card value's name: what it is ("Load", "Hottest") or, for anything else, the entity's own name. */
  private rackValueLabel(v: RackCardValue): string {
    const hass = this.hass;
    if (v.key === RACK_HOTTEST) return translate(hass, "rack_card_hottest");
    if (v.key === RACK_ONLINE) return translate(hass, "rack_card_online");
    return v.kind === "other" ? entityName(hass, v.key) : translate(hass, `rack_kind_${v.kind}` as I18nKey);
  }

  /**
   * Racks (#120): a rack's glass card, in the energy cards' look. Folded it shows the devices online and the first few
   * values; a tap unfolds every value with the device it comes from and its sparkline (the last hours).
   */
  private renderRackCard(card: HoloCard, index: number) {
    const r = card.rack!;
    const open = this.rackOpen.has(r.id);
    const online = r.values.find((v) => v.key === RACK_ONLINE);
    const allOn = !!online && online.value === online.of;
    const values = r.values.filter((v) => v !== online);
    const toggle = () => this.toggleRackCard(r.id);
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      toggle();
    };
    const spark = (v: RackCardValue) => {
      const series = rackSpark(this._rackRows, v);
      return series.length > 1 ? sparkLine(series, v.kind === "temperature" ? "#ffb86b" : v.kind === "battery" ? "#4dff80" : "#7fe8ff") : nothing;
    };
    return html`<svg class="fp3d-holo-link" data-holo=${index} hidden aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0" /><circle cx="0" cy="0" r="3" /></svg>
      <div class="fp3d-holo fp3d-holo-dev fp3d-holo-rack ${open ? "" : "fp3d-holo-min"} ${this._low ? "fp3d-holo-plain" : ""}" data-holo=${index} hidden role="button" tabindex="0" aria-expanded=${open ? "true" : "false"} aria-label=${card.name} @click=${toggle} @keydown=${key}>
        <div class="fp3d-holo-sheen"></div>
        <div class="fp3d-holo-scan"></div>
        <div class="fp3d-holo-body">
          <div class="fp3d-holo-head"><span>▤ ${card.name}</span>${online ? html`<span class="fp3d-holo-live" style="color:${allOn ? RACK_STATUS_COLOURS.online : RACK_STATUS_COLOURS.warning}" title=${this.rackValueLabel(online)}>● ${online.text}</span>` : nothing}</div>
          ${open
            ? html`<div class="fp3d-rack-card-grid">
                ${values.map(
                  (v) => html`<div class="fp3d-rack-card-row">
                    <span>${this.rackValueLabel(v)}${v.slot ? html`<small>${r.names[v.slot] ?? ""}</small>` : nothing}</span><b>${this.rackValueText(v)}</b>
                    ${spark(v)}
                  </div>`,
                )}
              </div>`
            : html`<div class="fp3d-holo-cells">${values.slice(0, 4).map((v) => html`<div><small>${this.rackValueLabel(v)}</small><b>${this.rackValueText(v)}</b></div>`)}</div>`}
        </div>
      </div>`;
  }

  /** A device's card: its power now, today's consumption and the day curve from its sensor's statistics. */
  private renderDeviceCard(card: HoloCard, index: number) {
    const hass = this.hass;
    const t = (k: Parameters<typeof translate>[1]) => translate(hass, k);
    const open = !this.holoFolded.has(index);
    const day = this.dayOf(card);
    const curve = day && day.curve.length > 1 ? solarCurvePath(day.curve, day.peak) : null;
    const toggle = () => {
      if (this.holoFolded.has(index)) this.holoFolded.delete(index);
      else this.holoFolded.add(index);
      this.requestUpdate();
    };
    return html`<svg class="fp3d-holo-link" data-holo=${index} hidden aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0" /><circle cx="0" cy="0" r="3" /></svg>
      <div class="fp3d-holo fp3d-holo-dev ${open ? "" : "fp3d-holo-min"} ${this._low ? "fp3d-holo-plain" : ""}" data-holo=${index} hidden role="button" tabindex="0" aria-expanded=${open ? "true" : "false"} aria-label=${card.w === null ? card.name : `${card.name}: ${formatPower(hass, card.w)}`} @click=${toggle} @keydown=${activateKey(toggle)}>
      <div class="fp3d-holo-sheen"></div>
      <div class="fp3d-holo-scan"></div>
      <div class="fp3d-holo-body">
        <div class="fp3d-holo-head"><span>⚡ ${card.name}</span><span class="fp3d-holo-live">${this.replay ? "⏪" : `● ${t("holo_live")}`}</span></div>
        <div class="fp3d-holo-big"><b>${formatPower(hass, card.w ?? 0)}</b><span>${t("holo_dev_now")}</span></div>
        ${open && day ? html`<div class="fp3d-holo-sub">${t("holo_today")} <b>${formatNumber(hass, day.kwh, 1)} kWh</b> · ${t("holo_peak")} <b>${formatPower(hass, day.peak)}</b></div>` : nothing}
        ${open && curve
          ? svg`<svg class="fp3d-holo-curve" viewBox="0 0 220 44" width="156" height="30">
              <defs><linearGradient id="fp3dHoloG${index}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7fe8ff" stop-opacity=".5"/><stop offset="1" stop-color="#7fe8ff" stop-opacity="0"/></linearGradient></defs>
              <path d="${curve.area}" fill="url(#fp3dHoloG${index})"/>
              <path d="${curve.line}" fill="none" stroke="#a8f0ff" stroke-width="2"/>
              <circle cx="${curve.endX}" cy="${curve.endY}" r="3.5" fill="#fff" stroke="#7fe8ff" stroke-width="2"/>
              <line x1="0" y1="43.5" x2="220" y2="43.5" stroke="rgba(160,240,255,.35)"/>
            </svg>`
          : nothing}
      </div>
    </div>`;
  }

  /** Today's curve of a card from the fetched statistics of its sensors. */
  private dayOf(card: HoloCard) {
    if (!this._rows || !card.dayIds.length) return null;
    const rows = Object.fromEntries(card.dayIds.filter((id) => this._rows![id]).map((id) => [id, this._rows![id]]));
    return Object.keys(rows).length ? solarDayFromStats(rows, new Date(this.now()), Object.fromEntries(Object.keys(rows).map((id) => [id, this.hass?.states[id]?.attributes.unit_of_measurement as string | undefined]))) : null;
  }

  /** Grow or shrink the solar card (#144); `timed`: a tap on a touch screen, it shrinks again by itself. */
  private growHolo(on: boolean, index: number, timed = false): void {
    clearTimeout(this.holoBigTimer);
    this.holoBigTimer = undefined;
    if (on && !this._holoBig) {
      // the neighbours keep stepping round the small card: its size is taken before it grows
      const el = this.renderRoot?.querySelector<HTMLElement>(`.fp3d-holo[data-holo="${index}"]`);
      if (el?.offsetWidth) this.holoSizes.set(index, { w: el.offsetWidth, h: el.offsetHeight, at: performance.now() });
      void this.loadSolarMore();
    }
    if (on !== this._holoBig) this._holoBig = on;
    if (on && timed) this.holoBigTimer = setTimeout(() => this.growHolo(false, index), HOLO_BIG_MS);
  }

  /** The energy dashboard's forecast and today's production and export, fetched when the solar card grows (cached). */
  private async loadSolarMore(): Promise<void> {
    const hass = this.hass;
    if (!hass || this.replay || this.solarMoreLoading || (this._solarMore && Date.now() - this._solarMore.at < SOLAR_MORE_MS)) return;
    this.solarMoreLoading = true;
    try {
      const prefs = solarPrefsInfo(await hass.callWS<EnergyPrefs>({ type: "energy/get_prefs" }).catch(() => null));
      const ids = [...prefs.solar, ...prefs.export];
      const [forecast, change] = await Promise.all([
        prefs.forecast.length ? hass.callWS<SolarForecast>({ type: "energy/solar_forecast" }).catch(() => null) : null,
        ids.length ? fetchTodayChange(hass, ids) : null,
      ]);
      this._solarMore = { at: Date.now(), prefs, forecast, change };
    } finally {
      this.solarMoreLoading = false;
    }
  }

  /** What the grown solar card shows beyond the live figures: today's yield, the forecast and the extra rows. */
  private solarMore(day: SolarDay | null) {
    const m = this.replay ? null : this._solarMore;
    const sum = (ids: string[]) => (m?.change && ids.length ? ids.reduce((s, id) => s + (m.change!.get(id) ?? 0), 0) : null);
    const forecast = m ? forecastSplit(m.forecast, m.prefs.forecast, new Date(this.now())) : null;
    const produced = (m ? sum(m.prefs.solar) : null) ?? day?.kwh ?? null;
    return { forecast, produced, rows: solarMoreRows({ forecast, produced, exported: m ? sum(m.prefs.export) : null }) };
  }

  private renderHoloCard(card: HoloCard, index: number, e: EnergySummary) {
    const hass = this.hass;
    const t = (k: Parameters<typeof translate>[1]) => translate(hass, k);
    const day = this.dayOf(card);
    const main = card.kind === "main";
    // the solar card grown (#144): the whole card, whether folded or not, and what the energy dashboard adds
    const grown = main && this._holoBig;
    const open = grown || !this.holoFolded.has(index);
    const more = grown && e.solar !== null ? this.solarMore(day) : null;
    // self-sufficiency right now (D590): without a grid reading it is unknown, not 100 %
    const autarky = main && e.grid !== null && e.consumption !== null && e.consumption > 0 ? Math.round(Math.min(100, Math.max(0, (1 - Math.max(0, e.grid) / e.consumption) * 100))) : null;
    const fcHours = more?.forecast?.hours ?? null;
    const peak = Math.max(day?.peak ?? 0, ...(fcHours ?? [0]));
    const curve = day && day.curve.length > 1 ? solarCurvePath(day.curve, peak) : null;
    const fcPath = fcHours && peak > 0 ? forecastCurvePath(fcHours, peak) : null;
    const nowAt = new Date(this.now());
    const nowX = ((nowAt.getHours() + nowAt.getMinutes() / 60) / 24) * 220;
    const fold = () => {
      if (this.holoFolded.has(index)) this.holoFolded.delete(index);
      else this.holoFolded.add(index);
      this.requestUpdate();
    };
    // the solar card: a mouse grows it while it hovers and a click folds it as before; a touch (or the keyboard)
    // grows it, a second touch or a while later shrinks it (#144)
    const toggle = () => {
      if (!main) return fold();
      const press = this.holoPress;
      this.holoPress = "";
      if (press !== "mouse") return this.growHolo(!this._holoBig, index, true);
      fold();
      if (this._holoBig) {
        this.holoHoverOff = true;
        this.growHolo(false, index);
      }
    };
    const enter = (ev: PointerEvent) => {
      if (main && ev.pointerType === "mouse" && !this.holoHoverOff) this.growHolo(true, index);
    };
    const leave = (ev: PointerEvent) => {
      if (!main || ev.pointerType !== "mouse") return;
      this.holoHoverOff = false;
      this.growHolo(false, index);
    };
    const key = activateKey(toggle);
    const big = main ? (e.solar ?? e.consumption ?? 0) : (card.w ?? 0);
    const bat = main ? (e.battery !== null || e.soc !== null ? { soc: e.soc, w: e.battery } : null) : card.battery;
    return html`<svg class="fp3d-holo-link" data-holo=${index} hidden aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0" /><circle cx="0" cy="0" r="3" /></svg>
      <div
        class="fp3d-holo ${open ? "" : "fp3d-holo-min"} ${grown ? "fp3d-holo-grown" : ""} ${this._low ? "fp3d-holo-plain" : ""}"
        data-holo=${index}
        hidden
        role="button"
        tabindex="0"
        aria-label=${`${card.name}: ${formatPower(hass, big)}`}
        aria-expanded=${String(main ? grown : open)}
        @click=${toggle}
        @keydown=${key}
        @pointerdown=${(ev: PointerEvent) => (this.holoPress = ev.pointerType)}
        @pointerenter=${enter}
        @pointerleave=${leave}
      >
      <div class="fp3d-holo-sheen"></div>
      <div class="fp3d-holo-scan"></div>
      <div class="fp3d-holo-body">
        <div class="fp3d-holo-head"><span>☀ ${card.name}</span><span class="fp3d-holo-live">${this.replay ? "⏪" : `● ${t("holo_live")}`}</span></div>
        <div class="fp3d-holo-big"><b>${formatPower(hass, big)}</b><span>${t(main && e.solar === null ? "holo_house_now" : "holo_pv_now")}</span></div>
        ${open
          ? html`${main && this._plants.length > 1
                ? html`<div class="fp3d-holo-plants">${this._plants.map((p) => html`<span>${p.name}</span><b>${formatPower(hass, p.w)}</b>`)}</div>`
                : nothing}
              ${day
                ? html`<div class="fp3d-holo-sub">${t("holo_today")} <b>${formatNumber(hass, day.kwh, 1)} kWh</b> · ${t("holo_peak")} <b>${formatPower(hass, day.peak)}</b></div>`
                : more?.produced != null
                  ? html`<div class="fp3d-holo-sub">${t("holo_today")} <b>${formatNumber(hass, more.produced, 1)} kWh</b></div>`
                  : nothing}
              ${curve || fcPath
                ? svg`<svg class="fp3d-holo-curve" viewBox="0 0 220 44" width="208" height="38">
                    <defs><linearGradient id="fp3dHoloG${index}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffd75a" stop-opacity=".5"/><stop offset="1" stop-color="#ffd75a" stop-opacity="0"/></linearGradient></defs>
                    ${fcPath ? svg`<path class="fp3d-holo-fc" d="${fcPath}" fill="none" stroke="#aee9ff" stroke-width="1.5" stroke-dasharray="3 3"/>` : nothing}
                    ${curve
                      ? svg`<path d="${curve.area}" fill="url(#fp3dHoloG${index})"/>
                          <path d="${curve.line}" fill="none" stroke="#ffe27a" stroke-width="2"/>
                          <circle cx="${curve.endX}" cy="${curve.endY}" r="3.5" fill="#fff" stroke="#ffd75a" stroke-width="2"/>`
                      : nothing}
                    <line x1="0" y1="43.5" x2="220" y2="43.5" stroke="rgba(160,240,255,.35)"/>
                    <line x1="${nowX}" y1="2" x2="${nowX}" y2="43" stroke="rgba(160,240,255,.18)" stroke-dasharray="2 3"/>
                  </svg>`
                : nothing}
              ${fcPath ? html`<div class="fp3d-holo-legend"><span class="fp3d-holo-legend-act">${t("holo_actual")}</span><span class="fp3d-holo-legend-fc">${t("holo_forecast")}</span></div>` : nothing}
              ${more?.rows.length
                ? html`<div class="fp3d-holo-more">
                    ${more.rows.map((r) =>
                      r.key === "self_use"
                        ? html`<div class="fp3d-holo-more-row"><span>${t("holo_self_use")}</span><b>${formatNumber(hass, r.self, 1)} kWh</b></div>
                            <div class="fp3d-holo-more-row"><span>${t("holo_exported")}</span><b>${formatNumber(hass, r.exported, 1)} kWh</b></div>
                            <div class="fp3d-holo-split" title="${r.share} %"><div style="width:${r.share}%"></div></div>`
                        : html`<div class="fp3d-holo-more-row"><span>${t(r.key === "forecast_rest" ? "holo_fc_rest" : "holo_fc_tomorrow")}</span><b>${formatNumber(hass, r.kwh, 1)} kWh</b></div>`,
                    )}
                  </div>`
                : nothing}
              <div class="fp3d-holo-grid">
                ${bat
                  ? html`<div class="fp3d-holo-cell fp3d-holo-bat">
                      ${t("holo_battery")}<br /><b>${bat.soc !== null ? `${Math.round(bat.soc)} %` : formatPower(hass, Math.abs(bat.w ?? 0))}</b>
                      ${bat.w !== null && Math.abs(bat.w) >= 5 ? html`<span>${bat.w < 0 ? "▲" : "▼"} ${formatPower(hass, Math.abs(bat.w))}</span>` : nothing}
                    </div>`
                  : nothing}
                ${main && e.grid !== null
                  ? html`<div class="fp3d-holo-cell ${e.grid < -5 ? "fp3d-holo-exp" : "fp3d-holo-imp"}">
                      ${t("holo_grid")}<br /><b>${formatPower(hass, Math.abs(e.grid))}</b> <span>${Math.abs(e.grid) < 5 ? "" : t(e.grid < 0 ? "energy_grid_export" : "energy_grid_import")}</span>
                    </div>`
                  : nothing}
                ${main && e.consumption !== null ? html`<div class="fp3d-holo-cell fp3d-holo-house">${t("holo_house")}<br /><b>${formatPower(hass, e.consumption)}</b></div>` : nothing}
                ${main && this._wallboxW !== null ? html`<div class="fp3d-holo-cell fp3d-holo-wb">${t("holo_wallbox")}<br /><b>${formatPower(hass, this._wallboxW)}</b></div>` : nothing}
              </div>
              ${main && this._meters && (this._meters.gas !== null || this._meters.water !== null)
                ? html`<div class="fp3d-holo-sub fp3d-holo-meters">
                    ${this._meters.gas !== null ? html`<span>🔥 ${t("holo_gas")} <b>${formatNumber(hass, this._meters.gas, this._meters.gas < 10 ? 2 : 1)} ${meterUnit(hass, this.building?.energy.gas)}</b></span>` : nothing}
                    ${this._meters.water !== null ? html`<span>💧 ${t("holo_water")} <b>${waterText(hass, this._meters.water, meterUnit(hass, this.building?.energy.water))}</b></span>` : nothing}
                    <span>${t("holo_today_short")}</span>
                  </div>`
                : nothing}
              ${autarky !== null
                ? html`<div class="fp3d-holo-bar"><div style="width:${autarky}%"></div></div>
                    <div class="fp3d-holo-foot"><span>${t("holo_autarky")}</span><b>${autarky} %</b></div>`
                : nothing}`
          : nothing}
      </div>
    </div>`;
  }

  /**
   * New warnings start the pulse (and a jump to the room when wanted); none stops it. The past's warnings
   * glow without a pulse (no timer while the replay is paused) and are not remembered as seen, so going
   * back to live does not take them for new ones.
   */
  private setAlerts(alerts: Alert[]): void {
    const keys = alerts.map((a) => `${a.kind}:${a.entity}`);
    const fresh = this.ro ? [] : alerts.filter((_, i) => !this.seenAlerts.has(keys[i]));
    if (!this.ro) this.seenAlerts = new Set(keys);
    if (keys.join() !== this._alerts.map((a) => `${a.kind}:${a.entity}`).join()) this._alerts = alerts;
    // only warnings that light rooms pulse (a quiet one shows at the top and needs no timer)
    // (a leak's red floor stays steady until it is dry, #10)
    const pulsing = alerts.some((a) => !a.quiet && a.kind !== "water");
    if (pulsing && !this.alertTimer && !this.ro) this.alertTimer = setInterval(() => !document.hidden && this.applyTint(), this._low ? 200 : 100);
    if ((!pulsing || this.ro) && this.alertTimer) {
      clearInterval(this.alertTimer);
      this.alertTimer = undefined;
    }
    if (!fresh.length) return;
    const s = this.directorSettings();
    if (s?.alerts) {
      const a = fresh[0];
      if (this.directing.offer({ kind: "alert", key: `alert:${a.kind}:${a.entity}`, entity: a.entity }, Date.now(), s.hold ?? HOLD_DEFAULT)) {
        this.directorShow(() => this.jumpTo(a));
        return;
      }
    }
    if (this.alertJump) this.jumpTo(fresh[0]);
  }

  /**
   * Tidying only (#138): an editor's live view takes spent "for now" dismissals (their warning cleared, or fired again)
   * out of the plan. Whether a warning shows never depends on it (shownAlerts compares the activation's start with the
   * dismissal). Never while replaying; a module's warning only while the modules report.
   */
  private tidySnoozes(b: Building, active: Alert[], modulesOn: boolean): void {
    if (this.ro || !this.mayEdit) return;
    const done = clearedSnoozes(b.settings.alert_snoozed, active).filter((s) => modulesOn || HOUSE_ALERTS.has(s.kind));
    if (!done.length) return;
    const gone = new Set(done.map(snoozeKey));
    this.setPlanSettings({ alert_snoozed: (b.settings.alert_snoozed ?? []).filter((s) => !gone.has(snoozeKey(s))) });
  }

  /** Dismiss a banner warning for now or for good (a safety warning: for now only); editors only (#138). */
  private dismiss(a: Alert, forGood: boolean): void {
    const b = this.building;
    this._dismissing = null;
    if (!b || !this.mayEdit) return;
    this.setPlanSettings(dismissAlert(b.settings, a, forGood, Date.now()));
    this.setAlerts(this._alerts.filter((x) => alertKey(x) !== alertKey(a)));
    this.applyTint();
  }

  /** The live director's settings while it works on this screen (switched on here, Kamera-Cockpit, live, an event on). */
  private directorSettings(): DirectorSettings | null {
    const s = this.building?.settings.director;
    return this.director && !this.ro && directorAny(s) ? s! : null;
  }

  /**
   * Live director: look for a ring at the door, someone in front of a camera, an appliance that has finished – and
   * show the most important one. Runs on every state change while switched on (cheap: a few entities).
   */
  private direct(): void {
    const s = this.directorSettings();
    const hass = this.hass;
    const b = this.building;
    if (!s || !hass || !b) {
      // switched off: everything forgotten, so switching on again starts from the states of that moment
      if (this.directorSrc) {
        this.directing = new Director();
        this.directorSrc = null;
        clearTimeout(this.directorTimer);
        clearTimeout(this.restTimer);
        this.directorBack = null;
      }
      return;
    }
    const now = Date.now();
    const hold = s.hold ?? HOLD_DEFAULT;
    // the doorbells and cameras' sensors are found once per registry, plan and settings (not on every state change)
    const sig = `${JSON.stringify(s)}|${b.floors.map((f) => f.placements.length).join()}`;
    if (!this.directorSrc || this.directorSrc.registry !== hass.entities || this.directorSrc.building !== b || this.directorSrc.sig !== sig) {
      const placed = [...new Set(b.floors.flatMap((f) => f.placements.map((p) => p.entity_id)))];
      const motion = s.motion ?? "off";
      this.directorSrc = {
        registry: hass.entities,
        building: b,
        sig,
        bells: (s.doorbell ? doorbellEntities(hass, s.doorbell_entity) : []).map((id) => ({ id, camera: doorbellCamera(hass, id, placed, s.doorbell_camera) })),
        motion:
          motion === "off"
            ? []
            : placed
                .filter((id) => id.startsWith("camera."))
                .flatMap((cam) => cameraMotionSensors(hass, cam).filter((sensor) => motion === "all" || detectionKind(hass, sensor) === "person").map((sensor) => ({ sensor, cam }))),
      };
    }
    const shots: Shot[] = [];
    // every source is looked at each time (its last state is remembered), shown or not
    for (const bell of this.directorSrc.bells) {
      if (this.directing.edge(bell.id, hass.states[bell.id], (a, c) => doorbellRang(a, c, now))) {
        shots.push({ kind: "doorbell", key: `bell:${bell.id}`, entity: bell.id, camera: bell.camera });
      }
    }
    // own triggers: an entity that goes on or open, with the camera chosen for it (D615)
    for (const t of s.triggers ?? []) {
      if (!t.entity) continue;
      if (this.directing.edge(`trigger:${t.entity}`, hass.states[t.entity], (a, c) => triggerFired(a, c, now))) {
        shots.push({ kind: "trigger", key: `trigger:${t.entity}`, entity: t.entity, camera: t.camera });
      }
    }
    for (const m of this.directorSrc.motion) {
      if (this.directing.edge(m.sensor, hass.states[m.sensor], (a, c) => a?.state === "off" && c?.state === "on")) {
        shots.push({ kind: "motion", key: `cam:${m.cam}`, entity: m.sensor, camera: m.cam });
      }
    }
    if (s.appliances) {
      for (const [id, a] of this.appliances) if (this.directing.stopped(`app:${id}`, a.running, now)) shots.push({ kind: "appliance", key: `app:${id}`, entity: id });
      // a program that just rested is looked at again once its rest is long enough to count as the end
      clearTimeout(this.restTimer);
      if (this.directing.resting()) this.restTimer = setTimeout(() => this.direct(), 60_000);
    }
    const order: Shot["kind"][] = ["doorbell", "trigger", "motion", "appliance"];
    shots.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));
    for (const shot of shots) {
      if (!this.directing.offer(shot, now, hold)) continue;
      this.directorShow(() => this.directorGo(shot));
      break;
    }
  }

  /** Show a shot: remember where the view was (once per series of shots), go, and plan the way back. */
  private directorShow(go: () => void): void {
    const v = this.viewer;
    if (!v) return;
    if (!this.directorBack) this.directorBack = { floorId: this.floorId, roomId: this.roomId, view: v.getView() };
    v.setAutoOrbit(0);
    go();
    clearTimeout(this.directorTimer);
    const cur = this.directing.current;
    if (cur) this.directorTimer = setTimeout(() => this.directorDue(), Math.max(0, cur.until - Date.now()) + 50);
  }

  private directorGo(shot: Shot): void {
    const b = this.building;
    if (!b) return;
    // a camera at the door (or the one that saw someone): look through it, when it is placed in the plan
    if (shot.camera && b.floors.some((f) => f.placements.some((p) => p.entity_id === shot.camera))) {
      const camera = shot.camera;
      // an open room panel would lie over the camera picture: the room closes first (the way back reopens it)
      if (this.roomId) {
        // a tap on the open room closes it (panel and card toggle it)
        this.fire("room-tap", { floorId: this.floorId, roomId: this.roomId });
        setTimeout(() => this.lookThrough(camera), 250);
      } else this.lookThrough(camera);
      return;
    }
    if (shot.kind === "appliance") {
      const a = this.appliances.get(shot.key.slice(4));
      if (a) this.goTo({ kind: "device", name: "", where: "", floorId: a.floorId, roomId: null, entity: a.entity, icon: null, x: a.x, z: a.z, y: 1 });
      return;
    }
    this.showEntity(shot.entity);
  }

  /** The shot's time is up: back to where the view was – unless someone took the screen meanwhile. */
  private directorDue(): void {
    const due = this.directing.due(Date.now());
    const back = this.directorBack;
    if (!due) return;
    this.directorBack = null;
    if (!due.back || !back) return;
    if (this._through) {
      this._through = null;
    }
    if (this.floorId !== back.floorId) this.fire("floor-tap", { floorId: back.floorId });
    if (back.roomId) setTimeout(() => this.fire("room-tap", { floorId: back.floorId, roomId: back.roomId }), 60);
    else if (this.roomId && back.floorId) setTimeout(() => this.fire("room-tap", { floorId: back.floorId, roomId: null }), 60);
    setTimeout(() => {
      this.viewer?.flyTo(back.view);
      this.viewer?.setAutoOrbit(this.autoOrbit ? 0.06 : 0);
    }, 400);
  }

  /** Show where a warning is: its floor and room, or the house for an alarm. */
  private jumpTo(a: Alert): void {
    if (!a.floorId) {
      this.fire("floor-tap", { floorId: null });
      return;
    }
    if (this.floorId !== a.floorId) this.fire("floor-tap", { floorId: a.floorId });
    // the host switches the floor first; the room follows once it has rendered
    if (a.roomId) setTimeout(() => this.fire("room-tap", { floorId: a.floorId, roomId: a.roomId }), 60);
  }

  /** Double tap on a room: all its lights off when one is on, otherwise all on. */
  private onRoomDoubleTap(floorId: string, roomId: string): void {
    const b = this.building;
    const hass = this.hass;
    const floor = b?.floors.find((f) => f.id === floorId);
    const room = floor ? zonesOf(floor).find((r) => r.id === roomId) : undefined;
    if (!b || !hass || !floor || !room || this.ro) return;
    const ids = new Set(areaEntities(hass, room.area_id).filter((id) => kindOf(id) === "light"));
    for (const p of floor.placements) if (kindOf(p.entity_id) === "light" && pointInPolygon([p.x, p.z], room.points)) ids.add(p.entity_id);
    for (const f of floor.furniture) {
      const e = this.furnitureLinks.get(f.id)?.entity;
      if (e && isLamp(f.type) && pointInPolygon([f.x, f.z], room.points)) ids.add(e);
    }
    // devices that ask before switching stay out of the all-at-once toggle
    const lights = [...ids].filter((id) => !this.confirmSet.has(id));
    if (!lights.length) return;
    const anyOn = lights.some((id) => hass.states[id]?.state === "on");
    safeCall(hass, "homeassistant", anyOn ? "turn_off" : "turn_on", { entity_id: lights });
    this.roomFlash = { roomId, until: performance.now() + 350 };
    this.applyTint();
    setTimeout(() => {
      this.roomFlash = null;
      this.applyTint();
    }, 380);
  }

  private runScene(id: string): void {
    if (this.ro) return;
    safeCall(this.hass, id.split(".")[0], "turn_on", { entity_id: id });
    this._sceneFired = id;
    setTimeout(() => (this._sceneFired = null), 600);
  }

  /** Motion lights its room for the set time (#10); the view looks again when the first of them goes dark. */
  private applyMotion(): void {
    const v = this.viewer;
    const b = this.building;
    const hass = this.hass;
    clearTimeout(this.motionTimer);
    this.motionTimer = undefined;
    if (!v || !b || !hass) return;
    const now = this.now();
    const lit = motionRooms(hass, b, now);
    v.setRoomGlow(lit.rooms);
    // a replay moves its own clock and looks again on every tick
    if (lit.next !== null && !this.replay) this.motionTimer = setTimeout(() => this.applyMotion(), Math.max(50, lit.next - now + 20));
  }

  /**
   * Floor colours of the rooms: the heatmap, the pulsing rooms of warnings and the flash of a double
   * tap; sent to the viewer only when they changed.
   */
  private applyTint(): void {
    const v = this.viewer;
    const b = this.building;
    const hass = this.hass;
    if (!v || !b || !hass) return;
    let tint: Map<string, [number, number, number]> | null = null;
    if (this.heatMode !== "none" && this.heatMode !== "values") {
      const mode = this.heatMode;
      const values = roomValues(hass, b, mode);
      // the legend's "nothing found" line depends on it: render again when that changes
      if (!values.size !== !this.heatValues.size) this.requestUpdate();
      this.heatValues = values;
      tint = new Map([...values].map(([id, value]) => [id, heatColor(mode, value)]));
    }
    // "values": the numbers at the room names instead of coloured floors
    const info = new Map<string, string>();
    if (this.heatMode === "values") {
      for (const floor of b.floors)
        // outdoor areas acting as rooms show their values too (the garden's temperature, #100)
        for (const room of zonesOf(floor)) {
          const t = roomClimateValue(hass, floor, room, "temperature");
          const h = roomClimateValue(hass, floor, room, "humidity");
          const c = roomClimateValue(hass, floor, room, "co2");
          const parts = [
            t !== null ? `${formatNumber(hass, fromCelsius(hass, t), 1)} ${tempUnit(hass)}` : null,
            h !== null ? `${formatNumber(hass, h, 0)} %` : null,
            c !== null ? `${formatNumber(hass, c, 0)} ppm` : null,
          ].filter((x): x is string => !!x);
          if (parts.length) info.set(room.id, parts.join(" · "));
        }
    }
    v.setRoomInfo(info);
    if (this._alerts.length) {
      tint ??= new Map();
      const pulse = this.ro ? 1 : 0.55 + 0.45 * Math.sin(performance.now() / 160);
      for (const a of this._alerts) {
        // a warning without a room (a pool's: it is outside) shows at the top only, the rooms stay calm
        if (a.quiet) continue;
        // a leak's floor stays red until it is dry; the others pulse (#10)
        const k = a.kind === "water" ? 1 : pulse;
        const c = alertTint(a).map((x) => x * k) as [number, number, number];
        if (a.roomId) tint.set(a.roomId, c);
        // a warning of one floor lights that floor's rooms; the house (alarm, power outage) all of them
        else for (const f of b.floors) if (!a.floorId || f.id === a.floorId) for (const r of f.rooms) tint.set(r.id, c);
      }
    }
    if (this.roomFlash && performance.now() < this.roomFlash.until) {
      tint ??= new Map();
      tint.set(this.roomFlash.roomId, [0.9, 0.95, 1]);
    }
    const sig = tint ? [...tint].map(([id, c]) => `${id}:${c.map((x) => x.toFixed(2)).join(",")}`).join(";") : "";
    if (sig === this.tintSig) return;
    this.tintSig = sig;
    v.setRoomTint(tint);
  }

  /**
   * Markers, energy consumers and lit screens of furniture with linked entities. Entities that are
   * placed as devices as well keep their device marker.
   */
  private furnitureMarkers(
    hass: HomeAssistant,
    b: Building,
    taken: Set<string>,
    consumerSensors: Set<string>,
  ): { markers: (DeviceMarker & { fromFurniture: boolean; energyDevice?: boolean; standby?: boolean })[]; consumers: Consumer[]; screens: Map<string, ScreenState>; targets: Map<string, string> } {
    const markers: (DeviceMarker & { fromFurniture: boolean; energyDevice?: boolean; standby?: boolean })[] = [];
    const consumers: Consumer[] = [];
    const screens = new Map<string, ScreenState>();
    let batSummary: EnergySummary | undefined;
    const targets = new Map<string, string>();
    // devices placed on their own keep their pin; two pieces of furniture on one entity (a copy) each get theirs, like lamps (#688)
    const placed = new Set(taken);
    // Household: what is due now, for the glass card
    const today: HouseholdItem[] = [];
    this.binHolos = [];
    this.binSpots = new Map();
    this.binCues = [];
    this.printerCams.clear();
    // a module lights furniture of its own (the pool module: the pump while it runs, the heat pump while it heats)
    const glows = new Map(this.scene.filter((p): p is Extract<ScenePiece, { kind: "glow" }> => p.kind === "glow").map((p) => [p.furnitureId, p]));
    for (const floor of b.floors) {
      for (const f of floor.furniture) {
        const linked = this.furnitureLinks.get(f.id);
        // furniture with a state: a glowing plate on the item while its entity is on, occupied or home;
        // two entities light the halves (left/right of a bed, bottom/top of a bunk bed)
        const faces = this.stateFaces(hass, f);
        if (faces.length) screens.set(f.id, { color: faces[0].color, level: faces[0].level, faces });
        if (isLamp(f.type)) {
          const lamp = this.lampMarker(hass, floor, f, linked?.entity ?? null);
          markers.push(lamp);
          // a ceiling fan with light: its fan gets a pin of its own beside the light (tap: on/off, hold: speed)
          const fan = f.type === "lamp_fan" && f.fan && f.fan !== "none" ? f.fan : null;
          if (fan && !taken.has(fan)) {
            taken.add(fan);
            const st = hass.states[fan];
            const a = (f.rotation * Math.PI) / 180;
            const off = Math.min(0.45, f.w * 0.3);
            markers.push({
              id: fan,
              floorId: floor.id,
              roomId: lamp.roomId,
              x: f.x + Math.cos(a) * off,
              z: f.z + Math.sin(a) * off,
              y: lamp.y,
              icon: f.icon ? mdiIcon(f.icon) : iconSvg("fan"),
              name: entityName(hass, fan),
              // its speed while it runs
              text: st && fanSpeed(st) > 0 && typeof st.attributes.percentage === "number" ? `${Math.round(st.attributes.percentage)} %` : st ? stateText(hass, st) : "",
              active: st ? isActive(st) : false,
              unavailable: st ? isUnavailable(st) : false,
              glow: null,
              furnitureId: f.id,
              show: f.marker ?? "always",
              fromFurniture: true,
            });
          }
          continue;
        }
        if (TECH_TYPES.has(f.type)) {
          const pin = this.techItem(hass, floor, f, screens, taken);
          if (pin) {
            markers.push(pin);
            targets.set(f.id, pin.id);
          }
          continue;
        }
        if (GANG_TYPES.has(f.type)) {
          const pin = this.gangItem(hass, floor, f, consumers, screens, consumerSensors);
          if (pin) {
            markers.push(pin);
            targets.set(f.id, pin.id);
          }
          continue;
        }
        // a home battery with only its charge, a wallbox with only its status still gets its marker;
        // a parking spot with the car feature data gets one even without a presence sensor
        const glow = glows.get(f.id);
        if (glow) screens.set(f.id, { color: glow.color, level: glow.level });
        // Household: a bin glows the evening before its pickup, a mailbox while post lies in it, a plant while it
        // is thirsty
        const plant = (f.type === "plant" || isPackPlant(f.type)) && !!f.moisture && f.moisture !== "none";
        if (f.type === "waste_bin" || f.type === "mailbox" || plant) {
          const hh = this.householdState(hass, floor, f);
          if (hh?.screen) screens.set(f.id, hh.screen);
          if (hh?.marker) markers.push(hh.marker);
          // a tap on the bin itself shows its next pickups (on the mailbox or the plant: their sensor)
          const src = f.type === "waste_bin" ? f.bin_source : f.type === "mailbox" ? f.entity : f.moisture;
          if (typeof src === "string" && src !== "none") targets.set(f.id, `hh:${src}#${f.id}`);
          if (hh?.item) today.push(hh.item);
          if (!plant) continue;
        }
        // a consumable or service due (a filter, salt): a yellow glow on the item
        // a second one (a robot vacuum's dock) is a line of its own on the card
        const due = servicesDue(f, hass);
        if (due.length && !screens.has(f.id)) screens.set(f.id, { color: [1, 0.8, 0.2], level: 0.8, faces: [{ part: "top", color: [1, 0.8, 0.2], level: 0.8 }] });
        for (const id of due) {
          const name = f.name || furnitureName(hass, f.type);
          today.push({ icon: "wrench-outline", text: id === f.service ? translate(hass, "hh_service", { name }) : translate(hass, "hh_service2", { name, what: entityName(hass, id) }), entity: id });
        }
        // a fridge door standing open too long: the fridge glows icy blue (the warning shows at the top)
        if ((f.type === "fridge" || f.type === "fridge_smart") && fridgeOpenTooLong(f, hass)) {
          screens.set(f.id, { color: [0.45, 0.85, 1], level: 1, faces: [{ part: "band", color: [0.45, 0.85, 1], level: 1 }] });
          today.push({ icon: "fridge-alert-outline", text: translate(hass, "hh_fridge_open", { name: f.name || furnitureName(hass, f.type) }), entity: doorsOf(f)[0] ?? null });
        }
        const autoPro = f.type === "parking" && !!f.car;
        const car = autoPro ? carState(hass, f) : null;
        // Household: a washer with only its time left still gets its pin
        const appliance = f.type === "washer" || f.type === "dryer" || f.type === "dishwasher";
        const extraRef = energyRole(f.type) === "home_battery" ? f.soc : energyRole(f.type) === "wallbox" ? f.status : f.type === "parking" && car ? (f.car?.device ?? car.entities.soc) : appliance ? (f.remaining ?? null) : null;
        const extra = extraRef && extraRef !== "none" ? extraRef : null;
        // a battery model shows its charge as four bars (#282): its own sensor, else its inverter's setup, else the house average
        const batCharge = energyRole(f.type) === "home_battery" ? batteryCharge(hass, b, floor.id, f, (batSummary ??= energySummary(hass, b, [], deviceSensors(b)))) : null;
        if (batCharge) {
          const lit = chargeBars(batCharge.soc);
          screens.set(f.id, {
            color: BAR_RGB.green,
            level: 0.9,
            faces: lit.map((c, i) => ({ part: "charge" as const, index: i, of: CHARGE_BAR_COUNT, color: c ? BAR_RGB[c] : DARK_BAR_RGB, level: c ? 0.9 : 0.15 })),
          });
        }
        // a sensor whose value stands at the symbol (a boiler's water temperature, D619): a pin even without a link
        const extraSensor = f.extra && f.extra !== "none" && hass.states[f.extra] ? f.extra : null;
        // a radiator or hot-water cylinder with a temperature shades from cold blue to warm red with it, its pin
        // tells the temperature (#10)
        const shade = itemShade(hass, b, f);
        const shadeText = shade && shade.sensor !== extraSensor && shade.sensor !== linked?.entity ? `${formatNumber(hass, fromCelsius(hass, shade.celsius), 0)} ${tempUnit(hass)}` : "";
        const extraText = [extraSensor ? stateText(hass, hass.states[extraSensor]) : "", shadeText].filter(Boolean).join(" · ");
        const withExtra = (t: string) => (extraText ? (t ? `${t} · ${extraText}` : extraText) : t);
        const link = linked ?? (extra || extraSensor || shade ? { entity: null, power: null } : undefined);
        if (!link) continue;
        // a battery goes by its charge first: its power sensor is often placed on its own as well
        const id = (energyRole(f.type) === "home_battery" ? (extra ?? link.entity ?? link.power) : (link.entity ?? link.power ?? extra ?? extraSensor))!;
        targets.set(f.id, id);
        const st = link.entity ? hass.states[link.entity] : undefined;
        // the meter's sensor is the grid (+ = import), the battery's can point the other way as well
        const invert = energyRole(f.type) === "meter" ? b.energy.grid_invert && !f.export : energyRole(f.type) === "home_battery" ? b.energy.battery_invert && !f.charge : false;
        let power = link.power ? readPower(hass.states[link.power], invert) : null;
        // separate second sensors: a battery's charging, a meter's export (then the first one is unsigned)
        const second = (energyRole(f.type) === "home_battery" && f.charge && f.charge !== "none" ? f.charge : energyRole(f.type) === "meter" && f.export && f.export !== "none" ? f.export : null) as string | null;
        const secondW = second ? readPower(hass.states[second]) : null;
        if (secondW !== null) power = Math.max(0, power ?? 0) - Math.max(0, secondW);
        // the meter, inverters, panels and batteries have cables of their own: their watts are no load (#43)
        if (link.power && power !== null && isLoad(f.type) && !consumerSensors.has(link.power)) {
          consumerSensors.add(link.power);
          const circuit = f.circuit && f.circuit !== "none" ? f.circuit : undefined;
          const energy = f.energy ?? undefined;
          consumers.push({ id, powerEntity: link.power, floorId: floor.id, x: f.x, z: f.z, power: Math.max(0, power), wallbox: energyRole(f.type) === "wallbox" || undefined, circuit, ...(energy ? { energy } : {}) });
        }
        // an own threshold for appliances behind a smart plug that draw a few watts on standby (null: 10 W)
        const runW = typeof f.run_w === "number" && f.run_w > 0 ? f.run_w : 10;
        // below its own threshold the pin shows only the state, not the standby watts (#645)
        const standby = typeof f.run_w === "number" && f.run_w > 0 && power !== null && power <= f.run_w;
        const running = (power ?? 0) > runW || st?.state === "on" || st?.state === "running" || (isStatusSensor(st) && isActive(st));
        // the live director notices a program ending (a washer done) from the same reading
        if (appliance) this.appliances.set(f.id, { floorId: floor.id, x: f.x, z: f.z, entity: link.entity ?? link.power ?? f.id, running });
        // Household: a washer, dryer or dishwasher tells the time left while it runs and "finished" afterwards –
        // until its door opens (or it runs again); from its own state, or remembered from the moment it stopped
        let hhText: string | null = null;
        if (appliance) {
          const left = f.remaining && f.remaining !== "none" ? hass.states[f.remaining] : undefined;
          const min = remainingMinutes(left);
          // without a power sensor it runs while time is left
          const busy = running || (!link.power && !link.entity && (min ?? 0) > 0);
          const doors = doorsOf(f);
          const opened = (t: number) => doors.some((d) => { const ds = hass.states[d]; return !!ds?.last_changed && Date.parse(ds.last_changed) > t; });
          const remembered = this.finished.update(f.id, busy, opened);
          const name = f.name || (link.entity ? entityName(hass, link.entity) : furnitureName(hass, f.type));
          if (busy) {
            // running by its time left alone: it glows like one that draws power
            if (!running) screens.set(f.id, runGlow(f.type));
            // a time left only while it runs: its plug or status off, or standby power, make it a leftover on the
            // display sensor (after a power cut)
            if (min !== null && !applianceIdle(st, link.power ? power : null, runW)) {
              hhText = translate(hass, "hh_left", { t: remainingText(min) });
              today.push({ icon: "timer-outline", text: `${name}: ${hhText}`, entity: f.remaining ?? link.entity });
            }
          } else if (isFinishedState(st) || isFinishedState(left) || remembered) {
            hhText = translate(hass, "hh_done");
            screens.set(f.id, { color: [0.35, 1, 0.55], level: 0.9, faces: [{ part: "top", color: [0.35, 1, 0.55], level: 0.9 }] });
            today.push({ icon: "check-circle-outline", text: translate(hass, "hh_finished", { name }), entity: link.entity ?? link.power });
          }
        }
        // Cars: the vehicle in the spot wears a light band in the colour of its charge (brighter while
        // charging) and a warm glow on top while the climate runs; the spot's pin tells charge and range
        if (car && parkedVehicle(hass, f)) {
          const faces: NonNullable<ScreenState["faces"]> = [];
          if (car.soc !== null) {
            const col: [number, number, number] = car.soc >= 50 ? [0.3, 1, 0.5] : car.soc >= 20 ? [1, 0.8, 0.25] : [1, 0.3, 0.25];
            faces.push({ part: "band", color: col, level: car.charging ? 1 : 0.6 });
          }
          // unlocked: head- and taillights glow amber, like the indicators when a car opens
          if (car.locked === false) faces.push({ part: "lights", color: [1, 0.42, 0.02], level: 1 });
          if (car.climateOn) {
            // the cabin glows through the windows: warm while heating (or unknown), cool blue while cooling
            const clim = car.entities.climate ? hass.states[car.entities.climate] : undefined;
            const cooling = !!clim && (clim.attributes.hvac_action === "cooling" || clim.state === "cool");
            faces.push({ part: "cabin", color: cooling ? [0.45, 0.8, 1] : [1, 0.55, 0.22], level: 0.35 });
          }
          if (faces.length) screens.set(`${f.id}:vehicle`, { color: faces[0].color, level: faces[0].level, faces });
        }
        if (shade?.kind === "radiator") {
          // brighter while it heats
          const a = st && kindOf(st.entity_id) === "climate" ? st.attributes : null;
          const heating = heatSensorOn(hass, f.heat_sensor) ?? (!!a && isActive(st) && a.hvac_action !== "cooling"); // a TRV without hvac_action: below its target (#81)
          screens.set(f.id, { color: shade.color, level: heating ? 0.9 : 0.55, shade: true });
        } else if (shade?.kind === "tank") {
          // warm above, cooler below, like the water in it
          const s = effectSettings(b);
          const below = tempShade(shade.celsius - 0.3 * (s.tank_hot - s.tank_cold), s.tank_cold, s.tank_hot);
          screens.set(f.id, { color: below, level: 0.8, shade: true, faces: [{ part: "strata", color: below, top: shade.color, level: 0.8 }] });
        } else if (isThermostatItem(f.type) && ((st && kindOf(st.entity_id) === "climate") || f.heat_sensor)) {
          // glows while it heats; brighter the further the room is below its target. A thermostat that does not tell
          // (Tuya's valves report a "work state" sensor instead) is asked through the radiator's own sensor (D637)
          const a = st && kindOf(st.entity_id) === "climate" ? st.attributes : null;
          const heating = heatSensorOn(hass, f.heat_sensor) ?? (!!a && isActive(st) && a.hvac_action !== "cooling"); // a TRV without hvac_action: below its target (#81)
          if (heating) {
            const gap = a && typeof a.temperature === "number" && typeof a.current_temperature === "number" ? a.temperature - a.current_temperature : 1;
            screens.set(f.id, { color: [1, 0.42, 0.1], level: Math.min(1, 0.45 + 0.25 * Math.max(0, gap)) });
          } else if (glows.has(f.id)) screens.delete(f.id); // its own thermostat says it does not heat: a module's glow does not overrule it
        } else if (f.type === "ac_unit" && st && kindOf(st.entity_id) === "climate") {
          const glow = climateModeGlow(st);
          if (glow) screens.set(f.id, glow);
        } else if ((f.type === "washer" || f.type === "dryer" || f.type === "dishwasher") && running) {
          screens.set(f.id, runGlow(f.type));
        } else if (f.type === "stove" || isPackCooktop(f.type)) {
          // the burners glow while it cooks (or draws power), faintly while it is ready
          const level = cooktopLevel(st, running);
          if (level > 0) screens.set(f.id, { color: [1, 0.05, 0.01], level, faces: [{ part: "burners", color: [1, 0.05, 0.01], level }] });
        }
        const packed = packItem(f.type);
        const ringed = !!packed && !packed.light && packed.parts.some((p) => p.glow);
        if (st && ringed && kindOf(st.entity_id) === "media" && st.state === "playing" && !hasScreen(f.type)) {
          // Klang & Kino: a speaker without a screen lights its ring in the app's colour while it plays
          const vol = typeof st.attributes.volume_level === "number" ? st.attributes.volume_level : 0.5;
          screens.set(f.id, { color: appColor(st) ?? [0.22, 0.88, 1], level: 0.5 + 0.5 * vol, ring: true, plain: true });
        }
        // a roll-down screen driven by a cover moves (pushPackMotion) instead of lighting up while it is "open" (#511)
        if (st && hasScreen(f.type) && !isPackCooktop(f.type) && !(packMotion(f.type) && kindOf(st.entity_id) === "cover")) {
          // a light (an aquarium, a lit panel) glows in its own colour, other entities in the neon cyan
          const lit = kindOf(st.entity_id) === "light" ? lightGlow(st) : null;
          // many TV integrations (Samsung, LG) only report "on", never "playing": on is lit, dimmed
          const tvOn = kindOf(st.entity_id) === "media" && ["playing", "on", "paused", "idle"].includes(st.state);
          const color = kindOf(st.entity_id) === "media" ? appColor(st) : lit ? lit.color : isActive(st) || tvOn ? ([0.22, 0.88, 1] as [number, number, number]) : null;
          const picture = kindOf(st.entity_id) === "media" ? ((st.attributes.entity_picture as string | undefined) ?? null) : null;
          // a TV's Ambilight (glowing strips round its back) shines whenever its screen is lit
          if (color) screens.set(f.id, { color, level: st.state === "playing" ? 1 : 0.6, picture, ring: packAmbilight(f.type) || (ringed && st.state === "playing") });
        }
        // its own "active" colour (#289): over the usual glow while its entity is playing, on or triggered
        const alarmed = !!st && alarmTriggered(st);
        if (st && (f.active_color || alarmed) && (isActive(st) || alarmed || (kindOf(st.entity_id) === "media" && st.state === "on"))) {
          const c = activeGlow(f.active_color || (alarmed ? "#ff3b30" : ""));
          if (c) {
            const was = screens.get(f.id);
            screens.set(f.id, { ...(was ?? { level: 0.8 }), color: c, ...(was?.faces ? { faces: was.faces.map((x) => ({ ...x, color: c })) } : {}) });
          }
        }
        // a 3D printer (#11): its progress ring and chamber light; a tap shows its camera, its pin the per cents
        const printer = isPrinter(f.type) ? printerState(hass, link.entity) : null;
        if (printer) {
          const pf = printerFaces(printer);
          if (pf.length) screens.set(f.id, { color: pf[0].color, level: pf[0].level, faces: pf });
          if (printer.camera) this.printerCams.set(id, printer.camera);
        }
        const printText = printer?.progress != null ? ` · ${Math.round(printer.progress * 100)} %` : "";
        if (placed.has(id)) continue;
        taken.add(id);
        const kind = link.entity ? kindOf(link.entity) : null;
        const room = roomHolding(floor, f.x, f.z);
        // a pack's heat pump indoor unit (or boiler, buffer tank) with a water_heater entity: its mode and water temperature (#645)
        const boiler = !!st && isPackHeater(f.type) && st.entity_id.startsWith("water_heater.") ? waterHeaterText(hass, st) : null;
        markers.push({
          id,
          floorId: floor.id,
          roomId: room?.id ?? null,
          x: f.x,
          z: f.z,
          y: markerHeight(f) + mountBase(floor, f),
          icon: f.icon ? mdiIcon(f.icon) : boiler ? mdiIcon("water-boiler") : iconSvg(kind ?? "switch"),
          name: f.name || (link.entity ? entityName(hass, link.entity) : furnitureName(hass, f.type)),
          ownName: f.name || undefined,
          showName: !!f.show_name,
          text: withExtra(hhText ??
            (car
              ? this.carText(hass, car, !!st && !PRESENT_STATES.has(st.state.toLowerCase()))
              : energyRole(f.type) === "home_battery"
              ? this.batteryText(hass, extra, power, batCharge && !batCharge.own ? batCharge.soc : null)
              : energyRole(f.type) === "wallbox"
                ? this.wallboxText(hass, extra, power)
                : energyRole(f.type) === "meter"
                  ? this.meterText(hass, power)
                  : boiler
                    ? boiler.text
                    : st
                    ? stateText(hass, st) + printText
                    : standby
                      ? translate(hass, "pin_standby")
                      : power !== null
                        ? formatPower(hass, Math.max(0, power))
                        : "")),
          active: hhText ? true : car ? car.charging : boiler ? boiler.on : st ? isActive(st) : (power ?? 0) > (typeof f.run_w === "number" && f.run_w > 0 ? f.run_w : 5),
          unavailable: st ? isUnavailable(st) : false,
          glow: null,
          // its pin grabs the item when furnishing
          furnitureId: f.id,
          // inverter, battery, wallbox: their own text (watts, charge, status) is always worth a pin
          energyDevice: energyRole(f.type) === "inverter" || energyRole(f.type) === "home_battery" || energyRole(f.type) === "wallbox" || energyRole(f.type) === "meter" || !!car || !!extraSensor || !!shade,
          ...(standby ? { standby } : {}),
          // Cars: the car's charge and range are the point of the pin – shown in full by default
          show: f.marker ?? (car || hhText ? "always" : undefined),
          fromFurniture: true,
        });
      }
    }
    // the plan may label only the next pickup's bins, or only from some days before; the others keep their tap
    const tagSet = b.settings.household;
    if (tagSet?.bin_next_only || typeof tagSet?.bin_days === "number") {
      const shown = binTagsShown(this.binHolos.filter((t) => !t.icon), { nextOnly: tagSet.bin_next_only, ahead: tagSet.bin_days });
      this.binHolos = this.binHolos.filter((t) => t.icon || shown.has(t.id));
    }
    // two bins of the same kind out on the same day are one line
    // the pinboard (D628): a text helper's lines, one above the other, first in the list
    const notes = b.settings.household?.notes;
    const noteSt = notes && notes !== "none" ? hass.states[notes] : undefined;
    if (noteSt && !isUnavailable(noteSt) && noteSt.state.trim()) {
      const lines = noteSt.state
        .split(/\s*(?:\||\n|;)\s*/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 8);
      today.unshift(...lines.map((text) => ({ icon: "pin-outline", text, entity: notes as string })));
    }
    // the same list again is no new state: no second update of the view after every sync (#389)
    const household = today.filter((it, i) => today.findIndex((x) => x.text === it.text) === i);
    if (!sameHousehold(household, this._household)) this._household = household;
    // picture rules: the first rule whose entity is in its state puts its picture on the screen (a Pro feature)
    this.cameraScreens = 0;
    const fridges = fridgeDoors(hass, b.floors);
    for (const floor of b.floors) {
      for (const f of floor.furniture) {
        if (!f.pictures?.length || !hasScreen(f.type)) continue;
        // a fridge's screen sits on its right door: no picture while that door stands open
        if (f.type === "fridge_smart" && fridges.get(f.id)?.right) continue;
        const rule = f.pictures.find((r) => pictureRuleMatches(hass, r));
        if (!rule) continue;
        const picture = this.pictureUrl(rule.image);
        const bg: [number, number, number] = f.screen_bg === "white" ? [0.92, 0.94, 1] : [0.08, 0.08, 0.1];
        if (picture) screens.set(f.id, { color: bg, level: 1, picture, plain: true });
      }
    }
    // a module's band of light round an item, or its layers (a tank warm above, cool below): on any item, over its own glow
    for (const g of glows.values()) {
      if (g.top) screens.set(g.furnitureId, { color: g.color, level: g.level, faces: [{ part: "strata", color: g.color, top: g.top, level: g.level }] });
      else if (g.band) screens.set(g.furnitureId, { color: g.color, level: g.level, faces: [{ part: "band", color: g.color, level: g.level }] });
    }
    this.watchCameras(this.cameraScreens > 0 || !!this._through || this.cameraWall || this.projecting);
    return { markers, consumers, screens, targets };
  }

  /**
   * Household: fetch the waste calendars' pickups now and every 10 minutes while bins read a calendar; the
   * timer also lets the bins start and stop glowing at their hours (14:00 the day before, noon on the day).
   */
  private watchHousehold(hass: HomeAssistant, b: Building): void {
    const items = b.floors.flatMap((f) => f.furniture).filter((f) => f.type === "waste_bin" || f.type === "mailbox");
    const on = items.length > 0 && !this.replay;
    const calendars = on ? wasteCalendars(b.floors) : [];
    const key = calendars.join(",");
    if (!on) {
      clearInterval(this.householdTimer);
      this.householdTimer = undefined;
      this.pickupKey = "";
      return;
    }
    const fetch = async () => {
      if (calendars.length) this.pickups = await fetchPickups(this.hass ?? hass, calendars);
      this.syncDevices(true);
    };
    if (key !== this.pickupKey || !this.householdTimer) {
      this.pickupKey = key;
      clearInterval(this.householdTimer);
      this.householdTimer = setInterval(() => !document.hidden && void fetch(), 600_000);
      if (calendars.length) void fetchPickups(hass, calendars).then((p) => {
        this.pickups = p;
        this.syncDevices(true);
      });
    }
  }

  /**
   * Wall switch or socket (D523, D540, #593): every gang lights while its entity is on (a light in its own colour, a
   * socket green, brighter with what it draws); a socket's power sensors count as consumers. One pin for the frame –
   * the same entity may sit on several sockets (two sockets on one relay).
   */
  private gangItem(
    hass: HomeAssistant,
    floor: Floor,
    f: Furniture,
    consumers: Consumer[],
    screens: Map<string, ScreenState>,
    consumerSensors: Set<string>,
  ): (DeviceMarker & { fromFurniture: boolean }) | null {
    const gangs = gangsOf(f);
    const socket = f.type === "wall_socket";
    const faces: NonNullable<ScreenState["faces"]> = [];
    let on = 0;
    let used = 0;
    let watts: number | null = null;
    let reachable = false;
    gangs.forEach((g, i) => {
      const ent = g.entity && g.entity !== "none" ? g.entity : null;
      const pw = g.power && g.power !== "none" ? g.power : null;
      if (!ent && !pw) return;
      used++;
      const st = ent ? hass.states[ent] : undefined;
      const w = pw ? readPower(hass.states[pw]) : null;
      if (pw && w !== null) {
        watts = (watts ?? 0) + Math.max(0, w);
        if (!consumerSensors.has(pw)) {
          consumerSensors.add(pw);
          consumers.push({ id: ent ?? pw, powerEntity: pw, floorId: floor.id, x: f.x, z: f.z, power: Math.max(0, w), circuit: f.circuit && f.circuit !== "none" ? f.circuit : undefined });
        }
      }
      if (st && !isUnavailable(st)) reachable = true;
      const active = st ? isActive(st) : (w ?? 0) > 5;
      if (!active) return;
      on++;
      const lit = st && kindOf(st.entity_id) === "light" ? lightGlow(st) : null;
      if (!socket) {
        // a switch's rocker glows softly while what it switches is on: a light in its colour, anything else in the
        // look's accent colour
        faces.push({ part: "gang", index: i, of: gangs.length, color: lit ? lit.color : [0.22, 0.88, 1], level: 0.5, accent: !lit });
        return;
      }
      const color: [number, number, number] = lit ? lit.color : [0.35, 1, 0.55];
      faces.push({ part: "gang", index: i, of: gangs.length, color, level: w !== null ? Math.min(1, 0.55 + w / 1500) : 0.8 });
    });
    if (faces.length) screens.set(f.id, { color: faces[0].color, level: faces[0].level, faces });
    if (!used) return null;
    const ids = gangEntities(f);
    const first = ids[0] ?? null;
    const st = first ? hass.states[first] : undefined;
    const room = floor.rooms.find((r) => r.points.length >= 3 && pointInPolygon([f.x, f.z], r.points));
    const power = watts as number | null;
    // the pin stands over the plate where the 3D view draws it (on the wall face, under a low wall's top, #593)
    const at = placeWallPlate(this.floorWalls(floor), f, floor.height, mountBase(floor, f));
    return {
      id: `gangs:${f.id}`,
      floorId: floor.id,
      roomId: room?.id ?? null,
      x: at.x,
      z: at.z,
      y: f.h + 0.2 + at.y,
      icon: mdiIcon(f.icon || (socket ? "power-socket-de" : "light-switch")),
      name: f.name || (ids.length === 1 && first ? entityName(hass, first) : furnitureName(hass, f.type)),
      ownName: f.name || undefined,
      showName: !!f.show_name,
      // several gangs: how many are on (and what they draw together)
      text: used > 1 ? `${on}/${used}${power !== null ? ` · ${formatPower(hass, power)}` : ""}` : power !== null ? formatPower(hass, power) : st ? stateText(hass, st) : "",
      active: on > 0,
      unavailable: !!first && !reachable,
      glow: null,
      power: power ?? undefined,
      furnitureId: f.id,
      show: f.marker ?? undefined,
      fromFurniture: true,
    };
  }

  /**
   * Wi-Fi access point (D582): its LED ring blue while it is online, red when it is gone, and its clients on the pin
   * (which then shows by itself). Water heater: it glows warm while it heats and tells its water temperature.
   */
  private techItem(hass: HomeAssistant, floor: Floor, f: Furniture, screens: Map<string, ScreenState>, taken: Set<string>): (DeviceMarker & { fromFurniture: boolean; energyDevice?: boolean }) | null {
    const ref = (v: EntityRef | undefined) => (typeof v === "string" && v !== "none" ? v : null);
    const main = ref(f.entity);
    const st = main ? hass.states[main] : undefined;
    const room = floor.rooms.find((r) => r.points.length >= 3 && pointInPolygon([f.x, f.z], r.points));
    const base = {
      floorId: floor.id,
      roomId: room?.id ?? null,
      x: f.x,
      z: f.z,
      ownName: f.name || undefined,
      showName: !!f.show_name,
      glow: null,
      furnitureId: f.id,
      fromFurniture: true,
    };
    if (f.type === "wifi_ap") {
      const clientsId = ref(f.clients);
      const cs = clientsId ? hass.states[clientsId] : undefined;
      const n = cs && Number.isFinite(Number(cs.state)) ? Math.round(Number(cs.state)) : null;
      // without a status entity the clients sensor tells whether it is there
      const online = main ? apOnline(st) : cs ? apOnline(cs) : null;
      if (online !== null) {
        const color: [number, number, number] = online ? [0.25, 0.6, 1] : [1, 0.25, 0.2];
        screens.set(f.id, { color, level: 0.85, faces: [{ part: "apring", color, level: 0.85 }] });
      }
      const id = main ?? clientsId;
      if (!id || taken.has(id)) return null;
      taken.add(id);
      return {
        ...base,
        id,
        y: mountBase(floor, f) - (f.variant === "wall" ? -f.h - 0.2 : 0.3),
        icon: mdiIcon(f.icon || "access-point"),
        name: f.name || entityName(hass, id),
        text: online === false ? translate(hass, "ap_offline") : n !== null ? translate(hass, "ap_clients", { n }) : st ? stateText(hass, st) : "",
        active: online === true,
        unavailable: online === false,
        // gone: its pin shows by itself
        show: f.marker ?? (online === false ? "always" : undefined),
        energyDevice: n !== null,
      };
    }
    // water heater: heating by its action, a switch that is on, or the power it draws
    const kind = st ? kindOf(st.entity_id) : null;
    const pw = ref(f.power);
    const watts = pw ? readPower(hass.states[pw]) : null;
    const runW = typeof f.run_w === "number" && f.run_w > 0 ? f.run_w : 30;
    const heating = (st?.attributes.hvac_action === "heating") || (kind === "switch" && st?.state === "on") || (watts ?? 0) > runW;
    const on = heating || (!!st && !["off", "unavailable", "unknown"].includes(st.state));
    if (on) screens.set(f.id, { color: [1, 0.45, 0.15], level: heating ? 0.9 : 0.3, faces: [{ part: "band", color: [1, 0.45, 0.15], level: heating ? 0.9 : 0.3 }] });
    const tempId = ref(f.water_temp);
    const ts = tempId ? hass.states[tempId] : undefined;
    const temp = ts && Number.isFinite(Number(ts.state)) ? Number(ts.state) : typeof st?.attributes.current_temperature === "number" ? (st.attributes.current_temperature as number) : null;
    const unit = (ts?.attributes.unit_of_measurement as string | undefined) ?? "°C";
    const id = main ?? tempId ?? pw;
    if (!id || taken.has(id)) return null;
    taken.add(id);
    return {
      ...base,
      id,
      y: mountBase(floor, f) + f.h + 0.25,
      icon: mdiIcon(f.icon || "water-boiler"),
      name: f.name || (main ? entityName(hass, main) : furnitureName(hass, f.type)),
      text: temp !== null ? `${formatNumber(hass, Math.round(temp))} ${unit}${heating ? " · 🔥" : ""}` : st ? stateText(hass, st) : "",
      active: heating,
      unavailable: st ? isUnavailable(st) : false,
      power: watts ?? undefined,
      show: f.marker ?? undefined,
      // its temperature is worth a pin
      energyDevice: temp !== null,
    };
  }

  /** The walls of a floor as the 3D view builds them (kept per floor object). */
  private floorWalls(floor: Floor): Wall[] {
    let walls = this.wallCache.get(floor);
    if (!walls) {
      const s = this.building?.settings;
      walls = generateWalls(floor.rooms, { exterior: s?.wall_exterior ?? 0.24, interior: s?.wall_interior ?? 0.12 }, floor.walls ?? []).walls;
      this.wallCache.set(floor, walls);
    }
    return walls;
  }

  private wallCache = new WeakMap<Floor, Wall[]>();

  /** A wall switch's or socket's menu: one button per gang, tapped it switches that gang. */
  private renderGangMenu() {
    const m = this._gangMenu;
    const hass = this.hass;
    const f = m && this.building?.floors.flatMap((x) => x.furniture).find((x) => x.id === m.furnitureId);
    if (!m || !hass || !f) return nothing;
    const socket = f.type === "wall_socket";
    const close = () => (this._gangMenu = null);
    return html`<div class="fp3d-menu-backdrop" @click=${close}></div>
      <div class="fp3d-swipe fp3d-info fp3d-gang-menu" style="left:${m.x}px;top:${m.y}px">
        <span>${f.name || furnitureName(hass, f.type)}</span>
        ${gangsOf(f).map((g, i) => {
          const id = g.entity && g.entity !== "none" ? g.entity : null;
          const st = id ? hass.states[id] : undefined;
          const w = g.power && g.power !== "none" ? readPower(hass.states[g.power]) : null;
          const label = `${socket ? "🔌" : "▭"} ${i + 1} · ${id ? entityName(hass, id) : "–"}`;
          return html`<button class="fp3d-chip ${st && isActive(st) ? "fp3d-gang-on" : ""}" ?disabled=${!id || (st ? isUnavailable(st) : true)}
            @click=${async () => {
              if (!id || !(await this.confirmFor(id))) return;
              void toggleEntity(hass, id);
            }}>${label}${st ? html` <small>${stateText(hass, st)}${w !== null ? ` · ${formatPower(hass, Math.max(0, w))}` : ""}</small>` : nothing}</button>`;
        })}
      </div>`;
  }

  /** Household: how a bin or a mailbox shows now – its glow and its pin (with the days to the pickup, "post"). */
  private householdState(hass: HomeAssistant, floor: Floor, f: Furniture): { screen?: ScreenState; marker?: DeviceMarker & { fromFurniture: boolean }; item?: HouseholdItem } | null {
    const rgb = (hex: string): [number, number, number] => {
      const n = parseInt(hex.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    };
    if (f.type === "waste_bin") {
      const src = typeof f.bin_source === "string" && f.bin_source !== "none" ? f.bin_source : null;
      const due = src ? binDue(f, hass, this.pickups, new Date(), { from: this.building?.settings.household?.bin_from, until: this.building?.settings.household?.bin_until }) : null;
      // a bin marked out stands at its kerb spot (#142); not while furnishing, where it is moved by hand
      const place = this.furnish ? null : binPlace(f, !!due?.glow, binOut(f, hass));
      if (place?.kerb) this.binSpots.set(f.id, place.at);
      const [bx, bz] = place?.at ?? [f.x, f.z];
      if (!due || !src) return null;
      const text = due.days === 0 ? translate(hass, "bin_today") : due.days === 1 ? translate(hass, "bin_tomorrow") : translate(hass, "bin_in_days", { n: due.days });
      // the lid's colour at full strength in its own hue (the paper bin glows blue, the bio bin amber); a grey or
      // black lid glows white
      const lid = rgb(binColors(f)[1]);
      const top = Math.max(...lid);
      const grey = top - Math.min(...lid) < 0.12;
      const col = (grey ? [0.92, 0.95, 1] : lid.map((v) => Math.min(1, (v / Math.max(0.001, top)) * 1.05))) as [number, number, number];
      const label = f.name || translate(hass, `bin_kind_${f.bin_kind ?? "rest"}` as Parameters<typeof translate>[1]);
      // a tag on the bin in its colour: when it goes out ("Tomorrow", "in 3 days"); today and tomorrow stand out.
      // A bin that is out already (its own switch) is done: "put out ✓", no longer glowing
      const out = binOut(f, hass);
      const hex = `#${col.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
      const when = out ? translate(hass, "bin_out_done") : text;
      this.binHolos.push({ id: f.id, floorId: floor.id, x: bx, z: bz, y: mountBase(floor, f) + f.h, r: Math.max(f.w, f.d) / 2, name: label, color: hex, when, soon: due.days <= 1 && !out, days: due.days, out });
      // due and still in: a dashed line on the ground to its kerb spot ("take me out")
      if (place?.cue) this.binCues.push({ floorId: floor.id, from: [f.x, f.z], to: place.cue, skip: Math.max(f.w, f.d) / 2 + 0.1, color: hex });
      return { item: due.days <= 1 ? { icon: out ? "check-circle-outline" : "trash-can-outline", text: `${label}: ${when}`, entity: src, hot: due.glow && !out } : undefined };
    }
    if (f.type !== "mailbox") {
      // a plant: thirsty – an orange band and a small hologram asking for water
      const thirsty = plantThirsty(f, hass);
      const orange: [number, number, number] = [1, 0.55, 0.12];
      const name = f.name || furnitureName(hass, f.type);
      if (!thirsty) return null;
      this.binHolos.push({ id: f.id, floorId: floor.id, x: f.x, z: f.z, y: mountBase(floor, f) + f.h, r: Math.max(f.w, f.d) / 2, name, color: "#ff8c1f", when: translate(hass, "hh_thirsty"), soon: true, days: -1, icon: "plant" });
      return {
        screen: { color: orange, level: 0.9, faces: [{ part: "band", color: orange, level: 0.9 }] },
        item: { icon: "watering-can-outline", text: translate(hass, "hh_plant", { name }), entity: (f.moisture as string) ?? null, hot: true },
      };
    }
    const flag = typeof f.entity === "string" && f.entity !== "none" ? f.entity : null;
    if (!flag) return null;
    const post = mailboxPost(f, hass);
    const amber: [number, number, number] = [1, 0.62, 0.15];
    // post: the box glows and a small hologram says so
    if (post) this.binHolos.push({ id: f.id, floorId: floor.id, x: f.x, z: f.z, y: mountBase(floor, f) + f.h, r: Math.max(f.w, f.d) / 2, name: f.name || furnitureName(hass, f.type), color: "#ffb547", when: translate(hass, "mailbox_post"), soon: true, days: -1, icon: "mail" });
    return {
      screen: post ? { color: amber, level: 1, faces: [{ part: "top", color: amber, level: 1 }, { part: "band", color: amber, level: 0.8 }] } : undefined,
      item: post ? { icon: "email-alert-outline", text: f.name ? `${f.name}: ${translate(hass, "mailbox_post")}` : translate(hass, "mailbox_post"), entity: flag, hot: true } : undefined,
    };
  }

  /** Time travel: each running robot's way through the rooms it cleaned so far (their centres, in order). */
  private robotPaths(hass: HomeAssistant, b: Building): { floorId: string; points: [number, number][] }[] {
    const r = this.replay;
    if (!r) return [];
    const out: { floorId: string; points: [number, number][] }[] = [];
    for (const floor of b.floors) {
      const rooms = floor.rooms.filter((room) => room.points.length >= 3);
      for (const f of floor.furniture) {
        if (!isRobotVacuum(f.type)) continue;
        const entity = this.furnitureLinks?.get(f.id)?.entity ?? null;
        if (!entity) continue;
        const names = r.robotRooms(entity, robotRoomSensor(hass, entity, f.room_sensor));
        const points: [number, number][] = [];
        for (const name of names) {
          const room = roomNamed(hass, rooms, name);
          const c = room ? (centroid(room.points) as [number, number]) : null;
          const last = points[points.length - 1];
          if (c && (!last || last[0] !== c[0] || last[1] !== c[1])) points.push([c[0], c[1]]);
        }
        if (points.length) out.push({ floorId: floor.id, points });
      }
    }
    return out;
  }

  /** The trail's spots right now: history rows plus the sensors that are on. */
  private trailNow(hass: HomeAssistant, b: Building) {
    const now = this.now();
    const sources = trailSources(hass, b);
    // time travel: the rows come from the replayed history, up to the replayed moment
    const rows = this.replay ? this.replay.rows(sources.map((s) => s.entity), now - TRAIL_WINDOW_MS, now) : this.trailRows;
    const live = sources.map((s) => {
      const st = hass.states[s.entity];
      return { entity: s.entity, state: st?.state, lastChanged: st?.last_changed ? Date.parse(st.last_changed) : undefined };
    });
    return trailPoints(sources, trailEvents(rows, live, now), now);
  }

  /** While the trail is shown, the sensors' history of the last half hour is fetched, again every minute. */
  private watchTrail(): void {
    clearInterval(this.trailTimer);
    this.trailTimer = undefined;
    // time travel brings its own rows (see trailNow)
    if (!this.trail || this.replay) {
      this.trailRows = {};
      this.syncDevices(true);
      return;
    }
    const fetch = async () => {
      const hass = this.hass;
      const b = this.building;
      if (!hass || !b || document.hidden) return;
      const ids = trailSources(hass, b).map((s) => s.entity);
      if (!ids.length) return;
      try {
        const rows = await hass.callWS<Record<string, HistoryRow[]> | null>({
          type: "history/history_during_period",
          start_time: new Date(Date.now() - TRAIL_WINDOW_MS).toISOString(),
          entity_ids: ids,
          minimal_response: true,
          no_attributes: true,
          significant_changes_only: false,
        });
        this.trailRows = rows ?? {};
      } catch {
        this.trailRows = {};
      }
      this.syncDevices(true);
    };
    void fetch();
    this.trailTimer = setInterval(() => void fetch(), 60000);
  }

  /** While a screen shows a camera, its snapshot is fetched again every few seconds (slower on the tablet level). */
  /** Lab prototype: cameras placed in the plan whose current picture is cast onto it. */
  private projecting = false;

  private projectedCameras(hass: HomeAssistant, b: Building): { id: string; url: string }[] {
    const out: { id: string; url: string }[] = [];
    // the camera projection is a parked prototype: its own switch ("?fp3d_projection=1"), not the lab's
    if (projectionOn()) {
      const ids = new Set(b.floors.flatMap((f) => f.placements.map((p) => p.entity_id)).filter((id) => kindOf(id) === "camera"));
      for (const id of ids) {
        const st = hass.states[id];
        const picture = st?.attributes.entity_picture as string | undefined;
        if (!picture || isUnavailable(st)) continue;
        out.push({ id, url: picture.startsWith("data:") ? picture : `${picture}${picture.includes("?") ? "&" : "?"}fp3d=${this.cameraTick}` });
      }
    }
    this.projecting = out.length > 0;
    return out;
  }

  private watchCameras(on: boolean): void {
    if (on && !this.cameraTimer) {
      this.cameraTimer = setInterval(() => {
        if (document.hidden) return;
        this.cameraTick++;
        this.syncDevices(true);
        if (this._through || this.cameraWall) this.requestUpdate();
      }, this._low ? 10000 : 5000);
    } else if (!on && this.cameraTimer) {
      clearInterval(this.cameraTimer);
      this.cameraTimer = undefined;
    }
  }

  /** A picture rule's image as a URL: http(s) as is, a camera's current snapshot, a stored image as a data URL (fetched once). */
  private pictureUrl(image: string): string | null {
    if (/^https?:\/\//.test(image)) return image;
    if (image.startsWith("camera:")) {
      const st = this.hass.states[image.slice(7)];
      const picture = st?.attributes.entity_picture as string | undefined;
      if (!picture || isUnavailable(st)) return null;
      this.cameraScreens++;
      return picture.startsWith("data:") ? picture : `${picture}${picture.includes("?") ? "&" : "?"}fp3d=${this.cameraTick}`;
    }
    const cached = this.pictureUrls.get(image);
    if (!cached.fetch) return cached.url;
    this.pictureUrls.set(image, null);
    const home = this.home;
    fetchImage(this.hass, image, home).then(
      (url) => {
        // the home changed meanwhile: this picture is not of the home shown any more
        if (home !== this.home) return;
        this.pictureUrls.set(image, url);
        this.syncDevices(true);
      },
      () => undefined,
    );
    return null;
  }

  /**
   * Furniture a robot vacuum drives around: what stands on the floor of the room (cabinets, sofas,
   * beds, appliances). It drives under tables, desks, chairs and stools, over rugs and under anything
   * hung on the wall.
   */
  private robotObstacles(floor: Building["floors"][number], room: [number, number][]): [number, number][][] {
    const OPEN_BELOW = new Set(["rug", "worktop", "table", "table_round", "coffee_table", "chair", "office_chair", "stool", "bar_stool", "bench", "desk", "robot_vacuum", "parking", "stairwell", "radiator", "ac_unit", "tv_wall", "kitchen_wall", "led_strip"]);
    return floor.furniture
      .filter((m) => {
        if (OPEN_BELOW.has(m.type) || (m.type.startsWith("lamp_") && m.type !== "lamp_floor" && m.type !== "lamp_uplight")) return false;
        if (m.h < 0.04 || mountBase(floor, m) > 0.12) return false;
        const item = packItem(m.type);
        if (item && (item.hole || /table|desk|chair|stool|bench|rug|carpet|mat$/.test(m.type))) return false;
        return pointInPolygon([m.x, m.z], room) || furnitureFootprint(m).some((p) => pointInPolygon(p, room));
      })
      .map((m) => furnitureFootprint(m));
  }

  /** Robot vacuums (docks with a vacuum entity): where they rest and what they do. */
  private robotInfos(hass: HomeAssistant, b: Building): RobotInfo[] {
    const out: RobotInfo[] = [];
    for (const floor of b.floors) {
      for (const f of floor.furniture) {
        if (!isRobotVacuum(f.type)) continue;
        const entity = this.furnitureLinks.get(f.id)?.entity ?? null;
        const state = entity ? hass.states[entity]?.state : undefined;
        const mode: RobotInfo["mode"] =
          vacuumCleaning(state) ? "cleaning" : state === "returning" ? "returning" : state === "error" ? "error" : state === "docked" || !state ? "docked" : "idle";
        // the robot rests in front of its dock, facing away from it
        const a = (f.rotation * Math.PI) / 180;
        // a pack's dock: its own robot (taken out of the dock's model) rests where the model has it and drives (#645)
        const pack = isPackType(f.type);
        const off = f.d * (pack ? packRobotCentre(packItem(f.type)) : 0.14);
        const rest: [number, number] = [f.x - Math.sin(a) * off, f.z + Math.cos(a) * off];
        // the room the robot reports (a "current room" sensor), else the room of its dock
        const rooms = floor.rooms.filter((r) => r.points.length >= 3);
        const reported = mode === "cleaning" ? robotRoom(hass, rooms, entity, robotRoomSensor(hass, entity, f.room_sensor)) : null;
        const room = reported ?? rooms.find((r) => pointInPolygon(rest, r.points));
        const obstacles = mode === "cleaning" && room ? this.robotObstacles(floor, room.points) : [];
        out.push({ id: f.id, floorId: floor.id, rest, restHeading: -a, mode, room: room?.points ?? null, roomId: room?.id ?? null, obstacles, ...(pack ? { model: { type: f.type, w: f.w, d: f.d, h: f.h } } : {}) });
      }
    }
    return out;
  }

  /** Home battery: "64 % · ▲ 1,5 kW" (▲ charging, ▼ discharging; its power sensor counts discharging positive). */
  private batteryText(hass: HomeAssistant, soc: string | null, power: number | null, systemSoc: number | null = null): string {
    const v = soc ? Number(hass.states[soc]?.state) : Number.NaN;
    const parts: string[] = [];
    if (Number.isFinite(v)) parts.push(`${formatNumber(hass, v, 0)} %`);
    // no sensor of its own: the inverter's system average, labelled as such (#282)
    else if (systemSoc !== null) parts.push(`${formatNumber(hass, systemSoc, 0)} % ${translate(hass, "battery_system_avg")}`);
    if (power !== null && Math.abs(power) >= 10) parts.push(`${power < 0 ? "▲" : "▼"} ${formatPower(hass, Math.abs(power))}`);
    return parts.join(" · ");
  }

  /** Wallbox: "charging · 11 kW", "plugged in" or its power, from a status sensor (on/off or a state such as charging). */
  /** The meter: what the house draws from the grid, or feeds into it. */
  private meterText(hass: HomeAssistant, power: number | null): string {
    if (power === null) return "";
    if (Math.abs(power) < 5) return formatPower(hass, 0);
    return `${translate(hass, power < 0 ? "energy_grid_export" : "energy_grid_import")} ${formatPower(hass, Math.abs(power))}`;
  }

  private wallboxText(hass: HomeAssistant, status: string | null, power: number | null): string {
    const st = status ? hass.states[status] : undefined;
    const raw = String(st?.state ?? "").toLowerCase();
    const charging = (power ?? 0) > 50 || /charg/.test(raw);
    const plugged = st?.entity_id.startsWith("binary_sensor.") ? raw === "on" : /connect|plug|ready|wait|paused|suspend/.test(raw);
    const label = charging ? translate(hass, "wallbox_charging") : plugged ? translate(hass, "wallbox_plugged") : st && !isUnavailable(st) && !st.entity_id.startsWith("binary_sensor.") ? stateText(hass, st) : "";
    const watts = power !== null && power > 50 ? formatPower(hass, power) : "";
    return [label, watts].filter(Boolean).join(" · ");
  }

  /** The glowing faces of an item with a state entity (none while nothing is on). */
  private stateFaces(hass: HomeAssistant, f: Furniture): NonNullable<ScreenState["faces"]> {
    const out: NonNullable<ScreenState["faces"]> = [];
    // the second state only counts beside a first one: the editor hides it once the first is "none" (#645)
    const refs: [EntityRef | undefined, "all" | "left" | "right" | "top" | "bottom"][] = f.state_entity && f.state_entity !== "none" && f.state_entity2 && f.state_entity2 !== "none"
      ? [
          [f.state_entity, f.state_split === "top_bottom" ? "bottom" : "left"],
          [f.state_entity2, f.state_split === "top_bottom" ? "top" : "right"],
        ]
      : [[f.state_entity, "all"]];
    for (const [ref, part] of refs) {
      if (!ref || ref === "none") continue;
      const st = hass.states[ref];
      if (!st || isUnavailable(st)) continue;
      const on = isActive(st) || st.state === "home" || st.state === "occupied" || st.state === "on";
      if (!on) continue;
      const lit = kindOf(ref) === "light" ? lightGlow(st) : null;
      out.push({ part, color: lit ? lit.color : [1, 0.71, 0.28], level: lit ? lit.level : 0.85 });
    }
    return out;
  }

  /** Cars: the pin text of a parking spot – charge, range, charging power, lock; "away · zone" when the car is out. */
  private carText(hass: HomeAssistant, car: CarState, absent: boolean): string {
    const t = (k: Parameters<typeof translate>[1]) => translate(hass, k);
    if (absent || car.away !== null) {
      const where = car.away ? ` · ${car.away}` : "";
      return `${t("car_away")}${where}`;
    }
    const parts: string[] = [];
    if (car.soc !== null) parts.push(`${formatNumber(hass, car.soc, 0)} %`);
    if (car.range !== null) parts.push(`${formatNumber(hass, car.range, 0)} ${car.rangeUnit}`);
    if (car.charging) parts.push(car.chargingW !== null ? `⚡ ${formatPower(hass, car.chargingW)}` : `⚡ ${t("car_charging_short")}`);
    else if (car.plugged) parts.push(`🔌`);
    if (car.locked !== null) parts.push(car.locked ? "🔒" : "🔓");
    return parts.join(" · ");
  }

  /** The ceiling height on a floor at a point: the floor height, a room's own ceiling (#30), or lower under a roof slope (#168). */
  private ceilingAt(floor: Building["floors"][number], x: number, z: number): number {
    // a room with a ceiling of its own (#30)
    const own = floor.rooms.find((r) => r.ceiling_height && r.points.length >= 3 && pointInPolygon([x, z], r.points))?.ceiling_height;
    // a room may reach above the floor's height (a vaulted living room open to the roof, #379)
    const room = own || floor.height;
    const b = this.building;
    if (!b || !activeSections(b).some((sec) => sectionCutsBelow(sec, floor.elevation + room) && sectionAbove(sec, floor.elevation))) return room;
    const under = roofUnderAt(b, x, z, floor.elevation);
    return under === null ? room : Math.max(0.5, Math.min(room, under - floor.elevation));
  }

  /** A lamp: its 3D model glows with the linked light and is tapped directly. */
  private lampMarker(hass: HomeAssistant, floor: Building["floors"][number], f: Furniture, entity: string | null): DeviceMarker & { fromFurniture: boolean } {
    const st = entity ? hass.states[entity] : undefined;
    const item = packItem(f.type);
    const model = LAMP_MODEL[f.type] ?? item?.light ?? "floor";
    // a height above the floor set by hand wins (a table lamp on a shelf, a floor lamp on a platform);
    // an LED strip outside the house counts from the ground there (a path light flush with the lawn)
    const inRoom = !!roomHolding(floor, f.x, f.z);
    const base0 = model === "strip" && !inRoom
      ? outdoorGround(floor, f.x, f.z) + (f.mount_y ?? 0)
      : f.mount_y != null && !item
      ? f.mount_y
      : item || model === "wall" || model === "strip"
      ? mountBase(floor, f)
      : model === "table"
        ? surfaceHeight(floor, f.x, f.z, f.h)
        : model === "bollard" || model === "garden"
          ? outdoorGround(floor, f.x, f.z)
          : 0;
    const room = floor.rooms.find((r) => r.points.length >= 3 && pointInPolygon([f.x, f.z], r.points));
    // under a sloped roof the ceiling is the roof's underside: lamps hung from it follow the slope (#168)
    const ceiling = this.ceilingAt(floor, f.x, f.z);
    const hung = (item ? item.mount === "ceiling" : ["ceiling", "downlight", "spot", "panel", "pendant", "fan"].includes(model)) && f.mount_y == null;
    const slopeDrop = hung ? floor.height - ceiling : 0;
    const base = item && hung ? Math.max(0, base0 - slopeDrop) : base0;
    // a spot lowered by hand hangs from its own "ceiling" (under a wall cabinet, #311)
    const top = LIFT_SPOTS.has(f.type) && f.mount_y != null ? Math.min(floor.height, f.mount_y + spotDepth(f.type, f.h)) : Math.abs(slopeDrop) > 0.01 ? ceiling : undefined;
    const H = top ?? floor.height;
    // pack lamps: the marker sits above the lamp (below it when it hangs from the ceiling)
    const y = item
      ? item.mount === "ceiling"
        ? Math.max(0.5, base - 0.15)
        : base + f.h + 0.2
      : {
      ceiling: H - 0.3,
      downlight: H - 0.25,
      spot: H - 0.35,
      panel: H - 0.25,
      pendant: Math.max(0.6, H - f.h - 0.25),
      fan: Math.max(0.6, H - f.h - 0.25),
      floor: base + f.h + 0.25,
      uplight: base + f.h + 0.25,
      table: base + f.h + 0.2,
      wall: base + f.h + 0.2,
      strip: f.upright ? base + f.w + 0.15 : Math.max(0.3, base - 0.2),
      bollard: base + f.h + 0.25,
      garden: base + f.h + 0.25,
    }[model];
    return {
      // a lamp without a light keeps a key of its own (it is drawn, but not tappable)
      id: entity ?? `lamp:${f.id}`,
      floorId: floor.id,
      roomId: room?.id ?? null,
      x: f.x,
      z: f.z,
      y,
      icon: iconSvg("light"),
      name: f.name || (entity ? entityName(hass, entity) : furnitureName(hass, f.type)),
      text: st ? stateText(hass, st) : "",
      active: st ? isActive(st) : false,
      unavailable: st ? isUnavailable(st) : false,
      glow: st ? scaleGlow(onlyColor(lightGlow(st, f.color_entity && f.color_entity !== "none" ? hass.states[f.color_entity] : undefined), f.only_color), f.glow_scale) : null,
      lamp: model,
      rotation: f.rotation,
      mirror: !!f.mirror,
      colors: f.colors,
      materials: f.materials,
      roll: f.tilt ?? 0,
      upright: !!f.upright,
      rise: f.rise ?? 0,
      // a ceiling fan's blades turn with its fan entity (D606)
      fanSpeed: model === "fan" ? fanSpeed(f.fan && f.fan !== "none" ? hass.states[f.fan] : undefined) : undefined,
      size: [f.w, f.d, f.h],
      base,
      top,
      pickable: !!entity,
      furnitureId: f.id,
      pack: item ? f.type : null,
      lightY: item ? (item.mount === "ceiling" ? base : base + f.h * 0.85) : undefined,
      // a running colour effect – not a "mode" some integrations report as their effect (LocalTuya: "white",
      // "colour"; others "manual", "default", an empty one)
      effect: !!st && st.state === "on" && typeof st.attributes.effect === "string" && !/^(none|off|solid|static|normal|white|colou?r|rgb|manual|default|-|)$/i.test(st.attributes.effect.trim()),
      variant: f.variant,
      show: f.marker ?? undefined,
      fromFurniture: true,
    };
  }

  /**
   * Marker rule: "important" leaves out devices that their 3D object stands for (lamps, a TV that is
   * off) and keeps devices without an object (sensors, heating, switches) and values (watts, the app).
   */
  /** Whether a symbol stands in the room (or outdoor area) open now: by its room, else by where it stands. */
  private inOpenRoom(m: DeviceMarker): boolean {
    if (!this.roomId) return false;
    if (m.roomId) return m.roomId === this.roomId;
    const floor = this.building?.floors.find((f) => f.id === m.floorId);
    const zone = floor ? zonesOf(floor).find((r) => r.id === this.roomId) : undefined;
    return !!zone && pointInPolygon([m.x, m.z], zone.points);
  }

  private showPin(m: DeviceMarker & { fromFurniture?: boolean; energyDevice?: boolean }): boolean {
    // while furnishing every placed device has a pin to grab it by
    if (this.furnish && !m.fromFurniture) return true;
    // the device's own setting wins over the marker mode (except "none", which hides every marker)
    if (m.show === "never" || this.markerMode === "none") return false;
    if (m.show === "always" || this.markerMode === "all") return true;
    // only in rooms: none in the house and floor views, in an open room every symbol of that room (D477)
    if (this.markerMode === "room") return this.inOpenRoom(m);
    if (m.lamp || m.model) return false;
    const kind = kindOf(m.id);
    if (kind === "light") return false;
    if (m.fromFurniture) return (m.power ?? 0) >= 1 || (kind === "media" && m.active) || (!!m.energyDevice && !!m.text);
    return true;
  }

  /** Tapping a window opens its blind (or contact); a door or garage door its cover or contact. */
  private openingTargets(): Map<string, string> {
    const out = new Map<string, string>();
    for (const [id, e] of this.openingLinks ?? []) {
      // a door with a smart lock (and no drive) offers to lock or unlock it (#682); a garage door driven by a pulse
      // switch or button presses it (#677): both go through the opening itself
      if ((e.lock && !e.cover) || isPulseDrive(e.cover)) {
        out.set(id, `opening:${id}`);
        continue;
      }
      const target = e.cover ?? e.contact ?? e.tilt;
      if (target) out.set(id, target);
    }
    return out;
  }

  /** Pictures of the floors, drawn a moment after the plan or the look changed (once, not per frame). */
  private scheduleThumbs(delay = 600): void {
    clearTimeout(this.thumbTimer);
    const floors = this.building?.floors.filter((f) => f.rooms.length).length ?? 0;
    if (!this.floorThumbs || floors < 2) {
      // already empty: no new array, no second update after every sync (#389)
      if (this._thumbs.length) this._thumbs = [];
      return;
    }
    // at most every few seconds, however often lamps change (the tablet level waits longer)
    const wait = Math.max(delay, this.thumbsAt + (this._low ? 8000 : 4000) - Date.now());
    const draw = () => {
      // at night (kiosk) the pictures are drawn once and then rest
      if (!this.viewer || (this.dimmed && this._thumbs.length)) return;
      // a hidden tab draws nothing; the pictures follow once it shows again
      if (document.hidden) {
        this.scheduleThumbs(3000);
        return;
      }
      // a new look still compiling, a new home still coming in: the pictures follow right after (#131)
      if (this.viewer.busy()) {
        this.thumbTimer = setTimeout(draw, 300);
        return;
      }
      this.thumbsAt = Date.now();
      this._thumbs = this.viewer.floorThumbnails(this.narrowThumbs ? 104 : 150, this.narrowThumbs ? 78 : 112);
    };
    this.thumbTimer = setTimeout(draw, wait);
  }

  private get narrowThumbs(): boolean {
    return this._narrowStage;
  }

  private renderThumbs() {
    if (!this._thumbs.length || !this.building) return nothing;
    const names = new Map(this.building.floors.map((f) => [f.id, f.name]));
    // the highest floor on top
    const order = [...this._thumbs].sort(
      (a, b) => (this.building!.floors.find((f) => f.id === b.floorId)?.elevation ?? 0) - (this.building!.floors.find((f) => f.id === a.floorId)?.elevation ?? 0),
    );
    const compact = this._thumbsCompact;
    const fold = () => {
      this._thumbsCompact = !compact;
      this.thumbsSaved = this._thumbsCompact ? "1" : "0";
      try {
        localStorage.setItem("home3d.thumbs_compact", this.thumbsSaved);
      } catch {
        // private mode: the choice lasts for this page only
      }
    };
    return html`<nav class="fp3d-thumbs ${this.narrowThumbs ? "fp3d-thumbs-small" : ""} ${compact ? "fp3d-thumbs-compact" : ""}" aria-label=${translate(this.hass, "floors")}>
      <button class="fp3d-thumbs-fold" title=${translate(this.hass, compact ? "thumbs_show" : "thumbs_fold")} aria-label=${translate(this.hass, compact ? "thumbs_show" : "thumbs_fold")} @click=${fold}>${compact ? "▸" : "◂"}</button>
      <button class="fp3d-thumb fp3d-thumb-house" aria-pressed=${this.floorId === null} @click=${() => this.fire("floor-tap", { floorId: null })}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 11l9-7 9 7M5 10v10h14V10" /></svg>
        <span>${translate(this.hass, "all_floors")}</span>
      </button>
      ${order.map(
        (t) => html`<button class="fp3d-thumb" aria-pressed=${this.floorId === t.floorId} @click=${() => this.fire("floor-tap", { floorId: t.floorId })}>
          ${compact ? nothing : html`<img src=${t.url} alt="" />`}
          <span>${names.get(t.floorId) ?? ""}</span>
        </button>`,
      )}
    </nav>`;
  }

  /** Long press: Home Assistant's more-info of the device, like other HA cards (#82); an own hold action wins. */
  private onDeviceHold(entityId: string, x: number, y: number): void {
    const own = this.ro ? null : gestureAction(this.actionOwners.get(entityId), "hold");
    if (own) return this.runOwnAction(own, this.actionOwners.get(entityId)!, x, y);
    if (entityId.startsWith("item:")) return;
    if (entityId.startsWith("opening:")) return this.onOpeningTap(entityId.slice(8), x, y, true);
    // a wall switch or socket: the quick menu of its one entity, else the frame's menu
    if (entityId.startsWith("gangs:")) {
      const f = this.building?.floors.flatMap((m) => m.furniture).find((m) => m.id === entityId.slice(6));
      const ids = f ? gangEntities(f) : [];
      if (ids.length === 1) this.onDeviceHold(ids[0], x, y);
      else this.onDeviceTap(entityId, x, y);
      return;
    }
    if (this.ro) {
      this.onDeviceTap(entityId, x, y);
      return;
    }
    // Cars: a long press on the parking spot's pin opens the car's menu (lock, climate, charging)
    if (this.hass && this.building) {
      for (const floor of this.building.floors)
        for (const f of floor.furniture) {
          if (f.type !== "parking" || !f.car) continue;
          const car = carState(this.hass, f);
          const ids = [f.entity, f.car.device, ...Object.values(car.entities)].filter((v): v is string => !!v && v !== "none");
          if (ids.includes(entityId)) {
            this._menu = { entity: entityId, x, y, car };
            return;
          }
        }
    }
    // a light opens its card (#272: brightness, colour temperature, colour; "More" leads to the details); every other
    // device opens its more-info (a switch, a lock too: their quick menu stays on the tap where a tap opens it, a
    // cover's); pins without one entity behind them do what a tap does
    if (popupKind(entityId) === "light" && this.hass?.states[entityId]) return this.openPopup(entityId, x, y);
    const target = holdTarget(entityId);
    if (target) openMoreInfo(this, target);
    else this.onDeviceTap(entityId, x, y);
  }

  /** Swipe up or down on a lamp (brightness) or a blind (position). */
  private onDeviceSwipe(entityId: string, phase: "start" | "move" | "end", dy: number, x: number, y: number): boolean {
    const st = this.hass?.states[entityId];
    if (this.ro) return false;
    if (phase === "start") {
      // a device of another room is not swiped either (#454): a tap opens its room
      if (this.elsewhere(entityId)) return false;
      // devices that ask before switching are not moved by a swipe (it turns the view instead)
      if (!st || isUnavailable(st) || this.confirmSet.has(entityId)) return false;
      const kind = kindOf(entityId);
      if (kind === "light" && lightAbilities(st).dim) {
        const pct = st.state === "on" ? (typeof st.attributes.brightness === "number" ? Math.round((st.attributes.brightness as number) / 2.55) : 100) : 0;
        this._swipe = { entity: entityId, kind: "light", start: pct, value: pct, x, y };
        return true;
      }
      if (kind === "cover" && coverPositionable(st)) {
        const pos = st.attributes.current_position as number;
        this._swipe = { entity: entityId, kind: "cover", start: pos, value: pos, x, y };
        return true;
      }
      return false;
    }
    const s = this._swipe;
    if (!s || s.entity !== entityId) return false;
    if (phase === "move") {
      // the whole range over about 220 pixels; up = brighter / blind up
      const value = Math.round(Math.min(100, Math.max(0, s.start - (dy / 220) * 100)));
      if (value !== s.value) this._swipe = { ...s, value };
      // at most a few calls per second while the finger moves
      const now = performance.now();
      if (now - this.swipeSent > 350) {
        this.swipeSent = now;
        this.applySwipe();
      }
    } else {
      this.applySwipe();
      clearTimeout(this.swipeTimer);
      this.swipeTimer = setTimeout(() => (this._swipe = null), 700);
    }
    return true;
  }

  private applySwipe(): void {
    const s = this._swipe;
    if (!s || !this.hass) return;
    if (s.kind === "light") {
      if (s.value <= 0) safeCall(this.hass, "light", "turn_off", { entity_id: s.entity });
      else safeCall(this.hass, "light", "turn_on", { entity_id: s.entity, brightness_pct: s.value });
    } else safeCall(this.hass, "cover", "set_cover_position", { entity_id: s.entity, position: s.value });
  }

  /** Fly to a search result: rooms are selected, devices shown on their floor and flashing. */
  goTo(item: SearchItem): void {
    this._find = null;
    if (item.kind === "room") {
      this.fire("room-tap", { floorId: item.floorId, roomId: item.roomId });
      return;
    }
    if (this.floorId !== item.floorId) this.fire("floor-tap", { floorId: item.floorId });
    // after the host has switched the floor (its own camera flight starts first)
    setTimeout(() => this.viewer?.focus(item.floorId, item.x, item.z, item.y, item.entity), 120);
  }

  /** Household: the bin tapped – its kind and its next pickups ("Tomorrow", "Thu 23.10."). */
  private renderBinInfo() {
    const i = this._binInfo;
    const hass = this.hass;
    const f = i && this.building?.floors.flatMap((x) => x.furniture).find((m) => m.id === i.furnitureId);
    if (!i || !hass || !f) return nothing;
    const next = binNext(f, hass, this.pickups);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const when = (d: Date) => {
      const days = Math.round((d.getTime() - today.getTime()) / 86400_000);
      return days === 0 ? translate(hass, "bin_today") : days === 1 ? translate(hass, "bin_tomorrow") : d.toLocaleDateString(hass.language || undefined, { weekday: "short", day: "numeric", month: "numeric" });
    };
    const label = f.name || translate(hass, `bin_kind_${f.bin_kind ?? "rest"}` as Parameters<typeof translate>[1]);
    // "put out": a tap switches the bin's own helper (a nightly automation switches it back)
    const out = binOut(f, hass);
    const toggle = (e: Event) => {
      e.stopPropagation();
      if (typeof f.bin_out === "string") void toggleEntity(hass, f.bin_out);
      clearTimeout(this.binInfoTimer);
      this.binInfoTimer = setTimeout(() => (this._binInfo = null), 6000);
    };
    return html`<div class="fp3d-swipe fp3d-info fp3d-bin-info" style="left:${i.x}px;top:${i.y}px" @click=${() => (this._binInfo = null)}>
      <span>🗑 ${label}</span>
      ${next.length
        ? next.map((p) => html`<b>${when(p.day)}${p.summary && p.summary !== label ? html` <small>· ${p.summary}</small>` : nothing}</b>`)
        : html`<b>${translate(hass, "bin_none")}</b>`}
      ${binOutToggleable(f) && !this.ro
        ? html`<button class="fp3d-bin-out ${out ? "fp3d-bin-out-on" : ""}" aria-pressed=${out} @click=${toggle}>${out ? translate(hass, "bin_out_done") : translate(hass, "bin_out_mark")}</button>`
        : out
          ? html`<small>${translate(hass, "bin_out_done")}</small>`
          : nothing}
    </div>`;
  }

  /** Household: the glass card "Today in the household" – what is due, tapped it opens the entity. */
  private renderHousehold() {
    if (!this._household.length || !this.householdCard || this.panelOpen) return nothing;
    const fold = () => {
      this._hhFolded = !this._hhFolded;
      writeFlag("home3d.hhFolded", this._hhFolded);
    };
    return html`<div class="fp3d-hh ${this._hhFolded ? "fp3d-hh-folded" : ""}">
      <button class="fp3d-hh-head" aria-expanded=${!this._hhFolded} @click=${fold}>🏠 ${translate(this.hass, "hh_title")} <b>${this._household.length}</b></button>
      ${this._hhFolded
        ? nothing
        : this._household.map(
            (it) => html`<button class="fp3d-hh-row ${it.hot ? "fp3d-hh-hot" : ""}" ?disabled=${!it.entity} @click=${() => it.entity && (this.ro ? this.showInfo(it.entity, 0, 0) : openMoreInfo(this, it.entity))}>
              <span class="fp3d-hh-icon"><ha-icon icon=${`mdi:${it.icon}`} style="--mdc-icon-size:18px"></ha-icon></span><span>${it.text}</span>
            </button>`,
          )}
    </div>`;
  }

  /** Date and time in a corner (D631), kept current every half minute while shown. */
  /** The scene for the last list built: when none of these changed the list is the same (#195). */
  private sceneList: { states: unknown; building: unknown; floorId: string | null; alerts: unknown; list: FloorSummary[] } | null = null;
  private sceneLabel = "";

  /**
   * The rooms as text (#195): per floor the room, its lights, temperature and warnings, hidden until it takes the focus.
   * A button there opens the room like a tap on it. The canvas and the plan point at it in their label.
   */
  private renderRoomList() {
    const hass = this.hass;
    const b = this.building;
    if (!hass || !b || this._walk) return nothing;
    const c = this.sceneList;
    if (!c || c.states !== hass.states || c.building !== b || c.floorId !== this.floorId || c.alerts !== this._alerts) {
      this.sceneList = { states: hass.states, building: b, floorId: this.floorId, alerts: this._alerts, list: sceneSummary(hass, b, this._alerts, this.floorId) };
    }
    const floors = this.sceneList!.list;
    if (!floors.length) return nothing;
    return html`<nav class="fp3d-sr-rooms" aria-label=${translate(hass, "sr_rooms")}>
      ${floors.map(
        (f) => html`<section aria-label=${f.name}>
          <ul>
            ${f.rooms.map(
              (r) => html`<li><button type="button" @click=${() => this.fire("room-tap", { floorId: r.floorId, roomId: r.roomId })}>${roomSentence(hass, r)}</button></li>`,
            )}
          </ul>
        </section>`,
      )}
    </nav>`;
  }

  private renderClock() {
    const pos = this.clock;
    // not while walking: the stick takes the corner and the clock would sit under it (#351); not with a room panel
    // open either: the clock and the weather would cover the room (#352)
    if (!pos || pos === "off" || !this.hass || this._walk || this.panelOpen) {
      if (this.clockTimer) {
        clearInterval(this.clockTimer);
        this.clockTimer = undefined;
      }
      return nothing;
    }
    const look = this.clockLook ?? CLOCK_LOOK;
    // ticks every second while seconds show, else twice a minute
    const every = look.seconds ? 1000 : 30000;
    if (this.clockTimer && this.clockEvery !== every) clearInterval(this.clockTimer), (this.clockTimer = undefined);
    this.clockEvery = every;
    this.clockTimer ??= setInterval(() => (this._clockTick = Date.now()), every);
    const clock = renderClock(pos, { now: new Date(this.now()), lang: (this.hass.language || "en").replace("_", "-"), timeZone: this.hass.config?.time_zone, locale: this.hass.locale }, look);
    // the weather tile beside it (#333): its code loads when the option is on, its forecast on the first tap
    const wx = this.clockWeather ? weatherEntity(this.hass, this.weatherEntityId ?? this.building?.settings?.weather_entity) : null;
    if (!wx) return clock;
    need(loadWeatherTile);
    return html`<div class="fp3d-clockrow fp3d-clock-${pos}">${clock}<fp3d-weather-tile .hass=${this.hass} .entity=${wx} .look=${look} .pos=${pos} ?light=${this.hasAttribute("light")}></fp3d-weather-tile></div>`;
  }

  private renderAlerts() {
    const b = this.building;
    if (!this._alerts.length || !b) return nothing;
    const shown = this._alerts.slice(0, 3);
    // editors dismiss a warning for now or for good (#138); not while replaying, not on a locked tablet
    const may = this.mayEdit;
    const t = (k: I18nKey) => translate(this.hass, k);
    return html`<div class="fp3d-alert-banner" role="alert">
      ${shown.map((a) => {
        const key = alertKey(a);
        const open = may && this._dismissing === key;
        return html`<span class="fp3d-alert-item ${may ? "fp3d-alert-dismissable" : ""}">
          <button class="fp3d-alert fp3d-alert-${a.kind}" title=${alertText(this.hass, b, a)} @click=${() => this.jumpTo(a)}>${alertText(this.hass, b, a)}</button>
          ${may
            ? html`<button class="fp3d-alert-x" title=${t("alert_dismiss")} aria-label=${t("alert_dismiss")} aria-expanded=${open ? "true" : "false"} @click=${() => (this._dismissing = open ? null : key)}>✕</button>`
            : nothing}
          ${open
            ? html`<div class="fp3d-alert-menu" role="menu">
                <button role="menuitem" title=${t("alert_dismiss_now_hint")} @click=${() => this.dismiss(a, false)}>${t("alert_dismiss_now")}</button>
                ${mayIgnoreAlert(a.kind)
                  ? html`<button role="menuitem" title=${t("alert_dismiss_good_hint")} @click=${() => this.dismiss(a, true)}>${t("alert_dismiss_good")}</button>`
                  : html`<small>${t("alert_dismiss_safety")}</small>`}
              </div>`
            : nothing}
        </span>`;
      })}
      ${this._alerts.length > 3 ? html`<span class="fp3d-alert-more">+${this._alerts.length - 3}</span>` : nothing}
    </div>`;
  }

  /** Scenes and scripts of the selected room's area as chips (while no panel lists them). */
  private renderScenes() {
    const b = this.building;
    if (!this.scenes || !this.roomId || this.panelOpen || !b || !this.hass || this.ro) return nothing;
    const room = b.floors.flatMap((f) => zonesOf(f)).find((r) => r.id === this.roomId);
    const ids = room ? areaEntities(this.hass, room.area_id).filter((id) => kindOf(id) === "scene" || kindOf(id) === "script").slice(0, 6) : [];
    if (!ids.length) return nothing;
    const areaName = room?.area_id ? this.hass.areas?.[room.area_id]?.name : undefined;
    return html`<div class="fp3d-scenes">
      ${ids.map((id) => html`<button class="fp3d-chip" aria-pressed=${this._sceneFired === id} @click=${() => this.runScene(id)}>${entityName(this.hass, id, areaName)}</button>`)}
    </div>`;
  }

  /**
   * Fun pack "pets": while it is unlocked and switched on, the animals live in the house (their bundle loads then);
   * a new plan (the floors are built anew) hands them over again.
   */
  private async syncPets(): Promise<void> {
    const b = this.building;
    const v = this.viewer;
    const on = b?.settings.pets?.on !== false && this.petsOn !== false;
    const list = on ? (b?.settings.pets?.list ?? []) : [];
    // the fun pack also brings fish to the pets pack's aquariums
    const fish = on && !!b?.floors.some((f) => f.furniture.some((m) => /:aquarium(_large)?$/.test(m.type)));
    if (!v || !b || this.plan2d || (!list.length && !fish)) {
      this.pets?.dispose();
      this.pets = null;
      this.petsFor = null;
      return;
    }
    if (this.pets) {
      if (this.petsFor !== b) {
        this.petsFor = b;
        this.pets.update(b, list);
      }
      return;
    }
    if (this.petsLoading) return;
    this.petsLoading = true;
    try {
      const [fun, mod, walk] = await Promise.all([loadFun(), load3d(), loadWalk()]);
      if (!this.viewer || this.plan2d || this.pets) return;
      this.petsFor = this.building;
      this.pets = fun.startPets({
        lib: mod.funLib,
        FloorMap: walk.FloorMap,
        viewer: this.viewer as never,
        building: this.building!,
        pets: this.building?.settings.pets?.on !== false && this.petsOn !== false ? (this.building?.settings.pets?.list ?? []) : [],
        night: () => this.hass?.states["sun.sun"]?.state === "below_horizon",
        base: (floor, f) => mountBase(floor, f),
        surface: (floor, x, z) => surfaceHeight(floor, x, z),
        // roaming pets (#337): where the server puts them, for the home shown (time travel's read-only hass refuses it)
        hass: () => (this.replay ? undefined : this.hass),
        home: () => this.home,
        closedDoors: () => {
          const out = new Set<string>();
          const states = this.hass?.states ?? {};
          for (const f of this.building?.floors ?? []) for (const o of f.openings) if (o.type === "door" && o.contact && states[o.contact]?.state === "off") out.add(o.id);
          return out;
        },
      });
    } catch (err) {
      console.error("Home 3D: the pets failed to load", err);
    } finally {
      this.petsLoading = false;
    }
  }

  private dropVacuums(): void {
    this.vacuums?.dispose();
    this.vacuums = null;
    this.vacuumsFor = null;
  }

  /**
   * Robot vacuum maps (#350): while the plan has some and the View's switch is on, their chunk draws them on the floors
   * (three.js from the 3D bundle); a new plan hands them over again. Off, or none: nothing is loaded or kept.
   */
  private async syncVacuums(): Promise<void> {
    const b = this.building;
    if (!this.viewer || !b || this.plan2d || this.vacuumMaps === false || !b.settings.vacuum_maps?.some((m) => m.show !== false)) return this.dropVacuums();
    if (this.vacuums) {
      if (this.vacuumsFor !== b) this.vacuums.update((this.vacuumsFor = b));
      return;
    }
    if (this.vacuumsLoading) return;
    this.vacuumsLoading = true;
    try {
      const [chunk, mod] = await Promise.all([import("../vacuum-maps.ts"), load3d()]);
      if (!this.viewer || this.plan2d || this.vacuums || !this.building) return;
      this.vacuumsFor = this.building;
      this.vacuums = chunk.startVacuumMaps({ lib: mod.funLib, viewer: this.viewer as never, building: this.building, hass: this.rawHass });
      // the switch or the plan may have changed while it loaded
      void this.syncVacuums();
    } catch (err) {
      console.error("Home 3D: the vacuum maps failed to load", err);
    } finally {
      this.vacuumsLoading = false;
    }
  }

  /** Fun pack "Halloween": while it is unlocked and the ghost switched on, it floats through the house now and then. */
  private async syncGhost(): Promise<void> {
    const b = this.building;
    // the house-wide easter eggs switch (#139) wins over everything: cards and wall tablets follow it too
    const on = !!b && b.settings.easter_eggs !== false && b.settings.halloween?.ghost !== false && this.ghostOn !== false;
    if (!this.viewer || this.plan2d || !on) {
      this.ghost?.dispose();
      this.ghost = null;
      return;
    }
    if (this.ghost) {
      this.ghost.update(b);
      return;
    }
    if (this.ghostLoading) return;
    this.ghostLoading = true;
    try {
      const [fun, mod] = await Promise.all([loadFun(), load3d()]);
      if (!this.viewer || this.plan2d || this.ghost || !this.building) return;
      this.ghost = fun.startGhost({
        lib: mod.funLib,
        viewer: this.viewer as never,
        building: this.building,
        night: () => this.hass?.states["sun.sun"]?.state === "below_horizon",
      });
    } catch (err) {
      console.error("Home 3D: the ghost failed to load", err);
    } finally {
      this.ghostLoading = false;
    }
  }

  /**
   * Seasonal themes (#239): on a UK holiday the view gets a glow, a greeting and a light effect (a lazy bundle, only
   * loaded on such a day). The house-wide easter eggs switch and the holiday's own switch (Fun) turn it off; a card
   * that leaves the ghost out leaves this out too. Wakes again after midnight on a screen that stays open.
   */
  private async syncSeason(): Promise<void> {
    clearTimeout(this.seasonTimer);
    const b = this.building;
    const on = !!b && !!this.viewer && b.settings.easter_eggs !== false && this.ghostOn !== false && !!seasonNow(b.settings.seasons, undefined, b.settings.season_dates, b.settings.season_rules);
    if (!on) {
      this.season?.dispose();
      this.season = null;
      // not a holiday today: look again after midnight
      if (b && this.viewer && b.settings.easter_eggs !== false) {
        const d = new Date();
        this.seasonTimer = setTimeout(() => void this.syncSeason(), new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 5).getTime() - d.getTime());
      }
      return;
    }
    if (this.season) {
      this.season.refresh();
      return;
    }
    if (this.seasonLoading) return;
    this.seasonLoading = true;
    try {
      const fun = await loadFun();
      const stage = this.renderRoot.querySelector<HTMLElement>(".fp3d-stage");
      if (!this.viewer || this.season || !stage) return;
      this.season = fun.startSeason({
        host: stage,
        now: () => (this.building?.settings.easter_eggs === false || this.ghostOn === false ? null : seasonNow(this.building?.settings.seasons, undefined, this.building?.settings.season_dates, this.building?.settings.season_rules)),
        text: (key, vars) => translate(this.hass, key as I18nKey, vars),
        low: () => this._low,
        effect: () => this.building?.settings.season_effect,
      });
    } catch (err) {
      console.error("Home 3D: the seasonal theme failed to load", err);
    } finally {
      this.seasonLoading = false;
    }
  }

  /**
   * The walk through the house: one stands at eye height in a room of the floor shown (the room chosen, else the
   * biggest) and walks – dragging looks around, a tap on the floor walks there through the doors, keys or the
   * stick move; walls stop you. The house lives on around you: lights, screens, sunlight.
   */
  private async startWalk(): Promise<void> {
    const b = this.building;
    const v = this.viewer;
    if (!b || !v || this._walk || this.plan2d) return;
    const withRooms = b.floors.filter((f) => f.rooms.some((r) => r.points.length >= 3));
    const byRoom = this.roomId ? withRooms.find((f) => f.rooms.some((r) => r.id === this.roomId)) : undefined;
    const floor = byRoom ?? withRooms.find((f) => f.id === this.floorId) ?? [...withRooms].sort((x, y) => Math.abs(x.elevation) - Math.abs(y.elevation))[0];
    if (!floor) return;
    const walk = await loadWalk();
    this._walk = { room: null, hint: true };
    await this.updateComplete;
    const surface = this.renderRoot.querySelector<HTMLElement>(".fp3d-walk-surface");
    if (!surface) return;
    // the floor alone, its walls whole (the view's floor and wall mode come back afterwards)
    v.setFloor(floor.id, false);
    v.setWallMode("auto");
    const map = new walk.FloorMap(b, floor);
    const room = this.roomId ? floor.rooms.find((r) => r.id === this.roomId) : undefined;
    let start;
    if (room) {
      const c = map.freeNear(centroid(room.points));
      start = { x: c[0], z: c[1], yaw: map.openYaw(c), pitch: -0.05 };
    }
    this.walker = new walk.WalkCamera(v as never, map, surface, {
      start,
      // up or down a stair (#270): the floor shown follows (the stairs show while on them)
      // on the steps the floors below show whole and in place, so both levels are there until one steps off (#312)
      onFloor: (f, stairs) => {
        v.setFloorStack(stairs ? "stacked" : this.floorStack);
        v.setFloor(f.id, false);
      },
      onRoom: (r) => {
        this.walkRoomPts = r?.points ?? null;
        if (this._walk) this._walk = { ...this._walk, room: r?.name ?? null };
        this.syncDevices(true);
      },
    });
    this.walkKeys = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.stopWalk();
    };
    window.addEventListener("keydown", this.walkKeys);
    // the hint fades after a while
    setTimeout(() => {
      if (this._walk) this._walk = { ...this._walk, hint: false };
    }, 9000);
  }

  /** Ends the walk if one is on (Back and Escape, #351); false when there was none. */
  endWalk(): boolean {
    if (!this._walk) return false;
    this.stopWalk();
    return true;
  }

  private stopWalk(): void {
    if (!this.walker && !this._walk) return;
    this.walker?.dispose();
    this.walker = null;
    this.walkStick = null;
    if (this.walkKeys) window.removeEventListener("keydown", this.walkKeys);
    this.walkKeys = null;
    this._walk = false;
    this.walkRoomPts = null;
    const v = this.viewer;
    if (v) {
      v.setWallMode(this.wallMode);
      v.setFloorStack(this.floorStack);
      v.setFloor(this.floorId, true);
    }
    this.syncDevices(true);
  }

  private renderWalk() {
    if (!this.walkable || this.ro || this.plan2d || !this.building || !this.hass) return nothing;
    const t = (k: I18nKey) => translate(this.hass, k);
    if (!this._walk)
      return html`<button class="fp3d-walk-btn" title=${t("walk_start")} aria-label=${t("walk_start")} @click=${() => void this.startWalk()}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4.5" r="1.8" /><path d="m9 20 2.5-6 2.5 2.5V21M7.5 11l3-3.5 3.5 1.5 2 3.5M11.5 14l1-5" /></svg>
        <span class="fp3d-walk-label">${t("walk_title")}</span>
      </button>`;
    const w = this._walk;
    // the stick (tablets): forward and back, turning left and right
    const knob = (e: PointerEvent, el: HTMLElement) => {
      const stick = this.walkStick;
      if (!stick || e.pointerId !== stick.id) return;
      const r = 44;
      let dx = e.clientX - stick.cx;
      let dy = e.clientY - stick.cy;
      const d = Math.hypot(dx, dy);
      if (d > r) [dx, dy] = [(dx / d) * r, (dy / d) * r];
      (el.firstElementChild as HTMLElement).style.transform = `translate(${dx}px, ${dy}px)`;
      this.walker?.setStick({ x: dx / r, y: dy / r });
    };
    return html`<div class="fp3d-walk-surface"></div>
      <div class="fp3d-walk-top">
        <span class="fp3d-walk-room">🚶 ${w.room ?? t("walk_title")}</span>
      </div>
      <button class="fp3d-walk-exit" @click=${() => this.stopWalk()}>✕ ${t("walk_end")}</button>
      ${w.hint ? html`<div class="fp3d-walk-hint">${t("walk_hint")}</div>` : nothing}
      <div
        class="fp3d-walk-stick"
        @pointerdown=${(e: PointerEvent) => {
          const el = e.currentTarget as HTMLElement;
          const r = el.getBoundingClientRect();
          this.walkStick = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
          el.setPointerCapture(e.pointerId);
          knob(e, el);
        }}
        @pointermove=${(e: PointerEvent) => knob(e, e.currentTarget as HTMLElement)}
        @pointerup=${(e: PointerEvent) => {
          this.walkStick = null;
          ((e.currentTarget as HTMLElement).firstElementChild as HTMLElement).style.transform = "";
          this.walker?.setStick(null);
        }}
        @pointercancel=${(e: PointerEvent) => {
          this.walkStick = null;
          ((e.currentTarget as HTMLElement).firstElementChild as HTMLElement).style.transform = "";
          this.walker?.setStick(null);
        }}
      >
        <span></span>
      </div>`;
  }

  /** Search opens with the field focused, ready for typing (#259, V04). */
  private openFind(): void {
    this._find = "";
  }

  /** Search closes back to its button (#259). */
  private closeFind(): void {
    this._find = null;
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(".fp3d-find-btn")?.focus());
  }

  /** true while the stage carries the search button; the panel's floor bar carries the search otherwise (#305) */
  private findButtonShown(): boolean {
    return !!this.building && !!this.hass && !this.findInBar;
  }

  private renderFind() {
    const b = this.building;
    // the panel's floor bar carries the search when it is shown (#305); a card without that bar keeps this button
    if (!this.findButtonShown() || !b) return nothing;
    if (this._find === null) {
      return html`<button class="fp3d-find-btn" title=${translate(this.hass, "find")} aria-label=${translate(this.hass, "find")} @click=${() => this.openFind()}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
      </button>`;
    }
    need(loadFind);
    return html`<fp3d-find variant="float" .hass=${this.hass} .building=${b} @find-close=${() => this.closeFind()} @find-pick=${(e: CustomEvent<SearchItem>) => this.goTo(e.detail)}></fp3d-find>`;
  }

  /**
   * The star: a small menu for the floor shown (or the whole house) with all lights on / off, all blinds
   * up / down and the house's favourites (#145). House-wide actions want a second tap.
   */
  private renderCentral() {
    const b = this.building;
    const hass = this.hass;
    if (!b || !hass || !this.central || this._find !== null || this.ro) return nothing;
    const t = (k: I18nKey, vars?: Record<string, string | number>) => translate(hass, k, vars);
    const star = html`<button
      class="fp3d-central-btn ${this._central ? "fp3d-central-on" : ""}"
      title=${t("central")}
      aria-label=${t("central")}
      aria-expanded=${this._central}
      @click=${() => {
        this._central = !this._central;
      }}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
    </button>`;
    if (!this._central) return star;
    const favorites = (b.settings.favorites ?? []).filter((id) => hass.states[id]);
    const own = this.buttons ?? b.settings.buttons ?? [];
    const sheets = anyModule() ? moduleMenuSheets(this.sceneHost(hass, b)) : [];
    return html`${star}
      <div class="fp3d-central" role="dialog" aria-label=${t("central")}>
        ${sheets.length
          ? html`<div class="fp3d-central-favs">
              ${sheets.map(
                (sh) => html`<button class="fp3d-chip" @click=${() => {
                  this._central = false;
                  this._sheet = { id: sh.id, floorId: null, roomId: null };
                }}><span aria-hidden="true">${sh.icon}</span> ${sh.title}</button>`,
              )}
            </div>`
          : nothing}
        <b>${t("central_favorites")}</b>
        ${favorites.length
          ? html`<div class="fp3d-central-favs">
              ${favorites.map((id) => {
                const [domain, service] = favoriteCall(id);
                const st = hass.states[id];
                const on = domain === "homeassistant" && st?.state === "on";
                return html`<button
                  class="fp3d-chip"
                  aria-pressed=${on || this._sceneFired === id}
                  ?disabled=${isUnavailable(st)}
                  @click=${() => {
                    safeCall(hass, domain, service, { entity_id: id });
                    this._sceneFired = id;
                    setTimeout(() => (this._sceneFired = null), 600);
                  }}
                >
                  ${entityName(hass, id)}
                </button>`;
              })}
            </div>`
          : own.length
            ? nothing
            : html`<p class="fp3d-central-hint">${t(this.mayEdit ? "central_no_favorites" : "central_no_favorites_viewer")}</p>
                ${this.mayEdit && !this.noSettings
                  ? html`<button class="fp3d-btn fp3d-central-link" @click=${() => {
                      this._central = false;
                      this.openTab("open-settings", "/home_3d#settings", "favourites");
                    }}>${t("central_open_favorites")} ›</button>`
                  : nothing}`}
        ${own.length
          ? html`<div class="fp3d-central-favs">
              ${own.map(
                (btn) => html`<button
                  class="fp3d-chip fp3d-own-btn"
                  aria-pressed=${ownButtonOn(hass, btn)}
                  @click=${(e: Event) => {
                    runButton(hass, e.currentTarget as HTMLElement, btn, (error) => translate(hass, "service_failed", { error }));
                    if (btn.action !== "service") this._central = false;
                  }}
                >
                  ${btn.icon ? html`<ha-icon .icon=${btn.icon.startsWith("mdi:") ? btn.icon : `mdi:${btn.icon}`}></ha-icon>` : nothing}${btn.label}
                </button>`,
              )}
            </div>`
          : nothing}
      </div>`;
  }

  /** Whether a media player shows a now-playing card (playing, or paused with something to show, or within its grace time). */
  private mediaCardUp(hass: HomeAssistant, id: string): boolean {
    const st = hass.states[id];
    if (!st || kindOf(id) !== "media") return false;
    if (!this.ro && (this.mediaGrace.get(id)?.until ?? 0) > Date.now() && isUnavailable(st)) return true;
    const label = [st.attributes.media_title, st.attributes.app_name, st.attributes.source].some((v) => typeof v === "string" && !!v.trim());
    return !isUnavailable(st) && (st.state === "playing" || (st.state === "paused" && label && this.pausedRecently(st)));
  }

  /**
   * A paused player keeps its card for ten minutes: an Echo stays "paused" for hours after the music was stopped, and
   * its card stood there all that time (#815). The cards are looked at again when the time is up.
   */
  private pausedRecently(st: HassEntity): boolean {
    const since = Date.parse(st.last_changed ?? "");
    if (!Number.isFinite(since)) return true;
    const left = since + PAUSED_CARD_MS - Date.now();
    if (left <= 0) return false;
    // one timer, for the card that ends first
    const due = Date.now() + left + 500;
    if (!this.pausedTimer || due < this.pausedDue) {
      clearTimeout(this.pausedTimer);
      this.pausedDue = due;
      this.pausedTimer = setTimeout(() => {
        this.pausedTimer = undefined;
        this.syncDevices(true);
      }, left + 500);
    }
    return true;
  }
  private pausedTimer: ReturnType<typeof setTimeout> | undefined;
  private pausedDue = 0;

  /** The eye: one tap hides every bar and overlay so only the stage remains, the next brings them back. */
  /** Zoom and pan buttons (#297), for the 3D view and the 2D plan; not in the clean view, in a walk or beside the room panel. */
  private renderViewNav() {
    if (!this.navButtons || this.clean || this._walk || this.panelOpen || !this.hass) return nothing;
    need(loadViewNav);
    return html`<fp3d-view-nav class="fp3d-vnav" ?turn=${!this.plan2d} .t=${(k: string) => translate(this.hass, k as I18nKey)} @nav=${(e: CustomEvent<NavAction>) => this.viewer?.navigate(e.detail)}></fp3d-view-nav>`;
  }

  private renderEye() {
    // while the search is open its field takes the eye's place (#220)
    if (!this.cleanButton || !this.hass || (this._find !== null && !this.clean)) return nothing;
    const label = translate(this.hass, this.clean ? "controls_show" : "controls_hide");
    return html`<button
      class="fp3d-eye ${this.clean ? "fp3d-eye-clean" : ""}"
      title=${label}
      aria-label=${label}
      aria-pressed=${this.clean}
      @click=${() => this.dispatchEvent(new CustomEvent("clean-toggle", { bubbles: true, composed: true }))}
    >
      ${this.clean
        ? svg`<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 6a9.8 9.8 0 0 1 9 6 9.8 9.8 0 0 1-9 6 9.8 9.8 0 0 1-9-6 9.8 9.8 0 0 1 9-6m0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4" /></svg>`
        : svg`<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2.4 3.8 3.8 2.4l17.8 17.8-1.4 1.4-3.3-3.3A10.5 10.5 0 0 1 12 19a9.8 9.8 0 0 1-9-6 10.3 10.3 0 0 1 3.6-4.3L2.4 3.8M12 7a4 4 0 0 1 4 4c0 .5-.1 1-.3 1.5l-5.2-5.2c.5-.2 1-.3 1.5-.3m-4 4a4 4 0 0 0 5.5 3.7l-5.2-5.2c-.2.5-.3 1-.3 1.5m4-7a9.8 9.8 0 0 1 9 6 10 10 0 0 1-2.6 3.6l-1.4-1.4A8 8 0 0 0 18.8 12 8 8 0 0 0 9.6 7.2L8 5.6A10.3 10.3 0 0 1 12 4" /></svg>`}
    </button>`;
  }

  /** Voice control: the microphone button and what was heard or answered. */
  private renderMic() {
    const hass = this.hass;
    if (!this.voice || !hass || this.ro || this._walk) return nothing;
    const v = this._voice;
    const busy = v?.phase === "wait" || v?.phase === "listen";
    const label = translate(hass, "voice_button");
    const left = this.cleanButton && !(this._find !== null && !this.clean) ? (this.clean ? 56 : 100) : 56;
    return html`<button class="fp3d-mic ${v?.phase === "listen" ? "fp3d-mic-on" : ""}" style="left:${left}px" title=${label} aria-label=${label} ?disabled=${busy} @click=${() => void this.onMic()}>
        ${svg`<svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3m7 9c0 3.5-2.6 6.4-6 6.9V21h-2v-3.1c-3.4-.5-6-3.4-6-6.9h2a5 5 0 0 0 10 0h2Z" /></svg>`}
      </button>
      ${v ? html`<div class="fp3d-mic-say ${v.phase === "error" ? "fp3d-mic-err" : ""}" style="left:${left}px">${v.text}</div>` : nothing}`;
  }

  /** What the microphone heard or the view answered, shown next to the button for a moment. */
  private sayVoice(phase: "wait" | "listen" | "done" | "error", text: string): void {
    this._voice = { phase, text };
    clearTimeout(this.voiceTimer);
    if (phase === "done" || phase === "error") this.voiceTimer = setTimeout(() => (this._voice = null), phase === "error" ? 9000 : 6000);
  }

  /**
   * A sentence from Assist (a satellite, the Assist dialog, an automation): handled like one from the microphone,
   * but without Assist as the fallback (it asked). The answer goes back to Assist, which speaks it where it was asked;
   * the view speaks only when the service asked for it.
   */
  private async onAsk(ask: Ask): Promise<void> {
    const hass = this.hass;
    const b = this.building;
    if (!hass || !b) return;
    // a sentence for one screen: only the view with that name (a view without a name stays out of it)
    const mine = (this.screen ?? "").trim().toLowerCase();
    if (ask.screen && ask.screen.trim().toLowerCase() !== mine) return;
    // a locating answer: fly into its room, or tour the rooms of everyone at home (nobody waits for an answer)
    if (ask.show_rooms) {
      if (!ask.admins_only || hass.user?.is_admin) void this.showRooms(b, ask.show_rooms);
      return;
    }
    let answer: string | null = null;
    try {
      const v = await loadVoice();
      answer = await this.handleSentence(hass, b, v, ask.text, ask.speak);
      if (answer === null) this.sayVoice("error", translate(hass, "voice_none"));
    } catch (err) {
      this.sayVoice("error", translate(hass, "voice_error", { msg: String((err as Error)?.message ?? err) }));
    }
    try {
      await answerAsk(hass, ask.ask_id, answer ?? "", answer !== null);
    } catch {
      // the question is gone (answered by another view, or its asker waited no longer)
    }
  }

  /** One spoken sentence: a place to show ("Show the living room") is shown, anything else goes to Assist. */
  private async onMic(): Promise<void> {
    const hass = this.hass;
    const b = this.building;
    if (!hass || !b || this._voice?.phase === "wait" || this._voice?.phase === "listen") return;
    clearTimeout(this.voiceTimer);
    const say = (phase: "wait" | "listen" | "done" | "error", text: string) => this.sayVoice(phase, text);
    say("wait", "…");
    this.tourToken++;
    // the audio context starts here, on the tap itself: made later (after loading) Android WebViews keep it mute (#579)
    let started: AudioContext | undefined;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      started = new Ctx();
      void started.resume();
    } catch {
      started = undefined;
    }
    try {
      const v = await loadVoice();
      const text = await v.listenOnce(hass, () => say("listen", translate(hass, "voice_listen")), voicePipeline(), started);
      if (!text) {
        say("error", translate(hass, "voice_none"));
        return;
      }
      if ((await this.handleSentence(hass, b, v, text, true)) !== null) return;
      say("wait", `“${text}” …`);
      const answer = await v.converse(hass, text);
      say("done", answer ? `“${text}” – ${answer}` : `“${text}”`);
    } catch (err) {
      const e = err as { name?: string; message?: string };
      const key =
        e?.message === "no_pipeline"
          ? "voice_no_pipeline"
          : e?.message === "silent"
            ? "voice_silent"
            : e?.name === "NotAllowedError" || e?.name === "SecurityError" || !window.isSecureContext
              ? "voice_denied"
              : null;
      say("error", key ? translate(hass, key) : translate(hass, "voice_error", { msg: String(e?.message ?? e?.name ?? err) }));
    }
  }

  /**
   * One sentence, from the microphone or from Assist: a place or device to show is shown, a question is answered by
   * the modules. Returns what was answered (for Assist to speak) or null when the sentence is not Home 3D's.
   * `speak`: the view speaks the answer itself (false when a satellite asked: it speaks).
   */
  private async handleSentence(hass: HomeAssistant, b: Building, v: Awaited<ReturnType<typeof loadVoice>>, text: string, speak: boolean): Promise<string | null> {
    const say = (phase: "wait" | "listen" | "done" | "error", t: string) => this.sayVoice(phase, t);
    // "style cozy", "reset the style": this view's style (#442)
    const styled = this.replay ? null : v.styleCommand(text, this.styleNames());
    const id = styled ? this.setStyleOverride(styled.id ?? "reset", null) : null;
    if (styled && id !== null) {
      const said = id ? translate(hass, "style_set", { name: styleById(id)?.name ?? translate(hass, `style_${id}` as I18nKey) }) : translate(hass, "style_reset");
      say("done", `“${text}” – ${said}`);
      if (speak) void v.speak(hass, said, voicePipeline());
      return said;
    }
    const { devices, items } = this.spokenDevices(hass, b, v.SYNONYMS);
    const place = v.showTarget(text, b, devices, (r) => (r.area_id ? hass.areas?.[r.area_id]?.name : null));
    if (place) {
      const name = place.kind === "house" ? translate(hass, "all_floors") : place.kind === "cameras" ? translate(hass, "camera_wall_title") : place.name;
      say("done", `“${text}” → ${name}`);
      this.directing.touch(Date.now());
      if (place.kind === "cameras") {
        this.dispatchEvent(new CustomEvent("camera-wall-open", { bubbles: true, composed: true }));
      } else if (place.kind === "device") {
        const item = items.get(place.id);
        // a camera is looked through (Kamera-Cockpit), any other device shown where it stands
        if (place.camera && place.entity) this.lookThrough(place.entity);
        else if (item) this.goTo(item);
      } else if (place.kind === "house") this.fire("floor-tap", { floorId: null });
      else if (place.kind === "floor") this.fire("floor-tap", { floorId: place.floorId });
      else {
        if (this.floorId !== place.floorId) this.fire("floor-tap", { floorId: place.floorId });
        setTimeout(() => this.fire("room-tap", { floorId: place.floorId, roomId: place.roomId }), 60);
      }
      return translate(hass, "voice_showing", { name });
    }
    // a rack question ("how hot is the rack?", "what's the UPS battery?"): answered from the rack card's values
    const racks = this.spokenRacks(hass, b);
    const rackSaid = racks.length ? v.rackAnswer(text, racks, (key, vars) => translate(hass, key as I18nKey, vars)) : null;
    if (rackSaid) {
      say("done", `“${text}” – ${rackSaid.text}`);
      this.directing.touch(Date.now());
      const item = items.get(`furniture:${rackSaid.rackId}`);
      if (item) this.goTo(item);
      if (speak) void v.speak(hass, rackSaid.text, voicePipeline());
      return rackSaid.text;
    }
    // who and what is where: locating answers first (the same answer Assist gets) and flies there
    const located = await hass
      .callWS<{ text: string; rooms: string[]; admins_only: boolean } | null>({ type: "home_3d/locate/ask", text, language: hass.language })
      .catch(() => null);
    if (located) {
      say("done", `“${text}” – ${located.text}`);
      if (located.rooms.length && (!located.admins_only || hass.user?.is_admin)) void this.showRooms(b, located.rooms);
      if (speak) void v.speak(hass, located.text, voicePipeline());
      return located.text;
    }
    // a module of the house answers (registered in code): what to say and what to show
    const host = this.moduleHost(hass, b, v.SYNONYMS, (s) => v.showTarget(s, b, devices, (r) => (r.area_id ? hass.areas?.[r.area_id]?.name : null)));
    const own = await moduleVoice(text, host);
    if (own) {
      say("done", own.text ? `“${text}” – ${own.text}` : `“${text}”`);
      this.directing.touch(Date.now());
      if (own.highlight?.length) this.viewer?.flashDevices(own.highlight);
      const f = own.focus;
      const spoken = own.spoken ?? own.text ?? "";
      if (own.tour?.length) {
        // the intro is spoken first, then the tour speaks at its stops
        const talk = speak && own.speak !== false ? (t: string) => v.speak(hass, t, voicePipeline()) : null;
        const intro = own.spoken ?? own.text;
        if (intro && talk) await talk(intro);
        void this.runTour(own.tour, b, items, talk);
        return spoken;
      }
      if (f?.roomId && f.floorId) {
        if (this.floorId !== f.floorId) this.fire("floor-tap", { floorId: f.floorId });
        setTimeout(() => this.fire("room-tap", { floorId: f.floorId, roomId: f.roomId }), 60);
      } else if (f?.floorId && !f.entity && !f.furnitureId) this.fire("floor-tap", { floorId: f.floorId });
      else if (f?.entity || f?.furnitureId) {
        const item = items.get(f.entity ?? `furniture:${f.furnitureId}`);
        if (item) this.goTo(item);
      }
      if (own.text && own.speak !== false && speak) void v.speak(hass, own.text, voicePipeline());
      return spoken;
    }
    return null;
  }

  /**
   * What can be shown by voice: every piece of furniture (with or without an entity) by its own name, its kind, its
   * entity's name and everyday words for it ("TV", "telly"); placed devices by their name – each with its room.
   * `items` says where each of them is, for the flight there.
   */
  private spokenDevices(hass: HomeAssistant, b: Building, synonyms: Record<string, string[]>): { devices: Shown[]; items: Map<string, SearchItem>; spoken: SpokenDevice[] } {
    const index = (this.findIndex ??= searchIndex(hass, b));
    const roomName = new Map(b.floors.flatMap((f) => zonesOf(f).map((r) => [r.id, r.name] as const)));
    const devices: Shown[] = [];
    const spoken: SpokenDevice[] = [];
    const items = new Map<string, SearchItem>();
    for (const it of index) if (it.kind === "device" && it.entity) items.set(it.entity, it);
    const ofFurniture = new Set<string>();
    for (const floor of b.floors) {
      const zones = zonesOf(floor);
      for (const f of floor.furniture) {
        if (UNSPOKEN.has(f.type)) continue;
        const link = this.furnitureLinks.get(f.id);
        const entity = link?.entity ?? link?.power ?? null;
        const id = entity ?? `furniture:${f.id}`;
        const zone = zones.find((r) => r.points.length >= 3 && pointInPolygon([f.x, f.z], r.points));
        const kindName = furnitureName(hass, f.type);
        const names = [f.name, ...(f.aliases ?? []), kindName, entity ? entityName(hass, entity) : null, ...(synonyms[f.type] ?? [])].filter((n): n is string => !!n);
        const name = f.name || (entity ? entityName(hass, entity) : kindName);
        devices.push({ id, entity, name, names, room: zone?.name ?? "", camera: !!entity && kindOf(entity) === "camera" });
        const plant = (f.type === "plant" || isPackPlant(f.type)) && !!f.moisture && f.moisture !== "none";
        // the time left only while the appliance runs (not a leftover on its display sensor)
        const idle = applianceIdle(link?.entity ? hass.states[link.entity] : undefined, link?.power ? readPower(hass.states[link.power]) : null, typeof f.run_w === "number" && f.run_w > 0 ? f.run_w : 10);
        const remaining = typeof f.remaining === "string" && f.remaining !== "none" && !idle ? remainingMinutes(hass.states[f.remaining]) : null;
        spoken.push({ id, entity, name, names, room: zone?.name ?? "", floorId: floor.id, roomId: zone?.id ?? null, power: link?.power ?? null, type: f.type, remaining, thirsty: plant ? plantThirsty(f, hass) : null });
        if (entity) ofFurniture.add(entity);
        else items.set(id, { kind: "device", name, where: "", floorId: floor.id, roomId: zone?.id ?? null, entity: null, icon: null, x: f.x, z: f.z, y: Math.min(floor.height - 0.3, Math.max(0.5, f.h)) });
      }
    }
    const placed = new Map(b.floors.flatMap((fl) => fl.placements.map((p) => [p.entity_id, p] as const)));
    for (const [entity, it] of items) {
      if (ofFurniture.has(entity) || entity.startsWith("furniture:")) continue;
      const room = (it.roomId && roomName.get(it.roomId)) || "";
      const pl = placed.get(entity);
      const names = [pl?.name, ...(pl?.aliases ?? []), it.name].filter((n): n is string => !!n);
      devices.push({ id: entity, entity, name: it.name, names, room, camera: kindOf(entity) === "camera" });
      spoken.push({ id: entity, entity, name: it.name, names, room, floorId: it.floorId, roomId: it.roomId, power: null, type: "device" });
    }
    return { devices, items, spoken };
  }

  /** The smart locks of the doors (D636): a pin at each door that has one, red while it is unlocked; a tap locks or unlocks. */
  private lockMarkers(hass: HomeAssistant, b: Building): (DeviceMarker & { fromFurniture: boolean })[] {
    const out: (DeviceMarker & { fromFurniture: boolean })[] = [];
    for (const floor of b.floors) {
      for (const o of floor.openings) {
        const lock = this.openingLinks?.get(o.id)?.lock;
        if (!lock) continue;
        // on a double door the lock sits on the main leaf, not on the seam between the leaves (#645)
        const spot = this.openingSpot(b, o.id, true);
        if (!spot) continue;
        const st = hass.states[lock];
        out.push({
          id: lock,
          floorId: floor.id,
          roomId: o.room_id,
          x: spot.x,
          z: spot.z,
          y: Math.min(spot.y + 0.35, 1.5),
          icon: iconSvg("lock"),
          name: entityName(hass, lock),
          text: st ? stateText(hass, st) : "",
          active: !!st && (st.state === "unlocked" || st.state === "open" || st.state === "unlocking"),
          unavailable: !st || isUnavailable(st),
          glow: null,
          full: true,
          fromFurniture: false,
        });
      }
    }
    return out;
  }

  /**
   * Where an opening of the plan is: the middle of its frame at the height of its middle, and from which side to
   * look at it – from inside its room (null: not drawn).
   */
  private openingSpot(b: Building, openingId: string, lock = false): { floorId: string; x: number; z: number; y: number; theta: number } | null {
    for (const floor of b.floors) {
      const o = floor.openings.find((x) => x.id === openingId);
      if (!o) continue;
      const host = openingHost(o, floor.rooms, floor.walls ?? []);
      if (!host) return null;
      const pts = host.room.points;
      const p = pts[host.edge];
      const q = pts[(host.edge + 1) % pts.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const d = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
      // the room lies to the left of the edge when its outline runs counter-clockwise, else to the right
      const left = signedArea(pts) > 0;
      const n = left ? [-d[1], d[0]] : [d[1], -d[0]];
      // the offset is the opening's centre; a lock sits on its leaf (on a double door the main leaf), seen from the
      // room "right" is (n.z, -n.x) like in the 3D build, so the hinge side follows the outline's direction
      let along = o.offset;
      if (lock) {
        const startIsLeft = d[0] * n[1] - d[1] * n[0] > 0;
        along = o.offset - o.width / 2 + lockAlong(o, (o.hinge === "left") === startIsLeft);
      }
      const [x, z] = pointOnRoomEdge(host.room, host.edge, along);
      // the camera stands on the room side: its horizontal offset from the target points along n
      return { floorId: floor.id, x: x + n[0] * 0.2, z: z + n[1] * 0.2, y: Math.max(0.5, o.sill + o.height / 2), theta: Math.atan2(n[0], n[1]) };
    }
    return null;
  }

  /**
   * A tour (a module's answer): the view flies to each stop – an open window, a running appliance – and stays
   * there a moment before the next. A tap on the house, or the next spoken sentence, ends it.
   */
  /** Flies into the given plan rooms one after another (one room: just there); a touch stops the tour. */
  private async showRooms(b: Building, roomIds: string[]): Promise<void> {
    const stops = roomIds
      .map((roomId) => ({ roomId, floorId: b.floors.find((f) => f.rooms.some((r) => r.id === roomId))?.id }))
      .filter((s): s is { roomId: string; floorId: string } => !!s.floorId)
      .slice(0, 8);
    if (!stops.length) return;
    const token = ++this.tourToken;
    clearTimeout(this.tourTimer);
    this.directing.touch(Date.now());
    const stage = this.renderRoot.querySelector(".fp3d-stage");
    const stop = () => {
      this.tourToken++;
      clearTimeout(this.tourTimer);
    };
    stage?.addEventListener("pointerdown", stop, { once: true });
    const wait = (ms: number) => new Promise<void>((r) => (this.tourTimer = setTimeout(r, ms)));
    for (const [i, s] of stops.entries()) {
      if (token !== this.tourToken) break;
      if (this.floorId !== s.floorId) {
        this.fire("floor-tap", { floorId: s.floorId });
        await wait(150);
      }
      if (token !== this.tourToken) break;
      // a tap on the open room would close it
      if (this.roomId !== s.roomId) this.fire("room-tap", { floorId: s.floorId, roomId: s.roomId });
      this.directing.touch(Date.now());
      if (i < stops.length - 1) await wait(4000);
    }
    stage?.removeEventListener("pointerdown", stop);
  }

  private async runTour(stops: NonNullable<VoiceAnswer["tour"]>, b: Building, items: Map<string, SearchItem>, speak: ((text: string) => Promise<boolean>) | null): Promise<void> {
    const token = ++this.tourToken;
    clearTimeout(this.tourTimer);
    const spots = stops
      .map((s) => {
        if (s.openingId) {
          const spot = this.openingSpot(b, s.openingId);
          return spot ? { ...spot, entity: null as string | null, say: s.say, inside: true } : null;
        }
        const item = items.get(s.entity ?? `furniture:${s.furnitureId}`);
        return item ? { floorId: item.floorId, x: item.x, z: item.z, y: item.y, theta: undefined as number | undefined, entity: item.entity, say: s.say, inside: false } : null;
      })
      .filter((s): s is NonNullable<typeof s> => !!s)
      .slice(0, 8);
    if (!spots.length) return;
    const stage = this.renderRoot.querySelector(".fp3d-stage");
    const stop = () => {
      this.tourToken++;
      clearTimeout(this.tourTimer);
    };
    stage?.addEventListener("pointerdown", stop, { once: true });
    const wait = (ms: number) => new Promise<void>((r) => (this.tourTimer = setTimeout(r, ms)));
    for (const s of spots) {
      if (token !== this.tourToken) break;
      if (this.floorId !== s.floorId) {
        this.fire("floor-tap", { floorId: s.floorId });
        await wait(150);
      }
      if (token !== this.tourToken) break;
      // an opening is looked at from inside its room, closer and lower than a device
      this.viewer?.focus(s.floorId, s.x, s.z, s.y, s.entity, s.inside ? { radius: 3.2, phi: 1.05, theta: s.theta } : undefined);
      await wait(900);
      if (token !== this.tourToken) break;
      // the words of this stop are spoken here, and the next stop waits for them
      const spoken = s.say && speak ? await speak(s.say) : false;
      if (token !== this.tourToken) break;
      await wait(spoken ? 1200 : 2600);
    }
    stage?.removeEventListener("pointerdown", stop);
  }

  /** The plan's doors, windows, garage doors and roof windows by their entities, each with its room's name. */
  private spokenOpenings(hass: HomeAssistant, b: Building): SpokenOpening[] {
    const out: SpokenOpening[] = [];
    const t = (k: Parameters<typeof translate>[1]) => translate(hass, k);
    for (const floor of b.floors) {
      const rooms = new Map(zonesOf(floor).map((r) => [r.id, r.name] as const));
      for (const o of floor.openings) {
        const e = this.openingLinks?.get(o.id);
        if (!e) continue;
        const kind = o.type === "garage" ? "garage" : o.type === "door" ? "door" : "window";
        // open as the 3D view shows it: the sash or door turned, a garage door up; tilted on its own
        const s = openingState(hass, e, o.type);
        const open = s.open > 0.02 || s.open2 > 0.02 || (o.type === "garage" && (s.cover ?? 0) > 0.02);
        const tilted = !open && (s.tilt > 0.02 || s.tilt2 > 0.02);
        for (const id of [e.contact, e.contact2, e.cover, e.tilt, e.tilt2]) {
          if (id && id !== "none") out.push({ id: o.id, entity: id, kind, name: t(`opening_${o.type}`), room: rooms.get(o.room_id) ?? "", floorId: floor.id, roomId: o.room_id, open, tilted });
        }
      }
    }
    const windows = b.settings.roof?.windows ?? [];
    const faces = windows.length ? new Map(roofFaces(b).map((f) => [f.key, f])) : null;
    for (const w of windows) {
      // the same state as the 3D view: a window motor opens it too (#712 – motor roof windows counted as shut)
      const s = roofWindowState(hass, w);
      const open = s.open > 0.02;
      const tilted = !open && s.tilt > 0.02;
      const ids = [w.window, w.contact, w.cover, w.tilt].filter((id): id is string => !!id && id !== "none");
      // its room: the area of its sensor in Home Assistant, else the room under it (a roof over two floors put every
      // roof window on the top floor without a room, #783, #712)
      const byArea = ids
        .map((id) => entityAreaId(hass, id))
        .filter((a): a is string => !!a)
        .map((a) => b.floors.flatMap((f) => f.rooms.filter((r) => r.area_id === a).map((r) => ({ floor: f, room: r }))))
        .find((hits) => hits.length === 1)?.[0];
      const under = byArea ? null : roofWindowRoom(b, faces?.get(w.face), w);
      const floor = byArea?.floor ?? under?.floor ?? b.floors[b.floors.length - 1];
      const room = byArea?.room ?? (under ? floor?.rooms.find((r) => r.id === under.roomId) : undefined);
      for (const id of ids) out.push({ id: w.id, entity: id, kind: "roof_window", name: w.name || t("roof_window"), room: room?.name ?? "", floorId: floor?.id ?? "", roomId: room?.id ?? null, open, tilted });
    }
    return out;
  }

  /** What a module may ask: the house, its devices, the host's own matching of a spoken device, the consumers. */
  /** The host a module that draws gets: the plan, the stage's state and the services to change the plan. */
  private sceneHost(hass: HomeAssistant, b: Building): ModuleHost {
    return this.moduleHost(hass, b, {}, () => null);
  }

  private moduleHost(hass: HomeAssistant, b: Building, synonyms: Record<string, string[]>, find: (sentence: string) => { kind: string; id?: string } | null): ModuleHost {
    // the devices by name are costly: only when a module asks (the voice modules do, the stage ones rarely)
    let spokenList: SpokenDevice[] | null = null;
    const spoken = () => (spokenList ??= this.spokenDevices(hass, b, synonyms).spoken);
    const host: ModuleHost = {
      api: 1,
      hass: () => this.hass,
      building: () => this.building,
      language: () => hass.language || "en",
      devices: () => spoken(),
      findDevice: (sentence) => {
        const hit = find(sentence);
        return hit?.kind === "device" && hit.id ? (spoken().find((d) => d.id === hit.id) ?? null) : null;
      },
      dimmed: () => this.dimmed,
      canEdit: () => this.mayEdit,
      updateBuilding: (mutate) => this.changePlan(mutate),
      callService: (domain, service, data) => (this.hass ? (safeCall(this.hass, domain, service, data ?? {}), Promise.resolve()) : Promise.resolve()),
      newId: (prefix) => uid(prefix),
      waterLevel: (floorId, areaId) => {
        const floor = this.building?.floors.find((f) => f.id === floorId);
        const area = floor?.outdoor.find((o) => o.id === areaId);
        if (!floor || !area || area.type !== "pool") return null;
        return { y: poolWaterY(floor, area), floorY: poolFloorY(floor, area) };
      },
      groundAt: (floorId, x, z) => {
        const floor = this.building?.floors.find((f) => f.id === floorId);
        return floor ? outdoorGround(floor, x, z) : 0;
      },
      refresh: () => {
        this.requestUpdate();
        // the stage and the cards come from the module: ask it again (once, however often it asks)
        this.moduleTimer ??= setTimeout(() => {
          this.moduleTimer = undefined;
          this.syncDevices(false, true);
        }, 50);
      },
      plan: pipePlanner,
      openings: () => this.spokenOpenings(hass, b),
      energy: () => (this._energy ? { consumption: this._energy.consumption, solar: this._energy.solar, grid: this._energy.grid, battery: this._energy.battery, soc: this._energy.soc } : null),
      consumers: () =>
        [...this.lastConsumers]
          .map((c) => ({ id: c.id, entity: c.powerEntity, name: spoken().find((d) => d.entity === c.id || d.power === c.powerEntity)?.name ?? entityName(hass, c.id), watts: c.power }))
          .sort((x, y) => y.watts - x.watts),
      household: () => this._household.map((it) => ({ text: it.text, entity: it.entity, hot: !!it.hot })),
      alerts: () => this.spokenAlerts(hass, b),
      cars: () => this.spokenCars(hass, b),
      pools: () => modulePools(host),
      weather: () => weatherEntity(hass, this.weatherEntityId ?? b.settings.weather_entity),
      listen: async (onListening) => {
        try {
          const v = await loadVoice();
          const text = await v.listenOnce(hass, onListening, voicePipeline());
          return text.trim() || null;
        } catch {
          return null;
        }
      },
      notify: (text) => this.showNote(text),
      occupied: () => this.occupiedRooms(hass, b),
      speakers: () => this.planSpeakers(hass, b),
    };
    return host;
  }

  /** A short note at the bottom of the view for a few seconds. */
  private showNote(text: string): void {
    this._note = text;
    clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => (this._note = null), 3500);
  }

  /** The rooms someone is in: the people shown, and rooms whose presence, occupancy or motion sensor is on. */
  private occupiedRooms(hass: HomeAssistant, b: Building): { floorId: string; roomId: string }[] {
    const out = new Map<string, { floorId: string; roomId: string }>();
    for (const p of this.lastPersons) if (p.roomId) out.set(p.roomId, p);
    for (const floor of b.floors) {
      for (const room of floor.rooms) {
        if (out.has(room.id) || !room.area_id) continue;
        const busy = areaEntities(hass, room.area_id).some((id) => {
          const st = hass.states[id];
          return id.startsWith("binary_sensor.") && st?.state === "on" && ["presence", "occupancy", "motion"].includes(String(st.attributes.device_class));
        });
        if (busy) out.set(room.id, { floorId: floor.id, roomId: room.id });
      }
    }
    return [...out.values()];
  }

  /** The media players of the plan, placed as a device or linked to a piece of furniture, each with its room. */
  private planSpeakers(hass: HomeAssistant, b: Building): { entity: string; name: string; floorId: string; roomId: string | null; furnitureId?: string; at?: [number, number]; top?: number }[] {
    const out: { entity: string; name: string; floorId: string; roomId: string | null; furnitureId?: string; at?: [number, number]; top?: number }[] = [];
    const seen = new Set<string>();
    for (const floor of b.floors) {
      const roomAt = (x: number, z: number) => floor.rooms.find((r) => r.points.length >= 3 && pointInPolygon([x, z], r.points))?.id ?? null;
      for (const pl of floor.placements) {
        if (!pl.entity_id.startsWith("media_player.") || seen.has(pl.entity_id) || !hass.states[pl.entity_id]) continue;
        seen.add(pl.entity_id);
        out.push({ entity: pl.entity_id, name: entityName(hass, pl.entity_id), floorId: floor.id, roomId: roomAt(pl.x, pl.z), at: [pl.x, pl.z], top: pl.y ?? 1.1 });
      }
      for (const f of floor.furniture) {
        const id = f.entity;
        if (!id || !id.startsWith("media_player.") || seen.has(id) || !hass.states[id]) continue;
        seen.add(id);
        out.push({ entity: id, name: entityName(hass, id), floorId: floor.id, roomId: roomAt(f.x, f.z), furnitureId: f.id, at: [f.x, f.z], top: mountBase(floor, f) + f.h });
      }
    }
    return out;
  }

  /** What modules offer in a room's panel (📢 …): its buttons. */
  roomSheets(roomId: string): { id: string; icon: string; title: string }[] {
    const hass = this.hass;
    const b = this.building;
    if (!hass || !b || this.ro || !anyModule()) return [];
    const floor = b.floors.find((f) => f.rooms.some((r) => r.id === roomId));
    if (!floor) return [];
    return moduleRoomSheets(this.sceneHost(hass, b), { floorId: floor.id, roomId }).map((sh) => ({ id: sh.id, icon: sh.icon, title: sh.title }));
  }

  /** Opens a module's sheet for a room (from its panel). */
  openRoomSheet(roomId: string, id: string): void {
    const floor = this.building?.floors.find((f) => f.rooms.some((r) => r.id === roomId));
    this._sheet = { id, floorId: floor?.id ?? null, roomId };
  }

  /** The open sheet as its module describes it now (its choice may have changed). */
  private currentSheet(hass: HomeAssistant, b: Building): ModuleSheet | null {
    const sh = this._sheet;
    if (!sh) return null;
    const host = this.sceneHost(hass, b);
    const list = sh.roomId && sh.floorId ? moduleRoomSheets(host, { floorId: sh.floorId, roomId: sh.roomId }) : moduleMenuSheets(host);
    return list.find((x) => x.id === sh.id) ?? null;
  }

  private renderSheet() {
    const hass = this.hass;
    const b = this.building;
    if (!hass || !b || !this._sheet) return nothing;
    const sheet = this.currentSheet(hass, b);
    if (!sheet) return nothing;
    const t = (k: I18nKey) => translate(hass, k);
    // opened from a room's panel: the room's name in the head
    const room = this._sheet.roomId ? b.floors.flatMap((f) => f.rooms).find((r) => r.id === this._sheet!.roomId) : undefined;
    const close = () => (this._sheet = null);
    const run = async (job: () => void | Promise<void>) => {
      close();
      try {
        await job();
      } catch (err) {
        console.warn("Home 3D: module sheet failed", err);
      }
    };
    const send = () => {
      const input = this.renderRoot.querySelector<HTMLInputElement>(".fp3d-sheet-input");
      const text = input?.value.trim();
      if (text && sheet.input) void run(() => sheet.input!.onSubmit(text));
    };
    const mic = async () => {
      const input = this.renderRoot.querySelector<HTMLInputElement>(".fp3d-sheet-input");
      if (!input) return;
      input.placeholder = t("sheet_listening");
      const host = this.sceneHost(hass, b);
      const text = await host.listen?.(() => (input.placeholder = t("sheet_listening")));
      input.placeholder = sheet.input?.placeholder ?? "";
      if (text) input.value = text;
      else this.showNote(t("sheet_mic_failed"));
    };
    return html`<div class="fp3d-sheet-backdrop" @click=${close}></div>
      <div class="fp3d-sheet" role="dialog" aria-label=${sheet.title}>
        <header>
          <b><span aria-hidden="true">${sheet.icon}</span> ${sheet.title}${room ? ` · ${room.name}` : ""}</b>
          <button class="fp3d-sheet-x" aria-label=${t("close")} @click=${close}>✕</button>
        </header>
        ${sheet.choice
          ? html`<div class="fp3d-sheet-choice">
              ${sheet.choice.options.map(
                (o) => html`<button class="fp3d-chip" aria-pressed=${o.id === sheet.choice!.value} @click=${() => {
                  sheet.choice!.set(o.id);
                  this.requestUpdate();
                }}>${o.label}</button>`,
              )}
            </div>`
          : nothing}
        ${sheet.chips?.length
          ? html`<div class="fp3d-sheet-chips">${sheet.chips.map((c) => html`<button class="fp3d-sheet-chip" @click=${() => void run(() => c.onTap())}>${c.label}</button>`)}</div>`
          : nothing}
        ${sheet.input
          ? html`<div class="fp3d-sheet-row">
              <input class="fp3d-sheet-input" placeholder=${sheet.input.placeholder} @keydown=${(e: KeyboardEvent) => e.key === "Enter" && send()} />
              ${sheet.input.mic
                ? html`<button class="fp3d-btn fp3d-sheet-mic" title=${t("sheet_mic")} aria-label=${t("sheet_mic")} @click=${() => void mic()}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
                  </button>`
                : nothing}
              <button class="fp3d-btn fp3d-primary" @click=${send}>${sheet.input.button}</button>
            </div>`
          : nothing}
        ${sheet.lines?.length ? html`<div class="fp3d-sheet-lines">${sheet.lines.map((l) => html`<p>${l}</p>`)}</div>` : nothing}
        ${this.mayEdit && modulesWithSettings().length
          ? html`<button class="fp3d-sheet-gear" @click=${() => {
              // the sentences and speakers are set on the extension's card on the Extensions tab (#248)
              close();
              this.openTab("open-extensions", "/home_3d");
            }}>${t("ext_module_settings")} ›</button>`
          : nothing}
      </div>`;
  }

  /** The plan as the 3D view shows it (#15): the same object while the same items are hidden, so the viewer does not rebuild. */
  private viewPlan(b: Building): Building {
    const now = new Date(this.replay?.t ?? Date.now());
    // the editor keeps hidden items in sight; noted as shown, so the next sync knows it is the same plan (#389: without
    // it every sync beside the editor handed the plan over again and rebuilt the scene, on every power reading)
    if (this.furnish) {
      if (this.shownPlan?.from !== b || this.shownPlan.plan !== b) this.shownPlan = { from: b, hidden: "", plan: b };
      return b;
    }
    const hidden = this.hass ? planHiddenItems(b, this.hass.states, now).join("|") : "";
    if (this.shownPlan?.from !== b || this.shownPlan.hidden !== hidden) this.shownPlan = { from: b, hidden, plan: hidden && this.hass ? shownBuilding(b, this.hass.states, now) : b };
    return this.shownPlan.plan;
  }

  /** Whether this user may change the plan here (editors only, never while replaying). */
  private get mayEdit(): boolean {
    return (this.canEdit ?? !!this.hass?.user?.is_admin) && !this.ro;
  }

  /** Changes the plan's settings from the ⚙ menu and saves them (editors only). */
  private setPlanSettings(patch: Partial<Building["settings"]>): void {
    this.changePlan((next) => Object.assign(next.settings, patch));
  }

  /** Change the plan and save it (editors only). The host (panel, card) takes the change as `plan-change` (#149): it
   * saves it from the revision it shows and makes it again on a newer plan when someone else saved meanwhile. Without
   * a host that takes it, it is saved here the same way (#363). */
  private changePlan(change: (b: Building) => void): void {
    const cur = this.building;
    if (!cur || !this.hass || !this.mayEdit) return;
    if (!this.dispatchEvent(new CustomEvent("plan-change", { detail: { change }, cancelable: true }))) return;
    const next = structuredClone(cur);
    change(next);
    this.building = next;
    // no host: the same controller the hosts use sends the base revision and makes the change again after a conflict (#363)
    this.planSaver ??= new FallbackPlanSaver(
      (plan) => (this.building = plan),
      (err) => this.serviceFailed("home_3d/building/save", err),
    );
    this.planSaver.change(this.hass, this.home, change).catch((err) => this.serviceFailed("home_3d/building/save", err));
  }
  private planSaver?: FallbackPlanSaver;

  /**
   * Another tab of the panel (#248: Settings for the central menu's link, Extensions for a module sheet's): the panel
   * opens it; a dashboard card has no panel around it, so it goes to the panel's page.
   */
  private openTab(event: "open-settings" | "open-extensions", url: string, section: string | null = null): void {
    const asked = new CustomEvent(event, { detail: { section, id: null }, bubbles: true, composed: true, cancelable: true });
    if (this.dispatchEvent(asked)) {
      history.pushState(null, "", url);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    }
  }

  // ------------------------------------------------------------------------------------------ racks (#115)

  /** Show a rack's front view (a tap on it in 2D or 3D; the 2D / 3D bundle draws it, so the main bundle stays small), on a tapped gear's details (#119). */
  private showRackView(furnitureId: string, draw: RackDraw, slot: string | null = null): void {
    this._rackView = { id: furnitureId, draw, slot };
  }

  private closeRackView(): void {
    this._rackView = null;
  }

  /** The open rack: its item, or undefined when none is open or it is gone. */
  private rackViewItem(): Furniture | undefined {
    const open = this._rackView;
    return open ? this.building?.floors.flatMap((fl) => fl.furniture).find((o) => o.id === open.id) : undefined;
  }

  /** The open rack's front view; null when none is open or the rack is gone. Drawn once per rack, name, language and LED colours. */
  private rackViewOf(): RackView | null {
    const open = this._rackView;
    const f = this.rackViewItem();
    if (!open || !f) return null;
    const lang = this.hass?.language ?? "en";
    const name = f.name || furnitureName(this.hass, f.type);
    // the LEDs (#119): a state change redraws the open view only when a colour changes
    const status = new Map((f.rack?.slots ?? []).map((s) => [s.id, this.hass ? slotStatus(this.hass, s) : null]));
    const key = JSON.stringify([open.id, name, lang, [...status]]);
    if (this.rackViewMemo?.key !== key || this.rackViewMemo.draw !== open.draw) {
      const el = open.draw((s, item) => s.name || packItemName(item, lang), name, (s) => status.get(s.id) ?? null);
      this.rackViewMemo = { key, draw: open.draw, view: { ...el, name } };
    }
    return this.rackViewMemo.view;
  }

  /** A tap in the front view on gear (its slot id, from the drawing's data-slot): its details (#119). */
  private tapRackDrawing(slot: string | null): void {
    if (this._rackView && slot) this._rackView = { ...this._rackView, slot };
  }

  /** HA's more-info for one of the gear's entities (#119). */
  private openRackEntity(id: string): void {
    openMoreInfo(this, id);
  }

  /** The chosen gear's details (#119): its status and its linked entities with their states, each opening more-info. Read-only for everyone. */
  private renderRackDetail(hass: HomeAssistant, f: Furniture) {
    const slot = f.rack?.slots.find((s) => s.id === this._rackView?.slot);
    if (!slot) return nothing;
    const t = (k: I18nKey) => translate(hass, k);
    const status = slotStatus(hass, slot);
    const ids = slotEntities(slot);
    const name = slot.name || furnitureName(hass, slot.type);
    return html`<section class="fp3d-rack-detail">
      <b>${status ? html`<i class="fp3d-rack-led" style="background:${RACK_STATUS_COLOURS[status]}"></i>` : nothing}${name}${status ? html` · ${t(`rack_status_${status}`)}` : nothing}</b>
      ${ids.length
        ? ids.map((id) => html`<button class="fp3d-rack-entity" @click=${() => this.openRackEntity(id)}><span>${entityName(hass, id)}</span><span>${stateText(hass, hass.states[id])}</span></button>`)
        : html`<p>${t("rack_unlinked")}</p>`}
    </section>`;
  }

  /** The rack's front view over the plan: readable on a wall tablet, scrolls when the rack is tall; tap gear for its details (#119). */
  private renderRackView() {
    const hass = this.hass;
    const view = hass ? this.rackViewOf() : null;
    const f = this.rackViewItem();
    if (!hass || !view || !f) return nothing;
    const close = () => this.closeRackView();
    const tap = (e: Event) => this.tapRackDrawing((e.target as Element | null)?.closest?.("[data-slot]")?.getAttribute("data-slot") ?? null);
    return html`<div class="fp3d-sheet-backdrop" @click=${close}></div>
      <div class="fp3d-sheet fp3d-rack-view" role="dialog" aria-label=${view.name}>
        <header>
          <b>▤ ${view.name}</b>
          <button class="fp3d-sheet-x" aria-label=${translate(hass, "close")} @click=${close}>✕</button>
        </header>
        <p class="fp3d-rack-view-used">${translate(hass, "rack_front_view")} · ${translate(hass, "rack_used", { used: view.used, u: view.u })}</p>
        ${this.renderRackDetail(hass, f)}
        <div class="fp3d-rack-view-box" @click=${tap}>${unsafeHTML(view.svg)}</div>
      </div>`;
  }

  private renderNote() {
    return this._note ? html`<div class="fp3d-note" role="status">${this._note}</div>` : nothing;
  }

  private spokenAlerts(hass: HomeAssistant, b: Building): SpokenAlert[] {
    const rooms = new Map(b.floors.flatMap((f) => zonesOf(f).map((r) => [r.id, r.name] as const)));
    return this._alerts.map((a) => ({ kind: a.kind, entity: a.entity, name: entityName(hass, a.entity), ...(a.text ? { text: a.text } : {}), room: a.roomId ? (rooms.get(a.roomId) ?? null) : null, floorId: a.floorId, roomId: a.roomId }));
  }

  /** Cars: every parking spot with a car, as its card shows it. */
  private spokenCars(hass: HomeAssistant, b: Building): SpokenCar[] {
    const out: SpokenCar[] = [];
    for (const floor of b.floors) {
      for (const f of floor.furniture) {
        if (f.type !== "parking" || !f.car) continue;
        const vehicle = parkedVehicle(hass, f);
        const car = carState(hass, f);
        const st = car.entities.tracker ? hass.states[car.entities.tracker] : undefined;
        const present = !!vehicle && !(st && !PRESENT_STATES.has(st.state.toLowerCase()));
        out.push({ name: f.name || (vehicle ? furnitureName(hass, vehicle) : furnitureName(hass, "car")), spot: f.id, floorId: floor.id, present, away: car.away, soc: car.soc, range: car.range, rangeUnit: car.rangeUnit, charging: car.charging, chargingW: car.chargingW, plugged: car.plugged, locked: car.locked });
      }
    }
    return out;
  }

  private renderSwipe() {
    const s = this._swipe;
    if (!s || !this.hass) return nothing;
    const off = s.kind === "light" && s.value <= 0;
    return html`<div class="fp3d-swipe" style="left:${s.x}px;top:${s.y}px">
      <span>${entityName(this.hass, s.entity)}</span>
      <b>${off ? translate(this.hass, "swipe_off") : `${s.value} %`}</b>
      <i><em style="height:${s.value}%"></em></i>
    </div>`;
  }

  /** Look through a placed camera: the view flies into it and its live picture lies over the 3D view. */
  lookThrough(entityId: string): void {
    const v = this.viewer;
    const b = this.building;
    // the 2D plan has no camera to look through (its camera pictures open from the menu)
    if (!v || !b || this.ro || this.plan2d) return;
    const floorId = b.floors.find((f) => f.placements.some((p) => p.entity_id === entityId))?.id;
    if (!floorId) return;
    this._menu = null;
    if (!this._through) this._through = { entity: entityId, back: v.getView(), ready: false };
    else this._through = { ...this._through, entity: entityId, ready: false };
    this.watchCameras(true);
    // another floor first opens (its own flight must not win over ours)
    const wait = this.floorId === floorId ? 0 : 300;
    if (wait) {
      this.throughFloor = floorId;
      this.fire("floor-tap", { floorId });
    }
    setTimeout(() => {
      if (this._through?.entity === entityId && !this.viewer?.lookThrough(entityId)) this._through = null;
    }, wait);
    // the picture comes when the flight has arrived, also when it was loaded before
    setTimeout(() => {
      if (this._through?.entity === entityId) this._through = { ...this._through, ready: true };
    }, wait + 950);
  }

  private endThrough(): void {
    const t = this._through;
    if (!t) return;
    this._through = null;
    // the stream player goes with the look (the camera wall makes its own when it opens)
    if (this.live?.id === t.entity) this.live = null;
    this.viewer?.endLook();
    this.viewer?.flyTo(t.back);
    if (this.throughWall) {
      this.throughWall = false;
      this.dispatchEvent(new CustomEvent("camera-wall-open", { bubbles: true, composed: true }));
    }
  }

  /** Loads the wall's window logic once; it attaches to the wall element after the next render. */
  private loadWallWin(): void {
    if (this.wallWin || this.wallWinLoading) return;
    this.wallWinLoading = true;
    void import("../float-window.ts").then((m) => {
      this.wallWin = new m.WallWindow(() => !!matchMedia?.(PHONE_MEDIA).matches);
      this.requestUpdate();
    });
  }

  /** The wall's header: drag to move, double click to put it back (#314). */
  private wallHeadEvents() {
    return {
      down: (e: PointerEvent) => this.wallWin?.begin(e, "move"),
      move: (e: PointerEvent) => this.wallWin?.move(e),
      up: () => this.wallWin?.end(),
      reset: (e: MouseEvent) => {
        if (!(e.target as HTMLElement).closest("button")) this.wallWin?.reset();
      },
    };
  }

  /** Edges and corners of the wall to resize by (hidden on a phone, where the wall is a sheet). */
  private renderWallGrips() {
    return (["n", "s", "e", "w", "ne", "nw", "se", "sw"] as Grip[]).map(
      (g) => html`<div class="fp3d-wall-rz fp3d-wall-rz-${g}" @pointerdown=${(e: PointerEvent) => this.wallWin?.begin(e, g)} @pointermove=${(e: PointerEvent) => this.wallWin?.move(e)} @pointerup=${() => this.wallWin?.end()} @pointercancel=${() => this.wallWin?.end()}></div>`,
    );
  }

  /** Kamera-Cockpit: the camera wall – every placed camera's picture, refreshed every few seconds; a tap looks through it. */
  private renderCameraWall() {
    if (!this.cameraWall || !this.hass || !this.building || this.ro) return nothing;
    const hass = this.hass;
    const close = () => {
      this._wallBig = null;
      this.live = null;
      this.dispatchEvent(new CustomEvent("camera-wall-close", { bubbles: true, composed: true }));
    };
    const cameras = [...new Set(this.building.floors.flatMap((f) => f.placements.map((p) => p.entity_id)).filter((id) => kindOf(id) === "camera"))];
    this.watchCameras(true);
    this.loadWallWin();
    const hd = this.wallHeadEvents();
    const srcOf = (id: string) => {
      const st = hass.states[id];
      const picture = st?.attributes.entity_picture as string | undefined;
      return picture && st && !isUnavailable(st) ? (picture.startsWith("data:") ? picture : `${picture}${picture.includes("?") ? "&" : "?"}fp3d=${this.cameraTick}`) : null;
    };
    const name = (id: string) => {
      const st = hass.states[id];
      return html`${entityName(hass, id)}${st?.state === "recording" ? html` <b>● ${translate(hass, "state_recording")}</b>` : nothing}`;
    };
    // one camera big: its live picture fills the wall; from here the view can look through the camera,
    // and "back to the view" brings the wall back
    const big = this._wallBig && cameras.includes(this._wallBig) ? this._wallBig : null;
    if (big) {
      const src = srcOf(big);
      const stream = this.liveFor(big);
      const look = () => {
        this.throughWall = true;
        close();
        this.lookThrough(big);
      };
      return html`<div class="fp3d-wall">
        <div class="fp3d-wall-head" title=${translate(hass, "camera_wall_move")} @pointerdown=${hd.down} @pointermove=${hd.move} @pointerup=${hd.up} @pointercancel=${hd.up} @dblclick=${hd.reset}>
          <button
            class="fp3d-chip"
            @click=${() => {
              this._wallBig = null;
              this.live = null;
            }}
          >
            ‹ ${translate(hass, "camera_wall_all")}
          </button>
          <span class="fp3d-wall-title">${name(big)}</span>
          <span class="fp3d-wall-tools"><button class="fp3d-chip" @click=${look}>${translate(hass, "through_camera")}</button><button class="fp3d-chip" aria-label="✕" @click=${close}>✕</button></span>
        </div>
        <div class="fp3d-wall-big">${stream ?? (src ? html`<img src=${src} alt="" />` : html`<div class="fp3d-wall-none">${translate(hass, "state_unavailable")}</div>`)}</div>
        ${this.renderWallGrips()}
      </div>`;
    }
    // the grid's own size from the last render; on the first one an estimate, measured right after
    const grid = this.renderRoot.querySelector<HTMLElement>(".fp3d-wall-grid");
    if (!grid) requestAnimationFrame(() => this.requestUpdate());
    const { cols, tile } = wallLayout(cameras.length, grid?.clientWidth ?? this.clientWidth - 48, grid?.clientHeight ?? this.clientHeight - 160);
    return html`<div class="fp3d-wall">
      <div class="fp3d-wall-head" title=${translate(hass, "camera_wall_move")} @pointerdown=${hd.down} @pointermove=${hd.move} @pointerup=${hd.up} @pointercancel=${hd.up} @dblclick=${hd.reset}>
        <span>${translate(hass, "camera_wall_title")} · ${cameras.length} <span class="fp3d-still">${translate(hass, "camera_still", { s: this._low ? 10 : 5 })}</span></span>
        <span class="fp3d-wall-tools"><button class="fp3d-chip" aria-label="✕" @click=${close}>✕</button></span>
      </div>
      <div class="fp3d-wall-grid" style="grid-template-columns: repeat(${cols}, ${tile}px); grid-auto-rows: ${Math.round((tile * 9) / 16)}px">
        ${cameras.map((id) => {
          const src = srcOf(id);
          const seen = cameraMotionSensors(hass, id).some((s) => hass.states[s]?.state === "on");
          return html`<button class="fp3d-wall-cam ${seen ? "fp3d-wall-seen" : ""}" title=${translate(hass, "camera_wall_big")} @click=${() => (this._wallBig = id)}>
            ${src ? html`<img src=${src} alt="" />` : html`<div class="fp3d-wall-none">${translate(hass, "state_unavailable")}</div>`}
            <span class="fp3d-wall-name">${name(id)}</span>
          </button>`;
        })}
      </div>
      ${this.renderWallGrips()}
    </div>`;
  }

  /**
   * The live stream of a camera through Home Assistant's own player (HLS or WebRTC, whatever the camera
   * offers): a picture-entity card in live view, created once per camera. Null while it loads or when the
   * helpers are missing (the preview, an old frontend) – then the snapshot stays.
   */
  private liveFor(id: string): HTMLElement | null {
    if (this.live?.id !== id) {
      const mine = { id, el: null as (HTMLElement & { hass?: unknown }) | null, failed: false };
      this.live = mine;
      const w = window as unknown as { loadCardHelpers?: () => Promise<{ createCardElement: (c: unknown) => HTMLElement & { hass?: unknown } }> };
      if (!w.loadCardHelpers) mine.failed = true;
      else
        w.loadCardHelpers()
          .then((h) => {
            if (this.live !== mine) return;
            const el = h.createCardElement({ type: "picture-entity", entity: id, camera_view: "live", show_name: false, show_state: false, tap_action: { action: "none" }, hold_action: { action: "none" } });
            el.hass = this.hass;
            mine.el = el;
            this.requestUpdate();
          })
          .catch(() => {
            mine.failed = true;
            this.requestUpdate();
          });
    }
    return this.live.el;
  }

  private renderThrough() {
    const t = this._through;
    if (!t || !this.hass) return nothing;
    const st = this.hass.states[t.entity];
    const picture = st?.attributes.entity_picture as string | undefined;
    const src = picture && !isUnavailable(st) ? (picture.startsWith("data:") ? picture : `${picture}${picture.includes("?") ? "&" : "?"}fp3d=${this.cameraTick}`) : null;
    // the live stream when it is switched on (D589), the still until the player is there or when it fails
    const stream = this.building?.settings.director?.live ? this.liveFor(t.entity) : null;
    return html`<div class="fp3d-through" style="--fp3d-blend:${this._blend}">
      ${!t.ready ? nothing : stream ? html`<div class="fp3d-through-img fp3d-through-live">${stream}</div>` : src ? html`<img class="fp3d-through-img" src=${src} alt="" />` : nothing}
      <div class="fp3d-through-bar">
        <span class="fp3d-through-name">${entityName(this.hass, t.entity)}</span>
        <span class="fp3d-still">${stream ? "● Live" : translate(this.hass, "camera_still", { s: this._low ? 10 : 5 })}</span>
        <input
          type="range"
          min="0"
          max="100"
          .value=${String(Math.round(this._blend * 100))}
          aria-label=${translate(this.hass, "through_blend")}
          @input=${(e: Event) => (this._blend = Number((e.target as HTMLInputElement).value) / 100)}
        />
        <button class="fp3d-chip" title=${translate(this.hass, "through_full_hint")} @click=${() => this.throughFull(t.entity)}>${uiIcon("expand")} ${translate(this.hass, "through_full")}</button>
        <button class="fp3d-chip" @click=${() => this.endThrough()}>${translate(this.hass, "through_back")}</button>
      </div>
    </div>`;
  }

  /**
   * The camera's picture on the whole screen (idea from dlavrantonis' fork); where the browser cannot (old tablet
   * WebViews), Home Assistant's own camera view opens instead – it also has the sound.
   */
  private throughFull(entity: string): void {
    const el = this.renderRoot.querySelector(".fp3d-through-img") as (HTMLElement & { requestFullscreen?: () => Promise<void> }) | null;
    if (el && typeof el.requestFullscreen === "function") el.requestFullscreen().catch(() => openMoreInfo(this, entity));
    else openMoreInfo(this, entity);
  }

  /** Hides a TV's card on this device, or brings it back (#281). */
  private hideTvCard(id: string): void {
    this.tvHidden.add(id);
    writeTvHidden(this.tvHidden);
    this.syncDevices(true);
  }

  private showTvCard(id: string): void {
    this.tvHidden.delete(id);
    writeTvHidden(this.tvHidden);
    this.syncDevices(true);
  }

  /** Opens the device popup beside the pin (the quick menu and the details give way). */
  private openPopup(entity: string, x: number, y: number, hover = false): void {
    clearTimeout(this.popupTimer);
    if (!hover) this._menu = null;
    need(loadDevicePopup);
    this._popup = { entity, x, y, hover };
  }

  /** A mouse over a camera's pin (#284): after a short moment its live picture floats beside it; leaving closes it (and the stream). */
  private onPinOver = (e: PointerEvent): void => {
    if (e.pointerType !== "mouse" || this.ro) return;
    const pin = (e.target as Element | null)?.closest?.(".fp3d-dev[data-entity]") as HTMLElement | null;
    const id = pin?.dataset.entity;
    if (!pin || !id || popupKind(id) !== "camera" || (this._popup && !this._popup.hover)) return;
    clearTimeout(this.popupTimer);
    this.popupTimer = setTimeout(() => {
      const stage = this.renderRoot.querySelector(".fp3d-stage") as HTMLElement | null;
      if (!stage || !this.hass?.states[id] || (this._popup && !this._popup.hover)) return;
      const r = pin.getBoundingClientRect();
      const h = stage.getBoundingClientRect();
      this.openPopup(id, r.left + r.width / 2 - h.left, r.top - h.top, true);
    }, 250);
  };

  /** The mouse resting on a camera drawn as a model (#273 #284, it has no pin): its live picture floats beside it, as over a pin. */
  private onModelHover(id: string | null, x: number, y: number): void {
    if (this.ro || (this._popup && !this._popup.hover)) return;
    const camera = !!id && popupKind(id) === "camera" && !!this.hass?.states[id];
    // leaving a model (onto its pin too) closes only what the model opened: a pin's own preview stays
    if (this.modelHover) {
      clearTimeout(this.popupTimer);
      if (this._popup?.hover && this._popup.entity === this.modelHover) this._popup = null;
      this.modelHover = null;
    }
    if (!camera || !id) return;
    this.modelHover = id;
    this.popupTimer = setTimeout(() => {
      if (!this._popup || this._popup.hover) this.openPopup(id, x, y - 12, true);
    }, 250);
  }

  /** The camera model the mouse rests on (its preview is the model's, not a pin's). */
  private modelHover: string | null = null;

  private onPinOut = (e: PointerEvent): void => {
    if (e.pointerType !== "mouse") return;
    const pin = (e.target as Element | null)?.closest?.(".fp3d-dev[data-entity]");
    if (!pin || pin.contains(e.relatedTarget as Node | null)) return;
    clearTimeout(this.popupTimer);
    if (this._popup?.hover) this._popup = null;
  };

  private renderPopup() {
    const p = this._popup;
    if (!p || !this.hass || this.ro) return nothing;
    const stage = this.renderRoot.querySelector(".fp3d-stage") as HTMLElement | null;
    const camera = popupKind(p.entity) === "camera";
    const pos = popupPosition(p.x, p.y, camera ? 320 : 252, camera ? (p.hover ? 230 : 270) : 330, stage?.clientWidth ?? 800, stage?.clientHeight ?? 600);
    return html`${p.hover ? nothing : html`<div class="fp3d-menu-backdrop" @click=${() => (this._popup = null)}></div>`}
      <fp3d-device-popup
        style="left:${pos.left}px;top:${pos.top}px"
        mode=${p.hover ? "hover" : "card"}
        ?low=${this._low}
        ?noLook=${this.plan2d}
        .hass=${this.rawHass}
        .entity=${p.entity}
        @close=${() => (this._popup = null)}
        @camera-look=${(e: CustomEvent<{ entity: string }>) => {
          this._popup = null;
          this.lookThrough(e.detail.entity);
        }}
      ></fp3d-device-popup>`;
  }

  private renderMenu() {
    const m = this._menu;
    if (!m || !this.hass || this.ro) return nothing;
    const stage = this.renderRoot.querySelector(".fp3d-stage") as HTMLElement | null;
    const w = stage?.clientWidth ?? 800;
    const h = stage?.clientHeight ?? 600;
    const left = Math.max(8, Math.min(w - 240, m.x - 116));
    const top = Math.max(8, Math.min(h - 360, m.y - 170));
    need(loadQuickMenu);
    return html`<div class="fp3d-menu-backdrop" @click=${() => (this._menu = null)}></div>
      <fp3d-quick-menu
        style="left:${left}px;top:${top}px"
        ?low=${this._low}
        .hass=${this.rawHass}
        .entity=${m.entity}
        .car=${m.car ?? null}
        ?doorLock=${!!m.doorLock}
        .presets=${this.building?.settings.media_presets ?? []}
        ?confirmSwitch=${this.confirmSet.has(m.entity)}
        ?slatInvert=${slatsInverted(this.building, m.entity)}
        ?noLook=${this.plan2d}
        @close=${() => (this._menu = null)}
        @camera-look=${(e: CustomEvent<{ entity: string }>) => this.lookThrough(e.detail.entity)}
      ></fp3d-quick-menu>`;
  }

  /** A module's markers as device pins: its symbol on the item (or at its point), its state under it. */
  private moduleMarkers(b: Building): DeviceMarker[] {
    const out: DeviceMarker[] = [];
    for (const m of this.scene) {
      if (m.kind !== "marker") continue;
      const floor = b.floors.find((f) => f.id === m.floorId);
      const f = m.furnitureId ? floor?.furniture.find((x) => x.id === m.furnitureId) : undefined;
      if (!floor || (!f && !m.at)) continue;
      const [x, z] = f ? [f.x, f.z] : (m.at as [number, number]);
      const path = markerPath(m.path);
      const emoji = markerEmoji(m.emoji);
      out.push({
        id: `module:${m.id}`,
        floorId: floor.id,
        roomId: floor.rooms.find((r) => r.points.length >= 3 && pointInPolygon([x, z], r.points))?.id ?? null,
        x,
        z,
        y: m.y ?? (f ? mountBase(floor, f) + f.h * 0.6 : 1.2),
        icon: emoji
          ? `<span style="font-size:18px;line-height:1" aria-hidden="true">${emoji}</span>`
          : path
            ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`
            : "",
        name: m.name,
        text: m.text ?? "",
        active: !!m.active && !this.dimmed,
        unavailable: false,
        glow: m.color && m.active && !this.dimmed ? { color: m.color, level: 1 } : null,
        pin: true,
        full: true,
        ...(f ? { furnitureId: f.id } : {}),
      });
    }
    return out;
  }

  /** A module marker tapped: its card unfolds and lights up for a moment, the view flies to the item; or its sheet opens. */
  private openModuleCard(markerId: string): void {
    const m = this.scene.find((p): p is Extract<ScenePiece, { kind: "marker" }> => p.kind === "marker" && p.id === markerId);
    if (!m) return;
    if (m.sheet) {
      this.openRoomSheet(m.sheet.roomId, m.sheet.id);
      return;
    }
    if (m.card) {
      this.mediaFolded.delete(m.card);
      this.cardPing = m.card;
      clearTimeout(this.cardPingTimer);
      this.cardPingTimer = setTimeout(() => {
        this.cardPing = null;
        this.requestUpdate();
      }, 2600);
      this.requestUpdate();
    }
    const floor = this.building?.floors.find((f) => f.id === m.floorId);
    const f = floor?.furniture.find((x) => x.id === m.furnitureId);
    if (floor && f) this.viewer?.focus(floor.id, f.x, f.z, mountBase(floor, f) + f.h * 0.6, `module:${m.id}`);
  }

  /** A tap on a device or item: its own tap / double-tap action (#6), else what it does by its kind. */
  private onDeviceTap(entityId: string, x = 0, y = 0): void {
    // "switch devices only in the opened room" (#454): a device of another room opens that room and switches nothing
    const other = this.elsewhere(entityId);
    if (other) return void this.fire("room-tap", { floorId: other.floorId, roomId: other.roomId });
    // a click on a TV whose card is hidden brings the card back (#281)
    if (this.tvHidden.has(entityId)) return this.showTvCard(entityId);
    const owner = this.ro ? undefined : this.actionOwners.get(entityId);
    if (!owner) return this.defaultTap(entityId, x, y);
    const double = gestureAction(owner, "double_tap");
    this.taps.tap(
      entityId,
      !!double,
      () => {
        const own = gestureAction(owner, "tap");
        if (own) this.runOwnAction(own, owner, x, y);
        else this.defaultTap(entityId, x, y);
      },
      () => double && this.runOwnAction(double, owner, x, y),
    );
  }

  private whereInput: WhereInput | null = null;
  private whereCache: WhereIndex | null = null;

  /** Where a tap on this device goes instead (#454): its room, when this device keeps the setting on and it lies elsewhere. */
  private elsewhere(entityId: string): Where | null {
    if (this.furnish || !this.roomId || !tapInRoomOn() || !this.whereInput) return null;
    this.whereCache ??= buildWhere(this.whereInput);
    return elsewhere(this.whereCache, entityId, this.roomId, true);
  }

  /** Run an own action; one that asks first asks in the app's own dialog. */
  private runOwnAction(action: ItemAction, owner: ActionOwner, x: number, y: number): void {
    const hass = this.hass;
    if (!hass) return;
    void runItemAction(action, owner.entity, {
      callService: (domain, service, data) => (safeCall(hass, domain, service, data), Promise.resolve()),
      moreInfo: (id) => openMoreInfo(this, id),
      camera: (id) => (this._menu = { entity: id, x, y }),
      navigate: (path) => {
        history.pushState(null, "", path);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      },
      openUrl: (url) => void window.open(url, "_blank", "noopener,noreferrer"),
      ownHost: location.host,
      externalText: (host) => translate(hass, "action_external_ask", { host }),
      confirm: (text) => this.ask(text ?? translate(hass, "action_confirm_default", { name: owner.entity ? entityName(hass, owner.entity) : translate(hass, "action_this_item") })),
    }).catch((err: unknown) => this.showNote(translate(hass, "action_failed", { error: err instanceof Error ? err.message : String(err) })));
  }

  /** A yes / no question in the app's own dialog (#59); true for yes. */
  private ask(text: string): Promise<boolean> {
    return askConfirm(text, { ok: translate(this.hass, "action_confirm_ok"), cancel: translate(this.hass, "cancel") });
  }

  /** Asks first for devices marked so ("ask before switching"). */
  private async confirmFor(id: string): Promise<boolean> {
    return !this.confirmSet.has(id) || (await this.ask(translate(this.hass, "confirm_switch", { name: entityName(this.hass, id) })));
  }

  /** What a tap does by the device's kind (no own action). */
  private defaultTap(entityId: string, x = 0, y = 0): void {
    // an item that is only tappable for its own actions (no tap action of its own)
    if (entityId.startsWith("item:")) return;
    // trail pins and lamps without a light are drawn, but nothing of Home Assistant stands behind them
    if (entityId.startsWith("trail:") || entityId.startsWith("lamp:")) return;
    if (entityId.startsWith("module:")) return this.openModuleCard(entityId.slice(7));
    if (entityId.startsWith("opening:")) return this.onOpeningTap(entityId.slice(8), x, y, false);
    // a wall switch or socket: one entity is switched right away, several open the frame's menu
    if (entityId.startsWith("gangs:")) {
      const fid = entityId.slice(6);
      const f = this.building?.floors.flatMap((x) => x.furniture).find((x) => x.id === fid);
      if (!f) return;
      const ids = gangEntities(f);
      if (ids.length === 1) return this.onDeviceTap(ids[0], x, y);
      if (ids.length > 1) {
        this._gangMenu = { furnitureId: fid, x, y };
        return;
      }
      // only power sensors: their details
      const pw = gangsOf(f).find((g) => g.power && g.power !== "none")?.power;
      if (pw) {
        if (this.ro) this.showInfo(pw, x, y);
        else openMoreInfo(this, pw);
      }
      return;
    }
    // Household: a bin shows its next pickups; a mailbox's or a plant's pin opens its sensor
    if (entityId.startsWith("hh:")) {
      const [id, furnitureId] = entityId.slice(3).split("#");
      const bin = this.building?.floors.flatMap((f) => f.furniture).find((f) => f.id === furnitureId && f.type === "waste_bin");
      if (bin) {
        this._binInfo = { furnitureId, x, y };
        clearTimeout(this.binInfoTimer);
        this.binInfoTimer = setTimeout(() => (this._binInfo = null), 6000);
      } else if (this.ro) this.showInfo(id, x, y);
      else openMoreInfo(this, id);
      return;
    }
    if (this.ro) {
      const b = this.building;
      const grid = b ? (b.energy.grid ?? deviceSensors(b, (f) => this.furnitureLinks?.get(f.id)?.power ?? null).grid) : null;
      const id = entityId === "grid" ? grid : entityId.startsWith("detect:") ? entityId.slice(7) : entityId;
      if (id) this.showInfo(id, x, y);
      return;
    }
    // the street end of the grid cable opens the grid sensor: the balance's, else the meter's (#223)
    if (entityId === "grid") {
      const b = this.building;
      const sensor = b ? (b.energy.grid ?? deviceSensors(b, (f) => this.furnitureLinks?.get(f.id)?.power ?? null).grid) : null;
      if (sensor) openMoreInfo(this, sensor);
      return;
    }
    // a detection pin opens its sensor
    if (entityId.startsWith("detect:")) {
      openMoreInfo(this, entityId.slice(7));
      return;
    }
    // a 3D printer with a camera shows its picture (#11)
    const printerCam = this.printerCams.get(entityId);
    if (printerCam) {
      this._menu = { entity: printerCam, x, y };
      return;
    }
    // a robot vacuum (#271) and a camera (#284, it plays at once) open their card
    if ((popupKind(entityId) === "vacuum" || popupKind(entityId) === "camera") && this.hass?.states[entityId]) return this.openPopup(entityId, x, y);
    const kind = kindOf(entityId);
    // blinds have no single on/off: a tap opens their quick menu (up, positions, stop, down)
    if (kind === "cover" || kind === "camera") {
      this._menu = { entity: entityId, x, y };
      return;
    }
    if (kind && TOGGLE_KINDS.has(kind)) {
      void this.confirmFor(entityId).then((yes) => yes && toggleEntity(this.hass, entityId));
    } else openMoreInfo(this, entityId);
  }

  /**
   * A tap on a door with a smart lock: its menu offers to lock or unlock (asking first, #682). A tap on a garage door
   * driven by a pulse switch or button presses it – asking first when the door is marked so (#677); a long press
   * opens the drive's details.
   */
  private onOpeningTap(openingId: string, x: number, y: number, hold: boolean): void {
    const e = this.openingLinks?.get(openingId);
    if (!e || !this.hass) return;
    if (e.lock && !e.cover) {
      if (this.ro) this.showInfo(e.lock, x, y);
      else this._menu = { entity: e.lock, x, y, doorLock: true };
      return;
    }
    const drive = e.cover;
    if (!drive) return;
    if (this.ro) {
      this.showInfo(e.contact ?? drive, x, y);
      return;
    }
    if (hold) {
      openMoreInfo(this, drive);
      return;
    }
    const st = this.hass.states[drive];
    if (!st || isUnavailable(st)) {
      openMoreInfo(this, drive);
      return;
    }
    // a pulse switch turns itself off again: it is only ever switched on; buttons are pressed
    const [domain] = drive.split(".");
    void this.confirmFor(drive).then((yes) => yes && safeCall(this.hass, domain, domain === "switch" ? "turn_on" : "press", { entity_id: drive }));
  }

  /** The look shown: the chosen one, by the sun for "auto" (Day above the horizon, Neon below), by the HA theme for "theme". */
  private effectiveTheme(): Theme {
    return this.effectiveStyle().base;
  }

  /** The style shown (#436): the chosen one, or the one the sun, the HA theme or the house's plan gives now. */
  private effectiveStyle(): StyleDef {
    if (this._stylePreview) return this._stylePreview;
    return styleById(shownStyle(this.theme, this.hass, this.building?.settings as StylePlan | undefined, new Date(), this.cardStyle())) ?? styleById("neon")!;
  }

  /**
   * The styles dialog's try-out (#441): shows a style (a built-in one, an own one or a draft not yet saved) in the house
   * for as long as the dialog is open; null puts the style of the screen back. Never stored.
   */
  previewStyle(style: StyleDef | null): void {
    this._stylePreview = style;
    this.viewer?.setStyle(this.effectiveStyle());
    if (this.viewer) this.syncDevices(true);
  }

  /** The card's evening and night styles and helper entity (#439), with the names a helper's state may use. */
  private cardStyle(): CardStyle | null {
    const override = liveOverride(this._styleOverride, Date.now());
    if (!this.themeEvening && !this.themeNight && !this.styleEntity && !override) return null;
    const names: Record<string, string[]> = {};
    // the entity's state is matched against localised names only while one is set
    if (this.styleEntity) for (const s of allStyles()) names[s.id] = [s.name ?? translate(this.hass, `style_${s.id}` as I18nKey)];
    return { evening: this.themeEvening, night: this.themeNight, entity: this.styleEntity, names, override };
  }

  /** Whether the style shown changes with hass alone: it follows the HA theme, the sun or the house plan, or the card names evening and night styles or a helper. */
  private followsClock(): boolean {
    return this.theme === "auto" || this.theme === "theme" || this.theme === "house" || !!this.themeEvening || !!this.themeNight || !!this.styleEntity;
  }

  /** The start view: the card's own, else the one remembered in the editor. */
  private startViewOf(): StartView | null {
    return this.startView ?? this.building?.settings.start_view ?? null;
  }

  /** The camera as it stands (for "remember this view as the start"). */
  currentView(): StartView | null {
    return this.viewer?.currentView() ?? null;
  }

  resetView(): void {
    this._through = null;
    this.viewer?.resetView();
  }

  private fire(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  /** Hide or show every hologram (the plants' and the devices'): with many devices the view gets crowded. */
  private toggleHolos(): void {
    this._holoShow = !this._holoShow;
    try {
      localStorage.setItem("home3d.holos", this._holoShow ? "1" : "0");
    } catch {
      // private mode: the choice lasts for this page only
    }
  }

  private holoVisible(): boolean {
    return this.holograms ?? this._holoShow;
  }

  /** Fold the energy row down to the Consumption tile, or unfold it again (#348). */
  private toggleEnergyFold(): void {
    this._energyFold = !this._energyFold;
    try {
      localStorage.setItem("home3d.energy_fold", this._energyFold ? "1" : "0");
    } catch {
      // private mode: the choice lasts for this page only
    }
  }

  private toggleFlows(): void {
    this._flows = !this._flows;
    try {
      localStorage.setItem("home3d.flows", this._flows ? "1" : "0");
    } catch {
      // private mode: the choice lasts for this page only
    }
    this.syncDevices(true);
  }

  private renderEnergy() {
    const e = this._energy;
    if (!e || this.roomId || !this.showEnergy) return nothing;
    const t = (k: Parameters<typeof translate>[1]) => translate(this.hass, k);
    const items: { cls: string; label: string; value: string }[] = [];
    if (e.consumption !== null) items.push({ cls: "total", label: t("energy_consumption"), value: formatPower(this.hass, e.consumption) });
    if (e.grid !== null) {
      const exporting = e.grid < 0;
      items.push({ cls: exporting ? "export" : "grid", label: t(exporting ? "energy_grid_export" : "energy_grid_import"), value: formatPower(this.hass, Math.abs(e.grid)) });
    }
    if (e.solar !== null) items.push({ cls: "solar", label: t("energy_solar"), value: formatPower(this.hass, e.solar) });
    if (e.battery !== null || e.soc !== null) {
      const parts = [e.battery !== null ? formatPower(this.hass, Math.abs(e.battery)) : null, e.soc !== null ? `${Math.round(e.soc)} %` : null].filter(Boolean);
      items.push({ cls: "battery", label: t("energy_battery"), value: parts.join(" · ") });
    }
    if (e.tariff) items.push({ cls: "tariff", label: t("energy_tariff"), value: `${formatNumber(this.hass, e.tariff.value, 3)} ${e.tariff.unit}`.trim() });
    if (this._costs) items.push({ cls: "cost", label: t(this._costs.net ? "energy_cost_net_today" : "energy_cost_today"), value: this._costs.value });
    // a tap on any tile folds the row to Consumption (the first tile when there is none) and a tap again unfolds it (#348)
    const foldable = items.length > 1;
    const folded = foldable && this._energyFold;
    const shown = folded ? items.slice(0, 1) : items;
    return html`<div class="fp3d-energy" aria-live="off">
      ${this._cheap && !folded ? html`<div class="fp3d-energy-item fp3d-energy-cheap" role="status"><span>${t("cheap_rate")}</span><b>${t("cheap_rate_now")}</b></div>` : nothing}
      ${shown.map((i) =>
        foldable
          ? html`<button type="button" class="fp3d-energy-item fp3d-energy-tile fp3d-energy-${i.cls} fp3d-energy-fold" aria-expanded=${!folded} title=${t(folded ? "energy_unfold" : "energy_fold")} @click=${() => this.toggleEnergyFold()}>
              <span>${i.label}</span><b>${i.value}</b>
            </button>`
          : html`<div class="fp3d-energy-item fp3d-energy-tile fp3d-energy-${i.cls}">
              <span>${i.label}</span><b>${i.value}</b>
            </div>`,
      )}
      ${this.flows !== null
        ? nothing
        : html`<button class="fp3d-energy-item fp3d-flow-toggle" aria-pressed=${this._flows} title=${`${t("flows_hint")} (${t(this._flows ? "flow_on" : "flow_off")})`} aria-label=${t("flows")} @click=${() => this.toggleFlows()}>
        <span>${t("flows")}</span><b>${uiIcon("flow")}</b>
      </button>`}
      ${this.holograms !== null || !this._holos.length
        ? nothing
        : html`<button class="fp3d-energy-item fp3d-flow-toggle" aria-pressed=${this._holoShow} title=${t("holos_hint")} aria-label=${t("holos")} @click=${() => this.toggleHolos()}>
        <span>${t("holos")}</span><b>${uiIcon("holo")}</b>
      </button>`}
    </div>`;
  }

  private renderLegend() {
    if (this.heatMode === "none" || this.heatMode === "values") return nothing;
    const scale = HEAT_SCALES[this.heatMode];
    // temperatures are coloured in °C and shown in Home Assistant's unit
    const temp = this.heatMode === "temperature";
    const lo = temp ? fromCelsius(this.hass, scale.stops[0][0]) : scale.stops[0][0];
    const hi = temp ? fromCelsius(this.hass, scale.stops[scale.stops.length - 1][0]) : scale.stops[scale.stops.length - 1][0];
    const unit = temp ? tempUnit(this.hass) : scale.unit;
    const t = (k: Parameters<typeof translate>[1]) => translate(this.hass, k);
    // a tap folds it to a slim bar with the range, and back (#310)
    const min = this._legendMin;
    return html`<button type="button" class="fp3d-legend${min ? " fp3d-legend-min" : ""}" aria-expanded=${min ? "false" : "true"} @click=${() => this.toggleLegend()}>
      <b class=${min ? "fp3d-sr-only" : ""}>${t(`heat_${this.heatMode}`)}</b>
      <span class="fp3d-legend-bar" style="background:${heatGradient(this.heatMode)}"></span>
      <span class="fp3d-legend-range"><span>${formatNumber(this.hass, lo, 0)} ${unit}</span><span>${formatNumber(this.hass, hi, 0)} ${unit}</span></span>
      ${this.heatValues.size || min ? nothing : html`<span class="fp3d-legend-none">${t("heat_none_found")}</span>`}
    </button>`;
  }

  private toggleLegend(): void {
    this._legendMin = !this._legendMin;
    try {
      localStorage.setItem("home3d.legendMin", this._legendMin ? "1" : "0");
    } catch {
      // private mode: the choice lasts for this page only
    }
  }

  /** The sky colour behind the house right now (night: deep blue-black, day: lighter and bluer, clouds in between). */
  /** The sun's way today at the home's place (worked out once a day), null without latitude and longitude. */
  private sunPathToday(hass: HomeAssistant): SunPath | null {
    const lat = hass.config?.latitude;
    const lon = hass.config?.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    const key = `${new Date().toDateString()},${lat},${lon}`;
    if (this.sunPathKey !== key) {
      this.sunPathKey = key;
      this.sunPathCache = sunPath(Date.now(), lat, lon);
    }
    return this.sunPathCache;
  }

  private skyColor(): [number, number, number] {
    // the realistic look's fog takes the horizon's colour
    if (this.effectiveTheme() === "realistic" && this._realSky) return this._realSky.horizon;
    // a style's own stage: the fog takes the colour of its gradient's top
    const bg = this.effectiveStyle().bg?.[0];
    if (bg && /^#[0-9a-f]{6}$/i.test(bg)) return [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16)) as [number, number, number];
    const stage = STAGE[this.effectiveTheme()] ?? STAGE.neon;
    const sky = this._sky;
    return stage.night[0].map((v, i) => Math.round(v + (stage.day[0][i] - v) * sky)) as [number, number, number];
  }

  /** While a storm is reported the stage flashes now and then. */
  private watchLightning(on: boolean): void {
    if (!on) {
      clearTimeout(this.flashTimer);
      this.flashTimer = undefined;
      return;
    }
    if (this.flashTimer) return;
    const next = () => {
      this.flashTimer = setTimeout(() => {
        if (!document.hidden) {
          this._flash = true;
          setTimeout(() => (this._flash = false), 140);
        }
        next();
      }, 5000 + Math.random() * 9000);
    };
    next();
  }

  protected render() {
    const sky = this._sky;
    const mix = (a: number[], b: number[]) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * sky)).join(",")})`;
    const stage = STAGE[this.effectiveTheme()] ?? STAGE.neon;
    // an own background (colour, gradient, picture) replaces the look's sky
    const real = this.effectiveTheme() === "realistic" ? this._realSky : null;
    const rgb = (c: readonly number[]) => `rgb(${c.join(",")})`;
    const bg = this.effectiveStyle().bg;
    const own = backdropCss(this.building?.settings.backdrop) ?? (real ? `linear-gradient(180deg, ${rgb(real.top)} 0%, ${rgb(real.horizon)} 62%, ${rgb(real.ground)} 100%)` : bg ? `linear-gradient(180deg, ${bg[0]} 0%, ${bg[1]} 100%)` : null);
    const pinK = this.pinSize === "small" ? 0.8 : this.pinSize === "large" ? 1.25 : 1;
    const style = `--fp3d-pin-k:${pinK};--fp3d-sky:${mix(stage.night[0], stage.day[0])};--fp3d-ground:${mix(stage.night[1], stage.day[1])}${own ? `;background:${own}` : ""}`;
    return html`<div
      @touchstart=${this.keepTouch}
      @touchmove=${this.keepTouch}
      @touchend=${this.keepTouch}
      @pointerover=${this.onPinOver}
      @pointerout=${this.onPinOut}
      class="fp3d-stage ${this.roomLabels ? "" : "fp3d-no-room-names"} ${this.pulse && !this._low ? "fp3d-pulse" : ""} ${this._low ? "fp3d-low" : ""} ${this.panelOpen ? "fp3d-panel-open" : ""} ${this.controlsRight ? "fp3d-side-right" : ""} ${this.findButtonShown() ? "" : "fp3d-no-find"} ${this._alerts.length ? "fp3d-has-alerts" : ""} ${this._through ? "fp3d-through-on" : ""} ${this._flash ? "fp3d-flash" : ""} ${this.replay ? "fp3d-replay" : ""}"
      style=${style}
    >
      ${this._error ? html`<p class="fp3d-error">${this._error}</p>` : nothing} ${this.clean ? nothing : this.renderEnergy()} ${this.renderHologram()} ${this.clean ? nothing : this.renderWires()} ${this.clean ? nothing : this.renderLegend()}
      ${this.renderClock()} ${this.renderAlerts()} ${this.clean || this._walk ? nothing : html`${this.renderHousehold()} ${this.renderThumbs()} ${this.renderScenes()} ${this.renderFind()} ${this.renderCentral()}`} ${this.clean ? nothing : this.renderWalk()} ${this.renderSwipe()} ${this.renderInfo()} ${this.renderBinInfo()} ${this.renderGangMenu()} ${this.renderThrough()} ${this.renderCameraWall()} ${this.renderSheet()} ${this.renderRackView()} ${this.renderNote()}
      ${this.renderMenu()} ${this.renderPopup()} ${this.renderViewNav()} ${this.renderEye()} ${this.renderRoomList()}
      ${this.renderMic()}
      ${this.pivotMark && !this._walk ? html`<span class="fp3d-pivot" aria-hidden="true"></span>` : nothing}
      ${this._micProbe && this.hass ? html`<fp3d-mic-probe .hass=${this.rawHass} .building=${this.building} @close=${() => ((this._micProbe = false), micProbeDone())}></fp3d-mic-probe>` : nothing}
      ${this.showStats && this._stats
        ? html`<span class="fp3d-stats"
            ><b>${this._stats.fps ? translate(this.hass, "stats_fps", { fps: this._stats.fps, ms: this._stats.worstMs }) : translate(this.hass, "stats_idle")}</b>
            ${this._stats.busy.length ? html`(${this._stats.busy.map((b) => translate(this.hass, `stats_busy_${b}` as I18nKey)).join(", ")})` : nothing} ·
            ${translate(this.hass, "stats", { calls: this._stats.calls, tris: this._stats.triangles.toLocaleString() })} ·
            ${translate(this.hass, this._stats.low ? "stats_low" : "stats_full", { r: formatNumber(this.hass, this._stats.pixelRatio, 2) })}${this.syncMs ? ` · sync ${formatNumber(this.hass, this.syncMs, 1)} ms` : ""}</span
          >`
        : nothing}
    </div>`;
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        display: block;
        position: relative;
        min-height: 200px;
      }
      /* a tag: light text on a solid dark plate, the bin's colour as its edge and a soft glow (coloured text – a
         blue paper bin's – was hard to read) */
      .fp3d-holo.fp3d-holo-bin {
        min-width: 0;
        width: auto;
        padding: 0;
        border-radius: 8px;
        pointer-events: none;
        border: 1.5px solid color-mix(in srgb, var(--bin) 85%, white);
        border-left-width: calc(6px * var(--fp3d-pin-k, 1));
        background: rgba(9, 13, 22, 0.94);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        box-shadow: 0 0 16px color-mix(in srgb, var(--bin) 50%, transparent), 0 2px 6px rgba(0, 0, 0, 0.5);
        color: #f5f8ff;
        text-shadow: none;
      }
      /* the tags of bins, mailboxes and plants follow the symbol size like the pins' labels (#645) */
      .fp3d-holo-bin .fp3d-holo-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        padding: calc(4px * var(--fp3d-pin-k, 1)) calc(10px * var(--fp3d-pin-k, 1));
        white-space: nowrap;
      }
      .fp3d-holo.fp3d-holo-later {
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
        border-color: color-mix(in srgb, var(--bin) 60%, #3a4252);
      }
      .fp3d-holo-bin b {
        font-size: calc(19px * var(--fp3d-pin-k, 1));
        font-weight: 700;
        line-height: 1.15;
        color: #ffffff;
      }
      .fp3d-holo-later b {
        font-weight: 600;
        color: #dfe5f0;
      }
      .fp3d-holo-bin span {
        font-size: calc(13px * var(--fp3d-pin-k, 1));
        line-height: 1.2;
        color: #cfd7e6;
      }
      /* put out already: a calm green edge, no glow */
      .fp3d-holo.fp3d-holo-out {
        border-color: #4ddf7a;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
      }
      .fp3d-holo-out b,
      .fp3d-holo-line-out b {
        color: #a8ffc2;
      }
      /* bins standing together: one plate, one line each in pickup order with its own colour edge */
      .fp3d-holo.fp3d-holo-bin.fp3d-holo-multi {
        border-color: rgba(190, 205, 230, 0.55);
        border-left-width: 1.5px;
      }
      .fp3d-holo-bin .fp3d-holo-lines {
        align-items: stretch;
        gap: calc(3px * var(--fp3d-pin-k, 1));
        padding: calc(5px * var(--fp3d-pin-k, 1)) calc(9px * var(--fp3d-pin-k, 1)) calc(5px * var(--fp3d-pin-k, 1)) calc(6px * var(--fp3d-pin-k, 1));
      }
      .fp3d-holo-line {
        display: flex;
        align-items: baseline;
        gap: calc(7px * var(--fp3d-pin-k, 1));
        border-left: calc(5px * var(--fp3d-pin-k, 1)) solid var(--bin);
        padding-left: calc(6px * var(--fp3d-pin-k, 1));
      }
      .fp3d-holo-line b {
        font-size: calc(16px * var(--fp3d-pin-k, 1));
      }
      .fp3d-holo-line-later b {
        font-weight: 600;
        color: #dfe5f0;
      }
      .fp3d-holo-line-later {
        border-left-color: color-mix(in srgb, var(--bin) 65%, #3a4252);
      }
      /* a mailbox's or a plant's tag from afar: a round symbol (the text comes back close up) */
      .fp3d-holo-sym {
        display: none;
      }
      .fp3d-holo.fp3d-holo-bin.fp3d-holo-far {
        border-radius: 50%;
        border-width: 2px;
      }
      .fp3d-holo-far .fp3d-holo-body {
        display: none;
      }
      .fp3d-holo-far .fp3d-holo-sym {
        display: flex;
        align-items: center;
        justify-content: center;
        width: calc(34px * var(--fp3d-pin-k, 1));
        height: calc(34px * var(--fp3d-pin-k, 1));
        color: #ffffff;
      }
      .fp3d-holo-far .fp3d-holo-sym svg {
        width: 62%;
        height: 62%;
      }
      .fp3d-holo-link[style*="--bin"] line,
      .fp3d-holo-link[style*="--bin"] circle {
        stroke: var(--bin);
      }
      .fp3d-gang-menu {
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 6;
      }
      .fp3d-gang-menu .fp3d-chip {
        text-align: left;
      }
      .fp3d-gang-menu .fp3d-gang-on {
        border-color: var(--fp3d-accent, #37e0ff);
        box-shadow: 0 0 10px rgba(55, 224, 255, 0.35);
      }
      .fp3d-gang-menu small {
        opacity: 0.7;
      }
      .fp3d-pivot {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 22px;
        height: 22px;
        margin: -11px 0 0 -11px;
        border: 1.5px solid color-mix(in srgb, var(--fp3d-accent, #37e0ff) 75%, transparent);
        border-radius: 50%;
        pointer-events: none;
        z-index: 2;
      }
      .fp3d-pivot::before,
      .fp3d-pivot::after {
        content: "";
        position: absolute;
        background: color-mix(in srgb, var(--fp3d-accent, #37e0ff) 75%, transparent);
      }
      .fp3d-pivot::before {
        left: 50%;
        top: -6px;
        bottom: -6px;
        width: 1.5px;
        margin-left: -0.75px;
      }
      .fp3d-pivot::after {
        top: 50%;
        left: -6px;
        right: -6px;
        height: 1.5px;
        margin-top: -0.75px;
      }
      /* two classes: the info bubbles' own rule (.fp3d-swipe, further down) lets taps through to the house and
         would win over a single class – this bubble has a button (#793) */
      .fp3d-swipe.fp3d-bin-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        cursor: pointer;
        pointer-events: auto;
      }
      .fp3d-swipe.fp3d-bin-info .fp3d-bin-out {
        pointer-events: auto;
      }
      .fp3d-bin-info small {
        opacity: 0.7;
        font-weight: 400;
      }
      .fp3d-bin-info .fp3d-bin-out {
        margin-top: 6px;
        padding: 7px 12px;
        border-radius: 999px;
        border: 1px solid rgba(190, 205, 230, 0.55);
        background: rgba(255, 255, 255, 0.08);
        color: #f5f8ff;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }
      .fp3d-bin-info .fp3d-bin-out-on {
        border-color: #4ddf7a;
        background: rgba(77, 223, 122, 0.16);
        color: #a8ffc2;
      }
      .fp3d-hh {
        position: absolute;
        right: 12px;
        top: 58px;
        z-index: 3;
        width: min(250px, calc(100% - 24px));
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        border-radius: 14px;
        background: var(--fp3d-s-chrome, rgba(10, 18, 34, 0.72));
        border: 1px solid rgba(110, 220, 255, 0.28);
        backdrop-filter: blur(8px);
        box-shadow: 0 6px 22px rgba(0, 0, 0, 0.35);
      }
      .fp3d-hh-folded {
        width: auto;
      }
      .fp3d-hh button {
        font: inherit;
        color: inherit;
        background: none;
        border: 0;
        text-align: left;
        cursor: pointer;
        border-radius: 9px;
      }
      .fp3d-hh-head {
        font-size: 12px;
        font-weight: 600;
        padding: 3px 6px;
        opacity: 0.9;
      }
      .fp3d-hh-head b {
        margin-left: 4px;
        color: var(--fp3d-accent, #37e0ff);
      }
      .fp3d-hh-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        padding: 5px 6px;
      }
      .fp3d-hh-row:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.06);
      }
      .fp3d-hh-row:disabled {
        cursor: default;
      }
      .fp3d-hh-hot .fp3d-hh-icon {
        color: #ffb547;
      }
      .fp3d-hh-icon {
        flex: none;
        display: inline-flex;
        color: var(--fp3d-accent, #37e0ff);
      }
      .fp3d-alert-banner {
        position: absolute;
        left: 50%;
        top: 10px;
        transform: translateX(-50%);
        display: flex;
        justify-content: center;
        gap: 6px;
        max-width: calc(100% - 24px);
        z-index: 4;
      }
      .fp3d-alert {
        flex: 0 1 auto;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 7px 14px 7px 12px;
        border: 0;
        border-left: 4px solid #ff3b4f;
        border-radius: 12px;
        background: var(--fp3d-chrome-solid);
        color: var(--fp3d-text);
        font: 600 13.5px var(--fp3d-font);
        box-shadow: 0 0 18px rgba(255, 59, 79, 0.35);
        cursor: pointer;
        animation: fp3d-alert-pulse 1.2s ease-in-out infinite;
      }
      /* a leak is red like its floor (#10); rain at a window stays blue */
      .fp3d-alert-window_rain {
        border-left-color: #4fb3ff;
        box-shadow: 0 0 18px rgba(79, 179, 255, 0.35);
      }
      .fp3d-alert-alarm_pending {
        border-left-color: #ffb547;
        box-shadow: 0 0 18px rgba(255, 181, 71, 0.35);
      }
      /* a warning with its dismiss button and choices (#138) */
      .fp3d-alert-item {
        position: relative;
        display: flex;
        flex: 0 1 auto;
        min-width: 0;
      }
      .fp3d-alert-dismissable .fp3d-alert {
        border-radius: 12px 0 0 12px;
        padding-right: 10px;
      }
      .fp3d-alert-x {
        flex: none;
        min-width: 36px;
        min-height: 34px;
        padding: 0 10px;
        border: 0;
        border-left: 1px solid rgba(127, 127, 127, 0.25);
        border-radius: 0 12px 12px 0;
        background: var(--fp3d-chrome-solid);
        color: var(--fp3d-muted);
        font: 600 13px var(--fp3d-font);
        cursor: pointer;
      }
      .fp3d-alert-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 150px;
        padding: 6px;
        border-radius: 12px;
        background: var(--fp3d-chrome-solid);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
        z-index: 5;
      }
      .fp3d-alert-menu button {
        min-height: 40px;
        padding: 0 14px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--fp3d-text);
        font: 600 13.5px var(--fp3d-font);
        text-align: left;
        cursor: pointer;
      }
      .fp3d-alert-menu button:hover,
      .fp3d-alert-menu button:focus-visible {
        background: rgba(127, 127, 127, 0.18);
      }
      .fp3d-alert-menu small {
        padding: 2px 14px 6px;
        max-width: 200px;
        color: var(--fp3d-muted);
        font-size: 12px;
        white-space: normal;
      }
      .fp3d-alert-more {
        align-self: center;
        color: var(--fp3d-muted);
        font-size: 13px;
      }
      @keyframes fp3d-alert-pulse {
        50% {
          box-shadow: 0 0 4px transparent;
        }
      }
      .fp3d-has-alerts .fp3d-energy {
        top: 58px;
      }
      .fp3d-scenes {
        position: absolute;
        left: 60px;
        right: 60px;
        bottom: calc(10px + var(--fp3d-bottom-inset, 0px));
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        z-index: 2;
        pointer-events: none;
      }
      .fp3d-scenes .fp3d-chip {
        pointer-events: auto;
      }
      @media (prefers-reduced-motion: reduce) {
        .fp3d-alert,
        .fp3d-dev-found {
          animation: none;
        }
      }
      .fp3d-stage {
        position: absolute;
        inset: 0;
        overflow: hidden;
        container-type: size;
        container-name: fp3d;
        background: radial-gradient(ellipse at 50% 35%, var(--fp3d-sky, var(--fp3d-bg2)), var(--fp3d-ground, var(--fp3d-bg)) 72%);
        transition: background 2s ease;
      }
      .fp3d-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
        touch-action: none;
        cursor: grab;
      }
      .fp3d-canvas:focus-visible {
        outline: 2px solid var(--fp3d-accent, #37e0ff);
        outline-offset: -3px;
      }
      /* the rooms as text (#195): hidden until the keyboard reaches them, then a small panel at the top left */
      .fp3d-sr-rooms {
        position: absolute;
        left: 12px;
        top: 12px;
        z-index: 7;
        max-height: calc(100% - 24px);
        max-width: min(420px, calc(100% - 24px));
        overflow: auto;
        padding: 6px;
        border-radius: 10px;
        background: var(--fp3d-chrome-solid);
        color: var(--fp3d-text, #e6f0ff);
      }
      .fp3d-sr-rooms:not(:focus-within) {
        width: 1px;
        height: 1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .fp3d-sr-rooms ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .fp3d-sr-rooms button {
        display: block;
        width: 100%;
        min-height: 36px;
        padding: 4px 10px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-sr-rooms button:focus-visible {
        outline: 2px solid var(--fp3d-accent, #37e0ff);
      }
      .fp3d-canvas:active {
        cursor: grabbing;
      }
      .fp3d-labels {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .fp3d-pin-info {
        display: grid;
        gap: 1px;
        text-align: center;
      }
      .fp3d-pin-info small {
        font-size: 11px;
        font-weight: 500;
        opacity: 0.9;
        font-variant-numeric: tabular-nums;
      }
      .fp3d-pin {
        position: absolute;
        left: 0;
        top: 0;
        pointer-events: auto;
        font: 600 12.5px var(--fp3d-title-font);
        color: var(--fp3d-text);
        background: var(--fp3d-chrome);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        padding: 5px 10px;
        cursor: pointer;
        white-space: nowrap;
        backdrop-filter: blur(6px);
        box-shadow: var(--fp3d-shadow);
      }
      .fp3d-pin-floor {
        display: grid;
        justify-items: start;
        gap: 1px;
        padding: 8px 14px;
        border-radius: 12px;
        background: var(--fp3d-accent);
        color: var(--fp3d-accent-text);
        border-color: transparent;
        box-shadow: 0 0 22px rgba(55, 224, 255, 0.28);
      }
      .fp3d-pin-floor b {
        font: 700 15px var(--fp3d-title-font);
        letter-spacing: -0.01em;
      }
      .fp3d-pin-floor span {
        font: 500 12px var(--fp3d-font);
        opacity: 0.78;
      }
      .fp3d-dev {
        position: absolute;
        left: 0;
        top: 0;
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px;
        border-radius: 999px;
        border: 1px solid var(--fp3d-line);
        background: var(--fp3d-chrome);
        color: var(--fp3d-muted);
        /* the symbol size (small 0.8, normal 1, large 1.25) scales the pin from inside, not its position */
        font: 600 calc(12px * var(--fp3d-pin-k, 1)) var(--fp3d-font);
        cursor: pointer;
        white-space: nowrap;
        backdrop-filter: blur(6px);
        touch-action: manipulation;
        -webkit-user-select: none;
        user-select: none;
        transition: opacity 0.2s ease;
      }
      .fp3d-dev-icon {
        display: grid;
        place-items: center;
        width: calc(24px * var(--fp3d-pin-k, 1));
        height: calc(24px * var(--fp3d-pin-k, 1));
        border-radius: 50%;
        background: rgba(91, 124, 255, 0.14);
      }
      .fp3d-dev-icon svg {
        width: calc(18px * var(--fp3d-pin-k, 1));
        height: calc(18px * var(--fp3d-pin-k, 1));
      }
      .fp3d-dev[data-entity^="trail:"] {
        padding: 2px 4px 2px 2px;
        font-size: 11px;
        border-color: rgba(55, 224, 255, 0.5);
      }
      .fp3d-dev[data-entity^="trail:"] .fp3d-dev-icon {
        color: #37e0ff;
      }
      .fp3d-dev[data-entity^="trail:"] .fp3d-dev-text {
        display: inline;
      }
      .fp3d-dev-text {
        display: none;
        padding-right: 6px;
        color: var(--fp3d-text);
        font-variant-numeric: tabular-nums;
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp3d-dev-watt:empty {
        display: none;
      }
      .fp3d-dev-watt {
        padding: 1px 6px 1px 0;
        color: #37e0ff;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
      }
      .fp3d-dev-on .fp3d-dev-watt {
        color: #2a1a00;
      }
      .fp3d-person {
        position: absolute;
        left: 0;
        top: 0;
        width: 30px;
        height: 30px;
        pointer-events: auto;
      }
      .fp3d-person-tap {
        cursor: pointer;
      }
      .fp3d-person-face {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        overflow: hidden;
        background: var(--fp3d-pc, #ff5fd2);
        color: #fff;
        font: 700 12px var(--fp3d-font);
        box-shadow:
          0 0 0 2px color-mix(in srgb, var(--fp3d-pc, #ff5fd2) 55%, transparent),
          0 0 18px var(--fp3d-pc, #ff5fd2);
      }
      .fp3d-person img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .fp3d-person-figure {
        width: auto;
        height: auto;
      }
      .fp3d-person-figure .fp3d-person-face {
        display: none;
      }
      .fp3d-person-figure .fp3d-person-tag {
        position: static;
        display: block;
        transform: none;
      }
      .fp3d-person-tag {
        position: absolute;
        left: 50%;
        top: calc(100% + 4px);
        transform: translateX(-50%);
        padding: 1px 7px;
        border-radius: 8px;
        background: rgba(8, 14, 28, 0.82);
        border: 1px solid color-mix(in srgb, var(--fp3d-pc, #ff5fd2) 60%, transparent);
        color: #fff;
        font: 600 11px var(--fp3d-font);
        white-space: nowrap;
      }
      .fp3d-person[hidden] {
        display: none;
      }
      .fp3d-no-room-names .fp3d-pin {
        display: none !important;
      }
      /* tablet level: blur over the canvas and glowing shadows are expensive on weak GPUs */
      .fp3d-stage.fp3d-low {
        transition: none;
      }
      .fp3d-low .fp3d-pin,
      .fp3d-low .fp3d-dev,
      .fp3d-low .fp3d-dev-on,
      .fp3d-low .fp3d-energy-item,
      .fp3d-low .fp3d-find-btn,
      .fp3d-low .fp3d-swipe,
      .fp3d-low .fp3d-thumb {
        backdrop-filter: none;
        box-shadow: none;
        transition: none;
      }
      /* a shadow that pulses repaints the warning every frame: it glows steadily on the tablet level */
      .fp3d-low .fp3d-alert {
        animation: none;
      }
      .fp3d-low .fp3d-holo-link line,
      .fp3d-low .fp3d-holo-link circle,
      .fp3d-low .fp3d-holo-curve {
        filter: none;
      }
      .fp3d-thumbs {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: calc(100% - 140px);
        overflow-y: auto;
        scrollbar-width: none;
        z-index: 2;
      }
      .fp3d-thumb {
        position: relative;
        display: grid;
        padding: 0;
        width: 150px;
        border: 1px solid var(--fp3d-line);
        border-radius: 14px;
        background: color-mix(in srgb, var(--fp3d-chrome) 70%, transparent);
        color: var(--fp3d-text);
        cursor: pointer;
        overflow: hidden;
        font: inherit;
        box-shadow: var(--fp3d-shadow);
        opacity: 0.72;
        transition: opacity 0.15s, border-color 0.15s;
      }
      .fp3d-thumb:hover,
      .fp3d-thumb[aria-pressed="true"] {
        opacity: 1;
      }
      .fp3d-thumb[aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        box-shadow: var(--fp3d-shadow), 0 0 0 1px var(--fp3d-accent), 0 0 18px rgba(55, 224, 255, 0.25);
      }
      .fp3d-thumb img {
        display: block;
        width: 100%;
        aspect-ratio: 4 / 3;
      }
      .fp3d-thumb span {
        position: absolute;
        left: 8px;
        bottom: 6px;
        font-size: 12px;
        font-weight: 600;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
      }
      .fp3d-thumbs-fold {
        align-self: flex-start;
        width: 26px;
        height: 22px;
        padding: 0;
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        font-size: 11px;
        cursor: pointer;
      }
      /* folded: plain floor buttons with their names, no pictures (D177) */
      .fp3d-thumbs-compact .fp3d-thumb {
        padding: 6px 10px;
        min-width: 0;
      }
      .fp3d-thumbs-compact .fp3d-thumb span {
        position: static;
        background: none;
        padding: 0;
      }
      .fp3d-thumb-house {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
      }
      .fp3d-thumb-house span {
        position: static;
        text-shadow: none;
      }
      .fp3d-thumbs-small .fp3d-thumb {
        width: 104px;
      }
      /* at the top right, clear of the floor pictures and the switch rows (a card moves it beside its own buttons) */
      .fp3d-walk-btn {
        position: absolute;
        z-index: 3;
        top: 12px;
        right: var(--fp3d-walk-right, 12px);
        height: 38px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 14px 0 10px;
        font: inherit;
        font-weight: 700;
        font-size: 14px;
        border: 1px solid rgba(55, 224, 255, 0.45);
        border-radius: 13px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        box-shadow: var(--fp3d-shadow);
        cursor: pointer;
      }
      /* stops above the bottom bar, so that its buttons stay pressable while walking (#351) */
      .fp3d-walk-surface {
        position: absolute;
        inset: 0 0 calc(var(--fp3d-bottom-inset, 0px) + 8px) 0;
        z-index: 4;
        touch-action: none;
        cursor: grab;
      }
      .fp3d-walk-top {
        position: absolute;
        z-index: 5;
        /* under the energy strip, so the two never overlap (#351) */
        top: 64px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        pointer-events: none;
        white-space: nowrap;
      }
      .fp3d-walk-room,
      .fp3d-walk-exit,
      .fp3d-walk-hint {
        padding: 8px 14px;
        border-radius: 14px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        box-shadow: var(--fp3d-shadow);
        font: inherit;
        font-weight: 700;
      }
      /* "Exit walk": where the Walk button was, at the top right, a 44 px target (#351) */
      .fp3d-walk-exit {
        position: absolute;
        z-index: 5;
        top: 12px;
        right: var(--fp3d-walk-right, 12px);
        min-height: 44px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 16px;
        border: 1px solid rgba(55, 224, 255, 0.45);
        font-size: 15px;
        white-space: nowrap;
        cursor: pointer;
      }
      .fp3d-walk-hint {
        position: absolute;
        z-index: 5;
        left: 50%;
        top: 112px;
        transform: translateX(-50%);
        max-width: min(560px, calc(100% - 32px));
        font-weight: 500;
        font-size: 13px;
        text-align: center;
        pointer-events: none;
      }
      .fp3d-walk-stick {
        position: absolute;
        z-index: 5;
        right: 18px;
        bottom: calc(18px + var(--fp3d-bottom-inset, 0px));
        width: 112px;
        height: 112px;
        border-radius: 50%;
        background: rgba(14, 21, 38, 0.55);
        border: 1px solid var(--fp3d-line);
        display: grid;
        place-items: center;
        touch-action: none;
      }
      .fp3d-walk-stick span {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: var(--fp3d-accent);
        box-shadow: 0 0 16px rgba(55, 224, 255, 0.5);
        pointer-events: none;
      }
      /* with a mouse the stick is not needed */
      @media (pointer: fine) {
        .fp3d-walk-stick {
          display: none;
        }
      }
      .fp3d-find-btn {
        position: absolute;
        left: 12px;
        bottom: calc(10px + var(--fp3d-bottom-inset, 0px));
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 13px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        box-shadow: var(--fp3d-shadow);
        cursor: pointer;
      }
      /* the star sits above the search button, its menu opens above it */
      .fp3d-central-btn {
        position: absolute;
        left: 12px;
        bottom: calc(56px + var(--fp3d-bottom-inset, 0px));
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 13px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        box-shadow: var(--fp3d-shadow);
        cursor: pointer;
        z-index: 3;
      }
      .fp3d-central-on {
        color: var(--fp3d-accent);
      }
      .fp3d-central {
        position: absolute;
        left: 12px;
        bottom: calc(104px + var(--fp3d-bottom-inset, 0px));
        width: min(320px, calc(100% - 24px));
        max-height: calc(100% - 140px);
        overflow-y: auto;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        border: 1px solid var(--fp3d-line);
        border-radius: 16px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        box-shadow: var(--fp3d-shadow);
        backdrop-filter: blur(10px);
        z-index: 4;
      }
      .fp3d-central > b {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      .fp3d-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .fp3d-central-favs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .fp3d-own-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .fp3d-own-btn ha-icon {
        --mdc-icon-size: 18px;
      }
      .fp3d-central-hint {
        margin: 0;
        font-size: 13px;
        opacity: 0.7;
      }
      .fp3d-low .fp3d-central {
        backdrop-filter: none;
      }
      /* the eye sits beside the search button; alone in the corner once the view is clean */
      .fp3d-eye {
        position: absolute;
        left: 56px;
        bottom: calc(10px + var(--fp3d-bottom-inset, 0px));
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        padding: 0;
        border-radius: 50%;
        border: 1px solid rgba(160, 240, 255, 0.35);
        background: var(--fp3d-s-chrome, rgba(8, 16, 34, 0.7));
        color: var(--fp3d-text);
        cursor: pointer;
        z-index: 4;
      }
      /* the clock in a corner of the view (view settings / card option clock) */
      .fp3d-clock {
        position: absolute;
        /* the lowest layer over the scene: panels, menus and pop-ups cover it (#313) */
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        padding: 8px 14px;
        border-radius: 14px;
        background: rgba(4, 16, 24, 0.55);
        color: var(--fp3d-text);
        line-height: 1.1;
        pointer-events: none;
        backdrop-filter: blur(6px);
      }
      .fp3d-clock b {
        font-size: 30px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
      }
      .fp3d-clock span {
        font-size: 13px;
        color: var(--fp3d-muted);
      }
      .fp3d-clock .fp3d-dial {
        width: 96px;
        height: 96px;
        align-self: center;
      }
      .fp3d-clock .fp3d-dial .s {
        stroke: var(--fp3d-accent);
      }
      /* Day (#260, V06): the dark box under dark text was unreadable; the clock takes the Day surface with dark text */
      :host([light]) .fp3d-clock {
        background: rgba(255, 255, 255, 0.88);
        color: #0f1c2e;
        box-shadow: 0 4px 14px rgba(20, 40, 80, 0.18);
      }
      :host([light]) .fp3d-clock span {
        color: #3d4d63;
      }
      /* at the top it sits under the energy strip and the walk button */
      /* the clock with the weather tile beside it (#333): the row takes the clock's corner, the clock sits in it */
      .fp3d-clockrow {
        position: absolute;
        z-index: 1;
        display: flex;
        align-items: stretch;
        gap: 8px;
        pointer-events: none;
      }
      .fp3d-clockrow > .fp3d-clock {
        position: static;
      }
      .fp3d-clock-tr.fp3d-clockrow,
      .fp3d-clock-br.fp3d-clockrow {
        flex-direction: row-reverse;
      }
      /* at the top it sits under the energy strip and the walk button */
      .fp3d-clock-tl {
        top: 64px;
        left: 12px;
      }
      .fp3d-clock-tr {
        top: 64px;
        right: 12px;
      }
      .fp3d-clock-bl {
        bottom: calc(66px + var(--fp3d-bottom-inset, 0px));
        left: 12px;
      }
      .fp3d-clock-br {
        bottom: calc(66px + var(--fp3d-bottom-inset, 0px));
        right: 12px;
      }
      .fp3d-mic {
        position: absolute;
        bottom: calc(6px + var(--fp3d-bottom-inset, 0px));
        /* a big target: it is tapped from across the room, often with a thumb */
        width: 52px;
        height: 52px;
        touch-action: manipulation;
        display: grid;
        place-items: center;
        padding: 0;
        border-radius: 50%;
        border: 1px solid rgba(160, 240, 255, 0.35);
        background: var(--fp3d-s-chrome, rgba(8, 16, 34, 0.7));
        color: var(--fp3d-text);
        cursor: pointer;
        z-index: 4;
      }
      .fp3d-mic-on {
        color: #ff5a6a;
        border-color: #ff5a6a;
        box-shadow: 0 0 12px rgba(255, 90, 106, 0.7);
      }
      .fp3d-mic-say {
        position: absolute;
        bottom: calc(66px + var(--fp3d-bottom-inset, 0px));
        max-width: min(420px, calc(100% - 80px));
        padding: 6px 12px;
        border-radius: 14px;
        background: var(--fp3d-s-chrome, rgba(8, 16, 34, 0.85));
        border: 1px solid rgba(160, 240, 255, 0.35);
        color: var(--fp3d-text);
        font-size: 14px;
        z-index: 4;
      }
      .fp3d-mic-err {
        border-color: rgba(255, 90, 106, 0.7);
      }
      .fp3d-eye-clean {
        left: 12px;
        opacity: 0.55;
      }
      .fp3d-eye:hover,
      .fp3d-eye-clean:hover {
        opacity: 1;
      }
      .fp3d-swipe {
        position: absolute;
        transform: translate(-50%, calc(-100% - 28px));
        display: grid;
        grid-template-columns: auto auto;
        align-items: center;
        gap: 2px 12px;
        padding: 8px 12px;
        border-radius: 14px;
        background: var(--fp3d-chrome);
        box-shadow: var(--fp3d-shadow);
        pointer-events: none;
        white-space: nowrap;
        z-index: 4;
      }
      /* time travel: the clock sits at the top centre, the warnings below it */
      .fp3d-replay .fp3d-alert-banner {
        top: 74px;
      }
      /* the time bar takes the bottom: the heat legend moves up under the energy values */
      .fp3d-replay .fp3d-legend,
      .fp3d-replay.fp3d-has-alerts .fp3d-legend {
        bottom: auto;
        top: 62px;
      }
      .fp3d-replay .fp3d-energy {
        max-width: calc(50% - 96px);
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        pointer-events: auto;
      }
      .fp3d-replay .fp3d-energy > * {
        flex: none;
      }
      /* the warnings sit below the clock, so the energy values stay at the top */
      .fp3d-replay.fp3d-has-alerts .fp3d-energy {
        top: 10px;
      }
      @container fp3d (max-width: 700px) {
        .fp3d-replay .fp3d-energy,
        .fp3d-replay.fp3d-has-alerts .fp3d-energy {
          top: 68px;
          max-width: calc(100% - 24px);
        }
        .fp3d-replay .fp3d-alert-banner,
        .fp3d-replay .fp3d-legend {
          top: 116px;
        }
        .fp3d-replay.fp3d-has-alerts .fp3d-legend {
          top: 164px;
        }
      }
      .fp3d-info {
        grid-template-columns: auto;
        z-index: 5;
      }
      .fp3d-swipe.fp3d-info b {
        font-size: 15px;
      }
      .fp3d-swipe span {
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .fp3d-swipe b {
        grid-row: 2;
        font: 700 22px var(--fp3d-title-font);
      }
      .fp3d-swipe i {
        grid-row: 1 / 3;
        grid-column: 2;
        position: relative;
        width: 10px;
        height: 44px;
        border-radius: 5px;
        background: rgba(127, 127, 127, 0.25);
        overflow: hidden;
      }
      .fp3d-swipe em {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--fp3d-warm);
      }
      .fp3d-menu-backdrop {
        position: absolute;
        inset: 0;
        z-index: 5;
      }
      /* a module's sheet and the ⚙ settings: a glass box in the middle, over a dim backdrop */
      .fp3d-sheet-backdrop {
        position: absolute;
        inset: 0;
        z-index: 7;
        background: rgba(4, 8, 16, 0.35);
      }
      .fp3d-sheet {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(440px, calc(100% - 24px));
        max-height: calc(100% - 40px);
        overflow-y: auto;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px 16px 16px;
        border: 1px solid var(--fp3d-line);
        border-radius: 18px;
        background: var(--fp3d-chrome);
        color: var(--fp3d-text);
        box-shadow: var(--fp3d-shadow);
        backdrop-filter: blur(12px);
        z-index: 8;
      }
      .fp3d-sheet.fp3d-rack-view {
        width: auto;
        max-width: calc(100% - 24px);
        min-width: min(320px, calc(100% - 24px));
      }
      .fp3d-rack-view-used {
        margin: 0;
        font-size: 14px;
        opacity: 0.8;
      }
      .fp3d-rack-view-box {
        overflow: auto;
        min-height: 0;
      }
      .fp3d-rack-detail {
        display: grid;
        gap: 4px;
        margin: 0 0 8px;
      }
      .fp3d-rack-detail p {
        margin: 0;
        opacity: 0.75;
      }
      .fp3d-rack-led {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 3px;
        margin-right: 6px;
      }
      .fp3d-rack-entity {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 8px;
        border: 0;
        border-radius: 8px;
        background: var(--fp3d-s-chrome, rgba(255, 255, 255, 0.06));
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-rack-view-box .fp3d-el-gear {
        cursor: pointer;
      }
      .fp3d-rack-view-box svg {
        display: block;
        margin: 0 auto;
        max-width: none;
      }
      .fp3d-sheet header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 16px;
      }
      .fp3d-sheet-x {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid var(--fp3d-line);
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      .fp3d-sheet-choice,
      .fp3d-sheet-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .fp3d-sheet-chip {
        min-height: 40px;
        padding: 0 14px;
        border-radius: 12px;
        border: 1px solid var(--fp3d-line);
        background: color-mix(in srgb, var(--fp3d-accent, #37e0ff) 10%, transparent);
        color: inherit;
        font: inherit;
        font-size: 14px;
        cursor: pointer;
      }
      .fp3d-sheet-chip:hover {
        border-color: var(--fp3d-accent, #37e0ff);
      }
      .fp3d-sheet-row {
        display: flex;
        gap: 6px;
      }
      .fp3d-sheet-input {
        flex: 1;
        min-width: 0;
        min-height: 38px;
        padding: 0 10px;
        border-radius: 10px;
        border: 1px solid var(--fp3d-line);
        background: rgba(0, 0, 0, 0.18);
        color: inherit;
        font: inherit;
      }
      .fp3d-sheet-lines p {
        margin: 0;
        color: var(--fp3d-muted);
        font-size: 12px;
      }
      .fp3d-sheet-gear {
        align-self: flex-start;
        border: 0;
        background: none;
        color: var(--fp3d-muted);
        font: inherit;
        font-size: 13px;
        padding: 4px 0;
        cursor: pointer;
      }
      .fp3d-sheet-gear:hover {
        color: var(--fp3d-accent);
      }
      .fp3d-note {
        position: absolute;
        left: 50%;
        bottom: calc(80px + var(--fp3d-bottom-inset, 0px));
        transform: translateX(-50%);
        max-width: calc(100% - 32px);
        padding: 8px 14px;
        border-radius: 999px;
        background: var(--fp3d-chrome);
        border: 1px solid var(--fp3d-line);
        color: var(--fp3d-text);
        font-size: 13px;
        box-shadow: var(--fp3d-shadow);
        z-index: 9;
        pointer-events: none;
      }
      .fp3d-through {
        position: absolute;
        inset: 0;
        z-index: 4;
        pointer-events: none;
      }
      /* the camera wall: a glass sheet over the scene with every camera's picture */
      .fp3d-wall {
        position: absolute;
        /* by default docked to the bottom of the view, so the 3D view stays in sight above it (#266); a window moved or resized by the user (#314) is placed inline */
        inset: auto 12px calc(var(--fp3d-bottom-inset, 0px) + 12px) 12px;
        height: min(40%, 380px);
        min-width: 260px;
        min-height: 200px;
        /* a stored size is the whole window, padding and border included, so it fits inside the view (#314) */
        box-sizing: border-box;
        z-index: 5;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 16px;
        background: rgba(8, 16, 34, 0.86);
        border: 1px solid rgba(160, 240, 255, 0.4);
        box-shadow: 0 0 28px rgba(55, 224, 255, 0.25);
        overflow: auto;
      }
      /* edges and corners to resize by (#314); not on a phone, where the wall is a full width bottom sheet */
      .fp3d-wall-rz {
        position: absolute;
        z-index: 1;
        touch-action: none;
      }
      .fp3d-wall-rz-n,
      .fp3d-wall-rz-s {
        left: 16px;
        right: 16px;
        height: 8px;
        cursor: ns-resize;
      }
      .fp3d-wall-rz-e,
      .fp3d-wall-rz-w {
        top: 16px;
        bottom: 16px;
        width: 8px;
        cursor: ew-resize;
      }
      .fp3d-wall-rz-ne,
      .fp3d-wall-rz-nw,
      .fp3d-wall-rz-se,
      .fp3d-wall-rz-sw {
        width: 16px;
        height: 16px;
      }
      .fp3d-wall-rz-n,
      .fp3d-wall-rz-ne,
      .fp3d-wall-rz-nw {
        top: 0;
      }
      .fp3d-wall-rz-s,
      .fp3d-wall-rz-se,
      .fp3d-wall-rz-sw {
        bottom: 0;
      }
      .fp3d-wall-rz-e,
      .fp3d-wall-rz-ne,
      .fp3d-wall-rz-se {
        right: 0;
      }
      .fp3d-wall-rz-w,
      .fp3d-wall-rz-nw,
      .fp3d-wall-rz-sw {
        left: 0;
      }
      .fp3d-wall-rz-ne,
      .fp3d-wall-rz-sw {
        cursor: nesw-resize;
      }
      .fp3d-wall-rz-nw,
      .fp3d-wall-rz-se {
        cursor: nwse-resize;
      }
      .fp3d-wall-rz:hover {
        background: var(--fp3d-accent);
        opacity: 0.45;
      }
      /* phones: the wall is a full screen page over the view, like Settings and the View panel (#346) */
      @media ${unsafeCSS(PHONE_MEDIA)} {
        .fp3d-wall {
          inset: 0;
          height: auto;
          z-index: 12;
          border: 0;
          border-radius: 0;
          background: rgb(8, 16, 34);
          box-shadow: none;
          padding-bottom: max(env(safe-area-inset-bottom, 0px), 12px);
        }
        .fp3d-wall-rz {
          display: none;
        }
        .fp3d-wall-head {
          cursor: default;
        }
      }
      .fp3d-wall-head {
        cursor: grab;
        touch-action: none;
        user-select: none;
        gap: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 600;
        color: #e6fbff;
      }
      .fp3d-wall-head .fp3d-wall-title {
        flex: 1;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0 8px;
      }
      .fp3d-wall-title b {
        color: #ff6b6b;
        font-weight: 600;
      }
      .fp3d-wall-tools {
        display: flex;
        gap: 6px;
      }
      .fp3d-wall-big {
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        overflow: hidden;
        background: #0a1426;
      }
      .fp3d-wall-big img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      /* the stream player: a bare card, as wide as the sheet allows for a 16:9 picture */
      .fp3d-wall-big > hui-picture-entity-card,
      .fp3d-wall-big > hui-error-card {
        width: min(100%, calc((100vh - 200px) * 16 / 9));
        --ha-card-background: transparent;
        --ha-card-border-width: 0;
        --ha-card-box-shadow: none;
      }
      .fp3d-wall-grid {
        flex: 1;
        display: grid;
        align-content: safe center;
        justify-content: center;
        gap: 12px;
        min-height: 0;
        overflow-y: auto;
      }
      .fp3d-wall-cam {
        position: relative;
        padding: 0;
        border: 1px solid rgba(160, 240, 255, 0.3);
        border-radius: 12px;
        overflow: hidden;
        background: #0a1426;
        cursor: pointer;
        width: 100%;
        height: 100%;
      }
      .fp3d-wall-cam img,
      .fp3d-wall-none {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #8aa;
      }
      .fp3d-wall-seen {
        border-color: rgba(255, 80, 90, 0.9);
        box-shadow: 0 0 14px rgba(255, 60, 70, 0.5);
      }
      .fp3d-wall-name {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 4px 8px;
        font-size: 12px;
        text-align: left;
        color: #e6fbff;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
      }
      .fp3d-wall-name b {
        color: #ff6b6b;
        font-weight: 600;
      }
      .fp3d-flash::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 3;
        background: rgba(225, 238, 255, 0.4);
        pointer-events: none;
      }
      .fp3d-through-img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: var(--fp3d-blend);
      }
      .fp3d-through-live {
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .fp3d-through-live > * {
        width: 100%;
        --ha-card-background: transparent;
        --ha-card-border-width: 0;
        --ha-card-box-shadow: none;
      }
      .fp3d-through-img:fullscreen {
        opacity: 1;
        object-fit: contain;
        background: #000;
      }
      .fp3d-through-bar {
        position: absolute;
        left: 50%;
        bottom: calc(var(--fp3d-bottom-inset, 0px) + 14px);
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: calc(100% - 32px);
        padding: 8px 10px 8px 16px;
        border-radius: 999px;
        background: var(--fp3d-chrome);
        backdrop-filter: blur(12px);
        border: 1px solid var(--fp3d-line);
        pointer-events: auto;
      }
      .fp3d-through-name {
        font-weight: 600;
        white-space: nowrap;
      }
      /* a small note that the picture is a still, so nobody wonders why it does not move */
      .fp3d-still {
        font-size: 11px;
        font-weight: 400;
        opacity: 0.65;
        white-space: nowrap;
        margin-left: 6px;
      }
      .fp3d-through-bar input[type="range"] {
        width: 140px;
        accent-color: var(--fp3d-accent);
      }
      .fp3d-through-on :is(.fp3d-pin, .fp3d-dev, .fp3d-energy, .fp3d-legend, .fp3d-thumbs, .fp3d-scenes, .fp3d-find-btn, .fp3d-stats) {
        display: none;
      }
      fp3d-quick-menu {
        position: absolute;
        z-index: 6;
      }
      .fp3d-dev-found {
        animation: fp3d-found 0.6s ease-in-out 4;
      }
      @keyframes fp3d-found {
        50% {
          scale: 1.35;
          filter: drop-shadow(0 0 12px var(--fp3d-accent));
        }
      }
      .fp3d-legend {
        position: absolute;
        left: 12px;
        /* above the star button */
        bottom: calc(104px + var(--fp3d-bottom-inset, 0px));
        display: grid;
        gap: 4px;
        min-width: 180px;
        padding: 8px 11px;
        border-radius: 12px;
        background: var(--fp3d-chrome);
        box-shadow: var(--fp3d-shadow);
        font-size: 12px;
        /* a button (#310): a tap folds it */
        border: 0;
        color: inherit;
        font-family: inherit;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-legend-min {
        min-width: 0;
        width: 92px;
        gap: 2px;
        padding: 5px 7px;
        font-size: 10px;
      }
      .fp3d-legend-min .fp3d-legend-bar {
        height: 5px;
      }
      .fp3d-legend-bar {
        height: 8px;
        border-radius: 4px;
      }
      .fp3d-legend-range {
        display: flex;
        justify-content: space-between;
        color: var(--fp3d-muted);
        font-variant-numeric: tabular-nums;
      }
      .fp3d-legend-none {
        color: var(--fp3d-warm);
      }
      /* Energy: the glass hologram beside the house */
      .fp3d-holo {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 4;
        width: 236px;
        padding: 12px 14px 11px;
        border-radius: 16px;
        overflow: hidden;
        cursor: pointer;
        background: linear-gradient(140deg, rgba(150, 235, 255, 0.2) 0%, rgba(70, 140, 230, 0.08) 45%, rgba(20, 60, 140, 0.05) 100%);
        backdrop-filter: blur(7px) saturate(150%);
        -webkit-backdrop-filter: blur(7px) saturate(150%);
        border: 1px solid rgba(160, 240, 255, 0.55);
        box-shadow:
          0 0 28px rgba(55, 224, 255, 0.35),
          0 0 2px rgba(200, 250, 255, 0.9),
          inset 0 1px 0 rgba(255, 255, 255, 0.45),
          inset 0 0 36px rgba(55, 224, 255, 0.14);
        color: #e6fbff;
        font-size: 12px;
        line-height: 1.35;
        text-shadow: 0 0 6px rgba(80, 220, 255, 0.55);
        will-change: transform;
        transform-origin: 0 0;
      }
      .fp3d-holo[hidden],
      .fp3d-holo-link[hidden] {
        display: none;
      }
      /* a device's card: smaller than the plant's */
      /* the now-playing card: cover, titles, transport and volume */
      .fp3d-holo-media .fp3d-holo-head {
        cursor: pointer;
      }
      .fp3d-holo-track {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 6px;
      }
      .fp3d-holo-cover {
        width: 46px;
        height: 46px;
        border-radius: 8px;
        object-fit: cover;
        flex: none;
        box-shadow: 0 0 12px rgba(55, 224, 255, 0.35);
      }
      .fp3d-holo-cover-none {
        display: grid;
        place-items: center;
        font-size: 22px;
        background: rgba(55, 224, 255, 0.15);
        color: #a8f0ff;
      }
      .fp3d-holo-titles {
        display: grid;
        gap: 2px;
        min-width: 0;
      }
      .fp3d-holo-titles b {
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 170px;
      }
      .fp3d-holo-titles span {
        font-size: 12px;
        opacity: 0.8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 170px;
      }
      /* the TV card (#281): a mouse makes the whole box larger while it hovers, like the solar card (wider, the titles
         in full), so nothing is cut off (#335); MEDIA_HOVER_W in the script keeps it on the screen; it can be hidden */
      .fp3d-holo-media {
        transition: width 140ms ease-out;
      }
      @media (hover: hover) and (pointer: fine) {
        .fp3d-holo-media:hover {
          z-index: 6;
          width: 288px;
        }
        .fp3d-holo-media.fp3d-holo-min:hover {
          width: 200px;
        }
        .fp3d-holo-media:hover .fp3d-holo-titles b,
        .fp3d-holo-media:hover .fp3d-holo-titles span {
          max-width: none;
          white-space: normal;
          overflow-wrap: anywhere;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .fp3d-holo-media {
          transition: none;
        }
      }
      .fp3d-holo-hide {
        margin-left: 6px;
        width: 22px;
        height: 22px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: rgba(8, 16, 34, 0.5);
        color: inherit;
        font-size: 11px;
        cursor: pointer;
        flex: none;
      }
      .fp3d-holo-hide:hover {
        background: rgba(8, 16, 34, 0.85);
      }
      @media (pointer: coarse) {
        .fp3d-holo-hide {
          width: 44px;
          height: 44px;
          margin: -11px -9px -11px 0;
        }
      }
      .fp3d-holo-media-controls {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
      }
      .fp3d-holo-media-controls button {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 1px solid rgba(160, 240, 255, 0.4);
        background: rgba(8, 16, 34, 0.6);
        color: var(--fp3d-text);
        cursor: pointer;
        font-size: 12px;
      }
      .fp3d-holo-media-controls button:disabled {
        opacity: 0.3;
        cursor: default;
      }
      .fp3d-holo-media-controls input[type="range"] {
        width: 70px;
        accent-color: var(--fp3d-accent);
      }
      .fp3d-holo-car-main {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-top: 4px;
      }
      .fp3d-holo-car-main b {
        font-size: 22px;
        font-variant-numeric: tabular-nums;
      }
      .fp3d-holo-car-main span {
        font-size: 12px;
        opacity: 0.85;
      }
      .fp3d-holo-car-bar {
        height: 5px;
        margin-top: 6px;
        border-radius: 3px;
        background: rgba(160, 240, 255, 0.15);
        overflow: hidden;
      }
      .fp3d-holo-car-bar i {
        display: block;
        height: 100%;
        border-radius: 3px;
        box-shadow: 0 0 8px currentColor;
      }
      .fp3d-holo-meters {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 10px;
      }
      .fp3d-holo-mrow {
        display: grid;
        grid-template-columns: 50px 64px 1fr;
        align-items: center;
        gap: 6px;
        margin-top: 5px;
        font-size: 12px;
      }
      .fp3d-holo-mrow span {
        opacity: 0.8;
      }
      .fp3d-holo-mrow b {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .fp3d-holo-mrow i {
        position: relative;
        height: 4px;
        border-radius: 2px;
        /* red – yellow – green (the ideal range in the middle) – yellow – red */
        background: linear-gradient(90deg, rgba(255, 77, 64, 0.35), rgba(255, 204, 64, 0.35) 25%, rgba(77, 255, 128, 0.45) 40%, rgba(77, 255, 128, 0.45) 60%, rgba(255, 204, 64, 0.35) 75%, rgba(255, 77, 64, 0.35));
      }
      .fp3d-holo-mrow-none {
        visibility: hidden;
      }
      .fp3d-holo-mrow em {
        position: absolute;
        top: -2px;
        width: 8px;
        height: 8px;
        margin-left: -4px;
        border-radius: 50%;
        box-shadow: 0 0 6px currentColor;
      }
      .fp3d-holo-mline {
        margin-top: 5px;
        font-size: 12px;
        opacity: 0.85;
      }
      /* a module's richer card: a state line, a second big value, a chain, cells, a hint */
      .fp3d-holo.fp3d-holo-mod-wide {
        width: 236px;
        /* a denser card: darker glass, so its many small values stay readable over a bright room */
        background: linear-gradient(140deg, rgba(40, 80, 130, 0.62) 0%, rgba(12, 28, 58, 0.78) 55%, rgba(8, 18, 40, 0.82) 100%);
      }
      .fp3d-holo-mod-wide .fp3d-holo-mrow {
        grid-template-columns: 74px 78px 1fr;
      }
      .fp3d-holo-ping {
        box-shadow:
          0 0 0 2px var(--fp3d-accent, #37e0ff),
          0 0 26px rgba(55, 224, 255, 0.55);
      }
      .fp3d-holo-status {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        padding: 4px 8px;
        border-radius: 9px;
        font-size: 13.5px;
        color: var(--st, #37e0ff);
        background: color-mix(in srgb, var(--st, #37e0ff) 14%, transparent);
        border: 1px solid color-mix(in srgb, var(--st, #37e0ff) 45%, transparent);
      }
      .fp3d-holo-status i {
        font-style: normal;
      }
      .fp3d-holo-status span {
        margin-left: auto;
        font-size: 11px;
        color: inherit;
        opacity: 0.8;
        white-space: nowrap;
      }
      .fp3d-holo-mod-main em {
        margin-left: auto;
        display: grid;
        justify-items: end;
        font-style: normal;
        line-height: 1.1;
      }
      .fp3d-holo-mod-main em b {
        font-size: 18px;
      }
      .fp3d-holo-mod-main em small {
        font-size: 10.5px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .fp3d-holo-chain {
        display: flex;
        align-items: stretch;
        gap: 3px;
        margin-top: 7px;
      }
      .fp3d-holo-chain > div,
      .fp3d-holo-cells > div {
        flex: 1;
        min-width: 0;
        display: grid;
        padding: 3px 5px;
        border-radius: 7px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(160, 240, 255, 0.16);
      }
      .fp3d-holo-chain small,
      .fp3d-holo-cells small {
        font-size: 10px;
        opacity: 0.75;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp3d-holo-chain b,
      .fp3d-holo-cells b {
        font-size: 12.5px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .fp3d-holo-chain s {
        align-self: center;
        text-decoration: none;
        opacity: 0.6;
        font-size: 11px;
      }
      .fp3d-holo-chain-note {
        margin-top: 3px;
        font-size: 11px;
        text-align: right;
        opacity: 0.9;
      }
      .fp3d-holo-cells {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        margin-top: 7px;
      }
      .fp3d-holo-hint {
        margin-top: 6px;
        padding: 4px 7px;
        border-radius: 7px;
        font-size: 11.5px;
        color: var(--hint, #ffc04d);
        background: color-mix(in srgb, var(--hint, #ffc04d) 13%, transparent);
        border-left: 3px solid var(--hint, #ffc04d);
      }
      .fp3d-holo-mrow-fill {
        background: rgba(160, 240, 255, 0.14) !important;
        overflow: hidden;
      }
      .fp3d-holo-mrow-fill s {
        display: block;
        height: 100%;
        border-radius: 2px;
        box-shadow: 0 0 6px currentColor;
      }
      .fp3d-holo-spark-label {
        margin-top: 6px;
        font-size: 10.5px;
        opacity: 0.7;
      }
      .fp3d-holo-spark-label + .fp3d-holo-spark {
        margin-top: 1px;
      }
      .fp3d-holo-spark {
        display: block;
        width: 100%;
        height: 22px;
        margin-top: 6px;
      }
      .fp3d-holo-spark polyline {
        fill: none;
        stroke-width: 1.6;
        vector-effect: non-scaling-stroke;
        stroke-linejoin: round;
      }
      /* a module's chips (the pool module: ball valves and the six-way valve, set by hand) */
      .fp3d-holo-chips {
        display: grid;
        gap: 4px;
        margin-top: 4px;
        max-height: 220px;
        overflow-y: auto;
        pointer-events: auto;
      }
      .fp3d-holo-chip,
      .fp3d-holo-chip-row button {
        font: inherit;
        font-size: 11.5px;
        color: inherit;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(91, 124, 255, 0.35);
        border-radius: 8px;
        padding: 4px 8px;
        cursor: pointer;
        text-align: left;
      }
      .fp3d-holo-chip {
        display: grid;
        grid-template-columns: 14px 1fr auto;
        gap: 6px;
        align-items: center;
      }
      .fp3d-holo-chip i {
        font-style: normal;
        color: #ff6b5a;
      }
      .fp3d-holo-chip.fp3d-holo-on i {
        color: #4dff9a;
      }
      .fp3d-holo-chip small {
        opacity: 0.75;
      }
      .fp3d-holo-valve-pos {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .fp3d-holo-on {
        border-color: var(--fp3d-accent) !important;
        color: var(--fp3d-accent) !important;
      }
      .fp3d-holo-vol {
        font-size: 11px;
        opacity: 0.8;
        font-variant-numeric: tabular-nums;
      }
      .fp3d-holo-dev {
        width: 184px;
        padding: 10px 12px 9px;
      }
      /* racks (#120): one row per value (name and device left, value right, the sparkline below) */
      .fp3d-holo-rack {
        cursor: pointer;
      }
      .fp3d-holo-rack:not(.fp3d-holo-min) {
        width: 268px;
      }
      .fp3d-rack-card-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        margin-top: 7px;
      }
      .fp3d-rack-card-row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: baseline;
        column-gap: 4px;
        min-width: 0;
        padding: 3px 5px 2px;
        border-radius: 7px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(160, 240, 255, 0.16);
        font-size: 11px;
        color: #aee9ff;
      }
      .fp3d-rack-card-row span {
        display: grid;
        min-width: 0;
      }
      .fp3d-rack-card-row small {
        font-size: 10px;
        opacity: 0.7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp3d-rack-card-row b {
        color: #fff;
        font-size: 12.5px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .fp3d-rack-card-row .fp3d-holo-spark {
        grid-column: 1 / -1;
        height: 16px;
        margin-top: 2px;
      }
      /* tablet level: no blur and no sheen, the glass is painted */
      .fp3d-holo-plain {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        background: rgba(12, 26, 50, 0.9);
      }
      .fp3d-holo-plain .fp3d-holo-sheen,
      .fp3d-holo-plain .fp3d-holo-scan {
        display: none;
      }
      /* Day (#86): the cyan glass vanished on the pale sky; the cards become dark glass with a deep cyan rim */
      :host([light]) .fp3d-holo:not(.fp3d-holo-bin) {
        background: linear-gradient(140deg, rgba(22, 58, 100, 0.9) 0%, rgba(12, 34, 70, 0.92) 55%, rgba(8, 24, 52, 0.94) 100%);
        border-color: rgba(11, 122, 153, 0.85);
        box-shadow:
          0 6px 22px rgba(20, 40, 80, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.25);
        text-shadow: none;
      }
      :host([light]) .fp3d-holo-link line {
        stroke: rgba(11, 122, 153, 0.9);
        filter: none;
      }
      :host([light]) .fp3d-holo-link circle {
        fill: #ffffff;
        stroke: #0b7a99;
        filter: none;
      }
      /* the thin line from the solar field up to the card, with a dot on the field */
      .fp3d-holo-link {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 3;
        pointer-events: none;
        overflow: visible;
      }
      .fp3d-holo-link line {
        stroke: rgba(160, 240, 255, 0.75);
        stroke-width: 1.2;
        filter: drop-shadow(0 0 3px rgba(55, 224, 255, 0.8));
      }
      .fp3d-holo-link circle {
        fill: #cffaff;
        stroke: rgba(55, 224, 255, 0.8);
        stroke-width: 2;
        filter: drop-shadow(0 0 4px rgba(55, 224, 255, 0.9));
      }
      .fp3d-holo-min {
        width: 150px;
      }
      /* the solar card grown (#144): wider and above its neighbours, from its corner at the anchor line */
      .fp3d-holo-grown {
        width: 264px;
        z-index: 6;
      }
      .fp3d-holo-grown .fp3d-holo-body {
        animation: fp3d-holo-grow 160ms ease-out;
        transform-origin: 0 100%;
      }
      @keyframes fp3d-holo-grow {
        from {
          opacity: 0.4;
          transform: scale(0.92);
        }
      }
      .fp3d-holo-plain.fp3d-holo-grown .fp3d-holo-body {
        animation: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .fp3d-holo-grown .fp3d-holo-body {
          animation: none;
        }
      }
      .fp3d-holo-legend {
        display: flex;
        gap: 12px;
        margin: -4px 0 6px;
        font-size: 10px;
        color: #aee9ff;
      }
      .fp3d-holo-legend-act::before,
      .fp3d-holo-legend-fc::before {
        content: "";
        display: inline-block;
        width: 12px;
        margin-right: 4px;
        vertical-align: middle;
        border-top: 2px solid #ffe27a;
      }
      .fp3d-holo-legend-fc::before {
        border-top: 2px dashed #aee9ff;
      }
      .fp3d-holo-more {
        margin: 0 0 8px;
        padding-top: 6px;
        border-top: 1px solid rgba(160, 240, 255, 0.22);
      }
      .fp3d-holo-minor-btn {
        display: block;
        margin: 6px 0 0 auto;
        padding: 2px 9px;
        border: 1px solid rgba(160, 240, 255, 0.4);
        border-radius: 9px;
        background: transparent;
        color: #aee9ff;
        font: 600 11px var(--fp3d-font);
        cursor: pointer;
        pointer-events: auto;
      }
      .fp3d-holo-more-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        color: #aee9ff;
      }
      .fp3d-holo-more-row b {
        color: #fff;
        font-variant-numeric: tabular-nums;
      }
      .fp3d-holo-split {
        height: 4px;
        margin: 3px 0 2px;
        border-radius: 2px;
        background: #4ff6ff;
        overflow: hidden;
      }
      .fp3d-holo-split div {
        height: 100%;
        background: #5dffb0;
      }
      .fp3d-holo-sheen {
        position: absolute;
        inset: 0;
        background: linear-gradient(115deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 32%, rgba(255, 255, 255, 0) 68%, rgba(255, 255, 255, 0.07) 100%);
        pointer-events: none;
      }
      .fp3d-holo-scan {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(0deg, rgba(160, 240, 255, 0.06) 0 1px, transparent 1px 4px);
        pointer-events: none;
      }
      .fp3d-holo-body {
        position: relative;
      }
      .fp3d-holo-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10px;
        letter-spacing: 0.14em;
        color: #8ff0ff;
        text-transform: uppercase;
      }
      .fp3d-holo-live {
        color: #5dffb0;
      }
      .fp3d-holo-big {
        display: flex;
        align-items: baseline;
        gap: 9px;
        margin: 6px 0 1px;
      }
      .fp3d-holo-big b {
        font-size: 26px;
        color: #ffe27a;
        text-shadow: 0 0 12px rgba(255, 210, 80, 0.85);
        font-variant-numeric: tabular-nums;
      }
      .fp3d-holo-big span,
      .fp3d-holo-sub {
        color: #aee9ff;
      }
      .fp3d-holo-sub {
        margin-bottom: 6px;
      }
      .fp3d-holo-plants {
        display: grid;
        grid-template-columns: auto auto;
        justify-content: space-between;
        column-gap: 10px;
        margin: 0 0 5px;
        font-size: 11px;
        color: #aee9ff;
      }
      .fp3d-holo-plants b {
        color: #ffe27a;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .fp3d-holo-sub b,
      .fp3d-holo-cell b,
      .fp3d-holo-foot b {
        color: #fff;
        font-variant-numeric: tabular-nums;
      }
      .fp3d-holo-curve {
        display: block;
        margin-bottom: 7px;
        filter: drop-shadow(0 0 4px rgba(255, 215, 90, 0.7));
      }
      .fp3d-holo-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .fp3d-holo-cell {
        border-left: 2px solid #aee9ff;
        padding-left: 6px;
      }
      .fp3d-holo-cell span {
        font-size: 11px;
      }
      .fp3d-holo-bat {
        border-left-color: #5dffb0;
      }
      .fp3d-holo-bat span {
        color: #5dffb0;
      }
      .fp3d-holo-exp {
        border-left-color: #4ff6ff;
      }
      .fp3d-holo-exp span {
        color: #4ff6ff;
      }
      .fp3d-holo-imp {
        border-left-color: #ff6fb0;
      }
      .fp3d-holo-imp span {
        color: #ff8fc4;
      }
      .fp3d-holo-house {
        border-left-color: #a9c0ff;
      }
      .fp3d-holo-wb {
        border-left-color: #63c9ff;
      }
      .fp3d-holo-bar {
        margin-top: 8px;
        height: 5px;
        border-radius: 3px;
        background: rgba(160, 240, 255, 0.16);
        overflow: hidden;
      }
      .fp3d-holo-bar div {
        height: 100%;
        background: linear-gradient(90deg, #5dffb0, #4ff6ff);
        box-shadow: 0 0 8px rgba(80, 240, 255, 0.8);
      }
      .fp3d-holo-foot {
        display: flex;
        justify-content: space-between;
        margin-top: 3px;
        font-size: 10px;
        color: #aee9ff;
      }
      .fp3d-energy {
        position: absolute;
        left: 12px;
        top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-width: calc(100% - 24px);
        pointer-events: none;
      }
      .fp3d-energy-item {
        display: grid;
        padding: 5px 11px 6px;
        border-radius: 12px;
        background: var(--fp3d-chrome);
        border-left: 3px solid var(--fp3d-line);
        box-shadow: var(--fp3d-shadow);
        backdrop-filter: blur(6px);
        font-variant-numeric: tabular-nums;
      }
      /* a value tile only lifts a hair when hovered (#316): no growing, no click */
      .fp3d-energy-tile {
        position: relative;
        pointer-events: auto;
        transition: transform 180ms ease-out, box-shadow 180ms ease-out, border-left-color 180ms ease-out;
      }
      @media (hover: hover) {
        .fp3d-energy-tile:hover {
          transform: translateY(-1px);
          box-shadow: var(--fp3d-shadow), 0 2px 8px color-mix(in srgb, var(--fp3d-accent) 28%, transparent);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .fp3d-energy-tile {
          transition: none;
        }
      }
      /* a tile that folds the row (#348): a button dressed as the plain tile */
      .fp3d-energy-fold {
        border: 0;
        border-left: 3px solid var(--fp3d-line);
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-energy-fold:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 2px;
      }
      .fp3d-energy-item span {
        font-size: 11px;
        color: var(--fp3d-muted);
      }
      .fp3d-energy-item b {
        font: 700 15px var(--fp3d-title-font);
      }
      .fp3d-energy-total {
        border-left-color: #6fd8ff;
      }
      .fp3d-energy-grid {
        border-left-color: #37e0ff;
      }
      .fp3d-energy-export,
      .fp3d-energy-solar {
        border-left-color: #ffc633;
      }
      .fp3d-energy-battery {
        border-left-color: #59ff8c;
      }
      .fp3d-flow-toggle {
        pointer-events: auto;
        cursor: pointer;
        border: 0;
        border-left: 3px solid var(--fp3d-line);
        color: inherit;
        text-align: left;
        font: inherit;
      }
      .fp3d-flow-toggle[aria-pressed="true"] {
        border-left-color: var(--fp3d-accent);
      }
      .fp3d-flow-toggle span {
        display: none;
      }
      .fp3d-flow-toggle b {
        opacity: 0.4;
        filter: grayscale(1);
      }
      .fp3d-flow-toggle[aria-pressed="true"] b {
        opacity: 1;
        filter: none;
      }
      .fp3d-energy-tariff {
        border-left-color: #b98cff;
      }
      .fp3d-energy-cost {
        border-left-color: #f0b44c;
      }
      .fp3d-energy-cheap {
        border-left-color: #3ccf8e;
        background: color-mix(in srgb, #3ccf8e 22%, var(--fp3d-chrome));
      }
      /* the energy cables' ends (#29): a small dot; hovered, focused or tapped it tells today's kWh */
      .fp3d-wire {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 3;
        /* clear of the pin it belongs to (#207): the dot sits above the pin's top edge (half a pin is 12 px times
           the symbol size, 7 px more with the coarse-pointer padding), so a tap on the pin never lands on the dot */
        margin-top: calc(-12px * var(--fp3d-pin-k, 1) - 18px);
        width: 14px;
        height: 14px;
        padding: 0;
        border: 2px solid rgba(255, 255, 255, 0.85);
        border-radius: 50%;
        background: #7fe8ff;
        box-shadow: 0 0 6px rgba(127, 232, 255, 0.8);
        cursor: pointer;
      }
      .fp3d-wire[hidden] {
        display: none;
      }
      .fp3d-wire::before {
        /* a larger target for fingers, 4 px round: it ends above the pin (#207) */
        content: "";
        position: absolute;
        inset: -4px;
      }
      .fp3d-wire-tip {
        position: absolute;
        left: 50%;
        bottom: calc(100% + 6px);
        transform: translateX(-50%);
        display: none;
        padding: 5px 9px;
        border-radius: 9px;
        background: var(--fp3d-chrome);
        box-shadow: var(--fp3d-shadow);
        color: inherit;
        font: inherit;
        font-size: 12px;
        line-height: 1.3;
        white-space: nowrap;
        text-align: left;
        pointer-events: none;
      }
      .fp3d-wire-tip span {
        display: block;
        opacity: 0.85;
      }
      .fp3d-wire:hover .fp3d-wire-tip,
      .fp3d-wire:focus-visible .fp3d-wire-tip,
      .fp3d-wire-open .fp3d-wire-tip {
        display: block;
      }
      /* narrow stages (portrait tablets, phones): the energy values scroll in one row */
      @container fp3d (max-width: 900px) {
        .fp3d-energy {
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
          pointer-events: auto;
        }
        /* the row stops before the Walk button in the corner instead of running under it (#259, V14) */
        .fp3d-stage:has(> .fp3d-walk-btn) .fp3d-energy {
          max-width: calc(100% - 20px - var(--fp3d-walk-right, 12px) - var(--fp3d-walk-w, 96px));
        }
        /* Exit walk is wider than the Walk button (#351) */
        .fp3d-stage:has(> .fp3d-walk-exit) .fp3d-energy {
          max-width: calc(100% - 20px - var(--fp3d-walk-right, 12px) - 124px);
        }
        /* the scrolling row would clip a lifted tile */
        .fp3d-energy .fp3d-energy-tile:hover {
          transform: none;
        }
        .fp3d-legend {
          bottom: auto;
          top: 70px;
        }
        .fp3d-has-alerts .fp3d-legend {
          top: 118px;
        }
      }
      /* a phone: the chips are one short row of small type, nothing wraps, so the house stays the focus (#344) */
      @container fp3d (max-width: 600px) {
        .fp3d-energy {
          gap: 4px;
        }
        .fp3d-energy-item {
          padding: 3px 8px 4px;
          border-radius: 9px;
          white-space: nowrap;
          flex: none;
        }
        .fp3d-energy-item span {
          font-size: 10px;
          line-height: 1.2;
        }
        .fp3d-energy-item b {
          font-size: 13px;
          line-height: 1.25;
        }
      }
      /* the view's own controls on the right (#285); the room panel opens there, so they make way for it */
      .fp3d-side-right :is(.fp3d-thumbs, .fp3d-find-btn, .fp3d-central-btn, .fp3d-central, .fp3d-eye-clean, fp3d-find, .fp3d-legend) {
        left: auto;
        right: 12px;
      }
      .fp3d-side-right .fp3d-eye {
        left: auto;
        right: 56px;
      }
      /* no search button in the stage (it is in the header): the eye takes the corner, the star stays above it (#422) */
      .fp3d-no-find .fp3d-eye {
        left: 12px;
      }
      .fp3d-side-right.fp3d-no-find .fp3d-eye {
        left: auto;
        right: 12px;
      }
      .fp3d-side-right.fp3d-panel-open :is(.fp3d-thumbs, .fp3d-find-btn, .fp3d-central-btn, .fp3d-central, .fp3d-eye-clean, fp3d-find, .fp3d-legend) {
        display: none;
      }
      /* a room sheet covers the lower half: the view's own controls step aside */
      @container fp3d ((max-width: 700px) or ((orientation: portrait) and (max-width: 1000px))) {
        .fp3d-panel-open :is(.fp3d-find-btn, fp3d-find, .fp3d-thumbs, .fp3d-legend, .fp3d-stats, .fp3d-scenes) {
          display: none;
        }
      }
      @media (pointer: coarse) {
        .fp3d-dev {
          padding: 6px;
        }
        .fp3d-pin {
          padding: 8px 12px;
        }
      }
      .fp3d-dev-full .fp3d-dev-text {
        display: inline;
      }
      .fp3d-dev-name:empty {
        display: none;
      }
      .fp3d-dev-name {
        position: absolute;
        top: calc(100% + 3px);
        left: 50%;
        transform: translateX(-50%);
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 1px 6px;
        border-radius: 6px;
        font-size: 10.5px;
        font-weight: 600;
        line-height: 1.35;
        color: var(--fp3d-text);
        /* a notch more solid so names read over bright neon edges (#88); the scheme's own glass, so the text reads on it in
           the light and high contrast chrome too (#216) */
        background: color-mix(in srgb, var(--fp3d-chrome-solid) 92%, transparent);
        pointer-events: none;
      }
      /* a faint outline on tappable pins every few seconds (#283): opacity and transform only (compositor, no script); three offsets stagger them */
      .fp3d-pulse .fp3d-dev[data-entity]::after {
        content: "";
        position: absolute;
        inset: -3px;
        border-radius: inherit;
        border: 1px solid var(--fp3d-accent);
        opacity: 0;
        pointer-events: none;
        animation: fp3d-pin-pulse 6s ease-out infinite;
      }
      .fp3d-pulse .fp3d-dev:nth-child(3n + 2)::after { animation-delay: 2s; }
      .fp3d-pulse .fp3d-dev:nth-child(3n)::after { animation-delay: 4s; }
      @keyframes fp3d-pin-pulse {
        0%, 20%, 100% { opacity: 0; transform: scale(1); }
        5% { opacity: 0.45; }
        15% { opacity: 0; transform: scale(1.12); }
      }
      @media (prefers-reduced-motion: reduce) {
        .fp3d-pulse .fp3d-dev[data-entity]::after { animation: none; }
      }
      .fp3d-dev-sel {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 2px;
      }
      .fp3d-dev-on {
        color: #2a1a00;
        border-color: transparent;
        background: var(--fp3d-glow, var(--fp3d-warm));
        box-shadow: 0 0 16px var(--fp3d-glow, var(--fp3d-warm));
      }
      .fp3d-dev-on .fp3d-dev-icon {
        background: rgba(255, 255, 255, 0.28);
      }
      .fp3d-dev-on .fp3d-dev-text {
        color: #2a1a00;
      }
      .fp3d-dev-na {
        opacity: 0.45;
      }
      .fp3d-dev-dim {
        opacity: 0.35;
      }
      .fp3d-dev[hidden],
      .fp3d-pin[hidden] {
        display: none;
      }
      .fp3d-pin-active {
        background: var(--fp3d-accent);
        color: var(--fp3d-accent-text);
        border-color: transparent;
        box-shadow: 0 0 18px rgba(55, 224, 255, 0.45);
      }
      .fp3d-stats b {
        color: var(--fp3d-accent);
        font-weight: 700;
      }
      /* zoom and pan buttons (#297), centred on the right edge like the editor plan's; left of the stage when the controls are on the right */
      .fp3d-vnav {
        position: absolute;
        z-index: 2;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
      }
      .fp3d-side-right .fp3d-vnav {
        right: auto;
        left: 10px;
      }
      .fp3d-stats {
        padding: 4px 9px;
        border-radius: 8px;
        background: var(--fp3d-chrome);
        position: absolute;
        right: 10px;
        bottom: calc(8px + var(--fp3d-bottom-inset, 0px));
        font-size: 11.5px;
        color: var(--fp3d-muted);
        font-variant-numeric: tabular-nums;
        pointer-events: none;
        /* the buttons (search, hide, star) fill the corner on the controls' side: the line keeps clear of them and wraps (#241) */
        max-width: calc(100% - 126px);
        text-align: right;
        text-wrap: balance;
      }
      .fp3d-side-right .fp3d-stats {
        right: 116px;
      }
      .fp3d-error {
        position: absolute;
        inset: auto 16px 16px;
        color: var(--fp3d-danger);
      }
      /* phones (#93): Walk as a 44 px symbol that stays above the energy cards; 44 px touch targets */
      @media ${unsafeCSS(PHONE_MEDIA)} {
        .fp3d-stage {
          --fp3d-walk-w: 44px;
        }
        .fp3d-walk-btn {
          z-index: 5;
          width: 44px;
          height: 44px;
          padding: 0;
          justify-content: center;
        }
        .fp3d-walk-label {
          display: none;
        }
        .fp3d-thumbs-fold,
        .fp3d-find-btn,
        .fp3d-central-btn,
        .fp3d-eye {
          width: 44px;
          height: 44px;
        }
        /* the star and the eye: the panel docks them at the start of its bottom bar (--fp3d-dock-*, #346), same size
           and shape as its buttons; elsewhere (a card) they keep their corner */
        .fp3d-eye {
          left: calc(var(--fp3d-dock-left, 12px) + 50px);
          bottom: var(--fp3d-dock-bottom, calc(10px + var(--fp3d-bottom-inset, 0px)));
          border: 0;
          border-radius: 14px;
          background: var(--fp3d-chrome);
          box-shadow: var(--fp3d-shadow);
        }
        .fp3d-eye-clean {
          left: var(--fp3d-dock-left, 12px);
        }
        .fp3d-central-btn {
          left: var(--fp3d-dock-left, 12px);
          bottom: var(--fp3d-dock-bottom, calc(62px + var(--fp3d-bottom-inset, 0px)));
          border-radius: 14px;
        }
        .fp3d-central {
          bottom: var(--fp3d-dock-menu, calc(104px + var(--fp3d-bottom-inset, 0px)));
        }
        .fp3d-side-right :is(.fp3d-central-btn, .fp3d-eye-clean) {
          left: auto;
          right: var(--fp3d-dock-left, 12px);
        }
        .fp3d-side-right .fp3d-eye {
          left: auto;
          right: calc(var(--fp3d-dock-left, 12px) + 50px);
        }
        /* no search button in the stage: the eye takes the dock's corner and the star (and its menu) rise above it (#422) */
        .fp3d-no-find .fp3d-eye {
          left: var(--fp3d-dock-left, 12px);
        }
        .fp3d-side-right.fp3d-no-find .fp3d-eye {
          left: auto;
          right: var(--fp3d-dock-left, 12px);
        }
        .fp3d-no-find .fp3d-central-btn {
          bottom: calc(var(--fp3d-dock-bottom, calc(10px + var(--fp3d-bottom-inset, 0px))) + 52px);
        }
        .fp3d-no-find .fp3d-central {
          bottom: calc(var(--fp3d-dock-menu, calc(52px + var(--fp3d-bottom-inset, 0px))) + 52px);
        }
        .fp3d-thumbs-compact .fp3d-thumb,
        .fp3d-thumb-house {
          min-height: 44px;
        }
      }
      /* touch targets of the viewer's small controls: 44 px (#181) */
      @media (pointer: coarse) {
        .fp3d-alert-x,
        .fp3d-eye,
        .fp3d-sheet-x,
        .fp3d-person,
        .fp3d-thumbs-fold,
        .fp3d-find-btn,
        .fp3d-central-btn,
        .fp3d-holo-media-controls button {
          min-width: 44px;
          min-height: 44px;
        }
        .fp3d-walk-btn,
        .fp3d-sheet-chip,
        .fp3d-sheet-input,
        .fp3d-alert-menu button {
          min-height: 44px;
        }
      }
    `,
  ];
}

defineElement("fp3d-view3d", Fp3dView3d);

/** Power as "850 W" or "1,2 kW". */
/** A water_heater entity on a pack's heater: "Eco · 48 °C" and whether it is on (not off or gone), #645. */
export function waterHeaterText(hass: HomeAssistant, st: HassEntity): { text: string; on: boolean } {
  const t = st.attributes.current_temperature;
  const temp = typeof t === "number" && Number.isFinite(t) ? `${formatNumber(hass, Math.round(t))} °C` : "";
  const on = !["off", "unavailable", "unknown"].includes(st.state);
  return { text: [stateText(hass, st), temp].filter(Boolean).join(" · "), on };
}

function formatPower(hass: HomeAssistant | undefined, w: number): string {
  return Math.abs(w) >= 1000 ? `${formatNumber(hass, w / 1000, 1)} kW` : `${Math.round(w)} W`;
}

/** Marker height above furniture: in front of a screen, above wall units, else just above the top. */
/** "#rrggbb" as a glow colour (0..1 per channel), or null when it is none (#289). */
function activeGlow(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : null;
}

/** A running washer or dryer: a ring of light round its round door (#516); a dishwasher: its front. */
function runGlow(type: string): ScreenState {
  const color: [number, number, number] = [0.3, 0.85, 1];
  return type === "washer" || type === "dryer" ? { color, level: 0.8, faces: [{ part: "drum", color, level: 0.8 }] } : { color, level: 0.8 };
}

/** Furniture nobody asks to see by voice (the floor itself, holes, helpers). */
const UNSPOKEN = new Set(["rug", "stairwell", "grid_point", "worktop"]);

function markerHeight(f: Furniture): number {
  if (f.type === "tv_board") return f.h + 0.9;
  // wall TV and wall cabinet: above the item (their height above the floor comes from mountBase)
  if (f.type === "tv_wall" || f.type === "kitchen_wall") return f.h + 0.25;
  return f.h + 0.35;
}

/** Module cards that show their minor values on a narrow card (a list of module ids, kept on this device). */
const MODULE_FULL_KEY = "home3d.module_full";

function readModuleFull(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MODULE_FULL_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
