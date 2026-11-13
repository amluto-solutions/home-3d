// The read-only 2D plan (#41): the same building as the 3D view, drawn flat as SVG – walls, doors, windows, each
// item's plan symbol, device markers with their live state, energy flows. It takes the 3D viewer's calls (the view
// drives both alike) and reports taps, holds and double taps the same way, so actions, menus and camera pictures
// work as in 3D. Nothing can be edited here. A bundle of its own: neither three.js nor the editor comes along.

import { html, nothing, render, svg } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { furnitureSymbol } from "../components/furniture2d.ts";
import { generateWalls, type Wall } from "../geometry/walls.ts";
import { centroid, type Building, type Floor, type StartView, type Vec2 } from "../model.ts";
import { setPacks, setPlanRecipes } from "../packs.ts";
import type { OpeningState } from "../viewer/openings.ts";
import { pinsShown, readPinZoom } from "../plan-pins.ts";
import { lowEndDevice } from "../viewer/pace.ts";
import { clearLabels, roomRank, type LabelBox } from "../viewer/label-clear.ts";
import type { DeviceMarker, FlowPiece, ScreenState, Theme, ViewerOptions } from "../viewer/viewer3d.ts";
import type { ViewerSurface } from "../viewer-surface.ts";
import type { StyleDef } from "../looks.ts";
import { Gestures } from "./gestures.ts";
import { anchorSpots, rackDraw, rackOfPick, fitInside, roomFocusView, floorPictures, flowLines, planBounds, planItems, planMarkers, planOpenings, shownFloor, zoomView, type PlanOpening, type PlanView } from "./scene.ts";

type View = ReturnType<ViewerSurface["getView"]>;
type Anchors = Parameters<ViewerSurface["setAnchors"]>[0];
type AnchorCallback = Parameters<ViewerSurface["setAnchorCallback"]>[0];

const pts = (list: readonly Vec2[]) => list.map((p) => `${p[0]},${p[1]}`).join(" ");
const EMPTY_VIEW: StartView = { theta: -0.6, phi: 0.85, radius: 16, target: null };

export class Plan2dViewer implements ViewerSurface {
  readonly low: boolean;
  private readonly host: HTMLElement;
  private readonly options: ViewerOptions;
  private readonly root: HTMLDivElement;
  private readonly plan: SVGGElement;
  private readonly content: SVGGElement;
  private readonly layer: HTMLDivElement;
  private readonly gestures: Gestures;
  private readonly resizer: ResizeObserver | null;
  private building: Building | null = null;
  private floorId: string | null = null;
  private roomId: string | null = null;
  private devices: DeviceMarker[] = [];
  private furnitureTargets = new Map<string, string>();
  private openingTargets = new Map<string, string>();
  private openingStates = new Map<string, OpeningState>();
  private flows: FlowPiece[] = [];
  private roomTint: Map<string, [number, number, number]> | null = null;
  private roomInfo = new Map<string, string>();
  /** Rooms motion lights, and the temperature colours of radiators and cylinders (#10). */
  private roomGlow: ReadonlySet<string> = new Set();
  private shades = new Map<string, [number, number, number]>();
  private startView: StartView | null = null;
  private anchorCb: AnchorCallback = null;
  private anchors: Anchors = [];
  private view: PlanView = { k: 40, tx: 0, ty: 0 };
  /** The zoom (px per metre) from which pins show, this device's preference (#220); read at every draw. */
  private pinCut = readPinZoom();
  private inset = 0;
  private size = { w: 0, h: 0 };
  /** What covers the plan's lower edge (the bottom bar, time travel), measured by an empty probe element (#91). */
  private probe: HTMLElement;
  private bottom = 0;
  /** The walls of the floor shown, by the building and floor they were made for. */
  private walls: { b: Building; floor: Floor; list: Wall[] } | null = null;
  private flashing = new Map<string, number>();
  private frame = 0;
  private moveFrame = 0;
  private downRoom: string | null = null;
  /** The room names on the layer, where they sit (m) and how big (px), for the collision pass (#341). */
  private names: { el: HTMLElement; x: number; z: number; key: string; box: LabelBox }[] = [];
  /** Each name's size (px) by its text, measured once (#341). */
  private nameSizes = new Map<string, { w: number; h: number }>();

