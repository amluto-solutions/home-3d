// 2D editor: floors, rooms (rectangles and free shapes), snapping, undo, background template.
// The element (reactive state, fields, getters, the Lit lifecycle, render) lives here; the methods of each editor area
// live in a module under editor/ and are copied onto this class (editor/parts.ts, #202). Styles: editor/styles/.

import { defineElement } from "../define.ts";
import { html, LitElement, nothing, svg, type PropertyDeclaration, type PropertyValues, type TemplateResult } from "lit";
import { shellStyles } from "./editor/styles/shell.ts";
import { planStyles } from "./editor/styles/plan.ts";
import { sideStyles } from "./editor/styles/side.ts";
import { wallViewStyles } from "./editor/styles/wall-view.ts";
import { menuStyles } from "./editor/styles/menus.ts";
import { wallsRoofStyles } from "./editor/styles/walls-roof.ts";
import { formStyles } from "./editor/styles/forms.ts";
import { phoneStyles } from "./editor/styles/phone.ts";
import { typeCardStyles } from "./editor/styles/type-cards.ts";
import type { Snapshot } from "../api.ts";
import { lengthUnit, type LengthUnit } from "../units.ts";
import type { AlignLines } from "../geometry/snap-guides.ts";
import { nextPick } from "../geometry/pick.ts";
import "./item-list-view.ts";
import type { ConnectVia } from "../pool-runs.ts";
import { labOn } from "../features.ts";
import type { FlowSegment } from "../energy.ts";
import type { SurfaceGrab } from "../viewer/viewer3d.ts";
import type { FreeWall } from "../model.ts";
import { generateWalls } from "../geometry/walls.ts";
import { languageReady, loadLanguage, translate, type I18nKey } from "../i18n.ts";
import { beforeSelectionChange, selectionMoved } from "../focus-release.ts";
import { clipboardKey } from "../clipboard.ts";
import { TypedCommit } from "../typed-commit.ts";
import { modulePipeRules, type ModuleField, type PipeRules } from "../modules.ts";
import { FURNITURE_SIZE, isLamp, LAMP_MODEL, type OpeningPreset, uid, type Building, type Floor, type Furniture, type FurnitureType, type RoofSection, type OutdoorArea, type OutdoorType, type Placement, type Opening, type Room, type Vec2, setTerrain } from "../model.ts";
import { controls, tokens } from "../styles.ts";
import "./entity-picker.ts";
import type { HassFloor, HomeAssistant } from "../types.ts";
import type { EditorUser } from "../editors.ts";
import { load3d } from "../load3d.ts";
import { ensureRecipes, packTypesIn } from "../pack-recipes.ts";
import "./ask-dialog.ts";
import { isHelpKey } from "../help.ts";
import { touchOnly, touchWording, type Tool } from "../editor-hint.ts";
import type { RackElevation } from "../rack-elevation.ts";
import type { LibraryEntry } from "../library-index.ts";
import { detectCameraModel, setCameraLook } from "../camera-models.ts";
import type { WallMode } from "../viewer/viewer3d.ts";
import { isPackType, packItem, setPacks, setPlanRecipes, type FurniturePack, type PackItem } from "../packs.ts";
import { UndoHistory } from "../undo-history.ts";
import { EntityOptionCache } from "../entity-options.ts";
import { HassWatch } from "../hass-watch.ts";
import { chosenPoint, type PlanPoint } from "./editor/points.ts";
import { focusItemBar, sideFreeze } from "./editor/item-bar.ts";
import { guard } from "lit/directives/guard.js";
import { ENTITY_DRAG, type ResizeNote, type FixKind, type Drag, type Guides, type EditorTopic, type PlaceTarget, round, type RunDraft, type RunCtx, ARROWS, echoedPlan } from "./editor/helpers.ts";
import { startsFullWidth } from "../start-checklist.ts";
import { mixParts } from "./editor/parts.ts";
import { Pane3dPart } from "./editor/pane3d.ts";
import { PlanViewPart } from "./editor/plan-view.ts";
import { PointerPart } from "./editor/pointer.ts";
import { KeysPart } from "./editor/keys.ts";
import { RoomsPart } from "./editor/rooms.ts";
import { WallsPart } from "./editor/walls.ts";
import { OutdoorPart } from "./editor/outdoor.ts";
import { FloorsPart } from "./editor/floors.ts";
import { RoofPart } from "./editor/roof.ts";
import { SolarPart } from "./editor/solar.ts";
import { EnergyPart } from "./editor/energy.ts";
import { SelectionPart } from "./editor/selection.ts";
import { OpeningsPart } from "./editor/openings.ts";
import { FurniturePart } from "./editor/furniture.ts";
import { ItemFormPart } from "./editor/item-form.ts";
import { ItemSectionsPart } from "./editor/item-sections.ts";
import { PanelHeadPart } from "./editor/panel-head.ts";
import { settleSideDrag, syncSideDrag } from "./editor/side-drag.ts";
import { ItemFoldsPart } from "./editor/item-folds.ts";
import { DevicePanelPart } from "./editor/device-panel.ts";
import { CamerasPart } from "./editor/cameras.ts";
import { ToolbarPart } from "./editor/toolbar.ts";
import { SidePanelPart } from "./editor/side-panel.ts";
import { RacksPart } from "./editor/racks.ts";
import { WallViewPart } from "./editor/wall-view.ts";
import { WallKitPart } from "./editor/wall-kit.ts";
import { PipesPart } from "./editor/pipes.ts";
import { PoolPart } from "./editor/pool.ts";
import { AreaSelectPart } from "./editor/area-select.ts";
import { ToolPanelPart } from "./editor/tool-panels.ts";
import { OutdoorFindPart } from "./editor/outdoor-find.ts";
import { FieldsPart } from "./editor/fields.ts";
import { SettingsPart } from "./editor/settings.ts";
import { preloadParts } from "./editor/lazy.ts";
import { BackupPart } from "./editor/backup.ts";
import { PhonePart, type SheetHeight } from "./editor/phone.ts";
import { PetsPart } from "./editor/pets.ts";
import { vacuumTag } from "./editor/vacuums.ts";
import { sameFloorName } from "../floor-link.ts";
import { BackLayers } from "../back-stack.ts";
export type { EditorTopic };


export class Fp3dEditor extends LitElement {
  static properties = {
    _shiftX: { state: true },
    _shiftAll: { state: true },
    _bgEdit: { state: true },
    _bgRuler: { state: true },
    _bgRulerLen: { state: true },
    _bgLevel: { state: true },
    _bgOpen: { state: true },
    _shiftZ: { state: true },
    hass: { attribute: false },
    building: { attribute: false },
    narrow: { type: Boolean },
    packs: { attribute: false },
    _preview: { state: true },
    _libUpdates: { state: true },
    _libBrowse: { state: true },
    _itemPicker: { state: true },
    _doc: { state: true },
    _doc3d: { state: true },
    _split: { state: true },
    _splitRatio: { state: true },
    _backupBusy: { state: true },
    _wall3d: { state: true },
    _solarDim: { state: true },
    _sidePinned: { state: true },
    _sideMin: { state: true },
    _sideOpen: { state: true },
    _floorId: { state: true },
    _roomId: { state: true },
    _vertex: { state: true },
    _point: { state: true },
    _openingId: { state: true },
    _furnitureId: { state: true },
    _multi: { state: true },
    _multiOut: { state: true },
    _hiddenItems: { state: true },
    _placing: { state: true },
    _placeAt: { state: true },
    _snapOn: { state: true },
    _single: { state: true },
    _multiMode: { state: true },
    _deviceId: { state: true },
    _petId: { state: true },
    _petPick: { state: true },
    _vacAlign: { state: true },
    _deviceQuery: { state: true },
    _devSource: { state: true },
    _unplacedOpen: { state: true },
    _unplacedHiddenView: { state: true },
    _roofId: { state: true },
    _solarId: { state: true },
    _solarPick: { state: true },
    _roofWinId: { state: true },
    _energyNote: { state: true },
    _cableId: { state: true },
    _expanded: { state: true },
    _notice: { state: true },
    _resize: { state: true },
    _history: { state: true },
    _spots: { state: true },
    _outdoorId: { state: true },
    _wallId: { state: true },
    _edgeHi: { state: true },
    _wallView: { state: true },
    _wallSel: { state: true },
    _wallMulti: { state: true },
    _wallSingle: { state: true },
    _wallGap: { state: true },
    _wallCat: { state: true },
    _wallQuery: { state: true },
    _wallFrame: { state: true },
    _wallPicTick: { state: true },
    _wallPick: { state: true },
    _kerbPick: { state: true },
    _runMode: { state: true },
    _techMode: { state: true },
    _feedKind: { state: true },
    _techAsk: { state: true },
    _runDraft: { state: true },
    _runSel: { state: true },
    _conn: { state: true },
    _jointPlace: { state: true },
    _card: { state: true },
    _cardJoin: { state: true },
    _wallView3d: { state: true },
    _ctx: { state: true },
    _fixedHint: { state: true },
    _openingNote: { state: true },
    _help: { state: true },
    _rackSheet: { state: true },
    _floorMenu: { state: true },
    _openingPreset: { state: true },
    _measureLen: { state: true },
    _packages: { state: true },
    _rectSize: { state: true },
    _rectName: { state: true },
    _wallsOpen: { state: true },
    _tool: { state: true },
    _toolMenu: { state: true },
    _sideWidth: { state: true },
    _toolOpen: { state: true },
    _viewMenu: { state: true },
    _draft: { state: true },
    _outdoorFree: { state: true },
    _areaFree: { state: true },
    _outdoorType: { state: true },
    _poolShape: { state: true },
    _pipeMode: { state: true },
    _pipeDraft: { state: true },
    _pipeId: { state: true },
    _cursor: { state: true },
    // a snap computed again on every pointer move is mostly the same: only a different one draws the plan again (#130)
    _guides: { state: true, hasChanged: (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b) },
    _view: { state: true },
    _size: { state: true },
    _images: { state: true },
    _canUndo: { state: true },
    _canRedo: { state: true },
    canEdit: { attribute: false },
    home: { attribute: false },
    homeName: { attribute: false },
    history: { attribute: false },
    topic: { attribute: false },
    _phone: { state: true },
    _sheeted: { state: true },
    _sheet: { state: true },
    _typing: { state: true },
    _hintOff: { state: true },
  };

