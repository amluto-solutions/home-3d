// The live parts of pack items in the 3D view (#466) and their fan blades (#1084): a model per item and group (slot
// and kind, see live-parts.ts) at its pivot, in its floor's own wall and line materials (so it takes the look, the
// realistic style and the floor's fading like the rest of the item), moved towards the value its entity gives: doors
// swing, drawers slide, ovens and dishwashers fold down, drums and fans turn, levels fill, status lights show ok, off or
// a fault (a fault pulses). Without an entity a part stands as drawn. Nothing is drawn per frame unless something moves.
// Ported from NeonPlan 3D 3.4.0 (MIT, Mastershort): the poses and the value steps; the class around them is our own.

import { Group, LineSegments, Mesh, MeshBasicMaterial, type Material } from "three";
import type { Floor } from "../model.ts";
import { mountBase, packItem, packsVersion } from "../packs.ts";
import { hasLiveParts, liveGroups } from "../live-parts.ts";
import { pushPackLive, type LiveModel } from "./furniture.ts";
import { DEG, GeoBuffer, LineBuffer } from "./geo.ts";

/** What a floor of the view lends the live parts: its plan, its group and its materials. */
export interface LiveFloor {
  floor: Floor;
  group: Group;
  materials: { wall: Material; lines: Material };
}

interface LivePart {
  group: Group;
  mesh: Mesh;
  edges: LineSegments | null;
  /** Its own material (status lights and glowing parts are tinted), else null: the floor's wall material. */
  mat: MeshBasicMaterial | null;
  model: LiveModel;
  floor: LiveFloor;
  /** Its height above the floor (left out above cut walls). */
  y: number;
  furnitureId: string;
  sig: string;
  /** Where it goes and where it is: 0–1, -1 (a fault), NaN (no entity: as drawn). */
  target: number;
  value: number;
}

/** About a second from closed to open. */
const SPEED = 1.6;

export class LiveParts {
  private parts = new Map<string, LivePart>();
  private values = new Map<string, number>();
  private last = 0;

  /** Any live part in the view. */
  get size(): number {
    return this.parts.size;
  }

  /** The values by "<furniture id>|<group key>" (live-values.ts); the parts move towards them. */
  setValues(values: Map<string, number>): void {
    this.values = values;
    for (const [id, p] of this.parts) p.target = values.get(id) ?? NaN;
    this.last = 0;
  }

  /**
   * The models for the floors' pack items with live parts: built where missing, rebuilt when the item, its place, size
   * or colours, the look (`look`) or the floor view changed, dropped for items that are gone. Cheap when nothing lives.
   */
  sync(floors: readonly LiveFloor[], look: string): void {
    const seen = new Set<string>();
    const version = packsVersion();
    for (const fv of floors) {
      for (const f of fv.floor.furniture) {
        if (!f.type.startsWith("pack:")) continue;
        const item = packItem(f.type);
        if (!item || !hasLiveParts(item)) continue;
        const base = mountBase(fv.floor, f);
        const sig = [f.x, f.z, f.rotation, f.w, f.d, f.h, f.mirror ? 1 : 0, base, look, version, JSON.stringify(f.colors ?? null), JSON.stringify(f.materials ?? null)].join("|");
        for (const key of liveGroups(item.parts).keys()) {
          const id = `${f.id}|${key}`;
          seen.add(id);
          let part = this.parts.get(id);
          if (part && (part.sig !== sig || part.floor !== fv)) {
            this.drop(part);
            this.parts.delete(id);
            part = undefined;
          }
          if (!part) {
            const buf = new GeoBuffer();
            const lines = new LineBuffer();
            const model = pushPackLive(buf, lines, item, f, key, base);
            if (!model) continue;
            const mat = model.lit ? new MeshBasicMaterial({ vertexColors: true }) : null;
            const mesh = new Mesh(buf.geometry(), mat ?? fv.materials.wall);
            const edges = lines.p.length ? new LineSegments(lines.geometry(), fv.materials.lines) : null;
            if (edges) mesh.add(edges);
            const inner = new Group();
            inner.add(mesh);
            inner.position.set(model.pivot[0], model.pivot[1], model.pivot[2]);
            const group = new Group();
            group.add(inner);
            group.position.set(f.x, base, f.z);
            group.rotation.y = -(f.rotation * DEG);
            const target = this.values.get(id) ?? NaN;
            // a new part shows where its entity is at once, it does not swing there
            part = { group, mesh, edges, mat, model, floor: fv, y: base + model.pivot[1], furnitureId: f.id, sig, target, value: target };
            this.parts.set(id, part);
            pose(part, 0);
          }
        }
      }
    }
    for (const [id, p] of this.parts) {
      if (seen.has(id)) continue;
      this.drop(p);
      this.parts.delete(id);
    }
    this.last = 0;
  }