  constructor(host: HTMLElement, options: ViewerOptions = {}) {
    this.host = host;
    this.options = options;
    // the tablet level as in 3D: the view then shows a change of measured values alone at most every few seconds
    const nav = navigator as Navigator & { deviceMemory?: number };
    this.low = options.quality === "low" || (options.quality !== "high" && lowEndDevice(navigator.userAgent, nav.deviceMemory, navigator.hardwareConcurrency));
    this.root = document.createElement("div");
    this.root.className = "fp3d-p2d";
    this.root.innerHTML = `<style>${PLAN2D_CSS}</style><svg class="fp3d-p2d-svg"><g class="fp3d-p2d-plan"><g></g></g></svg><div class="fp3d-p2d-layer"></div><div class="fp3d-p2d-probe" aria-hidden="true"></div>`;
    this.plan = this.root.querySelector(".fp3d-p2d-plan")!;
    this.content = this.plan.firstElementChild as SVGGElement;
    this.layer = this.root.querySelector(".fp3d-p2d-layer")!;
    this.probe = this.root.querySelector(".fp3d-p2d-probe")!;
    host.prepend(this.root);
    this.gestures = new Gestures({
      tap: (x, y, target) => this.onTap(x, y, target),
      doubleTap: (x, y, target) => this.onDoubleTap(x, y, target),
      hold: (x, y, target) => {
        // a rack has no device: a hold shows its front view like a tap
        if (rackOfPick(target)) this.onTap(x, y, target);
        else if (target) this.options.onDeviceHold?.(target, x, y);
      },
      pan: (dx, dy) => this.moveView({ ...this.view, tx: this.view.tx + dx, ty: this.view.ty + dy }),
      zoom: (k, x, y) => this.moveView(zoomView(this.view, k, x, y)),
      swipeStart: (target, x, y) => this.options.onDeviceSwipe?.(target, "start", 0, x, y) === true,
      swipeMove: (target, dy) => void this.options.onDeviceSwipe?.(target, "move", dy, 0, 0),
      swipeEnd: (target) => void this.options.onDeviceSwipe?.(target, "end", 0, 0, 0),
    });
    const r = this.root;
    r.addEventListener("pointerdown", this.onDown);
    r.addEventListener("pointermove", this.onMove);
    r.addEventListener("pointerup", this.onUp);
    r.addEventListener("pointercancel", this.onCancel);
    r.addEventListener("wheel", this.onWheel, { passive: false });
    r.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      // a right click on a device is a long press (#272)
      const id = (e.target as Element | null)?.closest?.("[data-pick]")?.getAttribute("data-pick");
      if (id && !rackOfPick(id)) this.options.onDeviceHold?.(id, ...this.local(e));
    });
    r.addEventListener("keydown", this.onKey);
    // reachable for the keyboard (#195): the arrows move the plan, plus and minus zoom
    r.tabIndex = 0;
    r.setAttribute("role", "application");
    this.resizer = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.resize()) : null;
    this.resizer?.observe(host);
    // the bottom bar's height changes on its own (time travel opens): the probe's size follows it
    this.resizer?.observe(this.probe);
    document.fonts?.addEventListener?.("loadingdone", this.onFonts);
    this.resize();
  }

  /** The fonts arrived: the names are measured again at the next pan, zoom or draw (#341). */
  private readonly onFonts = () => this.nameSizes.clear();

  dispose(): void {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.moveFrame);
    this.resizer?.disconnect();
    this.gestures.dispose();
    document.fonts?.removeEventListener?.("loadingdone", this.onFonts);
    this.root.remove();
  }

  // ---- what the view sends ----

  setBuilding(b: Building): void {
    const fresh = !this.building;
    this.building = b;
    if (fresh) this.fit();
    this.draw();
  }

  setFloor(floorId: string | null): void {
    if (floorId === this.floorId) return;
    this.floorId = floorId;
    this.roomId = null;
    this.fit();
    this.draw();
  }

  /**
   * The room is marked. Beside a room panel the plan keeps its place; under a phone's room sheet it zooms to the room
   * above the sheet (#259), and goes back to the whole floor when the room closes.
   */
  selectRoom(roomId: string | null): void {
    if (roomId === this.roomId) return;
    this.roomId = roomId;
    if (this.roomZoomed || this.roomView()) this.fit();
    this.draw();
  }

  /** The plan is zoomed to the chosen room (#259). */
  private roomZoomed = false;

  private roomView(): PlanView | null {
    const floor = this.floor();
    return floor && this.size.w ? roomFocusView(floor, this.roomId, this.size, this.bottom) : null;
  }

  resetView(): void {
    this.fit();
    this.draw();
  }

  /** The on-screen zoom and pan buttons (#297): the keyboard's moves; "reset" fits the plan. */
  navigate(act: "in" | "out" | "left" | "right" | "up" | "down" | "reset" | "turnLeft" | "turnRight"): void {
    if (act === "reset") return this.resetView();
    if (act === "turnLeft" || act === "turnRight") return; // the flat plan does not turn
    const step = 60;
    const w = this.size.w / 2;
    const h = this.size.h / 2;
    this.moveView(
      act === "left" ? { ...this.view, tx: this.view.tx + step }
      : act === "right" ? { ...this.view, tx: this.view.tx - step }
      : act === "up" ? { ...this.view, ty: this.view.ty + step }
      : act === "down" ? { ...this.view, ty: this.view.ty - step }
      : zoomView(this.view, act === "in" ? 1.2 : 1 / 1.2, w, h),
    );
  }

  /** Items the View hides (#268, #269). */
  private hiddenItems: ReadonlySet<string> = new Set();

  setHiddenItems(ids: ReadonlySet<string>): void {
    if (ids === this.hiddenItems) return;
    this.hiddenItems = ids;
    this.draw();
  }

  setDevices(devices: DeviceMarker[]): void {
    this.devices = devices;
    this.draw();
  }

  setPickTargets(furniture: Map<string, string>, openings: Map<string, string>): void {
    this.furnitureTargets = furniture;
    this.openingTargets = openings;
    this.draw();
  }

  setOpeningStates(states: Map<string, OpeningState>): void {
    this.openingStates = states;
    this.draw();
  }

  setFlows(flows: FlowPiece[]): void {
    this.flows = flows;
    this.draw();
  }

  setRoomTint(tint: Map<string, [number, number, number]> | null): void {
    this.roomTint = tint;
    this.draw();
  }

  setRoomGlow(rooms: ReadonlySet<string>): void {
    if (rooms.size === this.roomGlow.size && [...rooms].every((id) => this.roomGlow.has(id))) return;
    this.roomGlow = new Set(rooms);
    this.draw();
  }

  /** Of the lit screens the plan shows only the temperature colours (#10). */
  setScreens(screens: Map<string, ScreenState>): void {
    const shades = new Map([...screens].filter(([, st]) => st.shade).map(([id, st]) => [id, st.faces?.[0]?.top ?? st.color] as const));
    if (shades.size === this.shades.size && [...shades].every(([id, c]) => this.shades.get(id)?.join() === c.join())) return;
    this.shades = shades;
    this.draw();
  }

  setRoomInfo(info: Map<string, string>): void {
    this.roomInfo = info;
    this.draw();
  }

  setTheme(theme: Theme): void {
    this.root.dataset.theme = theme;
  }

  /** A style (#436): the flat plan draws the classic look under it. */
  setStyle(style: StyleDef): void {
    this.setTheme(style.base);
  }

  setAccent(hex: string | null): void {
    if (hex && /^#[0-9a-f]{6}$/i.test(hex)) this.root.style.setProperty("--fp3d-accent", hex);
    else this.root.style.removeProperty("--fp3d-accent");
  }

  setPacks(...[packs, recipes]: Parameters<ViewerSurface["setPacks"]>): void {
    // this bundle has its own copy of the packs: pack items draw their symbols from it
    setPacks(packs);
    setPlanRecipes(recipes);
    this.draw();
  }

  /** The flat plan keeps its own margins (fit() leaves room for the labels); the 3D camera's phone margins don't apply. */
  setFitMargin(..._margin: Parameters<ViewerSurface["setFitMargin"]>): void {}

  setLabelInset(px: number): void {
    if (px === this.inset) return;
    this.inset = px;
    this.fit();
    this.draw();
  }

  setStartView(view: StartView | null): void {
    this.startView = view;
  }

  currentView(): StartView {
    // the plan has no camera: the start view stays what it was
    return this.startView ?? EMPTY_VIEW;
  }

  getView(): View {
    return { ...this.view } as unknown as View;
  }

  flyTo(view: View): void {
    const v = view as unknown as Partial<PlanView>;
    if (typeof v.k === "number" && typeof v.tx === "number" && typeof v.ty === "number") this.moveView({ k: v.k, tx: v.tx, ty: v.ty });
  }

  /** Centre a point of the floor shown (a search hit, the director) and let its device flash. */
  focus(floorId: string, x: number, z: number, _y: number, entityId: string | null): void {
    if (entityId) this.flashDevices([entityId]);
    if (floorId !== this.floor()?.id) return;
    const k = Math.max(this.view.k, 70);
    this.moveView({ k, tx: this.size.w / 2 - x * k, ty: this.size.h / 2 - z * k });
  }

  flashDevices(ids: readonly string[]): void {
    const until = performance.now() + 900;
    for (const id of ids) this.flashing.set(id, until);
    this.draw();
    setTimeout(() => this.draw(), 950);
  }

  floorThumbnails(width = 200, height = 150): { floorId: string; url: string }[] {
    return this.building ? floorPictures(this.building, width, height) : [];
  }

  /** Nothing to end: the plan has no look through a camera. */
  endLook(): void {}

  /** No camera to look through in the plan. */
  lookThrough(): boolean {
    return false;
  }

  setAnchorCallback(cb: AnchorCallback): void {
    this.anchorCb = cb;
  }

  /** Floating cards belong to the 3D view: in the plan they stay hidden; points on the plan (cable ends, #29) show. */
  setAnchors(anchors: Anchors): void {
    this.anchors = anchors;
    this.placeAnchors();
  }

  private placeAnchors(): void {
    if (!this.anchorCb) return;
    // a cable's end steps just below the device's pin (34 px) on the same point
    anchorSpots(this.anchors, this.floor()?.id ?? null, this.view, 26).forEach((s, i) => this.anchorCb?.(i, s.x, s.y, s.on, 1, true));
  }

  /** What the plan is called for a screen reader (#195). */
  setDescription(label: string): void {
    if (label) this.root.setAttribute("aria-label", label);
    else this.root.removeAttribute("aria-label");
  }

  // what only the 3D view shows (or what edits): the plan leaves it out
  setAngleLock(): void {}
  setAutoOrbit(): void {}
  setAwnings(): void {}
  setBinCues(): void {}
  setBinSpots(): void {}
  setExplode(): void {}
  setFloorInfo(): void {}
  setFloorStack(): void {}
  setFridgeDoors(): void {}
  /** Rack LEDs are a 3D thing (#119): the 2D plan opens the front view, which shows them. */
  setRackLeds(): void {}
  setFurnishMode(): void {}
  setFurnishTypes(): void {}
  setHideRoof(): void {}
  setKeepRoof(): void {}
  setWindowSpill(): void {}
  setKeepView(): void {}
  setParked(): void {}

  /** The 2D plan draws each change as it comes (#131: the 3D viewer rebuilds once per batch). */
  batch(changes: () => void): void {
    changes();
  }

  busy(): boolean {
    return false;
  }
  setPatches(): void {}
  setPersonLook(): void {}
  setPersons(): void {}
  setPipes(): void {}
  setPools(): void {}
  setProjections(): void {}
  setQuality(): void {}
  setRobots(): void {}
  setRoofWindows(): void {}
  setSelectedDevice(): void {}
  setSolarLevels(): void {}
  setSound(): void {}
  setStats(): void {}
  setSun(): void {}
  setSunHeight(): void {}
  setSunPath(): void {}
  setSurfaceGrab(): void {}
  setTrail(): void {}
  setWallMode(): void {}
  setWeather(): void {}
  selectFurniture(): void {}
  selectFurnitureSet(): void {}

  // ---- the view on screen ----

  private resize(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const bottom = this.probe.offsetHeight;
    if (!w || !h || (w === this.size.w && h === this.size.h && bottom === this.bottom)) return;
    this.size = { w, h };
    this.bottom = bottom;
    this.fit();
    this.draw();
  }

  /** Fit the floor shown into the view: beside the floor pictures, below the stat chips, above the bottom bar (#91). */
  private fit(): void {
    const floor = this.floor();
    if (!floor || !this.size.w) return;
    const room = this.roomView();
    this.roomZoomed = !!room;
    if (room) return this.applyView(room);
    const box = planBounds(floor);
    if (!box) return;
    // room for the floor pictures on the left and the energy chips at the top; on a phone the plan takes the width
    // (the pictures fold away)
    const left = this.size.w < 600 ? 0 : Math.min(this.inset, this.size.w * 0.3);
    this.applyView(fitInside(box, this.size, { left, top: 60, bottom: this.bottom ? Math.min(this.bottom + 8, this.size.h * 0.6) : 0 }));
  }

  /** A pan or zoom: the plan follows in the next frame. */
  private moveView(v: PlanView): void {
    this.view = v;
    if (this.moveFrame) return;
    this.moveFrame = requestAnimationFrame(() => {
      this.moveFrame = 0;
      this.applyView(this.view);
    });
  }

  /** Only a transform and three numbers change: the plan, its labels and pins are not drawn again. */
  private applyView(v: PlanView): void {
    this.view = v;
    this.plan.setAttribute("transform", `matrix(${v.k} 0 0 ${v.k} ${v.tx} ${v.ty})`);
    const s = this.layer.style;
    s.setProperty("--k", String(v.k));
    s.setProperty("--tx", `${v.tx}px`);
    s.setProperty("--ty", `${v.ty}px`);
    // zoomed far out the pins would cover each other and the rooms (#220): they hide, except those of the chosen room,
    // the ones set to always show and the one flashing; zooming in brings them back
    this.layer.classList.toggle("fp3d-p2d-far", !pinsShown(v.k, this.pinCut));
    this.placeAnchors();
    this.clearNames();
  }

  /** Room names that would sit on each other: the smaller room's hides until zooming in makes room (#263, #341). */
  private clearNames(): void {
    const { k, tx, ty } = this.view;
    for (const n of this.names) {
      // each name's size by its text: only a text not seen before is measured (a plan not on screen measures
      // nothing and asks again next time), so a pan or zoom reads no layout
      let size = this.nameSizes.get(n.key);
      if (!size && n.el.offsetWidth) this.nameSizes.set(n.key, (size = { w: n.el.offsetWidth, h: n.el.offsetHeight }));
      // the name sits 22 px above the room's middle (the label's margin)
      Object.assign(n.box, size, { x: n.x * k + tx, y: n.z * k + ty - 22 });
    }
    const keep = clearLabels(this.names.map((n) => n.box));
    // a toggle to the state the class already has writes nothing
    this.names.forEach((n, i) => n.el.classList.toggle("fp3d-p2d-off", !keep[i]));
  }

  private floor(): Floor | null {
    return this.building ? shownFloor(this.building, this.floorId) : null;
  }

  private wallsOf(b: Building, floor: Floor): Wall[] {
    if (this.walls?.b !== b || this.walls.floor !== floor) {
      this.walls = { b, floor, list: generateWalls(floor.rooms, { exterior: b.settings.wall_exterior, interior: b.settings.wall_interior }, floor.walls ?? []).walls };
    }
    return this.walls.list;
  }

  /** Draw at the next frame (many calls of one sync draw once). */
  private draw(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.paint();
    });
  }

  private paint(): void {
    const b = this.building;
    const floor = this.floor();
    if (!b || !floor) {
      render(nothing, this.content);
      render(nothing, this.layer);
      return;
    }
    const walls = this.wallsOf(b, floor);
    const items = planItems(floor, this.furnitureTargets, this.devices, this.shades).filter((it) => !this.hiddenItems.has(it.f.id));
    const openings = planOpenings(floor, { exterior: b.settings.wall_exterior, interior: b.settings.wall_interior }, this.openingTargets, this.openingStates, walls);
    const flows = flowLines(this.flows, floor.id);
    const markers = planMarkers(this.devices, floor.id);
    const cut = readPinZoom();
    if (cut !== this.pinCut) {
      this.pinCut = cut;
      this.layer.classList.toggle("fp3d-p2d-far", !pinsShown(this.view.k, cut));
    }
    const now = performance.now();
    const tint = (id: string) => {
      const c = this.roomTint?.get(id);
      if (c) return `fill:rgba(${c.map((v) => Math.round(v * 255)).join(",")},0.45)`;
      // motion lights the room (#10)
      return this.roomGlow.has(id) ? "fill:rgba(255,230,173,0.35)" : "";
    };
    render(
      svg`
        <g class="fp3d-p2d-outdoor">${floor.outdoor.map((a) => svg`<polygon class=${`fp3d-p2d-out fp3d-p2d-out-${a.type}`} points=${pts(a.points)} />`)}</g>
        <g>${floor.rooms.filter((r) => r.points.length >= 3).map(
          (r) => svg`<polygon data-room=${r.id} class=${`fp3d-p2d-room${r.id === this.roomId ? " fp3d-p2d-room-sel" : ""}`} style=${tint(r.id)} points=${pts(r.points)} />`,
        )}</g>
        <g class="fp3d-p2d-walls">${walls.map((w) => svg`<polygon class=${w.exterior ? "fp3d-p2d-wall fp3d-p2d-wall-ext" : "fp3d-p2d-wall"} points=${pts(w.footprint)} />`)}</g>
        <g>${items.map(
          (it) => svg`<g data-pick=${it.pick ?? nothing} class=${`fp3d-p2d-item${it.pick ? " fp3d-p2d-tap" : ""}${it.on || it.shade ? " fp3d-p2d-on" : ""}${it.unavailable ? " fp3d-p2d-na" : ""}`}
            transform="translate(${it.f.x} ${it.f.z}) rotate(${it.f.rotation}) scale(${it.f.mirror ? -1 : 1} 1)"
            style=${it.glow ? `--fp3d-glow:${it.glow}` : it.tint ? `--fp3d-tint:${it.tint}` : ""}>
            <rect class="fp3d-p2d-body" x=${-it.f.w / 2} y=${-it.f.d / 2} width=${it.f.w} height=${it.f.d} />
            <g class="fp3d-p2d-sym">${furnitureSymbol(it.f.type, it.f.w, it.f.d)}</g>
          </g>`,
        )}</g>
        <g>${openings.map((o) => this.opening(o))}</g>
        <g class="fp3d-p2d-flows">${flows.map(
          (l) => svg`<line class=${l.moving ? "fp3d-p2d-flow fp3d-p2d-flow-on" : "fp3d-p2d-flow"} style=${`stroke:${l.color};stroke-width:${Math.max(2, Math.min(7, 2.5 * l.width))}px`} x1=${l.x1} y1=${l.z1} x2=${l.x2} y2=${l.z2} />`,
        )}</g>
      `,
      this.content,
    );
    // room names and device pins keep their size on screen: they sit in a layer that only moves
    const named = floor.rooms.filter((r) => r.points.length >= 3 && !r.outdoor);
    render(
      html`${named.map((r) => {
          const [x, z] = centroid(r.points);
          const info = this.roomInfo.get(r.id);
          return html`<span class="fp3d-p2d-label" style=${`--x:${x};--z:${z}`}>${r.name}${info ? html`<small>${info}</small>` : nothing}</span>`;
        })}
        ${markers.map((d) => {
          const mode = this.roomId === null ? (d.full ? " fp3d-dev-full" : "") : d.roomId === this.roomId ? " fp3d-dev-full" : " fp3d-dev-dim";
          const watt = d.power !== null && d.power !== undefined && d.power >= 1 ? (d.powerText ?? `${Math.round(d.power)} W`) : "";
          const glow = d.glow ? `--fp3d-glow:rgb(${d.glow.color.map((c) => Math.round(c * 255)).join(",")});` : "";
          const flash = (this.flashing.get(d.id) ?? 0) > now ? " fp3d-p2d-flash" : "";
          return html`<button
            class=${`fp3d-dev fp3d-p2d-pin${d.active ? " fp3d-dev-on" : ""}${d.unavailable ? " fp3d-dev-na" : ""}${mode}${flash}`}
            data-pick=${d.id}
            title=${d.name}
            aria-label=${`${d.name}: ${d.text}`}
            style=${`${glow}--x:${d.x};--z:${d.z}`}
          ><span class="fp3d-dev-icon">${unsafeHTML(d.icon)}</span><span class="fp3d-dev-text">${d.text}</span><span class="fp3d-dev-watt">${watt}</span><span class="fp3d-dev-name">${d.caption ?? ""}</span></button>`;
        })}`,
      this.layer,
    );
    const els = this.layer.querySelectorAll<HTMLElement>(".fp3d-p2d-label");
    this.names = named.map((r, i) => {
      const [x, z] = centroid(r.points);
      // by the values line's length, not its text: "21.5 °C" and "21.6 °C" are one size, and the sizes kept stay few
      return { el: els[i]!, x, z, key: `${r.name}
${this.roomInfo.get(r.id)?.length}`, box: { x: 0, y: 0, w: 0, h: 0, rank: roomRank(r), keep: r.id === this.roomId } };
    });
    this.clearNames();
  }

  private opening(o: PlanOpening) {
    const line = ([a, b]: [Vec2, Vec2], cls = "") => svg`<line class=${cls} x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]} />`;
    const cls = `fp3d-p2d-open fp3d-p2d-open-${o.type}${o.front ? " fp3d-p2d-open-front" : ""}${o.open ? " fp3d-p2d-open-on" : ""}${o.covered ? " fp3d-p2d-open-covered" : ""}${o.pick ? " fp3d-p2d-tap" : ""}`;
    return svg`<g class=${cls} data-pick=${o.pick ?? nothing}>
      ${o.pick ? line(o.hit, "fp3d-p2d-open-hit") : nothing}
      <polygon class="fp3d-p2d-open-gap" points=${pts(o.gap)} />
      ${o.lines.map((l) => line(l))}${o.dashed.map((l) => line(l, "fp3d-p2d-open-dash"))}${o.arcs.map((a) => svg`<path d=${a.d} />`)}
    </g>`;
  }

  // ---- gestures ----

  private local(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.root.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.target as Element | null;
    const pick = el?.closest?.("[data-pick]")?.getAttribute("data-pick") ?? null;
    this.downRoom = el?.closest?.("[data-room]")?.getAttribute("data-room") ?? null;
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      // an old browser: the moves still arrive while the pointer stays over the plan
    }
    this.gestures.down(e.pointerId, ...this.local(e), pick);
  };

  private readonly onMove = (e: PointerEvent) => this.gestures.move(e.pointerId, ...this.local(e));

  private readonly onUp = (e: PointerEvent) => this.gestures.up(e.pointerId, ...this.local(e));

  private readonly onCancel = (e: PointerEvent) => this.gestures.up(e.pointerId, ...this.local(e), true);

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.gestures.wheel(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, ...this.local(e));
  };

  /** Keyboard on a pin: Enter is a tap, Shift+Enter or the context-menu key a hold (as in 3D). */
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.target === this.root && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const step = e.shiftKey ? 160 : 60;
      const w = this.size.w / 2;
      const h = this.size.h / 2;
      // an arrow moves the plan under the view the way the key points: right shows what lies to the right
      const to =
        e.key === "ArrowLeft" ? { ...this.view, tx: this.view.tx + step }
        : e.key === "ArrowRight" ? { ...this.view, tx: this.view.tx - step }
        : e.key === "ArrowUp" ? { ...this.view, ty: this.view.ty + step }
        : e.key === "ArrowDown" ? { ...this.view, ty: this.view.ty - step }
        : e.key === "+" || e.key === "=" ? zoomView(this.view, 1.2, w, h)
        : e.key === "-" || e.key === "_" ? zoomView(this.view, 1 / 1.2, w, h)
        : null;
      if (to) {
        e.preventDefault();
        this.moveView(to);
        return;
      }
    }
    const pin = (e.target as Element | null)?.closest?.("[data-pick]");
    const id = pin?.getAttribute("data-pick");
    if (!pin || !id) return;
    const r = pin.getBoundingClientRect();
    const [x, y] = this.local({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    if (rackOfPick(id)) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.onTap(x, y, id);
      }
      return;
    }
    if ((e.key === "Enter" && e.shiftKey) || e.key === "ContextMenu") {
      e.preventDefault();
      this.options.onDeviceHold?.(id, x, y);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.options.onDeviceTap?.(id, x, y);
    }
  };

  private onTap(x: number, y: number, target: string | null): void {
    const rack = rackOfPick(target);
    if (rack) {
      const floor = this.floor();
      const draw = floor && rackDraw(floor, rack);
      if (draw) this.options.onRackTap?.(rack, draw);
      return;
    }
    if (target) {
      this.options.onDeviceTap?.(target, x, y);
      return;
    }
    const floor = this.floor();
    if (!floor) return;
    // the house view shows this floor already: a room opens at once (in 3D the floor opens first)
    if (!this.floorId && this.downRoom) this.options.onFloorTap?.(floor.id);
    this.options.onRoomTap?.(floor.id, this.downRoom);
  }

  /** As in 3D: an own double-tap action of the item, else a room's double tap, else one level back. */
  private onDoubleTap(x: number, y: number, target: string | null): void {
    if (target && this.options.onDeviceDoubleTap?.(target, x, y)) return;
    const floor = this.floor();
    if (!target && this.floorId && floor && this.downRoom && this.options.onRoomDoubleTap) this.options.onRoomDoubleTap(floor.id, this.downRoom);
    else this.options.onBack?.();
  }
}