  /** Home Assistant as handed in; `hass` reads it through `hassWatch` while rendering (#130). */
  rawHass: HomeAssistant | undefined;
  readonly hassWatch = new HassWatch();
  readonly optionCache = new EntityOptionCache();

  get hass(): HomeAssistant {
    const h = this.rawHass;
    // while rendering, the states it reads are noted: a later state change of anything else needs no render
    return (h && this.hassWatch.rendering ? this.hassWatch.wrap(h) : h) as HomeAssistant;
  }

  set hass(value: HomeAssistant) {
    this.rawHass = value;
  }

  declare building: Building;
  /** On the editors list (#7), from the panel's controller; unset: admins are. */
  declare canEdit: boolean | undefined;
  /** The home being edited (#53): pictures, restore points and backups go there; unset: the active home. */
  declare home: string | null | undefined;
  /** Its name (#160: the HA-areas import says which home its rooms go into). */
  declare homeName: string | null | undefined;
  /** The undo history (#66): the panel's, so it outlives this element when another tab opens; else its own. */
  declare history: UndoHistory;
  /**
   * One part of the editor shown on its own on the Settings page (#139: favourites, own buttons, backup …), without
   * the plan, the tools, the keyboard shortcuts or the library; null: the whole editor.
   */
  declare topic: EditorTopic | null;
  declare narrow: boolean;
  /** Imported furniture packs (from the panel's controller). */
  declare packs: FurniturePack[] | undefined;
  /** Result of the last pack import. */
  /** Picture of the furniture under the pointer in the library. */
  declare _preview: { type: string; url: string | null; left: number; top: number } | null;
  /** The furniture types of placed items with an update (#48), shown on the library's cards. */
  declare _libUpdates: ReadonlySet<string>;
  /** The Library shows the Browse tab (#336): the packs the curated index lists. */
  declare _libBrowse: boolean;
  declare _itemPicker: boolean;
  declare _doc: Building;
  /** The draft as the 3D pane shows it (follows _doc with a short delay, so drags stay smooth). */
  declare _doc3d: Building;
  doc3dTimer: ReturnType<typeof setTimeout> | undefined;
  /** The live 3D pane next to the plan (remembered per browser). */
  declare _split: boolean;
  /** Share of the width the plan takes next to the 3D pane (0.2 … 0.8). */
  declare _splitRatio: number;
  declare _backupBusy: boolean;
  /** Walls in the 3D pane: full height ("auto") or cut at the cut height (shows wall units and shelves). */
  declare _wall3d: WallMode;
  /** Energy tool: roof solar fields drawn faint over the floor plan (the selected one stays full), per device (#89). */
  declare _solarDim: boolean;
  /** Sidebar beside the 3D pane: pinned open always, or folded to a strip while nothing is selected. */
  declare _sidePinned: boolean;
  /** The sidebar folded to a narrow strip beside the plan (more room to move furniture); remembered per browser. */
  declare _sideMin: boolean;
  declare _sideOpen: boolean;
  declare _floorId: string | null;
  declare _roomId: string | null;
  declare _vertex: number | null;
  /** The chosen point of an outdoor area or a roof outline (#395); a room's corner is `_vertex`. */
  declare _point: PlanPoint | null;
  declare _openingId: string | null;
  declare _furnitureId: string | null;
  /** Several furniture items selected together (shift-click, a frame); empty = the usual single selection. */
  declare _multi: string[];
  /** Outdoor areas in a multi selection (#400), alone or with the items of `_multi` / `_furnitureId`. */
  declare _multiOut: string[];
  /** Items hidden in this editor's plan only (#75), to reach what lies under them; not saved. */
  declare _hiddenItems: string[];
  /** A library card waiting for a click on the plan that places it (#76). */
  declare _placing: { type: string; mirror: boolean } | null;
  /** Where the armed card would land (the pointer over the plan), for its outline. */
  declare _placeAt: PlaceTarget | null;
  /** Snapping on (#173): the switch in the placement bar, for touch; Shift turns it off for one move. Remembered per device. */
  declare _snapOn: boolean;
  /** Alignment lines for placing an armed card (#143), gathered again when the floor changes. */
  placeLines: { floor: Floor; lines: AlignLines } | null = null;
  /** One part of a furniture block is edited on its own (double-click), not the whole block. */
  declare _single: boolean;
  /** Touch: taps add items to the selection, a drag on empty ground draws a frame. */
  declare _multiMode: boolean;
  /** The last tap on a furniture item, for the double-tap into a block. */
  lastFurnTap: { id: string; t: number } | null = null;
  /** Whether Shift is held (the 3D views report taps without their keys). */
  shiftHeld = false;
  readonly onShift = (e: KeyboardEvent) => (this.shiftHeld = e.shiftKey);
  /** The window lost the keys (Alt+Tab with Shift down, a hidden tab): no keyup comes, so Shift is let go here. */
  readonly onKeysLost = () => (this.shiftHeld = false);
  /** Library pictures for the wall view's side bar (type -> image). */
  kitPics = new Map<string, string>();
  kitPicsAsked = new Set<string>();
  declare _deviceId: string | null;
  /** Roaming pets (#337): the pet whose panel is open, and the place the next tap in the plan sets ("spot:new", "spot:<id>", "trigger:<id>"). */
  declare _petId: string | null;
  declare _petPick: string | null;
  /** Robot vacuum maps (#350): the map being aligned over the plan, and where the plan's taps go meanwhile. */
  declare _vacAlign: string | null;
  _vacPick: ((p: Vec2) => void) | null = null;
  declare _deviceQuery: string;
  /** Which devices the room form lists: its own area, other areas, or entities without an area. */
  declare _devSource: "area" | "other" | "none";
  /** The floor overview's "Unplaced entities" list is open (#83; computed only then), and shows the hidden ones. */
  declare _unplacedOpen: boolean;
  declare _unplacedHiddenView: boolean;
  /** Selected roof section (tool "roof"). */
  declare _roofId: string | null;
  /** Selected solar field (roof tool). */
  declare _solarId: string | null;
  /** Solar field form: taps in the plan switch single modules on and off. */
  declare _solarPick: boolean;
  /** Selected roof window (roof tool). */
  declare _roofWinId: string | null;
  /** What the import from the energy dashboard did (shown under its button). */
  declare _energyNote: string | null;
  /** The cable picked in the energy tool (its key), shown with its points in the plan. */
  declare _cableId: string | null;
  /** The cables' ways for the plan, computed once per document. */
  cableCache: { doc: Building; segs: FlowSegment[] } | null = null;
  /** Furniture library: the search text, and which sections are open (built-in groups and packs). */
  /** Devices whose further entities are unfolded in the device list. */
  declare _expanded: Set<string>;
  /** Short confirmation shown after an action (e.g. closed gaps). */
  declare _notice: string | null;
  /** What the last outline edit of a room carried or left outside (#64); stale once the document moves on. */
  declare _resize: ResizeNote | null;
  /** Restore points, loaded when the backup section is opened. */
  declare _history: Snapshot[] | null;
  /** The opt-in reports: their status (null = not loaded, "error" = backend without them). */
  /** Open "place spots" form of the selected room. */
  declare _outdoorId: string | null;
  /** Selected free-standing wall. */
  declare _wallId: string | null;
  /** Selected room wall (id from generateWalls), to set its height. */
  /** Edge of the selected room highlighted from the wall height list. */
  declare _edgeHi: number | null;
  /** The wall view: a room's wall seen from the front (what stands and hangs on it), and the piece chosen in it. */
  declare _wallView: { roomId: string; edge: number } | null;
  declare _wallSel: string | null;
  /** Wall view: several pieces chosen together (shift-click, a frame); empty = the usual single choice. */
  declare _wallMulti: string[];
  /** Wall view: one part of a block moved on its own ("Only this part"). */
  declare _wallSingle: boolean;
  /** Wall view: the free stretch of wall tapped (from s0 to s1 along the wall; low = standing pieces, else hanging). */
  declare _wallGap: { s0: number; s1: number; low: boolean } | null;
  /** Wall view side bar: the category shown and the search text. */
  declare _wallCat: string | null;
  declare _wallQuery: string;
  /** Wall view: the frame being drawn (view coordinates). */
  declare _wallFrame: { x0: number; y0: number; x1: number; y1: number } | null;
  declare _wallPicTick: number;
  /** The toolbar's wall view button is on: the next tap on a wall in the plan opens it. */
  declare _wallPick: boolean;
  /** A bin's "Set kerb spot" is on (#142): the next tap in the plan is where the bin stands while it is out. */
  declare _kerbPick: boolean;
  /** Pool module in the wall view: laying a pipe, or placing a ball valve or sight glass on one. */
  declare _runMode: "draw" | "valve" | "sight" | "hole_wall" | "hole_floor" | "tee" | "y" | "feed" | "erase" | null;
  /** Pool module, technical-room mode: the wall view draws the technical room (devices, lines from outside, pipes). */
  declare _techMode: boolean;
  /** The pool line being brought in ("skimmer", "drain", "inlet", "waste"): the next tap on the wall places it. */
  declare _feedKind: string | null;
  /** Where a press in the drawing went down (a drag from there draws a pipe to where it is let go). */
  techPress: { s: number; y: number } | null = null;
  /** The pen: the stroke under the pointer (wall coordinates), made into a pipe with right angles when let go. */
  techStroke: { s: number; y: number }[] | null = null;
  /** A stroke ended on nothing: the pipe is laid with a loose end, and the side bar offers where the line could go. */
  declare _techAsk: { s: number; y: number; pipe: string } | null;
  /** The zoomed part of the 2D wall view (svg units), per wall; null: the whole wall. */
  wvZoom: { key: string; k: number; x0: number; y0: number } | null = null;
  /** Touch points on the 2D wall view, and a two-finger zoom under way. */
  wvTouch = new Map<number, { x: number; y: number }>();
  wvPinch: { d: number; mx: number; my: number; k: number; x0: number; y0: number } | null = null;
  /** A touch while drawing waits for its release (a second finger makes it a zoom instead of a point). */
  wvTap: { s: number; y: number } | null = null;
  wvScale = 1;
  /** The wall about to be picked opens straight in technical-room mode (asked from the pool tool). */
  techPick = false;
  /** Pool module: the part whose card is open ("dev:<id>", "joint:<id>", "port:<id>") and its pool. */
  declare _card: { pool: string; part: string } | null;
  /** The card's open connection being joined: its target and stops. */
  declare _cardJoin: { port: string; to: string; vias: ConnectVia[] } | null;
  /** Pool module: a T- or Y-piece waiting for a tap in the plan (on a pipe it is put into the pipe). */
  declare _jointPlace: "tee" | "y" | null;
  /** Pool module: the connection being put together in the pool tool (from, its stops, one or two ends). */
  declare _conn: { from: string; vias: ConnectVia[]; to: string; to2: string };
  declare _runDraft: RunDraft | null;
  /** The chosen pipe in the wall view and its chosen point. */
  declare _runSel: { pipe: string; pt: number | null } | null;
  /** A pipe point being dragged in the wall view, and where the pointer is while laying a pipe. */
  runDrag: { pipe: string; i: number; d: number; base: Building; moved: boolean } | null = null;
  runHover: [number, number] | null = null;
  /** A T-/Y-piece or hole being dragged in the wall view (along the wall and up or down; a hole in the floor along only). */
  jointDrag: { id: string; d: number; base: Building; moved: boolean } | null = null;
  /** A ball valve or sight glass being dragged along its pipe (a tap without moving opens or closes a valve). */
  fitDrag: { pipe: string; id: string; base: Building; moved: boolean; x: number; y: number } | null = null;
  /** The wall shown in the 3D wall view, for laying pipes there. */
  runCtx3d: RunCtx | null = null;
  /** The wall view stands in the room in 3D (true) or shows the wall flat from the front. */
  declare _wallView3d: boolean;
  /** The 3D view of the wall view and the wall its camera was last set up for. */
  wall3dEl: HTMLElement | null = null;
  wall3dKey = "";
  /** The height handle over the chosen piece in the 3D wall view (screen position, height text), and a lift in progress. */
  liftRaf = 0;
  lift: { id: string; y: number; startY: number; perPx: number; base: Building; top: number; moved: boolean } | null = null;
  /** Wall view: a size handle being dragged (side l/r = width along the wall, t/b = top or bottom edge). */
  wallResize: { id: string; side: "l" | "r" | "t" | "b"; x0: number; x1: number; y0: number; y1: number; base: Building; moved: boolean } | null = null;
  wallDrag: { id: string; ids?: string[]; w?: number; x: number; y: number; base: Building; s0: number; y0: number; lift: boolean; moved: boolean } | null = null;
  /** Front pictures of the pieces in the wall view, by type, size and turn (null: none to draw); asked for once. */
  wallPics = new Map<string, { url: string; x0: number; x1: number; y0: number; y1: number } | null>();
  wallPicsAsked = new Set<string>();
  declare _shiftX: number;
  /** Shift and turn take every floor with them (roof, outdoor areas, cables, hologram included). */
  declare _shiftAll: boolean;
  /** The background picture is being moved and scaled in the plan (drag it, pull its corner). */
  declare _bgEdit: boolean;
  /** Scale the background with a ruler (#183): null = off, else the points tapped so far (two = waiting for the length). */
  declare _bgRuler: Vec2[] | null;
  declare _bgRulerLen: number;
  /** Straighten the background: two taps along a wall that should run straight (null = off). */
  declare _bgLevel: Vec2[] | null;
  /** The background section is open: the picture has handles like a piece of furniture (move, scale, turn). */
  declare _bgOpen: boolean;
  declare _shiftZ: number;
  /** Open context menu (right-click, long press) at a plan point, for one item. */
  /** The item menu: where, on what; `point` for a point's menu (#395), `bar` when the item toolbar's "⋯" opened it (#398). */
  declare _ctx: { x: number; y: number; kind: FixKind; id: string; point?: PlanPoint; bar?: boolean } | null;
  /** A drag on a fixed item was turned into panning: the hint line says why. */
  declare _fixedHint: boolean;
  /** Doors & windows mode: why the last tap added nothing (it would overlap another opening), shown in the hint bar (#62). */
  declare _openingNote: string | null;
  /** Doors & windows mode: what a tap where the mouse rests would do (#62). */
  /** What a tap in Doors & windows mode would do where the mouse rests (#62): written straight into the hint bar (#130). */
  openingHoverText: string | null = null;
  get _openingHover(): string | null {
    return this.openingHoverText;
  }
  set _openingHover(text: string | null) {
    if (text === this.openingHoverText) return;
    this.openingHoverText = text;
    // the hint text alone changes: no render of the whole editor on every mouse move
    const shown = this.renderRoot?.querySelector?.(".fp3d-hint-text") as HTMLElement | null | undefined;
    if (shown) shown.textContent = this.hintText();
  }
  /** The '?' help overlay (#95) is open. */
  declare _help: boolean;
  /** The rack whose "Edit rack" sheet is open (#113; its furniture id). */
  declare _rackSheet: string | null;
  /** A one-time invitation for admins to switch on the usage reports (while they are off and it was not closed). */
  fixedPan = false;
  /** Frame the 3D half again after the next render (the roof tool shows the whole house). */
  reframe3d = false;
  pressTimer = 0;
  pressStart: [number, number] | null = null;
  /** The "add floor" menu with the floors of Home Assistant is open. */
  declare _floorMenu: boolean;
  /** Kind of opening the opening tool places (the last one chosen). */
  declare _openingPreset: OpeningPreset;
  /** Length typed for the next wall when drawing by measure, and the size for "rectangle by size". */
  declare _measureLen: number;
  /** The package list of the selected room is open. */
  declare _packages: boolean;
  declare _rectSize: [number, number];
  /** Name typed for the next "Rectangle by size" room (#65); empty = "Room N". */
  declare _rectName: string;
  /** The room panel's Walls section is unfolded (#67; per browser, `home3d.wallsOpen`). */
  declare _wallsOpen: boolean;
  declare _spots: { type: FurnitureType; rows: number; cols: number; entity: string | null } | null;
  declare _tool: Tool;
  /** The toolbar menu open (its group), and which tool's choices are unfolded in it. */
  declare _toolMenu: string | null;
  /** Width of the side bar (px), dragged at its left edge and remembered per browser (#620). */
  declare _sideWidth: number;
  /** What the last module import said (the ⚙ Module dialog). */
  sideDrag: { x: number; width: number } | null = null;
  declare _toolOpen: Tool | null;
  /** The view menu of the toolbar (fit, 3D beside, wall view, lock) is open. */
  declare _viewMenu: boolean;
  declare _draft: Vec2[];
  /** Outdoor tool: corner by corner like a free-form room instead of a dragged rectangle (#97). */
  declare _outdoorFree: boolean;
  /** The Outside panel's shape choice for areas (#402): by their corners rather than as a dragged rectangle. */
  declare _areaFree: boolean;
  /** What the outdoor tool draws next (lawn, terrace, pool …), chosen before drawing. */
  declare _outdoorType: OutdoorType;
  /** Pools: the shape drawn next (rectangle, round, oval or free). */
  declare _poolShape: "rect" | "round" | "oval" | "free";
  /** Pool tool: drawing a pipe (tap a node, corner points, the end node) and the pipe being drawn. */
  declare _pipeMode: boolean;
  /** A pipe being drawn in the plan: from a node, or on from a pipe's loose end (laid on a wall, down into the floor). */
  declare _pipeDraft: { from: string; points: Vec2[]; extend?: { pipe: string; end: "from" | "to"; at: Vec2 } } | null;
  /** Pool tool: the selected pipe (its corner points can be dragged). */
  declare _pipeId: string | null;
  declare _cursor: Vec2 | null;
  declare _guides: Guides;
  declare _view: { scale: number; ox: number; oy: number };
  declare _size: { w: number; h: number };
  declare _images: Record<string, { url: string; aspect: number }>;
  declare _canUndo: boolean;
  declare _canRedo: boolean;
  /** The phone editor (#250, editor/phone.ts): the screen is phone-wide; the details sheet's height; a text field has the
   *  keyboard (the bottom bar steps aside); the one-line hint was hidden (remembered on this device). */
  declare _phone: boolean;
  /** The side panel is the details sheet: on a phone, a tablet held upright and a phone held sideways (#250). */
  declare _sheeted: boolean;
  declare _sheet: SheetHeight;
  declare _typing: boolean;
  declare _hintOff: boolean;
  phoneWatch: { media: (MediaQueryList | null)[]; onMedia: () => void; onFocus: (e: Event) => void; onPointer: (e: Event) => void } | null = null;
  /** What the sheet showed at the last render (editor/phone.ts syncSheet), and whether the floor's settings asked for it. */
  sheetFor: string | null = null;
  floorSheet = false;
  sheetSwipe: number | null = null;
  /** Android's back gesture closes the sheet, then a menu (back-stack.ts). */
  readonly backLayers = new BackLayers();