  /**
   * One frame: each part into its floor's group, hidden above cut walls (`cutWalls`) or with its item (`hidden`), moved
   * a step towards its value. `moving`: a door or drawer is on its way (frames at full rate); `turning`: blades or a
   * drum turn or a fault pulses (the slower frames of turning fans).
   */
  step(now: number, floors: ReadonlyMap<string, LiveFloor>, cutWalls: boolean, hidden: ReadonlySet<string>): { moving: boolean; turning: boolean } {
    if (!this.parts.size) return { moving: false, turning: false };
    const dt = this.last ? Math.min(0.2, (now - this.last) / 1000) : 0;
    this.last = now;
    let moving = false;
    let turning = false;
    for (const p of this.parts.values()) {
      const fv = floors.get(p.floor.floor.id);
      if (!fv || fv !== p.floor) {
        p.group.removeFromParent();
        continue;
      }
      if (p.group.parent !== fv.group) fv.group.add(p.group);
      p.group.visible = !hidden.has(p.furnitureId) && !(cutWalls && p.y > Math.min(fv.floor.cut_height, fv.floor.height));
      const b = p.model.bind;
      if (b.kind === "spin") {
        p.value = p.target;
        if (p.target > 0) {
          turning = true;
          // turns a minute at full speed (default one a second); a desk fan's blades turn faster than a ceiling fan's
          const rate = ((b.amount ?? (b.axis === "z" && b.slot === "~fan" ? 150 : 60)) / 60) * Math.PI * 2;
          const turn = p.target * rate * dt;
          if (b.axis === "x") p.mesh.rotation.x -= turn;
          else if (b.axis === "z") p.mesh.rotation.z -= turn;
          else p.mesh.rotation.y -= turn;
        }
        continue;
      }
      if (Number.isNaN(p.target) !== Number.isNaN(p.value)) {
        // linked or unlinked: straight to rest (closed, full) or to its value from there
        p.value = Number.isNaN(p.target) ? NaN : b.kind === "level" ? 1 : 0;
        moving = true;
      }
      if (!Number.isNaN(p.target) && p.value !== p.target) {
        const step = dt * SPEED;
        p.value = Math.abs(p.target - p.value) <= step || b.kind === "blink" ? p.target : p.value + Math.sign(p.target - p.value) * step;
        moving = true;
      }
      if (b.kind === "blink" && p.value < -0.5) turning = true;
      pose(p, now);
    }
    if (!moving && !turning) this.last = 0;
    return { moving, turning };
  }

  /** Takes every model out of the scene (the floors are cleared); the next step puts back those whose floor stays. */
  detach(): void {
    for (const p of this.parts.values()) p.group.removeFromParent();
  }

  dispose(): void {
    for (const p of this.parts.values()) this.drop(p);
    this.parts.clear();
  }

  private drop(p: LivePart): void {
    p.group.removeFromParent();
    p.mesh.geometry.dispose();
    p.edges?.geometry.dispose();
    p.mat?.dispose();
  }
}

/** A live part at its value: turned open, slid out, filled, tinted. */
function pose(p: Pick<LivePart, "mesh" | "mat" | "model" | "value">, now: number): void {
  const { bind: b, rest } = p.model;
  const m = p.mesh;
  // no entity linked: the part as the item was drawn (closed, full, in its own colour)
  if (Number.isNaN(p.value)) {
    if (b.kind !== "spin") m.rotation.set(0, 0, 0);
    m.position.z = 0;
    m.scale.y = 1;
    p.mat?.color.setHex(rest);
    return;
  }
  const v = p.value;
  // a mirrored item's x runs the other way: its side hinges turn the other way round
  const side = p.model.mirrored ? -1 : 1;
  switch (b.kind) {
    case "open": {
      const a = (b.amount ?? 95) * DEG * Math.max(0, Math.min(1, v));
      const hinge = b.hinge ?? "left";
      if (hinge === "left") m.rotation.set(0, -a * side, 0);
      else if (hinge === "right") m.rotation.set(0, a * side, 0);
      else if (hinge === "top") m.rotation.set(-a, 0, 0);
      else m.rotation.set(a, 0, 0);
      break;
    }
    case "slide":
      m.position.z = Math.max(0, Math.min(1, v)) * (b.amount ?? 0.45) * p.model.depth;
      break;
    case "level":
      m.scale.y = Math.max(0.02, Math.min(1, v));
      break;
    case "blink": {
      // fine: green; off: a dim grey; a fault: red, pulsing
      p.mat?.color.setHex(v > 0.5 ? 0x3dff8a : v < -0.5 ? 0xff3b4f : 0x39414f);
      if (v < -0.5) p.mat?.color.multiplyScalar(0.55 + 0.45 * Math.abs(Math.sin(now / 350)));
      break;
    }
    case "glow":
      // its own colour, dim while off and full while on
      p.mat?.color.setHex(rest).multiplyScalar(0.22 + 0.78 * Math.max(0, Math.min(1, v)));
      break;
    case "spin":
      break;
  }
}
