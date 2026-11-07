// The wall view: picking a wall, the full-screen view of one wall, moving, lifting, resizing and turning pieces
// on it, its 3D, pictures, grouping and deleting.

import { html, nothing, svg } from "lit";
import { ref } from "lit/directives/ref.js";
import { modalFocus } from "../../dialog-focus.ts";
import { clampIntoRoom, sharedEdge } from "../../geometry/snap.ts";
import { poolNodeAt, runsOnWall } from "../../pool-runs.ts";
import { fromWall, furnitureOnWall, openingsOnWall, roomEdgeFrame, slideAlong, toWall, type WallFrame } from "../../geometry/wall-frame.ts";
import { furnitureFootprint, POOL_DEVICES } from "../../model.ts";
import { canLift, LAMP_MODEL, pointInPolygon, uid, type Building, type Floor, type Furniture, type Room, type Vec2 } from "../../model.ts";
import { load3d } from "../../load3d.ts";
import { ensureRecipes } from "../../pack-recipes.ts";
import { furnitureName } from "../../furniture-names.ts";
import { mountBase } from "../../packs.ts";
import { MAX_MOUNT_Y, round, RUN_GAP, type RunCtx } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** WallViewPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class WallViewPart {
  // ------------------------------------------------------------------ the wall view

  /** Opens a room's wall seen from the front; `select` chooses a piece on it. */
  openWallView(this: Fp3dEditor, roomId: string, edge: number, select: string | null = null): void {
    this._wallView = { roomId, edge };
    this._wallSel = select;
    this._wallMulti = [];
    this._wallSingle = false;
    this._wallGap = null;
    this._wallFrame = null;
    this.wallDrag = null;
  }

  /** The pieces the wall view moves together: the multi choice, else the chosen piece's block (unless one part alone), else the piece. */
  wallSelection(this: Fp3dEditor): string[] {
    if (this._wallMulti.length) return this._wallMulti;
    const f = this._wallSel ? this.floor?.furniture.find((m) => m.id === this._wallSel) : undefined;
    if (!f) return [];
    if (f.group && !this._wallSingle) return (this.floor?.furniture ?? []).filter((m) => m.group === f.group).map((m) => m.id);
    return [f.id];
  }

  /** Wall view: a piece (with its block) joins the choice or leaves it. */
  wallToggle(this: Fp3dEditor, id: string): void {
    const cur = this.wallSelection();
    const part = this.withGroups([id]);
    const next = cur.includes(id) ? cur.filter((x) => !part.includes(x)) : [...new Set([...cur, ...part])];
    this.wallChoose(next, id);
  }

  /** Wall view: choose these pieces (one, one block, or several). */
  wallChoose(this: Fp3dEditor, ids: string[], lead: string | null = ids[0] ?? null): void {
    this._wallSingle = false;
    this._wallSel = ids.length ? (lead && ids.includes(lead) ? lead : ids[0]) : null;
    this._wallMulti = [];
    const block = this.wallSelection();
    if (ids.length > 1 && !(ids.length === block.length && ids.every((x) => block.includes(x)))) this._wallMulti = ids;
    this._wallGap = null;
  }

  /** Several pieces in the wall view moved together: along the wall by ds and up or down by dy. */
  moveSetOnWall(this: Fp3dEditor, frame: WallFrame, ids: string[], ds: number, dy: number | null, base: Building = this._doc, history = true): void {
    const set = new Set(ids);
    this.change(
      (_, floor) => {
        for (const m of floor.furniture) {
          if (!set.has(m.id)) continue;
          Object.assign(m, slideAlong(frame, m, ds));
          if (dy !== null && canLift(m)) m.mount_y = Math.round(Math.min(MAX_MOUNT_Y, Math.max(0, mountBase(floor, m) + dy)) * 1000) / 1000;
        }
      },
      base,
      history,
    );
  }

  /** The free stretch of wall around s (metres along the wall) at height y: between the nearest pieces and openings left and right. */
  wallGapAt(this: Fp3dEditor, frame: WallFrame, floor: Floor, room: Room, s: number, y: number): { s0: number; s1: number; low: boolean } | null {
    const low = y < 1.2;
    const L = frame.length;
    const busy = [
      ...furnitureOnWall(frame, floor, room)
        .filter((i) => (low ? i.y0 < 1.0 : i.y1 > 1.2))
        .map((i) => [i.s0, i.s1]),
      ...openingsOnWall(frame, floor)
        .filter((o) => (low ? o.y0 < 0.9 : o.y1 > 1.2))
        .map((o) => [o.s0, o.s1]),
    ];
    if (busy.some(([a, b]) => s > a && s < b)) return null;
    const s0 = Math.max(0, ...busy.filter(([, b]) => b <= s).map(([, b]) => b));
    const s1 = Math.min(L, ...busy.filter(([a]) => a >= s).map(([a]) => a));
    return s1 - s0 >= 0.1 ? { s0: Math.round(s0 * 1000) / 1000, s1: Math.round(s1 * 1000) / 1000, low } : null;
  }

  /** The wall a piece of furniture stands or hangs at: the nearest edge of the room it is in. */
  openWallViewFor(this: Fp3dEditor, f: Furniture): void {
    const floor = this.floor;
    if (!floor) return;
    const room = floor.rooms.find((r) => r.points.length >= 3 && pointInPolygon([f.x, f.z], r.points));
    if (!room) return;
    let best = -1;
    let dist = Infinity;
    room.points.forEach((a, i) => {
      const b = room.points[(i + 1) % room.points.length];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const t = Math.max(0, Math.min(1, ((f.x - a[0]) * (b[0] - a[0]) + (f.z - a[1]) * (b[1] - a[1])) / (l * l)));
      const d = Math.hypot(f.x - (a[0] + (b[0] - a[0]) * t), f.z - (a[1] + (b[1] - a[1]) * t));
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    if (best >= 0) this.openWallView(room.id, best, f.id);
  }

  /** The room's walls from the front, starting with the wall that has the most furniture at it. */
  openRoomWalls(this: Fp3dEditor, room: Room): void {
    const floor = this.floor;
    if (!floor) return;
    let best = 0;
    let most = -1;
    room.points.forEach((_, i) => {
      const count = furnitureOnWall(roomEdgeFrame(room, i), floor, room).length;
      if (count > most) {
        most = count;
        best = i;
      }
    });
    this.openWallView(room.id, best);
  }

  setWallView3d(this: Fp3dEditor, on: boolean): void {
    this._wallView3d = on;
    this.wall3dKey = "";
    try {
      localStorage.setItem("home3d.wall3d", on ? "1" : "0");
    } catch {
      // not remembered
    }
  }

  /**
   * The wall view in 3D: the camera stands in the room at about eye height and looks at the wall (a flight
   * when the wall changes). Every wall stands whole and solid; the mouse wheel walks closer or back.
   */
  setupWall3d(this: Fp3dEditor, el: HTMLElement, room: Room, edge: number): void {
    const key = `${room.id}|${edge}`;
    if (this.wall3dKey === key && this.wall3dEl === el) return;
    const first = this.wall3dEl !== el;
    this.wall3dKey = key;
    this.wall3dEl = el;
    // laying a pipe: the left button belongs to the pipe (caught before the viewer sees it)
    if (first) el.addEventListener("pointerdown", (e) => this.runDown3d(e as PointerEvent), { capture: true });
    type V = {
      getView(): { target: { set(x: number, y: number, z: number): unknown } };
      flyTo(v: unknown, ms?: number): void;
      floorMap: Map<string, { y: number }>;
      floors: { mask: { standing: { value: number }; glass: { value: number } } }[];
      controls: { minRadius: number; maxRadius: number; leftDragTurns: boolean };
      camera: { fov: number; updateProjectionMatrix(): void };
      labels: HTMLElement;
      updateWalls(): void;
      invalidate(): void;
      __npWall?: boolean;
    };
    void (async () => {
      let v: V | undefined;
      for (let i = 0; i < 120 && !(v = (el as unknown as { viewer?: V }).viewer); i++) await new Promise((r) => setTimeout(r, 50));
      // the first build of the view fits the camera to the floor: our view comes after it
      if (first) await new Promise((r) => setTimeout(r, 250));
      const floor = this.floor;
      if (!v || !floor || this.wall3dKey !== key) return;
      if (!v.__npWall) {
        v.__npWall = true;
        // the walls stand whole and none turns to glass (the wall in front of the camera would)
        v.updateWalls = function (this: V) {
          for (const fv of this.floors) {
            fv.mask.standing.value = 0xffff;
            fv.mask.glass.value = 0;
          }
        };
        v.labels.style.display = "none";
        // no search in this small view
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(".fp3d-find-btn, .fp3d-find { display: none !important; }");
        if (el.shadowRoot) el.shadowRoot.adoptedStyleSheets = [...el.shadowRoot.adoptedStyleSheets, sheet];
        v.camera.fov = 58;
        v.camera.updateProjectionMatrix();
        v.controls.minRadius = 0.6;
        // the left mouse button is for the furniture here; the middle or right button looks around
        v.controls.leftDragTurns = false;
      }
      const frame = roomEdgeFrame(room, edge);
      const depth = Math.max(1.5, ...room.points.map((q) => toWall(frame, q).d));
      const mid = fromWall(frame, frame.length / 2, 0);
      const y = floor.elevation + (v.floorMap.get(floor.id)?.y ?? 0) + 1.15;
      v.controls.maxRadius = Math.max(1.4, depth - 0.25);
      const view = v.getView();
      view.target.set(mid[0], y, mid[1]);
      v.flyTo({ ...view, radius: Math.max(1.2, Math.min(depth * 0.8, depth - 0.35)), theta: Math.atan2(frame.n[0], frame.n[1]), phi: 1.3 }, first ? 0 : 650);
      v.invalidate();
      this.runLiftHandle();
    })();
  }

  /** Keeps the height handle of the 3D wall view over the chosen piece while the view is open. */
  runLiftHandle(this: Fp3dEditor): void {
    cancelAnimationFrame(this.liftRaf);
    const step = () => {
      this.liftRaf = 0;
      const el = this.wall3dEl;
      const handle = this.renderRoot.querySelector<HTMLElement>(".fp3d-wv-lift");
      if (!el?.isConnected || !this._wallView || !this._wallView3d) return;
      this.liftRaf = requestAnimationFrame(step);
      if (!handle) return;
      const floor = this.floor;
      const f = this._wallSel ? floor?.furniture.find((m) => m.id === this._wallSel) : undefined;
      const v = (el as unknown as { viewer?: { camera: { position: { clone(): { set(x: number, y: number, z: number): { project(c: unknown): { x: number; y: number; z: number } } } } }; floorMap: Map<string, { y: number }> } }).viewer;
      if (!f || !floor || !v || !canLift(f) || f.locked) {
        handle.hidden = true;
        return;
      }
      const base = mountBase(floor, f);
      const top = floor.elevation + (v.floorMap.get(floor.id)?.y ?? 0) + base + f.h;
      const q = v.camera.position.clone().set(f.x, top + 0.12, f.z).project(v.camera);
      if (q.z > 1) {
        handle.hidden = true;
        return;
      }
      handle.hidden = false;
      const r = el.getBoundingClientRect();
      const stage = handle.offsetParent?.getBoundingClientRect() ?? r;
      handle.style.transform = `translate(${r.left - stage.left + ((q.x + 1) / 2) * r.width}px, ${r.top - stage.top + ((1 - q.y) / 2) * r.height}px)`;
      const label = handle.querySelector("b");
      if (label) label.textContent = this.m(Math.round(base * 100) / 100, 2);
    };
    this.liftRaf = requestAnimationFrame(step);
  }

  /** Dragging the height handle: up and down lifts the chosen piece (its distance from the camera sets the scale). */
  liftDown(this: Fp3dEditor, e: PointerEvent): void {
    const floor = this.floor;
    const f = this._wallSel ? floor?.furniture.find((m) => m.id === this._wallSel) : undefined;
    const el = this.wall3dEl as unknown as { viewer?: { camera: { position: { x: number; y: number; z: number }; fov: number } } } | null;
    const v = el?.viewer;
    if (!floor || !f || !v || !this.isEditor) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const dist = Math.hypot(v.camera.position.x - f.x, v.camera.position.z - f.z) || 1;
    const h = (this.wall3dEl as HTMLElement).clientHeight || 1;
    const room = floor.rooms.find((r) => r.points.length >= 3 && pointInPolygon([f.x, f.z], r.points));
    const ceiling = Math.max(floor.height, room?.ceiling_height ?? 0);
    this.lift = { id: f.id, y: mountBase(floor, f), startY: e.clientY, perPx: (2 * dist * Math.tan((v.camera.fov * Math.PI) / 360)) / h, base: this._doc, top: Math.max(0, ceiling - f.h), moved: false };
  }

  liftMove(this: Fp3dEditor, e: PointerEvent): void {
    const l = this.lift;
    const room = this._wallView ? this.floor?.rooms.find((r) => r.id === this._wallView!.roomId) : undefined;
    if (!l || !room) return;
    const dy = (l.startY - e.clientY) * l.perPx;
    if (!l.moved && Math.abs(e.clientY - l.startY) < 3) return;
    l.moved = true;
    const y = Math.min(l.top, Math.max(0, Math.round((l.y + dy) * 100) / 100));
    this.moveOnWall(roomEdgeFrame(room, this._wallView!.edge), l.id, 0, y, l.base, false);
  }

  liftUp(this: Fp3dEditor): void {
    const l = this.lift;
    this.lift = null;
    if (l?.moved) this.pushHistory(l.base);
  }

  /** The toolbar's wall view button: on, with a bubble right under it saying what to tap. */
  toggleWallPick(this: Fp3dEditor, btn: HTMLElement): void {
    const bar = btn.closest(".fp3d-toolbar")?.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    this.wallPickTip = bar ? [r.left - bar.left + r.width / 2, r.bottom - bar.top + 8] : [0, 0];
    this._wallPick = !this._wallPick;
  }

  /** The wall view of the wall nearest a tapped point (within 60 cm), the room under the point first. */
  pickWall(this: Fp3dEditor, p: Vec2): void {
    const floor = this.floor;
    if (!floor) return;
    let best: { room: Room; edge: number; d: number } | null = null;
    for (const room of floor.rooms) {
      if (room.points.length < 3) continue;
      // a shared wall belongs to both rooms: the one tapped into wins
      const bonus = pointInPolygon(p, room.points) ? -0.25 : 0;
      room.points.forEach((a, i) => {
        const b = room.points[(i + 1) % room.points.length];
        const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2));
        const d = Math.hypot(p[0] - (a[0] + (b[0] - a[0]) * t), p[1] - (a[1] + (b[1] - a[1]) * t));
        if (d < 0.6 && (!best || d + bonus < best.d)) best = { room, edge: i, d: d + bonus };
      });
    }
    if (!best) {
      // a tap inside a room, away from its walls: the room's wall with the most furniture
      const room = floor.rooms.find((r) => r.points.length >= 3 && pointInPolygon(p, r.points));
      if (!room) return;
      this._wallPick = false;
      this.openRoomWalls(room);
      if (this.techPick) this.enterTech();
      return;
    }
    this._wallPick = false;
    this.openWallView((best as { room: Room }).room.id, (best as { edge: number }).edge);
    if (this.techPick) this.enterTech();
  }

  /** Turns a piece in the wall view; turned against a wall it is pushed back into the room. */
  turnOnWall(this: Fp3dEditor, id: string, rotation: number): void {
    const wall = this._doc.settings.wall_interior;
    this.change((_, floor) => {
      const m = floor.furniture.find((x) => x.id === id);
      if (!m) return;
      m.rotation = Math.round(((rotation % 360) + 360) % 360);
      const [x, z] = clampIntoRoom(floor, m, m.x, m.z, wall, 0.6);
      Object.assign(m, { x, z });
    });
  }

  /** A piece moved towards or away from the wall (its plan position along the wall's normal). */
  moveFromWall(this: Fp3dEditor, frame: WallFrame, id: string, dd: number): void {
    this.change((_, floor) => {
      const m = floor.furniture.find((x) => x.id === id);
      if (!m) return;
      m.x = Math.round((m.x + frame.n[0] * dd) * 1000) / 1000;
      m.z = Math.round((m.z + frame.n[1] * dd) * 1000) / 1000;
    });
  }

  /** A piece in the wall view moved: along the wall by ds (plan position) and, when it can be lifted, to bottom y0. */
  moveOnWall(this: Fp3dEditor, frame: WallFrame, id: string, ds: number, y0: number | null, base: Building = this._doc, history = true): void {
    this.change(
      (_, floor) => {
        const m = floor.furniture.find((x) => x.id === id);
        if (!m) return;
        Object.assign(m, slideAlong(frame, m, ds));
        if (y0 !== null) m.mount_y = Math.round(Math.min(MAX_MOUNT_Y, Math.max(0, y0)) * 1000) / 1000;
      },
      base,
      history,
    );
  }

  /** Which of a piece's own sizes runs along the wall (w facing it, d standing sideways), null when it stands at a slant. */
  alongAxis(this: Fp3dEditor, frame: WallFrame, f: Furniture): "w" | "d" | null {
    const a = (this.wallTurn(frame, f) * Math.PI) / 180;
    if (Math.abs(Math.sin(a)) < 0.05) return "w";
    if (Math.abs(Math.cos(a)) < 0.05) return "d";
    return null;
  }

  /**
   * A piece's size in the wall view: its stretch along the wall (s0..s1, metres along the wall) and its bottom and
   * top (metres above the floor); null keeps that side. The other sides stay where they are.
   */
  resizeOnWall(this: Fp3dEditor, frame: WallFrame, id: string, s0: number | null, s1: number | null, y0: number | null, y1: number | null, base: Building = this._doc, history = true): void {
    this.change(
      (_, floor) => {
        const m = floor.furniture.find((x) => x.id === id);
        if (!m) return;
        const axis = this.alongAxis(frame, m);
        if (s0 !== null && s1 !== null && axis && s1 - s0 >= 0.05) {
          const c = furnitureFootprint(m).map((q) => toWall(frame, q).s);
          const mid = (Math.min(...c) + Math.max(...c)) / 2;
          m[axis] = round(s1 - s0);
          Object.assign(m, slideAlong(frame, m, (s0 + s1) / 2 - mid));
        }
        if (y0 !== null || y1 !== null) {
          const bottom = mountBase(floor, m);
          const nb = y0 ?? bottom;
          const nt = y1 ?? bottom + m.h;
          if (nt - nb < 0.03) return;
          m.h = round(nt - nb);
          if (y0 !== null && canLift(m)) m.mount_y = round(Math.max(0, nb));
        }
      },
      base,
      history,
    );
  }

  /** The turn of a piece relative to the viewer of a wall (0: its front faces into the room, towards the viewer). */
  wallTurn(this: Fp3dEditor, frame: WallFrame, f: Furniture): number {
    const wallRot = (Math.atan2(-frame.n[0], frame.n[1]) * 180) / Math.PI;
    return (((f.rotation - wallRot) % 360) + 360) % 360;
  }

  wallPicKey(this: Fp3dEditor, frame: WallFrame, f: Furniture): string {
    return `${f.type}|${f.w}|${f.d}|${f.h}|${f.variant ?? ""}|${Math.round(this.wallTurn(frame, f))}`;
  }

  /** Draws the missing front pictures with the 3D bundle (once per type, size and turn). */
  async askWallPics(this: Fp3dEditor, frame: WallFrame, pieces: Furniture[]): Promise<void> {
    const missing = pieces.filter((f) => !this.wallPicsAsked.has(this.wallPicKey(frame, f)));
    if (!missing.length) return;
    for (const f of missing) this.wallPicsAsked.add(this.wallPicKey(frame, f));
    try {
      const [mod] = await Promise.all([load3d(), this.hass ? ensureRecipes(this.hass, missing.map((f) => f.type)) : undefined]);
      for (const f of missing) {
        const pic = mod.furnitureFront({ type: f.type, w: f.w, d: f.d, h: f.h, variant: f.variant, lamp: LAMP_MODEL[f.type] ?? null }, this.wallTurn(frame, f), 180, this.packs ?? [], 3.2);
        this.wallPics.set(this.wallPicKey(frame, f), pic);
      }
    } catch {
      // no 3D (no WebGL): the pieces stay boxes
    }
    this._wallPicTick++;
  }

  renderWallView(this: Fp3dEditor) {
    const v = this._wallView;
    const floor = this.floor;
    const room = v ? floor?.rooms.find((r) => r.id === v.roomId) : undefined;
    if (!v || !floor || !room || v.edge >= room.points.length) return nothing;
    const n = room.points.length;
    const frame = roomEdgeFrame(room, v.edge);
    const L = frame.length;
    const H = Math.max(floor.height, room.ceiling_height ?? 0);
    // drawing the technical room: the other furniture stays out of the way (kitchen, cabinets …)
    const items = this._techMode
      ? furnitureOnWall(frame, floor, room, 1.6).filter((i) => (POOL_DEVICES as readonly string[]).includes(floor.furniture.find((f) => f.id === i.id)?.type ?? ""))
      : furnitureOnWall(frame, floor, room);
    const holes = openingsOnWall(frame, floor);
    // drawing in metres: x from the left as seen from inside the room, y down from the ceiling
    const X = (s: number) => (frame.rightward ? s : L - s);
    const span = (s0: number, s1: number) => [Math.min(X(s0), X(s1)), Math.abs(s1 - s0)] as const;
    const Y = (y: number) => H - y;
    const admin = this.isEditor;
    // the chosen piece: one at the wall, or (3D) any piece of the room – its span along the wall and distance from it
    const selF = this._wallSel ? floor.furniture.find((m) => m.id === this._wallSel) : undefined;
    const sel = selF
      ? (items.find((i) => i.id === selF.id) ??
        (() => {
          const c = furnitureFootprint(selF).map((q) => toWall(frame, q));
          const y0 = mountBase(floor, selF);
          return { kind: "furniture" as const, id: selF.id, s0: Math.min(...c.map((q) => q.s)), s1: Math.max(...c.map((q) => q.s)), y0, y1: y0 + selF.h, d: Math.min(...c.map((q) => q.d)) };
        })())
      : null;
    const lift = !!selF && canLift(selF);
    // several pieces (a block, a multi choice): moved together, framed in orange
    const wset = this.wallSelection();
    const many = wset.length > 1;
    const setItems = items.filter((i) => wset.includes(i.id));
    const setSpan = setItems.length ? { s0: Math.min(...setItems.map((i) => i.s0)), s1: Math.max(...setItems.map((i) => i.s1)), y0: Math.min(...setItems.map((i) => i.y0)), y1: Math.max(...setItems.map((i) => i.y1)) } : null;
    const text = (t: number) => this.m(t, 2);
    const svgPoint = (e: PointerEvent) => {
      const el = (e.currentTarget as Element).closest("svg") as SVGSVGElement;
      const pt = el.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      return pt.matrixTransform(el.getScreenCTM()!.inverse());
    };
    // edges to snap to while dragging: the wall's ends and the sides of the other pieces and openings
    const snaps = (ids: string[]) => [0, L, ...items.filter((i) => !ids.includes(i.id)).flatMap((i) => [i.s0, i.s1]), ...holes.flatMap((o) => [o.s0, o.s1])];
    const down = (e: PointerEvent, id: string) => {
      if (!admin) return;
      if (rc && this._runMode) {
        this.techPress = rc.pt(e);
        this.runDown(e, rc);
        return;
      }
      e.stopPropagation();
      this._runSel = null;
      // shift (or "Select several" on a tablet): the piece joins the choice or leaves it
      if (e.shiftKey || this._multiMode) {
        this.wallToggle(id);
        return;
      }
      if (!this.wallSelection().includes(id) || this._wallSingle) this.wallChoose([id]);
      const ids = this.wallSelection();
      const p = svgPoint(e);
      (e.currentTarget as Element).closest("svg")!.setPointerCapture(e.pointerId);
      const own = items.filter((i) => ids.includes(i.id));
      if (ids.length > 1 && ids.some((x) => this.isFixedItem("furniture", x))) return;
      if (ids.length > 1 && own.length) {
        const s0 = Math.min(...own.map((i) => i.s0));
        this.wallDrag = { id, ids, w: Math.max(...own.map((i) => i.s1)) - s0, x: p.x, y: p.y, base: this._doc, s0, y0: 0, lift: own.every((i) => { const m = floor.furniture.find((x) => x.id === i.id); return !!m && canLift(m); }), moved: false };
        return;
      }
      const it = items.find((i) => i.id === id)!;
      const m = floor.furniture.find((x) => x.id === id);
      this.wallDrag = { id, x: p.x, y: p.y, base: this._doc, s0: it.s0, y0: it.y0, lift: !!m && canLift(m), moved: false };
    };
    // the bare wall: a tap finds the free stretch there (the side bar then offers what fits), shift + drag draws a frame
    const wallDown = (e: PointerEvent) => {
      if (!admin || this._runMode) return;
      const p = svgPoint(e);
      if (e.shiftKey || this._multiMode) {
        (e.currentTarget as Element).closest("svg")!.setPointerCapture(e.pointerId);
        this._wallFrame = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        return;
      }
      this._wallSel = null;
      this._wallMulti = [];
      this._wallSingle = false;
      const sAt = frame.rightward ? p.x : L - p.x;
      this._wallGap = sAt >= 0 && sAt <= L && p.y >= 0 && p.y <= H ? this.wallGapAt(frame, floor, room, sAt, H - p.y) : null;
    };
    const move = (e: PointerEvent) => {
      const rz = this.wallResize;
      if (rz) {
        const p = svgPoint(e);
        rz.moved = true;
        // edges snap to the neighbours, the wall's ends, doors and windows (Alt: freely), by the centimetre
        const edgesX = snaps([rz.id]).map((q) => X(q));
        const snapX = (v: number) => {
          v = Math.round(v * 100) / 100;
          if (!e.altKey) for (const q of edgesX) if (Math.abs(v - q) < 0.04) return q;
          return v;
        };
        if (rz.side === "l" || rz.side === "r") {
          const x0 = rz.side === "l" ? Math.min(snapX(p.x), rz.x1 - 0.1) : rz.x0;
          const x1 = rz.side === "r" ? Math.max(snapX(p.x), rz.x0 + 0.1) : rz.x1;
          const [s0, s1] = frame.rightward ? [x0, x1] : [L - x1, L - x0];
          this.resizeOnWall(frame, rz.id, s0, s1, null, null, rz.base, false);
        } else {
          const y = Math.round((H - p.y) * 100) / 100;
          if (rz.side === "t") this.resizeOnWall(frame, rz.id, null, null, null, Math.max(rz.y0 + 0.05, Math.min(H, y)), rz.base, false);
          else this.resizeOnWall(frame, rz.id, null, null, Math.max(0, Math.min(rz.y1 - 0.05, y)), null, rz.base, false);
        }
        return;
      }
      const fr = this._wallFrame;
      if (fr) {
        const p = svgPoint(e);
        this._wallFrame = { ...fr, x1: p.x, y1: p.y };
        return;
      }
      const d = this.wallDrag;
      if (!d) return;
      const p = svgPoint(e);
      const dxView = p.x - d.x;
      const dy = d.y - p.y;
      if (!d.moved && Math.hypot(dxView, dy) < 0.02) return;
      d.moved = true;
      const it = items.find((i) => i.id === d.id);
      const w = d.ids ? (d.w ?? 0) : it ? it.s1 - it.s0 : 0;
      let s0 = d.s0 + (frame.rightward ? dxView : -dxView);
      s0 = Math.round(s0 * 100) / 100;
      // a side within 4 cm of an edge snaps to it (Alt moves freely); a block snaps with its outer sides
      if (!e.altKey) {
        for (const edge of snaps(d.ids ?? [d.id])) {
          if (Math.abs(s0 - edge) < 0.04) s0 = edge;
          else if (Math.abs(s0 + w - edge) < 0.04) s0 = edge - w;
        }
      }
      if (d.ids) {
        this.moveSetOnWall(frame, d.ids, s0 - d.s0, d.lift ? Math.round(dy * 100) / 100 : null, d.base, false);
        return;
      }
      const y0 = d.lift ? Math.round((d.y0 + dy) * 100) / 100 : null;
      this.moveOnWall(frame, d.id, s0 - d.s0, y0, d.base, false);
    };
    const up = () => {
      const rz = this.wallResize;
      if (rz) {
        this.wallResize = null;
        if (rz.moved) this.pushHistory(rz.base);
        return;
      }
      const fr = this._wallFrame;
      if (fr) {
        // every piece whose middle lies in the frame joins the choice
        this._wallFrame = null;
        const [x0, x1] = [Math.min(fr.x0, fr.x1), Math.max(fr.x0, fr.x1)];
        const [y0, y1] = [Math.min(fr.y0, fr.y1), Math.max(fr.y0, fr.y1)];
        const hit = items
          .filter((i) => {
            const [x, w] = span(i.s0, i.s1);
            const cx = x + w / 2;
            const cy = Y((i.y0 + i.y1) / 2);
            return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
          })
          .map((i) => i.id);
        if (hit.length) this.wallChoose([...new Set([...this.wallSelection(), ...this.withGroups(hit)])]);
        return;
      }
      const d = this.wallDrag;
      this.wallDrag = null;
      if (d?.moved) this.pushHistory(d.base);
    };
    const key = (e: KeyboardEvent) => {
      if (this._runMode && (e.key === "Escape" || e.key === "Enter")) {
        e.preventDefault();
        if (e.key === "Enter") this.finishRun("", null);
        else if (this._runDraft) this._runDraft = null;
        else this._runMode = null;
        return;
      }
      if (e.key === "Escape") {
        this._wallView = null;
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && admin && rc && this._runSel && !wset.length && !(e.target as HTMLElement).closest("input, select, textarea")) {
        e.preventDefault();
        const id = this._runSel.pipe;
        this.changePool(rc.pool.id, (l) => (l.pipes = (l.pipes ?? []).filter((y) => y.id !== id)));
        this._runSel = null;
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && admin && wset.length && !(e.target as HTMLElement).closest("input, select, textarea")) {
        e.preventDefault();
        this.deleteOnWall(wset);
        return;
      }
      if (!sel && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        go(e.key === "ArrowLeft" ? leftEdge : rightEdge);
        return;
      }
      if (!sel || !admin || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      if ((e.target as HTMLElement).closest("input, select, textarea")) return;
      e.preventDefault();
      const step = e.shiftKey ? 0.1 : 0.01;
      const right = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
      const ds = frame.rightward ? right : -right;
      const dy = e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
      if (many) return this.moveSetOnWall(frame, wset, ds, dy || null);
      this.moveOnWall(frame, sel.id, ds, lift && dy ? sel.y0 + dy : null);
    };
    // the chosen piece: its distances to the wall's ends and to the floor
    const dimOf = many && setSpan ? setSpan : sel;
    const dims = dimOf
      ? (() => {
          const sel = dimOf;
          const [x, w] = span(sel.s0, sel.s1);
          const yb = Y(sel.y0);
          const dimY = Math.min(H + 0.25, Y(0) + 0.25);
          return svg`<g class="fp3d-wv-dims">
            ${x > 0.03 ? svg`<line x1="0" y1=${dimY} x2=${x} y2=${dimY} /><text x=${x / 2} y=${dimY - 0.05}>${text(x)}</text>` : nothing}
            ${L - x - w > 0.03 ? svg`<line x1=${x + w} y1=${dimY} x2=${L} y2=${dimY} /><text x=${x + w + (L - x - w) / 2} y=${dimY - 0.05}>${text(L - x - w)}</text>` : nothing}
            ${sel.y0 > 0.03 ? svg`<line x1=${x + w / 2} y1=${yb} x2=${x + w / 2} y2=${H} /><text x=${x + w / 2 + 0.05} y=${(yb + H) / 2} class="fp3d-wv-up">${text(sel.y0)}</text>` : nothing}
          </g>`;
        })()
      : nothing;
    // the walls left and right of this one as seen from inside the room (the room's edges may run either way)
    const rightEdge = (v.edge + (frame.rightward ? 1 : -1) + n) % n;
    const leftEdge = (v.edge + (frame.rightward ? -1 : 1) + n) % n;
    const wallName = (e: number) => this.t("wall_n", { a: e + 1, b: ((e + 1) % n) + 1 });
    const go = (edge: number) => this.openWallView(room.id, edge);
    void this._wallPicTick;
    void this.askWallPics(frame, items.map((i) => floor.furniture.find((m) => m.id === i.id)).filter((m): m is Furniture => !!m));
    // zoom: the part of the wall shown (the whole wall plus a margin at k = 1)
    const zkey = `${room.id}:${v.edge}`;
    const z = this.wvZoom?.key === zkey ? this.wvZoom : null;
    const W0 = L + 1;
    const H0 = H + 0.9;
    const clampZ = (k: number, x0: number, y0: number) => {
      const kk = Math.min(8, Math.max(1, k));
      const w = W0 / kk;
      const h = H0 / kk;
      return { k: kk, w, h, x0: Math.min(-0.5 + W0 - w, Math.max(-0.5, x0)), y0: Math.min(-0.35 + H0 - h, Math.max(-0.35, y0)) };
    };
    const vb = clampZ(z?.k ?? 1, z?.x0 ?? -0.5, z?.y0 ?? -0.35);
    const setZoom = (k: number, x0: number, y0: number) => {
      const c = clampZ(k, x0, y0);
      this.wvZoom = c.k <= 1.001 ? null : { key: zkey, k: c.k, x0: c.x0, y0: c.y0 };
      this.requestUpdate();
    };
    // the point (svg units) under the pointer stays where it is
    const zoomAt = (px: number, py: number, k: number) => {
      const kk = Math.min(8, Math.max(1, k));
      setZoom(kk, px - ((px - vb.x0) * vb.k) / kk, py - ((py - vb.y0) * vb.k) / kk);
    };
    const pinchMove = (el: SVGSVGElement) => {
      const pz = this.wvPinch!;
      const [a, b] = [...this.wvTouch.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const r = el.getBoundingClientRect();
      // screen pixels per svg unit at the start (the view keeps its aspect: the smaller scale fits)
      const W = W0 / pz.k;
      const Hh = H0 / pz.k;
      const scale = Math.min(r.width / W, r.height / Hh);
      const ox = r.left + (r.width - W * scale) / 2;
      const oy = r.top + (r.height - Hh * scale) / 2;
      const sx = pz.x0 + (pz.mx - ox) / scale;
      const sy = pz.y0 + (pz.my - oy) / scale;
      const k = Math.min(8, Math.max(1, (pz.k * d) / Math.max(1, pz.d)));
      const s2 = scale * (k / pz.k);
      const ox2 = r.left + (r.width - (W0 / k) * s2) / 2;
      const oy2 = r.top + (r.height - (H0 / k) * s2) / 2;
      setZoom(k, sx - (mx - ox2) / s2, sy - (my - oy2) / s2);
    };
    // labels, markers and fittings grow slower than the wall when zoomed
    this.wvScale = 1 / Math.sqrt(vb.k);
    const fs = Math.max(0.09, Math.min(0.16, L / 40)) * this.wvScale;
    // Pool module: the pipes on this wall
    const pool = this.canLayRuns ? this.runPool : undefined;
    const rc: RunCtx | null = (this.runCtx3d = pool
      ? {
          frame,
          floor,
          room,
          key: `${room.id}|${v.edge}`,
          L,
          H,
          gap: (sharedEdge(floor, room.id, frame.a, frame.b) ? this._doc.settings.wall_interior / 2 : 0) + RUN_GAP,
          runs: runsOnWall(frame, (pool.pool?.pipes ?? []).filter((q) => q.floor_id === floor.id), poolNodeAt(this._doc, floor, pool)),
          pool,
          pt: (e: PointerEvent) => {
            const q = svgPoint(e);
            return { s: frame.rightward ? q.x : L - q.x, y: H - q.y };
          },
        }
      : null);
    return html`<div class="fp3d-wv-veil" @click=${(e: Event) => e.target === e.currentTarget && (this._wallView = null)}>
      <div class="fp3d-wv" role="dialog" aria-modal="true" aria-label=${this.t("wall_view")} tabindex="0" @keydown=${key} ${modalFocus()}>
        <div class="fp3d-wv-head">
          <button class="fp3d-btn" title=${`${this.t("wall_prev")}: ${wallName(leftEdge)}`} @click=${() => go(leftEdge)}>‹</button>
          <b>${this.t("wall_view")} · ${room.name} · ${this.t("wall_n", { a: v.edge + 1, b: ((v.edge + 1) % n) + 1 })} · ${this.m(L, 2)}</b>
          <button class="fp3d-btn" title=${`${this.t("wall_next")}: ${wallName(rightEdge)}`} @click=${() => go(rightEdge)}>›</button>
          <span class="fp3d-wv-grow"></span>
          ${admin && this.pipeRules && this.runPool
            ? html`<button class="fp3d-btn ${this._techMode ? "fp3d-primary" : ""}" title=${this.t("tech_mode_hint")} @click=${() => {
                if (this._techMode) {
                  this._techMode = false;
                  this._runDraft = null;
                  this._feedKind = null;
                  this._runMode = null;
                } else this.enterTech();
              }}>🛠 ${this.t("tech_mode")}</button>`
            : nothing}
          ${rc && admin && !this._techMode
            ? html`<button class="fp3d-btn ${this._runMode === "draw" ? "fp3d-primary" : ""}" @click=${() => {
                this._wallSel = null;
                this._runSel = null;
                this._runDraft = null;
                this._runMode = this._runMode === "draw" ? null : "draw";
              }}>${this.t("wall_run_add")}</button>`
            : nothing}
          <div class="fp3d-seg" role="group">
            <button aria-pressed=${this._wallView3d} @click=${() => this.setWallView3d(true)}>${this.t("wall_view_3d")}</button>
            <button aria-pressed=${!this._wallView3d} @click=${() => this.setWallView3d(false)}>${this.t("wall_view_front")}</button>
          </div>
          <button class="fp3d-btn" title=${this.t("close")} @click=${() => (this._wallView = null)}>✕</button>
        </div>
        <div class="fp3d-wv-body">
        ${this.renderWallKit(frame, room, rc)}
        <div class="fp3d-wv-stage">
          <button class="fp3d-wv-side fp3d-wv-left" title=${`${this.t("wall_prev")}: ${wallName(leftEdge)}`} @click=${() => go(leftEdge)}>‹<small>${wallName(leftEdge)}</small></button>
          <button class="fp3d-wv-side fp3d-wv-right" title=${`${this.t("wall_next")}: ${wallName(rightEdge)}`} @click=${() => go(rightEdge)}>›<small>${wallName(rightEdge)}</small></button>
          ${this._wallView3d
            ? nothing
            : html`<div class="fp3d-wv-zoom" title=${this.t("wall_zoom_hint")}>
                <button class="fp3d-btn" aria-label="+" @click=${() => zoomAt(vb.x0 + vb.w / 2, vb.y0 + vb.h / 2, vb.k * 1.6)}>＋</button>
                <button class="fp3d-btn" aria-label="−" ?disabled=${vb.k <= 1.001} @click=${() => zoomAt(vb.x0 + vb.w / 2, vb.y0 + vb.h / 2, vb.k / 1.6)}>−</button>
                <button class="fp3d-btn" title=${this.t("wall_zoom_all")} ?disabled=${vb.k <= 1.001} @click=${() => setZoom(1, -0.5, -0.35)}>⤢</button>
                ${vb.k > 1.001
                  ? html`<button class="fp3d-btn" aria-label="←" @click=${() => setZoom(vb.k, vb.x0 - vb.w * 0.3, vb.y0)}>←</button>
                      <button class="fp3d-btn" aria-label="→" @click=${() => setZoom(vb.k, vb.x0 + vb.w * 0.3, vb.y0)}>→</button>
                      <button class="fp3d-btn" aria-label="↑" @click=${() => setZoom(vb.k, vb.x0, vb.y0 - vb.h * 0.3)}>↑</button>
                      <button class="fp3d-btn" aria-label="↓" @click=${() => setZoom(vb.k, vb.x0, vb.y0 + vb.h * 0.3)}>↓</button>`
                  : nothing}
              </div>`}
        ${this._wallView3d
          ? html`<fp3d-view3d
              .walkable=${false}
              class="fp3d-wv-3d"
              ${ref((el) => el && this.setupWall3d(el as HTMLElement, room, v.edge))}
              .hass=${this.rawHass}
              .home=${this.home}
              .building=${this._techMode ? this.techDoc3d() : this._doc3d}
              .floorId=${this._floorId}
              .roomId=${null}
              .wallMode=${"auto"}
              .explode=${false}
              .markerMode=${"none"}
              .heatMode=${"none"}
              .theme=${"neon"}
              .packs=${this.packs}
              .showEnergy=${false}
              .holograms=${false}
              .flows=${false}
              ?furnish=${admin}
              .furnishTypes=${null}
              .selectedFurniture=${this._wallSel}
              .selectedSet=${wset}
              .quality=${"auto"}
              .floorThumbs=${false}
              .roomLabels=${false}
              .floorStack=${"single"}
              .panelOpen=${false}
              .alerts=${false}
              .scenes=${false}
              .central=${false}
              @furniture-select=${(e: CustomEvent<{ id: string | null }>) => {
                const id = e.detail.id;
                // shift (or "Select several"): the piece joins the choice; a piece of the chosen set keeps the set
                if (id && (this.shiftHeld || this._multiMode)) this.wallToggle(id);
                else if (!id) this.wallChoose([]);
                else if (!this.wallSelection().includes(id) || this._wallSingle) this.wallChoose([id]);
                else this._wallSel = id;
              }}
              @furniture-move=${this.onFurnitureMoved3d}
              @plan-change=${this.onPlanChange3d}
            ></fp3d-view3d>
            <div class="fp3d-wv-lift" hidden title=${this.t("wall_view_lift")} @pointerdown=${(e: PointerEvent) => this.liftDown(e)} @pointermove=${(e: PointerEvent) => this.liftMove(e)} @pointerup=${() => this.liftUp()} @pointercancel=${() => this.liftUp()}>
              <span>↕</span><b></b>
            </div>`
          : html`<svg
          class="fp3d-wv-svg ${this._runMode ? "fp3d-wv-drawing" : ""} ${this._runMode === "valve" || this._runMode === "sight" ? "fp3d-wv-fitmode" : ""} ${this._runMode === "erase" ? "fp3d-wv-fitmode fp3d-wv-erase" : ""}"
          viewBox="${vb.x0} ${vb.y0} ${vb.w} ${vb.h}"
          preserveAspectRatio="xMidYMid meet"
          @wheel=${(e: WheelEvent) => {
            e.preventDefault();
            const el = e.currentTarget as SVGSVGElement;
            const pt = el.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const q = pt.matrixTransform(el.getScreenCTM()!.inverse());
            zoomAt(q.x, q.y, vb.k * Math.exp(-e.deltaY * 0.0015));
          }}
          @pointerdown=${(e: PointerEvent) => {
            if (e.pointerType === "touch") {
              this.wvTouch.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (this.wvTouch.size === 2) {
                // a second finger: zoom and pan instead of what the first one began
                const [a, b] = [...this.wvTouch.values()];
                this.wvPinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, k: vb.k, x0: vb.x0, y0: vb.y0 };
                this.wvTap = null;
                this.techPress = null;
                up();
                this.runPointUp();
                this.endJointDrags();
                return;
              }
              if (this.wvPinch) return;
              if (rc && this._runMode && this.isEditor) {
                e.stopPropagation();
                const q = rc.pt(e);
                this.wvTap = q;
                this.techPress = q;
                return;
              }
            }
            if (rc && this._runMode) {
              this.techPress = rc.pt(e);
              this.runDown(e, rc);
            } else if (this._runSel) this._runSel = null;
            else wallDown(e);
          }}
          @pointermove=${(e: PointerEvent) => {
            if (this.wvTouch.has(e.pointerId)) this.wvTouch.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.wvPinch) {
              if (this.wvTouch.size === 2) pinchMove(e.currentTarget as SVGSVGElement);
              return;
            }
            move(e);
            if (rc && this.jointDrag) this.jointMove(e, rc);
            else if (rc && this.fitDrag) this.fittingMove(e, rc);
            else if (rc && this.runDrag) this.runPointMove(e, rc);
            else if (rc && this._runMode === "draw" && this.techPress && this.isEditor && (e.buttons & 1 || e.pointerType === "touch")) {
              // the pen on the wall: the stroke grows under the pointer; its line begins with the first movement
              const q = rc.pt(e);
              const press = this.techPress;
              if (!this._runDraft && !this.techStroke && Math.hypot(q.s - press.s, q.y - press.y) > 0.02) {
                this.wvTap = null;
                this.runAt(rc, press.s, press.y, false, 1, null);
              }
              if (this._runDraft && !this.wvTap) {
                const st = (this.techStroke ??= [this.techPress]);
                const last = st[st.length - 1];
                if (Math.hypot(q.s - last.s, q.y - last.y) > 0.02) st.push(q);
                this.runHover = [q.s, q.y];
                this.requestUpdate();
              }
            } else if (rc && this._runMode === "draw" && this._runDraft) {
              const q = rc.pt(e);
              this.runHover = [q.s, q.y];
              this.requestUpdate();
            }
          }}
          @pointerup=${(e: PointerEvent) => {
            this.wvTouch.delete(e.pointerId);
            if (this.wvPinch) {
              if (!this.wvTouch.size) this.wvPinch = null;
              return;
            }
            const tap = this.wvTap;
            this.wvTap = null;
            const stroke = this.techStroke;
            this.techStroke = null;
            const travel = stroke ? stroke.reduce((sum, p, i) => (i ? sum + Math.hypot(p.s - stroke[i - 1].s, p.y - stroke[i - 1].y) : 0), 0) : 0;
            const pen = rc && this._techMode && this._runMode === "draw";
            if (stroke && travel > 0.12 && rc && this._runMode === "draw" && this._runDraft) {
              this.techPress = null;
              this.runHover = null;
              this.endStroke(rc, stroke, rc.pt(e));
            } else if (pen) {
              // a tap with the pen: a stroke too short to be a line is dropped; the pipe under the tap is chosen
              const press = this.techPress;
              this.techPress = null;
              this._runDraft = null;
              this.runHover = null;
              if (press) {
                const hit = this.runPick(rc!, press.s, press.y, true);
                this._runSel = hit.pipe ? { pipe: hit.pipe.id, pt: null } : null;
              }
            } else {
              if (tap && rc && this._runMode) this.runAt(rc, tap.s, tap.y, false, 1, null);
              this.techPress = null;
            }
            up();
            this.runPointUp();
            this.fittingUp(rc);
            const jd = this.jointDrag;
            this.jointDrag = null;
            if (jd?.moved) this.pushHistory(jd.base);
            else if (jd && rc) this.openCard(rc.pool.id, `joint:${jd.id}`);
          }}
          @pointercancel=${(e: PointerEvent) => {
            this.wvTouch.delete(e.pointerId);
            if (!this.wvTouch.size) this.wvPinch = null;
            this.wvTap = null;
            this.techPress = null;
            this.techStroke = null;
            up();
            this.runPointUp();
            this.endJointDrags();
          }}
          style="--fs:${fs}px"
        >
          <rect class="fp3d-wv-wall" x="0" y="0" width=${L} height=${H} />
          ${Array.from({ length: Math.floor(H / 0.5) }, (_, k) => svg`<line class="fp3d-wv-grid" x1="0" x2=${L} y1=${Y((k + 1) * 0.5)} y2=${Y((k + 1) * 0.5)} /><text class="fp3d-wv-scale" x="-0.06" y=${Y((k + 1) * 0.5) + 0.03}>${((k + 1) * 0.5).toFixed(1)}</text>`)}
          ${holes.map((o) => {
            const [x, w] = span(o.s0, o.s1);
            const op = floor.openings.find((q) => q.id === o.id);
            const label = op?.type === "window" ? this.t("opening_window") : op?.type === "garage" ? this.t("opening_garage") : this.t("opening_door");
            return svg`<rect class="fp3d-wv-hole ${op?.type === "window" ? "fp3d-wv-window" : ""}" x=${x} y=${Y(o.y1)} width=${w} height=${o.y1 - o.y0} />
              ${w > fs * 3.5 ? svg`<text class="fp3d-wv-hole-label" x=${x + w / 2} y=${Y(o.y1) + fs * 1.3} style="font-size:${fs * 0.85}px">${label}</text>` : nothing}`;
          })}
          ${items.map((it) => {
            const [x, w] = span(it.s0, it.s1);
            const m = floor.furniture.find((q) => q.id === it.id)!;
            const name = m.name || furnitureName(this.hass, m.type);
            const h = it.y1 - it.y0;
            const pic = this.wallPics.get(this.wallPicKey(frame, m));
            const xc = X(toWall(frame, [m.x, m.z]).s);
            return svg`<g class="fp3d-wv-item ${pic ? "fp3d-wv-pic" : ""} ${it.id === this._wallSel || wset.includes(it.id) ? "fp3d-wv-sel" : ""}" @pointerdown=${(e: PointerEvent) => down(e, it.id)} @dblclick=${() => {
              // a part of a block: this part alone; a single piece: open it in the plan
              const m2 = floor.furniture.find((q) => q.id === it.id);
              if (m2?.group && !this._wallSingle) {
                this.wallChoose([it.id]);
                this._wallSingle = true;
                return;
              }
              this._wallView = null;
              this.selectItem("furniture", it.id);
            }}>
              ${pic ? svg`<image href=${pic.url} x=${xc + pic.x0} y=${Y(it.y0 + pic.y1)} width=${pic.x1 - pic.x0} height=${pic.y1 - pic.y0} preserveAspectRatio="none" />` : nothing}
              <rect x=${x} y=${Y(it.y1)} width=${w} height=${Math.max(0.02, h)}><title>${name}</title></rect>
              ${!pic && w > fs * 3 && h > fs * 1.4 ? svg`<text x=${x + w / 2} y=${Y(it.y1) + Math.min(h / 2, fs * 1.6) + fs * 0.35} style="font-size:${fs}px">${name}</text>` : nothing}
            </g>`;
          })}
          ${dims}
          ${sel && selF && !many && admin && !selF.locked && items.some((i) => i.id === sel.id)
            ? (() => {
                const [x, w] = span(sel.s0, sel.s1);
                const yt = Y(sel.y1);
                const yb = Y(sel.y0);
                const hs = fs * 0.75;
                const along = this.alongAxis(frame, selF);
                const grab = (side: "l" | "r" | "t" | "b") => (e: PointerEvent) => {
                  e.stopPropagation();
                  (e.currentTarget as Element).closest("svg")!.setPointerCapture(e.pointerId);
                  this.wallResize = { id: sel.id, side, x0: x, x1: x + w, y0: sel.y0, y1: sel.y1, base: this._doc, moved: false };
                };
                return svg`<g class="fp3d-wv-handles">
                  ${along
                    ? svg`<rect class="fp3d-wv-handle fp3d-wv-ew" x=${x - hs / 2} y=${(yt + yb) / 2 - hs} width=${hs} height=${hs * 2} rx=${hs / 3} @pointerdown=${grab("l")} />
                        <rect class="fp3d-wv-handle fp3d-wv-ew" x=${x + w - hs / 2} y=${(yt + yb) / 2 - hs} width=${hs} height=${hs * 2} rx=${hs / 3} @pointerdown=${grab("r")} />`
                    : nothing}
                  <rect class="fp3d-wv-handle fp3d-wv-ns" x=${x + w / 2 - hs} y=${yt - hs / 2} width=${hs * 2} height=${hs} rx=${hs / 3} @pointerdown=${grab("t")} />
                  ${sel.y0 > 0.05 && canLift(selF) ? svg`<rect class="fp3d-wv-handle fp3d-wv-ns" x=${x + w / 2 - hs} y=${yb - hs / 2} width=${hs * 2} height=${hs} rx=${hs / 3} @pointerdown=${grab("b")} />` : nothing}
                  <text class="fp3d-wv-size" x=${x + w / 2} y=${yt - hs * 0.9} style="font-size:${fs * 0.85}px">${text(sel.s1 - sel.s0)} × ${text(sel.y1 - sel.y0)}</text>
                </g>`;
              })()
            : nothing}
          ${many && setSpan
            ? (() => {
                const [x, w] = span(setSpan.s0, setSpan.s1);
                const block = !this._wallMulti.length;
                return svg`<g class=${`fp3d-wv-setframe${block ? " fp3d-wv-setblock" : ""}`}><rect x=${x - 0.03} y=${Y(setSpan.y1) - 0.03} width=${w + 0.06} height=${setSpan.y1 - setSpan.y0 + 0.06} /><text x=${x} y=${Y(setSpan.y1) - 0.07} style="font-size:${fs * 0.85}px">${block ? `▣ ${this.t("block_title")} · ${wset.length}` : this.t("multi_title", { n: wset.length })}</text></g>`;
              })()
            : nothing}
          ${this._wallGap
            ? (() => {
                const g = this._wallGap;
                const [x, w] = span(g.s0, g.s1);
                const top = g.low ? Math.min(H, 0.9) : Math.min(H, 2.2);
                const bottom = g.low ? 0 : 1.3;
                return svg`<g class="fp3d-wv-gap"><rect x=${x} y=${Y(top)} width=${w} height=${top - bottom} /><text x=${x + w / 2} y=${Y((top + bottom) / 2)} style="font-size:${fs}px">${text(w)}</text></g>`;
              })()
            : nothing}
          ${this._wallFrame ? svg`<rect class="fp3d-wv-marquee" x=${Math.min(this._wallFrame.x0, this._wallFrame.x1)} y=${Math.min(this._wallFrame.y0, this._wallFrame.y1)} width=${Math.abs(this._wallFrame.x1 - this._wallFrame.x0)} height=${Math.abs(this._wallFrame.y1 - this._wallFrame.y0)} />` : nothing}
          <line class="fp3d-wv-floor" x1="-0.3" x2=${L + 0.3} y1=${H} y2=${H} />
          ${rc ? this.renderRuns(rc, X, Y) : nothing}
        </svg>`}
        </div>
        </div>
        <div class="fp3d-wv-foot">
          ${rc && this._techMode && !this._runDraft && !this._runSel && !sel && (this._runMode === "draw" || this._runMode === "feed")
            ? html`<span class="fp3d-muted">${this.t(this._runMode === "feed" ? "tech_feed_place" : "tech_start")}</span> ${this.renderTechIssues(rc)}`
            : rc && (this._runMode || (this._runSel && !sel))
            ? this.renderRunFoot(rc)
            : many && admin
            ? this.renderWallSetFoot(frame, wset, setSpan, span)
            : sel && selF
            ? html`<b>${selF.name || furnitureName(this.hass, selF.type)}</b>
                ${this.fixButton("furniture", sel.id)}
                ${selF.group && admin
                  ? html`<button class="fp3d-btn" title=${this.t("block_select")} @click=${() => {
                      this._wallSingle = false;
                      this.requestUpdate();
                    }}>▣ ${this.t("wv_block_all")}</button>`
                  : nothing}
                ${rc && (POOL_DEVICES as readonly string[]).includes(selF.type)
                  ? html`<button class="fp3d-btn fp3d-primary" @click=${() => this.openCard(rc.pool.id, `dev:${selF.id}`)}>${this.t("card_open")}</button>`
                  : nothing}
                ${selF.locked && admin ? html`<span class="fp3d-muted">${this.t("wall_view_fixed")}</span>` : nothing}
                ${this.len(this.t("wall_view_left"), Math.round(span(sel.s0, sel.s1)[0] * 1000) / 1000, (val) => {
                  const ds = val - span(sel.s0, sel.s1)[0];
                  this.moveOnWall(frame, sel.id, frame.rightward ? ds : -ds, null);
                }, 0.01, 0)}
                ${this.len(this.t("wall_view_depth"), Math.round(Math.max(0, sel.d) * 1000) / 1000, (val) => this.moveFromWall(frame, sel.id, val - sel.d), 0.01, 0)}
                ${admin && !selF.locked && this.alongAxis(frame, selF)
                  ? this.len(this.t("width"), Math.round((sel.s1 - sel.s0) * 1000) / 1000, (val) => {
                      // typed: the left side (as seen) stays, the right one moves
                      const v = Math.max(0.05, val);
                      if (frame.rightward) this.resizeOnWall(frame, sel.id, sel.s0, sel.s0 + v, null, null);
                      else this.resizeOnWall(frame, sel.id, sel.s1 - v, sel.s1, null, null);
                    }, 0.01, 0.05)
                  : nothing}
                ${admin && !selF.locked ? this.len(this.t("height_m"), Math.round((sel.y1 - sel.y0) * 1000) / 1000, (val) => this.resizeOnWall(frame, sel.id, null, null, null, sel.y0 + Math.max(0.03, val)), 0.01, 0.03) : nothing}
                ${lift ? this.len(this.t("mount_height"), Math.round(sel.y0 * 1000) / 1000, (val) => this.moveOnWall(frame, sel.id, 0, val), 0.01, 0) : html`<span class="fp3d-muted">${this.t("wall_view_floor")}</span>`}
                ${admin && !selF.locked
                  ? html`<span class="fp3d-wv-turn">
                      <button class="fp3d-btn" title=${this.t("wall_view_turn")} @click=${() => this.turnOnWall(selF.id, selF.rotation - 45)}>↺ 45°</button>
                      ${this.num(this.t("rotation"), selF.rotation, (val) => this.turnOnWall(selF.id, val), 1)}
                      <button class="fp3d-btn" title=${this.t("wall_view_turn")} @click=${() => this.turnOnWall(selF.id, selF.rotation + 45)}>↻ 45°</button>
                    </span>`
                  : nothing}
                <button class="fp3d-btn" @click=${() => {
                  this._wallView = null;
                  this.selectItem("furniture", sel.id);
                }}>${this.t("wall_view_form")}</button>
                ${admin ? html`<button class="fp3d-btn fp3d-danger" @click=${() => this.deleteOnWall([sel.id])}>${this.t("delete")}</button>` : nothing}`
            : html`<span class="fp3d-muted">${this._wallView3d ? this.t("wall_view_hint_3d") : items.length ? this.t("wall_view_hint") : this.t("wall_view_empty")}</span>`}
          ${admin && !this._techMode ? this.renderMultiToggle() : nothing}
        </div>
      </div>
    </div>`;
  }

  /** The wall view's bottom bar for several pieces: join or break up, the whole block or this part, distance, fix, delete. */
  renderWallSetFoot(this: Fp3dEditor, frame: WallFrame, ids: string[], sp: { s0: number; s1: number; y0: number; y1: number } | null, span: (a: number, b: number) => readonly [number, number]) {
    const block = !this._wallMulti.length;
    const fixed = ids.every((id) => this.isFixedItem("furniture", id));
    const some = !fixed && ids.some((id) => this.isFixedItem("furniture", id));
    return html`<b>${block ? `▣ ${this.t("block_title")}` : this.t("multi_title", { n: ids.length })}</b>
      ${some ? html`<span class="fp3d-wv-fixnote">${this.t("block_some_fixed")}</span>` : nothing}
      ${block
        ? html`<div class="fp3d-seg" role="group">
              <button aria-pressed="true">${this.t("wv_block_all")}</button>
              <button aria-pressed="false" @click=${() => (this._wallSingle = true)}>${this.t("wv_block_one")}</button>
            </div>
            <button class="fp3d-btn" @click=${() => {
              const sel = this._wallSel;
              this._wallMulti = ids;
              this.ungroupSelectionOf(ids);
              this._wallSel = sel;
            }}>${this.t("block_break")}</button>`
        : html`<button class="fp3d-btn fp3d-primary" @click=${() => {
            this.groupIds(ids);
            this._wallMulti = [];
          }}>▣ ${this.t("block_make")}</button>`}
      ${sp
        ? this.len(this.t("wall_view_left"), Math.round(span(sp.s0, sp.s1)[0] * 1000) / 1000, (val) => {
            const ds = val - span(sp.s0, sp.s1)[0];
            this.moveSetOnWall(frame, ids, frame.rightward ? ds : -ds, null);
          }, 0.01, 0)
        : nothing}
      <button class="fp3d-btn ${some ? "fp3d-primary" : ""}" @click=${() => {
        const set = new Set(ids);
        // partly fixed: everything loose; else all fixed or all loose
        const lock = !fixed && !some;
        this.change((_, floor) => {
          for (const m of floor.furniture) if (set.has(m.id)) m.locked = lock || null;
        });
      }}>${fixed ? `🔓 ${this.t("unfix")}` : some ? `🔓 ${this.t("unfix_all")}` : `🔒 ${this.t("fix")}`}</button>
      <button class="fp3d-btn fp3d-danger" @click=${() => this.deleteOnWall(ids)}>${this.t("delete")}</button>`;
  }

  /** Deletes the chosen pieces of the wall view (several or a fixed one only after asking). */
  async deleteOnWall(this: Fp3dEditor, ids: string[]): Promise<void> {
    if (!ids.length || !this.isEditor) return;
    if (ids.length > 1) {
      if (!(await this.ask(this.t(ids.some((id) => this.isFixedItem("furniture", id)) ? "block_delete_fixed" : "block_delete", { n: ids.length })))) return;
    } else if (!(await this.confirmFixedDelete("furniture", ids[0]))) return;
    const set = new Set(ids);
    this.change((_, floor) => (floor.furniture = floor.furniture.filter((m) => !set.has(m.id))));
    this._wallSel = null;
    this._wallMulti = [];
    this._wallSingle = false;
  }

  /** Joins these pieces into one block. */
  groupIds(this: Fp3dEditor, ids: string[]): void {
    const set = new Set(ids);
    const gid = uid("block");
    this.change((_, floor) => {
      for (const m of floor.furniture) if (set.has(m.id)) m.group = gid;
    });
  }

  ungroupSelectionOf(this: Fp3dEditor, ids: string[]): void {
    const set = new Set(ids);
    this.change((_, floor) => {
      for (const m of floor.furniture) if (set.has(m.id)) m.group = null;
    });
  }
}
