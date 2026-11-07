// Pipes on walls (pool module) in the wall view: tech mode, laying, editing and erasing runs, joints, feeds,
// fittings, and their drawing.

import { uiIcon } from "../../ui-icons.ts";
import { html, nothing, svg } from "lit";
import { sharedEdge } from "../../geometry/snap.ts";
import { cornerPoint, nearestOnPath, onWall, pipePath, type P3 } from "../../geometry/runs.ts";
import { laidPipe, planConnection, poolNodeAt, runLead, splitPipe, type WallRun } from "../../pool-runs.ts";
import { devicePorts, jointPortAt, jointPorts, nodePart, poolPortFlow, splitNode, type PortName } from "../../pool-ports.ts";
import { fromWall, roomEdgeFrame, toWall, type WallFrame } from "../../geometry/wall-frame.ts";
import { furnitureFootprint, POOL_DEVICES, type PoolPipe, type PoolJoint } from "../../model.ts";
import { type I18nKey } from "../../i18n.ts";
import { uid, type Building, type Room, type Vec2 } from "../../model.ts";
import { mountBase } from "../../packs.ts";
import { round, RUN_GAP, type RunDraft, type RunCtx, simplifyStroke, snapStroke, onWallXZ, pathLengthOf } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** PipesPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class PipesPart {
  /** The 3D wall view's building while drawing the technical room: only the pool devices of all furniture. */
  techDoc3d(this: Fp3dEditor): Building {
    const b = this._doc3d;
    if (this.techDocCache?.src === b) return this.techDocCache.doc;
    const doc = { ...b, floors: b.floors.map((f) => ({ ...f, furniture: f.furniture.filter((m) => (POOL_DEVICES as readonly string[]).includes(m.type)) })) };
    this.techDocCache = { src: b, doc };
    return doc;
  }
  /** technical-room mode on: only the wall, the pool devices and the pipes; the pen in the hand. */
  enterTech(this: Fp3dEditor): void {
    this.techPick = false;
    this._techMode = true;
    this._wallSel = null;
    this._wallMulti = [];
    this._runSel = null;
    this._runDraft = null;
    this._feedKind = null;
    this._runMode = "draw";
  }

  runFrame(this: Fp3dEditor, key: string): WallFrame | null {
    const [roomId, edge] = key.split("|");
    const room = this.floor?.rooms.find((r) => r.id === roomId);
    return room && Number(edge) < room.points.length ? roomEdgeFrame(room, Number(edge)) : null;
  }

  /** The building with the pipe being laid in it (the wall view's 3D shows it while it grows). */
  docWithDraft(this: Fp3dEditor): Building {
    const d = this._runDraft;
    if (!d || !this._wallView) return this._doc;
    const pts = [...(d.from || !d.anchor ? [] : [d.anchor]), ...d.pts];
    if (!pts.length) return this._doc;
    const doc = structuredClone(this._doc);
    const fl = doc.floors.find((f) => f.outdoor.some((o) => o.id === d.pool));
    const area = fl?.outdoor.find((o) => o.id === d.pool);
    if (!fl || !area) return this._doc;
    area.pool ??= {};
    const draft: PoolPipe = { id: "__draft", from: d.from, to: "", floor_id: fl.id, points: pts.map((q): Vec2 => [q[0], q[2]]), heights: pts.map((q) => q[1]) };
    area.pool.pipes = [...(area.pool.pipes ?? []), draft];
    return doc;
  }

  /** Where the pipe being laid ends so far: its last point, or the node, T-piece or loose end it starts from. */
  runLast(this: Fp3dEditor, d: RunDraft, c: RunCtx): P3 | null {
    if (d.pts.length) return d.pts[d.pts.length - 1];
    if (d.fromT) return d.fromT;
    const nodeAt = poolNodeAt(this._doc, c.floor, c.pool);
    if (d.extend) {
      const q = c.pool.pool?.pipes?.find((x) => x.id === d.extend!.pipe);
      const path = q ? pipePath(q, nodeAt) : [];
      return (d.extend.end === "to" ? path[path.length - 1] : path[0]) ?? null;
    }
    const n = nodeAt(d.from);
    return n ? [n.x, n.y, n.z] : null;
  }

  /** What lies under a point of the wall: a loose pipe end, a pool device or T-piece, a pipe (only pipes: placing a fitting). */
  runPick(this: Fp3dEditor, c: RunCtx, s: number, y: number, pipesOnly = false): { end?: { pipe: string; end: "from" | "to" }; node?: string; pipe?: { id: string; p: P3 } } {
    if (!pipesOnly)
      for (const r of c.runs) for (const e of r.ends) if (Math.hypot(e.s - s, e.y - y) < 0.12) return { end: { pipe: r.id, end: e.end } };
    const nodeAt = poolNodeAt(this._doc, c.floor, c.pool);
    let best: { node: string; d: number } | null = null;
    const nodes = [
      ...c.floor.furniture
        .filter((f) => (POOL_DEVICES as readonly string[]).includes(f.type))
        .flatMap((f) => (devicePorts(f.type).length ? devicePorts(f.type).map((q) => `dev:${f.id}:${q}`) : [`dev:${f.id}`])),
      ...(c.pool.pool?.joints ?? []).map((j) => (j.kind === "wall" || j.kind === "floor" ? `joint:${j.id}:inside` : `joint:${j.id}`)),
    ];
    for (const node of pipesOnly ? [] : nodes) {
      const q = nodeAt(node);
      if (!q) continue;
      const w = toWall(c.frame, [q.x, q.z]);
      if (w.d < -0.3 || w.d > 1.6) continue;
      const d = Math.hypot(w.s - s, q.y - y);
      if (d < 0.12 && (!best || d < best.d)) best = { node, d };
    }
    if (best) return { node: best.node };
    // drawing the technical room: a press on a device's body ends (or starts) at the device as a whole
    if (this._techMode && !pipesOnly) {
      // every pool device up to 1.6 m in front of the wall (a pump stands out into the room), seen from the front
      const dev = c.floor.furniture.find((f) => {
        if (!(POOL_DEVICES as readonly string[]).includes(f.type) || f.type === "pool_valve") return false;
        const w = furnitureFootprint(f).map((q) => toWall(c.frame, q));
        if (Math.min(...w.map((q) => q.d)) > 1.6 || Math.max(...w.map((q) => q.d)) < -0.3) return false;
        const y0 = mountBase(c.floor, f);
        return Math.min(...w.map((q) => q.s)) - 0.03 <= s && s <= Math.max(...w.map((q) => q.s)) + 0.03 && y0 - 0.03 <= y && y <= y0 + f.h + 0.03;
      });
      if (dev) return { node: `dev:${dev.id}` };
    }
    for (const r of c.runs)
      for (const pc of r.pieces) {
        const [vs, vy] = [pc.s1 - pc.s0, pc.y1 - pc.y0];
        const l2 = vs * vs + vy * vy;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((s - pc.s0) * vs + (y - pc.y0) * vy) / l2)) : 0;
        const [qs, qy] = [pc.s0 + vs * t, pc.y0 + vy * t];
        if (Math.hypot(qs - s, qy - y) < (pipesOnly ? 0.24 : 0.07)) return { pipe: { id: r.id, p: onWall(c.frame, qs, qy, pc.d0 + (pc.d1 - pc.d0) * t) } };
      }
    return {};
  }

  /**
   * The eraser: a ball valve or sight glass under the pointer goes; else the pipe; else a hole, T or Y with every
   * pipe at it (a hole's way outside too, so its pool line can be brought in anew).
   */
  eraseAt(this: Fp3dEditor, c: RunCtx, s: number, y: number): void {
    const near = (a: number, b: number, r: number) => Math.hypot(a - s, b - y) < r;
    for (const r of c.runs)
      for (const f of r.fittings)
        if (near(f.s, f.y, 0.1 * Math.max(1, this.wvScale))) {
          this.changePool(c.pool.id, (l) => {
            const q = l.pipes?.find((x) => x.id === r.id);
            if (q) q.fittings = (q.fittings ?? []).filter((x) => x.id !== f.id);
          });
          return;
        }
    const nodeAt = poolNodeAt(this._doc, c.floor, c.pool);
    const joint = (c.pool.pool?.joints ?? []).find((j) => {
      const node = j.kind === "wall" || j.kind === "floor" ? `joint:${j.id}:inside` : `joint:${j.id}`;
      const q = nodeAt(node);
      if (!q) return false;
      const w = toWall(c.frame, [q.x, q.z]);
      return w.d > -0.3 && w.d < 1.6 && near(w.s, q.y, 0.1);
    });
    if (joint) {
      const part = `joint:${joint.id}`;
      this.changePool(c.pool.id, (l) => {
        l.joints = (l.joints ?? []).filter((j) => j.id !== joint.id);
        l.pipes = (l.pipes ?? []).filter((x) => nodePart(x.from) !== part && nodePart(x.to) !== part);
      });
      this._runSel = null;
      return;
    }
    const hit = this.runPick(c, s, y, true);
    if (hit.pipe) {
      const id = hit.pipe.id;
      this.changePool(c.pool.id, (l) => (l.pipes = (l.pipes ?? []).filter((x) => x.id !== id)));
      this._runSel = null;
    }
  }

  /** A press on the wall while laying a pipe or placing a fitting. */
  runDown(this: Fp3dEditor, e: PointerEvent, c: RunCtx): void {
    if (!this._runMode || !this.isEditor) return;
    e.stopPropagation();
    this._techAsk = null;
    // the pen of technical-room mode: the press only marks where; the stroke begins with the first movement, and a
    // press without one is a tap (it chooses the pipe under it, or nothing)
    if (this._techMode && this._runMode === "draw") return;
    const { s, y } = c.pt(e);
    this.runAt(c, s, y, e.altKey, e.detail, null);
  }

  /**
   * A press in the 3D wall view while laying a pipe: the left button lays it (on a pool device: ends there; else
   * a point on the wall where the pointer's ray meets it), the other buttons and the wheel still look around.
   */
  runDown3d(this: Fp3dEditor, e: PointerEvent): void {
    const c = this.runCtx3d;
    if (!this._runMode || !c || e.button !== 0 || !this.isEditor || !this._wallView3d) return;
    type V = {
      renderer: { domElement: HTMLElement };
      floorMap: Map<string, { y: number }>;
      pointerRay(x: number, y: number): { o: number[]; d: number[] };
      furnitureIdAt(x: number, y: number): string | null;
    };
    const v = (this.wall3dEl as unknown as { viewer?: V } | null)?.viewer;
    if (!v) return;
    e.stopPropagation();
    e.preventDefault();
    const r = v.renderer.domElement.getBoundingClientRect();
    const [x, y] = [e.clientX - r.left, e.clientY - r.top];
    const id = v.furnitureIdAt(x, y);
    const dev = id ? c.floor.furniture.find((f) => f.id === id && (POOL_DEVICES as readonly string[]).includes(f.type)) : undefined;
    const ray = v.pointerRay(x, y);
    // the plane the pipes run in, just in front of the wall
    const p0 = fromWall(c.frame, 0, c.gap);
    const n = c.frame.n;
    const den = ray.d[0] * n[0] + ray.d[2] * n[1];
    if (Math.abs(den) < 1e-6) return;
    const t = ((p0[0] - ray.o[0]) * n[0] + (p0[1] - ray.o[2]) * n[1]) / den;
    if (t <= 0 && !dev) return;
    const hit = [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t];
    const base = c.floor.elevation + (v.floorMap.get(c.floor.id)?.y ?? 0);
    const nodeAt = poolNodeAt(this._doc, c.floor, c.pool);
    const devNode = () => {
      const ports = devicePorts(dev!.type);
      if (!ports.length) return `dev:${dev!.id}`;
      // the connection nearest where the ray passes the device
      const dist = (n: string) => {
        const q = nodeAt(n)!;
        const v = [q.x - ray.o[0], q.y + base - ray.o[1], q.z - ray.o[2]];
        const tt = v[0] * ray.d[0] + v[1] * ray.d[1] + v[2] * ray.d[2];
        return Math.hypot(v[0] - ray.d[0] * tt, v[1] - ray.d[1] * tt, v[2] - ray.d[2] * tt);
      };
      return ports.map((q) => `dev:${dev!.id}:${q}`).sort((m, n) => dist(m) - dist(n))[0];
    };
    this.runAt(c, toWall(c.frame, [hit[0], hit[2]]).s, hit[1] - base, e.altKey, e.detail, dev && this._runMode === "draw" ? devNode() : null);
  }

  /** A point of the wall pressed while laying a pipe or placing a fitting (`node`: a device pressed in 3D). */
  runAt(this: Fp3dEditor, c: RunCtx, s: number, y: number, alt: boolean, detail: number, node: string | null): void {
    const mode = this._runMode;
    if (!mode) return;
    if (mode === "tee" && this._techMode) {
      // drawing the technical room: a T-piece goes into the pipe tapped (the pipe is cut there)
      const hit = this.runPick(c, s, y, true);
      if (hit.pipe) this.teeOnPipe(c, hit.pipe.id, hit.pipe.p);
      return;
    }
    if (mode === "hole_wall" || mode === "hole_floor" || mode === "tee" || mode === "y") return this.placeJoint(c, mode, s, y);
    if (mode === "feed") return this.placeFeed(c, s, y);
    if (mode === "erase") return this.eraseAt(c, s, y);
    const hit = node ? { node } : this.runPick(c, s, y, mode !== "draw");
    if (mode !== "draw") {
      // a miss while placing a fitting keeps the tool (the hint says to tap the pipe)
      if (!hit.pipe && this._techMode) return;
      if (hit.pipe) this.addFitting(c, hit.pipe.id, hit.pipe.p, mode);
      // drawing the technical room: back to the pen
      this._runMode = this._techMode ? "draw" : null;
      if (this._techMode) this._runSel = null;
      return;
    }
    let d = this._runDraft;
    if (d && this._techMode && !this.techStroke) {
      // the pen: every press begins a stroke of its own – a draft still hanging is laid when it is a line, dropped when a bare point
      if (d.pts.length >= 2 || ((d.extend || d.fromT || d.from) && d.pts.length)) this.finishRun("", null);
      this._runDraft = null;
      d = null;
    }
    if (!d) {
      const start: RunDraft = { pool: c.pool.id, from: "", fromT: null, extend: null, pts: [], anchor: null, wall: c.key, d: c.gap };
      let draft: RunDraft;
      if (hit.end) draft = { ...start, extend: hit.end };
      else if (hit.node) draft = { ...start, from: hit.node };
      else if (hit.pipe) draft = { ...start, fromT: hit.pipe.p };
      else draft = { ...start, pts: [onWall(c.frame, Math.round(s * 20) / 20, Math.round(y * 20) / 20, c.gap)] };
      this._runDraft = { ...draft, anchor: this.runLast({ ...draft, pts: [] }, c) };
      return;
    }
    // a double click finishes (its first click set the point already)
    if (detail >= 2) return void this.finishRun("", null);
    if (hit.node && hit.node !== d.from) return void this.finishRun(hit.node, null);
    if (hit.pipe) return void this.finishRun("", hit.pipe.p);
    this._runDraft = { ...d, pts: [...d.pts, ...this.runStep(d, c, s, y, alt)], wall: c.key, d: c.gap };
  }

  /**
   * The next point of a pipe on a 5 cm grid, level with or straight above the last one (Alt: free); on another
   * wall than the last point the pipe first goes round the corner.
   */
  runStep(this: Fp3dEditor, d: RunDraft, c: RunCtx, s: number, y: number, free: boolean): P3[] {
    let ss = Math.round(s * 20) / 20;
    let yy = Math.round(y * 20) / 20;
    const out: P3[] = [];
    let last = this.runLast(d, c);
    if (last && d.wall !== c.key) {
      const prev = this.runFrame(d.wall);
      const corner = prev && cornerPoint(prev, d.d, c.frame, c.gap);
      if (corner) {
        last = [round(corner[0]), last[1], round(corner[1])];
        out.push(last);
      }
    }
    if (last && !free) {
      const w = toWall(c.frame, [last[0], last[2]]);
      if (w.d > -0.35 && w.d < 0.6) {
        if (Math.abs(ss - w.s) < Math.abs(yy - last[1])) ss = w.s;
        else yy = last[1];
      }
    }
    out.push(onWall(c.frame, ss, yy, c.gap));
    return out.map((q) => [round(q[0]), round(q[1]), round(q[2])] as P3);
  }

  /**
   * Ends the pipe being laid: at a node, at a T-piece on another pipe (`toT`), or loose; `extra` points come last
   * (down into the floor, through the wall), `height` is where points added later in the plan run.
   */
  finishRun(this: Fp3dEditor, to: string, toT: P3 | null, extra: P3[] = [], height?: number): string | null {
    const d = this._runDraft;
    const floor = this.floor;
    const rules = this.pipeRules;
    this._runDraft = null;
    if (!d || !floor || !rules) return null;
    const pts = [...d.pts, ...extra];
    // drawing the technical room: into its end the line turns once – level first, then straight up or down into it –
    // instead of a slanted last piece
    const frame = this._techMode ? this.runFrame(d.wall) : null;
    const area0 = this._techMode ? this.floor?.outdoor.find((o) => o.id === d.pool) : undefined;
    if (frame && area0 && !extra.length && (to || toT)) {
      const start = pts.length ? pts[pts.length - 1] : (() => {
        const n = d.from ? poolNodeAt(this._doc, floor, area0)(d.from) : null;
        return n ? ([n.x, n.y, n.z] as P3) : d.fromT;
      })();
      const n = toT ? { x: toT[0], y: toT[1], z: toT[2] } : poolNodeAt(this._doc, floor, area0)(to);
      if (start && n) {
        const a = toWall(frame, [start[0], start[2]]);
        const b = toWall(frame, [n.x, n.z]);
        if (Math.abs(a.s - b.s) > 0.03 && Math.abs(start[1] - n.y) > 0.03) pts.push(onWall(frame, b.s, start[1], d.d));
      }
    }
    if (!pts.length && !toT && (!to || to === d.from) && !d.fromT) return null;
    let chosen: string | null = null;
    this.changePool(d.pool, (l, area) => {
      const joints: PoolJoint[] = (l.joints ??= []);
      const pipes: PoolPipe[] = (l.pipes ??= []);
      const base = poolNodeAt(this._doc, floor, area);
      const nodeAt = (n: string) => {
        const j = n.startsWith("joint:") ? joints.find((x) => `joint:${x.id}` === n) : undefined;
        return j ? { x: j.x, z: j.z, y: j.y } : base(n);
      };
      // a T-piece: the pipe nearest the point is split there
      const tee = (q: P3): string => {
        let best: { pipe: PoolPipe; d: number } | null = null;
        for (const pipe of pipes) {
          const h = nearestOnPath(pipePath(pipe, nodeAt), q);
          if (h && h.d < 0.12 && (!best || h.d < best.d)) best = { pipe, d: h.d };
        }
        const cut = best && splitPipe(best.pipe, nodeAt, q, uid("joint"), uid("pipe"));
        if (!best || !cut) return "";
        joints.push(cut.joint);
        pipes.splice(pipes.indexOf(best.pipe), 1, cut.first, cut.second);
        return `joint:${cut.joint.id}:out2`;
      };
      // a pipe at a T- or Y-piece takes its next free connection, at a hole the inside
      const free = (n: string, extra: string[] = []) => {
        const { kind, id, port } = splitNode(n);
        const j = kind === "joint" && !port ? joints.find((x) => x.id === id) : undefined;
        if (!j || !j.kind) return n;
        if (j.kind === "wall" || j.kind === "floor") return `joint:${id}:inside`;
        const taken = new Set([...pipes.flatMap((p) => [p.from, p.to]), ...extra]);
        const q = jointPorts(j.kind).find((x) => !taken.has(`joint:${id}:${x}`));
        return q ? `joint:${id}:${q}` : n;
      };
      let from = d.fromT ? tee(d.fromT) : free(d.from);
      let end = toT ? tee(toT) : free(to, [from]);
      // a device as a whole: the connection the line's other end asks for (water in: the suction side …)
      const devs = floor.furniture.filter((f) => (POOL_DEVICES as readonly string[]).includes(f.type)).map((f) => ({ id: f.id, type: f.type }));
      const taken = (dev: string) => pipes.flatMap((p) => [p.from, p.to]).filter((n) => nodePart(n) === dev).map((n) => splitNode(n).port).filter((q): q is PortName => !!q);
      const toWasteNode = (n: string) => {
        const { kind, id } = splitNode(n);
        if (kind === "port") return area.pool?.ports?.find((q) => q.id === id)?.kind === "waste";
        return kind === "joint" && /waste|backwash/i.test(joints.find((j) => j.id === id)?.name ?? "");
      };
      const resolve = (n: string, other: string) => {
        const { kind, id, port } = splitNode(n);
        if (kind !== "dev" || port) return n;
        const type = floor.furniture.find((f) => f.id === id)?.type ?? "";
        const q = rules.autoPort(type, other ? rules.nodeFlow(other, area, devs) : null, toWasteNode(other), taken(`dev:${id}`));
        return q ? `dev:${id}:${q}` : n;
      };
      from = resolve(from, end);
      end = resolve(end, from);
      const xz = pts.map((q): Vec2 => [round(q[0]), round(q[2])]);
      const hs = pts.map((q) => round(q[1]));
      const ext = d.extend;
      const q = ext && pipes.find((x) => x.id === ext.pipe);
      if (ext && q) {
        Object.assign(q, laidPipe(q, nodeAt));
        if (ext.end === "to") {
          q.points = [...q.points, ...xz];
          q.heights = [...(q.heights ?? []), ...hs];
          q.to = end;
        } else {
          // drawn outward from the loose start: the pipe now starts at the far end
          q.points = [...xz.reverse(), ...q.points];
          q.heights = [...hs.reverse(), ...(q.heights ?? [])];
          q.from = end;
        }
        if (height !== undefined) q.height = height;
        chosen = q.id;
        return;
      }
      let pipe: PoolPipe = { id: uid("pipe"), from, to: end, floor_id: floor.id, points: xz, heights: hs, height: height ?? hs[hs.length - 1] ?? null };
      // the water runs from where it comes out to where it goes in, whichever way the line was drawn
      pipe = rules.orientPipe(pipe, from ? rules.nodeFlow(from, area, devs) : null, end ? rules.nodeFlow(end, area, devs) : null);
      pipes.push(pipe);
      chosen = pipe.id;
    });
    if (chosen && !this._techMode) this._runSel = { pipe: chosen, pt: null };
    // drawing the technical room: the pen stays in the hand
    this._runMode = this._techMode ? "draw" : null;
    return chosen;
  }

  /** A T-piece into a pipe where it was tapped: the pipe is cut there, both halves end at the new piece. */
  teeOnPipe(this: Fp3dEditor, c: RunCtx, pipeId: string, p: P3): void {
    const nodeAt = poolNodeAt(this._doc, c.floor, c.pool);
    this.changePool(c.pool.id, (l) => {
      const pipes = [...(l.pipes ?? [])];
      const i = pipes.findIndex((x) => x.id === pipeId);
      if (i < 0) return;
      const cut = splitPipe(pipes[i], nodeAt, p, uid("joint"), uid("pipe"));
      if (!cut) return;
      l.joints = [...(l.joints ?? []), cut.joint];
      pipes.splice(i, 1, cut.first, cut.second);
      l.pipes = pipes;
    });
    this._runMode = "draw";
  }

  /**
   * A line from the pool brought into the room where the wall was tapped: low down it comes out of the floor, higher
   * up through the wall. The way outside – under the ground to the skimmer, the drain, the inlets (with a T-piece for
   * several) or the waste drain – is laid by itself; inside it waits for the pipes drawn to it.
   */
  placeFeed(this: Fp3dEditor, c: RunCtx, s: number, y: number): void {
    const kind = this._feedKind;
    this._feedKind = null;
    this._runMode = "draw";
    if (kind) this.feedAt(c, kind, s, y);
  }

  /** The hole of a pool line at a point of the wall and its way outside to the pool; returns the hole (null: no floor). */
  feedAt(this: Fp3dEditor, c: RunCtx, kind: string, s: number, y: number): PoolJoint | null {
    const floor = this.floor;
    if (!floor) return null;
    const ss = Math.round(s * 20) / 20;
    const low = y < 0.25;
    const face = c.gap - RUN_GAP;
    const thick = sharedEdge(c.floor, c.room.id, c.frame.a, c.frame.b) ? this._doc.settings.wall_interior : this._doc.settings.wall_exterior;
    const name = this.t(`feed_${kind}` as I18nKey);
    const [x, z] = onWallXZ(c.frame, ss, low ? c.gap : face);
    const hole: PoolJoint = low
      ? { id: uid("joint"), kind: "floor", x, z, y: 0, name }
      : { id: uid("joint"), kind: "wall", x, z, y: Math.round(y * 20) / 20, nx: round(c.frame.n[0]), nz: round(c.frame.n[1]), depth: round(thick), name };
    this.changePool(c.pool.id, (l, area) => {
      l.joints = [...(l.joints ?? []), hole];
      // no waste drain yet: one outside, a metre beyond the hole
      let ports = (l.ports ?? []).filter((q) => q.kind === kind);
      if (kind === "waste" && !ports.length) {
        const out = jointPortAt(hole, "outside");
        const port = { id: uid("port"), kind: "waste" as const, x: round(out.x - c.frame.n[0] * 1), z: round(out.z - c.frame.n[1] * 1) };
        l.ports = [...(l.ports ?? []), port];
        ports = [port];
      }
      if (!ports.length) return;
      const nodeAt = poolNodeAt(this._doc, floor, area);
      const lookup = (n: string) => {
        const { kind: k, id, port } = splitNode(n);
        const j = k === "joint" ? (l.joints ?? []).find((q) => q.id === id) : undefined;
        if (j) return jointPortAt(j, port);
        const pp = k === "port" ? (l.ports ?? []).find((q) => q.id === id) : undefined;
        return pp ? (nodeAt(n) ?? { x: pp.x, y: 0.02, z: pp.z }) : nodeAt(n);
      };
      const flow = (n: string) => {
        const { kind: k, id } = splitNode(n);
        if (k === "port") {
          const pp = (l.ports ?? []).find((q) => q.id === id);
          return pp ? poolPortFlow(pp.kind) : null;
        }
        return null;
      };
      const plan = planConnection({ from: `joint:${hole.id}:outside`, vias: [], to: ports.map((q) => `port:${q.id}`), floorId: floor.id }, lookup, l.joints ?? [], flow, (k) => uid(k));
      l.joints = [...(l.joints ?? []), ...plan.joints];
      l.pipes = [...(l.pipes ?? []), ...plan.pipes];
    });
    return hole;
  }

  /**
   * The pen: a stroke let go becomes a pipe with right angles – the wiggles go, each piece runs level or upright,
   * corners stay where the hand turned. Its end joins what lies there (a device's connection, a pipe as a T-piece);
   * on nothing it asks where the line goes (the floor: down and out to the pool; higher: through the wall).
   */
  endStroke(this: Fp3dEditor, c: RunCtx, stroke: { s: number; y: number }[], q: { s: number; y: number }): void {
    const d = this._runDraft;
    if (!d) return;
    const start = this.runLast(d, c);
    const w0 = start ? toWall(c.frame, [start[0], start[2]]) : null;
    const first = w0 && w0.d > -0.35 && w0.d < 0.6 ? { s: w0.s, y: start![1] } : stroke[0];
    const corners = snapStroke([first, ...simplifyStroke(stroke, 0.08), q]);
    // the corners between start and end (the end itself is set by what it joins)
    const inner = corners.slice(1, -1).map((p): P3 => {
      const r = onWall(c.frame, p.s, p.y, c.gap);
      return [round(r[0]), round(r[1]), round(r[2])];
    });
    const hit = this.runPick(c, q.s, q.y);
    this._techAsk = null;
    if (hit.node && hit.node !== d.from) {
      this.finishRun(hit.node, null, inner);
      return;
    }
    if (hit.pipe) {
      this.finishRun("", hit.pipe.p, inner);
      return;
    }
    // nothing there: the pipe ends loose where the hand stopped – and may be led on to the pool from the side bar
    const end = corners[corners.length - 1];
    const endPt = onWall(c.frame, Math.round(end.s * 20) / 20, Math.round(end.y * 20) / 20, c.gap);
    const id = this.finishRun("", null, [...inner, [round(endPt[0]), round(endPt[1]), round(endPt[2])]]);
    if (id) this._techAsk = { s: end.s, y: end.y, pipe: id };
  }

  /** The answer to "where does the line go": a hole there with the way outside, the loose end joined to it. */
  answerAsk(this: Fp3dEditor, c: RunCtx, kind: string | null): void {
    const ask = this._techAsk;
    this._techAsk = null;
    if (!ask) return;
    if (kind === "cancel") {
      this.changePool(c.pool.id, (l) => (l.pipes = (l.pipes ?? []).filter((p) => p.id !== ask.pipe)));
      return;
    }
    if (!kind) return;
    const hole = this.feedAt(c, kind, ask.s, ask.y);
    if (!hole) return;
    this.changePool(c.pool.id, (l) => {
      const p = l.pipes?.find((x) => x.id === ask.pipe);
      if (!p) return;
      if (!p.to) p.to = `joint:${hole.id}:inside`;
      else if (!p.from) p.from = `joint:${hole.id}:inside`;
    });
  }

  /** The side bar of technical-room mode: devices, the pool's lines to bring in, ball valve and sight glass, what is missing. */
  renderTechKit(this: Fp3dEditor, frame: WallFrame, room: Room, c: RunCtx) {
    const area = c.pool;
    const rules = this.pipeRules;
    if (!rules) return nothing;
    const add = (t: string) => html`<button class="fp3d-wv-tile" @click=${() => this.addOnWall(t, frame, room)}>
      <span class="fp3d-wv-tile-pic">${this.kitPics.get(t) ? html`<img src=${this.kitPics.get(t)} alt="" />` : html`<i></i>`}</span>
      <span class="fp3d-wv-tile-name">${this.t(`furn_${t}` as I18nKey)}</span>
    </button>`;
    void this.askKitPics(["pool_pump", "pool_filter", "pool_heat_pump", "pool_dosing"]);
    const kinds = ["skimmer", "drain", "inlet", "waste"].filter((k) => k === "waste" || (area.pool?.ports ?? []).some((q) => q.kind === k));
    const fit = (mode: "valve" | "sight", label: I18nKey) =>
      html`<button class="fp3d-btn ${this._runMode === mode ? "fp3d-primary" : ""}" title=${this.t("wall_run_fit")} @click=${() => {
        this._runDraft = null;
        this._runMode = this._runMode === mode ? "draw" : mode;
      }}>+ ${this.t(label)}</button>`;
    const ask = this._techAsk;
    return html`<aside class="fp3d-wv-kit fp3d-tech-kit">
      ${ask
        ? html`<div class="fp3d-tech-ask">
            <b>${this.t("tech_ask")}</b>
            ${(["skimmer", "drain", "inlet", "waste"] as const).map((k) => html`<button class="fp3d-btn fp3d-tech-feed" @click=${() => this.answerAsk(c, k)}><i>${k === "waste" ? "🟤" : "〰"}</i>${this.t(`feed_${k}` as I18nKey)}</button>`)}
            <button class="fp3d-btn" @click=${() => this.answerAsk(c, null)}>${this.t("tech_ask_loose")}</button>
            <button class="fp3d-btn fp3d-danger" @click=${() => this.answerAsk(c, "cancel")}>${this.t("delete")}</button>
          </div>`
        : this.renderTechStep(c)}
      <div class="fp3d-seg fp3d-tech-pen" role="group">
        <button aria-pressed=${this._runMode === "draw"} @click=${() => {
          this._runMode = "draw";
          this._runSel = null;
        }}><span>✏</span>${this.t("tech_draw")}</button>
        <button aria-pressed=${this._runMode !== "draw" && this._runMode !== "feed" && this._runMode !== "erase"} @click=${() => {
          this._runDraft = null;
          this._runMode = null;
        }}><span>✋</span>${this.t("tech_pick")}</button>
        <button aria-pressed=${this._runMode === "erase"} title=${this.t("tech_erase_hint")} @click=${() => {
          this._runDraft = null;
          this._runSel = null;
          this._feedKind = null;
          this._runMode = this._runMode === "erase" ? "draw" : "erase";
        }}><span>🧽</span>${this.t("tech_erase")}</button>
      </div>
      <button class="fp3d-btn fp3d-tech-undo" ?disabled=${!this._canUndo} title="Ctrl+Z" @click=${() => {
        this._runDraft = null;
        this.undo();
      }}>${uiIcon("undo")} ${this.t("undo")}</button>
      <h4>${this.t("tech_feeds")}</h4>
      ${kinds.map((k) => {
        const done = rules.feedDone(area, k);
        return html`<button class="fp3d-btn fp3d-tech-feed ${this._feedKind === k ? "fp3d-primary" : ""} ${done ? "fp3d-on" : ""}" ?disabled=${done} @click=${() => {
          this._runDraft = null;
          this._feedKind = this._feedKind === k ? null : k;
          this._runMode = this._feedKind ? "feed" : "draw";
        }}><i>${k === "waste" ? "🟤" : "〰"}</i>${this.t(`feed_${k}` as I18nKey)}${done ? html`<small>✓</small>` : nothing}</button>`;
      })}
      ${!(area.pool?.ports ?? []).some((q) => q.kind !== "waste") ? html`<p class="fp3d-sub">${this.t("tech_no_ports")}</p>` : nothing}
      <h4>${this.t("tech_devices")}</h4>
      <div class="fp3d-wv-tiles">${(["pool_pump", "pool_filter", "pool_heat_pump", "pool_dosing"] as const).map(add)}</div>
      <h4>${this.t("tech_fittings")}</h4>
      ${fit("valve", "wall_run_valve")} ${fit("sight", "wall_run_sight")}
      <button class="fp3d-btn ${this._runMode === "tee" ? "fp3d-primary" : ""}" title=${this.t("tech_step_tee")} @click=${() => {
        this._runDraft = null;
        this._runMode = this._runMode === "tee" ? "draw" : "tee";
      }}>+ ${this.t("joint_add_tee")}</button>
      <p class="fp3d-sub">${this.t("tech_hint")}</p>
    </aside>`;
  }

  /**
   * The next step, in plain words: bring the pool's lines in, put the pump and filter up, then the line still missing
   * ("from the skimmer to the pump's suction side") – one at a time, until the water flows.
   */
  renderTechStep(this: Fp3dEditor, c: RunCtx) {
    const area = c.pool;
    const rules = this.pipeRules;
    if (!rules) return nothing;
    const ports = area.pool?.ports ?? [];
    const devs = c.floor.furniture.filter((f) => (POOL_DEVICES as readonly string[]).includes(f.type));
    const box = (n: number | null, text: string) => html`<div class="fp3d-tech-step ${n === null ? "fp3d-done" : ""}"><b>${n === null ? "✓" : this.t("tech_step", { n })}</b>${text}</div>`;
    if (this._runMode === "feed") return box(1, this.t("tech_feed_place"));
    if (this._runMode === "erase") return html`<div class="fp3d-tech-step fp3d-tech-erasing"><b>🧽 ${this.t("tech_erase")}</b>${this.t("tech_erase_hint")}</div>`;
    if (this._runMode === "valve" || this._runMode === "sight") return box(4, this.t("tech_step_fit"));
    if (this._runMode === "tee") return box(4, this.t("tech_step_tee"));
    if (this._runDraft) return box(3, this.t("tech_step_drawing"));
    if (!ports.some((q) => q.kind !== "waste")) return box(1, this.t("tech_no_ports"));
    const missing = ["skimmer", "drain", "inlet"].find((k) => ports.some((q) => q.kind === k) && !rules.feedDone(area, k));
    if (missing) return box(1, this.t("tech_step_feed", { name: this.t(`feed_${missing}` as I18nKey) }));
    const pump = devs.find((f) => f.type === "pool_pump");
    const filter = devs.find((f) => f.type === "pool_filter");
    if (!pump || !filter) return box(2, this.t("tech_step_devices"));
    const issues = rules.issues(area, devs.map((f) => ({ id: f.id, type: f.type })));
    const name = (n: string) => this.poolNodeLabel(area, n);
    const port = issues.find((i) => i.kind === "port");
    if (port) {
      const { port: q } = splitNode(port.node);
      // where the line to this connection comes from (or goes to)
      const fromTo: Record<string, string> = {
        suction: this.t("feed_skimmer"),
        pressure: name(`dev:${filter.id}:pump`),
        pump: name(`dev:${pump.id}:pressure`),
        return: devs.some((f) => f.type === "pool_heat_pump") ? this.t("furn_pool_heat_pump") : this.t("feed_inlet"),
        waste: this.t("feed_waste"),
        in: name(`dev:${filter.id}:return`),
        out: this.t("feed_inlet"),
      };
      return box(3, this.t("tech_step_line", { a: q ? (fromTo[q] ?? "…") : "…", b: name(port.node) }));
    }
    if (issues.some((i) => i.kind === "loose")) return box(3, this.t("tech_step_loose"));
    return box(null, this.t("tech_ok"));
  }

  /** technical-room mode: what is still missing, or that the water flows. */
  renderTechIssues(this: Fp3dEditor, c: RunCtx) {
    const devs = c.floor.furniture.filter((f) => (POOL_DEVICES as readonly string[]).includes(f.type)).map((f) => ({ id: f.id, type: f.type }));
    const rules = this.pipeRules;
    if (!rules) return nothing;
    const issues = rules.issues(c.pool, devs);
    if (!issues.length) return html`<span class="fp3d-tech-ok">✓ ${this.t("tech_ok")}</span>`;
    const loose = issues.filter((i) => i.kind === "loose").length;
    const text = [
      ...(loose ? [this.t("tech_issue_loose", { n: loose })] : []),
      ...issues.filter((i) => i.kind === "port").map((i) => this.t("tech_issue_port", { name: this.poolNodeLabel(c.pool, i.node) })),
      ...issues.filter((i) => i.kind === "feed").map((i) => this.t("tech_issue_feed", { name: this.t(`feed_${i.node}` as I18nKey) })),
    ];
    return html`<span class="fp3d-tech-issues">⚠ ${text.slice(0, 4).join(" · ")}${text.length > 4 ? " …" : ""}</span>`;
  }

  /** A hole through the wall (or the floor in front of it), a T- or Y-piece where the wall was tapped. */
  placeJoint(this: Fp3dEditor, c: RunCtx, mode: "hole_wall" | "hole_floor" | "tee" | "y", s: number, y: number): void {
    const face = c.gap - RUN_GAP;
    const ss = Math.round(s * 100) / 100;
    const yy = Math.round(y * 100) / 100;
    const thick = sharedEdge(c.floor, c.room.id, c.frame.a, c.frame.b) ? this._doc.settings.wall_interior : this._doc.settings.wall_exterior;
    let j: PoolJoint;
    if (mode === "hole_wall") {
      const [x, z] = onWallXZ(c.frame, ss, face);
      j = { id: uid("joint"), kind: "wall", x, z, y: Math.max(0.05, yy), nx: round(c.frame.n[0]), nz: round(c.frame.n[1]), depth: round(thick) };
    } else if (mode === "hole_floor") {
      const [x, z] = onWallXZ(c.frame, ss, c.gap);
      j = { id: uid("joint"), kind: "floor", x, z, y: 0 };
    } else {
      const [x, z] = onWallXZ(c.frame, ss, c.gap);
      j = { id: uid("joint"), kind: mode, x, z, y: yy };
    }
    this.changePool(c.pool.id, (l) => (l.joints = [...(l.joints ?? []), j]));
    this._runMode = null;
  }

  /** Down into the floor (on to the garden in the plan) or through the wall from the pipe's last point. */
  runOut(this: Fp3dEditor, c: RunCtx, how: "down" | "through"): void {
    const d = this._runDraft;
    const last = d && this.runLast(d, c);
    if (!d || !last) return;
    if (how === "down") return void this.finishRun("", null, [[last[0], -0.3, last[2]]], -0.3);
    const w = toWall(c.frame, [last[0], last[2]]);
    const thick = sharedEdge(c.floor, c.room.id, c.frame.a, c.frame.b) ? this._doc.settings.wall_interior : this._doc.settings.wall_exterior;
    const out = onWall(c.frame, w.s, last[1], -(thick + 0.15));
    this.finishRun("", null, [[round(out[0]), last[1], round(out[2])]], last[1]);
  }

  addFitting(this: Fp3dEditor, c: RunCtx, pipeId: string, at: P3, kind: "valve" | "sight"): void {
    const nodeAt = poolNodeAt(this._doc, c.floor, c.pool);
    this.changePool(c.pool.id, (l) => {
      const q = l.pipes?.find((x) => x.id === pipeId);
      const h = q && nearestOnPath(pipePath(q, nodeAt), at);
      if (!q || !h) return;
      q.fittings = [...(q.fittings ?? []), { id: uid("fit"), kind, at: round(h.at), ...(kind === "valve" ? { open: true } : {}) }];
    });
    this._runSel = { pipe: pipeId, pt: null };
  }

  /** A press on a pipe: choose it; on the chosen one, a new point there that follows the pointer. */
  runPieceDown(this: Fp3dEditor, e: PointerEvent, c: RunCtx, run: WallRun, k: number): void {
    if (this._runMode) return;
    e.stopPropagation();
    this._wallSel = null;
    if (this._runSel?.pipe !== run.id || !this.isEditor) {
      this._runSel = { pipe: run.id, pt: null };
      return;
    }
    const { s, y } = c.pt(e);
    const pc = run.pieces.find((x) => x.k === k)!;
    const t = Math.hypot(pc.s1 - pc.s0, pc.y1 - pc.y0) > 0 ? Math.hypot(s - pc.s0, y - pc.y0) / Math.hypot(pc.s1 - pc.s0, pc.y1 - pc.y0) : 0;
    const dd = pc.d0 + (pc.d1 - pc.d0) * Math.min(1, t);
    const base = this._doc;
    const nodeAt = poolNodeAt(base, c.floor, c.pool);
    let index = -1;
    this.changePool(c.pool.id, (l) => {
      const q = l.pipes?.find((x) => x.id === run.id);
      if (!q) return;
      Object.assign(q, laidPipe(q, nodeAt));
      index = Math.max(0, Math.min(q.points.length, k + 1 - runLead(q, nodeAt)));
      q.points.splice(index, 0, onWallXZ(c.frame, s, dd));
      q.heights!.splice(index, 0, round(y));
    });
    if (index < 0) return;
    this._runSel = { pipe: run.id, pt: index };
    this.runDrag = { pipe: run.id, i: index, d: dd, base, moved: true };
    (e.currentTarget as Element).closest("svg")?.setPointerCapture(e.pointerId);
  }

  /** A press on a pipe's point: drag it along the wall and up or down; a double click takes it out. */
  runPointDown(this: Fp3dEditor, e: PointerEvent, c: RunCtx, pipeId: string, i: number): void {
    if (this._runMode || !this.isEditor) return;
    e.stopPropagation();
    const nodeAt = poolNodeAt(this._doc, c.floor, c.pool);
    if (this.doubleTap(e, `runpt:${pipeId}:${i}`)) {
      this.changePool(c.pool.id, (l) => {
        const q = l.pipes?.find((x) => x.id === pipeId);
        if (!q) return;
        Object.assign(q, laidPipe(q, nodeAt));
        q.points.splice(i, 1);
        q.heights!.splice(i, 1);
      });
      this._runSel = { pipe: pipeId, pt: null };
      return;
    }
    const q = c.pool.pool?.pipes?.find((x) => x.id === pipeId);
    const laid = q && laidPipe(q, nodeAt);
    const at = laid?.points[i];
    if (!at) return;
    this._runSel = { pipe: pipeId, pt: i };
    this.runDrag = { pipe: pipeId, i, d: toWall(c.frame, at).d, base: this._doc, moved: false };
    (e.currentTarget as Element).closest("svg")?.setPointerCapture(e.pointerId);
  }

  runPointMove(this: Fp3dEditor, e: PointerEvent, c: RunCtx): void {
    const g = this.runDrag;
    if (!g) return;
    let { s, y } = c.pt(e);
    s = Math.round(s * 100) / 100;
    y = Math.round(y * 100) / 100;
    const nodeAt = poolNodeAt(g.base, c.floor, c.pool);
    const area = g.base.floors.flatMap((f) => f.outdoor).find((o) => o.id === c.pool.id);
    const q0 = area?.pool?.pipes?.find((x) => x.id === g.pipe);
    if (!q0) return;
    const laid = laidPipe(q0, nodeAt);
    // level with or straight above a neighbouring point within 4 cm (Alt: free)
    if (!e.altKey) {
      const path = pipePath(laid, nodeAt);
      const lead = runLead(laid, nodeAt);
      for (const nb of [path[g.i + lead - 1], path[g.i + lead + 1]]) {
        if (!nb) continue;
        const w = toWall(c.frame, [nb[0], nb[2]]);
        if (Math.abs(w.s - s) < 0.04) s = round(w.s);
        if (Math.abs(nb[1] - y) < 0.04) y = round(nb[1]);
      }
    }
    g.moved = true;
    this.change(
      (_, floor) => {
        const q = floor.outdoor.find((o) => o.id === c.pool.id)?.pool?.pipes?.find((x) => x.id === g.pipe);
        if (!q) return;
        Object.assign(q, laidPipe(q, nodeAt));
        q.points[g.i] = onWallXZ(c.frame, s, g.d);
        q.heights![g.i] = y;
      },
      g.base,
      false,
    );
  }

  runPointUp(this: Fp3dEditor): void {
    const g = this.runDrag;
    this.runDrag = null;
    if (g?.moved) this.pushHistory(g.base);
  }

  /**
   * A gesture on the wall view was cut short (pointercancel, a second finger): a joint or fitting already dragged
   * keeps its place as one undo step, like the wall view's other drags, and the drag ends (#184; a joint drag left
   * behind used to push its stale base on the next pointer-up).
   */
  endJointDrags(this: Fp3dEditor): void {
    for (const g of [this.fitDrag, this.jointDrag]) if (g?.moved) this.pushHistory(g.base);
    this.fitDrag = null;
    this.jointDrag = null;
  }

  /**
   * A ball valve or sight glass: dragged it slides along its pipe, a tap opens or closes a valve, a double click
   * takes it out.
   */
  fittingDown(this: Fp3dEditor, e: PointerEvent, c: RunCtx, pipeId: string, id: string): void {
    if (this._runMode || !this.isEditor) return;
    e.stopPropagation();
    this._runSel = { pipe: pipeId, pt: null };
    if (this.doubleTap(e, `fitting:${id}`)) {
      this.changePool(c.pool.id, (l) => {
        const q = l.pipes?.find((x) => x.id === pipeId);
        if (q?.fittings) q.fittings = q.fittings.filter((x) => x.id !== id);
      });
      return;
    }
    this.fitDrag = { pipe: pipeId, id, base: this._doc, moved: false, x: e.clientX, y: e.clientY };
    (e.currentTarget as Element).closest("svg")?.setPointerCapture(e.pointerId);
  }

  jointDown(this: Fp3dEditor, e: PointerEvent, id: string, d: number): void {
    if (this._runMode || !this.isEditor) return;
    e.stopPropagation();
    this.jointDrag = { id, d, base: this._doc, moved: false };
    (e.currentTarget as Element).closest("svg")?.setPointerCapture(e.pointerId);
  }

  jointMove(this: Fp3dEditor, e: PointerEvent, c: RunCtx): void {
    const g = this.jointDrag;
    if (!g) return;
    g.moved = true;
    const { s, y } = c.pt(e);
    const ss = e.altKey ? s : Math.round(s * 100) / 100;
    const yy = e.altKey ? y : Math.round(y * 100) / 100;
    this.change(
      (_, floor) => {
        const j = floor.outdoor.find((o) => o.id === c.pool.id)?.pool?.joints?.find((x) => x.id === g.id);
        if (!j) return;
        [j.x, j.z] = onWallXZ(c.frame, ss, g.d);
        if (j.kind !== "floor") j.y = Math.max(j.kind === "wall" ? 0.05 : -1, round(yy));
      },
      g.base,
      false,
    );
  }

  fittingMove(this: Fp3dEditor, e: PointerEvent, c: RunCtx): void {
    const g = this.fitDrag;
    if (!g || (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 4)) return;
    g.moved = true;
    const { s, y } = c.pt(e);
    const run = c.runs.find((r) => r.id === g.pipe);
    if (!run) return;
    // the nearest point of the pipe's pieces on this wall
    let best: { p: P3; d: number } | null = null;
    for (const pc of run.pieces) {
      const [vs, vy] = [pc.s1 - pc.s0, pc.y1 - pc.y0];
      const l2 = vs * vs + vy * vy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((s - pc.s0) * vs + (y - pc.y0) * vy) / l2)) : 0;
      const [qs, qy] = [pc.s0 + vs * t, pc.y0 + vy * t];
      const d = Math.hypot(qs - s, qy - y);
      if (!best || d < best.d) best = { p: onWall(c.frame, qs, qy, pc.d0 + (pc.d1 - pc.d0) * t), d };
    }
    if (!best) return;
    const nodeAt = poolNodeAt(g.base, c.floor, c.pool);
    const at = best.p;
    this.change(
      (_, floor) => {
        const q = floor.outdoor.find((o) => o.id === c.pool.id)?.pool?.pipes?.find((x) => x.id === g.pipe);
        const f = q?.fittings?.find((x) => x.id === g.id);
        const h = q && nearestOnPath(pipePath(q, nodeAt), at);
        if (f && h) f.at = round(h.at);
      },
      g.base,
      false,
    );
  }

  fittingUp(this: Fp3dEditor, c: RunCtx | null): void {
    const g = this.fitDrag;
    this.fitDrag = null;
    if (!g) return;
    if (g.moved) return this.pushHistory(g.base);
    if (!c) return;
    // a tap: a ball valve opens or closes
    this.changePool(c.pool.id, (l) => {
      const f = l.pipes?.find((x) => x.id === g.pipe)?.fittings?.find((x) => x.id === g.id);
      if (f?.kind === "valve") f.open = f.open === false;
    });
  }

  /**
   * The side bar's ball valve or sight glass: on the chosen pipe it appears at once in the middle of the part on
   * this wall (then dragged along it); without a chosen pipe the next tap on a pipe places it.
   */
  kitFitting(this: Fp3dEditor, c: RunCtx | null, kind: "valve" | "sight"): void {
    this._runDraft = null;
    const run = c && this._runSel ? c.runs.find((r) => r.id === this._runSel!.pipe) : undefined;
    if (!c || !run || !run.pieces.length) {
      this._runMode = this._runMode === kind ? null : kind;
      return;
    }
    // the middle of the pipe's longest piece on this wall
    const pc = [...run.pieces].sort((a, b) => Math.hypot(b.s1 - b.s0, b.y1 - b.y0) - Math.hypot(a.s1 - a.s0, a.y1 - a.y0))[0];
    this.addFitting(c, run.id, onWall(c.frame, (pc.s0 + pc.s1) / 2, (pc.y0 + pc.y1) / 2, (pc.d0 + pc.d1) / 2), kind);
    this._runMode = null;
  }

  /** The pipes on the wall shown (front view): grey pipes, the chosen one with its points, valves, the pipe being laid. */
  renderRuns(this: Fp3dEditor, c: RunCtx, X: (s: number) => number, Y: (y: number) => number) {
    const sel = this._runSel?.pipe;
    const toView = (q: P3) => {
      const w = toWall(c.frame, [q[0], q[2]]);
      return `${X(w.s)},${Y(q[1])}`;
    };
    const d = this._runDraft;
    const last = d && this.runLast(d, c);
    const draft = d ? [...(d.fromT || d.extend || d.from ? [this.runLast({ ...d, pts: [] }, c)] : []), ...d.pts].filter((q): q is P3 => !!q) : [];
    const hover = this.runHover;
    // pool devices up to 1.5 m in front of the wall: where their pipes join (a pump in the middle of the room too)
    const nodeAt = poolNodeAt(this._doc, c.floor, c.pool);
    const letter: Record<string, string> = { pool_pump: "P", pool_filter: "F", pool_heat_pump: "W", pool_dosing: "D", pool_valve: "K" };
    // the labels of connections close together (the three on a filter's valve head) would run into each other: they
    // show one above the other, and only when zoomed in enough to read them
    const placed: { s: number; y: number }[] = [];
    const marker = (node: string, text: string, cls = "", joint?: string) => {
      const q = nodeAt(node);
      const w = q && toWall(c.frame, [q.x, q.z]);
      if (!(q && w && w.d > -0.6 && w.d < 1.6 && w.s > -0.2 && w.s < c.L + 0.2)) return [];
      const near = placed.filter((p) => Math.hypot(p.s - w.s, p.y - q.y) < 0.3 * this.wvScale).length;
      placed.push({ s: w.s, y: q.y });
      const label = near && this.wvScale > 0.5 ? "" : text;
      return [
        svg`<g class="fp3d-wv-node ${cls} ${joint ? "fp3d-wv-joint" : ""}" transform="translate(${X(w.s)} ${Y(q.y)}) scale(${this.wvScale})" @pointerdown=${(e: PointerEvent) => joint && this.jointDown(e, joint, w.d)}>
            <circle r="0.05" /><text y=${0.11 + near * 0.07}>${label}</text><title>${this.poolNodeLabel(c.pool, node)}</title>
          </g>`,
      ];
    };
    const nodes = [
      ...c.floor.furniture.flatMap((f) => {
        if (letter[f.type] === undefined) return [];
        const ports = devicePorts(f.type);
        return ports.length ? ports.flatMap((q) => marker(`dev:${f.id}:${q}`, this.t(`port_${q}` as I18nKey))) : marker(`dev:${f.id}`, letter[f.type]);
      }),
      ...(c.pool.pool?.joints ?? []).flatMap((j) =>
        j.kind === "wall" || j.kind === "floor" ? marker(`joint:${j.id}:inside`, this.jointLabel(c.pool, j.id), "fp3d-wv-hole-mark", j.id) : marker(`joint:${j.id}`, this.jointLabel(c.pool, j.id), "", j.id),
      ),
    ];
    // drawing the technical room: the water flows in the drawing as if the pump ran (blue, warm after a heating heat
    // pump, brown to the waste drain); a pipe it does not reach stays grey
    const rules = this.pipeRules;
    const wet =
      this._techMode && rules
        ? rules.flow({
            pipes: c.pool.pool?.pipes ?? [],
            ports: c.pool.pool?.ports ?? [],
            devices: this._doc.floors.flatMap((f) => f.furniture).filter((f) => (POOL_DEVICES as readonly string[]).includes(f.type)).map((f) => ({ id: f.id, type: f.type, open: f.valve_open !== false, valve: f.valve_position ?? null })),
            pumpOn: true,
            heaterOn: false,
            heating: false,
          })
        : null;
    const wetStyle = (id: string) => {
      const f = wet?.get(id);
      if (!f?.active || !rules) return "";
      const [r, g, b] = rules.waterColor(f).map((v) => Math.round(v * 255));
      return `stroke: rgb(${r}, ${g}, ${b}); stroke-opacity: 0.95`;
    };
    return svg`<g class="fp3d-wv-runs">
      ${nodes}
      ${c.runs.map(
        (r) => svg`<g class="fp3d-wv-run ${r.id === sel ? "fp3d-wv-run-sel" : ""} ${wet && !wet.get(r.id)?.active ? "fp3d-wv-dry" : ""}">
          ${r.pieces.map((pc) => svg`<line class=${pc.y0 < -0.01 && pc.y1 < -0.01 ? "fp3d-wv-under" : ""} style=${wetStyle(r.id)} x1=${X(pc.s0)} y1=${Y(pc.y0)} x2=${X(pc.s1)} y2=${Y(pc.y1)} @pointerdown=${(e: PointerEvent) => this.runPieceDown(e, c, r, pc.k)} />`)}
          ${r.ends.map((e) => svg`<circle class="fp3d-wv-end" cx=${X(e.s)} cy=${Y(e.y)} r="0.035" />`)}
          ${r.fittings.map((f) =>
            f.kind === "valve"
              ? svg`<g class="fp3d-wv-valve ${f.open ? "" : "fp3d-wv-shut"}" transform="translate(${X(f.s)} ${Y(f.y)}) scale(${this.wvScale})" @pointerdown=${(e: PointerEvent) => this.fittingDown(e, c, r.id, f.id)}>
                  <circle r="0.05" /><line x1="0" y1="0" x2=${f.open ? 0.11 : 0} y2=${f.open ? 0 : -0.11} />
                </g>`
              : svg`<rect class="fp3d-wv-sight" x=${X(f.s) - 0.06} y=${Y(f.y) - 0.035} width="0.12" height="0.07" rx="0.02" @pointerdown=${(e: PointerEvent) => this.fittingDown(e, c, r.id, f.id)} />`,
          )}
          ${r.id === sel ? r.points.map((q) => svg`<circle class="fp3d-wv-runpt ${this._runSel?.pt === q.i ? "fp3d-on" : ""}" cx=${X(q.s)} cy=${Y(q.y)} r="0.04" @pointerdown=${(e: PointerEvent) => this.runPointDown(e, c, r.id, q.i)} />`) : nothing}
        </g>`,
      )}
      ${draft.length ? svg`<polyline class="fp3d-wv-draft" points=${draft.map(toView).join(" ")} />` : nothing}
      ${this.techStroke && this.techStroke.length > 1 ? svg`<polyline class="fp3d-wv-draft fp3d-wv-stroke" points=${this.techStroke.map((p) => `${X(p.s)},${Y(p.y)}`).join(" ")} />` : nothing}
      ${last && hover ? svg`<line class="fp3d-wv-draft fp3d-wv-rubber" x1=${toView(last).split(",")[0]} y1=${toView(last).split(",")[1]} x2=${X(hover[0])} y2=${Y(hover[1])} />` : nothing}
    </g>`;
  }

  /** The bottom bar of the wall view while laying a pipe, placing a fitting or with a pipe chosen. */
  renderRunFoot(this: Fp3dEditor, c: RunCtx) {
    const mode = this._runMode;
    const d = this._runDraft;
    if (mode === "hole_wall" || mode === "hole_floor" || mode === "tee" || mode === "y")
      return html`<span class="fp3d-muted">${this.t("wall_run_place")}</span>
        <button class="fp3d-btn" @click=${() => (this._runMode = null)}>${this.t("cancel")}</button>`;
    if (mode === "valve" || mode === "sight")
      return html`<span class="fp3d-muted">${this.t("wall_run_fit")}</span>
        <button class="fp3d-btn" @click=${() => (this._runMode = null)}>${this.t("cancel")}</button>`;
    if (mode === "draw")
      return html`<span class="fp3d-muted">${this.t(d ? "wall_run_next" : "wall_run_start")}</span>
        ${d
          ? html`<button class="fp3d-btn" @click=${() => this.runOut(c, "down")}>${this.t("wall_run_down")}</button>
              <button class="fp3d-btn" @click=${() => this.runOut(c, "through")}>${this.t("wall_run_through")}</button>
              <button class="fp3d-btn fp3d-primary" @click=${() => this.finishRun("", null)}>${this.t("wall_run_done")}</button>`
          : nothing}
        <button class="fp3d-btn" @click=${() => {
          this._runDraft = null;
          this._runMode = null;
        }}>${this.t("cancel")}</button>`;
    const sel = this._runSel;
    const q = sel && c.pool.pool?.pipes?.find((x) => x.id === sel.pipe);
    if (!sel || !q) return nothing;
    const nodeAt = poolNodeAt(this._doc, c.floor, c.pool);
    const laid = laidPipe(q, nodeAt);
    const pt = sel.pt;
    const admin = this.isEditor;
    const loose: "from" | "to" | null = !q.to ? "to" : !q.from ? "from" : null;
    return html`<b>${this.t("wall_run_pipe")}</b>
      ${pt !== null && laid.heights?.[pt] !== undefined
        ? this.len(this.t("wall_run_pt"), laid.heights[pt] ?? 0, (v) =>
            this.changePool(c.pool.id, (l) => {
              const x = l.pipes?.find((y) => y.id === q.id);
              if (!x) return;
              Object.assign(x, laidPipe(x, nodeAt));
              x.heights![pt] = Math.min(10, Math.max(-5, round(v)));
            }),
          0.01,
        )
        : nothing}
      ${admin
        ? html`<button class="fp3d-btn" @click=${() => this.kitFitting(c, "valve")}>${this.t("wall_run_valve")}</button>
            <button class="fp3d-btn" @click=${() => this.kitFitting(c, "sight")}>${this.t("wall_run_sight")}</button>
            ${loose
              ? html`<button class="fp3d-btn" @click=${() => {
                  this._runMode = "draw";
                  const draft: RunDraft = { pool: c.pool.id, from: "", fromT: null, extend: { pipe: q.id, end: loose }, pts: [], anchor: null, wall: c.key, d: c.gap };
                  this._runDraft = { ...draft, anchor: this.runLast(draft, c) };
                }}>${this.t("wall_run_more")}</button>`
              : nothing}
            <button class="fp3d-btn" title=${this.t("pool_pipe_reverse")} @click=${() =>
              this.changePool(c.pool.id, (l) => {
                const x = l.pipes?.find((y) => y.id === q.id);
                if (!x) return;
                Object.assign(x, laidPipe(x, nodeAt));
                [x.from, x.to, x.points, x.heights] = [x.to, x.from, [...x.points].reverse(), [...(x.heights ?? [])].reverse()];
                x.fittings = x.fittings?.map((f) => ({ ...f, at: round(Math.max(0, pathLengthOf(x, nodeAt) - f.at)) }));
              })}>⇄</button>
            <button class="fp3d-btn fp3d-danger" @click=${() => {
              this.changePool(c.pool.id, (l) => (l.pipes = (l.pipes ?? []).filter((y) => y.id !== q.id)));
              this._runSel = null;
            }}>${this.t("delete")}</button>`
        : nothing}
      <span class="fp3d-muted">${this.t("wall_run_tip")}</span>`;
  }
}
