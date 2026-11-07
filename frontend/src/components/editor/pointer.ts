// Pointer input on the plan: press, move and release for every tool, wheel and pinch zoom, double taps, the
// right-click menu's press, and the hit tests for rooms and outdoor areas.

import { halfSize, snapPoint, snapTolerance } from "../../geometry/snap-guides.ts";
import { altPick } from "../../geometry/pick.ts";
import { nearestOnOutline } from "../../pool-runs.ts";
import { polygonBox } from "../../roof-sections.ts";
import { clampField, faceAt, fieldFace, pointOnFace, roofFaces, turnGroundField, fieldCenter, wallFaces, windowAsField } from "../../solar.ts";
import { type FreeWall, poolShapePoints } from "../../model.ts";
import { openingHost } from "../../geometry/walls.ts";
import { bounds, DEFAULT_HOLOGRAM, isAxisRect, resizeFurniture, pointInPolygon, polygonArea, type Room, type Vec2 } from "../../model.ts";
import { movePet, placeOfRef } from "../../pet-place.ts";
import { insertCorner } from "../../geometry/room-corners.ts";
import { type FixKind, EDIT_DRAGS, wallPeers, SNAP_PX, round, patchItem, distToSegment } from "./helpers.ts";
import { addPoint, pointOf } from "./points.ts";
import { areasInFrame, moveAreas } from "./area-select.ts";
import type { Fp3dEditor } from "../editor.ts";

/** Whether a long press (touch) on what this drag holds starts Select several (#263): an item, outside Select several. */
export function holdStartsMulti(drag: { kind: string } | null, multiMode: boolean, editor: boolean): boolean {
  return editor && !multiMode && (drag?.kind === "furniture" || drag?.kind === "furnset");
}

/** PointerPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class PointerPart {
  // ------------------------------------------------------------------ pointer input

  onPointerDown(this: Fp3dEditor, e: PointerEvent): void {
    this._ctx = null;
    this._fixedHint = false;
    this.fixedPan = false;
    // a press that places an armed library card (#76) is no long press for the item menu
    const placing = !!this._placing;
    this.pointerDown(e);
    if (this.pointers.size !== 1) {
      clearTimeout(this.pressTimer);
      return;
    }
    this.guardFixed(this.localPoint(e));
    clearTimeout(this.pressTimer);
    this.pressStart = null;
    if (e.pointerType === "touch" && !placing && (this._tool === "select" || this._tool === "furniture" || pointOf(e.target as Element, this._roomId))) {
      const at = this.localPoint(e);
      const target = e.target as Element;
      this.pressStart = at;
      this.pressTimer = window.setTimeout(() => {
        const d = this.drag;
        if (d && "moved" in d && d.moved) return;
        this.drag = null;
        // a long press on an item starts Select several with it (#263; touch has no Shift): the item stays chosen and
        // the next taps add items. Held in Select several, or on anything else, it opens the menu as before
        if (holdStartsMulti(d, this._multiMode, this.isEditor)) {
          this._multiMode = true;
          navigator.vibrate?.(15);
          return;
        }
        this.openContext(target, at, "touch");
      }, 550);
    }
  }

  /** A drag that would move a fixed item pans the view instead (the item stays selected). */
  guardFixed(this: Fp3dEditor, local: [number, number]): void {
    const d = this.drag;
    if (!d) return;
    let target: [FixKind, string] | null = null;
    if (d.kind === "vertex" || d.kind === "room") target = ["room", d.roomId];
    else if (d.kind === "device") target = ["device", d.entityId];
    else if (d.kind === "opening") target = ["opening", d.id];
    else if (d.kind === "furniture" || d.kind === "rotate" || d.kind === "resize") target = ["furniture", d.id];
    else if (d.kind === "furnset") target = d.areas?.length && this.isFixedItem("outdoor", d.areas[0]) ? ["outdoor", d.areas[0]] : ["furniture", d.ids.find((id) => this.isFixedItem("furniture", id)) ?? d.ids[0]];
    else if (d.kind === "wallmove") target = ["wall", d.id];
    else if (d.kind === "outdoor") target = ["outdoor", d.id];
    if (!target || !this.isFixedItem(...target)) return;
    if ("moved" in d && d.moved && "base" in d) this.restoreLive(d.base);
    this.drag = { kind: "pan", last: local };
    this.fixedPan = true;
  }

  /**
   * Another plan was swapped in during a gesture (#382: a reload, someone else's save, the #149 conflict path). Every
   * gesture that edits the plan holds the plan from before it as its base and writes base + its change on each move,
   * on a cancel (second finger, pointercancel, a fixed item) and into the history on release, which would save the old
   * plan over the new one. Such gestures end here without writing anything; the new plan stays as it came. Panning,
   * pinching, framing and drawing hold no plan and go on (a drawn room is added to the new plan when let go).
   */
  dropPlanGestures(this: Fp3dEditor): void {
    if (this.drag && "base" in this.drag) {
      this.drag = null;
      this._guides = {};
      // a long press on the item dropped opens no menu on it
      clearTimeout(this.pressTimer);
      this.pressStart = null;
    }
    this.runDrag = null;
    this.fitDrag = null;
    this.jointDrag = null;
    this.lift = null;
    this.wallDrag = null;
    this.wallResize = null;
  }

  pointerDown(this: Fp3dEditor, e: PointerEvent): void {
    const svgEl = e.currentTarget as SVGSVGElement;
    svgEl.setPointerCapture(e.pointerId);
    const local = this.localPoint(e);
    this.pointers.set(e.pointerId, local);
    if (this.pointers.size === 2) {
      // second finger: cancel the current gesture and pinch instead
      if (this.drag && EDIT_DRAGS.has(this.drag.kind) && "moved" in this.drag && this.drag.moved && "base" in this.drag) this.restoreLive(this.drag.base);
      this.drag = null;
      this.pinch = this.pinchState();
      return;
    }
    if (this.pointers.size > 2) return;
    if (e.button === 1 || e.button === 2 || !this.floor) {
      // the right button: dragged it moves the plan, a click without moving opens the item's menu (D518)
      if (e.button === 2) this.rightPress = { at: local, target: e.target as Element, moved: false };
      this.drag = { kind: "pan", last: local };
      return;
    }
    const world = this.toWorld(...local);
    const target = e.target as Element;
    if (this._wallPick) {
      this.pickWall(world);
      return;
    }
    if (this._kerbPick) {
      this.setKerb(world);
      return;
    }
    if (this._vacPick) {
      // robot vacuum maps (#350): the alignment's taps
      this._vacPick(world);
      return;
    }
    if (this._petPick) {
      // roaming pets (#337): the tap sets the place the pet's panel asked for
      this.petPickAt(world);
      return;
    }
    if (this._bgLevel && this.isEditor && this.floor?.background) {
      // straighten: the second tap turns the picture so the tapped wall runs exactly along x or z
      const pts = [...this._bgLevel, world];
      if (pts.length < 2) this._bgLevel = pts;
      else this.applyBgLevel(pts[0], pts[1]);
      return;
    }
    if (this.bgHandles() && this.floor.background && target.closest("[data-bg-rotate]")) {
      const bg = this.floor.background;
      const img = this._images[bg.image_id];
      const h = bg.width * (img?.aspect ?? 1);
      const c: Vec2 = [bg.x + bg.width / 2, bg.z + h / 2];
      this.drag = { kind: "bgrotate", base: this._doc, moved: false, start: Math.atan2(world[1] - c[1], world[0] - c[0]), rot: bg.rotation ?? 0 };
      return;
    }
    if (this._bgRuler && this._bgRuler.length < 2 && this.isEditor && this.floor?.background) {
      // the ruler: two taps on a stretch of known length in the picture
      this._bgRuler = [...this._bgRuler, world];
      return;
    }
    if (this.bgHandles() && this.floor.background && !this._bgEdit && (target.closest("[data-bg-handle]") || target.closest("[data-bg]"))) {
      // the background section is open: the picture moves and scales like furniture
      const bg = this.floor.background;
      this.drag = target.closest("[data-bg-handle]")
        ? { kind: "bgscale", base: this._doc, moved: false }
        : { kind: "bgmove", start: world, bx: bg.x, bz: bg.z, base: this._doc, moved: false };
      return;
    }
    if (this._bgEdit && this.isEditor && this.floor?.background) {
      // the background picture: its corner scales it, its body moves it; anything else ends the editing
      const bg = this.floor.background;
      if (target.closest("[data-bg-handle]")) {
        this.drag = { kind: "bgscale", base: this._doc, moved: false };
        return;
      }
      if (target.closest("[data-bg]")) {
        this.drag = { kind: "bgmove", start: world, bx: bg.x, bz: bg.z, base: this._doc, moved: false };
        return;
      }
      this._bgEdit = false;
    }
    if (this.isEditor && this.pressPoint(target)) return;
    if (this._tool === "wall") {
      const start = this.snap(world, undefined, e.altKey);
      this.drag = { kind: "freewall", start, end: start };
      return;
    }
    if (this._tool === "pool" && this.poolDown(e, target, world, local)) return;
    if (this._tool === "roof" || this._tool === "energy") {
      const corner = target.closest("[data-roof-corner]")?.getAttribute("data-roof-corner");
      const vertex = target.closest("[data-roof-vertex]")?.getAttribute("data-roof-vertex");
      const body = target.closest("[data-roof]")?.getAttribute("data-roof");
      const marker = this._tool === "energy" ? target.closest("[data-energy-device]")?.getAttribute("data-energy-device") : null;
      if (marker) {
        // an energy device by its marker (above solar fields on the roof): selected and moved like furniture
        this._solarId = null;
        this.selectItem("furniture", marker);
        this.drag = this.isEditor ? { kind: "furniture", id: marker, start: world, startScreen: local, base: this._doc, moved: false } : { kind: "pan", last: local };
        return;
      }
      if (this._tool === "energy" && target.closest("[data-holo-pt]")) {
        // the free hologram's handle
        this.drag = this.isEditor ? { kind: "holopt", base: this._doc, moved: false } : { kind: "pan", last: local };
        return;
      }
      if (this._tool === "energy") {
        const pt = target.closest("[data-cable-pt]")?.getAttribute("data-cable-pt");
        const lockedCable = (id: string) => !!this._doc.settings.roof.cables?.find((c) => c.id === id)?.locked;
        if (pt && this.isEditor && !lockedCable(pt.slice(0, pt.lastIndexOf(":")))) {
          const i = pt.lastIndexOf(":");
          const id = pt.slice(0, i);
          const index = Number(pt.slice(i + 1));
          // a double click takes the point out (one point stays at least)
          if (this.doubleTap(e, `cable:${pt}`)) {
            this.change((d) => {
              const c = d.settings.roof.cables?.find((x) => x.id === id);
              if (c && c.points.length > 1) c.points.splice(index, 1);
            });
            this.drag = { kind: "pan", last: local };
            return;
          }
          this.drag = { kind: "cablept", id, index, base: this._doc, moved: false };
          return;
        }
        const line = target.closest("[data-cable-line]")?.getAttribute("data-cable-line");
        if (line && this.isEditor && !lockedCable(line)) {
          // a click on the laid cable puts a new point there and takes it along (piece i lies before point i)
          const index = Number(target.closest("[data-cable-line]")?.getAttribute("data-cable-seg") ?? 0);
          const base = this._doc;
          this.change((d) => {
            const c = d.settings.roof.cables?.find((x) => x.id === line);
            if (c) c.points.splice(index, 0, [round(world[0]), round(world[1])]);
          });
          this.drag = { kind: "cablept", id: line, index, base, moved: true };
          return;
        }
        const cable = target.closest("[data-cable]")?.getAttribute("data-cable");
        if (cable) {
          this._cableId = cable;
          // grabbing an automatic cable lays it by hand right away, with a new point under the pointer to drag
          if (this.isEditor && this._floorId && !this._doc.settings.roof.cables?.some((c) => c.id === cable)) {
            const base = this._doc;
            this.layCable(cable);
            const laid = this._doc.settings.roof.cables?.find((c) => c.id === cable);
            const mine = this.cableSegments().filter((x) => x.key === cable);
            if (laid && mine.length) {
              const chain: Vec2[] = [[mine[0].a[0], mine[0].a[2]], ...laid.points, [mine[mine.length - 1].b[0], mine[mine.length - 1].b[2]]];
              let index = 0;
              let best = Infinity;
              for (let i = 0; i + 1 < chain.length; i++) {
                const d = distToSegment(world, chain[i], chain[i + 1]);
                if (d < best) {
                  best = d;
                  index = i;
                }
              }
              this.change((d) => {
                const c = d.settings.roof.cables?.find((x) => x.id === cable);
                if (c) c.points.splice(index, 0, [round(world[0]), round(world[1])]);
              });
              this.drag = { kind: "cablept", id: cable, index, base, moved: true };
              return;
            }
          }
          this.drag = { kind: "pan", last: local };
          return;
        }
      }
      const solar = this._tool === "energy" ? target.closest("[data-solar]")?.getAttribute("data-solar") : null;
      const turn = this._tool === "energy" ? target.closest("[data-solar-turn]")?.getAttribute("data-solar-turn") : null;
      if (turn && this.isEditor) {
        this.drag = { kind: "solarturn", id: turn, base: this._doc, moved: false };
        return;
      }
      if (solar) {
        const cell = target.closest("[data-cell]")?.getAttribute("data-cell");
        // pick mode on the selected field: a tap switches the module on or off
        if (this._solarPick && solar === this._solarId && cell && this.isEditor) {
          this.toggleSolarCell(cell);
          this.drag = { kind: "pan", last: local };
          return;
        }
        // otherwise: select the field and move it, also onto another roof face
        if (solar !== this._solarId) this._solarPick = false;
        this._solarId = solar;
        this._roofId = null;
        const field = this._doc.settings.roof.solar?.find((x) => x.id === solar);
        const face = field ? (fieldFace(this._doc, field) ?? undefined) : undefined;
        const hit = face ? this.faceHit(face, world) : null;
        const grab = field && hit ? { du: hit.u - field.u, ds: Number.isNaN(hit.s) ? 0 : hit.s - field.v } : null;
        // solar fields are fittings like furniture: the plan lock (rooms, walls, openings) does not hold them
        this.drag = this.isEditor && !field?.locked ? { kind: "solarmove", id: solar, start: world, startScreen: local, base: this._doc, moved: false, grab } : { kind: "pan", last: local };
        return;
      }
      const win = this._tool === "roof" ? target.closest("[data-roofwin]")?.getAttribute("data-roofwin") : null;
      if (win) {
        this._roofWinId = win;
        this._roofId = null;
        const w = this._doc.settings.roof.windows?.find((x) => x.id === win);
        const face = w ? roofFaces(this._doc).find((f) => f.key === w.face) : undefined;
        const hit = face ? pointOnFace(face, world) : null;
        const grab = w && hit ? { du: hit.u - w.u, ds: hit.s - w.v } : null;
        this.drag = this.isEditor && !w?.locked ? { kind: "solarmove", id: win, start: world, startScreen: local, base: this._doc, moved: false, grab, win: true } : { kind: "pan", last: local };
        return;
      }
      if (this._tool === "roof") this._roofWinId = null;
      const device = this._tool === "energy" ? target.closest(".fp3d-energy-item")?.getAttribute("data-furniture") : null;
      if (device) {
        // an energy device (inverter, battery, wallbox): selected and moved like furniture
        this._solarId = null;
        this.selectItem("furniture", device);
        this.drag = this.isEditor ? { kind: "furniture", id: device, start: world, startScreen: local, base: this._doc, moved: false } : { kind: "pan", last: local };
        return;
      }
      if (this._tool === "energy") {
        // beside the fields the energy tool only pans the plan
        this.selectItem("furniture", null);
        this._solarId = null;
        this.drag = { kind: "pan", last: local };
        return;
      }
      if (vertex && this.isEditor) {
        const [id, idx] = vertex.split(":");
        this.drag = { kind: "roofvertex", id, index: Number(idx), base: this._doc, moved: false };
      } else if (corner && this.isEditor) {
        const [id, cx, cz] = corner.split(":");
        this.drag = { kind: "roofcorner", id, corner: [cx === "1" ? 1 : 0, cz === "1" ? 1 : 0], base: this._doc, moved: false };
      } else if (body) {
        const fixed = this.roofFixed(this._doc.settings.roof.sections?.find((x) => x.id === body));
        if (fixed && this._roofId === body) this._fixedHint = true;
        this._roofId = body;
        this._point = null;
        this.drag = this.isEditor && !fixed ? { kind: "roofmove", id: body, start: world, startScreen: local, base: this._doc, moved: false } : { kind: "pan", last: local };
      } else if (this.isEditor) {
        this._roofId = null;
        const start = this.snap(world, undefined, e.altKey);
        this.drag = { kind: "rect", start, end: start, roof: true };
      } else this.drag = { kind: "pan", last: local };
      return;
    }
    const drawsPool = this._tool === "pool" && !this._pipeMode;
    if (this._tool === "rect" || ((this._tool === "outdoor" || drawsPool) && !this._outdoorFree) || this._tool === "hole") {
      const start = this.snap(world, undefined, e.altKey);
      this.drag = { kind: "rect", start, end: start, outdoor: this._tool === "outdoor" || drawsPool, hole: this._tool === "hole" };
      return;
    }
    if (this._tool === "polygon" || this._tool === "measure" || ((this._tool === "outdoor" || drawsPool) && this._outdoorFree)) {
      this.drag = { kind: "tap", startScreen: local, last: local, panning: false };
      return;
    }
    if (this._tool === "opening") {
      this._openingNote = null;
      // a press on an existing opening selects it (and drags it along its wall) before anything is added (#62)
      const openingEl = target.closest("[data-opening]");
      if (openingEl) this.pressOpening(openingEl.getAttribute("data-opening")!, local);
      else if (!this.placeOpening(this._openingPreset, local, this.snapOff(e))) this.drag = { kind: "pan", last: local };
      return;
    }
    if (this._placing && this.isEditor && (this._tool === "select" || this._tool === "furniture")) {
      // an armed library card lands where the plan is clicked (#76), snapped to the wall unless Shift is held or the snap
      // switch is off (#173); Ctrl/Cmd keeps it for the next click
      this.placeArmed(this.placeTarget(world, this.snapOff(e)), e.ctrlKey || e.metaKey);
      this.drag = null;
      return;
    }
    if (this.isEditor && (this._tool === "select" || this._tool === "furniture") && (e.shiftKey || this._multiMode)) {
      // several furniture items: shift-click (or the multi mode on touch) adds or removes one, a drag draws a frame
      const fEl = target.closest("[data-furniture]");
      const outEl = fEl ? null : target.closest("[data-outdoor]");
      if (fEl) {
        this.toggleMulti(fEl.getAttribute("data-furniture")!);
        this.drag = null;
      } else if (outEl && !target.closest("[data-room]") && !this.roomAt(world)) {
        // an outdoor area joins or leaves the selection too (#400)
        this.toggleAreaMulti(this.outdoorAt(world) ?? outEl.getAttribute("data-outdoor")!);
        this.drag = null;
      } else this.drag = { kind: "marquee", start: world, end: world, add: true };
      return;
    }
    const petEl = target.closest("[data-pet]");
    if (petEl && this.isEditor) {
      // a pet's spot (#17, #337: or its trigger's place): dragged there; a tap opens the pet's panel
      this.drag = { kind: "pet", id: petEl.getAttribute("data-pet")!, ref: petEl.getAttribute("data-pet-ref") ?? undefined, start: world, startScreen: local, base: this._doc, moved: false };
      return;
    }
    const deviceEl = target.closest("[data-device]");
    if (deviceEl && this.isEditor) {
      this.drag = { kind: "device", entityId: deviceEl.getAttribute("data-device")!, start: world, startScreen: local, base: this._doc, moved: false };
      return;
    }
    const openingEl = target.closest("[data-opening]");
    // a door's or window's wide invisible tap band gives way to an item pressed on its shape: a radiator under the
    // window, 2 px deep on screen, was out of reach (#132); the opening's drawn gap still wins
    if (openingEl && !(target.getAttribute("class") === "fp3d-open-hit" && this.firmItemAt(world, e.pointerType))) {
      this.pressOpening(openingEl.getAttribute("data-opening")!, local);
      return;
    }
    const resizeEl = target.closest("[data-resize]");
    if (resizeEl && this.isEditor) {
      const [id, sx, sz] = resizeEl.getAttribute("data-resize")!.split(":");
      this.drag = { kind: "resize", id, corner: [sx === "1" ? 1 : -1, sz === "1" ? 1 : -1], base: this._doc, moved: false };
      return;
    }
    const rotateEl = target.closest("[data-rotate]");
    if (rotateEl && this.isEditor) {
      this.drag = { kind: "rotate", id: rotateEl.getAttribute("data-rotate")!, base: this._doc, moved: false };
      return;
    }
    // an item under the press, its drawn shape grown to a minimum target (#72): it wins over the room under it. With
    // Alt held a press on the selected item grabs it (Alt-drag = move freely) and a click goes through the stack (#125)
    const alt = e.altKey ? altPick(this.itemHits(target, world, e.pointerType), this.selection(), this._furnitureId) : null;
    const pickedId = alt ? (alt.grab ?? this.pickItem(target, world, e.pointerType)) : this.pickItem(target, world, e.pointerType);
    if (pickedId) {
      const id = pickedId;
      const now = Date.now();
      const twice = this.lastFurnTap?.id === id && now - this.lastFurnTap.t < 400;
      this.lastFurnTap = { id, t: now };
      const f = this.floor.furniture.find((m) => m.id === id);
      if (twice && f?.group) {
        // a double tap into a block: this one part alone
        this.selectItem("furniture", id);
        this._single = true;
      } else if (!this.selection().includes(id) || this._single) {
        this.selectItem("furniture", id);
      }
      const set = this.selection();
      // outdoor areas chosen with the items move with them (#400)
      const areas = this._multiOut.length ? [...this._multiOut] : undefined;
      this.drag = !this.isEditor
        ? { kind: "pan", last: local }
        : set.length > 1 || areas
          ? { kind: "furnset", ids: set, start: world, startScreen: local, base: this._doc, moved: false, pick: alt?.next, areas }
          : { kind: "furniture", id, start: world, startScreen: local, base: this._doc, moved: false, pick: alt?.next };
      return;
    }
    const vertexEl = target.closest("[data-vertex]");
    const midEl = target.closest("[data-mid]");
    if (vertexEl && this.room && this.isEditor) {
      this._vertex = Number(vertexEl.getAttribute("data-vertex"));
      this.drag = { kind: "vertex", roomId: this.room.id, index: this._vertex, base: this._doc, moved: false };
      return;
    }
    if (midEl && this.room && this.isEditor) {
      const i = Number(midEl.getAttribute("data-mid"));
      const pts = this.room.points;
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const mid: Vec2 = [round((a[0] + b[0]) / 2), round((a[1] + b[1]) / 2)];
      const base = this._doc;
      const roomId = this.room.id;
      // no history here: the pointer-up records the state before the insert
      this.change(
        (_, floor) => {
          // the halves keep the wall's settings; splits, part heights and openings go with their half (#157)
          insertCorner(floor, roomId, i, mid);
        },
        base,
        false,
      );
      this._vertex = i + 1;
      // the moves edit the plan with the new corner in it (`from`); `base`, without it, is the undo step
      this.drag = { kind: "vertex", roomId, index: i + 1, base, from: this._doc, moved: true };
      return;
    }
    const wallEndEl = target.closest("[data-wall-end]");
    if (wallEndEl && this.isEditor) {
      const [id, end] = wallEndEl.getAttribute("data-wall-end")!.split(":");
      this.drag = { kind: "wallmove", id, end: end as "a" | "b", start: world, startScreen: local, base: this._doc, moved: false };
      return;
    }
    const freeWallEl = target.closest("[data-free-wall]");
    if (freeWallEl) {
      const id = freeWallEl.getAttribute("data-free-wall")!;
      this.selectItem("wall", id);
      this.drag = this.isEditor ? { kind: "wallmove", id, end: null, start: world, startScreen: local, base: this._doc, moved: false } : { kind: "pan", last: local };
      return;
    }
    const outBoxEl = target.closest("[data-out-box]");
    if (outBoxEl && this.isEditor) {
      const [id, i] = outBoxEl.getAttribute("data-out-box")!.split(":");
      this.drag = { kind: "outbox", id, corner: Number(i), base: this._doc, moved: false };
      return;
    }
    const outVertexEl = target.closest("[data-out-vertex]");
    if (outVertexEl && this.isEditor) {
      const [id, i] = outVertexEl.getAttribute("data-out-vertex")!.split(":");
      this.drag = { kind: "outvertex", id, index: Number(i), base: this._doc, moved: false };
      return;
    }
    const outdoorEl = target.closest("[data-outdoor]");
    if (outdoorEl && !target.closest("[data-room]") && !this.roomAt(world)) {
      // the drawn element is the topmost area; a smaller one under the point (a pool in the lawn) wins
      const id = this.outdoorAt(world) ?? outdoorEl.getAttribute("data-outdoor")!;
      if (this.isEditor && this._multiOut.includes(id)) {
        // one of several chosen areas (with items or not): the whole selection moves (#400)
        this.drag = { kind: "furnset", ids: this._furnitureId ? this.selection() : [], start: world, startScreen: local, base: this._doc, moved: false, areas: [...this._multiOut] };
        return;
      }
      this.selectItem("outdoor", id);
      this.drag = this.isEditor ? { kind: "outdoor", id, start: world, startScreen: local, base: this._doc, moved: false } : { kind: "pan", last: local };
      return;
    }
    const ghostEl = target.closest("[data-out-ghost]");
    if (ghostEl && !target.closest("[data-room]") && !this.roomAt(world)) {
      // an outdoor area of a floor below (#401): a tap offers to go there, a drag pans
      const v = ghostEl.getAttribute("data-out-ghost")!;
      const at = v.indexOf(":");
      this.drag = { kind: "tap", startScreen: local, last: local, panning: false, ghost: { floor: v.slice(0, at), id: v.slice(at + 1) } };
      return;
    }
    const roomId = target.closest("[data-room]")?.getAttribute("data-room") ?? this.roomAt(world);
    if (roomId) {
      if (roomId !== this._roomId) this._vertex = null;
      // the body moves the room only once the room alone is selected (#72); the first press selects it and pans
      const selectedAlone = roomId === this._roomId && !this._furnitureId && !this._openingId && !this._deviceId && !this._outdoorId && !this._wallId && !this._multi.length;
      this.selectItem("room", roomId);
      this.drag =
        this.isEditor && this._tool !== "furniture" && selectedAlone
        ? { kind: "room", roomId, start: world, startScreen: local, base: this._doc, moved: false }
        : { kind: "pan", last: local };
      return;
    }
    this.selectItem("room", null);
    this.drag = { kind: "pan", last: local };
  }

  onPointerMove(this: Fp3dEditor, e: PointerEvent): void {
    if (this.rightPress && !this.rightPress.moved) {
      const p = this.localPoint(e);
      if (Math.hypot(p[0] - this.rightPress.at[0], p[1] - this.rightPress.at[1]) > 5) this.rightPress.moved = true;
    }
    if (this.pressStart) {
      const p = this.localPoint(e);
      if (Math.hypot(p[0] - this.pressStart[0], p[1] - this.pressStart[1]) > 8) {
        clearTimeout(this.pressTimer);
        this.pressStart = null;
        if (this.fixedPan) this._fixedHint = true;
      }
    } else if (this.fixedPan && !this._fixedHint && this.drag?.kind === "pan") this._fixedHint = true;
    const local = this.localPoint(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, local);
    if (this.pinch) {
      const now = this.pinchState();
      if (now) {
        this.zoomAt(now.dist / Math.max(1, this.pinch.dist), ...now.mid);
        this._view = { ...this._view, ox: this._view.ox + now.mid[0] - this.pinch.mid[0], oy: this._view.oy + now.mid[1] - this.pinch.mid[1] };
        this.pinch = now;
      }
      return;
    }
    const world = this.toWorld(...local);
    this.planPointer = e.pointerType === "mouse" ? world : null;
    const drag = this.drag;
    if (!drag) {
      if (this._placing) this._placeAt = this.placeTarget(world, this.snapOff(e));
      // Doors & windows draws no cursor: a new point there would only render the editor again (#130); its snap
      // guides along the wall come from hoverOpening (#143)
      if (this._tool !== "select" && this._tool !== "furniture" && this._tool !== "opening" && this.floor) this._cursor = this.snap(world, undefined, e.altKey);
      if (this._tool === "opening" && e.pointerType !== "touch") this.hoverOpening(e.target as Element, local, this.snapOff(e));
      return;
    }
    switch (drag.kind) {
      case "pan":
        this.panCursor(true);
        this._view = { ...this._view, ox: this._view.ox + local[0] - drag.last[0], oy: this._view.oy + local[1] - drag.last[1] };
        drag.last = local;
        break;
      case "tap":
        if (drag.panning || Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) > 6) {
          drag.panning = true;
          this.panCursor(true);
          this._view = { ...this._view, ox: this._view.ox + local[0] - drag.last[0], oy: this._view.oy + local[1] - drag.last[1] };
        }
        drag.last = local;
        break;
      case "rect":
        drag.end = this.snap(world, undefined, e.altKey);
        this.requestUpdate();
        break;
      case "freewall": {
        // Shift keeps the wall straight (horizontal or vertical)
        let end = this.snap(world, undefined, e.altKey);
        if (e.shiftKey) end = Math.abs(end[0] - drag.start[0]) > Math.abs(end[1] - drag.start[1]) ? [end[0], drag.start[1]] : [drag.start[0], end[1]];
        drag.end = end;
        this.requestUpdate();
        break;
      }
      case "wallmove": {
        if (!drag.moved && Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) < 5) return;
        drag.moved = true;
        const w = (drag.base.floors.find((f) => f.id === this._floorId)?.walls ?? []).find((q) => q.id === drag.id);
        if (!w) return;
        let next: Pick<FreeWall, "a" | "b">;
        if (drag.end) {
          const p = this.snap(world, undefined, e.altKey);
          next = drag.end === "a" ? { a: p, b: w.b } : { a: w.a, b: p };
        } else {
          const g = e.altKey ? 0.01 : this._doc.settings.grid;
          const dx = Math.round((world[0] - drag.start[0]) / g) * g;
          const dz = Math.round((world[1] - drag.start[1]) / g) * g;
          next = { a: [round(w.a[0] + dx), round(w.a[1] + dz)], b: [round(w.b[0] + dx), round(w.b[1] + dz)] };
        }
        this.changeFloor((floor) => Object.assign((floor.walls ?? []).find((q) => q.id === drag.id)!, next), drag.base);
        break;
      }
      case "vertex": {
        const p = this.snap(world, { roomId: drag.roomId, index: drag.index }, e.altKey);
        drag.moved = true;
        this.change(
          (_, floor) => {
            floor.rooms.find((r) => r.id === drag.roomId)!.points[drag.index] = p;
          },
          drag.from ?? drag.base,
          false,
        );
        break;
      }
      case "room": {
        if (!drag.moved && Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) < 5) return;
        drag.moved = true;
        const room = drag.base.floors.find((f) => f.id === this._floorId)?.rooms.find((r) => r.id === drag.roomId);
        if (!room) return;
        const delta = this.roomDelta(room, [world[0] - drag.start[0], world[1] - drag.start[1]], e.altKey);
        const baseFloor = drag.base.floors.find((f) => f.id === this._floorId)!;
        // devices inside the room move with it
        const inside = new Set(baseFloor.placements.filter((pl) => pointInPolygon([pl.x, pl.z], room.points)).map((pl) => pl.entity_id));
        this.change(
          (_, floor) => {
            const r = floor.rooms.find((x) => x.id === drag.roomId)!;
            r.points = room.points.map(([x, z]) => [round(x + delta[0]), round(z + delta[1])]);
            floor.placements = baseFloor.placements.map((pl) =>
              inside.has(pl.entity_id) ? { ...pl, x: round(pl.x + delta[0]), z: round(pl.z + delta[1]) } : pl,
            );
          },
          drag.base,
          false,
        );
        break;
      }
      case "roofmove": {
        if (!drag.moved && Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) < 5) return;
        drag.moved = true;
        const g = e.altKey ? 0.01 : this._doc.settings.grid;
        const dx = round(Math.round((world[0] - drag.start[0]) / g) * g);
        const dz = round(Math.round((world[1] - drag.start[1]) / g) * g);
        const src = drag.base.settings.roof.sections?.find((x) => x.id === drag.id);
        if (!src) return;
        this.change(
          (doc) => {
            const sec = doc.settings.roof.sections?.find((x) => x.id === drag.id);
            if (!sec) return;
            Object.assign(sec, { x0: round(src.x0 + dx), x1: round(src.x1 + dx), z0: round(src.z0 + dz), z1: round(src.z1 + dz) });
            if (src.pivot) sec.pivot = [round(src.pivot[0] + dx), round(src.pivot[1] + dz)];
            if (src.points) sec.points = src.points.map(([x, z]) => [round(x + dx), round(z + dz)] as Vec2);
          },
          drag.base,
          false,
        );
        break;
      }
      case "solarturn": {
        drag.moved = true;
        const src = drag.base.settings.roof.solar?.find((x) => x.id === drag.id);
        const face = src ? fieldFace(drag.base, src) : null;
        if (!src || !face) return;
        // the handle sits in front of the field: turn its front towards the pointer
        const [cx, cz] = fieldCenter(face, src);
        let a = (Math.atan2(world[0] - cx, -(world[1] - cz)) * 180) / Math.PI;
        const step = e.altKey ? 1 : 15;
        a = Math.round(a / step) * step;
        const turned = turnGroundField(drag.base, src, a);
        this.change(
          (doc) => {
            const f = doc.settings.roof.solar?.find((x) => x.id === drag.id);
            if (f) Object.assign(f, turned);
          },
          drag.base,
          false,
        );
        break;
      }
      case "solarmove": {
        if (!drag.moved && Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) < 5) return;
        drag.moved = true;
        const winSrc = drag.win ? drag.base.settings.roof.windows?.find((x) => x.id === drag.id) : undefined;
        const src = drag.win ? (winSrc ? windowAsField(winSrc) : undefined) : drag.base.settings.roof.solar?.find((x) => x.id === drag.id);
        // roof faces, and the walls of the floor the plan shows
        const faces = drag.win ? roofFaces(drag.base) : [...roofFaces(drag.base), ...(this._floorId ? wallFaces(drag.base, this._floorId) : [])];
        const own = src ? fieldFace(drag.base, src, faces) : null;
        if (!src || !own) return;
        const step = e.altKey ? 0.01 : 0.05;
        const snapTo = (v: number) => round(Math.round(v / step) * step);
        // over a roof face the field follows the cursor there (it may change to that face) …
        const hit = own.unbounded ? null : faceAt(faces, world);
        let face = own;
        let u: number;
        let v: number;
        if (hit && drag.grab) {
          face = hit.face;
          u = snapTo(hit.u - drag.grab.du);
          // on a wall the height stays (or starts at head height when the field comes from elsewhere)
          v = Number.isNaN(hit.s) ? (hit.face.key === src.face ? src.v : Math.max(0, hit.face.ls - 1.5)) : snapTo(hit.s - drag.grab.ds);
        } else {
          // … elsewhere it moves along its own face (a slope looks shorter in the plan)
          const dx = world[0] - drag.start[0];
          const dz = world[1] - drag.start[1];
          const es = [own.es[0], own.es[2]];
          const esLen2 = es[0] * es[0] + es[1] * es[1] || 1;
          u = snapTo(src.u + dx * own.eu[0] + dz * own.eu[2]);
          v = snapTo(src.v + (dx * es[0] + dz * es[1]) / esLen2);
        }
        // it never slides off its face
        const kept = clampField(face, { ...src, face: face.key, u, v, tilt: face.flat ? (src.tilt ?? 15) : src.tilt });
        this.change(
          (doc) => {
            if (drag.win) {
              const w = doc.settings.roof.windows?.find((x) => x.id === drag.id);
              if (w) Object.assign(w, { face: face.key, ...kept });
              return;
            }
            const f = doc.settings.roof.solar?.find((x) => x.id === drag.id);
            if (f) Object.assign(f, { face: face.key, ...kept }, face.flat && f.tilt == null ? { tilt: 15 } : {});
          },
          drag.base,
          false,
        );
        break;
      }
      case "outbox": {
        drag.moved = true;
        const p = this.snap(world, undefined, e.altKey);
        const src = drag.base.floors.find((f) => f.id === this._floorId)?.outdoor.find((a) => a.id === drag.id);
        if (!src?.pool_shape) return;
        const b = bounds(src.points);
        const corners: Vec2[] = [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]];
        const fixed = corners[(drag.corner + 2) % 4];
        let dx = p[0] - fixed[0];
        let dz = p[1] - fixed[1];
        if (src.pool_shape === "round") {
          // a circle: the larger of the two pulls decides the diameter
          const d = Math.max(Math.abs(dx), Math.abs(dz), 0.5);
          dx = Math.sign(dx || 1) * d;
          dz = Math.sign(dz || 1) * d;
        } else {
          dx = Math.sign(dx || 1) * Math.max(Math.abs(dx), 0.5);
          dz = Math.sign(dz || 1) * Math.max(Math.abs(dz), 0.5);
        }
        const x0 = Math.min(fixed[0], fixed[0] + dx);
        const x1 = Math.max(fixed[0], fixed[0] + dx);
        const z0 = Math.min(fixed[1], fixed[1] + dz);
        const z1 = Math.max(fixed[1], fixed[1] + dz);
        const shape = src.pool_shape;
        this.change(
          (_, floor) => {
            const a = floor.outdoor.find((x) => x.id === drag.id);
            if (a) a.points = poolShapePoints(shape, round(x0), round(z0), round(x1), round(z1));
          },
          drag.base,
          false,
        );
        break;
      }
      case "pipept": {
        drag.moved = true;
        const q = this.snap(world, undefined, e.altKey);
        this.change(
          (_, floor) => {
            const pipe = floor.outdoor.find((a) => a.id === drag.pool)?.pool?.pipes?.find((x) => x.id === drag.pipe);
            if (pipe) pipe.points[drag.index] = [round(q[0]), round(q[1])];
          },
          drag.base,
          false,
        );
        break;
      }
      case "poolport": {
        drag.moved = true;
        const q = this.snap(world, undefined, e.altKey);
        this.change(
          (_, floor) => {
            const area = floor.outdoor.find((a) => a.id === drag.pool);
            const port = area?.pool?.ports?.find((x) => x.id === drag.id);
            if (!area || !port) return;
            // skimmer and inlets sit on the pool's rim, the drain and the waste drain anywhere
            const [x, z] = port.kind === "skimmer" || port.kind === "inlet" ? nearestOnOutline(area.points, q) : q;
            port.x = round(x);
            port.z = round(z);
          },
          drag.base,
          false,
        );
        break;
      }
      case "pooljoint": {
        if (!drag.moved && Math.hypot(world[0] - drag.start[0], world[1] - drag.start[1]) < 0.05) break;
        drag.moved = true;
        const src = drag.base.floors.flatMap((f) => f.outdoor).find((o) => o.id === drag.pool)?.pool?.joints?.find((j) => j.id === drag.id);
        if (!src) break;
        let q = this.snap([src.x + world[0] - drag.start[0], src.z + world[1] - drag.start[1]], undefined, e.altKey);
        // a hole in a wall stays in its wall: it slides along it
        if (src.kind === "wall") {
          const t: Vec2 = [-(src.nz ?? 0), src.nx ?? 0];
          const k = (q[0] - src.x) * t[0] + (q[1] - src.z) * t[1];
          q = [src.x + t[0] * k, src.z + t[1] * k];
        }
        this.change(
          (d) => {
            const j = d.floors.flatMap((f) => f.outdoor).find((o) => o.id === drag.pool)?.pool?.joints?.find((x) => x.id === drag.id);
            if (j) [j.x, j.z] = [round(q[0]), round(q[1])];
          },
          drag.base,
          false,
        );
        break;
      }
      case "pooldev": {
        if (!drag.moved && Math.hypot(world[0] - drag.start[0], world[1] - drag.start[1]) < 0.05) break;
        drag.moved = true;
        const src = drag.base.floors.flatMap((f) => f.furniture).find((m) => m.id === drag.id);
        if (!src) break;
        const q = this.snap([src.x + world[0] - drag.start[0], src.z + world[1] - drag.start[1]], undefined, e.altKey);
        this.change(
          (d) => {
            const f = d.floors.flatMap((x) => x.furniture).find((m) => m.id === drag.id);
            if (f) [f.x, f.z] = [round(q[0]), round(q[1])];
          },
          drag.base,
          false,
        );
        break;
      }
      case "outvertex": {
        drag.moved = true;
        const p = this.snap(world, undefined, e.altKey);
        const src = (drag.from ?? drag.base).floors.find((f) => f.id === this._floorId)?.outdoor.find((a) => a.id === drag.id);
        if (!src) return;
        const rect = isAxisRect(src.points);
        this.change(
          (_, floor) => {
            const a = floor.outdoor.find((x) => x.id === drag.id);
            if (!a) return;
            const pts = src.points.map((q) => [...q] as Vec2);
            const i = drag.index;
            const old = src.points[i];
            pts[i] = [round(p[0]), round(p[1])];
            // a rectangle stays a rectangle: the corners sharing an x or a z with the dragged one follow
            if (rect)
              src.points.forEach((q, j) => {
                if (j === i) return;
                if (Math.abs(q[0] - old[0]) < 1e-6) pts[j][0] = round(p[0]);
                if (Math.abs(q[1] - old[1]) < 1e-6) pts[j][1] = round(p[1]);
              });
            a.points = pts;
          },
          drag.from ?? drag.base,
          false,
        );
        break;
      }
      case "cablept": {
        drag.moved = true;
        const p = this.snap(world, undefined, e.altKey);
        this.change(
          (doc) => {
            const c = doc.settings.roof.cables?.find((x) => x.id === drag.id);
            if (c && c.points[drag.index]) c.points[drag.index] = [round(p[0]), round(p[1])];
          },
          drag.base,
          false,
        );
        break;
      }
      case "holopt": {
        drag.moved = true;
        const p = this.snap(world, undefined, e.altKey);
        this.change((doc) => (doc.settings.roof.hologram = { ...(doc.settings.roof.hologram ?? DEFAULT_HOLOGRAM), place: "free", x: round(p[0]), z: round(p[1]) }), drag.base, false);
        break;
      }
      case "bgmove": {
        drag.moved = true;
        const dx = world[0] - drag.start[0];
        const dz = world[1] - drag.start[1];
        this.change(
          (_, floor) => {
            if (floor.background) {
              floor.background.x = round(drag.bx + dx);
              floor.background.z = round(drag.bz + dz);
            }
          },
          drag.base,
          false,
        );
        break;
      }
      case "bgrotate": {
        drag.moved = true;
        const bg = this.floor?.background;
        const img = bg ? this._images[bg.image_id] : undefined;
        if (!bg || !img) break;
        const h = bg.width * img.aspect;
        const c: Vec2 = [bg.x + bg.width / 2, bg.z + h / 2];
        const now = Math.atan2(world[1] - c[1], world[0] - c[0]);
        // turn about the middle; Shift snaps to whole 15° steps, otherwise tenths of a degree
        let rot = drag.rot + ((now - drag.start) * 180) / Math.PI;
        rot = e.shiftKey ? Math.round(rot / 15) * 15 : Math.round(rot * 10) / 10;
        rot = ((((rot + 180) % 360) + 360) % 360) - 180;
        this.change(
          (_, floor) => {
            if (floor.background) floor.background.rotation = rot;
          },
          drag.base,
          false,
        );
        break;
      }
      case "bgscale": {
        drag.moved = true;
        const bg = this.floor?.background;
        const img = bg ? this._images[bg.image_id] : undefined;
        if (!bg || !img) break;
        // the corner follows the pointer along the picture's own width, whatever its turn
        const [lx] = this.bgLocal(bg, world, img.aspect);
        const width = Math.max(0.5, round(lx));
        this.change(
          (_, floor) => {
            if (floor.background) floor.background.width = width;
          },
          drag.base,
          false,
        );
        break;
      }
      case "roofvertex": {
        drag.moved = true;
        const p = this.snap(world, undefined, e.altKey);
        this.change(
          (doc) => {
            const sec = doc.settings.roof.sections?.find((x) => x.id === drag.id);
            if (!sec?.points || drag.index >= sec.points.length) return;
            sec.points[drag.index] = [round(p[0]), round(p[1])];
            Object.assign(sec, polygonBox(sec.points));
          },
          drag.from ?? drag.base,
          false,
        );
        break;
      }
      case "roofcorner": {
        drag.moved = true;
        const p = this.snap(world, undefined, e.altKey);
        this.change(
          (doc) => {
            const sec = doc.settings.roof.sections?.find((x) => x.id === drag.id);
            if (!sec) return;
            if (drag.corner[0]) sec.x1 = round(p[0]);
            else sec.x0 = round(p[0]);
            if (drag.corner[1]) sec.z1 = round(p[1]);
            else sec.z0 = round(p[1]);
          },
          drag.base,
          false,
        );
        break;
      }
      case "opening": {
        if (!drag.moved && Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) < 5) return;
        drag.moved = true;
        const baseFloor = drag.base.floors.find((f) => f.id === this._floorId);
        const o = baseFloor?.openings.find((x) => x.id === drag.id);
        const host = o && baseFloor ? openingHost(o, baseFloor.rooms, baseFloor.walls ?? []) : null;
        if (!o || !host) return;
        // the wall's middle and ends, equal gaps, set distances from a corner, else the grid; Alt: freely (#143)
        drag.peers ??= wallPeers(baseFloor!, o);
        const offset = this.snapOnEdge(host.room, host.edge, world, o.width, drag.peers, this.snapOff(e));
        this.changeFloor((floor) => patchItem(floor.openings.find((x) => x.id === drag.id), { offset }), drag.base);
        break;
      }
      case "furniture": {
        if (!drag.moved && Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) < 5) return;
        drag.moved = true;
        const baseFloor = drag.base.floors.find((x) => x.id === this._floorId);
        const f = baseFloor?.furniture.find((x) => x.id === drag.id);
        if (!baseFloor || !f) return;
        const free = this.snapOff(e);
        const g = free ? 0.01 : this._doc.settings.grid;
        const rx = f.x + world[0] - drag.start[0];
        const rz = f.z + world[1] - drag.start[1];
        // alignment with the room's centre lines and other items' edges and centres first (#143; the lines are
        // gathered once per drag); an axis no guide takes goes on the grid
        const aligned = free ? null : snapPoint([rx, rz], halfSize(f), (drag.lines ??= this.alignLinesFor(baseFloor, f.id)), snapTolerance(this._view.scale));
        let x = aligned?.x ? round(aligned.p[0]) : round(Math.round(rx / g) * g);
        let z = aligned?.z ? round(aligned.p[1]) : round(Math.round(rz / g) * g);
        let rotation = f.rotation;
        // near a wall: turn the back (or a side) to it and sit flush; Alt moves freely
        const snap = free ? null : this.snapToWall({ ...f, x, z });
        if (snap) ({ x, z, rotation } = snap);
        // a wall that pulled the item off a guide drops that guide
        this.showGuides(aligned?.guides.length ? aligned.guides.filter((q) => Math.abs(q.axis === "x" ? x - aligned.p[0] : z - aligned.p[1]) < 0.002) : []);
        this.changeFloor((floor) => patchItem(floor.furniture.find((q) => q.id === drag.id), { x, z, rotation }), drag.base);
        break;
      }
      case "furnset": {
        // the whole selection by the same step (on the grid; Alt: by the centimetre), no wall snap – it keeps its shape
        if (!drag.moved && Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) < 5) return;
        drag.moved = true;
        const g = e.altKey ? 0.01 : this._doc.settings.grid;
        const dx = round(Math.round((world[0] - drag.start[0]) / g) * g);
        const dz = round(Math.round((world[1] - drag.start[1]) / g) * g);
        const ids = new Set(drag.ids);
        const baseFloor = drag.areas && drag.base.floors.find((f) => f.id === this._floorId);
        this.changeFloor((floor) => {
          for (const m of floor.furniture) if (ids.has(m.id)) Object.assign(m, { x: round(m.x + dx), z: round(m.z + dz) });
          if (baseFloor) moveAreas(floor, baseFloor, drag.areas!, dx, dz);
        }, drag.base);
        break;
      }
      case "marquee":
        drag.end = world;
        this.requestUpdate();
        break;
      case "outdoor": {
        if (!drag.moved && Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) < 5) return;
        drag.moved = true;
        const area = drag.base.floors.find((f) => f.id === this._floorId)?.outdoor.find((o) => o.id === drag.id);
        if (!area) return;
        const g = e.altKey ? 0.01 : this._doc.settings.grid;
        const dx = Math.round((world[0] - drag.start[0]) / g) * g;
        const dz = Math.round((world[1] - drag.start[1]) / g) * g;
        this.change(
          (_, floor) => {
            const o = floor.outdoor.find((x) => x.id === drag.id)!;
            o.points = area.points.map(([x, z]) => [round(x + dx), round(z + dz)]);
            // a pool's ports move with it (pipes keep their own way)
            if (o.pool?.ports && area.pool?.ports) o.pool.ports = area.pool.ports.map((q) => ({ ...q, x: round(q.x + dx), z: round(q.z + dz) }));
          },
          drag.base,
          false,
        );
        break;
      }
      case "resize": {
        drag.moved = true;
        const f = drag.base.floors.find((x) => x.id === this._floorId)?.furniture.find((x) => x.id === drag.id);
        if (!f) return;
        const size = resizeFurniture(f, drag.corner, world, e.altKey ? 0.01 : this._doc.settings.grid);
        this.changeFloor((floor) => patchItem(floor.furniture.find((q) => q.id === drag.id), size), drag.base);
        break;
      }
      case "rotate": {
        drag.moved = true;
        const f = drag.base.floors.find((x) => x.id === this._floorId)?.furniture.find((x) => x.id === drag.id);
        if (!f) return;
        // the handle sits in front of the item: turn the front towards the pointer
        let a = (Math.atan2(-(world[0] - f.x), world[1] - f.z) * 180) / Math.PI;
        const step = e.altKey ? 1 : 15;
        a = ((Math.round(a / step) * step) % 360 + 360) % 360;
        this.changeFloor((floor) => patchItem(floor.furniture.find((q) => q.id === drag.id), { rotation: a }), drag.base);
        break;
      }
      case "device": {
        if (!drag.moved && Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) < 5) return;
        drag.moved = true;
        const pl = drag.base.floors.find((f) => f.id === this._floorId)?.placements.find((x) => x.entity_id === drag.entityId);
        if (!pl) return;
        const g = e.altKey ? 0.01 : this._doc.settings.grid;
        const x = round(Math.round((pl.x + world[0] - drag.start[0]) / g) * g);
        const z = round(Math.round((pl.z + world[1] - drag.start[1]) / g) * g);
        this.changeFloor((floor) => patchItem(floor.placements.find((q) => q.entity_id === drag.entityId), { x, z }), drag.base);
        break;
      }
      case "pet": {
        if (!drag.moved && Math.hypot(local[0] - drag.startScreen[0], local[1] - drag.startScreen[1]) < 5) return;
        drag.moved = true;
        const pet = drag.base.settings.pets?.list.find((p) => p.id === drag.id);
        const at = pet && drag.ref ? placeOfRef(pet, drag.ref) : undefined;
        if (at?.x == null || at.z == null) return;
        const [px, pz] = [at.x, at.z];
        this.change((doc) => movePet(doc, drag.id, px + world[0] - drag.start[0], pz + world[1] - drag.start[1], e.altKey ? 0.01 : this._doc.settings.grid, drag.ref), drag.base, false);
        break;
      }
    }
  }

  onPointerUp(this: Fp3dEditor, e: PointerEvent): void {
    const right = this.rightPress;
    this.rightPress = null;
    if (right && e.button === 2) {
      // the browser's contextmenu event (before or after this) stays quiet; a click without moving opens the menu
      this.rightUp = performance.now();
      if (!right.moved && e.type !== "pointercancel" && (this._tool === "select" || this._tool === "furniture" || pointOf(right.target, this._roomId))) this.openContext(right.target, right.at);
    }
    clearTimeout(this.pressTimer);
    this.pressStart = null;
    this.fixedPan = false;
    this.pointers.delete(e.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      return;
    }
    const drag = this.drag;
    this.drag = null;
    this.panCursor(false);
    if (drag?.kind === "opening" || drag?.kind === "furniture") this._guides = {};
    if (!drag || e.type === "pointercancel") {
      if (drag && EDIT_DRAGS.has(drag.kind) && "moved" in drag && drag.moved && "base" in drag) this.restoreLive(drag.base);
      return;
    }
    const local = this.localPoint(e);
    switch (drag.kind) {
      case "freewall": {
        if (Math.hypot(drag.end[0] - drag.start[0], drag.end[1] - drag.start[1]) >= 0.2) this.addFreeWall(drag.start, drag.end);
        this._guides = {};
        break;
      }
      case "wallmove":
        if (drag.moved) this.pushHistory(drag.base);
        this._guides = {};
        break;
      case "rect": {
        const [x0, z0] = drag.start;
        const [x1, z1] = drag.end;
        if (Math.abs(x1 - x0) >= 0.2 && Math.abs(z1 - z0) >= 0.2) {
          const lo: Vec2 = [Math.min(x0, x1), Math.min(z0, z1)];
          const hi: Vec2 = [Math.max(x0, x1), Math.max(z0, z1)];
          const pts: Vec2[] = [lo, [hi[0], lo[1]], hi, [lo[0], hi[1]]];
          if (drag.outdoor) this.addOutdoor(pts);
          else if (drag.hole) this.addHole(lo, hi);
          else if (drag.roof) this.addRoofSection(lo, hi);
          else this.addRoom(pts);
        }
        this._guides = {};
        break;
      }
      case "tap":
        if (drag.panning) break;
        if (drag.ghost) {
          void this.offerOutdoorFloor(drag.ghost.floor, drag.ghost.id);
          break;
        }
        // by measure, the first tap sets the start; the next ones add a point, a typed length setting how far along the pull (#294)
        if (this._tool === "measure" && !this._draft.length) this._draft = [this.snap(this.toWorld(...local), undefined, e.altKey)];
        else if (this._tool === "measure") {
          const to = this.pulledPoint(this.snap(this.toWorld(...local), undefined, e.altKey)) as Vec2;
          const typed = this._measureLen > 0;
          this.addDraftPoint(to, local);
          if (typed) this._measureLen = 0; // the next wall starts empty
        } else this.addDraftPoint(this.snap(this.toWorld(...local), undefined, e.altKey), local);
        break;
      case "marquee": {
        // everything whose centre lies in the frame joins the selection
        const [x0, x1] = [Math.min(drag.start[0], drag.end[0]), Math.max(drag.start[0], drag.end[0])];
        const [z0, z1] = [Math.min(drag.start[1], drag.end[1]), Math.max(drag.start[1], drag.end[1])];
        const hit = (this.floor?.furniture ?? []).filter((m) => m.x >= x0 && m.x <= x1 && m.z >= z0 && m.z <= z1).map((m) => m.id);
        // outdoor areas wholly inside the frame join too (#400)
        const areas = this.floor ? areasInFrame(this.floor, drag.start, drag.end) : [];
        if (hit.length || areas.length) this.selectMixed([...new Set([...(this._furnitureId ? this.selection() : []), ...this.withGroups(hit)])], [...new Set([...this.areaSelection(), ...areas])]);
        break;
      }
      case "opening":
      case "furniture":
      case "furnset":
      case "rotate":
      case "resize":
      case "outdoor":
      case "solarmove":
      case "solarturn":
      case "roofmove":
      case "roofcorner":
      case "roofvertex":
      case "cablept":
      case "outvertex":
      case "outbox":
      case "pipept":
      case "poolport":
      case "pooljoint":
        if (drag.moved) this.pushHistory(drag.base);
        // Alt+click without moving: the next item in the stack (#75, #125)
        else if ((drag.kind === "furniture" || drag.kind === "furnset") && drag.pick) this.selectItem("furniture", drag.pick);
        // a tap on a port or a joint opens its card
        else if (drag.kind === "poolport" || drag.kind === "pooljoint") this.openCard(drag.pool, `${drag.kind === "poolport" ? "port" : "joint"}:${drag.id}`);
        break;
      case "holopt":
      case "bgmove":
      case "bgscale":
      case "bgrotate":
        if (drag.moved) this.pushHistory(drag.base);
        break;
      case "pooldev": {
        if (drag.moved) this.pushHistory(drag.base);
        // a tap on a ball valve opens or closes it, on any other device its card
        else if (this._doc.floors.flatMap((f) => f.furniture).find((m) => m.id === drag.id)?.type === "pool_valve") this.togglePoolValve(drag.id);
        else if (this.poolArea) this.openCard(this.poolArea.id, `dev:${drag.id}`);
        break;
      }
      case "pet":
        if (drag.moved) this.pushHistory(drag.base);
        else this.selectPet(drag.id);
        break;
      case "device":
        if (drag.moved) this.pushHistory(drag.base);
        // a tap on a device selects it (and the room it stands in)
        else this.selectItem("device", drag.entityId);
        break;
      case "vertex":
      case "room":
        // the drag already changed the document without history; record the state before the drag
        if (drag.moved) this.pushHistory(drag.base);
        if (drag.moved && drag.kind === "vertex") this.noteResize(drag.roomId, drag.base);
        this._guides = {};
        break;
      default:
        break;
    }
  }

  onWheel(this: Fp3dEditor, e: WheelEvent): void {
    e.preventDefault();
    const [sx, sy] = this.localPoint(e);
    this.zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), sx, sy);
  }

  pinchState(this: Fp3dEditor): { dist: number; mid: [number, number] } | null {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  }

  /** Movement of a whole room: grid steps, pulled onto nearby corners of other rooms. */
  roomDelta(this: Fp3dEditor, room: Room, raw: Vec2, free: boolean): Vec2 {
    if (free) return raw;
    const g = this._doc.settings.grid;
    let delta: Vec2 = [Math.round(raw[0] / g) * g, Math.round(raw[1] / g) * g];
    const thr = SNAP_PX / this._view.scale;
    let best = thr;
    this._guides = {};
    for (const other of this.floor?.rooms ?? []) {
      if (other.id === room.id) continue;
      for (const q of other.points) {
        for (const p of room.points) {
          const d = Math.hypot(p[0] + raw[0] - q[0], p[1] + raw[1] - q[1]);
          if (d < best) {
            best = d;
            delta = [q[0] - p[0], q[1] - p[1]];
            this._guides = { point: q };
          }
        }
      }
    }
    return delta;
  }

  roomAt(this: Fp3dEditor, p: Vec2): string | null {
    const rooms = this.floor?.rooms ?? [];
    // smallest room first so nested rooms stay reachable
    const hits = rooms.filter((r) => pointInPolygon(p, r.points)).sort((a, b) => polygonArea(a.points) - polygonArea(b.points));
    return hits[0]?.id ?? null;
  }

  /** The outdoor area under a point: the smallest one, so a pool in a lawn or a bed on a terrace stays reachable. */
  outdoorAt(this: Fp3dEditor, p: Vec2): string | null {
    const areas = this.floor?.outdoor ?? [];
    const hits = areas.filter((a) => a.points.length >= 3 && pointInPolygon(p, a.points)).sort((a, b) => polygonArea(a.points) - polygonArea(b.points));
    return hits[0]?.id ?? null;
  }

  /** The plan shows the closed-hand cursor while it is being panned (#233); set on the svg directly, so no render. */
  panCursor(this: Fp3dEditor, on: boolean): void {
    this.renderRoot?.querySelector?.("svg.fp3d-plan")?.classList?.toggle("fp3d-panning", on);
  }

  onContextMenu(this: Fp3dEditor, e: MouseEvent): void {
    e.preventDefault();
    // a mouse's right button is handled on its release (drag = move the plan); this is a long press on a tablet
    if (this.rightPress || performance.now() - this.rightUp < 600) return;
    if (this._tool !== "select" && this._tool !== "furniture" && !pointOf(e.target as Element, this._roomId)) return;
    this.drag = null;
    this.openContext(e.target as Element, this.localPoint(e as PointerEvent));
  }

  /**
   * A press on an outdoor area's or a roof outline's point or "+" (#395): the point is chosen and dragged; a "+" adds a
   * point there first (one undo step with the drag that follows). False for anything else.
   */
  pressPoint(this: Fp3dEditor, target: Element): boolean {
    const mid = target.closest("[data-out-mid], [data-roof-mid]");
    if (mid) {
      const out = mid.getAttribute("data-out-mid");
      const v = out ?? mid.getAttribute("data-roof-mid")!;
      const at = v.lastIndexOf(":");
      const base = this._doc;
      const p = addPoint(this, { kind: out ? "out" : "roof", id: v.slice(0, at), edge: Number(v.slice(at + 1)) });
      if (!p) return false;
      this.drag = p.kind === "out" ? { kind: "outvertex", id: p.id, index: p.index, base, from: this._doc, moved: true } : { kind: "roofvertex", id: p.id, index: p.index, base, from: this._doc, moved: true };
      return true;
    }
    const p = pointOf(target, null);
    if (!p) return false;
    this._point = p;
    this.drag = p.kind === "out" ? { kind: "outvertex", id: p.id, index: p.index, base: this._doc, moved: false } : { kind: "roofvertex", id: p.id, index: p.index, base: this._doc, moved: false };
    return true;
  }

  /** Whether this press is the second of a double click on the same point (within 450 ms). */
  doubleTap(this: Fp3dEditor, e: PointerEvent, key: string): boolean {
    const now = performance.now();
    const twice = e.detail >= 2 || (this.lastTap?.key === key && now - this.lastTap.at < 450);
    this.lastTap = twice ? null : { key, at: now };
    return twice;
  }
}