  drag: Drag | null = null;
  /** Set while a change that may join the last undo step runs (arrow nudges, #66). */
  mergeKey: string | null = null;
  /** How long after the last change of `mergeKey` a change still joins its step (a typed value: as long as it is typed). */
  mergeWithin: number | undefined = undefined;
  pointers = new Map<number, [number, number]>();
  pinch: { dist: number; mid: [number, number] } | null = null;
  fitted = false;
  /** The view fit() set last (the plan follows size changes until it is moved). */
  fittedView: unknown = null;
  /** The last fit framed everything (plot, garden items), not just the house: a resize keeps that (#91). */
  fittedAll = false;
  resizeObserver?: ResizeObserver;
  loadingImages = new Set<string>();

  constructor() {
    super();
    this.narrow = false;
    this._floorId = null;
    this._roomId = null;
    this._vertex = null;
    this._point = null;
    this._openingId = null;
    this._furnitureId = null;
    this._multi = [];
    this._multiOut = [];
    this._hiddenItems = [];
    this._placing = null;
    this._placeAt = null;
    this._snapOn = (() => {
      try {
        return localStorage.getItem("home3d.snap") !== "0";
      } catch {
        return true;
      }
    })();
    this._single = false;
    this._multiMode = false;
    this._deviceId = null;
    this._deviceQuery = "";
    this._devSource = "area";
    this._unplacedOpen = false;
    this._unplacedHiddenView = false;
    this._roofId = null;
    this._solarId = null;
    this._solarPick = false;
    this._roofWinId = null;
    this._energyNote = null;
    this._cableId = null;
    this._expanded = new Set();
    this._notice = null;
    this._openingNote = null;
    this._openingHover = null;
    this._history = null;
    this._spots = null;
    this._outdoorId = null;
    this._wallId = null;
    this._edgeHi = null;
    this._wallView = null;
    this._techMode = false;
    this._feedKind = null;
    this._techAsk = null;
    this._wallSel = null;
    this._wallMulti = [];
    this._wallSingle = false;
    this._wallGap = null;
    this._wallCat = null;
    this._wallQuery = "";
    this._wallFrame = null;
    this._wallPicTick = 0;
    this._wallPick = false;
    this._kerbPick = false;
    this._petId = null;
    this._petPick = null;
    this._vacAlign = null;
    this._runMode = null;
    this._runDraft = null;
    this._runSel = null;
    this._conn = { from: "", vias: [], to: "", to2: "" };
    this._jointPlace = null;
    this._card = null;
    this._cardJoin = null;
    this._wallView3d = (() => {
      try {
        return localStorage.getItem("home3d.wall3d") !== "0";
      } catch {
        return true;
      }
    })();
    this._shiftX = 0;
    this._shiftAll = false;
    this._bgEdit = false;
    this._bgRuler = null;
    this._bgRulerLen = 0;
    this._bgLevel = null;
    this._bgOpen = false;
    this._shiftZ = 0;
    this._floorMenu = false;
    this._openingPreset = "door";
    this._phone = false;
    this._sheeted = false;
    this._sheet = "closed";
    this._typing = false;
    this._hintOff = false;
    try {
      this._hintOff = localStorage.getItem("home3d.hintOff") === "1";
    } catch {
      // no storage: shown until closed
    }
    let split = false;
    try {
      split = localStorage.getItem("home3d.editor3d") === "1";
    } catch {
      // no storage
    }
    this._split = split;
    this._splitRatio = 0.55;
    try {
      const saved = Number(localStorage.getItem("home3d.editorSplit"));
      if (saved >= 20 && saved <= 80) this._splitRatio = saved / 100;
    } catch {
      /* no storage */
    }
    this._backupBusy = false;
    // the 3D pane's wall view stays as it was last set on this device (#309)
    this._wall3d = "cut";
    this._wallsOpen = false;
    try {
      if (localStorage.getItem("home3d.walls3d") === "auto") this._wall3d = "auto";
      this._wallsOpen = localStorage.getItem("home3d.wallsOpen") === "1";
    } catch {
      // no storage: the default
    }
    this._solarDim = true;
    try {
      if (localStorage.getItem("home3d.solarDim") === "off") this._solarDim = false;
    } catch {
      // no storage: dimmed
    }
    this._doc3d = this._doc;
    this._sideOpen = false;
    let pinned = true;
    try {
      pinned = localStorage.getItem("home3d.sidePinned") !== "0";
    } catch {
      // no storage
    }
    this._sidePinned = pinned;
    let min = false;
    try {
      min = localStorage.getItem("home3d.sideMin") === "1";
    } catch {
      // no storage
    }
    this._sideMin = min;
    this._preview = null;
    this._libUpdates = new Set();
    this._libBrowse = false;
    this._itemPicker = false;
    this._measureLen = 0;
    this._packages = false;
    this._rectSize = [4, 3];
    this._rectName = "";
    this._tool = "select";
    this._toolMenu = null;
    let width = 320;
    try {
      width = Number(localStorage.getItem("home3d.sideWidth")) || 320;
    } catch {
      // no storage: the default width
    }
    this._sideWidth = Math.min(640, Math.max(280, width));
    this._toolOpen = null;
    this._viewMenu = false;
    this._draft = [];
    this._outdoorFree = false;
    this._areaFree = false;
    this._outdoorType = "lawn";
    this._poolShape = "rect";
    this._pipeMode = false;
    this._pipeDraft = null;
    this._pipeId = null;
    this._cursor = null;
    this._guides = {};
    this._view = { scale: 50, ox: 40, oy: 40 };
    this._help = false;
    this._rackSheet = null;
    this._size = { w: 800, h: 600 };
    this._images = {};
    this._canUndo = false;
    this._canRedo = false;
    this.history = new UndoHistory();
    this.topic = null;
  }

