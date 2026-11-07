// The pool tool (pool module): pipes, ports, devices and joints on the plan, the part cards with their connections,
// and the pool panel, tech and shape forms.

import { html, nothing, svg } from "lit";
import { unitLabel } from "../../units.ts";
import { modalFocus } from "../../dialog-focus.ts";
import { pipePath, type P3 } from "../../geometry/runs.ts";
import { connectionsAt, laidPipe, nearestOnOutline, planConnection, poolNodeAt, splitPipe, type Connection, type ConnectVia } from "../../pool-runs.ts";
import { devicePorts, FILTER_VALVES, jointPorts, nodePart, poolPortFlow, portFlow, splitNode } from "../../pool-ports.ts";
import { poolDepth, poolSunken, poolHeight, poolShapePoints, POOL_DEVICES, VALVE_POSITIONS, type PoolLinks, type PoolPipe, type PoolPort, type PoolJoint, type ValvePosition } from "../../model.ts";
import { type I18nKey } from "../../i18n.ts";
import { bounds, centroid, pointInPolygon, uid, type Floor, type Furniture, type OutdoorArea, type Vec2 } from "../../model.ts";
import { round, pathLengthOf } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** PoolPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class PoolPart {
  /**
   * A press in the pool tool: drawing a pipe (nodes and corner points), dragging pipe points, ports and devices,
   * tapping a ball valve, resizing or moving the pool. False when nothing was hit: then a new pool is drawn.
   */
  poolDown(this: Fp3dEditor, e: PointerEvent, target: Element, world: Vec2, local: Vec2): boolean {
    const floor = this.floor;
    if (!floor) return false;
    const a = this.poolArea;
    const node = target.closest("[data-pool-node]")?.getAttribute("data-pool-node") ?? null;
    if (this._jointPlace && a) {
      if (this.isEditor) this.placeJointPlan(a, this._jointPlace, world, target.closest("[data-pipe]")?.getAttribute("data-pipe") ?? null);
      this._jointPlace = null;
      return true;
    }
    if (this._pipeMode) {
      if (!this.isEditor) return true;
      if (!a) {
        // several pools and none chosen: a tap on one chooses it for the pipes
        const hit = floor.outdoor.find((o) => o.type === "pool" && o.points.length >= 3 && pointInPolygon(world, o.points));
        if (hit) {
          this.selectItem("outdoor", hit.id);
          // choosing it keeps the pool tool and the pipe drawing on
          this._tool = "pool";
          this._pipeMode = true;
        }
        return true;
      }
      const end = target.closest("[data-pipe-end]")?.getAttribute("data-pipe-end");
      if (end && !this._pipeDraft) {
        // on from a loose end: the pipe goes on from there
        const [pipe, which] = end.split("|");
        const q = a.pool?.pipes?.find((x) => x.id === pipe);
        const at = q && (which === "to" ? q.points[q.points.length - 1] : q.points[0]);
        if (at) this._pipeDraft = { from: "", points: [], extend: { pipe, end: which as "from" | "to", at } };
      } else if (node) {
        const d = this._pipeDraft;
        if (!d) this._pipeDraft = { from: node, points: [] };
        else if (d.extend) {
          this.extendPipe(a, d.extend, node, d.points);
          this._pipeDraft = null;
        } else if (node !== d.from) {
          this.addPipe(a.id, d.from, node, d.points);
          this._pipeDraft = null;
        }
      } else if (this._pipeDraft) {
        const q = this.snap(world, undefined, e.altKey);
        this._pipeDraft = { ...this._pipeDraft, points: [...this._pipeDraft.points, [round(q[0]), round(q[1])]] };
      }
      return true;
    }
    const split = (v: string): [string, number] => [v.slice(0, v.lastIndexOf(":")), Number(v.slice(v.lastIndexOf(":") + 1))];
    if (a && this.isEditor) {
      const pt = target.closest("[data-pipe-pt]")?.getAttribute("data-pipe-pt");
      if (pt) {
        const [pipe, i] = split(pt);
        // a double click takes the corner point out
        if (this.doubleTap(e, `pipept:${pt}`))
          this.change((_, f) => {
            const q = f.outdoor.find((x) => x.id === a.id)?.pool?.pipes?.find((x) => x.id === pipe);
            q?.points.splice(i, 1);
            q?.heights?.splice(i, 1);
          });
        else this.drag = { kind: "pipept", pool: a.id, pipe, index: i, base: this._doc, moved: false };
        return true;
      }
      const seg = target.closest("[data-pipe-seg]")?.getAttribute("data-pipe-seg");
      if (seg) {
        // grabbing a pipe between its points adds a corner point there
        const [pipe, i] = split(seg);
        const q = this.snap(world, undefined, e.altKey);
        this.change((_, f) => {
          const x = f.outdoor.find((o) => o.id === a.id)?.pool?.pipes?.find((o) => o.id === pipe);
          x?.points.splice(i, 0, [round(q[0]), round(q[1])]);
          // a laid pipe: the new point at the height of the one before it
          x?.heights?.splice(i, 0, x.heights[i - 1] ?? x.heights[i] ?? null);
        });
        this._pipeId = pipe;
        this.drag = { kind: "pipept", pool: a.id, pipe, index: i, base: this._doc, moved: false };
        return true;
      }
    }
    const pipeEl = target.closest("[data-pipe]")?.getAttribute("data-pipe");
    if (pipeEl) {
      this._pipeId = pipeEl;
      return true;
    }
    if (node && a && this.isEditor) {
      if (node.startsWith("port:")) this.drag = { kind: "poolport", pool: a.id, id: node.slice(5), base: this._doc, moved: false };
      else if (node.startsWith("joint:")) this.drag = { kind: "pooljoint", pool: a.id, id: splitNode(node).id, start: world, base: this._doc, moved: false };
      else this.drag = { kind: "pooldev", id: node.slice(4), start: world, base: this._doc, moved: false };
      return true;
    }
    if (this.isEditor) {
      const box = target.closest("[data-out-box]")?.getAttribute("data-out-box");
      if (box) {
        const [id, c] = split(box);
        this.drag = { kind: "outbox", id, corner: c, base: this._doc, moved: false };
        return true;
      }
      const vx = target.closest("[data-out-vertex]")?.getAttribute("data-out-vertex");
      if (vx) {
        const [id, i] = split(vx);
        this.drag = { kind: "outvertex", id, index: i, base: this._doc, moved: false };
        return true;
      }
    }
    // the smallest area under the point: a pool inside a lawn is still the pool
    const out = target.closest("[data-outdoor]") ? (this.outdoorAt(world) ?? target.closest("[data-outdoor]")!.getAttribute("data-outdoor")) : null;
    if (out && floor.outdoor.some((x) => x.id === out && x.type === "pool")) {
      this.selectItem("outdoor", out);
      this._pipeId = null;
      if (this.isEditor) this.drag = { kind: "outdoor", id: out, start: world, startScreen: local, base: this._doc, moved: false };
      return true;
    }
    this._pipeId = null;
    return false;
  }

  /** Changes the links of a pool on this floor (with history). */
  changePool(this: Fp3dEditor, id: string, fn: (links: PoolLinks, area: OutdoorArea) => void): void {
    this.change((_, floor) => {
      const area = floor.outdoor.find((x) => x.id === id);
      if (!area) return;
      area.pool ??= {};
      fn(area.pool, area);
    });
  }

  /** A loose pipe end drawn on in the plan to a node (its new points run at the pipe's height). */
  extendPipe(this: Fp3dEditor, a: OutdoorArea, ext: { pipe: string; end: "from" | "to" }, node: string, points: Vec2[]): void {
    const floor = this.floor;
    if (!floor) return;
    const nodeAt = poolNodeAt(this._doc, floor, a);
    node = this.jointEnd(a, node, points[points.length - 1]);
    this.changePool(a.id, (l) => {
      const q = l.pipes?.find((x) => x.id === ext.pipe);
      if (!q) return;
      Object.assign(q, laidPipe(q, nodeAt));
      const hs = q.heights ?? [];
      if (ext.end === "to") {
        // the new points run at the height of the loose end (down in the floor: under the ground)
        const h = hs[hs.length - 1] ?? q.height ?? null;
        q.points = [...q.points, ...points];
        q.heights = [...hs, ...points.map(() => h)];
        q.to = node;
      } else {
        // drawn outward from the loose start: the water now comes from the node; valves keep their place
        const before = pathLengthOf(q, nodeAt);
        const h = hs[0] ?? q.height ?? null;
        q.points = [...[...points].reverse(), ...q.points];
        q.heights = [...points.map(() => h), ...hs];
        q.from = node;
        const shift = pathLengthOf(q, nodeAt) - before;
        q.fittings = q.fittings?.map((f) => ({ ...f, at: round(f.at + shift) }));
      }
    });
    this._pipeId = ext.pipe;
  }

  /** A joint without its connection: the next free one of a T- or Y-piece; at a hole the side nearer `near`. */
  jointEnd(this: Fp3dEditor, a: OutdoorArea, node: string, near: Vec2 | undefined, taken: string[] = []): string {
    const { kind, id, port } = splitNode(node);
    const j = kind === "joint" && !port ? a.pool?.joints?.find((x) => x.id === id) : undefined;
    if (!j) return node;
    if (j.kind === "wall" || j.kind === "floor") {
      const floor = this._doc.floors.find((f) => f.outdoor.some((o) => o.id === a.id));
      const at = floor && poolNodeAt(this._doc, floor, a);
      const [i, o] = [at?.(`joint:${id}:inside`), at?.(`joint:${id}:outside`)];
      if (!near || !i || !o) return `joint:${id}:inside`;
      return `joint:${id}:${Math.hypot(near[0] - i.x, near[1] - i.z) <= Math.hypot(near[0] - o.x, near[1] - o.z) ? "inside" : "outside"}`;
    }
    const used = new Set([...(a.pool?.pipes ?? []).flatMap((p) => [p.from, p.to]), ...taken]);
    const q = jointPorts(j.kind).find((x) => !used.has(`joint:${id}:${x}`));
    return q ? `joint:${id}:${q}` : node;
  }

  addPipe(this: Fp3dEditor, poolId: string, from: string, to: string, points: Vec2[]): void {
    const floor = this.floor;
    if (!floor) return;
    const a = floor.outdoor.find((o) => o.id === poolId);
    if (a) {
      from = this.jointEnd(a, from, points[0]);
      to = this.jointEnd(a, to, points[points.length - 1], [from]);
    }
    const pipe: PoolPipe = { id: uid("pipe"), from, to, floor_id: floor.id, points };
    this.changePool(poolId, (l) => (l.pipes = [...(l.pipes ?? []), pipe]));
    this._pipeId = pipe.id;
  }

  /** A port on the pool: skimmer and inlets on the rim (spread over its sides), the drain in the middle, the waste drain beside the technical room. */
  addPoolPort(this: Fp3dEditor, kind: PoolPort["kind"]): void {
    const a = this.poolArea;
    if (!a || !this.isEditor) return;
    const ports = a.pool?.ports ?? [];
    const n = a.points.length;
    const mid = (i: number): Vec2 => {
      const p = a.points[i % n];
      const q = a.points[(i + 1) % n];
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    };
    const [cx, cz] = centroid(a.points);
    const dev = this._doc.floors.flatMap((f) => f.furniture).find((m) => m.type === "pool_filter" || m.type === "pool_pump");
    const inlets = ports.filter((p) => p.kind === "inlet").length;
    const at: Vec2 =
      kind === "skimmer"
        ? nearestOnOutline(a.points, mid(0))
        : kind === "inlet"
          ? nearestOnOutline(a.points, mid(Math.floor(n / 2) + inlets * Math.max(1, Math.floor(n / 8))))
          : kind === "drain"
            ? [cx, cz]
            : dev
              ? [dev.x + 0.8, dev.z]
              : [cx, cz + 3];
    const port: PoolPort = { id: uid("port"), kind, x: round(at[0]), z: round(at[1]) };
    this.changePool(a.id, (l) => (l.ports = [...ports, port]));
  }

  /** A device of the technical room, placed like the energy devices (garage or technical room, against a wall). */
  addPoolDevice(this: Fp3dEditor, type: string): void {
    const a = this.poolArea;
    this.addEnergyDevice(type);
    // the pool stays selected in its tool
    if (a) this.selectItem("outdoor", a.id);
    this._tool = "pool";
  }

  /** Removes a device and the pipes ending at it. */
  deletePoolDevice(this: Fp3dEditor, id: string): void {
    this.change((d) => {
      for (const f of d.floors) {
        f.furniture = f.furniture.filter((m) => m.id !== id);
        for (const o of f.outdoor) if (o.pool?.pipes) o.pool.pipes = o.pool.pipes.filter((p) => p.from !== `dev:${id}` && p.to !== `dev:${id}`);
      }
    });
  }

  deletePoolPort(this: Fp3dEditor, poolId: string, id: string): void {
    this.changePool(poolId, (l) => {
      l.ports = (l.ports ?? []).filter((p) => p.id !== id);
      l.pipes = (l.pipes ?? []).filter((p) => p.from !== `port:${id}` && p.to !== `port:${id}`);
    });
  }

  togglePoolValve(this: Fp3dEditor, id: string): void {
    const f = this._doc.floors.flatMap((x) => x.furniture).find((m) => m.id === id);
    if (!f || f.type !== "pool_valve" || !this.isEditor) return;
    this.change((d) => {
      const m = d.floors.flatMap((x) => x.furniture).find((q) => q.id === id);
      if (m) m.valve_open = m.valve_open === false ? null : false;
    });
  }

  setPoolDevice(this: Fp3dEditor, id: string, patch: Partial<Furniture>): void {
    this.change((d) => {
      const m = d.floors.flatMap((x) => x.furniture).find((q) => q.id === id);
      if (m) Object.assign(m, patch);
    });
  }

  /**
   * The name of a connection: a T- or Y-piece's are lettered (A, B, C – which way the water runs does not matter),
   * the others say what they are (suction side, return, inside …).
   */
  portText(this: Fp3dEditor, node: string): string {
    const { kind, port } = splitNode(node);
    const letter: Record<string, string> = { in: "A", out1: "B", out2: "C" };
    if (kind === "joint" && port && letter[port]) return `${this.t("card_port")} ${letter[port]}`;
    return port ? this.t(`port_${port}` as I18nKey) : "";
  }

  openCard(this: Fp3dEditor, pool: string, part: string): void {
    this._card = { pool, part };
    this._cardJoin = null;
  }

  /** The connections of a part: its own (pump, filter, heat pump, T/Y, hole) or one (a pool port, a device without any). */
  partPorts(this: Fp3dEditor, a: OutdoorArea, part: string): string[] {
    const { kind, id } = splitNode(part);
    if (kind === "joint") {
      const j = a.pool?.joints?.find((x) => x.id === id);
      return j ? jointPorts(j.kind).map((q) => `${part}:${q}`) : [];
    }
    if (kind === "dev") {
      const f = this._doc.floors.flatMap((x) => x.furniture).find((m) => m.id === id);
      const ports = f ? devicePorts(f.type) : [];
      return ports.length ? ports.map((q) => `${part}:${q}`) : [part];
    }
    return [part];
  }

  /** How many of a part's connections are joined (older pipes at the part as a whole count for one). */
  partStatus(this: Fp3dEditor, a: OutdoorArea, part: string): [number, number] {
    const pipes = a.pool?.pipes ?? [];
    const ports = this.partPorts(a, part);
    return [ports.filter((n) => pipes.some((p) => p.from === n || p.to === n)).length, ports.length];
  }

  /** Joins an open connection of the card's part: to the chosen end, through the chosen holes and fittings. */
  cardConnect(this: Fp3dEditor, a: OutdoorArea, port: string, to: string, vias: ConnectVia[]): void {
    const floor = this._doc.floors.find((f) => f.outdoor.some((o) => o.id === a.id));
    if (!floor || !to) return;
    const nodeAt = poolNodeAt(this._doc, floor, a);
    const ports = a.pool?.ports ?? [];
    // which way the water runs at each end (a T-piece's or hole's connections pass it on)
    const flow = (n: string) => {
      const { kind, id, port: q } = splitNode(n);
      if (kind === "port") return poolPortFlow(ports.find((x) => x.id === id)?.kind ?? "inlet");
      return kind === "dev" ? portFlow(q) : null;
    };
    // a T- or Y-piece chosen as a whole takes its next free connection
    const end = this.jointEnd(a, to, undefined, [port]);
    const made = planConnection({ from: port, vias, to: [end], floorId: floor.id }, nodeAt, a.pool?.joints ?? [], flow, (k) => uid(k));
    this.changePool(a.id, (l) => {
      l.joints = [...(l.joints ?? []), ...made.joints];
      l.pipes = [...(l.pipes ?? []), ...made.pipes];
    });
    this._cardJoin = null;
  }

  /** Takes a connection's pipes out (holes and parts stay). */
  cardDisconnect(this: Fp3dEditor, a: OutdoorArea, c: Connection): void {
    this.changePool(a.id, (l) => (l.pipes = (l.pipes ?? []).filter((p) => !c.pipes.includes(p.id))));
  }

  /** Lays a connection anew along the automatic way (its corner points and fittings' places are lost). */
  cardReroute(this: Fp3dEditor, a: OutdoorArea, c: Connection): void {
    const pipes = a.pool?.pipes ?? [];
    const first = pipes.find((p) => p.id === c.pipes[0]);
    if (!first || !c.other) return;
    // keep the water's direction: the connection is laid from where its water comes
    const forward = first.from === c.start;
    const vias: ConnectVia[] = [...c.holes.map((h) => ({ kind: "hole" as const, joint: h.joint, dir: h.dir })), ...c.fittings.map((k) => ({ kind: k }))];
    const floor = this._doc.floors.find((f) => f.outdoor.some((o) => o.id === a.id));
    if (!floor) return;
    const rest = { ...a, pool: { ...a.pool, pipes: pipes.filter((p) => !c.pipes.includes(p.id)) } };
    const nodeAt = poolNodeAt(this._doc, floor, rest);
    const from = forward ? c.start : c.other;
    const to = forward ? c.other : c.start;
    const viasInOrder = forward ? vias : [...c.holes].reverse().map((h) => ({ kind: "hole" as const, joint: h.joint, dir: h.dir === "in" ? ("out" as const) : ("in" as const) })).concat(c.fittings.map((k) => ({ kind: k })) as never[]);
    const made = planConnection({ from, vias: viasInOrder, to: [to], floorId: floor.id }, nodeAt, a.pool?.joints ?? [], () => null, (k) => uid(k));
    this.changePool(a.id, (l) => {
      l.pipes = [...(l.pipes ?? []).filter((p) => !c.pipes.includes(p.id)), ...made.pipes];
    });
  }

  /** A part's card: its name, a small drawing with its connections, and per connection where it goes or how to join it. */
  renderPartCard(this: Fp3dEditor) {
    const card = this._card;
    const a = card ? this._doc.floors.flatMap((f) => f.outdoor).find((o) => o.id === card.pool) : undefined;
    if (!card || !a) return nothing;
    const admin = this.isEditor;
    const { kind, id } = splitNode(card.part);
    const joint = kind === "joint" ? a.pool?.joints?.find((x) => x.id === id) : undefined;
    const dev = kind === "dev" ? this._doc.floors.flatMap((f) => f.furniture).find((m) => m.id === id) : undefined;
    const port = kind === "port" ? a.pool?.ports?.find((x) => x.id === id) : undefined;
    if (!joint && !dev && !port) return nothing;
    const pipes = a.pool?.pipes ?? [];
    const joints = a.pool?.joints ?? [];
    const ports = this.partPorts(a, card.part);
    const ends = this.poolEnds(a).filter((e) => nodePart(e.node) !== card.part && !e.used);
    const holes = joints.filter((j) => j.kind === "wall" || j.kind === "floor");
    const label = (n: string) => this.poolNodeLabel(a, n);
    const portName = (n: string) => {
      const q = splitNode(n).port;
      return q ? this.portText(n) : this.t("card_port");
    };
    const viaText = (v: ConnectVia) => (v.kind === "hole" ? this.t(v.dir === "in" ? "conn_hole_in" : "conn_hole_out", { name: this.jointLabel(a, v.joint) }) : this.t(v.kind === "valve" ? "wall_run_valve" : "wall_run_sight"));
    const close = () => {
      this._card = null;
      this._cardJoin = null;
    };
    const where = (): Vec2 | null => {
      if (joint) return [joint.x, joint.z];
      if (dev) return [dev.x, dev.z];
      return port ? [port.x, port.z] : null;
    };
    const rows = ports.map((n) => {
      const conns = connectionsAt(pipes, joints, n);
      const join = this._cardJoin?.port === n ? this._cardJoin : null;
      return html`<div class="fp3d-pc-row ${conns.length ? "fp3d-on" : ""}">
        <b>${portName(n)}</b>
        <div class="fp3d-pc-conns">
          ${conns.map(
            (c) => html`<div class="fp3d-pc-conn">
              <div class="fp3d-pc-chain">
                ${[...c.holes.map((h) => viaText({ kind: "hole", joint: h.joint, dir: h.dir })), ...c.fittings.map((k) => viaText({ kind: k }))].map((t) => html`<span class="fp3d-pc-arrow">→</span><span class="fp3d-pc-tile">${t}</span>`)}
                <span class="fp3d-pc-arrow">→</span>
                ${c.other
                  ? html`<button class="fp3d-pc-tile fp3d-pc-end" title=${this.t("card_open_other")} @click=${() => this.openCard(a.id, nodePart(c.other))}>${label(c.other)}</button>`
                  : html`<span class="fp3d-pc-tile fp3d-muted">${this.t("pool_loose_end")}</span>`}
              </div>
              ${admin
                ? html`<span class="fp3d-pc-tools">
                    ${c.other ? html`<button class="fp3d-btn" @click=${() => this.cardReroute(a, c)}>${this.t("card_reroute")}</button>` : nothing}
                    <button class="fp3d-btn fp3d-danger" @click=${() => this.cardDisconnect(a, c)}>${this.t("card_disconnect")}</button>
                  </span>`
                : nothing}
            </div>`,
          )}
          ${admin && (!conns.length || ports.length === 1)
            ? join
              ? this.renderJoinPicker(a, n, join, ends, holes, viaText)
              : html`<button class="fp3d-btn ${conns.length ? "" : "fp3d-pc-open"}" @click=${() => (this._cardJoin = { port: n, to: "", vias: [] })}>+ ${this.t("card_connect_with")}</button>`
            : nothing}
        </div>
      </div>`;
    });
    const [done, all] = this.partStatus(a, card.part);
    const at = where();
    return html`<div class="fp3d-wv-veil fp3d-pc-veil" @click=${(e: Event) => e.target === e.currentTarget && close()}>
      <div class="fp3d-pc" role="dialog" aria-modal="true" tabindex="0" ${modalFocus()} @keydown=${(e: KeyboardEvent) => e.key === "Escape" && close()}>
        <div class="fp3d-wv-head">
          ${joint && admin
            ? html`<input
                class="fp3d-pc-name"
                .value=${joint.name ?? ""}
                placeholder=${this.jointLabel(a, joint.id)}
                title=${this.t("joint_name")}
                @change=${(e: Event) => {
                  const v = (e.target as HTMLInputElement).value.trim().slice(0, 60);
                  this.changePool(a.id, (l) => {
                    const x = l.joints?.find((q) => q.id === joint.id);
                    if (x) x.name = v || null;
                  });
                }}
              />`
            : html`<b class="fp3d-pc-title">${label(card.part)}</b>`}
          <span class="fp3d-muted">${this.t("card_status", { a: done, b: all })}</span>
          <span class="fp3d-wv-grow"></span>
          <button class="fp3d-btn" aria-label=${this.t("close")} title=${this.t("close")} @click=${close}>✕</button>
        </div>
        <div class="fp3d-pc-body">
          ${this.renderPartDrawing(a, card.part, ports)}
          <div class="fp3d-pc-rows">${rows}</div>
        </div>
        <div class="fp3d-wv-foot">
          ${at
            ? html`<button class="fp3d-btn" @click=${() => {
                close();
                this._wallView = null;
                this._tool = "pool";
                this.showPoint(at[0], at[1]);
              }}>${this.t("card_show_plan")}</button>`
            : nothing}
          ${at && !port
            ? html`<button class="fp3d-btn" @click=${() => {
                close();
                this.pickWall(at);
              }}>▦ ${this.t("card_show_wall")}</button>`
            : nothing}
          <span class="fp3d-wv-grow"></span>
          ${admin
            ? html`<button class="fp3d-btn fp3d-danger" @click=${() => {
                close();
                if (dev) this.deletePoolDevice(dev.id);
                else if (port) this.deletePoolPort(a.id, port.id);
                else if (joint)
                  this.changePool(a.id, (l) => {
                    l.joints = (l.joints ?? []).filter((x) => x.id !== joint.id);
                    l.pipes = (l.pipes ?? []).filter((p) => nodePart(p.from) !== card.part && nodePart(p.to) !== card.part);
                  });
              }}>${this.t("delete")}</button>`
            : nothing}
        </div>
      </div>
    </div>`;
  }

  /**
   * Building a new connection like a walk along the pipe: the chain from this connection through the stops chosen
   * so far (holes with their direction, ball valves, sight glasses), and below it the next step to choose – another
   * stop or the end it reaches. With an end chosen, the way is laid.
   */
  renderJoinPicker(this: Fp3dEditor,
    a: OutdoorArea,
    port: string,
    join: { port: string; to: string; vias: ConnectVia[] },
    ends: { node: string; label: string; used: boolean }[],
    holes: PoolJoint[],
    viaText: (v: ConnectVia) => string,
  ) {
    const group = (n: string) => {
      const { kind, id } = splitNode(n);
      if (kind === "port") return "pool";
      if (kind === "dev") return "tech";
      const j = a.pool?.joints?.find((x) => x.id === id);
      return j?.kind === "wall" || j?.kind === "floor" ? "holes" : "joints";
    };
    const groups = (["pool", "tech", "joints"] as const)
      .map((g) => ({ g, items: ends.filter((e) => group(e.node) === g) }))
      .filter((x) => x.items.length);
    const set = (patch: Partial<typeof join>) => (this._cardJoin = { ...join, ...patch });
    const addVia = (v: ConnectVia) => set({ vias: [...join.vias, v] });
    // a hole already passed is not offered again
    const passed = new Set(join.vias.flatMap((v) => (v.kind === "hole" ? [v.joint] : [])));
    return html`<div class="fp3d-pc-join">
      <div class="fp3d-pc-chain">
        <span class="fp3d-pc-tile fp3d-pc-start">${this.poolNodeLabel(a, port)}</span>
        ${join.vias.map(
          (v, i) => html`<span class="fp3d-pc-arrow">→</span
            ><button class="fp3d-pc-tile fp3d-pc-stop" title=${this.t("delete")} @click=${() => set({ vias: join.vias.filter((_, k) => k !== i) })}>${viaText(v)} <i>✕</i></button>`,
        )}
        <span class="fp3d-pc-arrow">→</span>
        ${join.to
          ? html`<button class="fp3d-pc-tile fp3d-pc-end" title=${this.t("delete")} @click=${() => set({ to: "" })}>${this.poolNodeLabel(a, join.to)} <i>✕</i></button>`
          : html`<span class="fp3d-pc-tile fp3d-pc-next">${this.t("card_next")}</span>`}
      </div>
      ${join.to
        ? nothing
        : html`<div class="fp3d-pc-steps">
            ${holes.some((j) => !passed.has(j.id))
              ? html`<div class="fp3d-pc-step">${this.t("card_step_hole")}</div>
                  ${holes
                    .filter((j) => !passed.has(j.id))
                    .map(
                      (j) => html`<div class="fp3d-pc-hole">
                        <span>${this.jointLabel(a, j.id)}</span>
                        <button class="fp3d-pc-pick" @click=${() => addVia({ kind: "hole", joint: j.id, dir: "in" })}>${this.t("card_hole_in")}</button>
                        <button class="fp3d-pc-pick" @click=${() => addVia({ kind: "hole", joint: j.id, dir: "out" })}>${this.t("card_hole_out")}</button>
                      </div>`,
                    )}`
              : nothing}
            <div class="fp3d-pc-step">${this.t("card_step_fit")}</div>
            <div class="fp3d-pc-picks">
              <button class="fp3d-pc-pick" @click=${() => addVia({ kind: "valve" })}>${this.t("wall_run_valve")}</button>
              <button class="fp3d-pc-pick" @click=${() => addVia({ kind: "sight" })}>${this.t("wall_run_sight")}</button>
            </div>
            <div class="fp3d-pc-step">${this.t("card_step_end")}</div>
            ${groups.map(
              ({ g, items }) => html`<div class="fp3d-pc-group">
                <span class="fp3d-pc-glabel">${this.t(`card_group_${g}` as I18nKey)}</span>
                <div class="fp3d-pc-picks">${items.map((e) => html`<button class="fp3d-pc-pick fp3d-pc-target" @click=${() => set({ to: e.node })}>${e.label}</button>`)}</div>
              </div>`,
            )}
          </div>`}
      <span class="fp3d-pc-tools">
        <button class="fp3d-btn fp3d-primary" ?disabled=${!join.to} @click=${() => this.cardConnect(a, port, join.to, join.vias)}>✓ ${this.t("card_lay")}</button>
        <button class="fp3d-btn" @click=${() => (this._cardJoin = null)}>${this.t("cancel")}</button>
      </span>
    </div>`;
  }

  /**
   * A small drawing of a part with its connections as labelled stubs (joined: lit, open: dashed): a T-piece with
   * its entry left and exits right and down, a Y-piece, a hole through a wall, the pump, the filter's valve, the
   * heat pump, a port at the pool.
   */
  renderPartDrawing(this: Fp3dEditor, a: OutdoorArea, part: string, ports: string[]) {
    const pipes = a.pool?.pipes ?? [];
    const on = (n: string) => pipes.some((p) => p.from === n || p.to === n);
    const { kind, id } = splitNode(part);
    const joint = kind === "joint" ? a.pool?.joints?.find((x) => x.id === id) : undefined;
    const dev = kind === "dev" ? this._doc.floors.flatMap((f) => f.furniture).find((m) => m.id === id) : undefined;
    // where each connection's stub ends (drawing 200 x 140)
    const at: Record<string, [number, number]> = {};
    let body: unknown = nothing;
    const t = joint?.kind ?? (dev ? dev.type : "port");
    if (t === "tee") {
      Object.assign(at, { in: [20, 60], out1: [180, 60], out2: [100, 130] });
      body = svg`<path class="fp3d-pc-body-shape" d="M 55 48 H 145 V 72 H 112 V 100 H 88 V 72 H 55 Z" />`;
    } else if (t === "y") {
      Object.assign(at, { in: [20, 70], out1: [180, 25], out2: [180, 115] });
      body = svg`<path class="fp3d-pc-body-shape" d="M 55 58 H 95 L 140 30 L 152 50 L 112 70 L 152 90 L 140 110 L 95 82 H 55 Z" />`;
    } else if (t === "wall" || t === "floor") {
      Object.assign(at, { outside: [20, 70], inside: [180, 70] });
      body = svg`<rect class="fp3d-pc-wall" x="85" y="10" width="30" height="120" /><rect class="fp3d-pc-body-shape" x="70" y="58" width="60" height="24" rx="4" />
        <text class="fp3d-pc-side" x="40" y="22">${this.t("port_outside")}</text><text class="fp3d-pc-side" x="160" y="22">${this.t("port_inside")}</text>`;
    } else if (t === "pool_pump") {
      Object.assign(at, { suction: [20, 95], pressure: [110, 10] });
      body = svg`<rect class="fp3d-pc-body-shape" x="50" y="70" width="70" height="50" rx="8" /><circle class="fp3d-pc-body-shape" cx="140" cy="85" r="30" /><rect class="fp3d-pc-body-shape" x="98" y="40" width="24" height="32" />`;
    } else if (t === "pool_filter") {
      Object.assign(at, { pump: [20, 40], return: [180, 40], waste: [100, 4] });
      body = svg`<ellipse class="fp3d-pc-body-shape" cx="100" cy="95" rx="45" ry="40" /><rect class="fp3d-pc-body-shape" x="70" y="28" width="60" height="26" rx="10" />`;
    } else if (t === "pool_heat_pump") {
      Object.assign(at, { in: [180, 95], out: [180, 45] });
      body = svg`<rect class="fp3d-pc-body-shape" x="30" y="20" width="120" height="100" rx="8" /><circle class="fp3d-pc-fan" cx="80" cy="70" r="32" />`;
    } else {
      at[""] = [180, 70];
      body = svg`<circle class="fp3d-pc-body-shape" cx="80" cy="70" r="40" />`;
    }
    const centre: [number, number] = t === "pool_filter" ? [100, 41] : t === "pool_pump" ? [100, 85] : [100, 70];
    return html`<svg class="fp3d-pc-draw" viewBox="0 0 200 140">
      ${ports.map((n) => {
        const q = splitNode(n).port ?? "";
        const end = at[q] ?? at[""] ?? [180, 70];
        const lit = on(n);
        return svg`<g class="fp3d-pc-stub ${lit ? "fp3d-on" : ""}" @click=${() => this.isEditor && !lit && (this._cardJoin = { port: n, to: "", vias: [] })}>
          <line x1=${centre[0]} y1=${centre[1]} x2=${end[0]} y2=${end[1]} />
          <circle cx=${end[0]} cy=${end[1]} r="7" />
          <title>${q ? this.portText(n) : ""}</title>
        </g>`;
      })}
      ${body}
      ${ports.map((n) => {
        const q = splitNode(n).port;
        const end = at[q ?? ""] ?? [180, 70];
        // labels kept inside the drawing (a stub at the edge gets its name pulled in)
        return q ? svg`<text class="fp3d-pc-label" x=${Math.min(162, Math.max(38, end[0]))} y=${end[1] < 70 ? end[1] + 20 : end[1] - 12}>${this.portText(n)}</text>` : nothing;
      })}
    </svg>`;
  }

  /** "T-piece 1", "Y-piece 1", "Hole 2 (wall)": numbered by kind (holes together). */
  jointLabel(this: Fp3dEditor, a: OutdoorArea, id: string): string {
    const all = a.pool?.joints ?? [];
    const j = all.find((x) => x.id === id);
    // a pipe left at a piece taken out: it ends open
    if (!j) return this.t("pool_loose_end");
    const group = (k: PoolJoint["kind"]) => (k === "wall" || k === "floor" ? "hole" : (k ?? "tee"));
    if (j.name?.trim()) return j.name.trim();
    const same = all.filter((x) => group(x.kind) === group(j.kind));
    return `${this.t(`joint_${j.kind ?? "tee"}` as I18nKey, { n: same.indexOf(j) + 1 })}`;
  }

  /** Every place a pipe can start or end: the pool's ports, each connection of the devices and joints. */
  poolEnds(this: Fp3dEditor, a: OutdoorArea): { node: string; label: string; used: boolean }[] {
    const pipes = a.pool?.pipes ?? [];
    const used = (n: string) => pipes.some((p) => p.from === n || p.to === n);
    const out: { node: string; label: string; used: boolean }[] = [];
    for (const p of a.pool?.ports ?? []) out.push({ node: `port:${p.id}`, label: this.poolNodeLabel(a, `port:${p.id}`), used: false });
    for (const f of this._doc.floors.flatMap((x) => x.furniture).filter((m) => (POOL_DEVICES as readonly string[]).includes(m.type) && m.type !== "pool_valve")) {
      const ports = devicePorts(f.type);
      for (const n of ports.length ? ports.map((q) => `dev:${f.id}:${q}`) : [`dev:${f.id}`]) out.push({ node: n, label: this.poolNodeLabel(a, n), used: ports.length > 0 && used(n) });
    }
    for (const j of a.pool?.joints ?? [])
      for (const q of jointPorts(j.kind)) {
        const n = `joint:${j.id}:${q}`;
        out.push({ node: n, label: this.poolNodeLabel(a, n), used: used(n) });
      }
    return out;
  }

  /**
   * A T- or Y-piece tapped into the plan: on a pipe it is put into the pipe (the pipe is split there), else it
   * stands alone – under the ground outside, at 50 cm in a room – to be joined by pipes.
   */
  placeJointPlan(this: Fp3dEditor, a: OutdoorArea, kind: "tee" | "y", world: Vec2, pipeId: string | null): void {
    const floor = this.floor;
    if (!floor) return;
    const nodeAt = poolNodeAt(this._doc, floor, a);
    const pipe = pipeId ? a.pool?.pipes?.find((p) => p.id === pipeId) : undefined;
    if (pipe) {
      // the point of the pipe nearest the tap (in the plan), at the pipe's height there
      const path = pipePath(pipe, nodeAt);
      let best: { p: P3; d: number } | null = null;
      for (let i = 1; i < path.length; i++) {
        const [u, v] = [path[i - 1], path[i]];
        const [dx, dz] = [v[0] - u[0], v[2] - u[2]];
        const l2 = dx * dx + dz * dz;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((world[0] - u[0]) * dx + (world[1] - u[2]) * dz) / l2)) : 0;
        const q: P3 = [u[0] + dx * t, u[1] + (v[1] - u[1]) * t, u[2] + dz * t];
        const d = Math.hypot(q[0] - world[0], q[2] - world[1]);
        if (!best || d < best.d) best = { p: q, d };
      }
      const cut = best && splitPipe(pipe, nodeAt, best.p, uid("joint"), uid("pipe"));
      if (cut) {
        this.changePool(a.id, (l) => {
          l.joints = [...(l.joints ?? []), { ...cut.joint, kind }];
          // the water comes in at the piece's entry and goes on from its first exit
          l.pipes = (l.pipes ?? []).flatMap((p) => (p.id === pipe.id ? [{ ...cut.first, to: `joint:${cut.joint.id}:in` }, { ...cut.second, from: `joint:${cut.joint.id}:out1` }] : [p]));
        });
        return;
      }
    }
    const inside = floor.rooms.some((r) => r.points.length >= 3 && pointInPolygon(world, r.points));
    const q = this.snap(world);
    this.changePool(a.id, (l) => (l.joints = [...(l.joints ?? []), { id: uid("joint"), kind, x: round(q[0]), z: round(q[1]), y: inside ? 0.5 : -0.3 }]));
  }

  /** Where a node sits in the plan. */
  poolNodePos(this: Fp3dEditor, a: OutdoorArea, node: string): Vec2 | null {
    if (!node) return null;
    const floor = this._doc.floors.find((f) => f.outdoor.some((o) => o.id === a.id));
    if (node.startsWith("joint:") || node.split(":").length > 2) {
      const q = floor && poolNodeAt(this._doc, floor, a)(node);
      return q ? [q.x, q.z] : null;
    }
    if (node.startsWith("port:")) {
      const p = a.pool?.ports?.find((x) => x.id === node.slice(5));
      return p ? [p.x, p.z] : null;
    }
    const f = this._doc.floors.flatMap((x) => x.furniture).find((m) => m.id === node.slice(4));
    return f ? [f.x, f.z] : null;
  }

  /** "Skimmer", "Inlet 2", "Heat pump · suction side", "T-piece 1 · out 2", "Hole 2 · outside" … */
  poolNodeLabel(this: Fp3dEditor, a: OutdoorArea, node: string): string {
    const { kind, id, port } = splitNode(node);
    if (!node) return this.t("pool_loose_end");
    if (port || kind === "joint") {
      const base = kind === "joint" ? this.jointLabel(a, id) : this.poolNodeLabel(a, `${kind}:${id}`);
      return port ? `${base} · ${this.portText(node)}` : base;
    }
    if (node.startsWith("port:")) {
      const ports = a.pool?.ports ?? [];
      const p = ports.find((x) => x.id === node.slice(5));
      if (!p) return "?";
      const same = ports.filter((x) => x.kind === p.kind);
      return `${this.t(`pool_port_${p.kind}` as I18nKey)}${same.length > 1 ? ` ${same.indexOf(p) + 1}` : ""}`;
    }
    const devs = this._doc.floors.flatMap((x) => x.furniture).filter((m) => (POOL_DEVICES as readonly string[]).includes(m.type));
    const f = devs.find((m) => m.id === node.slice(4));
    if (!f) return "?";
    const same = devs.filter((m) => m.type === f.type);
    return `${f.name || this.t(`furn_${f.type}` as I18nKey)}${same.length > 1 && !f.name ? ` ${same.indexOf(f) + 1}` : ""}`;
  }

  /** The pool tool in the plan: pipes with their flow direction, ports, devices, and the pipe being drawn. */
  renderPoolPlan(this: Fp3dEditor, floor: Floor) {
    const a = this.poolArea;
    const devs = floor.furniture.filter((m) => (POOL_DEVICES as readonly string[]).includes(m.type));
    const letter: Record<string, string> = { pool_pump: "P", pool_filter: "F", pool_heat_pump: "W", pool_dosing: "D", pool_valve: "" };
    const pipes = a ? (a.pool?.pipes ?? []).filter((p) => p.floor_id === floor.id) : [];
    const lines = pipes.map((p) => {
      const from = this.poolNodePos(a!, p.from);
      const to = this.poolNodePos(a!, p.to);
      // an older pipe needs both ends; one laid on a wall may end loose
      if ((!from || !to) && !p.heights) return nothing;
      const lead = from ? 1 : 0;
      const pts = [...(from ? [from] : []), ...p.points, ...(to ? [to] : [])].map((q) => this.toScreen(q));
      if (pts.length < 2) return nothing;
      const sel = p.id === this._pipeId;
      // the flow direction: an arrow halfway along the longest piece
      let k = 0;
      for (let i = 1; i < pts.length - 1; i++) if (Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) > Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1])) k = i;
      const [x0, y0] = pts[k];
      const [x1, y1] = pts[k + 1];
      const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
      const line = pts.map((q) => q.join(",")).join(" ");
      return svg`<g data-pipe=${p.id}>
        <polyline class="fp3d-pipe-hit" points=${line} />
        <polyline class="fp3d-pipe ${sel ? "fp3d-pipe-sel" : ""}" points=${line} />
        <path class="fp3d-pipe-arrow" d="M -6 -5 L 5 0 L -6 5 Z" transform=${`translate(${(x0 + x1) / 2} ${(y0 + y1) / 2}) rotate(${ang})`} />
        ${sel && this.isEditor
          ? svg`${pts.slice(0, -1).map((q, i) => svg`<line class="fp3d-pipe-seg" data-pipe-seg=${`${p.id}:${i + 1 - lead}`} x1=${q[0]} y1=${q[1]} x2=${pts[i + 1][0]} y2=${pts[i + 1][1]} />`)}
              ${p.points.map((q, i) => {
                const [x, y] = this.toScreen(q);
                return svg`<g class="fp3d-vertex" data-pipe-pt=${`${p.id}:${i}`}><circle cx=${x} cy=${y} r="14" class="fp3d-hit" /><circle cx=${x} cy=${y} r="5" /></g>`;
              })}`
          : nothing}
      </g>`;
    });
    const node = (id: string, at: Vec2, label: string, cls: string, title: string) => {
      const [x, y] = this.toScreen(at);
      return svg`<g class="fp3d-pool-node ${cls}" data-pool-node=${id}><title>${title}</title><circle cx=${x} cy=${y} r="16" class="fp3d-hit" /><circle cx=${x} cy=${y} r="10" /><text x=${x} y=${y}>${label}</text></g>`;
    };
    const ports = a ? (a.pool?.ports ?? []).map((p) => node(`port:${p.id}`, [p.x, p.z], { skimmer: "S", drain: "B", inlet: "E", waste: "A" }[p.kind], `fp3d-pool-port-${p.kind}`, this.poolNodeLabel(a, `port:${p.id}`))) : [];
    const devices = devs.map((f) => node(`dev:${f.id}`, [f.x, f.z], f.type === "pool_valve" ? (f.valve_open === false ? "✕" : "") : letter[f.type], `fp3d-pool-dev ${f.type === "pool_valve" && f.valve_open === false ? "fp3d-pool-closed" : ""}`, a ? this.poolNodeLabel(a, `dev:${f.id}`) : f.type));
    let draft: unknown = nothing;
    if (a && this._pipeDraft) {
      const from = this._pipeDraft.extend?.at ?? this.poolNodePos(a, this._pipeDraft.from);
      if (from) {
        const pts = [from, ...this._pipeDraft.points, ...(this._cursor ? [this._cursor] : [])].map((q) => this.toScreen(q).join(",")).join(" ");
        draft = svg`<polyline class="fp3d-pipe fp3d-pipe-draft" points=${pts} />`;
      }
    }
    // T- and Y-pieces and holes: dragged in the plan, pipes drawn from and to them
    const joints = a ? (a.pool?.joints ?? []).map((j) => node(`joint:${j.id}`, [j.x, j.z], j.kind === "wall" || j.kind === "floor" ? "◎" : j.kind === "y" ? "Y" : "T", "fp3d-pool-jointnode", this.jointLabel(a, j.id))) : [];
    // loose ends of pipes laid on walls: in the pipe drawing a tap goes on from there
    const ends = pipes.flatMap((p) =>
      p.heights && p.points.length
        ? (["from", "to"] as const)
            .filter((k) => !p[k])
            .map((k) => {
              const [x, y] = this.toScreen(k === "to" ? p.points[p.points.length - 1] : p.points[0]);
              return svg`<g class="fp3d-pipe-end" data-pipe-end=${`${p.id}|${k}`}><circle cx=${x} cy=${y} r="14" class="fp3d-hit" /><circle cx=${x} cy=${y} r="6" /></g>`;
            })
        : [],
    );
    return svg`<g class="fp3d-pool-plan">${lines}${draft}${joints}${ends}${ports}${devices}</g>`;
  }

  /** The pool tool's sidebar: the pool's form, its ports, the technical room's devices and the pipes. */
  renderPoolPanel(this: Fp3dEditor, floor: Floor | undefined) {
    const pools = floor?.outdoor.filter((x) => x.type === "pool") ?? [];
    const a = this.poolArea;
    if (!a)
      return html`<section>
        <h3>🏊 ${this.t("tool_pool")}</h3>
        <p class="fp3d-sub">${this.t(pools.length ? "pool_choose" : "pool_tool_empty")}</p>
        ${pools.length
          ? html`<div class="fp3d-actions">${pools.map((p, i) => html`<button class="fp3d-btn" @click=${() => this.selectItem("outdoor", p.id)}>🏊 ${this.t("out_pool")} ${pools.length > 1 ? i + 1 : ""}</button>`)}</div>`
          : nothing}
      </section>`;
    return html`${pools.length > 1
        ? html`<section>
            <div class="fp3d-seg">${pools.map((p, i) => html`<button aria-pressed=${p.id === a.id} @click=${() => this.selectItem("outdoor", p.id)}>🏊 ${i + 1}</button>`)}</div>
          </section>`
        : nothing}
      ${this.renderPoolTech(a)} ${this.renderOutdoorForm(a)}`;
  }

  renderPoolTech(this: Fp3dEditor, a: OutdoorArea) {
    // pool equipment, ports and pipes: only with a module that knows pipes (pool module)
    if (!this.pipeRules) return nothing;
    const admin = this.isEditor;
    const ports = a.pool?.ports ?? [];
    const pipes = a.pool?.pipes ?? [];
    const devs = this._doc.floors.flatMap((f) => f.furniture).filter((m) => (POOL_DEVICES as readonly string[]).includes(m.type));
    const pipe = pipes.find((p) => p.id === this._pipeId);
    return html`<section>
        <button class="fp3d-btn fp3d-primary fp3d-wide" ?disabled=${!admin} title=${this.t("tech_open_hint")} @click=${() => {
          this.techPick = true;
          this._wallPick = true;
        }}>🛠 ${this.t("tech_open")}</button>
        <p class="fp3d-sub">${this.t("tech_open_hint")}</p>
      </section>
      <section>
        <h3>${this.t("pool_ports")}</h3>
        <div class="fp3d-actions">
          ${(["skimmer", "drain", "inlet", "waste"] as const).map((k) => html`<button class="fp3d-btn" ?disabled=${!admin} @click=${() => this.addPoolPort(k)}>+ ${this.t(`pool_port_${k}` as I18nKey)}</button>`)}
        </div>
        ${ports.map(
          (p) => html`<div class="fp3d-pool-row">
            <button class="fp3d-link" title=${this.t("card_open")} @click=${() => this.openCard(a.id, `port:${p.id}`)}>${this.poolNodeLabel(a, `port:${p.id}`)}</button>
            <span class="fp3d-muted">${this.partStatus(a, `port:${p.id}`)[0] ? "✓" : "○"}</span>
            ${p.kind === "inlet" || p.kind === "skimmer"
              ? html`<label class="fp3d-pool-depth" title=${unitLabel(this.t("pool_port_depth_hint"), this.unit)}
                  >${this.t("pool_port_depth")}
                  <input type="number" step="0.05" min="0" max="3" .value=${String(p.depth ?? (p.kind === "inlet" ? 0.3 : 0))} ?disabled=${!admin} @change=${(e: Event) => {
                    const v = Number((e.target as HTMLInputElement).value.replace(",", "."));
                    if (!Number.isFinite(v)) return;
                    this.change((_, floor) => {
                      const q = floor.outdoor.find((o) => o.id === a.id)?.pool?.ports?.find((x) => x.id === p.id);
                      if (q) q.depth = Math.min(3, Math.max(0, round(v)));
                    });
                  }} />m</label
                >`
              : nothing}
            <button class="fp3d-btn fp3d-danger" ?disabled=${!admin} aria-label=${this.t("delete")} title=${this.t("delete")} @click=${() => this.deletePoolPort(a.id, p.id)}>✕</button>
          </div>`,
        )}
        <p class="fp3d-sub">${this.t("pool_ports_hint")}</p>
      </section>
      <section>
        <h3>${this.t("pool_devices")}</h3>
        <div class="fp3d-actions">
          ${POOL_DEVICES.filter((t) => t !== "pool_valve").map((t) => html`<button class="fp3d-btn" ?disabled=${!admin} @click=${() => this.addPoolDevice(t)}>+ ${this.t(`furn_${t}` as I18nKey)}</button>`)}
          <button class="fp3d-btn ${this._jointPlace === "tee" ? "fp3d-primary" : ""}" ?disabled=${!admin} title=${this.t("hint_joint_place")} @click=${() => (this._jointPlace = this._jointPlace === "tee" ? null : "tee")}>+ ${this.t("joint_add_tee")}</button>
          <button class="fp3d-btn ${this._jointPlace === "y" ? "fp3d-primary" : ""}" ?disabled=${!admin} title=${this.t("hint_joint_place")} @click=${() => (this._jointPlace = this._jointPlace === "y" ? null : "y")}>+ ${this.t("joint_add_y")}</button>
        </div>
        ${devs.map(
          (f) => html`<div class="fp3d-pool-row">
            <button class="fp3d-link" title=${this.t("card_open")} @click=${() => this.openCard(a.id, `dev:${f.id}`)}>${this.poolNodeLabel(a, `dev:${f.id}`)}</button>
            <span class="fp3d-ports">${devicePorts(f.type).map((q) => html`<i class=${pipes.some((p) => p.from === `dev:${f.id}:${q}` || p.to === `dev:${f.id}:${q}`) ? "fp3d-on" : ""}>${this.t(`port_${q}` as I18nKey)}</i>`)}</span>
            ${f.type === "pool_filter"
              ? html`<select ?disabled=${!admin} title=${this.t("pool_valve_type")} @change=${(e: Event) => this.setPoolDevice(f.id, { variant: (e.target as HTMLSelectElement).value === "top6" ? null : (e.target as HTMLSelectElement).value })}>
                    ${FILTER_VALVES.map((v) => html`<option value=${v} ?selected=${(f.variant ?? "top6") === v}>${this.t(`valve_${v}` as I18nKey)}</option>`)}
                  </select>
                  <select ?disabled=${!admin} title=${this.t("pool_valve_position")} @change=${(e: Event) => this.setPoolDevice(f.id, { valve_position: (e.target as HTMLSelectElement).value as ValvePosition })}>
                  ${VALVE_POSITIONS.map((v) => html`<option value=${v} ?selected=${(f.valve_position ?? "filter") === v}>${this.t(`valve_${v}` as I18nKey)}</option>`)}
                </select>`
              : f.type === "pool_heat_pump"
                ? html`<select ?disabled=${!admin} title=${this.t("hp_ports")} @change=${(e: Event) => this.setPoolDevice(f.id, { variant: (e.target as HTMLSelectElement).value === "right" ? null : (e.target as HTMLSelectElement).value })}>
                    ${(["right", "left", "back"] as const).map((v) => html`<option value=${v} ?selected=${(f.variant ?? "right") === v}>${this.t("hp_ports")}: ${this.t(`hp_side_${v}` as I18nKey)}</option>`)}
                  </select>`
              : f.type === "pool_valve"
                ? html`<label class="fp3d-check"
                    ><input type="checkbox" .checked=${f.valve_open !== false} ?disabled=${!admin} @change=${(e: Event) => this.setPoolDevice(f.id, { valve_open: (e.target as HTMLInputElement).checked ? null : false })} />
                    ${this.t("pool_valve_open")}</label
                  >`
                : nothing}
            <button class="fp3d-btn fp3d-danger" ?disabled=${!admin} aria-label=${this.t("delete")} title=${this.t("delete")} @click=${() => this.deletePoolDevice(f.id)}>✕</button>
          </div>`,
        )}
        ${(a.pool?.joints ?? []).map(
          (j) => html`<div class="fp3d-pool-row">
            <button class="fp3d-link" title=${this.t("card_open")} @click=${() => this.openCard(a.id, `joint:${j.id}`)}>${this.jointLabel(a, j.id)}</button>
            <span class="fp3d-ports">${jointPorts(j.kind).map((q) => {
              const n = `joint:${j.id}:${q}`;
              const on = pipes.some((p) => p.from === n || p.to === n || ((j.kind ?? "tee") !== "wall" && (j.kind ?? "tee") !== "floor" && nodePart(p.from) === `joint:${j.id}` && !splitNode(p.from).port && q === "in"));
              return html`<i class=${on ? "fp3d-on" : ""} title=${this.portText(n)}>${this.portText(n)}</i>`;
            })}</span>
            <button class="fp3d-btn fp3d-danger" ?disabled=${!admin} aria-label=${this.t("delete")} title=${this.t("delete")} @click=${() =>
              this.changePool(a.id, (l) => {
                l.joints = (l.joints ?? []).filter((x) => x.id !== j.id);
                l.pipes = (l.pipes ?? []).filter((p) => nodePart(p.from) !== `joint:${j.id}` && nodePart(p.to) !== `joint:${j.id}`);
              })}>✕</button>
          </div>`,
        )}
        <p class="fp3d-sub">${this.t("pool_holes_hint")}</p>
      </section>

      <section>
        <h3>${this.t("pool_pipes")}</h3>
        <div class="fp3d-actions">
          <button class="fp3d-btn ${this._pipeMode ? "fp3d-primary" : ""}" ?disabled=${!admin} @click=${() => ((this._pipeMode = !this._pipeMode), (this._pipeDraft = null))}>〰 ${this.t("pool_pipe_draw")}</button>
        </div>
        <p class="fp3d-sub">${this.t("pool_pipe_draw_hint")}</p>
        ${pipes.map(
          (p) => html`<div class="fp3d-pool-row ${p.id === this._pipeId ? "fp3d-pool-row-sel" : ""}">
            <button class="fp3d-link" @click=${() => (this._pipeId = p.id)}>${this.poolNodeLabel(a, p.from)} → ${this.poolNodeLabel(a, p.to)}</button>
            <button class="fp3d-btn" ?disabled=${!admin} title=${this.t("pool_pipe_reverse")} @click=${() => this.changePool(a.id, (l) => { const q = l.pipes?.find((x) => x.id === p.id); if (q) [q.from, q.to, q.points] = [q.to, q.from, [...q.points].reverse()]; })}>⇄</button>
            <button class="fp3d-btn fp3d-danger" ?disabled=${!admin} aria-label=${this.t("delete")} title=${this.t("delete")} @click=${() => this.changePool(a.id, (l) => (l.pipes = (l.pipes ?? []).filter((x) => x.id !== p.id)))}>✕</button>
          </div>`,
        )}
        ${pipe
          ? html`<div class="fp3d-form">
              ${this.len(this.t("pool_pipe_height"), pipe.height ?? 0.3, (v) => this.changePool(a.id, (l) => { const q = l.pipes?.find((x) => x.id === pipe.id); if (q) q.height = Math.min(10, Math.max(-5, round(v))); }), 0.05)}
            </div>`
          : nothing}
      </section>`;
  }

  /** A pool's shape and size (a round one by its diameter, an oval one by its box) and whether it stands above ground. */
  renderPoolShape(this: Fp3dEditor, a: OutdoorArea) {
    const admin = this.isEditor;
    const b = bounds(a.points);
    const shape = a.pool_shape;
    const resize = (x0: number, z0: number, x1: number, z1: number) => shape && this.updateOutdoor({ points: poolShapePoints(shape, x0, z0, x1, z1) });
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    return html`${shape === "round"
        ? html`${this.len(this.t("pool_diameter"), b.x1 - b.x0, (v) => {
            const r = Math.max(0.5, v) / 2;
            resize(cx - r, cz - r, cx + r, cz + r);
          }, 0.01, 1)}`
        : shape === "oval"
          ? html`${this.len(this.t("width"), b.x1 - b.x0, (v) => resize(cx - Math.max(1, v) / 2, b.z0, cx + Math.max(1, v) / 2, b.z1), 0.01, 1)}
            ${this.len(this.t("depth"), b.z1 - b.z0, (v) => resize(b.x0, cz - Math.max(1, v) / 2, b.x1, cz + Math.max(1, v) / 2), 0.01, 1)}`
          : nothing}
      <label class="fp3d-check fp3d-wide" title=${this.t("pool_above_hint")}
        ><input type="checkbox" .checked=${!!a.above} ?disabled=${!admin} @change=${(ev: Event) => this.updateOutdoor({ above: (ev.target as HTMLInputElement).checked || undefined })} />
        ${this.t("pool_above")}</label
      >
      ${a.above ? this.len(this.t("pool_height"), poolHeight(a), (v) => this.updateOutdoor({ height: Math.min(2.5, Math.max(0.4, round(v))) }), 0.05, 0.4) : nothing}
      ${this.len(this.t("pool_depth"), poolDepth(a), (v) => this.updateOutdoor({ depth: Math.min(5, Math.max(0.3, round(v))) }), 0.05, 0.3)}
      ${a.above ? nothing : this.len(this.t("pool_rim"), a.rim ?? 0.06, (v) => this.updateOutdoor({ rim: Math.min(2, Math.max(-0.3, round(v))) }), 0.01, -0.3)}
      <p class="fp3d-sub fp3d-wide">${this.t("pool_depth_hint")}</p>
      ${!a.above && this.floor && !poolSunken(this.floor, a) ? html`<p class="fp3d-sub fp3d-wide fp3d-warn">${this.t("pool_depth_ground")}</p>` : nothing}`;
  }
}