export function createViewer(host: HTMLElement, options?: ViewerOptions): Plan2dViewer {
  return new Plan2dViewer(host, options);
}

/** The plan's look per theme; the pins use the view's own pin styles. */
export const PLAN2D_CSS = `
.fp3d-p2d:focus-visible {
  outline: 2px solid var(--fp3d-accent, #37e0ff);
  outline-offset: -3px;
}
.fp3d-p2d {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  --p2d-wall: #9fb6ff;
  --p2d-wall-ext: #c9d8ff;
  --p2d-room: rgba(55, 224, 255, 0.06);
  --p2d-room-line: rgba(55, 224, 255, 0.45);
  --p2d-item: rgba(150, 175, 255, 0.6);
  --p2d-item-fill: rgba(91, 124, 255, 0.12);
  --p2d-gap: #0b1222;
  --p2d-label: #e6eefc;
  --p2d-out: rgba(91, 124, 255, 0.06);
}
.fp3d-p2d[data-theme="blueprint"] {
  --p2d-wall: #ffffff;
  --p2d-wall-ext: #ffffff;
  --p2d-room: rgba(255, 255, 255, 0.04);
  --p2d-room-line: rgba(255, 255, 255, 0.9);
  --p2d-item: rgba(255, 255, 255, 0.95);
  --p2d-item-fill: rgba(255, 255, 255, 0.06);
  --p2d-gap: #0a2a58;
  --p2d-label: #ffffff;
  --p2d-out: rgba(255, 255, 255, 0.05);
}
.fp3d-p2d[data-theme="day"] {
  --p2d-wall: #4a5568;
  --p2d-wall-ext: #2d3646;
  --p2d-room: rgba(255, 255, 255, 0.75);
  --p2d-room-line: rgba(45, 54, 70, 0.25);
  --p2d-item: rgba(45, 54, 70, 0.6);
  --p2d-item-fill: rgba(45, 54, 70, 0.06);
  --p2d-gap: #f2f5fa;
  --p2d-label: #1d2533;
  --p2d-out: rgba(70, 140, 80, 0.12);
}
.fp3d-p2d[data-theme="realistic"] {
  --p2d-wall: #6b625a;
  --p2d-wall-ext: #4f4842;
  --p2d-room: rgba(236, 226, 210, 0.92);
  --p2d-room-line: rgba(79, 72, 66, 0.25);
  --p2d-item: rgba(70, 60, 50, 0.6);
  --p2d-item-fill: rgba(120, 100, 80, 0.12);
  --p2d-gap: #ece2d2;
  --p2d-label: #2e2924;
  --p2d-out: rgba(90, 150, 80, 0.35);
}
.fp3d-p2d-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.fp3d-p2d-svg * {
  vector-effect: non-scaling-stroke;
}
.fp3d-p2d-out {
  fill: var(--p2d-out);
  stroke: none;
}
.fp3d-p2d-probe {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 0;
  height: var(--fp3d-bottom-inset, 0px);
  visibility: hidden;
  pointer-events: none;
}
.fp3d-p2d-out-lawn { fill: rgba(70, 170, 90, 0.2); }
.fp3d-p2d-out-hedge { fill: rgba(70, 170, 90, 0.36); }
.fp3d-p2d-room {
  fill: var(--p2d-room);
  stroke: var(--p2d-room-line);
  stroke-width: 1;
  stroke-linejoin: round;
}
.fp3d-p2d-room-sel {
  stroke: var(--fp3d-accent);
  stroke-width: 2.5;
}
.fp3d-p2d-walls { pointer-events: none; }
.fp3d-p2d-wall { fill: var(--p2d-wall); }
.fp3d-p2d-wall-ext { fill: var(--p2d-wall-ext); }
.fp3d-p2d-body {
  fill: var(--fp3d-tint, var(--p2d-item-fill));
  fill-opacity: 0.9;
  stroke: var(--p2d-item);
  stroke-width: 1;
}
.fp3d-p2d-item:not([style*="--fp3d-tint"]) .fp3d-p2d-body { fill-opacity: 1; }
.fp3d-p2d-sym * {
  fill: none;
  stroke: var(--p2d-item);
  stroke-width: 1;
  pointer-events: none;
}
.fp3d-p2d-sym .fp3d-sym-fill { fill: var(--p2d-item-fill); }
.fp3d-p2d-sym .fp3d-sym-strong { stroke: var(--fp3d-accent); stroke-width: 2; }
.fp3d-p2d-sym .fp3d-sym-swing { stroke-dasharray: 4 3; opacity: 0.8; }
.fp3d-p2d-tap { cursor: pointer; }
.fp3d-p2d-item.fp3d-p2d-on .fp3d-p2d-body {
  fill: var(--fp3d-glow, var(--fp3d-warm, #ffb547));
  fill-opacity: 0.55;
  stroke: var(--fp3d-glow, var(--fp3d-warm, #ffb547));
}
.fp3d-p2d-item.fp3d-p2d-on .fp3d-p2d-sym * { stroke: var(--fp3d-glow, var(--fp3d-warm, #ffb547)); }
.fp3d-p2d-na { opacity: 0.45; }
.fp3d-p2d-open-gap { fill: var(--p2d-gap); stroke: none; }
.fp3d-p2d-open path,
.fp3d-p2d-open line {
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.fp3d-p2d-open-door path { stroke: var(--fp3d-warm, #ffb547); stroke-dasharray: 3 3; }
.fp3d-p2d-open-front path,
.fp3d-p2d-open-door line { stroke: var(--fp3d-warm, #ffb547); stroke-width: 3; stroke-dasharray: none; }
.fp3d-p2d-open-window line { stroke: var(--fp3d-accent); stroke-width: 2; }
.fp3d-p2d-open-garage line { stroke: var(--fp3d-warm, #ffb547); stroke-width: 3; }
.fp3d-p2d-open line.fp3d-p2d-open-dash { stroke-dasharray: 4 4; opacity: 0.6; }
.fp3d-p2d-open line.fp3d-p2d-open-hit { stroke: transparent; stroke-width: 22px; }
.fp3d-p2d-open-on .fp3d-p2d-open-gap { fill: rgba(255, 107, 139, 0.55); }
.fp3d-p2d-open-on line:not(.fp3d-p2d-open-hit),
.fp3d-p2d-open-on path { stroke: var(--fp3d-danger, #ff6b8b); stroke-width: 3; stroke-dasharray: none; }
.fp3d-p2d-open-covered.fp3d-p2d-open-window line:not(.fp3d-p2d-open-hit) { stroke-dasharray: 2 2; opacity: 0.7; }
.fp3d-p2d-flows { pointer-events: none; }
.fp3d-p2d-flow { stroke-linecap: round; opacity: 0.5; }
.fp3d-p2d-flow-on { opacity: 0.95; stroke-dasharray: 2 9; animation: fp3d-p2d-run 0.9s linear infinite; }
@keyframes fp3d-p2d-run { to { stroke-dashoffset: -11; } }
@media (prefers-reduced-motion: reduce) { .fp3d-p2d-flow-on { animation: none; } }
.fp3d-p2d-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.fp3d-p2d-label,
.fp3d-p2d-pin {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(calc(var(--x) * var(--k) * 1px + var(--tx)), calc(var(--z) * var(--k) * 1px + var(--ty))) translate(-50%, -50%);
}
.fp3d-p2d-label {
  /* above the middle, where a ceiling light's pin sits */
  margin-top: -22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--p2d-label);
  font: 600 12px var(--fp3d-title-font, sans-serif);
  white-space: nowrap;
  /* full strength: a faded label dropped under 7:1 in some looks (#216) */
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.fp3d-p2d[data-theme="day"] .fp3d-p2d-label,
.fp3d-p2d[data-theme="realistic"] .fp3d-p2d-label { text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8); }
.fp3d-p2d-off { visibility: hidden; }
.fp3d-p2d-label small {
  font: 500 11px var(--fp3d-font, sans-serif);
}
.fp3d-p2d-pin { pointer-events: auto; }
.fp3d-p2d-far .fp3d-p2d-pin:not(.fp3d-dev-full):not(.fp3d-p2d-flash) { display: none; }
.fp3d-p2d-flash { outline: 3px solid var(--fp3d-accent); outline-offset: 3px; }
`;