  t(key: I18nKey, vars?: Record<string, string | number>): string {
    return translate(this.hass, key, vars);
  }

  // ------------------------------------------------------------------ lifecycle

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onShift);
    window.addEventListener("blur", this.onKeysLost);
    document.addEventListener("visibilitychange", this.onKeysLost);
    if (!this.topic) this.watchPhone(true);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onShift);
    window.removeEventListener("blur", this.onKeysLost);
    document.removeEventListener("visibilitychange", this.onKeysLost);
    this.watchPhone(false);
    this.resizeObserver?.disconnect();
    // the thumbnail renderer holds a WebGL context: freed with the editor, made anew when a picture is next drawn (#200)
    void load3d().then((mod) => mod.releasePreviewRenderer());
  }

  /**
   * Every property set passes here, straight after the new value is in. A new plan selection releases the box with
   * the cursor (#56): its shortcuts work again, the next search doesn't rename the item, and what was typed is saved
   * on the item it was typed for.
   */
  requestUpdate(name?: PropertyKey, oldValue?: unknown, ...rest: [PropertyDeclaration?, boolean?, unknown?]): void {
    if (typeof name === "string") beforeSelectionChange(this, name, oldValue, this.renderRoot as ShadowRoot | undefined);
    super.requestUpdate(name, oldValue, ...rest);
  }

  /**
   * A new `hass` for a state change of nothing the last render read (most of the several updates a second) needs no
   * render (#130): only the 3D views in the editor get it, as a render would have handed it to them.
   */
  protected shouldUpdate(changed: PropertyValues): boolean {
    // the panel hands back the plan this editor just made (building-changed): nothing new to draw (#391)
    if (changed.size === 1 && changed.has("building") && echoedPlan(this.building, this._doc)) return false;
    if (changed.size === 1 && changed.has("hass") && !this.hassWatch.matters(changed.get("hass") as HomeAssistant | undefined, this.rawHass)) {
      for (const view of this.renderRoot?.querySelectorAll?.("fp3d-view3d") ?? []) (view as HTMLElement & { hass?: HomeAssistant }).hass = this.rawHass;
      return false;
    }
    return true;
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

  protected willUpdate(changed: PropertyValues): void {
    // the editor's own plan handed back by the panel is no plan from elsewhere (#391): no pack update check for it
    const fromElsewhere = changed.has("building") && !echoedPlan(this.building, this._doc);
    // this bundle keeps its own pack registry – and its own language table, so it fetches the language itself
    if (changed.has("packs")) setPacks(this.packs ?? []);
    if (changed.has("_doc")) setTerrain(this._doc);
    if (changed.has("hass") && this.hass && !languageReady(this.hass.language)) void loadLanguage(this.hass.language, this.hass).then(() => this.requestUpdate());
    // the 3D pane and the wall view's 3D both show the draft (otherwise a piece moved in the wall view jumps back)
    if (changed.has("_doc") && (this._split || this._wallView)) this.queue3d();
    if ((changed.has("_split") && this._split) || (changed.has("_wallView") && this._wallView)) this._doc3d = this._doc;
    if (changed.has("_runDraft") && this._wallView) this._doc3d = this.docWithDraft();
    if (changed.has("_tool") && this.houseTool && !this._split && !this.narrow && !this._phone) this._split = true;
    // entering or leaving the roof tool: the 3D half frames the whole house (or the floor) again
    if (changed.has("_tool") && (this.houseTool || changed.get("_tool") === "roof" || changed.get("_tool") === "energy")) this.reframe3d = true;
    // an armed library card (#76) belongs to the floor and home it was picked on (#126)
    if (this._placing && (changed.has("home") || (changed.has("_floorId") && changed.get("_floorId") !== undefined))) this.cancelPlacing();
    // nothing chosen in one home stays chosen in another (#150): the new home's plan below picks its own start floor
    if (changed.has("home") && changed.get("home") != null) {
      this.selectItem("room", null);
      this._floorId = null;
    }
    if (changed.has("building") && this.building !== this._doc) {
      // the plan this panel's history leads up to keeps its steps (the tab was left and opened again, #66); a plan
      // from anywhere else (another home, the server, someone else's edit) starts a fresh history
      this.history.adopt(this.building, this.home);
      this.showHistory();
      // a drag still holding the plan from before would write it back over this one (#382)
      this.dropPlanGestures();
      this._doc = this.building;
      this._doc3d = this.building;
      // the first plan: the floor chosen in the house settings (D418), else the first of the list
      const start = this._doc.settings.editor_floor;
      if (this._floorId === null && start && this._doc.floors.some((f) => f.id === start)) this._floorId = start;
      if (!this._doc.floors.some((f) => f.id === this._floorId)) this._floorId = this._doc.floors[0]?.id ?? null;
      if (!this.floor?.rooms.some((r) => r.id === this._roomId)) this._roomId = null;
      // a home without rooms opens with the plan at full width (#193); the stored 3D beside choice is kept
      if (!this.startChecked && this._doc) {
        this.startChecked = true;
        if (startsFullWidth(this._doc, this._split)) this._split = false;
        // floors named like Home Assistant's link to them (#263)
        queueMicrotask(() => this.linkFloorsByName());
      }
    }
    // the plan's recipe copies (#2): placed items keep their look whatever the installed packs say
    setPlanRecipes(this._doc?.recipes);
    if (changed.has("_doc") || changed.has("packs")) this.fetchPlacedRecipes();
    // a plan or library from the backend: which placed items have an update now (#48)
    if ((fromElsewhere || changed.has("packs")) && this.isEditor && !this.topic) this.refreshLibUpdates();
    // the phone's details sheet follows the selection (#250)
    this.syncSheet();
  }

  recipesAsked = new Set<string>();
  /** The first plan was looked at for the empty-home start (#193). */
  startChecked = false;

  /**
   * Library items in the plan that neither the plan's copies nor the fetched recipes draw yet (#44: a camera look, a
   * parking spot's vehicle, an item placed a moment ago): fetch their recipes once, then draw them again. The next
   * save brings the plan's copies of them anyway.
   */
  fetchPlacedRecipes(): void {
    if (!this.hass || !this._doc || !this.packs?.length) return;
    const types = packTypesIn(this._doc).filter((t) => !packItem(t) && !this.recipesAsked.has(t));
    if (!types.length) return;
    for (const t of types) this.recipesAsked.add(t);
    void ensureRecipes(this.hass, types).then(() => {
      if (!types.some((t) => packItem(t))) return;
      if (this._split || this._wallView) this._doc3d = { ...this.docWithDraft() };
      this.requestUpdate();
    });
  }

  /** Side panels scrolled away from their top (#392): noted by a passive scroll listener, not read after a render. */
  scrolledSides = new WeakSet<Element>();

  protected firstUpdated(): void {
    // scroll events do not bubble: caught on the way down to the side panel
    this.renderRoot.addEventListener(
      "scroll",
      (e) => {
        const el = e.target as Element;
        if (!el.classList?.contains("fp3d-side")) return;
        if (el.scrollTop > 0) this.scrolledSides.add(el);
        else this.scrolledSides.delete(el);
      },
      { capture: true, passive: true },
    );
    // the library, rack sheet, pickers and Extensions page are chunks of their own (#245): loaded once the editor is idle
    preloadParts();
    const stage = this.renderRoot.querySelector(".fp3d-canvas-wrap") as HTMLElement | null;
    if (!stage) return;
    this.resizeObserver = new ResizeObserver(() => {
      this._size = { w: stage.clientWidth, h: stage.clientHeight };
      // a moved side panel settles back inside the editor (#421)
      settleSideDrag(this);
      // a plan nobody has moved since it was fitted stays fitted (the 3D half opening beside the roof tool)
      if ((!this.fitted || this._view === this.fittedView) && this._size.w > 0) {
        this.fitted = true;
        this.fit(this.fittedAll);
      }
    });
    this.resizeObserver.observe(stage);
  }

  /** A solar field or roof window grabbed in the 3D pane: its grab point on its face, and the plan before. */
  grab3d: { id: string; win: boolean; du: number; ds: number; base: Building; moved: boolean } | null = null;

  /** Moves solar fields (energy tool) and roof windows (roof tool) in the 3D pane, along the faces under the pointer. */
  surfaceGrabber: SurfaceGrab = {
    start: (ray) => this.grab3dStart(ray),
    move: (ray) => this.grab3dMove(ray),
    end: () => {
      const g = this.grab3d;
      this.grab3d = null;
      if (g?.moved) this.pushHistory(g.base);
    },
  };

  /** Tools that work on the whole house (roof, solar): the 3D pane shows all floors with the roof. */
  get houseTool(): boolean {
    return this._tool === "roof" || this._tool === "energy";
  }

  protected updated(changed: PropertyValues): void {
    this.afterPhoneRender(changed);
    // the side panel's drag follows the aside drawn now, at this device's place (#421)
    syncSideDrag(this);
    if (this._tool === "measure" && changed.has("_draft")) this.afterMeasureDraft(changed.get("_draft") as Vec2[] | undefined);
    // another item (room, door, floor …) opens its panel at the top: the fields are where they always are (#71)
    // only a side panel scrolled down is set back (#392): setting scrollTop forced a layout of the panel just drawn on
    // every selection; its scroll position is noted as it scrolls instead of read here
    if (selectionMoved(changed, this) || changed.has("_tool"))
      for (const side of this.renderRoot.querySelectorAll<HTMLElement>(".fp3d-side")) {
        if (!this.scrolledSides.has(side)) continue;
        this.scrolledSides.delete(side);
        side.scrollTop = 0;
      }
    // a part on the Settings page (#139) shows its section unfolded (its summary is hidden there)
    if (this.topic) for (const d of this.renderRoot.querySelectorAll<HTMLDetailsElement>(".fp3d-embed details")) if (!d.open) d.open = true;
    // the item preview is placed in window coordinates; with the 3D view beside the plan an ancestor becomes its
    // containing block (a transform or filter), so "fixed" no longer means the window: measure and correct once
    const preview = this._preview ? this.renderRoot.querySelector<HTMLElement>(".fp3d-preview") : null;
    if (preview && this._preview) {
      const r = preview.getBoundingClientRect();
      const dx = r.left - this._preview.left;
      const dy = r.top - this._preview.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        preview.style.left = `${parseFloat(preview.style.left) - dx}px`;
        preview.style.top = `${parseFloat(preview.style.top) - dy}px`;
      }
    }
    // ?selected only sets an option's selectedness until the user picks one in that select; after that a
    // reused <select> (another room, another item) would keep showing the old pick: follow the attribute
    for (const option of this.renderRoot.querySelectorAll<HTMLOptionElement>("select option[selected]")) {
      if (!option.selected) option.selected = true;
    }
    if (this.reframe3d) {
      this.reframe3d = false;
      // after the 3D half got its new floor (and built the roof): frame it
      setTimeout(() => (this.renderRoot.querySelector("fp3d-view3d") as (HTMLElement & { resetView(): void }) | null)?.resetView(), 250);
    }
    const bg = this.floor?.background;
    if (bg && !this._images[bg.image_id] && !this.loadingImages.has(bg.image_id)) void this.loadImage(bg.image_id);
    // thumbnails of the selected screen's stored pictures
    if (this.furnitureItem?.pictures) {
      // thumbnails of every stored picture in the plan (they can be reused on other screens)
      for (const id of this.storedPictures()) {
        if (!this._images[id] && !this.loadingImages.has(id)) void this.loadImage(id);
      }
    }
  }

  // ------------------------------------------------------------------ getters: the floor, room and item shown or chosen

  get floor(): Floor | undefined {
    return this._doc?.floors.find((f) => f.id === this._floorId);
  }

  get room(): Room | undefined {
    return this.floor?.rooms.find((r) => r.id === this._roomId);
  }

  /** On the editors list (#7): may change the plan. Unset (a backend before #7): admins are. */
  get isEditor(): boolean {
    return this.canEdit ?? this.hass?.user?.is_admin ?? true;
  }

  /** A Home Assistant admin: locating, Assist's sentence files and the editors list stay theirs. */
  get isHaAdmin(): boolean {
    return this.hass?.user?.is_admin ?? false;
  }

  /** Corners are set one by one: the free-form room, and an outdoor area drawn as a free shape. */
  get drawingPoints(): boolean {
    return this._tool === "polygon" || ((this._tool === "outdoor" || (this._tool === "pool" && !this._pipeMode)) && this._outdoorFree);
  }

  get freeWall(): FreeWall | undefined {
    return this._wallId ? (this.floor?.walls ?? []).find((w) => w.id === this._wallId) : undefined;
  }

  get outdoorArea(): OutdoorArea | undefined {
    return this._outdoorId ? this.floor?.outdoor.find((o) => o.id === this._outdoorId) : undefined;
  }

  // ------------------------------------------------------------------ keyboard

  readonly onKey = (e: KeyboardEvent) => {
    // a part on the Settings page has no plan to work the keys on
    if (this.topic) return;
    this.shiftHeld = e.shiftKey;
    const path = e.composedPath();
    if (path.some((el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
      // Escape in one of the editor's boxes lets go of it (what was typed is kept): the shortcuts work again (#70)
      if (e.key === "Escape" && path.includes(this)) this.escape();
      return;
    }
    if (!this.isConnected || !this.offsetParent) return;
    // an entity picker with its list open has the keyboard, even when a press beside its box took the focus (#132)
    if (this.pickerOpen()) return;
    // '?' shows the help (#95); while it is open no key edits the plan behind it, and Esc closes it first
    if (isHelpKey(e)) {
      e.preventDefault();
      this._help = !this._help;
      return;
    }
    if (this._help) {
      if (e.key === "Escape") this._help = false;
      return;
    }
    // the rack sheet (#113) has its own keys; none edits the plan behind it
    if (this._rackSheet) {
      if (e.key === "Escape") this._rackSheet = null;
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    // the wall view has its own keys: Delete there must never reach what is chosen in the plan behind it
    // (it took the whole pool with every pipe); only undo and redo still work from here
    if (this._wallView && !(mod && ["z", "y"].includes(e.key.toLowerCase()))) return;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.redo();
    } else if (clipboardKey(e)) {
      // the editor's own clipboard (#74); a key with nothing to do leaves the browser's copy and paste alone
      const act = clipboardKey(e);
      if (act === "copy" ? this.copySelection() : act === "paste" ? this.pasteClipboard(this.planPointer) : this.selectAll()) e.preventDefault();
    } else if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (this._furnitureId) this.duplicateFurniture();
      else if (this._outdoorId) this.duplicateOutdoor();
      else this.duplicateRoom();
    } else if (e.key === "Delete" || (e.key === "Backspace" && (this._tool === "select" || this._tool === "furniture" || chosenPoint(this)))) {
      this.deleteSelected();
    } else if (e.key.toLowerCase() === "l" && !mod && this._tool === "roof" && this.roofSection && !this._doc.settings.lock_plan) {
      this.updateRoofSection({ locked: !this.roofSection.locked });
    } else if (e.key.toLowerCase() === "l" && !mod && this._furnitureId && this.selection().length > 1) {
      this.lockSelection(!this.selection().every((id) => this.isFixedItem("furniture", id)));
    } else if (e.key.toLowerCase() === "l" && !mod && (this._furnitureId || this._deviceId)) {
      const s = this.selectedFix!;
      this.toggleFixed(s.kind, s.id);
    } else if (Object.prototype.hasOwnProperty.call(ARROWS, e.key) && !mod) {
      // arrow keys nudge the selection: one grid step, Shift 10 cm, Alt 1 cm
      const step = e.altKey ? 0.01 : e.shiftKey ? 0.1 : this._doc.settings.grid;
      const [dx, dz] = ARROWS[e.key];
      if ((this._tool === "select" || this._tool === "furniture" || chosenPoint(this)) && this.nudge(dx * step, dz * step)) e.preventDefault();
      else if (!this.selectedFix) {
        // nothing chosen: the arrows move the view instead (#234), a quarter of the plan a press with Shift
        const px = e.shiftKey ? 240 : 60;
        this.panBy(-dx * px, -dz * px);
        e.preventDefault();
      }
    } else if (e.key.toLowerCase() === "r" && !mod && this._furnitureId) {
      this.rotateFurniture(e.shiftKey ? -90 : 90);
    } else if (e.key === "Tab" && !mod && !e.altKey && this._furnitureId && (this._tool === "select" || this._tool === "furniture") && this.keysFree(path)) {
      // Tab goes into the selected item's toolbar first (#398), from there on to the next item; else Tab steps
      // through the items of the room (#75), Shift+Tab backwards
      if (!e.shiftKey && focusItemBar(this)) {
        e.preventDefault();
        return;
      }
      const next = nextPick(this.tabItems(), this._furnitureId, e.shiftKey ? -1 : 1);
      if (next) {
        e.preventDefault();
        this.selectFromList(next);
      }
    } else if (e.key === "Backspace" && this.drawingPoints) {
      this._draft = this._draft.slice(0, -1);
    } else if (e.key === "Enter" && this.drawingPoints) {
      this.closeDraft();
    } else if (e.key === "Escape") {
      this.escape();
    }
  };

  // ------------------------------------------------------------------ getters and handlers of the areas
  // (getters and arrow-function fields stay on the element: editor/parts.ts copies plain methods only)

  /** Floors of Home Assistant's floor registry that no floor of the plan stands for yet, lowest first. */
  get freeHaFloors(): HassFloor[] {
    const used = new Set(this._doc.floors.map((f) => f.ha_floor));
    // nor one the plan has under its name, linked or not (#263)
    return Object.values(this.hass?.floors ?? {})
      .filter((f) => !used.has(f.floor_id) && !this._doc.floors.some((p) => sameFloorName(p.name, f.name)))
      .sort((a, b) => (a.level ?? 99) - (b.level ?? 99) || a.name.localeCompare(b.name));
  }

  get roofSection(): RoofSection | undefined {
    return this._roofId ? this._doc.settings.roof.sections?.find((x) => x.id === this._roofId) : undefined;
  }

  /** The selected item (for the L key and nudging), the most specific selection first. */
  get selectedFix(): { kind: FixKind; id: string } | null {
    if (this._deviceId) return { kind: "device", id: this._deviceId };
    if (this._openingId) return { kind: "opening", id: this._openingId };
    if (this._furnitureId) return { kind: "furniture", id: this._furnitureId };
    if (this._wallId) return { kind: "wall", id: this._wallId };
    if (this._outdoorId) return { kind: "outdoor", id: this._outdoorId };
    if (this._roomId) return { kind: "room", id: this._roomId };
    return null;
  }

  get opening(): Opening | undefined {
    return this._openingId ? this.floor?.openings.find((o) => o.id === this._openingId) : undefined;
  }

  get furnitureItem(): Furniture | undefined {
    return this._furnitureId ? this.floor?.furniture.find((f) => f.id === this._furnitureId) : undefined;
  }

  typeLabelMemo = new WeakMap<FurniturePack, { lang: string; labels: string[] }>();

  /** Drag an unplaced entity from the side bar onto the plan (#83). */
  onPlanDragOver = (e: DragEvent): void => {
    if (this.isEditor && this.floor && e.dataTransfer?.types.includes(ENTITY_DRAG)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  /** Dropped on the plan: the entity is placed at that point (a light in a room as a ceiling lamp, like Place). */
  onPlanDrop = (e: DragEvent): void => {
    const id = e.dataTransfer?.getData(ENTITY_DRAG);
    const svg = this.renderRoot.querySelector("svg.fp3d-plan");
    if (!id || !svg || !this.isEditor || !this.floor) return;
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const [x, z] = this.toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const roomId = this.roomAt([x, z]);
    const room = this.floor.rooms.find((r) => r.id === roomId);
    this.change((doc, floor) => {
      for (const f of doc.floors) {
        f.placements = f.placements.filter((pl) => pl.entity_id !== id);
        f.furniture = f.furniture.filter((m) => !(isLamp(m.type) && m.entity === id));
      }
      const at = { x: round(x), z: round(z) };
      if (id.startsWith("light.") && room && !room.outdoor) {
        const [w, d, h] = FURNITURE_SIZE.lamp_ceiling;
        floor.furniture.push({ id: uid("furniture"), type: "lamp_ceiling", ...at, rotation: 0, w, d, h, variant: null, entity: id, power: null });
        return;
      }
      floor.placements.push({ entity_id: id, ...at, y: null, mount: null });
      const model = id.startsWith("camera.") && this.hass ? detectCameraModel(this.hass, id, this.packs ?? []) : null;
      if (model) setCameraLook(floor, id, model);
    });
  };

  get device(): Placement | undefined {
    return this._deviceId ? this.floor?.placements.find((p) => p.entity_id === this._deviceId) : undefined;
  }

  /** The last front view drawn, by what it was drawn from: the item panel re-renders often, the drawing changes rarely (#115). */
  elevationMemo: { key: string; el: RackElevation | null } | null = null;

  /** Any entity: the rack sheet's pickers (one function, so its options are memoised). */
  readonly anyEntity = () => true;
  rackDevicesMemo: { entities: unknown; devices: unknown; count: number; options: { id: string; label: string }[] } | null = null;

  protected render(): TemplateResult {
    if (this.topic) return this.renderTopic(this.topic);
    const floor = this.floor;
    const walls = floor ? generateWalls(floor.rooms, { exterior: this._doc.settings.wall_exterior, interior: this._doc.settings.wall_interior }, floor.walls ?? []) : null;
    return html`
      ${this.renderPreview()} ${this.renderWallView()} ${this.renderPartCard()} ${this.renderHelp()} ${this.renderRackSheet()}
      <div class="fp3d-editor ${this.narrow ? "fp3d-narrow" : ""} ${this._phone ? "fp3d-phone" : ""} ${this._sheeted ? "fp3d-sheeted" : ""} ${this._sheeted && this._typing ? "fp3d-typing" : ""}" style=${`--fp3d-side-w:${this._sideWidth}px`}>
        <!-- one toolbar row across the plan and the sidebar (#249) -->
        <div class="fp3d-toolbar">
          ${this._wallPick && !(this._phone && this.showsPhoneHint()) ? html`<div class="fp3d-pick-tip" style=${`left:${this.wallPickTip[0]}px;top:${this.wallPickTip[1]}px`} @click=${() => (this._wallPick = false)}>${touchWording(touchOnly(), "hint_wall_pick", (k, p) => this.t(k, p))}</div>` : nothing}
          ${this.renderFloorMenu()} ${this.renderToolBar(floor, walls?.warnings.length ? html`<span class="fp3d-warn">${this.t("overlap_warning")}</span>` : nothing)}
        </div>
        <div class="fp3d-main">
          <div class="fp3d-stage-pair ${this._split ? "fp3d-split" : ""}" style=${this._split && !this.narrow ? `--fp3d-split:${Math.round(this._splitRatio * 100)}%` : ""}>
          <div class="fp3d-canvas-wrap">
            ${this.houseTool ? html`<div class="fp3d-tool-note">${this.t(this._tool === "energy" ? "energy_only_note" : "roof_only_note")}</div>` : nothing}
            <svg
              class="fp3d-plan fp3d-tool-${this._tool}"
              @pointerdown=${this.onPointerDown}
              @pointermove=${this.onPointerMove}
              @pointerup=${this.onPointerUp}
              @pointercancel=${this.onPointerUp}
              @pointerleave=${() => {
                this.planPointer = null;
                if (!this.drag) this._cursor = null;
                this._openingHover = null;
              }}
              @wheel=${this.onWheel}
              @contextmenu=${this.onContextMenu}
              @dragover=${this.onPlanDragOver}
              @drop=${this.onPlanDrop}
            >
              ${this.renderBackground(floor)} ${this.renderGrid()} ${this.renderGhost()} ${walls ? this.renderWalls(walls.walls) : nothing}
              ${floor ? this.renderOutdoorGhosts(floor) : nothing} ${floor ? this.renderOutdoor(floor) : nothing} ${floor ? this.renderRooms(floor) : nothing} ${floor ? this.renderFurniture(floor) : nothing} ${this.renderPlaceGhost()}
              ${floor ? this.renderFreeWalls(floor) : nothing}
              ${floor && walls ? this.renderOpenings(floor, walls.walls) : nothing} ${floor ? this.renderMeter(floor) : nothing}
              ${floor && this._tool === "select" ? this.renderDevices(floor) : nothing}
              ${floor && this._tool === "select" ? this.renderPets(floor) : nothing}
              ${this.room && this.isEditor && this._tool === "select" && !this._openingId && !this._furnitureId && !this.isFixedItem("room", this.room.id) ? this.renderHandles(this.room) : nothing}
              ${floor ? this.renderOutdoorHandles(floor) : nothing}
              ${this.room && this._tool === "select" ? this.renderSplitMarks(this.room) : nothing}
              ${floor ? this.renderHeadroom(floor) : nothing}
              ${this._tool === "roof" ? svg`${this.renderRoofSections()}${this.renderRoofWindows()}` : this._tool === "energy" ? svg`${this.renderRoofSections()}${this.renderSolarFields()}${this.renderCables()}${this.renderEnergyMarkers()}` : this._tool === "pool" && floor && this.pipeRules ? this.renderPoolPlan(floor) : nothing} ${this.renderDraft()} ${this.renderGuides()}
              ${floor ? this.renderKerb(floor) : nothing}
            </svg>
            ${vacuumTag(this, floor, true)} ${this.renderContext()}
            ${this.renderNav()}
            ${this.renderHint()}
          </div>
          ${this._split && !this.narrow
            ? html`<div class="fp3d-split-handle" title=${this.t("split_handle_hint")} @pointerdown=${this.onSplitDown}></div>`
            : nothing}
          ${this._split ? this.render3d() : nothing}
          </div>
        </div>
        ${guard([sideFreeze(this)], () => (this._sheeted ? this.renderSheet(floor) : this.renderAside(floor)))} ${this._phone ? this.renderPhoneBar(floor) : nothing}
      </div>
    `;
  }

  /** The filter of the "add a sensor" list, kept per camera so its options stay cached (see entityOptions). */
  _detectFilter: { key: string; fn: (id: string) => boolean } | null = null;
  /** Where the bubble under the toolbar's wall view button points to (px from the toolbar's top left corner). */
  wallPickTip: [number, number] = [0, 0];

  techDocCache: { src: Building; doc: Building } | null = null;

  /** The pool whose pipes the wall view shows: the chosen one, else the first on this floor. */
  get runPool(): OutdoorArea | undefined {
    return this.poolArea ?? this.floor?.outdoor.find((o) => o.type === "pool" && o.points.length >= 3);
  }

  /** The pipe tools of the wall view: technical-room mode (pool module) switched on, or the lab switch. */
  get canLayRuns(): boolean {
    return (labOn() || this._techMode) && !!this.runPool;
  }

  /** The pool the pool tool works on: the selected one on this floor, else the only pool on it. */
  get poolArea(): OutdoorArea | undefined {
    const a = this.outdoorArea;
    if (a?.type === "pool") return a;
    // with one pool there is nothing to choose: drawing a pipe works without selecting it first
    const pools = this.floor?.outdoor.filter((o) => o.type === "pool") ?? [];
    return pools.length === 1 ? pools[0] : undefined;
  }

  /** The pipe rules of a loaded module (pool module); without them the pipe tools stay hidden. */
  get pipeRules(): PipeRules | null {
    return modulePipeRules();
  }

  /**
   * A module's fields, made only when the item, the plan or Home Assistant's devices change – not on every state
   * change: a heating module searches every entity for its form, and made anew several times a second it kept the CPU busy
   * and closed an open selection list at once (#815).
   */
  _moduleFieldMemo: { item: object; doc: unknown; entities: unknown; lang: string; fields: ModuleField[] } | null = null;
  /** Metres or feet and inches, as the plan's setting (or Home Assistant) says (#117). */
  get unit(): LengthUnit {
    return lengthUnit(this.hass, this._doc.settings.units);
  }

  /** Typed numbers are saved on Enter, on leaving the box and after a pause in typing (#69). */
  readonly typed = new TypedCommit();

  /** The right mouse button held down: where, on what, and whether it was dragged (then it moved the plan). */
  rightPress: { at: [number, number]; target: Element; moved: boolean } | null = null;
  /** When the right button was last released (its contextmenu event then stays quiet). */
  rightUp = -1e9;

  /** The last press on a point, to tell a double click (a pointerdown's `detail` stays 0 in Chrome, D410). */
  lastTap: { key: string; at: number } | null = null;

  /** Where the pointer is on the plan (m), null while it is off the plan: Ctrl+V pastes there (#400). */
  planPointer: Vec2 | null = null;

  /** The floor page's list of outdoor areas is open (#401): Fit takes the garden in then. */
  outdoorListOpen = false;

  planMemo: { doc: Building; entities: unknown; devices: unknown; areas: unknown; count: number; kept: Map<string, unknown> } | null = null;

  /** The editors list (#7) as the backend last sent it; null until asked. */
  editorsList: { users: EditorUser[]; custom: boolean } | null = null;
  editorsAsked = false;
  editorsMsg: string | null = null;

  libIndex: { key: string; entries: LibraryEntry[] } | null = null;

  /** A card's picture: drawn by the 3D bundle like the hover preview, smaller. */
  libraryThumb = async (entry: LibraryEntry): Promise<string | null> => {
    const [mod] = await Promise.all([load3d(), this.hass ? ensureRecipes(this.hass, [entry.type]) : undefined]);
    // no recipe (offline, the pack just went): no picture, so none is kept that shows a plain box
    if (isPackType(entry.type) && !packItem(entry.type)) return null;
    const [w, d, h] = entry.size;
    return mod.furniturePreview({ type: entry.type, w, d, h, variant: null, lamp: LAMP_MODEL[entry.type] ?? null }, 96, this.packs ?? []);
  };

  /** The item picker's big picture (#293): the same drawing as a card's, larger. */
  libraryPicture = async (entry: LibraryEntry, size: number): Promise<string | null> => {
    const [mod] = await Promise.all([load3d(), this.hass ? ensureRecipes(this.hass, [entry.type]) : undefined]);
    if (isPackType(entry.type) && !packItem(entry.type)) return null;
    const [w, d, h] = entry.size;
    return mod.furniturePreview({ type: entry.type, w, d, h, variant: null, lamp: LAMP_MODEL[entry.type] ?? null }, size, this.packs ?? []);
  };

  /** A listed pack's item before it is installed (#336): drawn from the index's copy, nothing is registered. */
  indexPicture = async (item: PackItem, size: number): Promise<string | null> => (await load3d()).itemPicture(item, size);

  libUpdatesAsked = false;

  libUpdatesAsking = false;

  static styles = [
    tokens,
    controls,
    shellStyles,
    planStyles,
    sideStyles,
    wallViewStyles,
    menuStyles,
    wallsRoofStyles,
    formStyles,
    typeCardStyles,
    phoneStyles,
  ];
}

/** The area modules' methods (#202): one class per editor area under editor/, all on this element. */
export interface Fp3dEditor extends Pane3dPart, PlanViewPart, PointerPart, KeysPart, RoomsPart, WallsPart, OutdoorPart, FloorsPart, RoofPart, SolarPart, EnergyPart, SelectionPart, OpeningsPart, FurniturePart, ItemFormPart, ItemSectionsPart, PanelHeadPart, ItemFoldsPart, DevicePanelPart, CamerasPart, ToolbarPart, SidePanelPart, RacksPart, WallViewPart, WallKitPart, PipesPart, PoolPart, FieldsPart, SettingsPart, BackupPart, PhonePart, PetsPart, AreaSelectPart, ToolPanelPart, OutdoorFindPart {}
mixParts(Fp3dEditor, [Pane3dPart, PlanViewPart, PointerPart, KeysPart, RoomsPart, WallsPart, OutdoorPart, FloorsPart, RoofPart, SolarPart, EnergyPart, SelectionPart, OpeningsPart, FurniturePart, ItemFormPart, ItemSectionsPart, PanelHeadPart, ItemFoldsPart, DevicePanelPart, CamerasPart, ToolbarPart, SidePanelPart, RacksPart, WallViewPart, WallKitPart, PipesPart, PoolPart, FieldsPart, SettingsPart, BackupPart, PhonePart, PetsPart, AreaSelectPart, ToolPanelPart, OutdoorFindPart]);

defineElement("fp3d-editor", Fp3dEditor);

// the extensions page is a chunk of this bundle (#245): the panel loads it with this, once the bundle is there
export { loadExtensions } from "./editor/lazy.ts";
