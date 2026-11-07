// What a module needs to lay pipes the way the editor's wall view does: the walls of a room (with what stands on
// them), where a pool's pipe nodes sit, and a connection laid from part to part through holes and valves. Pure
// host geometry handed to modules (the pool module's plant assistant describes the plant, this lays it).

import type { Building, PoolJoint, PoolPipe, Vec2 } from "./model.ts";
import { fromWall, furnitureOnWall, openingsOnWall, roomEdgeFrame, type WallFrame } from "./geometry/wall-frame.ts";
import { sharedEdge } from "./geometry/snap.ts";
import { jointPortAt, splitNode } from "./pool-ports.ts";
import { planConnection, poolNodeAt, type ConnectRequest } from "./pool-runs.ts";
import type { NodeAt } from "./geometry/runs.ts";

/** A wall of a room as a module sees it. */
export interface WallSpec {
  roomId: string;
  edge: number;
  a: Vec2;
  b: Vec2;
  /** Unit direction a → b and the unit normal into the room. */
  u: Vec2;
  n: Vec2;
  length: number;
  /** Shared with another room (an inner wall) and how thick it is. */
  shared: boolean;
  thickness: number;
  /** Stretches along the wall (s from … to) already taken by furniture, doors and windows down to the floor. */
  taken: [number, number][];
}

export interface PipePlanner {
  /** The walls of a room, in the order of its corners. */
  walls(b: Building, floorId: string, roomId: string): WallSpec[];
  /** A point `s` along a wall and `d` in front of its surface (plan coordinates). */
  onWall(w: WallSpec, s: number, d: number): Vec2;
  /** The first stretch of `width` free on a wall (s of its start), from the middle outwards; null when none. */
  freeSpot(w: WallSpec, width: number, margin?: number): number | null;
  /** Where a pool's pipe nodes sit in a plan: ports, devices with their connections, joints and holes. */
  nodeAt(b: Building, floorId: string, areaId: string): NodeAt;
  /** A connection laid from part to part (through each hole from the side it comes from, with valves): the pipes and joints to add. */
  connect(b: Building, floorId: string, areaId: string, req: Omit<ConnectRequest, "floorId">, flow: (node: string) => "source" | "sink" | null, newId: (kind: string) => string): { pipes: PoolPipe[]; joints: PoolJoint[] };
}

function frameOf(w: WallSpec): WallFrame {
  return { a: w.a, b: w.b, u: w.u, n: w.n, length: w.length, rightward: true };
}

export const pipePlanner: PipePlanner = {
  walls(b, floorId, roomId) {
    const floor = b.floors.find((f) => f.id === floorId);
    const room = floor?.rooms.find((r) => r.id === roomId);
    if (!floor || !room || room.points.length < 3) return [];
    return room.points.map((_, edge) => {
      const f = roomEdgeFrame(room, edge);
      const shared = sharedEdge(floor, room.id, f.a, f.b);
      const taken: [number, number][] = [
        ...furnitureOnWall(f, floor, room).map((i) => [i.s0, i.s1] as [number, number]),
        ...openingsOnWall(f, floor)
          .filter((o) => o.y0 < 0.05)
          .map((o) => [o.s0, o.s1] as [number, number]),
      ];
      return { roomId: room.id, edge, a: f.a, b: f.b, u: f.u, n: f.n, length: f.length, shared, thickness: shared ? b.settings.wall_interior : b.settings.wall_exterior, taken };
    });
  },
  onWall(w, s, d) {
    return fromWall(frameOf(w), s, d);
  },
  freeSpot(w, width, margin = 0.1) {
    const fits = (t: number) => t >= margin && t + width <= w.length - margin && !w.taken.some(([a, b]) => t < b + 0.05 && t + width > a - 0.05);
    const mid = w.length / 2 - width / 2;
    for (let k = 0; k <= w.length; k += 0.05) {
      if (fits(mid - k)) return Math.round((mid - k) * 100) / 100;
      if (fits(mid + k)) return Math.round((mid + k) * 100) / 100;
    }
    return null;
  },
  nodeAt(b, floorId, areaId) {
    const floor = b.floors.find((f) => f.id === floorId);
    const area = floor?.outdoor.find((o) => o.id === areaId);
    if (!floor || !area) return () => null;
    const base = poolNodeAt(b, floor, area);
    const l = area.pool ?? {};
    return (n) => {
      const { kind, id, port } = splitNode(n);
      const j = kind === "joint" ? (l.joints ?? []).find((q) => q.id === id) : undefined;
      if (j) return jointPortAt(j, port);
      const pp = kind === "port" ? (l.ports ?? []).find((q) => q.id === id) : undefined;
      return pp ? (base(n) ?? { x: pp.x, y: 0.02, z: pp.z }) : base(n);
    };
  },
  connect(b, floorId, areaId, req, flow, newId) {
    const floor = b.floors.find((f) => f.id === floorId);
    const area = floor?.outdoor.find((o) => o.id === areaId);
    if (!floor || !area) return { pipes: [], joints: [] };
    return planConnection({ ...req, floorId }, pipePlanner.nodeAt(b, floorId, areaId), area.pool?.joints ?? [], flow, newId);
  },
};
